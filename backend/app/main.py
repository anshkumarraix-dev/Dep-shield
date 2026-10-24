"""FastAPI application for DepShield.

Owner: Ansh.
Exposes:
- GET /api/health
- GET /api/replay
- POST /api/scans (multipart package-lock.json upload)
- POST /api/replay/{case_id}
- GET /api/scans/{id}
- GET /api/scans/{id}/dependencies
- GET /api/scans/{id}/stream (SSE)
- POST /api/scans/{id}/research/{finding_id}
- POST /api/monitors, /api/monitors/{id}/run, /api/monitors/{id}/pause (explicit user-controlled monitoring)
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from pathlib import Path
from typing import Annotated, Any

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from . import db
from .config import settings
from .events import event_bus
from .models import Scan
from .orchestrator import run_research, run_scan

logger = logging.getLogger(__name__)

app = FastAPI(
    title="DepShield API",
    description="Developer-facing npm supply-chain threat-intelligence backend",
    version="1.0.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Replay cases index
# ---------------------------------------------------------------------------

DEFAULT_REPLAY_CASES = [
    {
        "id": "event-stream-2018",
        "title": "event-stream Compromise (Nov 2018)",
        "description": "Malicious dependency flatmap-stream injected targeting copay cryptocurrency wallet.",
        "as_of_date": "2018-11-26",
    },
    {
        "id": "ua-parser-js-2021",
        "title": "ua-parser-js Account Takeover (Oct 2021)",
        "description": "Hijacked maintainer account publishing credential-stealing trojans in 0.7.29, 0.8.0, 1.0.0.",
        "as_of_date": "2021-10-22",
    },
    {
        "id": "benign-control-clean",
        "title": "Benign Control: Clean Project",
        "description": "Standard modern React/Express lockfile with uncompromised baseline packages.",
        "as_of_date": "2026-01-01",
    },
]


def _get_replay_cases() -> list[dict[str, Any]]:
    # Check if eval/cases.json exists
    eval_cases_file = Path(__file__).resolve().parent.parent.parent / "eval" / "cases.json"
    if eval_cases_file.exists():
        try:
            with open(eval_cases_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list) and data:
                    return data
        except (OSError, json.JSONDecodeError) as e:
            logger.warning("Failed to read eval/cases.json: %s", e)
    return DEFAULT_REPLAY_CASES


def _get_replay_lockfile(case_id: str) -> str:
    # Check fixtures/lockfiles or synthesize realistic lockfile
    fixture_dir = Path(__file__).resolve().parent.parent / "fixtures" / "lockfiles"
    case_path = fixture_dir / f"{case_id}.json"
    if case_path.exists():
        return case_path.read_text(encoding="utf-8")

    # Synthesize realistic sample lockfile for replay
    if "event-stream" in case_id:
        return json.dumps({
            "name": "crypto-app",
            "version": "1.0.0",
            "lockfileVersion": 2,
            "packages": {
                "": {
                    "name": "crypto-app",
                    "dependencies": {"event-stream": "3.3.6"}
                },
                "node_modules/event-stream": {
                    "name": "event-stream",
                    "version": "3.3.6",
                    "dependencies": {"flatmap-stream": "0.1.1"}
                },
                "node_modules/flatmap-stream": {
                    "name": "flatmap-stream",
                    "version": "0.1.1"
                }
            }
        })

    # Benign / generic sample
    return json.dumps({
        "name": "secure-app",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {
                "name": "secure-app",
                "dependencies": {"express": "4.18.2", "lodash": "4.17.21"}
            },
            "node_modules/express": {
                "name": "express",
                "version": "4.18.2"
            },
            "node_modules/lodash": {
                "name": "lodash",
                "version": "4.17.21"
            }
        }
    })


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------


@app.get("/api/health")
async def health_check() -> dict[str, Any]:
    total_used, dev_used, _ = db.get_tinyfish_usage()
    return {
        "status": "ok",
        "use_stubs": settings.use_stubs,
        "tinyfish_live_enabled": settings.tinyfish_live_enabled,
        "budget_stage": settings.tinyfish_budget_stage,
        "tinyfish_requests_used": total_used,
        "tinyfish_development_used": dev_used,
        "tinyfish_max_development": settings.tinyfish_max_requests_development,
        "tinyfish_max_total": settings.tinyfish_max_requests_total,
    }


@app.get("/api/replay")
async def list_replay_cases() -> list[dict[str, Any]]:
    return _get_replay_cases()


@app.post("/api/scans")
async def create_scan_upload(
    lockfile: Annotated[UploadFile, File()],
) -> dict[str, str]:
    if not lockfile.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing filename. Please upload package-lock.json.",
        )

    content_bytes = await lockfile.read()
    try:
        lockfile_text = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded package-lock.json is not valid UTF-8 text.",
        )

    scan_id = f"scan_{uuid.uuid4().hex[:12]}"
    scan = Scan(
        id=scan_id,
        status="queued",
        mode="upload",
    )
    db.create_scan(scan)

    # Spawn background pipeline execution
    asyncio.create_task(run_scan(scan_id, lockfile_text))
    return {"scan_id": scan_id}


@app.post("/api/replay/{case_id}")
async def create_replay_scan(case_id: str) -> dict[str, str]:
    cases = _get_replay_cases()
    selected_case = next((c for c in cases if c.get("id") == case_id), None)
    if not selected_case:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Replay case '{case_id}' not found.",
        )

    lockfile_text = _get_replay_lockfile(case_id)
    scan_id = f"scan_rep_{uuid.uuid4().hex[:10]}"
    scan = Scan(
        id=scan_id,
        status="queued",
        mode="replay",
        replay_case=case_id,
        as_of_date=selected_case.get("as_of_date"),
    )
    db.create_scan(scan)

    # Spawn background scan with date cutoff
    asyncio.create_task(run_scan(scan_id, lockfile_text, as_of_date=selected_case.get("as_of_date")))
    return {"scan_id": scan_id}


@app.get("/api/scans/{scan_id}")
async def get_scan_details(scan_id: str) -> dict[str, Any]:
    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan '{scan_id}' not found.",
        )
    findings = db.get_findings(scan_id)
    return {
        "scan": scan.model_dump(mode="json"),
        "findings": [f.model_dump(mode="json") for f in findings],
    }


@app.get("/api/scans/{scan_id}/dependencies")
async def get_scan_dependencies(scan_id: str) -> dict[str, Any]:
    graph = db.get_dependency_graph(scan_id)
    if not graph:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dependency graph for scan '{scan_id}' not found.",
        )
    nodes, edges = graph
    return {"nodes": nodes, "edges": edges}


@app.get("/api/scans/{scan_id}/stream")
async def stream_scan_events(scan_id: str) -> EventSourceResponse:
    scan = db.get_scan(scan_id)
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scan '{scan_id}' not found.",
        )

    async def event_generator():
        async for event in event_bus.subscribe(scan_id):
            yield {
                "event": event["event"],
                "data": event["data"],
            }

    return EventSourceResponse(event_generator())


@app.post("/api/scans/{scan_id}/research/{finding_id}")
async def trigger_finding_research(scan_id: str, finding_id: str) -> dict[str, Any]:
    finding = await run_research(scan_id, finding_id)
    if not finding:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Finding '{finding_id}' in scan '{scan_id}' not found.",
        )
    return finding.model_dump(mode="json")


# ---------------------------------------------------------------------------
# User-controlled Topic Monitoring (Explicit click only, not automatic)
# ---------------------------------------------------------------------------


class CreateMonitorRequest(BaseModel):
    package: str


@app.post("/api/monitors")
async def create_monitor_endpoint(req: CreateMonitorRequest) -> dict[str, str]:
    from .stubs import create_topic_monitor
    monitor_id = await create_topic_monitor(req.package)
    return {"monitor_id": monitor_id, "status": "created"}


@app.post("/api/monitors/{monitor_id}/run")
async def run_monitor_endpoint(monitor_id: str) -> dict[str, Any]:
    from .stubs import run_monitor_now
    res = await run_monitor_now(monitor_id)
    return res


@app.post("/api/monitors/{monitor_id}/pause")
async def pause_monitor_endpoint(monitor_id: str) -> dict[str, Any]:
    from .stubs import pause_topic_monitor
    paused = await pause_topic_monitor(monitor_id)
    return {"monitor_id": monitor_id, "paused": paused}
