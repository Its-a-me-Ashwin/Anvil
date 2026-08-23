"""Standalone proof that the search adapter works — no agent, no ADK, no Gemini.

Run:
    python -m adapters.search.test_adapter

Connects to the Brave Search MCP server exactly the way ADK's MCPToolset
will, confirms the scoped tool set is present, then issues a real
brave_web_search query and prints the top results.
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv
from mcp import ClientSession
from mcp.client.stdio import stdio_client

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.registry import get_adapter
from adapters.search.adapter import MissingApiKeyError, get_server_params

TEST_QUERY = "compact 10:1 cycloidal reducer bearing"


async def main() -> None:
    adapter = get_adapter("search")
    print(f"Allowed tools: {adapter.scope}")

    try:
        server_params = get_server_params()
    except MissingApiKeyError as e:
        print(f"\n{e}")
        sys.exit(1)

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()

            available = await session.list_tools()
            available_names = {t.name for t in available.tools}
            missing = set(adapter.scope) - available_names
            if missing:
                raise RuntimeError(
                    f"Server does not expose expected tools: {missing}. "
                    f"Available: {sorted(available_names)}"
                )
            print(f"Server exposes {len(available_names)} tools total; "
                  f"all {len(adapter.scope)} scoped tools present.")

            print(f"\n-- brave_web_search({TEST_QUERY!r}) --")
            result = await session.call_tool(
                "brave_web_search", {"query": TEST_QUERY, "count": 5}
            )
            assert not result.is_error, result.content
            print(result.content[0].text)

    print("\nAll scoped search tools verified working end to end.")


if __name__ == "__main__":
    load_dotenv()
    asyncio.run(main())
