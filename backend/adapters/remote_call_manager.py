from __future__ import annotations

"""In-memory registry for remote tool calls that are executed by the frontend.

The backend's filesystem adapter registers a call here and waits on a Future.
The frontend performs the actual file operation locally and POSTs the result to
``/tool-results/{call_id}``, which resolves the Future and unblocks the agent.
"""

import asyncio
import json
import logging
import uuid
from typing import Any

logger = logging.getLogger(__name__)

_pending: dict[str, asyncio.Future[dict[str, Any]]] = {}
_pending_meta: dict[str, dict[str, Any]] = {}
_tool_args_to_id: dict[tuple[str, str], str] = {}


def _args_key(args: dict[str, Any]) -> str:
    return json.dumps(args, sort_keys=True, default=str)


def register_call(tool: str, args: dict[str, Any]) -> tuple[str, asyncio.Future[dict[str, Any]]]:
    """Register a new pending remote tool call and return its id and Future."""
    loop = asyncio.get_running_loop()
    future = loop.create_future()
    call_id = str(uuid.uuid4())
    _pending[call_id] = future
    _pending_meta[call_id] = {"tool": tool, "path": args.get("path")}
    _tool_args_to_id[(tool, _args_key(args))] = call_id
    logger.debug("Registered remote call %s for tool %s", call_id, tool)
    return call_id, future


def get_remote_call_id(tool: str, args: dict[str, Any]) -> str | None:
    """Look up the remote call id for a tool call that ADK already emitted."""
    return _tool_args_to_id.get((tool, _args_key(args)))


def resolve_call(call_id: str, result: dict[str, Any]) -> bool:
    """Resolve a pending call with the frontend-supplied result."""
    future = _pending.pop(call_id, None)
    _pending_meta.pop(call_id, None)
    _discard_mapping(call_id)
    if future is None:
        logger.warning("Resolve called for unknown call id: %s", call_id)
        return False
    if not future.done():
        future.set_result(result)
    return True


def reject_call(call_id: str, error: str) -> bool:
    """Reject a pending call with an error message."""
    future = _pending.pop(call_id, None)
    _pending_meta.pop(call_id, None)
    _discard_mapping(call_id)
    if future is None:
        logger.warning("Reject called for unknown call id: %s", call_id)
        return False
    if not future.done():
        future.set_exception(RuntimeError(error))
    return True


def _discard_mapping(call_id: str) -> None:
    for key, value in list(_tool_args_to_id.items()):
        if value == call_id:
            del _tool_args_to_id[key]
            break


def get_pending_calls() -> list[dict[str, Any]]:
    """Return a snapshot of still-pending calls for the frontend to match."""
    return [
        {
            "call_id": call_id,
            "tool": _pending_meta.get(call_id, {}).get("tool"),
            "path": _pending_meta.get(call_id, {}).get("path"),
        }
        for call_id in _pending
        if not _pending[call_id].done()
    ]

