"""Discover Bambu printers on the local network via SSDP."""
import json
import sys

from bambucli.bambu.ssdpclient import SsdpClient


def main():
    client = SsdpClient()
    printers = client.discover_printers()
    payload = [
        {
            "name": p.name,
            "serialNumber": p.serial_number,
            "host": p.ip_address,
            "model": p.model.value,
        }
        for p in printers
    ]
    print(json.dumps(payload))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(json.dumps({"error": str(exc)}), file=sys.stderr)
        sys.exit(1)
