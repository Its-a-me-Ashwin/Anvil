# Deploy Anvil to Google Cloud

Simple path: use a **Gemini API key** from Google AI Studio, a **Google Cloud
project** with Firestore, and **Cloud Run** for the backend.

---

## 1. Get `GEMINI_API_KEY`

1. Go to [Google AI Studio API keys](https://aistudio.google.com/app/apikey).
2. Sign in with the Google account that has billing.
3. Click **Create API key**.
4. Copy the key and set it in `backend/.env`:

```bash
GEMINI_API_KEY=your-key-here
```

Use it locally for `python backend/server.py` and `python backend/run_agent.py`.
For Cloud Run, set it as an env var on the service.

---

## 2. Create `GOOGLE_CLOUD_PROJECT`

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. At the top bar, click the project selector → **New Project**.
3. Enter a project name and click **Create**.
4. The project ID is shown on the dashboard; it looks like `anvil-hackathon-2026`.
5. Set it in `backend/.env`:

```bash
GOOGLE_CLOUD_PROJECT=your-project-id
```

---

## 3. Enable needed APIs

In your new project, enable:

- **Firestore API** — for project state / inventory / chat memory
- **Cloud Run API** — to run the backend container
- **Cloud Build API** — to build the container
- **Artifact Registry API** — to store the container image

One-click in console:

```
https://console.cloud.google.com/apis/library?project=YOUR_PROJECT_ID
```

Or with gcloud:

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable firestore.googleapis.com run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

---

## 4. Create a Firestore database

1. Go to **Firestore** → **Databases** in the console.
2. Click **Create database**.
3. Choose **Native mode**.
4. Pick a region close to your users (e.g., `us-central1`).
5. Leave default security rules for now.
6. Click **Create**.

The backend `adapters/state/adapter.py` will use this database automatically
when `GOOGLE_CLOUD_PROJECT` is set and `FIRESTORE_EMULATOR_HOST` is **not**
set.

---

## 5. Run Firestore locally with Docker (optional but handy)

You can test against a local Firestore emulator so you do not need real
Firestore credentials during development.

### 5a. Run the emulator container

```bash
docker run -d \
  --name firestore-emulator \
  -p 8200:8200 \
  -e FIRESTORE_PROJECT_ID=anvil-local \
  -e PORT=8200 \
  mtlynch/firestore-emulator-docker
```

### 5b. Tell the backend to use it

Add this to `backend/.env`:

```bash
FIRESTORE_EMULATOR_HOST=localhost:8200
GOOGLE_CLOUD_PROJECT=anvil-local
```

### 5c. Stop / remove it

```bash
docker stop firestore-emulator && docker rm firestore-emulator
```

For a compose version see [mtlynch/firestore-emulator-docker](https://github.com/mtlynch/firestore-emulator-docker).

---

## 6. Deploy the backend to Cloud Run

### 6a. Build and push the container

```bash
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/anvil-backend
```

### 6b. Deploy to Cloud Run

```bash
gcloud run deploy anvil-backend \
  --image gcr.io/YOUR_PROJECT_ID/anvil-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your-key-here,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 80 \
  --max-instances 3
```

Cloud Run will give you a URL like:

```
https://anvil-backend-xxx-uc.a.run.app
```

### 6c. Give Cloud Run permission to use Firestore

The default Compute service account needs the **Cloud Datastore User** role:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Replace `YOUR_PROJECT_NUMBER` with the number shown on the Cloud Console home
page.

---

## 7. Env vars to set in Cloud Run

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | from AI Studio |
| `GOOGLE_CLOUD_PROJECT` | your project ID |
| `VISION_VIDEO_PATH` | optional; Cloud Run cannot access local files, leave unset or use Cloud Storage |

Do **not** check `.env` into Git. Cloud Run uses env vars, not the `.env` file.

---

## 8. Update the frontend to use the cloud backend

In the frontend code, point API calls to the Cloud Run URL instead of
`http://localhost:8000`. For a hackathon you can hard-code it in a config file
or pass it as a build-time env var in Vite.

Example `.env` at the project root for the frontend build:

```bash
VITE_ANVIL_API_URL=https://anvil-backend-xxx-uc.a.run.app
```

Then build and deploy the static frontend to **Firebase Hosting** or **Cloud
Storage + Cloud Load Balancing**.

---

## 9. Quick check after deploy

```bash
curl https://anvil-backend-xxx-uc.a.run.app/health
```

You should see `{"status":"ok","tools":39}`.

---

## 10. Local vs cloud summary

| Mode | `GEMINI_API_KEY` | Firestore | backend command |
|---|---|---|---|
| Local dev | set in `backend/.env` | `FIRESTORE_EMULATOR_HOST=localhost:8080` | `python backend/server.py` |
| Local with real Firestore | set in `backend/.env` | `GOOGLE_CLOUD_PROJECT=...` and `gcloud auth application-default login` | `python backend/server.py` |
| Cloud Run | set on service | `GOOGLE_CLOUD_PROJECT=...` | Cloud Run URL |

---

## Troubleshooting

- **403 on Firestore** → Cloud Run service account missing `roles/datastore.user`.
- **Gemini 401** → `GEMINI_API_KEY` missing or wrong.
- **Search adapter warning** → `BRAVE_API_KEY` not set; agent still works without web search.
- **MCP filesystem warnings** → Node/npx is not on PATH in the container; the Dockerfile installs Node 20.
