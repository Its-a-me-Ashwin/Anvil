"""FastAPI server for the Anvil backend.

Provides:
- chat sessions with session memory via Google ADK
- project state tools through adapters/registry.py
- a minimal MP4-based vision feed endpoint
"""

from __future__ import annotations

import logging
import os
import sys
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import agent as anvil_agent
from workers import vision as vision_worker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

APP_NAME = "anvil"
runner: Runner | None = None

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


# -----------------------------------------------------------------------------
# Lifespan
# -----------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI):
    global runner
    dotenv.load_dotenv(BACKEND_DIR / ".env")
    logger.info("Building Anvil agent tools...")
    tools = await anvil_agent.build_tools_async()
    anvil = anvil_agent.build_agent(tools=tools)
    logger.info("Loaded %s tools.", len(tools))
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
    messages: list[dict] = []
    for event in session.events:
        if not event.content or not event.content.parts:
            continue
        texts = [p.text for p in event.content.parts if p.text]
        if texts:
            messages.append({"role": event.content.role or "unknown", "text": " ".join(texts)})
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
