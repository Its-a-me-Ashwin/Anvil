"""Animation adapter — custom, not MCP.

Generates short, simple explainer animations — e.g. "what's the difference
between A and B" gets a clip that shows A, then shows B — via Veo (Gemini
API), with a matching instrumental soundtrack from Lyria muxed in
automatically (see adapters/music/adapter.py). generate_animation is the
only video-generation tool exposed to the agent, and it always returns one
finished, already-scored clip — there is no separate "add music to this"
step the agent has to remember to invoke.

Uses GEMINI_API_KEY (same key as the rest of the app) — Veo is served from
the same Gemini Developer API, no separate key. If GEMINI_API_KEY is unset,
`generate_animation` falls back to a local mock MP4 via ffmpeg instead of
calling Veo, so the tool-call and center-canvas plumbing can still be
exercised without spending anything. If Lyria/muxing fails for any reason,
generate_animation logs a warning and returns the silent Veo/mock clip
rather than failing the whole call — a music problem shouldn't take down
animation generation, which worked fine on its own before this existed.

Animations live in backend/sandbox_project/animation_output/<project>/,
mirroring the per-project layout the CAD adapter uses for its own output
(see adapters/cad/assembly.py).
"""

import asyncio
import logging
import os
import shutil
import subprocess
import uuid
from pathlib import Path

from google import genai
from google.genai import types as genai_types

from adapters.music.adapter import add_soundtrack

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]
OUTPUT_DIR = BACKEND_DIR / "sandbox_project" / "animation_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Read lazily, not cached at module level: server.py imports this module at
# startup (for the file-serving route) before dotenv.load_dotenv() runs in
# its lifespan handler, and Python caches the module on the later import
# build_tools_async() does — a module-level constant here would freeze in
# whatever GEMINI_API_KEY was (usually empty) at that premature import time.
def _gemini_api_key() -> str:
    return os.environ.get("GEMINI_API_KEY", "")


def _veo_model() -> str:
    # Lite tier is the cheapest Veo option — plenty for a short, simple
    # explainer clip. Override via VEO_MODEL if quality matters more than
    # cost for a given demo.
    return os.environ.get("VEO_MODEL", "veo-3.1-lite-generate-preview")


_VEO_POLL_INTERVAL_SECONDS = 10
_VEO_TIMEOUT_SECONDS = 300


def _project_dir(project: str) -> Path:
    safe = Path(project).name
    d = OUTPUT_DIR / safe
    d.mkdir(parents=True, exist_ok=True)
    return d


def animation_path(project_id: str, filename: str) -> Path:
    """Resolve a project + filename to a path on disk, rejecting anything
    that would escape that project's animation directory."""
    project_dir = _project_dir(project_id)
    path = (project_dir / Path(filename).name).resolve()
    if not path.is_relative_to(project_dir.resolve()):
        raise ValueError(f"Filename {filename!r} escapes the project's animation directory")
    return path


def _ffmpeg_bin() -> str:
    env = os.environ.get("FFMPEG_PATH")
    if env:
        return env
    found = shutil.which("ffmpeg")
    if found:
        return found
    raise RuntimeError("ffmpeg not found. Set FFMPEG_PATH or add ffmpeg to PATH.")


def _generate_mock_video(out_path: Path, seconds: float = 4.0) -> None:
    """Synthesize a short animated test-pattern clip with ffmpeg's built-in
    `testsrc` source, standing in for a real Veo render. No external assets
    or fonts required, so it works the same on every machine."""
    cmd = [
        _ffmpeg_bin(),
        "-f", "lavfi",
        "-i", f"testsrc=size=960x540:rate=30:duration={seconds}",
        "-pix_fmt", "yuv420p",
        "-y",
        str(out_path),
    ]
    result = subprocess.run(cmd, capture_output=True, check=False)
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg failed: {result.stderr.decode(errors='ignore')[:300]}")


async def _call_veo(description: str, out_path: Path) -> None:
    """Generate a short video with Veo via the Gemini API and save it to
    out_path. Runs the async client so the long poll loop below doesn't
    block the FastAPI event loop for the (up to several minutes) it takes
    Veo to render."""
    client = genai.Client(api_key=_gemini_api_key())
    prompt = (
        "A short, simple explainer animation using plain shapes, colors, and "
        "on-screen labels — no camera tricks, no complex scenes, no narration. "
        + description
    )
    operation = await client.aio.models.generate_videos(
        model=_veo_model(),
        prompt=prompt,
        config=genai_types.GenerateVideosConfig(
            aspect_ratio="16:9",
            duration_seconds=8,  # API-enforced max for this model is 8s
            person_generation="allow_all",
            # generate_audio is Vertex/Enterprise-only — passing it at all
            # (even False) raises a ValueError on the plain Gemini Developer
            # API key this app uses. Veo 3.x generates audio by default with
            # no way to opt out here; that's reflected in cost.
        ),
    )

    loop = asyncio.get_event_loop()
    deadline = loop.time() + _VEO_TIMEOUT_SECONDS
    while not operation.done:
        if loop.time() > deadline:
            raise TimeoutError("Veo generation timed out after 5 minutes.")
        await asyncio.sleep(_VEO_POLL_INTERVAL_SECONDS)
        operation = await client.aio.operations.get(operation)

    if operation.error:
        raise RuntimeError(f"Veo generation failed: {operation.error}")

    generated = operation.response.generated_videos if operation.response else None
    if not generated:
        raise RuntimeError("Veo returned no videos (possibly filtered).")

    video_bytes = await client.aio.files.download(file=generated[0].video)
    out_path.write_bytes(video_bytes)


async def generate_animation(project_id: str, description: str) -> dict:
    """Generate a short, simple explainer animation (e.g. showing A, then B,
    for a comparison question), with a matching instrumental soundtrack
    included automatically."""
    filename = f"{uuid.uuid4().hex}.mp4"
    out_path = _project_dir(project_id) / filename

    api_key = _gemini_api_key()
    if api_key:
        await _call_veo(description, out_path)
    else:
        _generate_mock_video(out_path)

    scored = False
    try:
        scored_path = await add_soundtrack(out_path, description)
        out_path.unlink(missing_ok=True)
        out_path = scored_path
        filename = out_path.name
        scored = True
    except Exception:
        logger.warning("add_soundtrack failed; returning animation without music", exc_info=True)

    return {
        "status": "ready",
        "description": description,
        "project_id": project_id,
        "filename": filename,
        "source": "veo" if api_key else "mock",
        "scored": scored,
    }
