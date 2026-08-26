"""Minimal local vision worker using an MP4 file as a camera stream.

- Serves the configured MP4 as a video feed endpoint.
- Can extract a frame and send it to a local Ollama model for analysis.
- Replace the MP4 path with an RTSP URL later.
"""

import base64
import logging
import os
import shutil
import subprocess
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)

VISION_VIDEO_PATH = os.environ.get("VISION_VIDEO_PATH", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("VISION_MODEL", "gemma3:4b")


def video_path() -> Path | None:
    """Return the configured video path if it exists."""
    if not VISION_VIDEO_PATH:
        return None
    p = Path(VISION_VIDEO_PATH)
    return p if p.is_file() else None


def _ffmpeg_bin() -> str:
    """Find ffmpeg binary, honouring FFMPEG_PATH env var."""
    env = os.environ.get("FFMPEG_PATH")
    if env:
        return env
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found. Set FFMPEG_PATH or add ffmpeg to PATH.")


def extract_frame_bytes(video: Path | str, timestamp: str = "00:00:01") -> bytes:
    """Extract a single PNG frame from the video using ffmpeg."""
    cmd = [
        _ffmpeg_bin(),
        "-ss", timestamp,
        "-i", str(video),
        "-vframes", "1",
        "-f", "image2pipe",
        "-vcodec", "png",
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode(errors='ignore')[:200]}")
    return result.stdout


async def analyze_frame(prompt: str, timestamp: str = "00:00:01") -> dict:
    """Send a single video frame to the local Ollama vision model."""
    video = video_path()
    if not video:
        return {"ok": False, "error": "VISION_VIDEO_PATH not set or file missing"}

    try:
        frame = extract_frame_bytes(video, timestamp)
    except RuntimeError as exc:
        return {"ok": False, "error": str(exc)}

    image_b64 = base64.b64encode(frame).decode("utf-8")
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "images": [image_b64],
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": f"Ollama call failed: {exc}"}

    return {"ok": True, "response": data.get("response", "")}
