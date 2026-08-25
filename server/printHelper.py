#!/usr/bin/env python3
"""
Upload a sliced 3MF to a Bambu printer via FTPS and start the print via MQTT.

Usage:
  python server/printHelper.py <file_path> --ip <ip> --serial <serial> --access-code <code> [--model <model>] [--ams 0 1 ...]
"""
import argparse
import sys
import time
import json

from bambucli.bambu.ftpclient import CACHE_DIRECTORY, FtpClient
from bambucli.bambu.mqttclient import MqttClient
from bambucli.bambu.printer import Printer, PrinterModel


def upload_file(ip_address: str, access_code: str, local_path: str, remote_name: str):
    ftps = FtpClient(ip_address, access_code)
    ftps.connect()
    ftps.upload_file(local_path, f"{CACHE_DIRECTORY}{remote_name}")
    ftps.quit()


def start_print(ip_address: str, serial_number: str, access_code: str, remote_name: str, ams_mapping=None, plate_number=1, timeout_seconds=8):
    published = False

    def on_connect(client, reason_code):
        nonlocal published
        client.print(remote_name, ams_mappings=ams_mapping, plate_number=plate_number)
        published = True

    mqtt = MqttClient.for_local_printer(
        ip_address,
        serial_number,
        access_code,
        on_connect=on_connect,
    )

    mqtt.connect()
    mqtt.loop_start()

    try:
        # Wait for connect + publish + a little extra for the packet to leave.
        deadline = time.time() + timeout_seconds
        while time.time() < deadline:
            if published:
                time.sleep(1.5)  # give background loop thread time to actually send the MQTT message
                break
            time.sleep(0.1)
        else:
            raise TimeoutError("Timed out waiting for MQTT connection")
    finally:
        mqtt.loop_stop()
        mqtt.disconnect()


def main():
    parser = argparse.ArgumentParser(description="Upload and start a Bambu print")
    parser.add_argument("file", help="Path to sliced 3MF file")
    parser.add_argument("--ip", required=True, help="Printer IP address")
    parser.add_argument("--serial", required=True, help="Printer serial number")
    parser.add_argument("--access-code", required=True, help="Printer access code")
    parser.add_argument("--model", default="P1S", help="Printer model")
    parser.add_argument("--ams", nargs="*", type=int, default=None, help="AMS slot mapping")
    parser.add_argument("--plate", type=int, default=1, help="Plate number to print")
    args = parser.parse_args()

    remote_name = args.file.split("\\")[-1].split("/")[-1]

    print(f"Uploading {remote_name} to {args.ip} ...", flush=True)
    upload_file(args.ip, args.access_code, args.file, remote_name)
    print(f"Upload complete. Starting print ...", flush=True)
    start_print(args.ip, args.serial, args.access_code, remote_name, ams_mapping=args.ams, plate_number=args.plate)
    print(f"Print command sent.", flush=True)

    return 0


if __name__ == "__main__":
    sys.exit(main())
