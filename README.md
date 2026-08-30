# Anvil

AI engineering partner for hardware projects. Chat with an agent that can read
and edit your local files, search the web, build CAD assemblies, draw wiring
diagrams, send models to a Bambu printer, and (soon) watch live video streams.

## What runs where

| Service | Port | Command | Purpose |
|---|---|---|---|
| Vite frontend | 5173 | `npm run dev` | Main UI (panes, iframes, tools) |
| Workshop bridge | 3001 | `npm run bridge` | Bambu printer + slicing proxy |
| Backend API / agent | 8000 | `python backend/server.py` | Chat sessions, tools, state |
| Code server | 8080 | `npm run code-server` | Browser VS Code on the project folder |
| Firestore emulator | 8200 | docker | Local project state DB |
| Ollama | 11434 | `ollama serve` (optional) | Local vision / telemetry models |

## One-time setup

### 1. Node.js

The repo ships a pinned Node 20 binary under `tools/node20/`. The npm scripts
use `cross-env` to prepend it to `PATH`, so no system Node install is required.

Install frontend dependencies once:

```bash
npm install
```

### 2. Python backend

Requires **Python 3.10+**.

```bash
cd backend
python3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

On Windows with no `python3` on PATH, use the full path to Python 3.12 (or
whatever 3.10+ interpreter you have).

### 3. Environment variables

Copy and fill in the keys you need:

```bash
cp backend/.env.example backend/.env
```

| Variable | Needed for | Where to get one |
|---|---|---|
| `GEMINI_API_KEY` | Agent chat | https://aistudio.google.com/app/apikey |
| `GOOGLE_CLOUD_PROJECT` | Firestore state | Google Cloud console |
| `OLLAMA_URL` / `VISION_MODEL` | Printer camera monitoring | Local Ollama server + `ollama pull gemma3:4b` |

## Start the whole app

Open four terminals from the project root.

### Terminal 1 — Workshop Bridge (printer / slicer)

```bash
npm run bridge
```

### Terminal 2 — Backend server (ADK agent + sessions + vision)

```bash
cd backend
.venv/Scripts/python.exe server.py
```

### Terminal 3 — Browser VS Code (code server)

```bash
npm run code-server
```

### Terminal 4 — Frontend

```bash
npm run dev
```

Then open http://localhost:5173.

## Optional: local Ollama for printer camera monitoring

1. Install Ollama: https://ollama.com/download
2. Pull a vision model: `ollama pull gemma3:4b`
3. Start the server: `ollama serve`
4. Open the Printer Camera tab — it polls `POST /vision/monitor` once a
   minute for isBedEmpty/isSpaghetti/isPrinting while it's open

## Useful URLs

- Frontend: http://localhost:5173
- Backend health: http://localhost:8000/health
- Code server: http://localhost:8080
- Workshop bridge: http://localhost:3001

## Deploy to Google Cloud

See [`deploy.md`](deploy.md) for Cloud Run + Firestore setup.

## TODO

* Demo
