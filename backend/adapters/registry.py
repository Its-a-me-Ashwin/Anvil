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
        scope=[
            "read_text_file",
            "write_file",
            "edit_file",
            "search_files",
            "list_directory",
            "get_file_info",
        ],
        status="testing",
    ),
    AdapterEntry(
        name="cad",
        description=(
            "Parametric multi-part CAD assemblies via build123d: create primitive "
            "shapes, position them, combine with boolean ops, fillet, inspect, "
            "and export (gltf/step/stl)."
        ),
        backing="custom",
        scope=[
            "add_box", "add_cylinder", "add_tube", "add_sphere", "add_cone",
            "position_part", "remove_part", "boolean_op", "fillet_part",
            "list_parts", "get_part_info", "export_assembly",
        ],
        status="testing",
    ),
    AdapterEntry(
        name="circuit",
        description="Create, read, update, and delete wiring diagrams for the circuit workspace.",
        backing="custom",
        scope=[
            "create_wiring_diagram",
            "update_wiring_diagram",
            "get_wiring_diagram",
            "delete_wiring_diagram",
            "list_wiring_diagrams",
        ],
        status="testing",
    ),
    AdapterEntry(
        name="printer",
        description="Slice models with Bambu Studio and send them to a local Bambu printer.",
        backing="custom",
        scope=[
            "check_bridge_health",
            "register_printer",
            "list_printers",
            "slice_model",
            "send_to_printer",
        ],
        status="testing",
    ),
    AdapterEntry(
        name="state",
        description="Firestore-backed project state: inventory, constraints, objectives, decisions, artifacts.",
        backing="custom",
        scope=[
            "read_project_summary",
            "read_inventory",
            "update_inventory",
            "add_constraint",
            "read_constraints",
            "add_objective",
            "mark_objective_done",
            "read_objectives",
            "record_decision",
            "approve_decision",
            "read_decisions",
        ],
        status="testing",
    ),
]


def get_adapter(name: str) -> AdapterEntry:
    for adapter in ADAPTERS:
        if adapter.name == name:
            return adapter
    raise KeyError(f"No adapter registered with name {name!r}")
