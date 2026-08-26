# Anvil backend — adapters

Python backend that hosts the Google ADK agent and the tool adapters it uses.
Adapters are built and tested independently (see `make test-<name>`), then wired
into the agent in `agent.py` via `adapters/registry.py`.

## Adapters configured

| Adapter | Backing | Capability this gives the agent | Tools exposed | Status |
|---|---|---|---|---|
| **filesystem** | [`@modelcontextprotocol/server-filesystem`](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem) (MCP) | Read, write, search, and edit files in the active project directory — the shared-filesystem model from `arch-spec.md`, where the agent edits the same files code-server displays, instead of driving a UI. Scoped to the Anvil project root by default; the server itself rejects any path outside that root (verified — see `test_adapter.py`). | `read_text_file`, `write_file`, `edit_file` (sed-like exact-line replace), `search_files`, `list_directory`, `get_file_info` | testing |
| **search** | [`@brave/brave-search-mcp-server`](https://www.npmjs.com/package/@brave/brave-search-mcp-server) (MCP) | General web search for the human-facing search UI, plus Brave's agent-optimized "LLM context" endpoint for the agent's own research — matches the Brave-for-both-surfaces approach from `arch-spec.md`. Requires `BRAVE_API_KEY`; fails fast with setup instructions if unset rather than mocking. | `brave_web_search`, `brave_llm_context` — deliberately excludes `brave_local_search`, `brave_video_search`, `brave_image_search`, `brave_news_search`, `brave_summarizer`, `brave_place_search` | testing |
| **cad** | [`build123d`](https://build123d.readthedocs.io/) (custom — Python library, not MCP) | Builds and edits a persistent, named multi-part assembly: create primitive shapes, position/move them, combine with boolean ops, fillet edges, inspect volume/bounding box, export the whole assembly. This is the "agent mutates the CAD design" capability the UI mockup demos. Runs fully in-process: no daemon, no API key, no external server. Chosen over FreeCAD-MCP (needs Docker running) and Zoo's Engine API (paid, cloud) to minimize demo-time failure points. Assembly state is a small JSON file per project (`sandbox_project/cad_output/assemblies/<project>.json`) — deterministically rebuilt into real geometry on every call, so it's git-diffable and survives restarts, not a live in-memory session. | `add_box`, `add_cylinder`, `add_tube`, `add_sphere`, `add_cone`, `position_part`, `remove_part`, `boolean_op` (union/cut/intersect), `fillet_part`, `list_parts`, `get_part_info`, `export_assembly` (gltf/step/stl) | testing |
| **circuit** | custom Python | Create, read, update, and delete wiring diagrams as small JSON files that the frontend `WiringDiagram` workspace loads. The agent only supplies modules, pins, and connections; the frontend handles layout, routing, and rendering. Diagrams live in `backend/circuit_output/<project>.json`. | `create_wiring_diagram`, `update_wiring_diagram`, `get_wiring_diagram`, `delete_wiring_diagram`, `list_wiring_diagrams` | testing |
| **printer** | custom Python calling the local Anvil Workshop Bridge | Slice STL/3MF models with Bambu Studio CLI and send them to a Bambu printer over the LAN. Reuses the same bridge (`localhost:3001`) the frontend slicer uses, so printer registration and slicing state are shared. | `check_bridge_health`, `register_printer`, `list_printers`, `slice_model`, `send_to_printer` | testing |
| **state** | [`google-cloud-firestore`](https://cloud.google.com/firestore) (custom — Python library, not MCP) | Persistent project state in Firestore: inventory, constraints, objectives, decisions, and artifacts. Uses `GOOGLE_CLOUD_PROJECT` and honors `FIRESTORE_EMULATOR_HOST` for local testing. | `read_project_summary`, `read_inventory`, `update_inventory`, `add_constraint`, `read_constraints`, `add_objective`, `mark_objective_done`, `read_objectives`, `record_decision`, `approve_decision`, `read_decisions` | testing |

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
  agent.py              # wires adapters/registry.py into a Google ADK agent
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
    circuit/
      adapter.py            # CRUD wiring diagrams as JSON
      validation.py         # validate modules/pins/connections
      test_adapter.py       # standalone proof it works — no agent required
    printer/
      adapter.py            # slice and print via the Anvil Workshop Bridge
      test_adapter.py       # standalone proof it works — no agent required
  sandbox_project/       # used by the CAD adapter for assembly exports
    cad_output/
      assemblies/            # one <project>.json (+ exported .gltf/.step/.stl) per assembly
  circuit_output/        # wiring diagram JSON files, one per project
  requirements.txt
```

Each adapter gets its own folder under `adapters/` with the same shape:
an `adapter.py` (connection/scope) and a `test_adapter.py` (standalone
verification). Whether an adapter is backed by an MCP server or hand-written,
it's registered in `registry.py` the same way — that registry is what gets
wired into ADK later, and it's also the architecture reference for the repo.

## Setup

Requires **Python 3.10 or newer** and Node/npx on PATH.

### Option 1 — `make setup` (recommended)

```bash
cd backend
make setup
```

This creates a virtual environment in `backend/.venv`, upgrades `pip`, and
installs everything in `requirements.txt` (including `google-adk` and
`google-cloud-firestore`).

On Windows, if `python3` is not on PATH, the Makefile tries `python3.12`
and then `python`. To force a specific interpreter:

```powershell
# Windows example with Python 3.12 explicitly
$env:PYTHON = "C:\Users\<you>\AppData\Local\Programs\Python\Python312\python.exe"
cd backend
make setup
```

### Option 2 — manual install

```bash
cd backend
python3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

### Verify Google ADK is installed

```bash
backend/.venv/Scripts/python.exe -c "import google.adk; print(google.adk.__version__)"
```

Requires Node/npx on PATH — the filesystem adapter spawns the official
`@modelcontextprotocol/server-filesystem` package via `npx`.

## Running adapter tests

```bash
make test-filesystem   # one adapter
make test-search       # one adapter; requires BRAVE_API_KEY
make test-cad          # one adapter
make test-circuit      # one adapter
make test-printer      # one adapter; requires the bridge on localhost:3001
make test-state        # one adapter; requires GOOGLE_CLOUD_PROJECT or FIRESTORE_EMULATOR_HOST
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

## Run an agent query

```bash
python backend/run_agent.py "Read src/App.tsx and describe it"
```

Requires `GEMINI_API_KEY` in `backend/.env` (copy from `.env.example`).
The agent will fail fast with setup instructions if the key is missing.

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

## Run the backend server

```bash
cd backend
make serve
# or directly:
.venv/Scripts/python.exe server.py
```

Starts the FastAPI server on `http://localhost:8000` with endpoints for:

- `GET /health`
- `POST /sessions`
- `GET /sessions/{id}`
- `POST /sessions/{id}/chat`
- `GET /vision/feed`
- `POST /vision/analyze`
