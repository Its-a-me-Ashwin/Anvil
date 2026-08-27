"""Minimal, dependency-free check of GEMINI_API_KEY in backend/.env.

Makes one direct REST call per candidate model — no ADK, no agent, no
tools — so a failure here can only mean the key/quota/model itself, not
anything in our backend code. Tests a spread of models to find one that
actually responds, useful for picking something cheap for local testing.

Run:
    python3 backend/check_api_key.py
    python3 backend/check_api_key.py gemini-2.5-flash-lite   # test just one
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ENV_PATH = Path(__file__).resolve().parent / ".env"

CANDIDATES = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-lite-latest",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3.5-flash",
    "gemini-3.6-flash",
]


def load_key() -> str:
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if line.startswith("GEMINI_API_KEY="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(f"GEMINI_API_KEY not found in {ENV_PATH}")


def check_model(api_key: str, model: str) -> None:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    body = json.dumps({"contents": [{"parts": [{"text": "Say OK."}]}]}).encode()
    req = urllib.request.Request(
        url, data=body, headers={"Content-Type": "application/json"}, method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            print(f"  OK   {model:30s} -> {text!r}")
    except urllib.error.HTTPError as e:
        error_body = json.loads(e.read().decode())
        msg = error_body.get("error", {}).get("message", "")
        print(f"  FAIL {model:30s} -> HTTP {e.code}: {msg[:100]}")
    except urllib.error.URLError as e:
        print(f"  FAIL {model:30s} -> could not reach the API: {e.reason}")


def main() -> None:
    api_key = load_key()
    models = sys.argv[1:] or CANDIDATES
    print(f"Testing {len(models)} model(s) with the key in {ENV_PATH}\n")
    for model in models:
        check_model(api_key, model)


if __name__ == "__main__":
    main()
