"""Music adapter — custom, not MCP.

Generates a short instrumental music clip via Lyria 3 (Gemini API), and can
compose it onto an existing animation clip that generate_animation
(adapters/animation/adapter.py) already produced.

Uses GEMINI_API_KEY (same key as the rest of the app) — Lyria 3 is served
from the same Gemini Developer API as Veo, no separate key. If
GEMINI_API_KEY is unset, both tools fall back to a local mock (a plain sine
tone via ffmpeg) instead of calling Lyria, so the tool-call and
center-canvas plumbing can still be exercised without spending anything.

Lyria 3 ("lyria-3-clip-preview") is a single generate_content call — same
shape as any other Gemini text-in call, not a request/response poll loop
like Veo and not a websocket stream like the older, separately-documented
"Lyria RealTime" (models/lyria-realtime-exp) model, which this project's
API key does not have access to. It always returns a fixed ~30s MP3 clip
(as an inline_data Part with an audio/* mime type), so generate_soundtrack
trims it down to the requested duration with ffmpeg after the fact rather
than controlling generation length directly.

score_animation is a separate tool (not folded into generate_animation) so
the two stay independently callable and independently failable: a Lyria
outage should degrade to "animation without music," not break animation
generation, and not every animation needs a soundtrack. It composes by
muxing a freshly generated track onto an existing clip and stripping Veo's
own auto-generated audio track first (Veo 3.x always generates audio on
this API key with no way to opt out — see animation/adapter.py) so the two
scores don't layer on top of each other.

Output lives in backend/sandbox_project/music_output/<project>/, mirroring
the per-project output layout the CAD/circuit/animation adapters use.
"""

import asyncio
import os
import shutil
import subprocess
import uuid
from pathlib import Path

from google import genai

from adapters.animation.adapter import animation_path

BACKEND_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BACKEND_DIR / "sandbox_project" / "music_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_LYRIA_TIMEOUT_SECONDS = 90


# Read lazily, not cached at module level: server.py imports adapter modules
# at startup (for the file-serving route) before dotenv.load_dotenv() runs
# in its lifespan handler — see the identical comment in animation/adapter.py.
def _gemini_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")


def _lyria_model() -> str:
    # The "clip" tier is the lighter/cheaper of the two Lyria 3 models this
    # key has access to ("lyria-3-pro-preview" is the other). Override via
    # LYRIA_MODEL if quality matters more than cost for a given demo.
    return os.environ.get("LYRIA_MODEL", "models/lyria-3-clip-preview")


def _project_dir(project: str) -> Path:
    safe = Path(project).name
    d = OUTPUT_DIR / safe
    d.mkdir(parents=True, exist_ok=True)
    return d


def music_path(project_id: str, filename: str) -> Path:
    """Resolve a project + filename to a path on disk, rejecting anything
    that would escape that project's music directory."""
    project_dir = _project_dir(project_id)
    path = (project_dir / Path(filename).name).resolve()
    if not path.is_relative_to(project_dir.resolve()):
        raise ValueError(f"Filename {filename!r} escapes the project's music directory")
    return path


def _ffmpeg_bin() -> str:
    env = os.environ.get("FFMPEG_PATH")
    if env:
        return env
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found. Set FFMPEG_PATH or add ffmpeg to PATH.")


def _generate_mock_audio(out_path: Path, seconds: float) -> None:
    """Synthesize a short sine tone with ffmpeg's built-in `sine` source,
    standing in for a real Lyria track. No external assets or network
    access required, so it works the same on every machine."""
    cmd = [
        _ffmpeg_bin(),
        "-f", "lavfi",
        "-i", f"sine=frequency=220:duration={seconds}",
        "-y",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode(errors='ignore')[:300]}")


def _trim_audio(src_path: Path, out_path: Path, seconds: float) -> None:
    """Cut src_path down to the first `seconds` seconds, re-encoding as MP3
    (matches the raw clip's own format, so this is a cheap encode either
    way — no need to preserve a lossless intermediate)."""
    cmd = [
        _ffmpeg_bin(),
        "-i", str(src_path),
        "-t", str(seconds),
        "-y",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg trim failed: {result.stderr.decode(errors='ignore')[:300]}")


def _extract_audio_bytes(response) -> bytes | None:
    for candidate in response.candidates or []:
        parts = candidate.content.parts if candidate.content else []
        for part in parts:
            inline = getattr(part, "inline_data", None)
            if inline and inline.mime_type and inline.mime_type.startswith("audio/") and inline.data:
                return inline.data
    return None


async def _call_lyria(mood: str, seconds: float, out_path: Path) -> None:
    """Generate a ~30s instrumental clip from Lyria 3 and trim it down to
    the requested duration.

    Retries once on an empty response — observed in testing to be a real,
    if infrequent, quirk of this preview model (an identical retry
    succeeds), not a deterministic rejection worth surfacing as a hard
    failure on the first miss."""
    client = genai.Client(api_key=_gemini_api_key())
    prompt = f"Instrumental music, no vocals, no lyrics. Mood/genre: {mood}"
    audio_bytes = None

    for _ in range(2):
        response = await asyncio.wait_for(
            client.aio.models.generate_content(model=_lyria_model(), contents=prompt),
            timeout=_LYRIA_TIMEOUT_SECONDS,
        )
        audio_bytes = _extract_audio_bytes(response)
        if audio_bytes:
            break

    if not audio_bytes:
        raise RuntimeError("Lyria returned no audio (after retry).")

    raw_path = out_path.with_suffix(".raw.mp3")
    raw_path.write_bytes(audio_bytes)
    try:
        _trim_audio(raw_path, out_path, seconds)
    finally:
        raw_path.unlink(missing_ok=True)


async def generate_soundtrack(project_id: str, mood: str, duration_seconds: float = 8.0) -> dict:
    """Generate a short instrumental background track for mood/atmosphere —
    e.g. "calm ambient synth", "upbeat minimal techno", "tense orchestral
    strings". Returns a standalone MP3 file; use score_animation instead if
    the goal is to add music to an existing generate_animation clip."""
    filename = f"{uuid.uuid4().hex}.mp3"
    out_path = _project_dir(project_id) / filename

    api_key = _gemini_api_key()
    if api_key:
        await _call_lyria(mood, duration_seconds, out_path)
    else:
        _generate_mock_audio(out_path, duration_seconds)

    return {
        "status": "ready",
        "mood": mood,
        "project_id": project_id,
        "filename": filename,
        "source": "lyria" if api_key else "mock",
    }


async def score_animation(project_id: str, animation_filename: str, mood: str) -> dict:
    """Add a short generated soundtrack to an animation generate_animation
    already produced, replacing Veo's own auto-generated audio (Veo always
    generates some audio on this API key; this swaps it for a track that
    actually matches the requested mood instead). Returns a new, separate
    video file — the original animation is left untouched."""
    video_in = animation_path(project_id, animation_filename)
    if not video_in.exists():
        raise FileNotFoundError(
            f"Animation {animation_filename!r} not found for project {project_id!r}"
        )

    track = await generate_soundtrack(project_id, mood, duration_seconds=8.0)
    audio_path = music_path(project_id, track["filename"])

    out_filename = f"{uuid.uuid4().hex}.mp4"
    out_path = _project_dir(project_id) / out_filename

    cmd = [
        _ffmpeg_bin(),
        "-i", str(video_in),
        "-i", str(audio_path),
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-c:v", "copy",
        "-c:a", "aac",
        "-shortest",
        "-y",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg mux failed: {result.stderr.decode(errors='ignore')[:300]}")

    return {
        "status": "ready",
        "project_id": project_id,
        "filename": out_filename,
        "source_animation": animation_filename,
        "mood": mood,
        "source": track["source"],
    }
