"""Hardening and edge-case tests for DepShield orchestrator and API routes.

Verifies:
- 413 on oversized upload (> 5 MB)
- 400 on empty upload, invalid JSON, lockfileVersion 1, missing packages map
- Live mode fail-closed on broken module imports (scan ends 'error', no findings)
- Honest failure accounting:
  - All packages fail -> scan status 'error', error message 'All N packages failed analysis'
  - Some packages fail -> scan status 'done', error message 'Partial: X of N packages could not be analysed (not checked, NOT safe)'
- Page texts and strict_quotes reach build_finding (spy)
- Monitor routes: 403 when live disabled, error mappings for BudgetExceededError (429),
  LedgerUnavailableError (503), other TinyFish errors (502).
"""
from __future__ import annotations

import asyncio
import io
import json
import socket
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient

from app import db, orchestrator, stubs
from app.config import settings
from app.main import app
from app.models import Scan
from app.tinyfish_client import (
    BudgetExceededError,
    LedgerUnavailableError,
    TinyFishTimeoutError,
)


@pytest.fixture(autouse=True)
def block_network_sockets(monkeypatch):
    """Blocks real network sockets during offline test execution."""
    orig_connect = socket.socket.connect
    orig_socketpair = getattr(socket, "socketpair", None)

    def blocked_connect(self, *args, **kwargs):
        raise RuntimeError("Real network connect blocked during offline tests")

    def blocked_gai(*args, **kwargs):
        raise RuntimeError("Real DNS getaddrinfo blocked during offline tests")

    def safe_socketpair(*args, **kwargs):
        saved = socket.socket.connect
        socket.socket.connect = orig_connect
        try:
            if orig_socketpair is not None:
                return orig_socketpair(*args, **kwargs)
            raise OSError("socketpair not supported")
        finally:
            socket.socket.connect = saved

    if orig_socketpair is not None:
        monkeypatch.setattr(socket, "socketpair", safe_socketpair)
    monkeypatch.setattr(socket.socket, "connect", blocked_connect)
    monkeypatch.setattr(socket, "getaddrinfo", blocked_gai)


@pytest.fixture(autouse=True)
def isolate_test_db(tmp_path):
    """Isolate SQLite database for each test run."""
    db_path = str(tmp_path / "hardening_test.db")
    db.set_db_path(db_path)
    yield


def _make_valid_lockfile(pkg_name: str = "lodash", version: str = "4.17.21") -> str:
    return json.dumps({
        "name": "sample-app",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {
                "name": "sample-app",
                "dependencies": {pkg_name: version},
            },
            f"node_modules/{pkg_name}": {
                "version": version,
                "resolved": f"https://registry.npmjs.org/{pkg_name}/-/{pkg_name}-{version}.tgz",
            },
        },
    })


# ---------------------------------------------------------------------------
# 1. Upload Validation Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_oversized_upload_returns_413():
    """Uploads larger than 5 MB must be rejected with HTTP 413."""
    oversized_data = b" " * (5 * 1024 * 1024 + 10)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"lockfile": ("package-lock.json", io.BytesIO(oversized_data), "application/json")}
        resp = await client.post("/api/scans", files=files)
        assert resp.status_code == 413
        assert "5 MB" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_empty_upload_returns_400():
    """Empty file upload must be rejected with HTTP 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"lockfile": ("package-lock.json", io.BytesIO(b""), "application/json")}
        resp = await client.post("/api/scans", files=files)
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_json_returns_400():
    """Malformed non-JSON file upload must be rejected with HTTP 400."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"lockfile": ("package-lock.json", io.BytesIO(b"not json {[["), "application/json")}
        resp = await client.post("/api/scans", files=files)
        assert resp.status_code == 400
        assert "invalid JSON" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_lockfile_version_1_returns_400():
    """lockfileVersion 1 (npm v5/v6 format) must be rejected with user-readable HTTP 400."""
    v1_content = json.dumps({
        "name": "legacy-app",
        "lockfileVersion": 1,
        "dependencies": {"lodash": {"version": "4.17.21"}},
    }).encode("utf-8")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"lockfile": ("package-lock.json", io.BytesIO(v1_content), "application/json")}
        resp = await client.post("/api/scans", files=files)
        assert resp.status_code == 400
        assert "lockfileVersion 1" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_missing_packages_object_returns_400():
    """lockfileVersion 2 without a 'packages' dictionary must be rejected with HTTP 400."""
    corrupt_content = json.dumps({
        "name": "corrupt-app",
        "lockfileVersion": 2,
    }).encode("utf-8")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        files = {"lockfile": ("package-lock.json", io.BytesIO(corrupt_content), "application/json")}
        resp = await client.post("/api/scans", files=files)
        assert resp.status_code == 400
        assert "packages" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# 2. Pipeline Fail-Closed in Live Mode
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_live_mode_with_broken_import_fails_closed(monkeypatch):
    """When USE_STUBS=0 and a live module cannot be imported, the scan ends in 'error' with no findings."""
    orig_use_stubs = settings.use_stubs
    monkeypatch.setattr(settings, "use_stubs", False)

    import importlib
    orig_import_module = importlib.import_module

    def mock_import(name, package=None):
        if "classifier" in name or "tinyfish" in name:
            raise ImportError(f"Simulated broken live module import for {name}")
        return orig_import_module(name, package=package)

    monkeypatch.setattr(importlib, "import_module", mock_import)

    scan_id = "scan_live_broken_import"
    db.create_scan(Scan(id=scan_id, status="queued", mode="upload"))

    try:
        await orchestrator.run_scan(scan_id, _make_valid_lockfile())
        scan = db.get_scan(scan_id)
        assert scan is not None
        assert scan.status == "error"
        assert "Failed to load live pipeline modules" in (scan.error or "")

        # Verify no findings were produced
        findings = db.get_findings(scan_id)
        assert len(findings) == 0
    finally:
        monkeypatch.setattr(settings, "use_stubs", orig_use_stubs)


# ---------------------------------------------------------------------------
# 3. Honest Failure Accounting Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_all_packages_failing_ends_in_error(monkeypatch):
    """If ALL analysed packages raise during investigation, scan ends 'error' with count message."""
    lockfile_content = json.dumps({
        "name": "multi-pkg-fail",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {
                "name": "multi-pkg-fail",
                "dependencies": {"pkg-a": "1.0.0", "pkg-b": "2.0.0"},
            },
            "node_modules/pkg-a": {"version": "1.0.0"},
            "node_modules/pkg-b": {"version": "2.0.0"},
        },
    })

    # Cause all package analyses to raise
    async def failing_osv(*args, **kwargs):
        raise RuntimeError("Simulated crash in external lookup")

    monkeypatch.setattr(stubs, "osv_lookup", failing_osv)

    scan_id = "scan_all_fail"
    db.create_scan(Scan(id=scan_id, status="queued", mode="upload"))

    await orchestrator.run_scan(scan_id, lockfile_content)

    scan = db.get_scan(scan_id)
    assert scan is not None
    assert scan.status == "error"
    assert scan.error == "All 2 packages failed analysis"
    assert len(db.get_findings(scan_id)) == 0


@pytest.mark.asyncio
async def test_partial_package_failure_ends_in_done_with_partial_warning(monkeypatch):
    """If SOME packages raise, scan ends 'done' with the exact warning message in scan.error."""
    lockfile_content = json.dumps({
        "name": "partial-fail-app",
        "version": "1.0.0",
        "lockfileVersion": 2,
        "packages": {
            "": {
                "name": "partial-fail-app",
                "dependencies": {"event-stream": "3.3.6", "failing-pkg": "1.0.0"},
            },
            "node_modules/event-stream": {"version": "3.3.6"},
            "node_modules/failing-pkg": {"version": "1.0.0"},
        },
    })

    orig_search = stubs.search_signals

    async def selective_search(package, version, **kwargs):
        if package == "failing-pkg":
            raise RuntimeError("API timeout on failing-pkg")
        return await orig_search(package, version, **kwargs)

    monkeypatch.setattr(stubs, "search_signals", selective_search)

    scan_id = "scan_partial_fail"
    db.create_scan(Scan(id=scan_id, status="queued", mode="upload"))

    await orchestrator.run_scan(scan_id, lockfile_content)

    scan = db.get_scan(scan_id)
    assert scan is not None
    assert scan.status == "done"
    assert scan.error == "Partial: 1 of 2 packages could not be analysed (not checked, NOT safe)"

    # Verify that the working package was still saved
    findings = db.get_findings(scan_id)
    assert len(findings) >= 1
    assert any(f.package == "event-stream" for f in findings)


# ---------------------------------------------------------------------------
# 4. Quote Verification / Argument Propagation Spy
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_page_texts_and_strict_quotes_reach_build_finding_spy(monkeypatch):
    """Verifies that orchestrator passes page_texts and strict_quotes=True to build_finding."""
    spy = MagicMock(wraps=stubs.build_finding)
    monkeypatch.setattr(stubs, "build_finding", spy)

    scan_id = "scan_spy_build_finding"
    db.create_scan(Scan(id=scan_id, status="queued", mode="upload"))

    await orchestrator.run_scan(scan_id, _make_valid_lockfile("event-stream", "3.3.6"))

    assert spy.called
    kwargs = spy.call_args.kwargs
    assert "page_texts" in kwargs
    assert isinstance(kwargs["page_texts"], dict)
    assert "strict_quotes" in kwargs
    assert kwargs["strict_quotes"] is True


# ---------------------------------------------------------------------------
# 5. Monitor Endpoints: Access Control & TinyFishError Mapping
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_monitor_routes_403_when_live_disabled(monkeypatch):
    """In live mode (USE_STUBS=0), monitor endpoints return 403 when TINYFISH_LIVE_ENABLED=0."""
    orig_use_stubs = settings.use_stubs
    orig_live = settings.tinyfish_live_enabled
    monkeypatch.setattr(settings, "use_stubs", False)
    monkeypatch.setattr(settings, "tinyfish_live_enabled", False)

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Create monitor
            resp_create = await client.post("/api/monitors", json={"package": "lodash"})
            assert resp_create.status_code == 403
            assert "Live monitors are disabled" in resp_create.json()["detail"]

            # 2. Run monitor
            resp_run = await client.post("/api/monitors/mon_123/run")
            assert resp_run.status_code == 403
            assert "Live monitors are disabled" in resp_run.json()["detail"]

            # 3. Pause monitor
            resp_pause = await client.post("/api/monitors/mon_123/pause")
            assert resp_pause.status_code == 403
            assert "Live monitors are disabled" in resp_pause.json()["detail"]
    finally:
        monkeypatch.setattr(settings, "use_stubs", orig_use_stubs)
        monkeypatch.setattr(settings, "tinyfish_live_enabled", orig_live)


@pytest.mark.asyncio
async def test_monitor_routes_tinyfish_error_mapping(monkeypatch):
    """TinyFishError subclasses map correctly: BudgetExceeded->429, LedgerUnavailable->503, Timeout->502."""
    orig_use_stubs = settings.use_stubs
    orig_live = settings.tinyfish_live_enabled
    monkeypatch.setattr(settings, "use_stubs", False)
    monkeypatch.setattr(settings, "tinyfish_live_enabled", True)

    try:
        from app import tinyfish_client as tf

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. BudgetExceededError -> 429
            monkeypatch.setattr(
                tf,
                "create_topic_monitor",
                AsyncMock(side_effect=BudgetExceededError("Stage development cap 48 reached")),
            )
            resp = await client.post("/api/monitors", json={"package": "lodash"})
            assert resp.status_code == 429
            assert "budget exceeded" in resp.json()["detail"].lower()

            # 2. LedgerUnavailableError -> 503
            monkeypatch.setattr(
                tf,
                "run_monitor_now",
                AsyncMock(side_effect=LedgerUnavailableError("Database unavailable")),
            )
            resp = await client.post("/api/monitors/mon_123/run")
            assert resp.status_code == 503
            assert "ledger unavailable" in resp.json()["detail"].lower()

            # 3. TinyFishTimeoutError -> 502
            monkeypatch.setattr(
                tf,
                "pause_topic_monitor",
                AsyncMock(side_effect=TinyFishTimeoutError("Request timed out after 30s")),
            )
            resp = await client.post("/api/monitors/mon_123/pause")
            assert resp.status_code == 502
            assert "timed out" in resp.json()["detail"].lower()
    finally:
        monkeypatch.setattr(settings, "use_stubs", orig_use_stubs)
        monkeypatch.setattr(settings, "tinyfish_live_enabled", orig_live)
