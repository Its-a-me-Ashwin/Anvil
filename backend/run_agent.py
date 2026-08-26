"""CLI to run a one-off prompt against the Anvil ADK agent."""

import argparse
import asyncio
import os
import sys
from pathlib import Path

import dotenv

# Ensure backend/ is on sys.path so `import agent` and the adapter modules
# resolve correctly regardless of where this script is invoked from.
BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from google.adk import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

import agent


def _require_api_key() -> str:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print(
            "Error: GEMINI_API_KEY is not set.\n"
            "Get a key at https://aistudio.google.com/app/apikey and add it to "
            "backend/.env (see backend/.env.example)."
        )
        sys.exit(1)
    return api_key


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Anvil agent on a prompt.")
    parser.add_argument("prompt", help="The prompt to send to the agent.")
    args = parser.parse_args()

    dotenv.load_dotenv(BACKEND_DIR / ".env")
    _require_api_key()

    anvil_agent = agent.build_agent()
    session_service = InMemorySessionService()
    runner = Runner(
        app_name="anvil",
        agent=anvil_agent,
        session_service=session_service,
    )

    session = asyncio.run(
        runner.session_service.create_session(
            app_name="anvil",
            user_id="local_user",
            state={},
        )
    )

    content = types.Content(role="user", parts=[types.Part(text=args.prompt)])
    response_texts: list[str] = []
    for event in runner.run(
        user_id=session.user_id,
        session_id=session.id,
        new_message=content,
    ):
        if event.is_final_response() and event.content:
            for part in event.content.parts:
                if part.text:
                    response_texts.append(part.text)

    print("\n".join(response_texts))


if __name__ == "__main__":
    main()
