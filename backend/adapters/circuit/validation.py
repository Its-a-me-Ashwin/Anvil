"""Validate WiringDiagramData before persisting it."""


def validate_wiring_data(data: dict) -> dict:
    errors = []
    modules = data.get("modules", [])
    connections = data.get("connections", [])

    if not isinstance(modules, list):
        errors.append("modules must be a list")
        return {"valid": False, "errors": errors}

    ids = set()
    mod_pins = {}
    for i, m in enumerate(modules):
        mid = m.get("id")
        if not mid:
            errors.append(f"Module {i} missing id")
            continue
        if mid in ids:
            errors.append(f"Duplicate module id: {mid}")
        ids.add(mid)

        pins = m.get("pins", [])
        if not isinstance(pins, list):
            errors.append(f"Module {mid} pins must be a list")
            continue

        seen_pins = set()
        for p in pins:
            if p in seen_pins:
                errors.append(f"Duplicate pin '{p}' in module {mid}")
            seen_pins.add(p)
        mod_pins[mid] = seen_pins

    if not isinstance(connections, list):
        errors.append("connections must be a list")
        return {"valid": False, "errors": errors}

    seen = set()
    for i, c in enumerate(connections):
        if len(c) < 4:
            errors.append(f"Connection {i} must have at least 4 elements")
            continue
        src, src_pin, tgt, tgt_pin = c[0], c[1], c[2], c[3]
        key = f"{src}.{src_pin}->{tgt}.{tgt_pin}"
        if key in seen:
            errors.append(f"Duplicate connection: {key}")
        seen.add(key)

        if src not in mod_pins:
            errors.append(f"Connection {i}: unknown source module {src}")
        elif src_pin not in mod_pins[src]:
            errors.append(f"Connection {i}: unknown source pin '{src_pin}' in {src}")

        if tgt not in mod_pins:
            errors.append(f"Connection {i}: unknown target module {tgt}")
        elif tgt_pin not in mod_pins[tgt]:
            errors.append(f"Connection {i}: unknown target pin '{tgt_pin}' in {tgt}")

        if src == tgt:
            errors.append(f"Connection {i}: self-connection {src} -> {tgt}")

    return {"valid": len(errors) == 0, "errors": errors}
