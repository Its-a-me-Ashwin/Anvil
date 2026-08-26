"""Firestore-backed project state adapter.

Stores project metadata, inventory, constraints, objectives, decisions,
and artifacts in Google Cloud Firestore. Uses `GOOGLE_CLOUD_PROJECT` for the
GCP project and honors `FIRESTORE_EMULATOR_HOST` for local testing.
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
            "For local testing, set FIRESTORE_EMULATOR_HOST=localhost:8080."
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


def read_project_summary(project_id: str) -> dict:
    """Return constraints, inventory, objectives, decisions, and artifacts."""
    return {
        "project_id": project_id,
        "constraints": read_constraints(project_id),
        "inventory": read_inventory(project_id),
        "objectives": read_objectives(project_id),
        "decisions": read_decisions(project_id),
        "artifacts": [
            {"id": d.id, **d.to_dict()}
            for d in _subcollection(project_id, "artifacts").stream()
        ],
    }


def read_inventory(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "inventory").stream()
    ]


def update_inventory(project_id: str, item_id: str, updates: dict) -> dict:
    doc = _subcollection(project_id, "inventory").document(item_id)
    data = {**updates, "updated_at": _now()}
    doc.update(data)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


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


def mark_objective_done(project_id: str, objective_id: str) -> dict:
    doc = _subcollection(project_id, "objectives").document(objective_id)
    data = {"status": "done", "completed_at": _now()}
    doc.update(data)
    snapshot = doc.get()
    return {"id": snapshot.id, **snapshot.to_dict()}


def read_objectives(project_id: str) -> list[dict]:
    return [
        {"id": d.id, **d.to_dict()}
        for d in _subcollection(project_id, "objectives").stream()
    ]


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
