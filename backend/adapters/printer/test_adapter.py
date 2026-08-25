"""Standalone proof that the printer adapter talks to the bridge.

Requires the Anvil Workshop Bridge to be running on http://localhost:3001.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from adapters.printer.adapter import (
    check_bridge_health,
    register_printer,
    list_printers,
)


def main():
    print("-- check_bridge_health --")
    health = check_bridge_health()
    print(health)
    if not health.get("ok"):
        raise RuntimeError(
            "Bridge is not healthy. Make sure `npm run bridge` is running on port 3001."
        )

    print("\n-- register_printer --")
    result = register_printer(
        name="test-printer",
        host="192.168.1.42",
        serial_number="00M1234567890",
        access_code="12345678",
        model="p1p",
    )
    print(result)

    print("\n-- list_printers --")
    printers = list_printers()
    print(printers)
    assert any(p.get("name") == "test-printer" for p in printers)

    print("\nAll printer adapter checks passed.")


if __name__ == "__main__":
    main()
