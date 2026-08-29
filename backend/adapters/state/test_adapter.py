"""Standalone proof that every state tool works — no agent, no ADK, no Gemini.

Requires either a real GCP project (GOOGLE_CLOUD_PROJECT) or the Firestore
emulator (FIRESTORE_EMULATOR_HOST). Without either, the test skips cleanly.
Exercises the full add/read/update-or-toggle/remove lifecycle for every
entity type: objective, inventory, constraints, objectives (progress),
data sources, and decisions.
"""

import asyncio
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.state.adapter import (
    add_constraint,
    add_data_source,
    add_inventory_item,
    add_objective,
    approve_decision,
    mark_objective_done,
    mark_objective_undone,
    read_constraints,
    read_data_sources,
    read_decisions,
    read_inventory,
    read_objectives,
    read_project_objective,
    read_project_summary,
    record_decision,
    remove_constraint,
    remove_data_source,
    remove_inventory_item,
    remove_objective,
    set_project_objective,
    update_constraint,
    update_inventory,
)


def _has_env() -> bool:
    return bool(os.environ.get("GOOGLE_CLOUD_PROJECT")) or bool(
        os.environ.get("FIRESTORE_EMULATOR_HOST")
    )


def _project_id() -> str:
    return os.environ.get("GOOGLE_CLOUD_PROJECT", "test-project")


async def main():
    if not _has_env():
        print("SKIP: state adapter test requires GOOGLE_CLOUD_PROJECT or FIRESTORE_EMULATOR_HOST.")
        print("Set one in backend/.env and run again.")
        sys.exit(0)

    project = f"test-{uuid.uuid4().hex[:8]}"

    try:
        # -- Objective ------------------------------------------------------
        print("-- set_project_objective --")
        obj = set_project_objective(project, "Build a compact ~10:1 reduction actuator", priority="Compact")
        assert obj["objective"] == "Build a compact ~10:1 reduction actuator"
        print(obj)

        print("\n-- read_project_objective --")
        read_obj = read_project_objective(project)
        assert read_obj["objective_priority"] == "Compact"
        print(read_obj)

        print("\n-- set_project_objective (overwrite) --")
        obj2 = set_project_objective(project, "Revised objective", priority="Low cost")
        assert read_project_objective(project)["objective"] == "Revised objective"
        print(obj2)

        # -- Inventory --------------------------------------------------------
        print("\n-- add_inventory_item --")
        item = await add_inventory_item(project, "5010 BLDC Motor", quantity=1, status="available")
        item_id = item["id"]
        assert item["quantity"] == 1
        print(item)

        print("\n-- read_inventory --")
        inv = read_inventory(project)
        assert any(i["id"] == item_id for i in inv)
        print(f"{len(inv)} item(s)")

        print("\n-- update_inventory (toggle status) --")
        updated = update_inventory(project, item_id, {"status": "low", "quantity": 0})
        assert updated["status"] == "low" and updated["quantity"] == 0
        print(updated)

        print("\n-- update_inventory (upsert on missing id) --")
        upserted_id = f"item-{uuid.uuid4().hex[:8]}"
        upserted = update_inventory(project, upserted_id, {"name": "M3 Screws", "quantity": 12, "status": "available"})
        assert upserted["name"] == "M3 Screws"
        print(upserted)

        print("\n-- remove_inventory_item --")
        remove_inventory_item(project, upserted_id)
        assert not any(i["id"] == upserted_id for i in read_inventory(project))
        print("removed")

        # -- Constraints ------------------------------------------------------
        print("\n-- add_constraint --")
        c = add_constraint(project, "Outer diameter <= 85mm", locked=True)
        constraint_id = c["id"]
        assert c["locked"] is True
        print(c)

        print("\n-- update_constraint (toggle locked, edit text) --")
        c2 = update_constraint(project, constraint_id, locked=False)
        assert c2["locked"] is False
        c3 = update_constraint(project, constraint_id, text="Outer diameter <= 90mm")
        assert c3["text"] == "Outer diameter <= 90mm"
        print(c3)

        print("\n-- read_constraints --")
        constraints = read_constraints(project)
        assert any(x["id"] == constraint_id for x in constraints)
        print(f"{len(constraints)} constraint(s)")

        print("\n-- remove_constraint --")
        remove_constraint(project, constraint_id)
        assert not any(x["id"] == constraint_id for x in read_constraints(project))
        print("removed")

        # -- Objectives (Progress) --------------------------------------------
        print("\n-- add_objective --")
        o = add_objective(project, "CAD Design")
        objective_id = o["id"]
        assert o["status"] == "open"
        print(o)

        print("\n-- mark_objective_done (check) --")
        done = mark_objective_done(project, objective_id)
        assert done["status"] == "done" and done["completed_at"] is not None
        print(done)

        print("\n-- mark_objective_undone (uncheck) --")
        undone = mark_objective_undone(project, objective_id)
        assert undone["status"] == "open" and undone["completed_at"] is None
        print(undone)

        print("\n-- read_objectives --")
        objectives = read_objectives(project)
        assert any(x["id"] == objective_id for x in objectives)
        print(f"{len(objectives)} objective(s)")

        print("\n-- remove_objective --")
        remove_objective(project, objective_id)
        assert not any(x["id"] == objective_id for x in read_objectives(project))
        print("removed")

        # -- Data sources -------------------------------------------------------
        print("\n-- add_data_source --")
        ds = add_data_source(project, "AS5600 Datasheet", "https://ams.com/as5600", type="PDF")
        source_url = ds["url"]
        assert ds["type"] == "PDF"
        print(ds)

        print("\n-- read_data_sources --")
        sources = read_data_sources(project)
        assert any(x["url"] == source_url for x in sources)
        print(f"{len(sources)} source(s)")

        print("\n-- remove_data_source --")
        remove_data_source(project, source_url)
        assert not any(x["url"] == source_url for x in read_data_sources(project))
        print("removed")

        # -- Decisions ----------------------------------------------------------
        print("\n-- record_decision (requires approval) --")
        d = record_decision(project, "Use PLA for prototype", requires_approval=True)
        decision_id = d["id"]
        assert d["approved"] is False
        print(d)

        print("\n-- approve_decision --")
        approved = approve_decision(project, decision_id, approved_by="tester")
        assert approved["approved"] is True
        print(approved)

        print("\n-- read_decisions --")
        decisions = read_decisions(project)
        assert any(x["id"] == decision_id for x in decisions)
        print(f"{len(decisions)} decision(s)")

        # -- Summary -------------------------------------------------------------
        print("\n-- read_project_summary --")
        # Re-seed one of each so the summary isn't all-empty after cleanup above.
        add_constraint(project, "Motor: 5010 BLDC", locked=True)
        await add_inventory_item(project, "608 Bearing", quantity=4)
        add_objective(project, "Parts Sourcing")
        summary = read_project_summary(project)
        assert summary["objective"] == "Revised objective"
        assert summary["objective_priority"] == "Low cost"
        assert len(summary["constraints"]) == 1
        # The original "5010 BLDC Motor" item was only updated earlier, never
        # removed — plus the "608 Bearing" seeded just above, so 2, not 1.
        assert len(summary["inventory"]) == 2
        assert len(summary["objectives"]) == 1
        assert len(summary["decisions"]) == 1
        assert summary["data_sources"] == []
        print({k: len(v) if isinstance(v, list) else v for k, v in summary.items()})

        print("\nAll state adapter checks passed.")

    finally:
        # Best-effort cleanup of the whole throwaway test project.
        from adapters.state.adapter import _subcollection, _project_ref
        for collection in ("inventory", "constraints", "objectives", "decisions", "data_sources", "artifacts"):
            for doc in _subcollection(project, collection).stream():
                doc.reference.delete()
        _project_ref(project).delete()


if __name__ == "__main__":
    asyncio.run(main())
