"""Persistent, named CAD assembly.

An Assembly is a JSON-serializable dict of part definitions, rebuilt as real
geometry from scratch on every read/export — no live in-memory-only state,
no BREP blobs on disk. State lives in a small JSON file per project, so it
survives process restarts and is git-diffable, matching the CAD-as-code
approach in arch-spec.md. Multiple projects (assemblies) can coexist side by
side, each in its own file.
"""

import json
from pathlib import Path

from build123d import Compound, Location, Rotation, export_gltf, export_step, export_stl

from adapters.cad.geometry import build_shape

BACKEND_DIR = Path(__file__).resolve().parents[2]
ASSEMBLIES_DIR = BACKEND_DIR / "sandbox_project" / "cad_output" / "assemblies"
ASSEMBLIES_DIR.mkdir(parents=True, exist_ok=True)

_EXPORTERS = {"gltf": export_gltf, "step": export_step, "stl": export_stl}

_PATTERN_AXES = {1: "X", 2: "Y", 3: "Z"}


class Assembly:
    def __init__(self, project: str):
        self.project = project
        self._path = ASSEMBLIES_DIR / f"{project}.json"
        self.parts: dict[str, dict] = self._load()

    def _load(self) -> dict:
        if self._path.exists():
            return json.loads(self._path.read_text())
        return {}

    def _save(self) -> None:
        self._path.write_text(json.dumps(self.parts, indent=2))

    def json_mtime(self) -> float | None:
        """Last-modified time of this assembly's state file, or None if it has
        never been saved. Used to detect edits for viewer hot-reload without
        re-running the (comparatively expensive) geometry export."""
        return self._path.stat().st_mtime if self._path.exists() else None

    def add_part(
        self,
        name: str,
        shape: str,
        params: dict,
        position: tuple = (0, 0, 0),
        rotation: tuple = (0, 0, 0),
    ) -> None:
        if name in self.parts:
            raise ValueError(f"Part {name!r} already exists in project {self.project!r}")
        part = {
            "name": name,
            "shape": shape,
            "params": params,
            "position": list(position),
            "rotation": list(rotation),
        }
        build_shape(part)  # validate it actually builds before committing to state
        self.parts[name] = part
        self._save()

    def remove_part(self, name: str) -> None:
        if name not in self.parts:
            raise KeyError(f"No part named {name!r} in project {self.project!r}")
        del self.parts[name]
        self._save()

    def position_part(self, name: str, position=None, rotation=None) -> None:
        if name not in self.parts:
            raise KeyError(f"No part named {name!r} in project {self.project!r}")
        if position is not None:
            self.parts[name]["position"] = list(position)
        if rotation is not None:
            self.parts[name]["rotation"] = list(rotation)
        build_shape(self.parts[name])  # validate the new placement still builds
        self._save()

    def boolean_op(self, op: str, part_a: str, part_b: str, result_name: str) -> None:
        if part_a not in self.parts or part_b not in self.parts:
            raise KeyError("Both parts must exist in the assembly before combining")
        if result_name in self.parts and result_name not in (part_a, part_b):
            raise ValueError(f"Part {result_name!r} already exists")

        result = {
            "name": result_name,
            "shape": "boolean",
            "params": {"op": op, "a": self.parts[part_a], "b": self.parts[part_b]},
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
        }
        build_shape(result)  # validate before mutating state

        del self.parts[part_a]
        if part_b in self.parts:
            del self.parts[part_b]
        self.parts[result_name] = result
        self._save()

    def fillet_part(self, name: str, radius: float) -> None:
        if name not in self.parts:
            raise KeyError(f"No part named {name!r} in project {self.project!r}")
        filleted = {
            "name": name,
            "shape": "fillet",
            "params": {"part": self.parts[name], "radius": radius},
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
        }
        build_shape(filleted)  # validate before mutating state
        self.parts[name] = filleted
        self._save()

    def chamfer_part(self, name: str, length: float) -> None:
        if name not in self.parts:
            raise KeyError(f"No part named {name!r} in project {self.project!r}")
        chamfered = {
            "name": name,
            "shape": "chamfer",
            "params": {"part": self.parts[name], "length": length},
            "position": [0, 0, 0],
            "rotation": [0, 0, 0],
        }
        build_shape(chamfered)  # validate before mutating state
        self.parts[name] = chamfered
        self._save()

    def _bbox_center(self) -> tuple[float, float, float]:
        """Center of the whole assembly's bounding box — the pivot
        circular_pattern rotates around, not the world origin."""
        shapes = [build_shape(p) for p in self.parts.values()]
        bbox = Compound(children=shapes).bounding_box()
        return (
            (bbox.min.X + bbox.max.X) / 2,
            (bbox.min.Y + bbox.max.Y) / 2,
            (bbox.min.Z + bbox.max.Z) / 2,
        )

    def circular_pattern(self, names: list[str], axis: int, count: int) -> list[str]:
        axis_key = _PATTERN_AXES.get(axis)
        if axis_key is None:
            raise ValueError(f"axis must be 1 (X), 2 (Y), or 3 (Z), got {axis!r}")
        missing = [n for n in names if n not in self.parts]
        if missing:
            raise KeyError(f"No part(s) named {missing!r} in project {self.project!r}")
        if count < 1:
            raise ValueError(f"count must be >= 1, got {count}")
        if count == 1:
            return []

        pivot = self._bbox_center()
        to_origin = Location((-pivot[0], -pivot[1], -pivot[2]))
        back_to_pivot = Location(pivot)
        angle_step = 360.0 / count

        # Each copy is placed by composing (move pivot to origin) -> (rotate
        # by this copy's share of the circle) -> (move back), then decomposed
        # back into a plain position/rotation pair so it's stored the same
        # way as any other part and rebuilds identically via build_shape.
        new_parts: dict[str, dict] = {}
        for name in names:
            original = self.parts[name]
            for i in range(1, count):
                copy_name = f"{name}_pattern{i + 1}"
                if copy_name in self.parts or copy_name in new_parts:
                    raise ValueError(f"Part {copy_name!r} already exists")

                rotate = Rotation(**{axis_key: angle_step * i})
                transform = back_to_pivot * rotate * to_origin
                moved = transform * Location(tuple(original["position"]), tuple(original["rotation"]))

                new_parts[copy_name] = {
                    "name": copy_name,
                    "shape": original["shape"],
                    "params": original["params"],
                    "position": [moved.position.X, moved.position.Y, moved.position.Z],
                    "rotation": [moved.orientation.X, moved.orientation.Y, moved.orientation.Z],
                }

        for copy_name, part in new_parts.items():
            build_shape(part)  # validate before committing
            self.parts[copy_name] = part
        self._save()
        return list(new_parts.keys())

    def list_parts(self) -> list[dict]:
        return [
            {
                "name": p["name"],
                "shape": p["shape"],
                "position": p["position"],
                "rotation": p["rotation"],
            }
            for p in self.parts.values()
        ]

    def get_part_info(self, name: str) -> dict:
        if name not in self.parts:
            raise KeyError(f"No part named {name!r} in project {self.project!r}")
        shape = build_shape(self.parts[name])
        bbox = shape.bounding_box()
        return {
            "name": name,
            "volume_mm3": shape.volume,
            "bounding_box_mm": {
                "min": [bbox.min.X, bbox.min.Y, bbox.min.Z],
                "max": [bbox.max.X, bbox.max.Y, bbox.max.Z],
            },
        }

    def export(self, fmt: str = "gltf") -> dict:
        if fmt not in _EXPORTERS:
            raise ValueError(f"Unknown export format {fmt!r}, choose one of {list(_EXPORTERS)}")
        if not self.parts:
            raise ValueError(f"Project {self.project!r} has no parts to export")

        shapes = [build_shape(p) for p in self.parts.values()]
        compound = Compound(children=shapes, label=self.project)

        out_path = ASSEMBLIES_DIR / f"{self.project}.{fmt}"
        _EXPORTERS[fmt](compound, str(out_path))

        return {
            "path": str(out_path),
            "part_count": len(self.parts),
            "total_volume_mm3": compound.volume,
        }
