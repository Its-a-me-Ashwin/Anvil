"""Standalone proof that the circuit adapter works."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.circuit.adapter import (
    create_wiring_diagram,
    get_wiring_diagram,
    update_wiring_diagram,
    list_wiring_diagrams,
    delete_wiring_diagram,
)

DEMO_MODULES = [
    {"id": "uno", "name": "Arduino Uno", "pins": ["5V", "GND", "RX", "TX"]},
    {"id": "gps", "name": "GPS Module", "pins": ["VCC", "GND", "TX", "RX"]},
]

DEMO_CONNECTIONS = [
    {"from_module": "uno", "from_pin": "5V", "to_module": "gps", "to_pin": "VCC", "color": "red"},
    {"from_module": "uno", "from_pin": "GND", "to_module": "gps", "to_pin": "GND", "color": "black"},
    {"from_module": "uno", "from_pin": "RX", "to_module": "gps", "to_pin": "TX", "color": "green"},
    {"from_module": "uno", "from_pin": "TX", "to_module": "gps", "to_pin": "RX", "color": "blue"},
]


def main():
    project = "demo_uart"

    print("-- create_wiring_diagram --")
    result = create_wiring_diagram(project, DEMO_MODULES, DEMO_CONNECTIONS)
    print(result)

    print("\n-- list_wiring_diagrams --")
    print(list_wiring_diagrams())

    print("\n-- get_wiring_diagram --")
    data = get_wiring_diagram(project)
    print(data)
    assert len(data["modules"]) == 2
    assert len(data["connections"]) == 4

    print("\n-- update_wiring_diagram --")
    updated_modules = DEMO_MODULES + [{"id": "imu", "name": "IMU", "pins": ["VCC", "GND", "SDA", "SCL"]}]
    updated_connections = DEMO_CONNECTIONS + [
        {"from_module": "uno", "from_pin": "5V", "to_module": "imu", "to_pin": "VCC", "color": "red"},
        {"from_module": "uno", "from_pin": "GND", "to_module": "imu", "to_pin": "GND", "color": "black"},
    ]
    result = update_wiring_diagram(project, updated_modules, updated_connections)
    print(result)
    assert len(get_wiring_diagram(project)["modules"]) == 3

    print("\n-- validation: duplicate module --")
    bad_modules = [
        {"id": "m1", "name": "M1", "pins": ["A"]},
        {"id": "m1", "name": "M1 dup", "pins": ["B"]},
    ]
    try:
        create_wiring_diagram("bad_dup", bad_modules, [])
        raise RuntimeError("expected validation to fail")
    except ValueError as e:
        print(f"OK rejected: {e}")

    print("\n-- delete_wiring_diagram --")
    print(delete_wiring_diagram(project))
    assert project not in list_wiring_diagrams()

    print("\nAll circuit adapter checks passed.")


if __name__ == "__main__":
    main()
