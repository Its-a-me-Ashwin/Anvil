"""Firestore-backed project state adapter.

Stores project metadata, inventory, constraints, objectives (progress),
decisions, data sources, and artifacts in Google Cloud Firestore. Uses
`GOOGLE_CLOUD_PROJECT` for the GCP project and honors `FIRESTORE_EMULATOR_HOST`
for local testing.

Every entity type that can be created can also be updated/toggled and
removed — the agent should be able to correct its own earlier state, not
just append to it. "objectives" here means the Progress checklist (each has
a status of open/done, toggleable both ways); the project's own single goal
statement is a separate top-level field via set_project_objective, matching
the "Objective" panel in the UI which is one paragraph, not a list.
"""

import io
import os
import re
import uuid
from datetime import datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv
from google.cloud import firestore
from pypdf import PdfReader

from adapters.datasheet.adapter import find_datasheet, looks_electronic

_MAX_DOCUMENT_CHARS = 20000

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _project_id() -> str:
    project_id = os.environ.get("GOOGLE_CLOUD_PROJECT")
    if not project_id:
        raise RuntimeError(
            "GOOGLE_CLOUD_PROJECT is not set. Add it to backend/.env, e.g.:\n"
            "GOOGLE_CLOUD_PROJECT=your-gcp-project-id\n"
            "For local testing, set FIRESTORE_EMULATOR_HOST=localhost:8200."
        )
    return project_id


def _db() -> firestore.Client:
    return firestore.Client(project=_project_id())


def _now() -> str:
    return datetime.utcnow().isoformat()


def _project_ref(project_id: str):
    return _db().collection("projects").document(project_id)


def _subcollection(project_id: str, name: str):
    return _project_ref(project_id).collection(name)


# ---------------------------------------------------------------------------
# Objective — the project's single goal statement (top of the left panel)
# ---------------------------------------------------------------------------

def set_project_objective(project_id: str, text: str, priority: str | None = None) -> dict:
    """Set (or replace) the project's single objective statement and an
    optional short priority tag (e.g. 'Compact', 'Low cost')."""
    data = {"objective": text, "objective_priority": priority, "objective_updated_at": _now()}
    _project_ref(project_id).set(data, merge=True)
    return data


def read_project_objective(project_id: str) -> dict:
    doc = _project_ref(project_id).get()
    data = doc.to_dict() or {}
    return {
        "objective": data.get("objective"),
        "objective_priority": data.get("objective_priority"),
    }


# ---------------------------------------------------------------------------
# Inventory
# ---------------------------------------------------------------------------

async def add_inventory_item(
    project_id: str, name: str, quantity: int, status: str = "available"
) -> dict:
    """Add a new inventory item. status is a free-form label, e.g.
    'available', 'low', 'needed'. If name looks like a specific electronics
    part (has a model number, e.g. 'BME280' or a motor/sensor/module name),
    this also searches Adafruit's Learn system for its datasheet and
    records it as a data source automatically — no separate step needed.
    The returned 'datasheet' field is that result (title/url), or null if
    none was found; mention it in your reply if present."""
    ref = _subcollection(project_id, "inventory").document()
    data = {
        "name": name,
        "quantity": quantity,
        "status": status,
        "created_at": _now(),
        "updated_at": _now(),
    }
    ref.set(data)

    datasheet = None
    if looks_electronic(name):
        try:
            datasheet = await find_datasheet(name)
            if datasheet:
                add_data_source(project_id, title=f"{name} Datasheet (Adafruit)", url=datasheet["url"], type="pdf")
        except Exception:
            datasheet = None  # best-effort enrichment; never fail the inventory add over this

    return {"id": ref.id, **data, "datasheet": datasheet}


def read_inventory(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "inventory").stream()
    ]


def update_inventory(project_id: str, item_id: str, updates: dict) -> dict:
    """Patch an existing inventory item (or create it at that id if it
    doesn't exist yet — upsert, so this never fails on a stale id)."""
    doc = _subcollection(project_id, "inventory").document(item_id)
    data = {**updates, "updated_at": _now()}
    doc.set(data, merge=True)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


def remove_inventory_item(project_id: str, item_id: str) -> dict:
    _subcollection(project_id, "inventory").document(item_id).delete()
    return {"id": item_id, "removed": True}


# ---------------------------------------------------------------------------
# Constraints
# ---------------------------------------------------------------------------

def add_constraint(project_id: str, text: str, locked: bool = False) -> dict:
    ref = _subcollection(project_id, "constraints").document()
    data = {
        "text": text,
        "locked": locked,
        "source": "agent",
        "created_at": _now(),
    }
    ref.set(data)
    return {"id": ref.id, **data}


def read_constraints(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "constraints").stream()
    ]


def update_constraint(
    project_id: str, constraint_id: str, text: str | None = None, locked: bool | None = None
) -> dict:
    """Edit a constraint's text and/or toggle its locked/flexible state.
    Pass only the field(s) that change."""
    updates: dict = {"updated_at": _now()}
    if text is not None:
        updates["text"] = text
    if locked is not None:
        updates["locked"] = locked
    doc = _subcollection(project_id, "constraints").document(constraint_id)
    doc.update(updates)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


def remove_constraint(project_id: str, constraint_id: str) -> dict:
    _subcollection(project_id, "constraints").document(constraint_id).delete()
    return {"id": constraint_id, "removed": True}


# ---------------------------------------------------------------------------
# Objectives (the Progress checklist) — status is toggleable both ways
# ---------------------------------------------------------------------------

def add_objective(project_id: str, title: str) -> dict:
    ref = _subcollection(project_id, "objectives").document()
    data = {
        "title": title,
        "status": "open",
        "assigned_tool": None,
        "created_at": _now(),
        "completed_at": None,
    }
    ref.set(data)
    return {"id": ref.id, **data}


def read_objectives(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "objectives").stream()
    ]


def mark_objective_done(project_id: str, objective_id: str) -> dict:
    doc = _subcollection(project_id, "objectives").document(objective_id)
    data = {"status": "done", "completed_at": _now()}
    doc.update(data)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


def mark_objective_undone(project_id: str, objective_id: str) -> dict:
    """Uncheck a previously completed objective — sets it back to open."""
    doc = _subcollection(project_id, "objectives").document(objective_id)
    data = {"status": "open", "completed_at": None}
    doc.update(data)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


def remove_objective(project_id: str, objective_id: str) -> dict:
    _subcollection(project_id, "objectives").document(objective_id).delete()
    return {"id": objective_id, "removed": True}


# ---------------------------------------------------------------------------
# Data sources — the agent can populate these from its own knowledge (title
# + link), no fetching/verification required. Lives in the project doc's
# `sources` array field, not a subcollection — the same field Google Search
# grounding writes to (see server.py's _merge_sources) and the one the Data
# Sources panel actually renders, so anything added here shows up right
# alongside grounding hits instead of a separate, invisible store. Deduped
# by url, its only stable identifier (there's no separate id field).
# ---------------------------------------------------------------------------

def add_data_source(project_id: str, title: str, url: str, type: str = "link") -> dict:
    """Add a reference data source. type is a free-form label the UI can
    badge, e.g. 'pdf', 'youtube', 'web'. No-ops (returns the existing entry)
    if a source with this exact url is already recorded."""
    ref = _project_ref(project_id)
    existing = (ref.get().to_dict() or {}).get("sources", [])
    match = next((s for s in existing if s.get("url") == url), None)
    if match:
        return match
    source = {"type": type, "title": title, "url": url, "added_at": _now(), "domain": None}
    ref.set({"sources": existing + [source], "updated_at": _now()}, merge=True)
    return source


def read_data_sources(project_id: str) -> list[dict]:
    doc = _project_ref(project_id).get()
    return (doc.to_dict() or {}).get("sources", [])


def remove_data_source(project_id: str, url: str) -> dict:
    """Remove a data source by its url — the only stable identifier a
    source has."""
    ref = _project_ref(project_id)
    existing = (ref.get().to_dict() or {}).get("sources", [])
    remaining = [s for s in existing if s.get("url") != url]
    ref.set({"sources": remaining, "updated_at": _now()}, merge=True)
    return {"url": url, "removed": True}


def list_documents(project_id: str) -> list[dict]:
    """List the project's data sources (title, url, type) — check this
    before answering a question that might be covered by one of them. If
    nothing here looks relevant enough, search the web instead."""
    return read_data_sources(project_id)


def read_document(url: str) -> dict:
    """Fetch a document's actual text content by its url (from
    list_documents) so you can answer using what it really says, not just
    its title. Works for PDFs and plain web pages. Long documents are
    truncated (see 'truncated')."""
    if not url.lower().startswith(("http://", "https://")):
        raise ValueError("Only http(s) URLs are supported")

    resp = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20.0, follow_redirects=True)
    resp.raise_for_status()

    if "pdf" in resp.headers.get("content-type", "").lower() or url.lower().split("?")[0].endswith(".pdf"):
        reader = PdfReader(io.BytesIO(resp.content))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = re.sub(r"<[^>]+>", " ", resp.text)

    text = re.sub(r"\s+", " ", text).strip()
    return {
        "url": url,
        "text": text[:_MAX_DOCUMENT_CHARS],
        "truncated": len(text) > _MAX_DOCUMENT_CHARS,
    }


# ---------------------------------------------------------------------------
# Skills — the agent's running read on the user's own experience level, for
# the Memory tab's skill radar chart. Categories are a fixed set (not
# agent-invented) so the chart's axes stay stable across projects; each
# category is one Firestore doc holding a 1-5 level plus a growing list of
# short, specific observations behind that level.
# ---------------------------------------------------------------------------

SKILL_CATEGORIES = (
    "CAD & Mechanical Design",
    "Electronics & Circuits",
    "Firmware & Embedded Coding",
    "Software & Web Development",
    "3D Printing & Manufacturing",
)


def _skill_slug(category: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", category.lower()).strip("_")


def _validate_skill_category(category: str) -> None:
    if category not in SKILL_CATEGORIES:
        raise ValueError(f"category must be one of {list(SKILL_CATEGORIES)}, got {category!r}")


def record_skill_observation(project_id: str, category: str, statement: str) -> dict:
    """Append a short, specific observation about the user's experience in
    one fixed skill category (see SKILL_CATEGORIES) — e.g. 'Familiar with
    Arduino boards but hasn't worked with I2C sensors yet.' Never overwrites
    prior observations in that category; call remove_skill_statement if one
    becomes stale or turns out wrong. Call this whenever the conversation
    reveals something specific about the user's background, the same way
    you'd call add_constraint for a requirement."""
    _validate_skill_category(category)
    doc = _subcollection(project_id, "skills").document(_skill_slug(category))
    data = doc.get().to_dict() or {"category": category, "level": 0, "statements": []}
    data["category"] = category
    data["statements"] = [
        *data.get("statements", []),
        {"id": uuid.uuid4().hex, "text": statement, "created_at": _now()},
    ]
    data["updated_at"] = _now()
    doc.set(data)
    return {"id": doc.id, **data}


def set_skill_level(project_id: str, category: str, level: int) -> dict:
    """Set the user's overall proficiency in one fixed skill category on a
    1-5 scale (1=novice, 2=beginner, 3=intermediate, 4=advanced, 5=expert)
    for the Memory tab's skill radar chart. Always overwrites the previous
    level for that category rather than averaging with it — re-call this
    whenever your read on the user's skill there changes."""
    _validate_skill_category(category)
    if not 1 <= level <= 5:
        raise ValueError(f"level must be between 1 and 5, got {level}")
    doc = _subcollection(project_id, "skills").document(_skill_slug(category))
    data = doc.get().to_dict() or {"category": category, "statements": []}
    data["category"] = category
    data["level"] = level
    data["updated_at"] = _now()
    doc.set(data)
    return {"id": doc.id, **data}


def read_skills(project_id: str) -> list[dict]:
    """All recorded skill categories: level (1-5) and the specific
    observations behind it, for the Memory tab's skill radar chart."""
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "skills").stream()
    ]


def remove_skill_statement(project_id: str, category: str, statement_id: str) -> dict:
    """Delete one specific observation from a skill category (e.g. it turned
    out to be wrong or no longer applies) without touching that category's
    level or its other statements."""
    _validate_skill_category(category)
    doc = _subcollection(project_id, "skills").document(_skill_slug(category))
    data = doc.get().to_dict()
    if not data:
        raise KeyError(f"No skill category {category!r} recorded for project {project_id!r}")
    data["statements"] = [s for s in data.get("statements", []) if s.get("id") != statement_id]
    data["updated_at"] = _now()
    doc.set(data)
    return {"id": doc.id, **data}


# ---------------------------------------------------------------------------
# Decisions
# ---------------------------------------------------------------------------

def record_decision(
    project_id: str, summary: str, requires_approval: bool = False
) -> dict:
    ref = _subcollection(project_id, "decisions").document()
    data = {
        "summary": summary,
        "requires_approval": requires_approval,
        "approved": not requires_approval,
        "approved_by": None,
        "approved_at": None,
        "created_at": _now(),
    }
    ref.set(data)
    return {"id": ref.id, **data}


def approve_decision(project_id: str, decision_id: str, approved_by: str = "agent") -> dict:
    doc = _subcollection(project_id, "decisions").document(decision_id)
    data = {
        "approved": True,
        "approved_by": approved_by,
        "approved_at": _now(),
    }
    doc.update(data)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


def read_decisions(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "decisions").stream()
    ]


# ---------------------------------------------------------------------------
# Summary — everything the left panel needs in one call
# ---------------------------------------------------------------------------

def read_project_summary(project_id: str) -> dict:
    """Return the objective, constraints, inventory, objectives (progress),
    decisions, data sources, skills, and artifacts for a project."""
    objective = read_project_objective(project_id)
    return {
        "project_id": project_id,
        **objective,
        "constraints": read_constraints(project_id),
        "inventory": read_inventory(project_id),
        "objectives": read_objectives(project_id),
        "decisions": read_decisions(project_id),
        "data_sources": read_data_sources(project_id),
        "skills": read_skills(project_id),
        "artifacts": [
            {"id": d.id, **d.to_dict()}
            for d in _subcollection(project_id, "artifacts").stream()
        ],
    }
