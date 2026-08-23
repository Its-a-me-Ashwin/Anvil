"""Connection config for the filesystem adapter.

Backed by the official MCP filesystem server (`@modelcontextprotocol/server-filesystem`),
run as a subprocess over stdio and scoped to a single project directory. The
server exposes more tools than we want the agent touching (move_file,
edit_file, create_directory, ...) — see registry.py for the exact allow-list.
"""

import os
from pathlib import Path

from mcp import StdioServerParameters

BACKEND_DIR = Path(__file__).resolve().parents[2]
DEFAULT_PROJECT_DIR = BACKEND_DIR / "sandbox_project"

PROJECT_DIR = Path(os.environ.get("ANVIL_PROJECT_DIR", DEFAULT_PROJECT_DIR)).resolve()
PROJECT_DIR.mkdir(parents=True, exist_ok=True)


def get_server_params() -> StdioServerParameters:
    return StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-filesystem", str(PROJECT_DIR)],
    )
