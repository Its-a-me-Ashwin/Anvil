"""Circuit adapter — custom, not MCP.

Stores wiring diagrams as small JSON files that the frontend can load into the
WiringDiagram workspace. The stored/on-disk contract mirrors the frontend's
WiringDiagramData:

    {
      "modules": [{"id": "mcu", "name": "Arduino", "pins": [...]}, ...],
      "connections": [["mcu", "TX", "gps", "RX", "blue"], ...]
    }

but create/update take `connections` as a flat list of objects instead — see
`create_wiring_diagram` — converted to the tuple form above only when
writing to disk. Firestore (used for ADK session/event persistence) rejects
an array nested directly inside another array ("Cannot convert an array
value in an array value"), and connections-as-tuples is exactly that once
it round-trips through a tool call's arguments; a list of flat objects
avoids the nesting since each array element is a map, not another array.

Diagrams live in backend/circuit_output/<project>.json.
"""

import json
import shutil
from pathlib import Path

from adapters.circuit.validation import validate_wiring_data

BACKEND_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BACKEND_DIR / "circuit_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _project_path(project: str) -> Path:
    safe = Path(project).name
    return OUTPUT_DIR / f"{safe}.json"


def _connections_to_tuples(connections: list[dict]) -> list[list]:
    tuples = []
    for c in connections:
        row = [c.get("from_module"), c.get("from_pin"), c.get("to_module"), c.get("to_pin")]
        if c.get("color"):
            row.append(c["color"])
        tuples.append(row)
    return tuples


def _connections_to_dicts(connections: list[list]) -> list[dict]:
    dicts = []
    for c in connections:
        d = {"from_module": c[0], "from_pin": c[1], "to_module": c[2], "to_pin": c[3]}
        if len(c) > 4 and c[4]:
            d["color"] = c[4]
        dicts.append(d)
    return dicts


def create_wiring_diagram(project: str, modules: list[dict], connections: list[dict]) -> dict:
    """Create or overwrite a wiring diagram for a project.

    connections: one object per wire, e.g.
      {"from_module": "mcu", "from_pin": "TX", "to_module": "gps", "to_pin": "RX", "color": "blue"}
    (color is optional)."""
    tuple_connections = _connections_to_tuples(connections)
    data = {"modules": modules, "connections": tuple_connections}
    validation = validate_wiring_data(data)
    if not validation["valid"]:
        raise ValueError(validation["errors"])

    path = _project_path(project)
    path.write_text(json.dumps(data, indent=2))
    return {"project": project, "path": str(path), "modules": len(modules), "connections": len(tuple_connections)}


def update_wiring_diagram(project: str, modules: list[dict], connections: list[dict]) -> dict:
    """Alias for create_wiring_diagram."""
    return create_wiring_diagram(project, modules, connections)


def read_wiring_diagram(project: str) -> dict:
    """Read a wiring diagram's raw on-disk form (connections as tuples), or
    an empty one if none exists yet. For the HTTP API that feeds the
    frontend's WiringDiagram viewer — not exposed to the agent as a tool;
    see `get_wiring_diagram` for that."""
    path = _project_path(project)
    if not path.exists():
        return {"modules": [], "connections": []}
    return json.loads(path.read_text())


def get_wiring_diagram(project: str) -> dict:
    """Read a wiring diagram for the agent to inspect, or an empty one if
    none exists yet.

    connections are returned as flat objects (see create_wiring_diagram),
    not the on-disk tuple form — like that function's input, this return
    value flows into the Firestore-persisted conversation history, which
    rejects an array nested directly inside another array.

    Returns rather than raises on a missing diagram: the agent routinely
    calls this to check for an existing diagram before deciding whether to
    create or update one, and an uncaught exception from a FunctionTool
    crashes the whole chat turn rather than surfacing as a tool error the
    model can react to."""
    data = read_wiring_diagram(project)
    return {"modules": data["modules"], "connections": _connections_to_dicts(data["connections"])}


def delete_wiring_diagram(project: str) -> dict:
    """Delete a wiring diagram."""
    path = _project_path(project)
    if path.exists():
        path.unlink()
        return {"deleted": True, "project": project}
    return {"deleted": False, "project": project, "reason": "not found"}


def list_wiring_diagrams() -> list[str]:
    """List all saved wiring diagram project names."""
    return [p.stem for p in OUTPUT_DIR.glob("*.json")]
