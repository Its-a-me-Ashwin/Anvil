"""FastAPI server for the Anvil backend.

Provides:
- chat sessions with session memory via Google ADK
- project persistence through Firestore when configured
- project state tools through adapters/registry.py
- a minimal MP4-based vision feed endpoint
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

import dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import Client, types
from google.cloud import firestore
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import agent as anvil_agent
from adapters.state.adapter import read_project_summary
from workers import vision as vision_worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_NAME = "anvil"
runner: Runner | None = None
USE_FIRESTORE = False

# -----------------------------------------------------------------------------
# Pydantic models
# -----------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    user_id: str = "default"


class CreateSessionResponse(BaseModel):
    session_id: str
    user_id: str


class ChatRequest(BaseModel):
    message: str
    user_id: str | None = "default"


class ChatResponse(BaseModel):
    session_id: str
    response: str
    tool_calls: list[dict]


class AnalyzeRequest(BaseModel):
    prompt: str = "Describe what you see in this frame."
    timestamp: str = "00:00:01"


class ProjectCreateRequest(BaseModel):
    name: str | None = "New Project"


class ProjectChatRequest(BaseModel):
    message: str


class ProjectChatResponse(BaseModel):
    response: str
    project_name: str


# -----------------------------------------------------------------------------
# Lifespan
# -----------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global runner, USE_FIRESTORE
    dotenv.load_dotenv(BACKEND_DIR / ".env")
    USE_FIRESTORE = bool(os.environ.get("GOOGLE_CLOUD_PROJECT") or os.environ.get("FIRESTORE_EMULATOR_HOST"))
    logger.info("Building Anvil agent tools...")
    tools = await anvil_agent.build_tools_async()
    anvil = anvil_agent.build_agent(tools=tools)
    logger.info("Loaded %s tools.", len(tools))

    if USE_FIRESTORE:
        from google.adk.integrations.firestore.firestore_session_service import FirestoreSessionService

        logger.info("Using FirestoreSessionService for persistence.")
        session_service = FirestoreSessionService(root_collection="sessions")
    else:
        logger.info("Using InMemorySessionService; project persistence disabled.")
        session_service = InMemorySessionService()

    runner = Runner(
        app_name=APP_NAME,
        agent=anvil,
        session_service=session_service,
    )
    app.state.tool_count = len(tools)
    logger.info("Agent ready.")
    yield
    runner = None


app = FastAPI(title="Anvil Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------


def _runner() -> Runner:
    if runner is None:
        raise HTTPException(status_code=503, detail="Agent runner not ready")
    return runner


def _firestore_client() -> firestore.AsyncClient:
    r = _runner()
    if not USE_FIRESTORE or not hasattr(r.session_service, "client"):
        raise HTTPException(status_code=503, detail="Firestore persistence is not configured")
    return r.session_service.client


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _projects_collection() -> firestore.AsyncCollectionReference:
    return _firestore_client().collection("projects")


# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------


@app.get("/health")
async def health(request: Request) -> dict:
    return {"status": "ok", "tools": getattr(request.app.state, "tool_count", 0)}


# -----------------------------------------------------------------------------
# Sessions + chat
# -----------------------------------------------------------------------------


@app.post("/sessions", response_model=CreateSessionResponse)
async def create_session(req: CreateSessionRequest) -> CreateSessionResponse:
    r = _runner()
    session = await r.session_service.create_session(
        app_name=APP_NAME,
        user_id=req.user_id or "default",
        state={},
    )
    return CreateSessionResponse(session_id=session.id, user_id=session.user_id)


@app.get("/sessions/{session_id}")
async def get_session(session_id: str, user_id: str = "default") -> dict:
    r = _runner()
    session = await r.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # session.events is always empty: the installed google-adk
    # FirestoreSessionService.get_session() queries events with
    # order_by("timestamp"), but events are stored with timestamp nested
    # under event_data.timestamp, not at the top level — so the query
    # matches zero documents every time. Confirmed by inspecting the raw
    # Firestore documents directly. Query the events subcollection
    # ourselves instead of relying on that broken helper, and sort in
    # Python rather than depending on a Firestore order_by.
    events_ref = (
        _firestore_client()
        .collection("sessions").document(APP_NAME)
        .collection("users").document(user_id)
        .collection("sessions").document(session_id)
        .collection("events")
    )
    event_docs = [doc.to_dict().get("event_data", {}) async for doc in events_ref.stream()]
    raw_events = sorted(event_docs, key=lambda e: e.get("timestamp", 0))

    messages: list[dict] = []
    for event_data in raw_events:
        content = event_data.get("content") or {}
        parts = content.get("parts") or []
        texts = [p.get("text") for p in parts if p.get("text")]
        if texts:
            messages.append({"role": content.get("role") or "unknown", "text": " ".join(texts)})
    return {"session_id": session.id, "messages": messages}


@app.post("/sessions/{session_id}/chat", response_model=ChatResponse)
async def chat(session_id: str, req: ChatRequest) -> ChatResponse:
    r = _runner()
    user_id = req.user_id or "default"

    session = await r.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    content = types.Content(role="user", parts=[types.Part(text=req.message)])
    response_parts: list[str] = []
    tool_calls: list[dict] = []

    async for event in r.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if not event.content:
            continue
        if event.is_final_response():
            for part in event.content.parts:
                if part.text:
                    response_parts.append(part.text)
        for part in event.content.parts:
            if part.function_call:
                tool_calls.append(
                    {
                        "name": part.function_call.name,
                        "args": dict(part.function_call.args or {}),
                    }
                )

    return ChatResponse(
        session_id=session_id,
        response="\n".join(response_parts),
        tool_calls=tool_calls,
    )


# -----------------------------------------------------------------------------
# Projects
# -----------------------------------------------------------------------------


@app.get("/projects")
async def list_projects() -> dict:
    col = _projects_collection()
    docs = await col.order_by("updated_at", direction=firestore.Query.DESCENDING).get()
    projects = []
    for doc in docs:
        data = doc.to_dict()
        projects.append({
            "id": doc.id,
            "name": data.get("name", "New Project"),
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
        })
    return {"projects": projects}


@app.post("/projects")
async def create_project(req: ProjectCreateRequest) -> dict:
    r = _runner()
    col = _projects_collection()
    user_id = "default"
    now = _now()
    doc_ref = col.document()

    # project_id in session state lets the agent's instruction tell it the
    # real Firestore project id, instead of it inventing one — see
    # agent._build_instruction.
    session = await r.session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        state={"project_id": doc_ref.id},
    )

    await doc_ref.set({
        "name": req.name or "New Project",
        "user_id": user_id,
        "created_at": now,
        "updated_at": now,
        "session_id": session.id,
    })

    return {
        "id": doc_ref.id,
        "name": req.name or "New Project",
        "session_id": session.id,
    }


@app.get("/projects/{project_id}")
async def get_project(project_id: str) -> dict:
    doc = await _projects_collection().document(project_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    data = doc.to_dict()
    return {
        "id": doc.id,
        "name": data.get("name", "New Project"),
        "user_id": data.get("user_id", "default"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "session_id": data.get("session_id"),
    }


@app.get("/projects/{project_id}/state")
async def get_project_state(project_id: str) -> dict:
    """Everything the left panel needs: objective, constraints, inventory,
    progress (objectives), decisions, data sources, artifacts. Backed by the
    same state adapter the agent's tools use, so this reflects tool calls
    made during chat, not a separate copy of the data."""
    doc = await _projects_collection().document(project_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    # read_project_summary is sync (google.cloud.firestore.Client, shared
    # with the agent's FunctionTools) — run it off the event loop so a slow
    # Firestore round-trip doesn't block other requests.
    return await asyncio.to_thread(read_project_summary, project_id)


@app.post("/projects/{project_id}/chat", response_model=ProjectChatResponse)
async def chat_project(project_id: str, req: ProjectChatRequest) -> ProjectChatResponse:
    r = _runner()
    user_id = "default"
    col = _projects_collection()
    doc_ref = col.document(project_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")

    project = doc.to_dict()
    session_id = project.get("session_id")

    if not session_id:
        session = await r.session_service.create_session(
            app_name=APP_NAME,
            user_id=user_id,
            state={"project_id": project_id},
        )
        session_id = session.id
        await doc_ref.update({"session_id": session_id})

    content = types.Content(role="user", parts=[types.Part(text=req.message)])
    response_parts: list[str] = []

    async for event in r.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if not event.content:
            continue
        for part in event.content.parts:
            if getattr(part, "function_call", None):
                fc = part.function_call
                logger.info("tool_call: %s(%s)", fc.name, dict(fc.args or {}))
            if getattr(part, "function_response", None):
                fr = part.function_response
                logger.info("tool_result: %s -> %s", fr.name, fr.response)
        if event.is_final_response():
            for part in event.content.parts:
                if part.text:
                    response_parts.append(part.text)

    response_text = "\n".join(response_parts)
    project_name = project.get("name") or "New Project"

    if project_name in ("New Project", ""):
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            try:
                client = Client(api_key=api_key)
                prompt = (
                    f"Suggest a short project name (max 4 words) for this chat:\n"
                    f"User: {req.message}\n"
                    f"Assistant: {response_text}\n"
                    "Return only the name."
                )
                suggestion = await client.aio.models.generate_content(
                    model="gemini-flash-lite-latest",
                    contents=[prompt],
                )
                suggested = (suggestion.text or "").strip().strip('"').strip("'")
                if suggested:
                    project_name = suggested
            except Exception as exc:
                logger.warning("Failed to suggest project name: %s", exc)

    await doc_ref.update({
        "name": project_name,
        "updated_at": _now(),
        "session_id": session_id,
    })

    return ProjectChatResponse(response=response_text, project_name=project_name)


# -----------------------------------------------------------------------------
# Vision feed (MP4 placeholder)
# -----------------------------------------------------------------------------


@app.get("/vision/feed", response_model=None)
async def vision_feed() -> StreamingResponse | FileResponse:
    video = vision_worker.video_path()
    if not video:
        raise HTTPException(status_code=503, detail="VISION_VIDEO_PATH not configured")
    return FileResponse(video, media_type="video/mp4", filename=video.name)


@app.post("/vision/analyze")
async def vision_analyze(req: AnalyzeRequest) -> dict:
    result = await vision_worker.analyze_frame(req.prompt, req.timestamp)
    if not result.get("ok"):
        raise HTTPException(status_code=503, detail=result.get("error"))
    return result


# -----------------------------------------------------------------------------
# Entry point
# -----------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("ANVIL_PORT", "8000"))
    host = os.environ.get("ANVIL_HOST", "127.0.0.1")
    uvicorn.run("server:app", host=host, port=port, reload=False)
