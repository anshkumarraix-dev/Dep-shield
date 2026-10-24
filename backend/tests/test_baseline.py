"""Offline unit tests for baseline OSV and npm metadata lookups.

All tests mock HTTP calls via httpx and verify:
- Accurate extraction of vulnerability IDs and publication dates
- Safe error handling (failures set queried=False and never report a clean bill of health)
- Repository URL cleanup
- TTL caching behavior
- ActivityEvent emission
"""
from __future__ import annotations

import tempfile
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app import baseline, db
from app.models import ActivityEvent


@pytest.fixture(autouse=True)
def isolated_db(monkeypatch):
    """Ensure tests run against an isolated clean temporary SQLite DB."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_path = f.name
    db.set_db_path(temp_path)
    monkeypatch.setattr("app.config.settings.use_cache", True)
    yield temp_path


def make_collector():
    events: list[ActivityEvent] = []

    async def _emit(e: ActivityEvent):
        events.append(e)

    return events, _emit


@pytest.mark.asyncio
async def test_osv_lookup_vulnerabilities_found():
    mock_response = {
        "vulns": [
            {
                "id": "GHSA-35jh-r3h4-6jhm",
                "published": "2021-10-22T10:00:00Z",
                "details": "Malicious code injected",
            },
            {
                "id": "CVE-2021-43798",
                "published": "2021-10-21T08:00:00Z",
                "details": "Path traversal",
            },
        ]
    }

    events, emit = make_collector()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_response
        mock_post.return_value = mock_resp

        res = await baseline.osv_lookup("npm", "ua-parser-js", "0.7.29", scan_id="scan-1", emit=emit)

    assert res.queried is True
    assert res.error is None
    assert len(res.vuln_ids) == 2
    assert "GHSA-35jh-r3h4-6jhm" in res.vuln_ids
    assert "CVE-2021-43798" in res.vuln_ids
    assert res.earliest_published == datetime(2021, 10, 21, 8, 0, 0, tzinfo=timezone.utc)

    # Activity events verification
    assert len(events) == 2
    assert events[0].status == "start"
    assert events[1].status == "ok"
    assert "2 vulnerabilities found" in events[1].detail


@pytest.mark.asyncio
async def test_osv_lookup_clean_no_vulnerabilities():
    events, emit = make_collector()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"vulns": []}
        mock_post.return_value = mock_resp

        res = await baseline.osv_lookup("npm", "express", "4.18.2", scan_id="scan-2", emit=emit)

    assert res.queried is True
    assert res.error is None
    assert res.vuln_ids == []
    assert res.earliest_published is None

    assert any(e.status == "ok" and "0 vulnerabilities found" in e.detail for e in events)


@pytest.mark.asyncio
async def test_osv_lookup_http_error_fails_closed():
    events, emit = make_collector()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 503
        mock_resp.text = "Service Unavailable"
        mock_post.return_value = mock_resp

        res = await baseline.osv_lookup("npm", "lodash", "4.17.21", scan_id="scan-3", emit=emit)

    # Crucial requirement: failure must NEVER be marked queried=True or clean
    assert res.queried is False
    assert res.vuln_ids == []
    assert res.error is not None
    assert "503" in res.error

    assert any(e.status == "error" and "503" in e.detail for e in events)


@pytest.mark.asyncio
async def test_osv_lookup_timeout_handled():
    events, emit = make_collector()

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.side_effect = httpx.TimeoutException("Connection timed out")

        res = await baseline.osv_lookup("npm", "react", "18.2.0", scan_id="scan-4", emit=emit)

    assert res.queried is False
    assert res.vuln_ids == []
    assert res.error is not None
    assert "timed out" in res.error

    assert any(e.status == "error" and "timed out" in e.detail for e in events)


@pytest.mark.asyncio
async def test_osv_lookup_caching():
    mock_response = {"vulns": [{"id": "GHSA-test-123", "published": "2026-01-01T00:00:00Z"}]}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_response
        mock_post.return_value = mock_resp

        # First call: hits HTTP
        events1, emit1 = make_collector()
        res1 = await baseline.osv_lookup("npm", "cached-pkg", "1.0.0", scan_id="s1", emit=emit1)
        assert mock_post.call_count == 1
        assert res1.vuln_ids == ["GHSA-test-123"]

        # Second call: served from cache without second HTTP call
        events2, emit2 = make_collector()
        res2 = await baseline.osv_lookup("npm", "cached-pkg", "1.0.0", scan_id="s1", emit=emit2)
        assert mock_post.call_count == 1  # Not incremented
        assert res2.vuln_ids == ["GHSA-test-123"]
        assert any(e.status == "cached" for e in events2)


@pytest.mark.asyncio
async def test_npm_metadata_success():
    mock_data = {
        "name": "example-lib",
        "dist-tags": {"latest": "2.0.0"},
        "time": {
            "1.0.0": "2023-05-10T12:00:00.000Z",
            "2.0.0": "2024-01-01T00:00:00.000Z",
        },
        "versions": {
            "1.0.0": {
                "name": "example-lib",
                "version": "1.0.0",
                "repository": {"type": "git", "url": "git+https://github.com/example/lib.git"},
                "bugs": {"url": "https://github.com/example/lib/issues"},
                "maintainers": [{"name": "alice"}, {"name": "bob"}],
                "deprecated": "Please upgrade to v2.0.0",
            }
        },
    }

    events, emit = make_collector()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_get.return_value = mock_resp

        meta = await baseline.npm_metadata("example-lib", "1.0.0", scan_id="scan-5", emit=emit)

    assert meta.name == "example-lib"
    assert meta.version == "1.0.0"
    assert meta.repo_url == "https://github.com/example/lib"
    assert meta.issues_url == "https://github.com/example/lib/issues"
    assert meta.latest == "2.0.0"
    assert meta.maintainers == ["alice", "bob"]
    assert meta.deprecated == "Please upgrade to v2.0.0"
    assert meta.published_at == datetime(2023, 5, 10, 12, 0, 0, tzinfo=timezone.utc)

    assert any(e.status == "ok" for e in events)


@pytest.mark.asyncio
async def test_npm_metadata_404_not_found():
    events, emit = make_collector()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        meta = await baseline.npm_metadata("nonexistent-pkg", "1.0.0", scan_id="scan-6", emit=emit)

    assert meta.name == "nonexistent-pkg"
    assert meta.version == "1.0.0"
    assert meta.repo_url is None
    assert any(e.status == "error" and "not found" in e.detail for e in events)


@pytest.mark.asyncio
async def test_npm_metadata_timeout_handled():
    events, emit = make_collector()

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_get.side_effect = httpx.TimeoutException("Timeout")

        meta = await baseline.npm_metadata("slow-pkg", "1.0.0", scan_id="scan-7", emit=emit)

    # Must return safe fallback without raising
    assert meta.name == "slow-pkg"
    assert meta.version == "1.0.0"
    assert any(e.status == "error" and "timed out" in e.detail for e in events)


@pytest.mark.asyncio
async def test_npm_metadata_caching():
    mock_data = {
        "name": "pkg",
        "dist-tags": {"latest": "1.0.0"},
        "versions": {"1.0.0": {"name": "pkg", "version": "1.0.0"}},
    }

    with patch("httpx.AsyncClient.get", new_callable=AsyncMock) as mock_get:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_data
        mock_get.return_value = mock_resp

        events1, emit1 = make_collector()
        res1 = await baseline.npm_metadata("pkg", "1.0.0", scan_id="s2", emit=emit1)
        assert mock_get.call_count == 1
        assert res1.latest == "1.0.0"

        # Cache hit
        events2, emit2 = make_collector()
        res2 = await baseline.npm_metadata("pkg", "1.0.0", scan_id="s2", emit=emit2)
        assert mock_get.call_count == 1
        assert res2.latest == "1.0.0"
        assert any(e.status == "cached" for e in events2)


def test_clean_repo_url():
    assert baseline._clean_repo_url("git+https://github.com/foo/bar.git") == "https://github.com/foo/bar"
    assert baseline._clean_repo_url("git://github.com/foo/bar.git") == "https://github.com/foo/bar"
    assert baseline._clean_repo_url("ssh://git@github.com/foo/bar.git") == "https://github.com/foo/bar"
    assert baseline._clean_repo_url("github:foo/bar") == "https://github.com/foo/bar"
    assert baseline._clean_repo_url("https://github.com/foo/bar") == "https://github.com/foo/bar"
    assert baseline._clean_repo_url(None) is None
    assert baseline._clean_repo_url("") is None
