"""Printer camera monitoring via a local Ollama vision model (Gemma).

Grabs a live JPEG frame from the printer's camera through the Anvil
Workshop Bridge's /camera/frame endpoint (the bridge talks to the printer
directly over Bambu's native camera protocol), then asks Ollama to classify
the bed/print state as JSON. No local video file, no ffmpeg — the frame is
always live.
"""

import base64
import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

BRIDGE_URL = os.environ.get("ANVIL_BRIDGE_URL", "http://localhost:3001")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("VISION_MODEL", "gemma3:4b")

_PROMPT = (
    "You are monitoring a 3D printer through its camera. Look at this frame "
    "and respond with ONLY a JSON object with exactly these three boolean "
    'fields: "isBedEmpty" (true if the print bed is empty/clear, false if '
    'there is a model or object on it), "isSpaghetti" (true if you see a '
    'failed print / tangled filament mess, aka "spaghetti", on the bed), '
    '"isPrinting" (true if the printer appears to be actively printing '
    "right now)."
)


async def fetch_frame() -> bytes:
    """Grab one live JPEG frame from the printer's camera via the bridge."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(f"{BRIDGE_URL}/camera/frame")
        resp.raise_for_status()
        return resp.content


async def analyze_printer_frame() -> dict:
    """Fetch a live camera frame and ask the local Ollama vision model to
    classify the printer's state. Returns {"ok": True, "isBedEmpty": bool,
    "isSpaghetti": bool, "isPrinting": bool} on success, or {"ok": False,
    "reason": "camera"|"ollama"|"parse", "error": str} on failure — "reason"
    lets the frontend tell "Gemma/Ollama is offline" apart from other
    failures instead of just showing a raw error string."""
    try:
        frame = await fetch_frame()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "camera", "error": f"Could not reach printer camera: {exc}"}

    image_b64 = base64.b64encode(frame).decode("utf-8")
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": _PROMPT,
        "images": [image_b64],
        "format": "json",
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "reason": "ollama", "error": f"Ollama is unreachable: {exc}"}

    try:
        parsed = json.loads(data.get("response", "{}"))
    except json.JSONDecodeError:
        return {"ok": False, "reason": "parse", "error": "Model did not return valid JSON"}

    return {
        "ok": True,
        "isBedEmpty": parsed.get("isBedEmpty"),
        "isSpaghetti": parsed.get("isSpaghetti"),
        "isPrinting": parsed.get("isPrinting"),
    }
