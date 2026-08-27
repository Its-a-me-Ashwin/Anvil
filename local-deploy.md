# Local Deploy Guide — Anvil

Run everything on your own machine. Only Gemini and Brave use external APIs.

---

## 1. Get API keys

### Gemini

1. Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
2. Sign in with your Google account.
3. Click **Create API key**.
4. Copy the key.

---

## 2. One-time setup

### 2a. Install Python dependencies

Needs Python 3.10+.

```bash
cd backend
python3.12 -m venv .venv
.venv/Scripts/python.exe -m pip install --upgrade pip
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

On Windows, if `python3.12` is not on PATH, use the full path from
`C:\Users\<you>\AppData\Local\Programs\Python\Python312\python.exe`.

### 2b. Install Node dependencies

The repo includes a pinned Node 20 under `tools/node20/`. The npm scripts use
it automatically.

From the project root:

```bash
npm install
```

### 2c. Install Ollama (optional — for vision)

1. Download from [ollama.com/download](https://ollama.com/download).
2. Install and run `ollama serve` in a terminal.
3. Pull a vision model:

```bash
ollama pull gemma3:4b
```

### 2d. Install Docker (optional — for Firestore emulator)

Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/).
You only need it if you want a local Firestore database. Otherwise the state
adapter falls back to real Firestore when `GOOGLE_CLOUD_PROJECT` is set.

---

## 3. Configure environment

Copy the example env file:

```bash
cp backend/.env.example backend/.env
```

Fill in these values:

```bash
GEMINI_API_KEY=your-gemini-key
GOOGLE_CLOUD_PROJECT=anvil-local          # can be fake when using emulator
FIRESTORE_EMULATOR_HOST=localhost:8200    # optional; remove to use real Firestore
VISION_VIDEO_PATH=C:/path/to/video.mp4    # optional; local camera placeholder
```

Leave `FIRESTORE_EMULATOR_HOST` empty if you want to use real Firestore with
`gcloud auth application-default login`.

---

## 4. Start services

Open one terminal per service.

### Terminal 1 — Firestore emulator (optional)

```bash
docker run -d \
  --name firestore-emulator \
  -p 8200:8200 \
  -e FIRESTORE_PROJECT_ID=anvil-local \
  -e PORT=8200 \
  mtlynch/firestore-emulator-docker
```

Stop later with:

```bash
docker stop firestore-emulator && docker rm firestore-emulator
```

### Terminal 2 — Workshop bridge

```bash
npm run bridge
```

Runs on http://localhost:3001.

### Terminal 3 — Backend server

```bash
cd backend
.venv/Scripts/python.exe server.py
```

Runs on http://localhost:8000.

### Terminal 4 — Code server (browser VS Code)

```bash
npm run code-server
```

Runs on http://localhost:8080.

### Terminal 5 — Frontend

```bash
npm run dev
```

Runs on http://localhost:5173.

### Terminal 6 — Ollama (optional)

```bash
ollama serve
```

Runs on http://localhost:11434.

---

## 5. Verify

Check each service:

```bash
curl http://localhost:8000/health
curl http://localhost:3001/health || curl http://localhost:3001
```

Then open http://localhost:5173.

---

## 6. Quick chat test

```bash
curl -X POST http://localhost:8000/sessions \
  -H 'Content-Type: application/json' \
  -d '{"user_id":"local"}'
```

Use the returned `session_id`:

```bash
curl -X POST http://localhost:8000/sessions/<session_id>/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"hello"}'
```

---

## 7. Using real Firestore instead of the emulator

1. Make sure `GOOGLE_CLOUD_PROJECT` is set to your real GCP project ID.
2. Remove or comment out `FIRESTORE_EMULATOR_HOST` in `backend/.env`.
3. Run:

```bash
gcloud auth application-default login
```

Then start the backend server again.

---

## 8. Ports summary

| Service | Port | Command |
|---|---|---|
| Firestore emulator | 8200 | docker run ... |
| Workshop bridge | 3001 | `npm run bridge` |
| Backend API | 8000 | `python backend/server.py` |
| Code server | 8080 | `npm run code-server` |
| Frontend | 5173 | `npm run dev` |
| Ollama | 11434 | `ollama serve` |
