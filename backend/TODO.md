# Backend Implementation TODO

This is the ordered backlog for wiring the backend to Google ADK, adding Google
Cloud Firestore state, and connecting local Gemma via Ollama.

---

## Phase 1 — Foundation: ADK + existing adapters

- [x] Add `google-adk` to `backend/requirements.txt` and install in `.venv`.
- [x] Implement `backend/agent.py`:
  - `build_tools()` that loads every adapter from `adapters/registry.py`.
  - Use `MCPToolset` for MCP-backed adapters (`filesystem`, `search`).
  - Use `FunctionTool` for custom adapters (`cad`, `circuit`, `printer`).
  - `build_agent(model="gemini-3.5-flash" or "gemini-3.5-pro", tools=...)`.
- [x] Add environment check for `GEMINI_API_KEY` / `GOOGLE_API_KEY` in `.env.example`.
- [x] Add a small `backend/run_agent.py` CLI that takes a prompt and prints the
      agent response stream, so we can test without a web server.
- [ ] End-to-end smoke test: agent reads `src/App.tsx` and describes it using
      `read_text_file`.

**Acceptance:** `python backend/run_agent.py "Read src/App.tsx and describe it"`
runs and returns a useful description.

---

## Phase 2 — Filesystem: sed-like editing enabled

- [x] Add `edit_file` and `search_files` to `adapters/registry.py` scope.
- [x] Update `backend/README.md` tool table.
- [x] Update `backend/adapters/filesystem/test_adapter.py` to exercise `edit_file`
      and `search_files`.
- [ ] Re-run filesystem test and clean up any artifacts written to project root.

**Acceptance:** `python -m backend.adapters.filesystem.test_adapter` passes and
`edit_file` successfully replaces exact text.

---

## Phase 3 — Project state in Firestore

- [ ] Set up a Google Cloud project and enable Firestore (native mode).
- [ ] Add `google-cloud-firestore` to `backend/requirements.txt`.
- [ ] Create `backend/adapters/state/adapter.py` with state tools:
  - `read_project_summary(project_id)`
  - `read_inventory(project_id)`
  - `update_inventory(project_id, item_id, updates)`
  - `add_constraint(project_id, text, locked)`
  - `read_constraints(project_id)`
  - `add_objective(project_id, title)`
  - `mark_objective_done(project_id, objective_id)`
  - `read_objectives(project_id)`
  - `record_decision(project_id, summary, requires_approval)`
  - `approve_decision(project_id, decision_id)`
  - `read_decisions(project_id)`
- [ ] Add `backend/adapters/state/test_adapter.py` using a Firestore emulator or
      a dedicated test project.
- [ ] Register the state adapter in `adapters/registry.py`.
- [ ] Add `backend/.env` variables: `GOOGLE_CLOUD_PROJECT`, `FIRESTORE_DATABASE`,
      `FIRESTORE_EMULATOR_HOST` (optional).

**Acceptance:** Agent can run "Add a constraint that housing OD ≤ 85 mm" and the
Firestore document is updated.

---

## Phase 4 — Web server + session memory

- [ ] Add FastAPI to `backend/requirements.txt`.
- [ ] Create `backend/server.py` with endpoints:
  - `POST /sessions` — create a new chat session.
  - `GET /sessions/{session_id}` — load session messages + project state summary.
  - `POST /sessions/{session_id}/messages` — run the agent on a user message,
        stream events, and append messages to Firestore.
  - `GET /sessions/{session_id}/pending_approval` — check for approval cards.
  - `POST /sessions/{session_id}/approve` — approve a pending tool call.
  - `POST /sessions/{session_id}/reject` — reject a pending tool call.
- [ ] Persist conversation messages in Firestore under `sessions/{sessionId}/messages`.
- [ ] Add a `ProjectStateService` that loads the project summary at the start of
      each agent run.
- [ ] Wire the existing Workshop Bridge status and print events into the
      `/sessions/{id}/events` stream.

**Acceptance:** Frontend can open a session, send a message, and receive streamed
agent events.

---

## Phase 5 — Local Gemma via Ollama

- [ ] Document Ollama install steps for Windows in `backend/README.md`.
- [ ] Add `ollama` Python client to `backend/requirements.txt`.
- [ ] Create `backend/workers/gemma_worker.py`:
  - Connect to Ollama (default `http://localhost:11434`).
  - Pull/run a Gemma model (e.g., `gemma3` or `gemma2`).
  - Expose `classify_intent(text)` → returns one of
    `design`, `research`, `make`, `monitor`, `chat`.
  - Expose `summarize_telemetry(json_blob)` for printer status.
  - Expose `describe_camera_event(frame_description)` for camera alerts.
- [ ] Create `backend/workers/camera_worker.py`:
  - Read RTSP/USB/MJPEG stream (OpenCV or ffmpeg).
  - Sample frames, run a lightweight Gemma prompt for anomaly detection.
  - Push events to Firestore `projects/{projectId}/events`.
- [ ] Create `backend/workers/telemetry_worker.py`:
  - Poll the Workshop Bridge `/printers` and printer status.
  - Push state to Firestore.
- [ ] Add `make run-workers` or `python -m backend.workers` to start the workers.

**Acceptance:** A camera frame or printer status change appears in Firestore
within seconds.

---

## Phase 6 — Human approval UI + routing

- [ ] Implement the approval gate in the agent layer:
  - Mark `write_file`, `send_to_printer`, `export_assembly` as requiring
    approval.
  - On a flagged tool call, store `pendingApproval` in Firestore instead of
    executing.
  - Resume the agent after approval/rejection.
- [ ] Update frontend RightAgentPanel to show approval cards.
- [ ] Wire the Gemma intent router so simple questions are answered locally and
      design/make requests go to Gemini.
- [ ] Add session-scoped token/turn budget and fallback to local Gemma if exceeded.

**Acceptance:** Clicking "Send to Printer" in the agent panel shows an approval
card; approving it executes `send_to_printer`.

---

## Phase 7 — Polish and cloud deployment

- [ ] Add `backend/Dockerfile` for Cloud Run.
- [ ] Add `backend/cloudbuild.yaml` or `gcloud run deploy` instructions.
- [ ] Move long-running tasks (slice, print, export) to an async queue or
      background thread so HTTP calls don't block.
- [ ] Add structured logging and basic error reporting.
- [ ] Update `backend/README.md` with setup, env vars, and run instructions.
- [ ] Run all adapter tests and server tests in CI or locally before the demo.

**Acceptance:** Backend can be deployed to Cloud Run and the frontend connects to
it; all tests pass.

---

## Done

- [x] Fix filesystem adapter to use the Anvil project root instead of sandbox.
- [x] Add circuit adapter (CRUD wiring diagrams).
- [x] Add printer adapter (slice + send via Workshop Bridge).
- [x] Update registry with circuit and printer adapters.
- [x] Add adapter tests for circuit and printer.
- [x] Write `backend/PLAN.md` covering ADK wiring, Firestore, and multi-model
      routing.
- [x] Add sed-like `edit_file` and `search_files` to the filesystem scope.
