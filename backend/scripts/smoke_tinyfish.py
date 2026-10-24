"""
Minimal, safe smoke script for TinyFish.

Modes:
  1. Default (no flags): DRY RUN. Make zero network requests.
     Prints environment state, ledger availability, API key presence (yes/no only),
     and maximum potential spend.
  2. Live mode (--search-fetch):
     Requires:
       - --confirm-spend
       - TINYFISH_LIVE_ENABLED=1
       - Ledger function available
       - Interactive stdin with exact confirmation text 'SPEND 2 UNITS'
     Executes:
       - Exactly 1 client.search(query) (max spend: 1 unit)
       - Exactly 1 client.fetch(urls) for at most 2 safe HTTPS URLs (max spend: 1 unit)
     Saves public page text to fixtures/{hash}.json.
     Max spend is capped at 2 units.
"""

import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import sys
from typing import Any, Callable, Dict, List, Optional
import urllib.parse

# Ensure both backend/ and repo root are importable regardless of working directory
_CURRENT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _CURRENT_DIR.parent
_REPO_ROOT = _BACKEND_DIR.parent

for _p in (str(_BACKEND_DIR), str(_REPO_ROOT)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from app.tinyfish_client import TinyFishClient
except ImportError:
    from backend.app.tinyfish_client import TinyFishClient

DEFAULT_QUERY = "npm package security advisory"
DEFAULT_FIXTURES_DIR = _CURRENT_DIR / "fixtures"


def safe_print(*args: Any, **kwargs: Any) -> None:
    """Prints text redacting any secret keys or sensitive tokens."""
    raw = " ".join(str(a) for a in args)
    # Redact actual environment key if set
    env_key = os.getenv("TINYFISH_API_KEY")
    if env_key and env_key in raw:
        raw = raw.replace(env_key, "[REDACTED]")
    # Redact common token patterns (e.g. tf_..., sk_...)
    raw = re.sub(r"(?:tf|sk|key|token)[-_a-zA-Z0-9]{12,}", "[REDACTED]", raw, flags=re.IGNORECASE)
    print(raw, **kwargs)


def get_ledger_function() -> Optional[Callable[..., Any]]:
    """Tries importing reserve_tinyfish_request from app.db then backend.app.db."""
    try:
        from app.db import reserve_tinyfish_request  # type: ignore
        return reserve_tinyfish_request
    except ImportError:
        pass
    try:
        from backend.app.db import reserve_tinyfish_request  # type: ignore
        return reserve_tinyfish_request
    except ImportError:
        pass
    return None


def is_safe_url(url: Any) -> bool:
    """
    Validates URL safety:
    - Must be a string <= 500 chars
    - Scheme must be strictly 'https'
    - Hostname must be present and not localhost or local/private domain
    - Hostname must NOT be an IP address literal (IPv4 or IPv6)
    """
    if not isinstance(url, str):
        return False
    url = url.strip()
    if not url or len(url) > 500:
        return False
    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False

    if parsed.scheme != "https":
        return False

    # Block URLs with embedded credentials
    if parsed.username or parsed.password:
        return False

    host = parsed.hostname
    if not host:
        return False

    host = host.lower().strip()
    if host in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
        return False

    # Block local or private domain suffixes
    for suffix in (".local", ".localhost", ".internal", ".lan", ".home.arpa"):
        if host.endswith(suffix):
            return False

    # Block any all-numeric or dotted-numeric representation (integer/octal/decimal IPv4)
    clean_host = host.strip("[]")
    if clean_host and all(part.isdigit() for part in clean_host.split(".")):
        return False

    # Block IPv6 address literals or malformed host with colons
    if ":" in clean_host:
        return False

    # Rule: no IP-address hosts -> reject IPv4 and IPv6 literals
    try:
        ipaddress.ip_address(clean_host)
        return False
    except ValueError:
        pass

    return True


def extract_url(item: Any) -> Optional[str]:
    """Defensively extracts a URL string from a dict or object."""
    if isinstance(item, dict):
        url = item.get("url") or item.get("final_url")
    else:
        url = getattr(item, "url", None) or getattr(item, "final_url", None)
    if isinstance(url, str):
        return url.strip()
    return None


def extract_search_urls(search_response: Any) -> List[str]:
    """Defensively extracts at most 2 safe HTTPS URLs from a search response."""
    raw_results = None
    if isinstance(search_response, dict):
        raw_results = search_response.get("results") or search_response.get("data")
    else:
        raw_results = getattr(search_response, "results", None) or getattr(search_response, "data", None)

    if not isinstance(raw_results, list):
        return []

    safe_urls: List[str] = []
    for item in raw_results:
        u = extract_url(item)
        if u and is_safe_url(u) and u not in safe_urls:
            safe_urls.append(u)
            if len(safe_urls) == 2:
                break
    return safe_urls


def extract_fetch_items(fetch_response: Any) -> List[Dict[str, str]]:
    """Defensively extracts URL and text from a fetch response."""
    raw_results = None
    if isinstance(fetch_response, dict):
        raw_results = fetch_response.get("results") or fetch_response.get("data")
    else:
        raw_results = getattr(fetch_response, "results", None) or getattr(fetch_response, "data", None)

    if not isinstance(raw_results, list):
        if isinstance(fetch_response, dict) and ("url" in fetch_response or "text" in fetch_response):
            raw_results = [fetch_response]
        else:
            return []

    items: List[Dict[str, str]] = []
    for item in raw_results:
        url = extract_url(item)
        if not url:
            continue
        if isinstance(item, dict):
            text = item.get("text") or item.get("content") or item.get("description") or ""
        else:
            text = getattr(item, "text", None) or getattr(item, "content", None) or getattr(item, "description", None) or ""
        if not isinstance(text, str):
            text = str(text) if text is not None else ""
        items.append({"url": url, "text": text[:20000]})
    return items


def save_fixture(url: str, text: str, fixtures_dir: Optional[Path] = None) -> Path:
    """
    Saves public page text to fixtures as JSON.
    Contains ONLY: url, fetched_at, text (capped at 20000 chars).
    Filename is derived solely from the SHA-256 hash of the URL (never contains URL text).
    """
    target_dir = fixtures_dir if fixtures_dir is not None else DEFAULT_FIXTURES_DIR
    target_dir.mkdir(parents=True, exist_ok=True)

    url_hash = hashlib.sha256(url.encode("utf-8")).hexdigest()[:16]
    fixture_path = target_dir / f"{url_hash}.json"

    data = {
        "url": url,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "text": text[:20000] if isinstance(text, str) else "",
    }
    with open(fixture_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return fixture_path


def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Minimal safe smoke test script for TinyFish."
    )
    parser.add_argument(
        "--search-fetch",
        action="store_true",
        help="Execute single search + fetch live smoke (costs max 2 units).",
    )
    parser.add_argument(
        "--confirm-spend",
        action="store_true",
        help="Explicit confirmation flag required for live spending.",
    )
    parser.add_argument(
        "--query",
        type=str,
        default=DEFAULT_QUERY,
        help="Search query to execute (max 200 characters).",
    )
    return parser.parse_args(args)


async def async_main(
    args: Optional[List[str]] = None,
    client: Optional[TinyFishClient] = None,
    fixtures_dir: Optional[Path] = None,
) -> int:
    try:
        parsed_args = parse_args(args)
    except SystemExit as exc:
        return 2 if exc.code != 0 else 0

    live_enabled_str = os.getenv("TINYFISH_LIVE_ENABLED", "0")
    live_enabled = live_enabled_str == "1"
    stage = os.getenv("TINYFISH_BUDGET_STAGE", "development")
    ledger_fn = get_ledger_function()
    has_api_key = bool(os.getenv("TINYFISH_API_KEY", "").strip())

    # Mode 1: Default DRY RUN (no --search-fetch)
    if not parsed_args.search_fetch:
        safe_print("=== TinyFish Smoke Script: DRY RUN ===")
        safe_print("Plan: Zero network requests will be made.")
        safe_print(f"TINYFISH_LIVE_ENABLED: {live_enabled_str}")
        safe_print(f"Budget stage: {stage}")
        safe_print(f"Ledger available: {'yes' if ledger_fn is not None else 'no'}")
        safe_print(f"API key present: {'yes' if has_api_key else 'no'}")
        safe_print("Maximum units this mode could spend: 0")
        safe_print("Units used so far: total_used=0, development_used=0")
        return 0

    # Mode 2: Live --search-fetch
    # Check all safety gates BEFORE any network or SDK calls
    if not parsed_args.confirm_spend:
        safe_print("Refused: --confirm-spend flag is required for --search-fetch.")
        safe_print("Units used so far: unknown")
        return 2

    if not live_enabled:
        safe_print("Refused: TINYFISH_LIVE_ENABLED != 1 in environment.")
        safe_print("Units used so far: unknown")
        return 2

    if ledger_fn is None and client is None:
        safe_print("Refused: Ledger function (reserve_tinyfish_request) is not available.")
        safe_print("Units used so far: unknown")
        return 2

    if not sys.stdin.isatty():
        safe_print("Refused: Non-interactive stdin. Live mode requires an interactive terminal.")
        safe_print("Units used so far: unknown")
        return 2

    try:
        user_input = input("Safety prompt: Type exactly 'SPEND 2 UNITS' to proceed: ")
    except Exception as exc:
        safe_print(f"Refused: Unable to read confirmation from stdin ({exc}).")
        safe_print("Units used so far: unknown")
        return 2

    if user_input.strip() != "SPEND 2 UNITS":
        safe_print("Refused: Confirmation text did not match 'SPEND 2 UNITS'.")
        safe_print("Units used so far: unknown")
        return 2

    # Query length validation
    query = parsed_args.query.strip()
    if not query:
        safe_print("Refused: Query cannot be empty.")
        safe_print("Units used so far: unknown")
        return 2
    if len(query) > 200:
        safe_print("Refused: Query exceeds maximum length of 200 characters.")
        safe_print("Units used so far: unknown")
        return 2

    # All safety checks passed. Proceed with execution.
    active_client: Optional[TinyFishClient] = client
    try:
        if active_client is None:
            active_client = TinyFishClient(reserve_fn=ledger_fn, live_enabled=True)

        safe_print(f"Executing search with query: '{query}'")
        search_response = await active_client.search(query=query)

        safe_urls = extract_search_urls(search_response)
        safe_print(f"Search succeeded. Found {len(safe_urls)} safe URL(s) to fetch (max 2).")

        if safe_urls:
            safe_print(f"Executing fetch for {len(safe_urls)} URL(s)...")
            fetch_response = await active_client.fetch(urls=safe_urls)
            fetch_items = extract_fetch_items(fetch_response)
            for item in fetch_items:
                path = save_fixture(item["url"], item["text"], fixtures_dir=fixtures_dir)
                safe_print(f"Saved fixture: {path.name}")
        else:
            safe_print("No safe URLs found to fetch. Skipping fetch.")

        total = getattr(active_client, "total_used", "unknown")
        dev = getattr(active_client, "development_used", "unknown")
        safe_print(f"Smoke completed successfully. Units used so far: total_used={total}, development_used={dev}")
        return 0

    except Exception as exc:
        safe_print(f"Error during smoke execution: {exc}")
        total = getattr(active_client, "total_used", "unknown") if active_client is not None else "unknown"
        dev = getattr(active_client, "development_used", "unknown") if active_client is not None else "unknown"
        safe_print(f"Units used so far: total_used={total}, development_used={dev}")
        return 1


def main(
    args: Optional[List[str]] = None,
    client: Optional[TinyFishClient] = None,
    fixtures_dir: Optional[Path] = None,
) -> int:
    return asyncio.run(async_main(args, client=client, fixtures_dir=fixtures_dir))


if __name__ == "__main__":
    sys.exit(main())
