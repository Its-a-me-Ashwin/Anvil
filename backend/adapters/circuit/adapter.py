"""Circuit adapter — custom, not MCP.

Stores wiring diagrams as small JSON files that the frontend can load into the
WiringDiagram workspace. The contract mirrors the frontend's WiringDiagramData:

    {
      "modules": [{"id": "mcu", "name": "Arduino", "pins": [...]}, ...],
      "connections": [["mcu", "TX", "gps", "RX", "blue"], ...]
    }

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


def create_wiring_diagram(project: str, modules: list[dict], connections: list[list]) -> dict:
    """Create or overwrite a wiring diagram for a project."""
    data = {"modules": modules, "connections": connections}
    validation = validate_wiring_data(data)
    if not validation["valid"]:
        raise ValueError(validation["errors"])

    path = _project_path(project)
    path.write_text(json.dumps(data, indent=2))
    return {"project": project, "path": str(path), "modules": len(modules), "connections": len(connections)}


def update_wiring_diagram(project: str, modules: list[dict], connections: list[list]) -> dict:
    """Alias for create_wiring_diagram."""
    return create_wiring_diagram(project, modules, connections)


def get_wiring_diagram(project: str) -> dict:
    """Read a wiring diagram."""
    path = _project_path(project)
    if not path.exists():
        raise FileNotFoundError(f"Wiring diagram for project {project!r} not found")
    return json.loads(path.read_text())


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
