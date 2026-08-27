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

import os
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from google.cloud import firestore

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

def add_inventory_item(
    project_id: str, name: str, quantity: int, status: str = "available"
) -> dict:
    """Add a new inventory item. status is a free-form label, e.g.
    'available', 'low', 'needed'."""
    ref = _subcollection(project_id, "inventory").document()
    data = {
        "name": name,
        "quantity": quantity,
        "status": status,
        "created_at": _now(),
        "updated_at": _now(),
    }
    ref.set(data)
    return {"id": ref.id, **data}


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
# Data sources — the agent can populate these from its own knowledge
# (title + link), no fetching/verification required.
# ---------------------------------------------------------------------------

def add_data_source(project_id: str, title: str, url: str, type: str = "link") -> dict:
    """Add a reference data source. type is a free-form label the UI can
    badge, e.g. 'PDF', 'YouTube', 'CAD', 'Repo', 'link'."""
    ref = _subcollection(project_id, "data_sources").document()
    data = {
        "title": title,
        "url": url,
        "type": type,
        "source": "agent",
        "created_at": _now(),
    }
    ref.set(data)
    return {"id": ref.id, **data}


def read_data_sources(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "data_sources").stream()
    ]


def remove_data_source(project_id: str, source_id: str) -> dict:
    _subcollection(project_id, "data_sources").document(source_id).delete()
    return {"id": source_id, "removed": True}


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
    decisions, data sources, and artifacts for a project."""
    objective = read_project_objective(project_id)
    return {
        "project_id": project_id,
        **objective,
        "constraints": read_constraints(project_id),
        "inventory": read_inventory(project_id),
        "objectives": read_objectives(project_id),
        "decisions": read_decisions(project_id),
        "data_sources": read_data_sources(project_id),
        "artifacts": [
            {"id": d.id, **d.to_dict()}
            for d in _subcollection(project_id, "artifacts").stream()
        ],
    }
