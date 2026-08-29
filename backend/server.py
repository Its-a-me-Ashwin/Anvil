"""FastAPI server for the Anvil backend.

Provides:
- chat sessions with session memory via Google ADK
- project persistence through Firestore when configured
- project state tools through adapters/registry.py
- printer camera monitoring via a local Ollama vision model
"""

from __future__ import annotations

import asyncio
import html
import logging
import os
import re
import sys
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncGenerator

import dotenv
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import Client, types
from google.cloud import firestore
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import agent as anvil_agent
from adapters.animation.adapter import animation_path
from adapters.cad.assembly import Assembly
from adapters.circuit.adapter import read_wiring_diagram
from adapters.filesystem.adapter import PROJECT_DIR
from adapters.state.adapter import read_project_summary, remove_skill_statement
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


class ProjectCreateRequest(BaseModel):
    name: str | None = "New Project"


class ProjectChatRequest(BaseModel):
    message: str


class ToolCallInfo(BaseModel):
    id: str
    name: str
    args: dict
    result: object = None


class ProjectChatResponse(BaseModel):
    response: str
    project_name: str
    tool_calls: list[ToolCallInfo] = []


class SourceItem(BaseModel):
    type: str  # 'web', 'youtube', 'pdf', 'image', 'video', 'code', 'slicer', 'wiring'
    title: str
    url: str | None = None
    added_at: str | None = None
    # The real site domain, when known independently of `url` — Gemini's
    # grounding chunks give both a redirect uri (vertexaisearch.cloud.google.com/...)
    # and the actual source domain; showing the latter (e.g. for a favicon)
    # is more useful than whatever host the url itself resolves to.
    domain: str | None = None


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

    return {"session_id": session.id, "messages": _reconstruct_messages(raw_events)}


def _reconstruct_messages(raw_events: list[dict]) -> list[dict]:
    """Turn a flat, timestamp-ordered list of raw ADK event dicts into
    chat-shaped messages: one per user turn, one per assistant turn with
    that turn's tool calls (call + result, correlated by function_call id)
    attached — the same shape chat_project returns live, so a page refresh
    renders identically to what was just seen. Events are grouped by
    invocation_id: one invocation is one user message plus every
    function_call/function_response pair the agent made answering it, plus
    its final text — confirmed by inspecting real event data."""
    turns: dict[str, dict] = {}
    order: list[str] = []
    for event_data in raw_events:
        inv = event_data.get("invocation_id") or event_data.get("id")
        if inv not in turns:
            turns[inv] = {"user_text": "", "calls": {}, "call_order": [], "assistant_text": ""}
            order.append(inv)
        turn = turns[inv]
        content = event_data.get("content") or {}
        role = content.get("role")
        for part in content.get("parts") or []:
            if "function_call" in part:
                fc = part["function_call"]
                call_id = fc.get("id") or fc.get("name")
                turn["calls"][call_id] = {
                    "id": call_id,
                    "name": fc.get("name"),
                    "args": fc.get("args") or {},
                    "result": None,
                }
                turn["call_order"].append(call_id)
            elif "function_response" in part:
                fr = part["function_response"]
                call_id = fr.get("id") or fr.get("name")
                if call_id in turn["calls"]:
                    turn["calls"][call_id]["result"] = fr.get("response")
            elif part.get("text"):
                if role == "user":
                    turn["user_text"] += part["text"]
                elif role == "model":
                    turn["assistant_text"] += part["text"]

    messages: list[dict] = []
    for inv in order:
        turn = turns[inv]
        if turn["user_text"]:
            messages.append({"role": "user", "text": turn["user_text"]})
        tool_calls = [turn["calls"][cid] for cid in turn["call_order"]]
        if turn["assistant_text"] or tool_calls:
            message = {"role": "assistant", "text": turn["assistant_text"]}
            if tool_calls:
                message["tool_calls"] = tool_calls
            messages.append(message)
    return messages


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
        "sources": [],
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
        "sources": data.get("sources", []),
    }


def _merge_sources(existing: list[dict], new_items: list[dict]) -> list[dict]:
    """Append new_items to existing, skipping any whose url already exists
    (untitled/url-less items are never deduped against each other)."""
    seen_urls = {s["url"] for s in existing if s.get("url")}
    merged = list(existing)
    for item in new_items:
        url = item.get("url")
        if url and url in seen_urls:
            continue
        if url:
            seen_urls.add(url)
        merged.append(item)
    return merged


_TITLE_RE = re.compile(rb"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


async def _resolve_page_title(client: httpx.AsyncClient, url: str) -> str | None:
    """Best-effort real page <title> for a grounding source — the grounding
    API only ever gives us the bare domain (see _grounding_sources), never
    anything from the page itself."""
    try:
        resp = await client.get(url, follow_redirects=True, timeout=4.0)
        match = _TITLE_RE.search(resp.content[:65536])
        if not match:
            return None
        title = html.unescape(match.group(1).decode("utf-8", errors="ignore"))
        title = re.sub(r"\s+", " ", title).strip()
        return title[:200] or None
    except Exception:
        return None


async def _enrich_source_titles(sources: list[dict]) -> None:
    """Mutate each web source's title in place with the real page title, when
    fetchable, falling back to the grounding-derived (domain) title otherwise.
    Runs the fetches concurrently so this adds at most ~4s, not 4s-per-source."""
    web_sources = [s for s in sources if s.get("type") == "web" and s.get("url")]
    if not web_sources:
        return
    async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}) as client:
        titles = await asyncio.gather(*(_resolve_page_title(client, s["url"]) for s in web_sources))
    for s, title in zip(web_sources, titles):
        if title:
            s["title"] = title


def _grounding_sources(event) -> list[dict]:
    """Real, agent-verified sources from a Gemini google_search grounding
    event — as opposed to a URL the model merely mentions in prose, or one
    it names 'from its own knowledge' via a tool call."""
    metadata = getattr(event, "grounding_metadata", None)
    if not metadata or not metadata.grounding_chunks:
        return []
    added_at = _now().isoformat()
    sources = []
    for chunk in metadata.grounding_chunks:
        web = getattr(chunk, "web", None)
        if web and web.uri:
            sources.append({
                "type": "web",
                "title": web.title or web.domain or web.uri,
                "url": web.uri,
                "domain": web.domain,
                "added_at": added_at,
            })
    return sources


@app.get("/projects/{project_id}/sources")
async def get_project_sources(project_id: str) -> dict:
    doc = await _projects_collection().document(project_id).get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    project = doc.to_dict()
    return {"sources": project.get("sources", [])}


@app.post("/projects/{project_id}/sources")
async def add_project_source(project_id: str, item: SourceItem) -> dict:
    doc_ref = _projects_collection().document(project_id)
    doc = await doc_ref.get()
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Project not found")
    project = doc.to_dict()
    source = item.model_dump()
    sources = _merge_sources(project.get("sources") or [], [source])
    await doc_ref.update({
        "sources": sources,
        "updated_at": _now(),
    })
    return source


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


@app.delete("/projects/{project_id}/skills/{category}/statements/{statement_id}")
async def delete_skill_statement(project_id: str, category: str, statement_id: str) -> dict:
    """Direct user-initiated delete from the Memory tab — bypasses the agent
    entirely, unlike every other state entity, so the user always has the
    final say over what's recorded about them."""
    try:
        return await asyncio.to_thread(remove_skill_statement, project_id, category, statement_id)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@app.get("/projects/{project_id}/cad/meta")
async def get_cad_meta(project_id: str) -> dict:
    """Cheap poll target for the STL viewer's hot-reload: just the assembly
    state file's mtime, not a full geometry export. The viewer re-fetches
    the .stl below only when this mtime changes."""
    def _read() -> dict:
        asm = Assembly(project_id)
        return {"part_count": len(asm.parts), "mtime": asm.json_mtime()}

    return await asyncio.to_thread(_read)


@app.get("/projects/{project_id}/cad/model.stl", response_model=None)
async def get_cad_model(project_id: str) -> FileResponse:
    def _export() -> str:
        asm = Assembly(project_id)
        if not asm.parts:
            raise HTTPException(status_code=404, detail="No CAD parts in this project yet")
        return asm.export("stl")["path"]

    path = await asyncio.to_thread(_export)
    return FileResponse(path, media_type="application/octet-stream", filename=f"{project_id}.stl")


@app.get("/projects/{project_id}/circuit")
async def get_project_circuit(project_id: str) -> dict:
    """The project's saved wiring diagram (or an empty one if none exists
    yet), for the frontend to auto-open in the Wiring Diagram tab right
    after the agent creates/updates one."""
    return await asyncio.to_thread(read_wiring_diagram, project_id)


@app.get("/projects/{project_id}/animation/{filename}", response_model=None)
async def get_project_animation(project_id: str, filename: str) -> FileResponse:
    """Serve an animation generate_animation just wrote to disk, so the
    frontend can pull it straight into the center canvas's video tab."""
    try:
        path = animation_path(project_id, filename)
    except ValueError as exc:
        raise HTTPException(status_code=403, detail=str(exc))
    if not path.exists():
        raise HTTPException(status_code=404, detail="Animation not found")
    return FileResponse(path, media_type="video/mp4", filename=path.name)


@app.get("/workspace/resolve")
async def resolve_workspace_path(path: str) -> dict:
    """Resolve a (possibly relative) path the agent's filesystem tools just
    touched to an absolute path on disk, so the frontend can deep-link the
    embedded VS Code Server iframe straight to that file."""
    def _resolve() -> str:
        target = (PROJECT_DIR / path).resolve()
        if not target.is_relative_to(PROJECT_DIR):
            raise HTTPException(status_code=403, detail="Path escapes project directory")
        if not target.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        return str(target)

    abs_path = await asyncio.to_thread(_resolve)
    return {"path": path, "abs_path": abs_path}


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
    tool_calls: dict[str, ToolCallInfo] = {}
    tool_call_order: list[str] = []
    grounding_sources: list[dict] = []

    async for event in r.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        grounding_sources.extend(_grounding_sources(event))
        if not event.content:
            continue
        for part in event.content.parts:
            if getattr(part, "function_call", None):
                fc = part.function_call
                call_id = fc.id or fc.name
                tool_calls[call_id] = ToolCallInfo(id=call_id, name=fc.name, args=dict(fc.args or {}))
                tool_call_order.append(call_id)
                logger.info("tool_call: %s(%s)", fc.name, dict(fc.args or {}))
            if getattr(part, "function_response", None):
                fr = part.function_response
                call_id = fr.id or fr.name
                if call_id in tool_calls:
                    tool_calls[call_id].result = fr.response
                logger.info("tool_result: %s -> %s", fr.name, fr.response)
        if event.is_final_response():
            for part in event.content.parts:
                if part.text:
                    response_parts.append(part.text)

    if grounding_sources:
        await _enrich_source_titles(grounding_sources)

    response_text = "\n".join(response_parts)
    ordered_tool_calls = [tool_calls[cid] for cid in tool_call_order]
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

    update = {
        "name": project_name,
        "updated_at": _now(),
        "session_id": session_id,
    }
    if grounding_sources:
        update["sources"] = _merge_sources(project.get("sources") or [], grounding_sources)
    await doc_ref.update(update)

    return ProjectChatResponse(
        response=response_text, project_name=project_name, tool_calls=ordered_tool_calls
    )


# -----------------------------------------------------------------------------
# Printer camera monitoring (Gemma via Ollama)
# -----------------------------------------------------------------------------


@app.post("/vision/monitor")
async def vision_monitor() -> dict:
    """Grab a live frame from the printer camera and classify bed/print
    state. Polled by the frontend's Printer Camera tab every ~1 minute."""
    result = await vision_worker.analyze_printer_frame()
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
