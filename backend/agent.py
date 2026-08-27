"""Wires adapters/registry.py into a Google ADK agent.

`build_tools()` turns every `AdapterEntry` into an ADK tool:
- MCP-backed adapters become `MCPToolset` instances scoped with
  `tool_filter=entry.scope`, then expanded into individual `MCPTool`s.
- Custom adapters become `FunctionTool` wrappers around the functions named
  in `entry.scope`.

`build_agent()` assembles an `Agent` with those tools and a concise system
instruction describing the assistant as an engineering partner.
"""

import asyncio
import importlib
import logging
import os
import sys
from pathlib import Path
from typing import Callable

from google.adk.agents import Agent
from google.adk.tools.function_tool import FunctionTool
from google.adk.tools.google_search_tool import google_search
from google.adk.tools.mcp_tool import MCPToolset

# Make the adapter modules resolvable whether this file is imported as
# `backend.agent` from the project root or `agent` from within backend/.
_BACKEND_DIR = Path(__file__).resolve().parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from adapters.registry import ADAPTERS

logger = logging.getLogger(__name__)

# Map each MCP-backed adapter name to the function that returns its connection
# parameters.  The MCP server may expose more tools than we register; the
# agent only sees the names listed in registry.py via tool_filter.
_MCP_PARAMS: dict[str, str] = {
    "filesystem": "adapters.filesystem.adapter.get_server_params",
}

# Map each custom adapter name to its Python module path.  Functions listed in
# the adapter's scope are imported by name from this module and wrapped as
# FunctionTools.
_CUSTOM_ADAPTERS: dict[str, str] = {
    "cad": "adapters.cad.adapter",
    "circuit": "adapters.circuit.adapter",
    "printer": "adapters.printer.adapter",
    "state": "adapters.state.adapter",
}


def _import_function(module_path: str, name: str) -> Callable:
    module = importlib.import_module(module_path)
    fn = getattr(module, name, None)
    if fn is None:
        raise AttributeError(f"{module_path!r} has no function {name!r}")
    return fn


async def build_tools_async() -> list:
    """Return the ADK tools for every adapter in registry.py."""
    tools: list = []

    for entry in ADAPTERS:
        if entry.backing == "mcp":
            params_path = _MCP_PARAMS[entry.name]
            module_path, fn_name = params_path.rsplit(".", 1)
            module = importlib.import_module(module_path)
            get_params = getattr(module, fn_name)
            try:
                connection_params = get_params()
            except Exception as exc:
                logger.warning("Skipping %s MCP adapter: %s", entry.name, exc)
                continue
            toolset = MCPToolset(
                connection_params=connection_params,
                tool_filter=entry.scope,
            )
            try:
                expanded = await toolset.get_tools()
            except Exception as exc:
                logger.warning(
                    "Could not expand %s MCP toolset; skipping: %s", entry.name, exc
                )
                continue
            tools.extend(expanded)
        else:
            module_path = _CUSTOM_ADAPTERS[entry.name]
            for name in entry.scope:
                fn = _import_function(module_path, name)
                tools.append(FunctionTool(fn))

    return tools


def build_tools() -> list:
    """Synchronous wrapper for build_tools_async."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop is not None:
        raise RuntimeError(
            "build_tools() called from an async context; use await build_tools_async()"
        )
    return asyncio.run(build_tools_async())


def build_agent(
    model: str = "gemini-2.0-flash",
    tools: list | None = None,
) -> Agent:
    """Build the Anvil engineering partner agent."""
    if tools is None:
        tools = build_tools()

    # Gemini's built-in Google Search tool. Works with Gemini 2.0+ models.
    tools.append(google_search)

    return Agent(
        model=model,
        name="anvil",
        tools=tools,
        instruction=(
            "You are Anvil, a collaborative engineering partner. You help the user "
            "design, simulate, and build hardware projects. You can read and edit "
            "files in the active project directory, search the web with Google Search, "
            "build parametric CAD assemblies, draw wiring diagrams, and send models to a "
            "3D printer via the Workshop Bridge. "
            "Before destructive actions (writing files, slicing, printing, exporting), "
            "ask the user for approval unless they have explicitly told you to proceed. "
            "Be concise, explain your reasoning, and surface tool results clearly."
        ),
    )
