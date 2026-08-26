"""Standalone proof that the filesystem adapter works — no agent, no ADK, no Gemini.

Run:
    python -m adapters.filesystem.test_adapter

Connects to the filesystem MCP server exactly the way ADK's MCPToolset will,
confirms the scoped tool set is present, then exercises write -> edit -> search
-> list -> read -> get_file_info end to end against the project root.
"""

import asyncio
import sys
from pathlib import Path

from mcp import ClientSession
from mcp.client.stdio import stdio_client

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.filesystem.adapter import PROJECT_DIR, get_server_params
from adapters.registry import get_adapter

TEST_FILE = "adapter_smoke_test.md"
EDIT_FILE = "adapter_edit_test.py"


async def main() -> None:
    adapter = get_adapter("filesystem")
    print(f"Project directory (scoped root): {PROJECT_DIR}")
    print(f"Allowed tools: {adapter.scope}")

    server_params = get_server_params()

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

            print(f"\n-- write_file({TEST_FILE}) --")
            write_result = await session.call_tool(
                "write_file",
                {"path": TEST_FILE, "content": "# Adapter smoke test\n\nWritten by test_adapter.py.\n"},
            )
            assert not write_result.is_error, write_result.content
            print("OK")

            print(f"\n-- edit_file({TEST_FILE}) --")
            edit_result = await session.call_tool(
                "edit_file",
                {
                    "path": TEST_FILE,
                    "edits": [
                        {
                            "oldText": "Written by test_adapter.py.",
                            "newText": "Edited by edit_file via the agent filesystem tool.",
                        }
                    ],
                },
            )
            assert not edit_result.is_error, edit_result.content
            print(edit_result.content[0].text)

            print(f"\n-- write_file({EDIT_FILE}) --")
            await session.call_tool(
                "write_file",
                {"path": EDIT_FILE, "content": "def hello():\n    return 'world'\n"},
            )

            print("\n-- search_files(.py) --")
            search_result = await session.call_tool(
                "search_files", {"path": ".", "pattern": "adapter_edit_test.py"}
            )
            print(search_result.content[0].text)
            assert EDIT_FILE in search_result.content[0].text

            print("\n-- list_directory(.) --")
            list_result = await session.call_tool("list_directory", {"path": "."})
            listing = list_result.content[0].text
            print(listing)
            assert TEST_FILE in listing, "written file did not show up in directory listing"

            print(f"\n-- read_text_file({TEST_FILE}) --")
            read_result = await session.call_tool("read_text_file", {"path": TEST_FILE})
            content = read_result.content[0].text
            print(content)
            assert "Edited by edit_file" in content

            print(f"\n-- get_file_info({TEST_FILE}) --")
            info_result = await session.call_tool("get_file_info", {"path": TEST_FILE})
            print(info_result.content[0].text)

            print("\n-- boundary check: read_text_file outside sandbox --")
            escape_result = await session.call_tool(
                "read_text_file", {"path": "../../.env.example"}
            )
            assert escape_result.is_error, (
                "server allowed reading a file outside the sandbox root — "
                "scoping is not actually enforced!"
            )
            print(f"OK — rejected: {escape_result.content[0].text}")

    print("\nAll scoped filesystem tools verified working end to end.")


if __name__ == "__main__":
    asyncio.run(main())
