"""Standalone proof that the state adapter works.

Requires either a real GCP project (GOOGLE_CLOUD_PROJECT) or the Firestore
emulator (FIRESTORE_EMULATOR_HOST). Without either, the test skips cleanly.
"""

import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.state.adapter import (
    add_constraint,
    add_objective,
    approve_decision,
    mark_objective_done,
    read_constraints,
    read_decisions,
    read_inventory,
    read_objectives,
    read_project_summary,
    record_decision,
    update_inventory,
)


def _has_env() -> bool:
    return bool(os.environ.get("GOOGLE_CLOUD_PROJECT")) or bool(
        os.environ.get("FIRESTORE_EMULATOR_HOST")
    )


def _project_id() -> str:
    return os.environ.get("GOOGLE_CLOUD_PROJECT", "test-project")


def main():
    if not _has_env():
        print("SKIP: state adapter test requires GOOGLE_CLOUD_PROJECT or FIRESTORE_EMULATOR_HOST.")
        print("Set one in backend/.env and run again.")
        sys.exit(0)

    project = _project_id()
    created = {
        "inventory": [],
        "constraints": [],
        "objectives": [],
        "decisions": [],
    }

    try:
        print("-- update_inventory --")
        item_id = f"item-{uuid.uuid4().hex[:8]}"
        result = update_inventory(
            project,
            item_id,
            {"name": "M3 bolt", "quantity": 10, "status": "needed"},
        )
        created["inventory"].append(item_id)
        assert result["name"] == "M3 bolt"
        assert result["quantity"] == 10
        print(result)

        print("\n-- read_inventory --")
        inventory = read_inventory(project)
        assert any(i["id"] == item_id for i in inventory)
        print(f"{len(inventory)} item(s)")

        print("\n-- add_constraint --")
        result = add_constraint(project, "Max budget is $100", locked=True)
        constraint_id = result["id"]
        created["constraints"].append(constraint_id)
        assert result["text"] == "Max budget is $100"
        assert result["locked"] is True
        print(result)

        print("\n-- read_constraints --")
        constraints = read_constraints(project)
        assert any(c["text"] == "Max budget is $100" for c in constraints)
        print(f"{len(constraints)} constraint(s)")

        print("\n-- add_objective --")
        result = add_objective(project, "Finish the frame design")
        objective_id = result["id"]
        created["objectives"].append(objective_id)
        assert result["status"] == "open"
        print(result)

        print("\n-- mark_objective_done --")
        done = mark_objective_done(project, objective_id)
        assert done["status"] == "done"
        assert done["completed_at"] is not None
        print(done)

        print("\n-- read_objectives --")
        objectives = read_objectives(project)
        assert any(o["title"] == "Finish the frame design" for o in objectives)
        print(f"{len(objectives)} objective(s)")

        print("\n-- record_decision (requires approval) --")
        result = record_decision(project, "Use PLA for prototype", requires_approval=True)
        decision_id = result["id"]
        created["decisions"].append(decision_id)
        assert result["requires_approval"] is True
        assert result["approved"] is False
        print(result)

        print("\n-- approve_decision --")
        approved = approve_decision(project, decision_id, approved_by="tester")
        assert approved["approved"] is True
        assert approved["approved_by"] == "tester"
        print(approved)

        print("\n-- record_decision (auto-approved) --")
        auto = record_decision(project, "Use 3MF for export")
        created["decisions"].append(auto["id"])
        assert auto["approved"] is True
        print(auto)

        print("\n-- read_decisions --")
        decisions = read_decisions(project)
        assert any(d["summary"] == "Use PLA for prototype" for d in decisions)
        print(f"{len(decisions)} decision(s)")

        print("\n-- read_project_summary --")
        summary = read_project_summary(project)
        assert "project_id" in summary
        assert "constraints" in summary
        assert "inventory" in summary
        assert "objectives" in summary
        assert "decisions" in summary
        assert "artifacts" in summary
        print({k: len(v) if isinstance(v, list) else v for k, v in summary.items()})

    finally:
        from adapters.state.adapter import _subcollection
        for collection, ids in created.items():
            for doc_id in ids:
                try:
                    _subcollection(project, collection).document(doc_id).delete()
                except Exception:
                    pass
        try:
            _subcollection(project, "inventory").document("nonexistent-test-cleanup").delete()
        except Exception:
            pass

    print("\nAll state adapter checks passed.")


if __name__ == "__main__":
    main()
