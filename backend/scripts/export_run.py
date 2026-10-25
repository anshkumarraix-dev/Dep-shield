"""Export a completed scan run as an offline fixture.

Reads scan data, findings, sources, and dependency graph from local SQLite DB
and writes them to backend/fixtures/recorded/<scan_id>.json.

No network calls are made. Keys and secrets are strictly redacted.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import sys
from typing import Any

# Ensure backend directory and repo root are in path
_SCRIPT_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _SCRIPT_DIR.parent
_REPO_ROOT = _BACKEND_DIR.parent

for _p in (str(_BACKEND_DIR), str(_REPO_ROOT)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

try:
    from app import db
    from app.events import event_bus
except ImportError:
    from backend.app import db
    from backend.app.events import event_bus


def _redact_secrets(data: Any) -> Any:
    """Recursively scrub common API key patterns or known environment secrets."""
    if isinstance(data, dict):
        return {k: _redact_secrets(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_redact_secrets(item) for item in data]
    if isinstance(data, str):
        cleaned = data
        for env_var in ("TINYFISH_API_KEY", "GEMINI_API_KEY"):
            val = os.getenv(env_var)
            if val and val in cleaned:
                cleaned = cleaned.replace(val, "[REDACTED]")
        # Redact Google and token patterns
        cleaned = re.sub(r"AIza[0-9A-Za-z-_]{35}", "[REDACTED]", cleaned)
        cleaned = re.sub(r"(?:tf|sk|key|token)[-_a-zA-Z0-9]{12,}", "[REDACTED]", cleaned, flags=re.IGNORECASE)
        return cleaned
    return data


def export_scan_to_fixture(scan_id: str, output_dir: Path | None = None) -> Path:
    """Export scan artifacts from DB to a recorded JSON fixture."""
    scan = db.get_scan(scan_id)
    if not scan:
        raise ValueError(f"Scan '{scan_id}' not found in database.")

    findings = db.get_findings(scan_id)

    # Collect and deduplicate sources across findings
    all_sources: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    for f in findings:
        for src in getattr(f, "sources", []) or []:
            url = getattr(src, "url", None)
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_sources.append(src.model_dump(mode="json"))

    # Collect activity events from memory bus if present
    activity: list[dict[str, Any]] = []
    channel = event_bus.channels.get(scan_id)
    if channel:
        activity = list(channel.history)

    # Collect dependency graph
    graph_tuple = db.get_dependency_graph(scan_id)
    graph = {"nodes": graph_tuple[0], "edges": graph_tuple[1]} if graph_tuple else None

    target_dir = output_dir or (_BACKEND_DIR / "fixtures" / "recorded")
    target_dir.mkdir(parents=True, exist_ok=True)
    out_file = target_dir / f"{scan_id}.json"

    payload = {
        "recorded_from_live_run": True,
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "scan_id": scan_id,
        "scan": scan.model_dump(mode="json"),
        "findings": [f.model_dump(mode="json") for f in findings],
        "sources": all_sources,
        "activity": activity,
        "dependency_graph": graph,
    }

    sanitized = _redact_secrets(payload)

    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(sanitized, f, indent=2)

    return out_file


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Export scan run data to a recorded fixture.")
    parser.add_argument("scan_id", type=str, help="Scan ID to export")
    parser.add_argument("--output-dir", type=str, default="", help="Optional output directory")
    args = parser.parse_args(argv)

    out_dir = Path(args.output_dir).resolve() if args.output_dir else None
    try:
        path = export_scan_to_fixture(args.scan_id, output_dir=out_dir)
        print(f"Successfully exported scan {args.scan_id} to {path}")
        return 0
    except Exception as exc:
        print(f"Error exporting scan: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
