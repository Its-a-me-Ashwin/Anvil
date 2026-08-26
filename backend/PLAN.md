# Anvil Backend Architecture Plan — Google ADK Integration

Date: 2026-08-25
Status: planning — no code yet

This document is the design reference for wiring the existing `backend/adapters`
registry into Google ADK, adding persistent project state, and splitting work
between cloud Gemini and local Gemma.

## 0. Constraints and stack choices

Per the hackathon/product requirements:

1. **LLM**: Gemini 3.5 or newer, accessed through the **Gemini API** or **Vertex AI**.
2. **Agent framework**: at least one Google framework — this plan uses **Google ADK**.
3. **Google Cloud infrastructure**: **Firestore** for project state, chat memory, and session data.
4. **Local model**: **Gemma** served by **Ollama** on the local machine for camera monitoring, telemetry parsing, and lightweight routing.

---

## 1. Current tool inventory

The registry in `backend/adapters/registry.py` is intentionally flat. ADK also
flattens tools, so this shape is fine.

| Adapter | Backing | Tools | What the agent can do |
|---|---|---|---|
| **filesystem** | MCP | `read_text_file`, `write_file`, `edit_file` (sed-like exact-line replace), `search_files`, `list_directory`, `get_file_info` | Read, write, search, and edit the same project files the human sees in code-server. |
| **search** | MCP | `brave_web_search`, `brave_llm_context` | General web research and agent-oriented page context. |
| **cad** | custom Python | `add_box`, `add_cylinder`, `add_tube`, `add_sphere`, `add_cone`, `position_part`, `remove_part`, `boolean_op`, `fillet_part`, `list_parts`, `get_part_info`, `export_assembly` | Build and edit persistent parametric assemblies via build123d. |
| **circuit** | custom Python | `create_wiring_diagram`, `update_wiring_diagram`, `get_wiring_diagram`, `delete_wiring_diagram`, `list_wiring_diagrams` | CRUD wiring diagrams as JSON consumed by the frontend `WiringDiagram`. |
| **printer** | custom Python (HTTP → bridge) | `check_bridge_health`, `register_printer`, `list_printers`, `slice_model`, `send_to_printer` | Slice models with Bambu Studio and send them to a local Bambu printer. |

Total tools exposed: **30**. This is small enough to pass to the model directly.

---

## 2. How tool discovery works in Google ADK

ADK exposes tools to the model as a flat list. There are two wiring patterns:

1. **MCP-backed adapters** (`filesystem`, `search`):
   ```python
   from google.adk.tools.mcp_tool import MCPToolset

   toolset = MCPToolset(
       connection_params=get_server_params(),
       tool_filter=entry.scope,  # only the 2-4 allowed tool names
   )
   ```
   The MCP server may expose 8-14 tools, but `tool_filter` narrows it to the
   scoped list in `registry.py`.

2. **Custom Python adapters** (`cad`, `circuit`, `printer`):
   ```python
   from google.adk.tools.function_tool import FunctionTool

   tools = [FunctionTool(fn) for fn in adapter_functions]
   ```
   Each function in `adapters/<name>/adapter.py` becomes a tool directly.

The model picks tools by matching the user's request against each tool's
`name` + `description`. Good descriptions matter more than hierarchy.

### Do we need a hierarchical selector?

Not at the ADK level. ADK flattens anyway. A `select_domain` meta-tool would add
an extra model round-trip with no benefit at 24 tools.

What **is** useful is a thin **planner/router** step for complex multi-tool
tasks, e.g.:

> "Design a housing, export it, slice it, and send it to the printer."

This can be handled by:
- A small ADK `WorkflowAgent` or `LlmAgent` with instructions to plan first.
- Or letting Gemini decompose it naturally since all 24 tools fit in context.

Recommendation: **flat tool list, no selector layer.** Revisit only if the
registry grows past ~50 tools.

---

## 3. Tool-list size and token budget

At 30 tools, each with a name + description + parameter schema, the total tool
definition block is roughly **2,500–5,000 tokens**. That is cheap compared to:

- A full project state dump (parts list, constraints, decisions, chat
  history) which can grow much larger.
- A CAD assembly description or search results.

Gemini 3.5+ has a large context window. Passing all 26 tools directly is
safe for the hackathon.

If the registry grows, the standard mitigation is **tool filtering by intent**:
- Pre-classify the request (design vs research vs make).
- Load only the relevant adapter's tools for that turn.
- Keep shared tools (`filesystem`, project-state tools) always loaded.

For now: **load all tools on every turn.**

---

## 4. Conversation memory

We need persistent, multi-turn conversation state. Options:

| Option | Pros | Cons |
|---|---|---|
| In-memory dict | Trivial | Lost on restart, no multi-device |
| Firestore | Serverless, Google-native, scales | Slightly more setup |
| Cloud SQL (PostgreSQL) | Relational, joins for state | More ops overhead |
| Redis | Fast, pub/sub | Another service to run |

Recommendation: **Firestore** for the hackathon because:
- It is Google Cloud native (matches your cloud choice).
- No schema migrations needed early on.
- Easy to add collections as we discover entities.
- Good enough for a demo and early product.

### Firestore schema for memory

```text
collections:
  sessions/{sessionId}
    - createdAt
    - projectId
    - messages: [ {role, content, toolCalls?, timestamp} ]
    - pendingApproval: { tool, args, humanResponse? }
    - activePlan: string
    - metadata: { modelUsed, costEstimate? }

  projects/{projectId}
    - name, status, createdAt
    - constraints: [ {id, text, locked, source} ]
    - inventory: [ {id, name, quantity, status, source} ]
    - decisions: [ {id, text, approvedAt, approvedBy} ]
    - artifacts: { cadAssembly, wiringDiagram, firmwareRepo, slicerJob, printJob }
    - printerConfig: { name, host, serialNumber, model }
```

The agent should **not** receive the entire project state every turn. Instead:
- Read the most recent N messages from `sessions/{sessionId}/messages`.
- Pass a **summary** of project state (constraints, inventory, recent decisions).
- Provide tools like `read_project_state`, `update_project_state` for the agent to
  pull details only when needed.

---

## 5. Project state storage

The left pane today shows inventory, constraints, objectives, progress. That
state should be the **single source of truth** in Firestore.

### Entities

1. **Project**
   - id, name, description, status, createdAt, updatedAt

2. **Constraint**
   - id, projectId, text, locked (boolean), source (human/agent), createdAt

3. **InventoryItem**
   - id, projectId, name, quantity, status (available/limited/out_of_stock),
     sourceUrl?, unitCost?

4. **Objective / Task**
   - id, projectId, title, status (pending/in_progress/done/blocked),
     assignedTool?, createdAt, completedAt

5. **Decision**
   - id, projectId, summary, requiresApproval (boolean), approved (boolean),
     approvedBy, approvedAt

6. **DesignArtifact**
   - id, projectId, type (cad/circuit/code/firmware), filePath, metadata

7. **PrinterConfig**
   - projectId, name, host, serialNumber, accessCode, model

### How the agent uses project state

- Tools:
  - `read_project_summary(projectId)` → returns constraints, inventory, active
    objectives, recent decisions.
  - `read_inventory(projectId)`
  - `update_inventory(projectId, itemId, updates)`
  - `add_constraint(projectId, text, locked)`
  - `add_objective(projectId, title)`
  - `mark_objective_done(projectId, objectiveId)`
  - `record_decision(projectId, summary, requiresApproval)`
  - `approve_decision(projectId, decisionId)`

These tools live as a new **state** adapter in `backend/adapters/state/`. They
read/write Firestore, not the filesystem.

### Frontend sync

The React UI subscribes to the same Firestore collections:
- `projects/{projectId}` → left pane overview.
- `projects/{projectId}/inventory` → inventory list.
- `projects/{projectId}/objectives` → progress steps.

When the agent updates state via a tool, the UI updates in real time.

---

## 6. Multi-model strategy: Gemini (cloud) + Gemma (local)

| Concern | Model | Why |
|---|---|---|
| Reasoning, planning, tool selection, complex CAD | Gemini 3.5+ via Gemini API or Vertex AI | Strong tool-calling and long-context reasoning; required by hackathon rules. |
| Camera stream monitoring, telemetry parsing, low-latency alerts | Gemma via local Ollama | Cheaper, no round-trip to cloud, works offline, privacy-friendly for video. |
| Quick classification / routing | Gemma via local Ollama | Fast enough to decide if a request needs Gemini. |

### Architecture

```text
User message
    │
    ▼
[Local Gemma router] ──lightweight──┐
    │                               │
    ▼                               │
Needs heavy reasoning?              │
    │                               │
    yes                             no
    ▼                               ▼
[Cloud Gemini + ADK tools]    [Local Gemma task]
    │                               │
    ▼                               ▼
Updates Firestore              Updates Firestore /
Calls tools                    streams telemetry
    │                               │
    └──────────► UI (WebSocket / Firestore realtime)
```

### Gemma local responsibilities

- **Camera monitor**: Watch RTSP / USB camera feed, detect anomalies (print
  failure, bed clear, etc.), push events to Firestore.
- **Telemetry parser**: Poll printer status via the bridge, push state to
  Firestore.
- **Intent router**: Classify incoming user message into `design`, `research`,
  `make`, `monitor`, or `general_chat`. Only route non-trivial design/make
  requests to Gemini.

### Gemini cloud responsibilities

- Everything that needs tool use: CAD, circuit design, slicing, printing,
  filesystem edits, search synthesis.
- Multi-step planning.
- Human approval touchpoints.

---

## 7. Backend service architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Anvil React Frontend                     │
│  (left pane, center workspace, right agent panel, top bar)  │
└──────────────┬────────────────────────────────────────────────┘
               │
               │ HTTP / WebSocket / Firestore realtime
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Anvil Backend Server                       │
│              FastAPI / Flask (Python)                       │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Session API │  │ Agent API   │  │ Realtime / WS hub   │  │
│  │ (chat CRUD) │  │ (run agent) │  │ (printer/camera)    │  │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────────┘  │
│         │                │                                    │
│         ▼                ▼                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Google ADK Agent (cloud Gemini)          │   │
│  │  tools = filesystem + search + cad + circuit +       │   │
│  │          printer + state                              │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Local Gemma Worker                       │   │
│  │  (camera RTSP, telemetry, router)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Workshop Bridge (Node)                 │   │
│  │  (slicing, printing, already running on :3001)      │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │   Google Cloud      │
               │  Firestore (state)  │
               │  Cloud Storage      │
               │  (exports/artifacts)│
               └─────────────────────┘
```

### Why FastAPI/Flask in front of ADK?

ADK agents can run standalone, but a web server is needed to:
- Authenticate the frontend.
- Manage sessions and route them to the right Firestore documents.
- Stream agent events to the UI.
- Run the local Gemma worker alongside the cloud agent.
- Serve as a health/observability endpoint.

### Code-server integration

The human and the agent share the project directory:
- Human edits via code-server iframe.
- Agent edits via `filesystem` MCP tools.
- Both see the same files.

---

## 8. Human approval touchpoints

Some tools should require human approval before executing:

| Tool | Approval? | Why |
|---|---|---|
| `write_file` / overwrite | Yes | Prevents agent from clobbering code. |
| `send_to_printer` | Yes | Starts physical print; costly/irreversible. |
| `export_assembly` → manufacturing | Yes | Commits design to a manufacturable file. |
| `register_printer` | No | Already gated by access code. |
| `brave_web_search` | No | Read-only. |

Implementation:
- ADK agent marks the tool call as `requires_approval`.
- Backend stores it in `sessions/{sessionId}/pendingApproval`.
- UI shows a card: "Approve sending X to printer?"
- User clicks Approve → backend re-runs the tool.
- User clicks Reject → backend records the decision and tells the agent.

---

## 9. Implementation phases

### Phase 1 — ADK wiring + filesystem
Goal: agent can chat and edit project files.

- Install `google-adk` in `.venv`.
- Implement `backend/agent.py` `build_tools()` and `build_agent()`.
- Wire `filesystem`, `search` via `MCPToolset`.
- Wire `cad`, `circuit`, `printer` via `FunctionTool`.
- Add FastAPI endpoint `/agent/run` that runs the ADK agent and returns events.
- Test end-to-end: "Read src/main.cpp and suggest a change."

### Phase 2 — Persistent project state
Goal: agent can read/update project inventory, constraints, objectives.

- Set up Firestore project and `backend/adapters/state/` adapter.
- Add tools: `read_project_summary`, `update_inventory`, `add_constraint`,
  `add_objective`, `record_decision`, `approve_decision`.
- Update frontend left pane to read from Firestore.
- Test: "Add a constraint that the housing OD must be ≤ 85 mm."

### Phase 3 — Multi-model routing
Goal: Gemma handles camera/telemetry, Gemini handles design.

- Add local Gemma worker (could be Ollama, llama.cpp, or `transformers`).
- Router classifies user intent.
- Gemma pushes printer/camera events to Firestore.
- Gemini receives those events as context when asked.
- Test: "Is the printer still printing?" → Gemma telemetry.
  "Design a bracket for this motor." → Gemini + CAD tools.

### Phase 4 — Real-time streams and polish
Goal: camera feed, printer status, and long-running jobs feel live.

- WebSocket endpoint for agent events and printer status.
- RTSP/MJPEG camera bridge (reuse `printer` bridge or new `camera` adapter).
- Async job queue for slice/print/export operations.
- Human approval UI polish.

---

## 10. Open decisions

1. **Gemini model version**: Gemini 3.5 or newer, accessed through Gemini API or Vertex AI, as required.
2. **Gemma runtime**: Ollama on the local machine. Document the install steps; optionally ship a setup script.
3. **Firestore vs Cloud SQL**: Start with Firestore. If relational queries
   become painful, migrate state to Cloud SQL later.
4. **Authentication**: For the hackathon, run locally with no auth. For product,
   add Firebase Auth or Google OAuth.
5. **Cost guardrails**: Cloud Gemini usage is metered. Add a token/turn budget and
   a fallback to local Gemma for simple requests.

---

## 11. Summary of recommendations

- **Keep the flat registry.** 24 tools is small enough to pass directly to ADK.
- **Add a `state` adapter** for Fire-backed project memory (inventory,
  constraints, objectives, decisions).
- **Do not pass the entire project state in every prompt.** Use tool calls to
  pull summaries/details on demand.
- **Use Gemini cloud for tool use and reasoning; Gemma local for camera,
  telemetry, and routing.**
- **Build a FastAPI/Flask layer** in front of ADK to manage sessions, UI sync,
  and the local Gemma worker.
- **Start with Phase 1** and validate end-to-end before adding persistence.
