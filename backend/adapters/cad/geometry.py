"""Pure geometry: turn a part-definition dict into a build123d Shape.

Part definitions are plain, JSON-serializable dicts so an entire assembly
can be persisted as one small file and rebuilt deterministically from
scratch every time — no BREP blobs on disk, easy to diff/version, matching
the CAD-as-code approach described in arch-spec.md.

A part definition looks like:
    {
        "name": "housing",
        "shape": "tube",              # box | cylinder | tube | sphere | cone | boolean | fillet
        "params": {...shape-specific...},
        "position": [x, y, z],
        "rotation": [rx, ry, rz],     # degrees, Euler
    }

"boolean" and "fillet" are composite shapes whose params embed other part
definitions (recursively), so combining or cleaning up parts is expressed
the same way as any other part rather than as a special case.
"""

from build123d import Box, Cone, Cylinder, Location, Sphere, fillet

_BOOLEAN_OPS = {
    "union": lambda a, b: a + b,
    "cut": lambda a, b: a - b,
    "intersect": lambda a, b: a & b,
}

SHAPE_TYPES = ("box", "cylinder", "tube", "sphere", "cone", "boolean", "fillet")


def build_shape(part: dict):
    """Recursively build a build123d Shape from a part definition dict."""
    shape_type = part["shape"]
    params = part.get("params", {})

    if shape_type == "box":
        shape = Box(params["length"], params["width"], params["height"])
    elif shape_type == "cylinder":
        shape = Cylinder(radius=params["radius"], height=params["height"])
    elif shape_type == "tube":
        if params["inner_radius"] >= params["outer_radius"]:
            raise ValueError(
                f"inner_radius ({params['inner_radius']}) must be smaller than "
                f"outer_radius ({params['outer_radius']})"
            )
        outer = Cylinder(radius=params["outer_radius"], height=params["height"])
        inner = Cylinder(radius=params["inner_radius"], height=params["height"])
        shape = outer - inner
    elif shape_type == "sphere":
        shape = Sphere(radius=params["radius"])
    elif shape_type == "cone":
        shape = Cone(
            bottom_radius=params["bottom_radius"],
            top_radius=params["top_radius"],
            height=params["height"],
        )
    elif shape_type == "boolean":
        op = params["op"]
        if op not in _BOOLEAN_OPS:
            raise ValueError(f"Unknown boolean op {op!r}, choose one of {list(_BOOLEAN_OPS)}")
        a = build_shape(params["a"])
        b = build_shape(params["b"])
        shape = _BOOLEAN_OPS[op](a, b)
    elif shape_type == "fillet":
        base = build_shape(params["part"])
        shape = fillet(base.edges(), radius=params["radius"])
    else:
        raise ValueError(f"Unknown shape type {shape_type!r}, choose one of {SHAPE_TYPES}")

    position = tuple(part.get("position", (0, 0, 0)))
    rotation = tuple(part.get("rotation", (0, 0, 0)))
    if position != (0, 0, 0) or rotation != (0, 0, 0):
        shape = shape.moved(Location(position, rotation))

    shape.label = part["name"]
    return shape
