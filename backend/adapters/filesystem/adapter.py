"""Connection config for the filesystem adapter.

Backed by the official MCP filesystem server (`@modelcontextprotocol/server-filesystem`),
run as a subprocess over stdio and scoped to a single project directory. The
server exposes more tools than we want the agent touching (move_file,
edit_file, create_directory, ...) — see registry.py for the exact allow-list.
"""

import os
import shutil
from pathlib import Path

from mcp import StdioServerParameters

BACKEND_DIR = Path(__file__).resolve().parents[2]
PROJECT_ROOT = BACKEND_DIR.parent
DEFAULT_PROJECT_DIR = PROJECT_ROOT

PROJECT_DIR = Path(os.environ.get("ANVIL_PROJECT_DIR", DEFAULT_PROJECT_DIR)).resolve()
PROJECT_DIR.mkdir(parents=True, exist_ok=True)


def get_server_params() -> StdioServerParameters:
    # Resolve the server script directly. Using `npx` on Windows can fail with
    # ENOENT because npx treats the project path as a local package entry.
    server_script = PROJECT_ROOT / "node_modules" / "@modelcontextprotocol" / "server-filesystem" / "dist" / "index.js"
    if not server_script.exists():
        raise FileNotFoundError(
            f"MCP filesystem server not found at {server_script}. "
            "Run: npm install @modelcontextprotocol/server-filesystem"
        )
    # Prefer the bundled Node 20 to avoid Windows system node (often v14).
    bundled_node = PROJECT_ROOT / "tools" / "node20" / "node.exe"
    node = str(bundled_node) if bundled_node.exists() else (shutil.which("node") or "node")
    return StdioServerParameters(
        command=node,
        args=[str(server_script), str(PROJECT_DIR)],
    )
