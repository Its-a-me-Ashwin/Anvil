"""Connection config for the search adapter.

Backed by the official Brave Search MCP server (`@brave/brave-search-mcp-server`),
run as a subprocess over stdio. The server exposes 8 tools (web/local/video/
image/news/summarizer/place search + LLM context) — see registry.py for the
exact allow-list. We only scope in the two that matter for now: general web
search for the human-facing UI, and Brave's agent-optimized LLM context
endpoint for the agent's own research.
"""

import os

from mcp import StdioServerParameters


class MissingApiKeyError(RuntimeError):
    pass


def get_server_params() -> StdioServerParameters:
    api_key = os.environ.get("BRAVE_API_KEY")
    if not api_key:
        raise MissingApiKeyError(
            "BRAVE_API_KEY is not set. Get a key at https://api.search.brave.com/ "
            "and add it to backend/.env (see backend/.env.example)."
        )
    return StdioServerParameters(
        command="npx",
        args=["-y", "@brave/brave-search-mcp-server", "--transport", "stdio"],
        env={**os.environ, "BRAVE_API_KEY": api_key},
    )
