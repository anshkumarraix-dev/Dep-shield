"""
DepShield - List Gemini Models Script.
Queries Google GenAI API to list available models supporting generateContent.

Security rules:
- NEVER print GEMINI_API_KEY, any prefix of it, or os.environ contents.
- Redact API key from any exception text.
- Default mode (no flags): dry run, zero network calls.
- Exit codes: 0 = ok, 2 = refused (e.g. missing API key), 1 = error.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path
from typing import Any, List

from dotenv import load_dotenv

# Path to repo root .env relative to __file__
_SCRIPT_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _SCRIPT_DIR.parent.parent
_ENV_PATH = _REPO_ROOT / ".env"


def _redact_key(text: str, api_key: str | None) -> str:
    """Ensure no API key or potential key pattern leaks in error text."""
    if not text:
        return text
    redacted = text
    if api_key:
        redacted = redacted.replace(api_key, "[REDACTED_API_KEY]")
    # Redact typical Google AI API key patterns
    redacted = re.sub(r"AIza[0-9A-Za-z-_]{35}", "[REDACTED_API_KEY]", redacted)
    return redacted


def _model_supports_generate_content(model: Any) -> bool:
    """Check if model supports generateContent action."""
    actions = getattr(model, "supported_actions", None)
    if actions is None and isinstance(model, dict):
        actions = (
            model.get("supported_actions")
            or model.get("supportedActions")
            or model.get("supported_generation_methods")
        )
    if actions is None:
        actions = getattr(model, "supported_generation_methods", None)

    if not actions:
        return False

    for action in actions:
        a_str = str(action).lower()
        if "generatecontent" in a_str or "generate_content" in a_str:
            return True
    return False


def _get_model_id(model: Any) -> str:
    """Extract clean model ID string."""
    name = getattr(model, "name", None)
    if name is None and isinstance(model, dict):
        name = model.get("name") or model.get("id")
    if not name:
        return ""
    name_str = str(name).strip()
    if name_str.startswith("models/"):
        return name_str[len("models/"):]
    return name_str


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="DepShield: List available Gemini models supporting generateContent."
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Query Google GenAI API to list models supporting generateContent.",
    )
    args = parser.parse_args(argv)

    # 1. Load .env
    if _ENV_PATH.is_file():
        load_dotenv(dotenv_path=_ENV_PATH)

    api_key = os.getenv("GEMINI_API_KEY")
    key_present = bool(api_key and api_key.strip())
    current_model = os.getenv("GEMINI_MODEL", "")

    # 2. Default mode (no flags): Dry run, zero network calls
    if not args.list:
        print("DepShield Gemini Model Inspector (DRY RUN)")
        print("=" * 45)
        print("Plan: Call google-genai client's models.list once to discover models supporting generateContent.")
        print(f"GEMINI_API_KEY present: {'yes' if key_present else 'no'}")
        print(f"Current GEMINI_MODEL:   {current_model if current_model else '(not set)'}")
        print("No network calls made. Use --list to execute live model discovery.")
        return 0

    # 3. With --list: check key presence
    if not key_present:
        print("Refusing to list models: GEMINI_API_KEY is not set.", file=sys.stderr)
        return 2

    # 4. Make one call to models.list
    try:
        from google import genai
    except ImportError:
        print("Error: google-genai package is not installed.", file=sys.stderr)
        return 1

    try:
        client = genai.Client(api_key=api_key)
        models_pager = client.models.list()

        valid_model_ids: list[str] = []
        for m in models_pager:
            if _model_supports_generate_content(m):
                mid = _get_model_id(m)
                if mid:
                    valid_model_ids.append(mid)

        # Print only model IDs that support generateContent, one per line
        for mid in valid_model_ids:
            print(mid)

        # Check current GEMINI_MODEL value
        model_name_clean = current_model.removeprefix("models/") if current_model else ""
        in_list = bool(
            model_name_clean
            and (model_name_clean in valid_model_ids or current_model in valid_model_ids)
        )

        print(f"Current GEMINI_MODEL: {current_model if current_model else '(not set)'}")
        print(f"GEMINI_MODEL in list: {in_list}")
        return 0

    except Exception as exc:
        err_msg = _redact_key(str(exc), api_key)
        print(f"Error querying Gemini models: {err_msg}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
