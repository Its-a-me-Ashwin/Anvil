"""Central manifest of tool adapters available to the agent.

This is the single source of truth for "what can the agent touch." Every
adapter — whether backed by an MCP server or hand-written — gets one entry
here. The agent-facing wiring (ADK MCPToolset / FunctionTool) is built from
this list, so nothing gets exposed to the model without an explicit,
narrowly-scoped entry.
"""

from dataclasses import dataclass, field
from typing import Literal

Backing = Literal["mcp", "custom"]
Status = Literal["planned", "testing", "ready"]


@dataclass(frozen=True)
class AdapterEntry:
    name: str
    description: str
    backing: Backing
    scope: list[str]  # exact tool names exposed to the agent
    status: Status


ADAPTERS: list[AdapterEntry] = [
    AdapterEntry(
        name="filesystem",
        description="Read/write/list files in the active project directory only.",
        backing="mcp",
        scope=["read_text_file", "write_file", "list_directory", "get_file_info"],
        status="testing",
    ),
]


def get_adapter(name: str) -> AdapterEntry:
    for adapter in ADAPTERS:
        if adapter.name == name:
            return adapter
    raise KeyError(f"No adapter registered with name {name!r}")
