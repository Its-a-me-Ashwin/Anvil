# Anvil backend — adapters

Python backend that will host the Google ADK agent. For now it just holds
tool adapters, built and tested independently of ADK/Gemini so each one is
proven working before it's wired into the agent.

## Layout

```
backend/
  Makefile
  adapters/
    registry.py         # single source of truth: every tool exposed to the agent, and its scope
    filesystem/
      adapter.py          # the adapter itself — connection params, scope
      test_adapter.py     # standalone proof it works — no agent required
  sandbox_project/       # scoped root the filesystem adapter is allowed to touch
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
make test-all          # every adapter
```

Each `test-<name>` target connects to that adapter exactly the way ADK's
`MCPToolset` will, confirms every tool in its scope is present, and exercises
real calls end to end (for filesystem: write → list → read → get_file_info,
plus a boundary check that paths outside the sandbox are rejected).

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
