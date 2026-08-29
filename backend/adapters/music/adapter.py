"""Music helper — internal, not exposed as its own agent tool.

Generates a short instrumental track via Lyria 3 and muxes it onto a video
file. adapters.animation.adapter.generate_animation calls add_soundtrack
directly so every generated animation comes back with matching background
music already built in — this is not a capability the agent invokes on its
own. There is exactly one video-generation tool from the agent's point of
view (generate_animation); it always returns a single, already-scored clip,
not a silent video plus a separate audio artifact to combine.

Uses GEMINI_API_KEY (same key as the rest of the app) — Lyria 3 is served
from the same Gemini Developer API as Veo, no separate key. Falls back to a
local mock (a plain sine tone via ffmpeg) if GEMINI_API_KEY is unset, so the
combined-clip plumbing can still be exercised without spending anything —
same fallback pattern as generate_animation's own Veo mock.

Lyria 3 ("lyria-3-clip-preview") is a single generate_content call — same
shape as any other Gemini text-in call, not a request/response poll loop
like Veo and not a websocket stream like the separately-documented "Lyria
RealTime" (models/lyria-realtime-exp) model, which this project's API key
does not have access to. It always returns a fixed ~30s MP3 clip (as an
inline_data Part with an audio/* mime type), so add_soundtrack trims it to
the video's length with ffmpeg after the fact rather than controlling
generation length directly, then muxes it in — replacing Veo's own
auto-generated audio track (Veo 3.x always generates some audio on this API
key, with no way to opt out) so the two don't layer on top of each other.

All intermediate audio lives in a temp directory and is discarded once
muxed into the final video — there is no persisted standalone soundtrack
file and no HTTP route serving one.
"""

import asyncio
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from google import genai

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


async def _call_lyria(mood: str, seconds: float, out_path: Path, tmpdir: Path) -> None:
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

    raw_path = tmpdir / f"{uuid.uuid4().hex}.raw.mp3"
    raw_path.write_bytes(audio_bytes)
    _trim_audio(raw_path, out_path, seconds)


def _mux_audio_onto_video(video_path: Path, audio_path: Path, out_path: Path) -> None:
    """Combine video_path's picture with audio_path's sound, dropping
    video_path's own audio track entirely (see module docstring — this is
    what replaces Veo's auto-generated audio rather than layering onto
    it)."""
    cmd = [
        _ffmpeg_bin(),
        "-i", str(video_path),
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


async def add_soundtrack(video_path: Path, mood: str, duration_seconds: float = 8.0) -> Path:
    """Generate a short instrumental track matching `mood` and mux it onto
    video_path, replacing any audio track video_path already has. Returns
    the path to a new, combined file written alongside video_path —
    video_path itself is left untouched; the caller decides whether to keep
    or discard it once this returns."""
    with tempfile.TemporaryDirectory(prefix="anvil_music_") as tmpdir_str:
        tmpdir = Path(tmpdir_str)
        audio_path = tmpdir / f"{uuid.uuid4().hex}.mp3"

        if _gemini_api_key():
            await _call_lyria(mood, duration_seconds, audio_path, tmpdir)
        else:
            _generate_mock_audio(audio_path, duration_seconds)

        out_path = video_path.with_name(f"{uuid.uuid4().hex}.mp4")
        _mux_audio_onto_video(video_path, audio_path, out_path)
        return out_path
