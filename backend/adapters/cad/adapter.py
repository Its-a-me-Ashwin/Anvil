"""CAD adapter — custom, backed by build123d (not MCP).

No external server, no API key, no daemon: build123d is a pure-Python
parametric BREP library (Apache-2.0, built on OpenCascade) that runs
in-process. Chosen over FreeCAD-MCP (needs Docker running as a container
host) and Zoo's Engine API (paid, cloud, needs an API key) for zero extra
moving parts during a demo.

Each function below is a thin wrapper around one adapters.cad.assembly.Assembly
method, operating on a named `project` so multiple assemblies can coexist.
This is the exact function set exposed to the agent — see registry.py for
scope. Gears are deliberately NOT a primitive here: build123d has no native
gear generator, and involute tooth geometry is exactly the kind of
easy-to-get-subtly-wrong math that should be one hand-verified function
later, not something composed turn-by-turn from these primitives.
"""

from adapters.cad.assembly import Assembly


def add_box(
    project: str, name: str, length: float, width: float, height: float,
    position: tuple = (0, 0, 0), rotation: tuple = (0, 0, 0),
) -> None:
    Assembly(project).add_part(name, "box", {"length": length, "width": width, "height": height}, position, rotation)


def add_cylinder(
    project: str, name: str, radius: float, height: float,
    position: tuple = (0, 0, 0), rotation: tuple = (0, 0, 0),
) -> None:
    Assembly(project).add_part(name, "cylinder", {"radius": radius, "height": height}, position, rotation)


def add_tube(
    project: str, name: str, outer_radius: float, inner_radius: float, height: float,
    position: tuple = (0, 0, 0), rotation: tuple = (0, 0, 0),
) -> None:
    """A hollow cylinder — e.g. a bearing housing (outer_radius = housing OD/2,
    inner_radius = bearing OD/2)."""
    Assembly(project).add_part(
        name, "tube",
        {"outer_radius": outer_radius, "inner_radius": inner_radius, "height": height},
        position, rotation,
    )


def add_sphere(
    project: str, name: str, radius: float,
    position: tuple = (0, 0, 0), rotation: tuple = (0, 0, 0),
) -> None:
    Assembly(project).add_part(name, "sphere", {"radius": radius}, position, rotation)


def add_cone(
    project: str, name: str, bottom_radius: float, top_radius: float, height: float,
    position: tuple = (0, 0, 0), rotation: tuple = (0, 0, 0),
) -> None:
    Assembly(project).add_part(
        name, "cone",
        {"bottom_radius": bottom_radius, "top_radius": top_radius, "height": height},
        position, rotation,
    )


def position_part(project: str, name: str, position: tuple = None, rotation: tuple = None) -> None:
    """Move and/or rotate an existing part. Pass only what changes."""
    Assembly(project).position_part(name, position, rotation)


def remove_part(project: str, name: str) -> None:
    Assembly(project).remove_part(name)


def boolean_op(project: str, op: str, part_a: str, part_b: str, result_name: str) -> None:
    """Combine two existing parts into one new part; op is 'union', 'cut'
    (part_a minus part_b), or 'intersect'. Both source parts are consumed —
    only result_name exists afterward."""
    Assembly(project).boolean_op(op, part_a, part_b, result_name)


def fillet_part(project: str, name: str, radius: float) -> None:
    """Round all edges of a part by radius — common for real-world
    manufacturability (avoiding sharp internal corners)."""
    Assembly(project).fillet_part(name, radius)


def chamfer_part(project: str, name: str, length: float) -> None:
    """Bevel (flat-cut, not rounded) all edges of a part by length — e.g.
    easing a sharp edge for safe handling, or a lead-in chamfer on a hole
    or shaft for easier assembly. Use fillet_part instead for a rounded
    edge; the two are not interchangeable for a manufacturing spec."""
    Assembly(project).chamfer_part(name, length)


def drill_hole(
    project: str, part_name: str, radius: float, depth: float,
    position: tuple = (0, 0, 0), axis: str = "z",
) -> None:
    """Cut a round hole through or into an existing part — a mounting hole,
    a shaft bore, a wire pass-through, a countersink. Always prefer this
    over composing boolean_op(cut) with a hand-built cylinder: it builds and
    aligns the cutting cylinder for you along `axis` ('x', 'y', or 'z')
    through `position`, and the part keeps its original name afterward.
    `position` is the hole's center point (same centered convention as
    add_cylinder/add_box/etc.) — set depth a bit larger than the part's own
    thickness along that axis for a clean through-cut, not just equal to it."""
    asm = Assembly(project)
    axis_rotation = {"x": (0, 90, 0), "y": (-90, 0, 0), "z": (0, 0, 0)}
    if axis not in axis_rotation:
        raise ValueError(f"axis must be 'x', 'y', or 'z', got {axis!r}")
    hole_name = f"__hole_{part_name}_{len(asm.parts)}"
    asm.add_part(hole_name, "cylinder", {"radius": radius, "height": depth}, position, axis_rotation[axis])
    asm.boolean_op("cut", part_name, hole_name, part_name)


def list_parts(project: str) -> list:
    return Assembly(project).list_parts()


def get_part_info(project: str, name: str) -> dict:
    """Volume and bounding box for one part — lets the agent check a design
    still fits its constraints without a full export."""
    return Assembly(project).get_part_info(name)


def export_assembly(project: str, fmt: str = "gltf") -> dict:
    """Export the whole assembly to a file. fmt is 'gltf' (for a web/three.js
    viewer), 'step' (CAD interchange, preserves part identity), or 'stl'
    (widely supported, but flattens everything into one mesh)."""
    return Assembly(project).export(fmt)
