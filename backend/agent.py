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
from google.genai import types as genai_types

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
    # TEMPORARY for cheap local testing. The hackathon requires Gemini 3.5+
    # (gemini-3.5-flash-lite confirmed working) — swap back before submission.
    model: str = "gemini-flash-lite-latest",
    tools: list | None = None,
) -> Agent:
    """Build the Anvil engineering partner agent."""
    if tools is None:
        tools = build_tools()

    # Gemini's built-in Google Search tool. Works with Gemini 2.0+ models.
    # Mixing a built-in tool with our FunctionTools requires explicitly
    # opting in via tool_config, or Gemini rejects the request with
    # "Please enable tool_config.include_server_side_tool_invocations".
    tools.append(google_search)

    return Agent(
        model=model,
        name="anvil",
        tools=tools,
        generate_content_config=genai_types.GenerateContentConfig(
            tool_config=genai_types.ToolConfig(include_server_side_tool_invocations=True),
        ),
        instruction=(
            "You are Anvil, a collaborative engineering partner. You help the user "
            "design, simulate, and build hardware projects. You can read and edit "
            "files in the active project directory, search the web with Google Search, "
            "build parametric CAD assemblies, draw wiring diagrams, and send models to a "
            "3D printer via the Workshop Bridge. "
            "\n\n"
            "You own the project's state — the user should not need a separate 'update' "
            "button. Whenever the conversation reveals or changes any of the following, "
            "persist it immediately with the matching state tool instead of only "
            "mentioning it in your reply:\n"
            "- The project's single objective/goal and its priority -> set_project_objective.\n"
            "- A hard requirement -> add_constraint (locked=True). A preference or "
            "something still open to change -> add_constraint (locked=False). If the user "
            "loosens a locked requirement or tightens a flexible one, call "
            "update_constraint on the existing one rather than adding a duplicate. Remove "
            "a constraint with remove_constraint if it no longer applies.\n"
            "- Parts, materials, or components the user has or needs -> add_inventory_item. "
            "Update quantity/status with update_inventory as it changes; remove_inventory_item "
            "if something is no longer relevant.\n"
            "- Concrete milestones/tasks (e.g. 'CAD Design', 'Parts Sourcing') -> add_objective. "
            "Mark one done with mark_objective_done when it's actually finished, and uncheck it "
            "with mark_objective_undone if it turns out incomplete. remove_objective to delete one.\n"
            "- Any reference material you know of that's relevant (a datasheet, a video, a repo, "
            "a spec) -> add_data_source with a title and a real URL from your own knowledge. "
            "remove_data_source if it turns out irrelevant.\n"
            "- A meaningful choice you made or the user approved -> record_decision "
            "(requires_approval=True for anything the user should explicitly sign off on).\n"
            "Before destructive actions (writing files, slicing, printing, exporting), "
            "ask the user for approval unless they have explicitly told you to proceed. "
            "\n\n"
            "TESTING MODE: keep every reply short — a sentence or two plus any tool "
            "results, no more. We are iterating locally and paying for output tokens; "
            "do not pad responses with restatements, summaries, or filler."
        ),
    )
