# Anvil backend — adapters

Python backend that will host the Google ADK agent. For now it just holds
tool adapters, built and tested independently of ADK/Gemini so each one is
proven working before it's wired into the agent. `agent.py` is a template
documenting how they'll be wired in — see `adapters/registry.py` for the
TODO block, not yet implemented.

## Adapters configured

| Adapter | Backing | Capability this gives the agent | Tools exposed | Status |
|---|---|---|---|---|
| **filesystem** | [`@modelcontextprotocol/server-filesystem`](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem) (MCP) | Read and write files in the active project directory — the shared-filesystem model from `arch-spec.md`, where the agent edits the same files code-server displays, instead of driving a UI. Sandboxed to `backend/sandbox_project/`; the server itself rejects any path outside that root (verified — see `test_adapter.py`). | `read_text_file`, `write_file`, `list_directory`, `get_file_info` — deliberately excludes `move_file`, `edit_file`, `create_directory`, `search_files`, and 5 others the server also exposes | testing |
| **search** | [`@brave/brave-search-mcp-server`](https://www.npmjs.com/package/@brave/brave-search-mcp-server) (MCP) | General web search for the human-facing search UI, plus Brave's agent-optimized "LLM context" endpoint for the agent's own research — matches the Brave-for-both-surfaces approach from `arch-spec.md`. Requires `BRAVE_API_KEY`; fails fast with setup instructions if unset rather than mocking. | `brave_web_search`, `brave_llm_context` — deliberately excludes `brave_local_search`, `brave_video_search`, `brave_image_search`, `brave_news_search`, `brave_summarizer`, `brave_place_search` | testing |
| **cad** | [`build123d`](https://build123d.readthedocs.io/) (custom — Python library, not MCP) | Builds and edits a persistent, named multi-part assembly: create primitive shapes, position/move them, combine with boolean ops, fillet edges, inspect volume/bounding box, export the whole assembly. This is the "agent mutates the CAD design" capability the UI mockup demos. Runs fully in-process: no daemon, no API key, no external server. Chosen over FreeCAD-MCP (needs Docker running) and Zoo's Engine API (paid, cloud) to minimize demo-time failure points. Assembly state is a small JSON file per project (`sandbox_project/cad_output/assemblies/<project>.json`) — deterministically rebuilt into real geometry on every call, so it's git-diffable and survives restarts, not a live in-memory session. | `add_box`, `add_cylinder`, `add_tube`, `add_sphere`, `add_cone`, `position_part`, `remove_part`, `boolean_op` (union/cut/intersect), `fillet_part`, `list_parts`, `get_part_info`, `export_assembly` (gltf/step/stl) | testing |

Gears are deliberately **not** a primitive here — build123d has no native
gear generator, and involute tooth geometry is exactly the kind of
easy-to-get-subtly-wrong math that deserves one hand-verified function later
rather than being composed turn-by-turn by the agent from these primitives.

Planned next (see `arch-spec.md` for the full tool map): GitHub, 3D-printer
status (OctoPrint/Klipper/Bambu), parts sourcing (DigiKey).

## Layout

```
backend/
  Makefile
  agent.py              # template for wiring adapters into ADK — not yet implemented
  adapters/
    registry.py         # single source of truth: every tool exposed to the agent, and its scope
    filesystem/
      adapter.py          # the adapter itself — connection params, scope
      test_adapter.py     # standalone proof it works — no agent required
    search/
      adapter.py           # Brave Search MCP server connection + scope
      test_adapter.py      # standalone proof it works — no agent required
    cad/
      adapter.py            # the 12 tool functions — thin wrappers around assembly.py
      assembly.py           # persistent named Assembly: add/remove/position/boolean/fillet/export
      geometry.py           # pure function: part-definition dict -> build123d Shape
      test_adapter.py       # standalone proof it works — no agent required
  sandbox_project/       # scoped root the filesystem adapter is allowed to touch
    cad_output/
      assemblies/            # one <project>.json (+ exported .gltf/.step/.stl) per assembly
  requirements.txt
```

Each adapter gets its own folder under `adapters/` with the same shape:
an `adapter.py` (connection/scope) and a `test_adapter.py` (standalone
verification). Whether an adapter is backed by an MCP server or hand-written,
it's registered in `registry.py` the same way — that registry is what gets
wired into ADK later, and it's also the architecture reference for the repo.

## Setup

```bash
cd backend
make setup
```

Requires Node/npx on PATH — the filesystem adapter spawns the official
`@modelcontextprotocol/server-filesystem` package via `npx`.

## Running adapter tests

```bash
make test-filesystem   # one adapter
make test-search       # one adapter
make test-cad          # one adapter
make test-all          # every adapter
```

Each `test-<name>` target proves that adapter works with real calls, no
agent involved — for the MCP-backed ones (filesystem, search) that means
connecting exactly the way ADK's `MCPToolset` will and confirming every tool
in scope is present; for the custom cad adapter it's a direct function call
since there's no server in the loop. Filesystem exercises write → list →
read → get_file_info plus a boundary check that paths outside the sandbox
are rejected; search issues a real `brave_web_search` query; cad builds a
small multi-part assembly (a housing, a shaft, a bracket with a boolean-cut
bolt hole, a fillet) exercising every tool, exports it in all three formats,
and checks 7 different boundary/error cases are correctly rejected.

The search adapter requires `BRAVE_API_KEY` in `backend/.env` (copy from
`.env.example`) — without it, `test-search` fails fast with instructions
instead of silently mocking results.

## Adding a new adapter

1. `adapters/<name>/adapter.py` — connection params (MCP server command, or
   whatever a custom adapter needs).
2. `adapters/<name>/test_adapter.py` — a standalone script that proves the
   adapter works with real calls, no agent involved.
3. Add an `AdapterEntry` to `adapters/registry.py` with an explicit,
   narrow `scope` — only the tool names the agent should actually be allowed
   to call, not everything the underlying server exposes.
4. Add a `test-<name>` target to the `Makefile` and list it as a
   dependency of `test-all`.
