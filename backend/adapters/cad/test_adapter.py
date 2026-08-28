"""Standalone proof that every CAD tool works — no agent, no ADK, no Gemini.

Run:
    python -m adapters.cad.test_adapter

No MCP server, no subprocess — build123d and the Assembly state run
in-process, so this calls each tool function directly. Builds a small
multi-part mock-up (housing + shaft + a bracket with a bolted-on hole)
exercising every shape primitive, positioning, boolean ops, fillet,
inspection, and all three export formats — then checks a boundary case for
every tool that has an obvious way to be misused.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.cad import adapter as cad
from adapters.cad.assembly import ASSEMBLIES_DIR
from adapters.registry import get_adapter

PROJECT = "test_gearbox"


def cleanup() -> None:
    for ext in ("json", "gltf", "bin", "step", "stl"):
        p = ASSEMBLIES_DIR / f"{PROJECT}.{ext}"
        if p.exists():
            p.unlink()


def main() -> None:
    adapter = get_adapter("cad")
    print(f"Allowed functions: {adapter.scope}")
    cleanup()  # in case a previous run crashed mid-way

    print("\n-- add_tube(housing) --")
    cad.add_tube(PROJECT, "housing", outer_radius=21, inner_radius=11, height=15)
    print("OK")

    print("\n-- add_cylinder(shaft) --")
    cad.add_cylinder(PROJECT, "shaft", radius=4, height=40, position=(0, 0, -10))
    print("OK")

    print("\n-- add_box(bracket) --")
    cad.add_box(PROJECT, "bracket", length=30, width=10, height=5, position=(40, 0, 0))
    print("OK")

    print("\n-- add_sphere / add_cone (shape coverage) --")
    cad.add_sphere(PROJECT, "marker", radius=2, position=(0, 0, 30))
    cad.add_cone(PROJECT, "pointer", bottom_radius=5, top_radius=0, height=8, position=(0, 0, 40))
    print("OK")

    print("\n-- boolean_op: cut a bolt hole into the bracket --")
    cad.add_cylinder(PROJECT, "bolt_hole", radius=1.5, height=10, position=(40, 3, 0))
    cad.boolean_op(PROJECT, "cut", "bracket", "bolt_hole", "bracket")
    parts = {p["name"] for p in cad.list_parts(PROJECT)}
    assert "bolt_hole" not in parts, "boolean_op should have consumed bolt_hole"
    assert "bracket" in parts
    print("OK — bracket now has a hole, bolt_hole consumed")

    print("\n-- fillet_part(bracket) --")
    cad.fillet_part(PROJECT, "bracket", radius=0.2)
    print("OK")

    print("\n-- chamfer_part(test_block) — fresh part, avoids interacting with bracket's existing fillet --")
    cad.add_box(PROJECT, "test_block", length=20, width=20, height=20, position=(100, 0, 0))
    before = cad.get_part_info(PROJECT, "test_block")["volume_mm3"]
    cad.chamfer_part(PROJECT, "test_block", length=2.0)
    after = cad.get_part_info(PROJECT, "test_block")["volume_mm3"]
    assert after < before, "chamfering should remove material"
    print(f"OK — volume {before:.1f} -> {after:.1f}")

    print("\n-- drill_hole(test_block, axis='x') — sideways hole --")
    before = after
    cad.drill_hole(PROJECT, "test_block", radius=2, depth=25, position=(100, 0, 0), axis="x")
    parts = {p["name"] for p in cad.list_parts(PROJECT)}
    assert "test_block" in parts, "drill_hole should keep the part's original name"
    assert not any(n.startswith("__hole_") for n in parts), "drill_hole should not leak its scratch cylinder"
    after = cad.get_part_info(PROJECT, "test_block")["volume_mm3"]
    assert after < before, "drilling should remove material"
    print(f"OK — volume {before:.1f} -> {after:.1f}")
    cad.remove_part(PROJECT, "test_block")

    print("\n-- position_part(shaft) --")
    cad.position_part(PROJECT, "shaft", position=(0, 0, -15))
    print("OK")

    print("\n-- list_parts --")
    parts = cad.list_parts(PROJECT)
    for p in parts:
        print(f"  {p['name']:10s} shape={p['shape']:8s} pos={p['position']}")
    assert {p["name"] for p in parts} == {"housing", "shaft", "bracket", "marker", "pointer"}

    print("\n-- get_part_info(housing) --")
    info = cad.get_part_info(PROJECT, "housing")
    print(info)
    expected_volume = 3.14159265 * (21**2 - 11**2) * 15
    assert abs(info["volume_mm3"] - expected_volume) < 1.0

    print("\n-- remove_part(marker) --")
    cad.remove_part(PROJECT, "marker")
    assert "marker" not in {p["name"] for p in cad.list_parts(PROJECT)}
    print("OK")

    for fmt in ("gltf", "step", "stl"):
        print(f"\n-- export_assembly(fmt={fmt!r}) --")
        result = cad.export_assembly(PROJECT, fmt=fmt)
        print(result)
        out_path = Path(result["path"])
        assert out_path.exists() and out_path.stat().st_size > 0
        assert result["part_count"] == 4

    print("\n-- boundary check: fillet radius too large for the geometry should raise --")
    try:
        cad.fillet_part(PROJECT, "bracket", radius=5.0)
        raise AssertionError("expected ValueError")
    except ValueError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: drill_hole with an invalid axis should raise --")
    try:
        cad.drill_hole(PROJECT, "housing", radius=1, depth=5, axis="w")
        raise AssertionError("expected ValueError")
    except ValueError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: inner_radius >= outer_radius should raise --")
    try:
        cad.add_tube(PROJECT, "bad_tube", outer_radius=10, inner_radius=10, height=5)
        raise AssertionError("expected ValueError")
    except ValueError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: duplicate part name should raise --")
    try:
        cad.add_box(PROJECT, "housing", length=1, width=1, height=1)
        raise AssertionError("expected ValueError")
    except ValueError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: removing a nonexistent part should raise --")
    try:
        cad.remove_part(PROJECT, "does_not_exist")
        raise AssertionError("expected KeyError")
    except KeyError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: boolean_op with a missing part should raise --")
    try:
        cad.boolean_op(PROJECT, "union", "housing", "does_not_exist", "combined")
        raise AssertionError("expected KeyError")
    except KeyError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: unknown export format should raise --")
    try:
        cad.export_assembly(PROJECT, fmt="obj")
        raise AssertionError("expected ValueError")
    except ValueError as e:
        print(f"OK — rejected: {e}")

    print("\n-- boundary check: exporting an empty project should raise --")
    try:
        cad.export_assembly("empty_project_that_should_not_exist", fmt="gltf")
        raise AssertionError("expected ValueError")
    except ValueError as e:
        print(f"OK — rejected: {e}")

    cleanup()
    print("\nAll CAD tools verified working end to end.")


if __name__ == "__main__":
    main()
