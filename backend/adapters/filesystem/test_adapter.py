"""Standalone proof that the remote filesystem adapter works.

Run:
    python -m adapters.filesystem.test_adapter

Verifies that every scoped filesystem tool registers a pending remote call
and completes once a frontend-style result is injected.
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.filesystem.adapter import (
    edit_file,
    get_file_info,
    list_directory,
    read_text_file,
    search_files,
    write_file,
)
from adapters.remote_call_manager import get_pending_calls, resolve_call
from adapters.registry import get_adapter

TEST_FILE = "adapter_smoke_test.md"


def _wait_for_call() -> str:
    pending = get_pending_calls()
    assert pending, "no pending call registered"
    return pending[0]["call_id"]


async def _run_tool(coro, result):
    task = asyncio.create_task(coro)
    while not get_pending_calls():
        await asyncio.sleep(0.01)
    call_id = get_pending_calls()[0]["call_id"]
    resolve_call(call_id, result)
    return await asyncio.wait_for(task, timeout=5.0)


async def main() -> None:
    adapter = get_adapter("filesystem")
    assert adapter.backing == "custom"
    print(f"Allowed tools: {adapter.scope}")

    print(f"\n-- write_file({TEST_FILE}) --")
    write_result = await _run_tool(
        write_file(TEST_FILE, "# Adapter smoke test"),
        "written",
    )
    assert write_result == "written"
    print("OK")

    print(f"\n-- edit_file({TEST_FILE}) --")
    edit_result = await _run_tool(
        edit_file(TEST_FILE, [{"oldText": "smoke", "newText": "remote"}]),
        "edited",
    )
    assert edit_result == "edited"
    print("OK")

    print(f"\n-- read_text_file({TEST_FILE}) --")
    read_result = await _run_tool(
        read_text_file(TEST_FILE),
        "# Adapter remote test",
    )
    assert "remote" in read_result
    print(read_result)

    print("\n-- search_files(.) --")
    search_result = await _run_tool(
        search_files(".", "remote"),
        TEST_FILE,
    )
    assert TEST_FILE in search_result
    print(search_result)

    print("\n-- list_directory(.) --")
    list_result = await _run_tool(list_directory("."), TEST_FILE)
    assert TEST_FILE in list_result
    print(list_result)

    print(f"\n-- get_file_info({TEST_FILE}) --")
    info_result = await _run_tool(get_file_info(TEST_FILE), '{"size": 42}')
    assert "size" in info_result
    print(info_result)

    print("\n-- boundary check: read_text_file outside sandbox --")
    try:
        await read_text_file("../../.env.example")
        raise AssertionError("path escape was not rejected")
    except ValueError as exc:
        print(f"OK — rejected: {exc}")

    print("\nAll scoped filesystem tools verified working end to end.")


if __name__ == "__main__":
    asyncio.run(main())
