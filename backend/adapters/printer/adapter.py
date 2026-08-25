"""Printer adapter — custom, not MCP.

Talks to the Anvil Workshop Bridge (the same local Node HTTP server the
frontend uses) so the agent can slice models and send them to a Bambu printer
without spawning CLI tools directly.
"""

import base64
import os
from pathlib import Path
from urllib import request, error

BRIDGE_URL = os.environ.get("ANVIL_BRIDGE_URL", "http://localhost:3001")


def _post(path: str, body: dict) -> dict:
    data = json_bytes(body)
    req = request.Request(
        f"{BRIDGE_URL}{path}",
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=300) as resp:
            return _read_json(resp)
    except error.HTTPError as e:
        return _read_json(e)


def _get(path: str) -> dict:
    req = request.Request(f"{BRIDGE_URL}{path}", method="GET")
    with request.urlopen(req, timeout=30) as resp:
        return _read_json(resp)


def json_bytes(obj: dict) -> bytes:
    import json
    return json.dumps(obj).encode("utf-8")


def _read_json(resp) -> dict:
    import json
    raw = resp.read()
    return json.loads(raw.decode("utf-8"))


def check_bridge_health() -> dict:
    """Check whether the bridge and Bambu tools are available."""
    return _get("/health")


def register_printer(name: str, host: str, serial_number: str, access_code: str, model: str = "p1p") -> dict:
    """Register or update a printer in the bridge config."""
    return _post(
        "/printers",
        {
            "name": name,
            "host": host,
            "serialNumber": serial_number,
            "accessCode": access_code,
            "model": model,
        },
    )


def list_printers() -> list[dict]:
    """List printers registered with the bridge."""
    data = _get("/printers")
    return data.get("printers", [])


def slice_model(file_path: str, params: dict, model: str = "p1p") -> dict:
    """Slice an STL/3MF using Bambu Studio CLI via the bridge.

    params example:
        {"bedAdhesion": "Cool Plate", "infill": 20, "support": false}
    """
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Model not found: {file_path}")
    b64 = base64.b64encode(path.read_bytes()).decode("utf-8")
    return _post(
        "/slice",
        {
            "filename": path.name,
            "base64": b64,
            "params": params,
            "model": model,
        },
    )


def send_to_printer(output_path: str, printer_name: str) -> dict:
    """Send an already-sliced .3mf to a printer."""
    return _post(
        "/print",
        {"outputPath": output_path, "printerName": printer_name},
    )
