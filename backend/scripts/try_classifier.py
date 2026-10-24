"""
DepShield - Offline Classifier & Scoring Try Script.
Tests signal extraction and deterministic scoring using saved page fixtures and canned output.

Safety rules:
- Zero external requests: No TinyFish, no Gemini, no OSV.
- Refuses to run if no canned output is supplied.
- Inspects classifier.py and scoring.py for contract compliance:
    classify(dep, pages, osv, *, scan_id=None, emit=None) -> list[Signal]
    build_finding(dep, scan_id, signals, sources, osv) -> Finding | None
- If classifier.py does not expose a function matching the contract, STOPS that part,
  does not edit the file, and prints the exact mismatch for Aman and Ansh.
"""
from __future__ import annotations

import argparse
import asyncio
import inspect
import json
import os
import sys
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# Ensure backend directory is in sys.path
_SCRIPT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _SCRIPT_DIR.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

# Shared model imports
try:
    from app.models import Dependency, Finding, OsvResult, PageContent, Signal, Source
except ImportError:
    from backend.app.models import Dependency, Finding, OsvResult, PageContent, Signal, Source


def inspect_classifier_contract(classifier_mod: Any) -> tuple[bool, str]:
    """Inspects classifier.py for the shared contract signature."""
    if not hasattr(classifier_mod, "classify"):
        public_callables = [
            f"{name}{inspect.signature(getattr(classifier_mod, name))}"
            for name in dir(classifier_mod)
            if not name.startswith("_") and callable(getattr(classifier_mod, name))
        ]
        msg = (
            "[CONTRACT MISMATCH DETECTED for Aman & Ansh]\n"
            "  Expected contract function: classify(dep: Dependency, pages: list[PageContent], osv: OsvResult, *, scan_id: str | None = None, emit: Emit | None = None) -> list[Signal]\n"
            "  'classify' is NOT exposed in backend/app/classifier.py.\n"
            f"  Available public functions: {public_callables}\n"
            "  Stopping classification part per contract rules. (Do not edit classifier.py)"
        )
        return False, msg

    fn = getattr(classifier_mod, "classify")
    sig = inspect.signature(fn)
    params = list(sig.parameters.keys())
    if len(params) < 3 or params[:3] != ["dep", "pages", "osv"]:
        msg = (
            "[CONTRACT MISMATCH DETECTED for Aman & Ansh]\n"
            "  Expected signature: classify(dep, pages, osv, *, scan_id=None, emit=None)\n"
            f"  Actual signature:   classify{sig}\n"
            "  Stopping classification part per contract rules. (Do not edit classifier.py)"
        )
        return False, msg

    return True, ""


def inspect_scoring_contract(scoring_mod: Any) -> tuple[bool, str]:
    """Inspects scoring.py for the shared contract signature."""
    if not hasattr(scoring_mod, "build_finding"):
        msg = (
            "[CONTRACT MISMATCH DETECTED for Aman & Ansh]\n"
            "  Expected contract function: build_finding(dep, scan_id, signals, sources, osv)\n"
            "  'build_finding' is NOT exposed in backend/app/scoring.py."
        )
        return False, msg

    fn = getattr(scoring_mod, "build_finding")
    sig = inspect.signature(fn)
    params = list(sig.parameters.keys())
    if len(params) < 5 or params[:5] != ["dep", "scan_id", "signals", "sources", "osv"]:
        msg = (
            "[CONTRACT MISMATCH DETECTED for Aman & Ansh]\n"
            "  Expected signature: build_finding(dep, scan_id, signals, sources, osv)\n"
            f"  Actual signature:   build_finding{sig}"
        )
        return False, msg

    return True, ""


def _extract_domain(url: str) -> str:
    try:
        return urllib.parse.urlparse(url).netloc.lower()
    except Exception:
        return ""


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="DepShield: Offline test runner for classifier and scoring layers."
    )
    default_fixture = str(
        _BACKEND_DIR / "fixtures" / "pages" / "synthetic_benign.json"
    )
    parser.add_argument(
        "--fixture",
        default=default_fixture,
        help="Path to page fixture JSON (default: synthetic_benign.json).",
    )
    parser.add_argument(
        "--canned",
        default=None,
        help="Path to canned Gemini output JSON (optional, defaults to fixture's canned_output).",
    )
    args = parser.parse_args(argv)

    # 1. Load fixture file
    fixture_path = Path(args.fixture)
    if not fixture_path.is_file():
        print(f"Error: Fixture file not found: {fixture_path}", file=sys.stderr)
        return 1

    try:
        with open(fixture_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as exc:
        print(f"Error reading fixture JSON: {exc}", file=sys.stderr)
        return 1

    pkg_name = data.get("package", "synthetic-pkg")
    pkg_version = data.get("version", "1.0.0")
    ecosystem = data.get("ecosystem", "npm")
    raw_pages = data.get("pages", [])

    if not raw_pages:
        print(f"Error: Fixture {fixture_path} contains no 'pages'.", file=sys.stderr)
        return 1

    # 2. Load canned output (MANDATORY for offline execution)
    canned_data = None
    if args.canned:
        canned_path = Path(args.canned)
        if not canned_path.is_file():
            print(f"Error: Canned output file not found: {canned_path}", file=sys.stderr)
            return 1
        try:
            with open(canned_path, "r", encoding="utf-8") as f:
                canned_data = json.load(f)
        except Exception as exc:
            print(f"Error reading canned output JSON: {exc}", file=sys.stderr)
            return 1
    elif "canned_output" in data:
        canned_data = data["canned_output"]

    if not canned_data or not canned_data.get("signals"):
        print(
            "Refusing to run: No canned Gemini output supplied. Real Gemini network calls are strictly forbidden.",
            file=sys.stderr,
        )
        return 2

    # Parse canned signals
    try:
        signals = [Signal.model_validate(s) for s in canned_data["signals"]]
    except Exception as exc:
        print(f"Error validating canned signals: {exc}", file=sys.stderr)
        return 1

    # Build domain model objects
    dep = Dependency(
        name=pkg_name,
        version=pkg_version,
        ecosystem=ecosystem,
        direct=True,
        dep_path=[pkg_name],
    )

    pages: list[PageContent] = []
    sources: list[Source] = []
    page_texts: dict[str, str] = {}

    for p in raw_pages:
        u = p.get("url", "")
        t = p.get("text", "")
        pages.append(
            PageContent(
                url=u,
                title=p.get("title", ""),
                text=t,
                fetched_at=datetime.now(timezone.utc),
                discovered_by="fetch",
            )
        )
        sources.append(
            Source(
                url=u,
                title=p.get("title", ""),
                domain=_extract_domain(u),
                snippet=t[:100],
                discovered_by="fetch",
            )
        )
        page_texts[u] = t

    # Offline OSV baseline (clean by default)
    osv = OsvResult(queried=True, vuln_ids=[])

    # 3. Dynamic inspection of modules
    try:
        from app import classifier, scoring
    except ImportError:
        from backend.app import classifier, scoring

    classifier_ok, classifier_msg = inspect_classifier_contract(classifier)
    scoring_ok, scoring_msg = inspect_scoring_contract(scoring)

    if not scoring_ok:
        print(scoring_msg, file=sys.stderr)
        return 1

    if not classifier_ok:
        print(classifier_msg, file=sys.stderr)
        # Per instructions: STOP that part, do not edit classifier.py,
        # but proceed to run deterministic scoring on the canned signals.
        active_signals = signals
    else:
        # If classifier matches contract, run it with Gemini patched
        orig_call = getattr(classifier, "_call_gemini", None)

        async def mock_call_gemini(*args: Any, **kwargs: Any) -> list[Signal]:
            return signals

        setattr(classifier, "_call_gemini", mock_call_gemini)
        try:
            active_signals = asyncio.run(
                classifier.classify(
                    dep,
                    pages,
                    osv,
                    scan_id="try_classifier_scan",
                )
            )
        finally:
            if orig_call:
                setattr(classifier, "_call_gemini", orig_call)

    # 4. Deterministic scoring
    finding = scoring.build_finding(
        dep=dep,
        scan_id="try_classifier_scan",
        signals=active_signals,
        sources=sources,
        osv=osv,
        page_texts=page_texts,
    )

    result_payload: Dict[str, Any] = {
        "status": "ok",
        "package": dep.name,
        "version": dep.version,
        "classifier_contract_valid": classifier_ok,
        "signals_count": len(active_signals),
        "finding": finding.model_dump(mode="json") if finding else None,
    }

    print(json.dumps(result_payload, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
