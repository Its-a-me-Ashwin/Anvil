from __future__ import annotations

"""Remote filesystem adapter.

The agent's filesystem tools are registered in the backend, but they do not
touch disk here. Each tool call becomes a remote call that the frontend
executes against the user's local project directory, then resolves with a
result posted to ``/tool-results/{call_id}``.
"""

import asyncio
import os
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_PROJECT_DIR = PROJECT_ROOT

PROJECT_DIR = Path(os.environ.get("ANVIL_PROJECT_DIR", DEFAULT_PROJECT_DIR)).resolve()
PROJECT_DIR.mkdir(parents=True, exist_ok=True)

from adapters.remote_call_manager import register_call  # noqa: E402

_REMOTE_TIMEOUT_SECONDS = 60.0


def _validate_path(path: str) -> str:
    """Reject absolute or escaping paths; return a clean relative path."""
    if not isinstance(path, str):
        raise ValueError("path must be a string")
    # Normalize separators and strip leading/trailing slashes.
    clean = path.replace("\\", "/").strip("/")
    if clean.startswith("/") or ":" in clean.split("/", 1)[0]:
        raise ValueError("absolute paths are not allowed")
    for part in clean.split("/"):
        if part == "..":
            raise ValueError("paths may not escape the project root")
    return clean or "."


async def _remote_call(tool: str, args: dict[str, Any]) -> Any:
    """Register a call, await the frontend result, and return it or an error."""
    call_id, future = register_call(tool, args)
    try:
        result = await asyncio.wait_for(future, timeout=_REMOTE_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        return {"error": f"Remote call timed out after {_REMOTE_TIMEOUT_SECONDS:.0f}s — is the frontend connected?"}
    except Exception as exc:  # noqa: BLE001
        return {"error": f"Remote call failed: {exc}"}
    return result


async def read_text_file(path: str) -> str:
    """Read the contents of a text file at the given relative path."""
    return await _remote_call("read_text_file", {"path": _validate_path(path)})


async def write_file(path: str, content: str) -> str:
    """Write ``content`` to a file at the given relative path."""
    return await _remote_call("write_file", {"path": _validate_path(path), "content": content})


async def edit_file(path: str, edits: list[dict[str, str]]) -> str:
    """Apply a list of {oldText, newText} edits to a file."""
    return await _remote_call("edit_file", {"path": _validate_path(path), "edits": edits})


async def search_files(path: str, pattern: str) -> str:
    """Search for ``pattern`` in files under ``path``."""
    return await _remote_call("search_files", {"path": _validate_path(path), "pattern": pattern})


async def list_directory(path: str) -> str:
    """List the entries of a directory at the given relative path."""
    return await _remote_call("list_directory", {"path": _validate_path(path)})


async def get_file_info(path: str) -> str:
    """Return metadata for the file at the given relative path."""
    return await _remote_call("get_file_info", {"path": _validate_path(path)})
