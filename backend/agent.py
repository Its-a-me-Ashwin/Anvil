"""Template for the Anvil ADK agent — not yet implemented.

This file is a placeholder for wiring adapters/registry.py into a real
Google ADK agent once `google-adk` is added and a Gemini API key is
available. Nothing here runs yet; it exists so the intended shape of the
wiring is documented in code, not just in someone's head.

Each adapter's own get_server_params() already exists and is proven working
standalone (see adapters/<name>/test_adapter.py, run via `make test-<name>`)
— this file's only job, once implemented, is to turn ADAPTERS entries into
real ADK tools without changing anything about the adapters themselves.
"""

# TODO(adk): once `google-adk` is installed (add to requirements.txt) and a
# Gemini API key is available, implement build_tools() below.
#
# from google.adk.agents import Agent
# from google.adk.tools.mcp_tool import MCPToolset
#
# from adapters.registry import ADAPTERS
# from adapters.filesystem.adapter import get_server_params as filesystem_params
# from adapters.search.adapter import get_server_params as search_params
#
# # Map each MCP-backed adapter name to its connection-params function. When a
# # "custom" (non-MCP) adapter is added, give it a plain ADK FunctionTool
# # instead and branch on entry.backing below.
# _MCP_PARAMS = {
#     "filesystem": filesystem_params,
#     "search": search_params,
# }
#
#
# def build_tools() -> list:
#     """Turn adapters/registry.py into the real tool list ADK will use.
#
#     Scope is enforced here via tool_filter=entry.scope — the MCP server may
#     expose more tools than we register (see each adapter's adapter.py for
#     what's deliberately left out and why).
#     """
#     tools = []
#     for entry in ADAPTERS:
#         if entry.backing != "mcp":
#             continue  # custom adapters aren't wired yet
#         params = _MCP_PARAMS[entry.name]()
#         tools.append(MCPToolset(connection_params=params, tool_filter=entry.scope))
#     return tools
#
#
# def build_agent() -> Agent:
#     return Agent(
#         model="gemini-3.5",  # or whatever Gemini API/Vertex AI model id is current
#         name="anvil",
#         tools=build_tools(),
#         # instructions=... — the collaborative-partner behavior (clarifying
#         # questions, respecting locked constraints from registry-style state)
#         # lives here once designed.
#     )


def main() -> None:
    raise NotImplementedError(
        "The ADK agent isn't wired up yet — see the TODO(adk) block above. "
        "Until then, test adapters individually with `make test-<name>`."
    )


if __name__ == "__main__":
    main()
