"""
Contract tests verifying signatures, shared model return types, budget rules,
and live-mode orchestrator execution with USE_STUBS=0.
All tests are offline with sockets strictly blocked.
"""
from __future__ import annotations

import asyncio
import datetime
import inspect
import json
import socket
from typing import Any, List
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

from app import baseline, db, orchestrator, tinyfish_client as tf
from app.models import (
    ActivityEvent,
    Dependency,
    Finding,
    IssueItem,
    NpmMeta,
    OsvResult,
    PageContent,
    ResearchResult,
    Scan,
    Signal,
    Source,
)


@pytest.fixture(autouse=True)
def block_network_sockets(monkeypatch):
    """Blocks real sockets, raising on any external connect or getaddrinfo."""
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
def clean_test_env(tmp_path):
    """Isolate DB and module client for each contract test."""
    temp_db_path = str(tmp_path / "contract_test.db")
    db.set_db_path(temp_db_path)
    tf._mem_cache.clear()
    tf.set_module_client(None)
    yield
    tf.set_module_client(None)


class FakeLedger:
    def __init__(self, dev_cap: int = 48, total_cap: int = 64, initial_count: int = 0):
        self.dev_cap = dev_cap
        self.total_cap = total_cap
        self.count = initial_count
        self.reservations = []

    def reserve(self, stage: str, development_cap: int, total_cap: int):
        self.reservations.append((stage, development_cap, total_cap))
        cap = development_cap if stage == "development" else total_cap
        if self.count >= cap:
            return (False, self.count, self.count if stage == "development" else 0)
        self.count += 1
        dev_used = self.count if stage == "development" else 0
        return (True, self.count, dev_used)


def make_mock_sdk():
    sdk = MagicMock()
    sdk.search.query = AsyncMock(
        return_value={
            "results": [
                {
                    "url": "https://advisories.example.org/npm/vuln-1",
                    "title": "Advisory 1",
                    "snippet": "Malicious payload found",
                    "date": "2026-10-20",
                },
                {
                    "url": "https://news.example.org/alerts/sec-2",
                    "title": "News 2",
                    "snippet": "Vulnerability alert",
                    "date": "2026-10-21",
                },
            ]
        }
    )
    sdk.fetch.get_contents = AsyncMock(
        return_value={
            "results": [
                {
                    "url": "https://advisories.example.org/npm/vuln-1",
                    "title": "Advisory 1",
                    "text": "Detailed advisory report text with evidence.",
                },
                {
                    "url": "https://news.example.org/alerts/sec-2",
                    "title": "News 2",
                    "text": "News article report confirming exploit.",
                },
            ]
        }
    )
    sdk.agent.run = AsyncMock(
        return_value={
            "issues": [
                {
                    "title": "Issue #101: RCE in parser",
                    "url": "https://github.com/example/repo/issues/101",
                    "opened": "2026-10-22",
                    "snippet": "Remote code execution reported in parser hook.",
                }
            ]
        }
    )
    sdk.monitors.create = AsyncMock(return_value=MagicMock(id="mon_contract_123"))
    sdk.monitors.run = AsyncMock(return_value={"monitor_id": "mon_contract_123", "status": "ok"})
    sdk.monitors.pause = AsyncMock(return_value={"status": "paused"})
    sdk.research.queue = AsyncMock(return_value=MagicMock(id="res_contract_456"))
    sdk.research.get = AsyncMock(
        return_value=MagicMock(
            research_run_id="res_contract_456",
            status="COMPLETED",
            deep_result={"result": "Deep research analysis completed."},
            evidence=[
                {
                    "url": "https://evidence.example.org/report",
                    "title": "Audit Report",
                    "claims": [{"snippet": "Signing key verification confirmed clean."}],
                }
            ],
        )
    )
    return sdk


# ---------------------------------------------------------------------------
# 1. Signature Verification Tests (matching AGENTS.md exactly)
# ---------------------------------------------------------------------------

def test_contract_function_signatures():
    """Verify that all 9 contract functions match the exact parameter signatures in AGENTS.md."""
    # 1. osv_lookup(ecosystem: str, package: str, version: str, *, scan_id: str | None = None, emit: Emit | None = None) -> OsvResult
    sig_osv = inspect.signature(baseline.osv_lookup)
    params_osv = list(sig_osv.parameters.values())
    assert [p.name for p in params_osv] == ["ecosystem", "package", "version", "scan_id", "emit"]
    assert params_osv[0].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_osv[1].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_osv[2].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_osv[3].kind == inspect.Parameter.KEYWORD_ONLY and params_osv[3].default is None
    assert params_osv[4].kind == inspect.Parameter.KEYWORD_ONLY and params_osv[4].default is None

    # 2. npm_metadata(package: str, version: str, *, scan_id: str | None = None, emit: Emit | None = None) -> NpmMeta
    sig_npm = inspect.signature(baseline.npm_metadata)
    params_npm = list(sig_npm.parameters.values())
    assert [p.name for p in params_npm] == ["package", "version", "scan_id", "emit"]
    assert params_npm[0].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_npm[1].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_npm[2].kind == inspect.Parameter.KEYWORD_ONLY and params_npm[2].default is None
    assert params_npm[3].kind == inspect.Parameter.KEYWORD_ONLY and params_npm[3].default is None

    # 3. search_signals(package: str, version: str, *, before_date: str | None = None, scan_id: str | None = None, emit: Emit | None = None) -> list[Source]
    sig_search = inspect.signature(tf.search_signals)
    params_search = list(sig_search.parameters.values())
    assert [p.name for p in params_search] == ["package", "version", "before_date", "scan_id", "emit"]
    assert params_search[0].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_search[1].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_search[2].kind == inspect.Parameter.KEYWORD_ONLY and params_search[2].default is None
    assert params_search[3].kind == inspect.Parameter.KEYWORD_ONLY and params_search[3].default is None
    assert params_search[4].kind == inspect.Parameter.KEYWORD_ONLY and params_search[4].default is None

    # 4. fetch_pages(sources: list[Source], *, scan_id: str | None = None, emit: Emit | None = None) -> list[PageContent]
    sig_fetch = inspect.signature(tf.fetch_pages)
    params_fetch = list(sig_fetch.parameters.values())
    assert [p.name for p in params_fetch] == ["sources", "scan_id", "emit"]
    assert params_fetch[0].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_fetch[1].kind == inspect.Parameter.KEYWORD_ONLY and params_fetch[1].default is None
    assert params_fetch[2].kind == inspect.Parameter.KEYWORD_ONLY and params_fetch[2].default is None

    # 5. agent_scan_issues(issues_url: str, *, scan_id: str | None = None, emit: Emit | None = None) -> list[IssueItem]
    sig_agent = inspect.signature(tf.agent_scan_issues)
    params_agent = list(sig_agent.parameters.values())
    assert [p.name for p in params_agent] == ["issues_url", "scan_id", "emit"]
    assert params_agent[0].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD
    assert params_agent[1].kind == inspect.Parameter.KEYWORD_ONLY and params_agent[1].default is None

    # 6. create_topic_monitor(package: str, *, scan_id: str | None = None, emit: Emit | None = None) -> str
    sig_mon_create = inspect.signature(tf.create_topic_monitor)
    params_mon_create = list(sig_mon_create.parameters.values())
    assert [p.name for p in params_mon_create] == ["package", "scan_id", "emit"]
    assert params_mon_create[0].kind == inspect.Parameter.POSITIONAL_OR_KEYWORD

    # 7. run_monitor_now(monitor_id: str, *, scan_id: str | None = None, emit: Emit | None = None) -> dict
    sig_mon_run = inspect.signature(tf.run_monitor_now)
    params_mon_run = list(sig_mon_run.parameters.values())
    assert [p.name for p in params_mon_run] == ["monitor_id", "scan_id", "emit"]

    # 8. pause_topic_monitor(monitor_id: str, *, scan_id: str | None = None, emit: Emit | None = None) -> bool
    sig_mon_pause = inspect.signature(tf.pause_topic_monitor)
    params_mon_pause = list(sig_mon_pause.parameters.values())
    assert [p.name for p in params_mon_pause] == ["monitor_id", "scan_id", "emit"]

    # 9. research_report(query: str, *, scan_id: str | None = None, emit: Emit | None = None) -> ResearchResult
    sig_research = inspect.signature(tf.research_report)
    params_research = list(sig_research.parameters.values())
    assert [p.name for p in params_research] == ["query", "scan_id", "emit"]


# ---------------------------------------------------------------------------
# 2. Return Types and Contract Mapping Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_contract_osv_mapping(monkeypatch):
    """osv_lookup maps success to queried=True, and failure/error to queried=False + error."""
    events = []

    async def emit(e: ActivityEvent):
        events.append(e)

    # 1. Success with vulnerabilities
    mock_post = AsyncMock(
        return_value=httpx.Response(
            200,
            json={"vulns": [{"id": "GHSA-xxxx-1111"}, {"id": "GHSA-yyyy-2222"}]},
            request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
        )
    )
    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    res_vuln = await baseline.osv_lookup("npm", "test-pkg", "1.0.0", scan_id="s1", emit=emit)
    assert isinstance(res_vuln, OsvResult)
    assert res_vuln.queried is True
    assert res_vuln.vuln_ids == ["GHSA-xxxx-1111", "GHSA-yyyy-2222"]
    assert res_vuln.error is None

    # Check emitted start and ok events
    assert any(e.api == "osv" and e.action == "lookup" and e.status == "start" for e in events)
    assert any(e.api == "osv" and e.action == "lookup" and e.status == "ok" for e in events)

    # 2. Success with 0 vulnerabilities (clean)
    mock_post.return_value = httpx.Response(
        200,
        json={"vulns": []},
        request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
    )
    res_clean = await baseline.osv_lookup("npm", "test-clean", "1.0.0", scan_id="s1")
    assert isinstance(res_clean, OsvResult)
    assert res_clean.queried is True
    assert res_clean.vuln_ids == []
    assert res_clean.error is None

    # 3. HTTP 500 error -> queried=False, error populated (never clean)
    mock_post.return_value = httpx.Response(
        500,
        text="Internal Server Error",
        request=httpx.Request("POST", "https://api.osv.dev/v1/query"),
    )
    res_err = await baseline.osv_lookup("npm", "test-err", "1.0.0", scan_id="s1")
    assert isinstance(res_err, OsvResult)
    assert res_err.queried is False
    assert res_err.vuln_ids == []
    assert res_err.error is not None
    assert "500" in res_err.error


@pytest.mark.asyncio
async def test_contract_npm_mapping(monkeypatch):
    """npm_metadata returns shared NpmMeta model with parsed fields or safe 404."""
    # 1. Success with metadata
    mock_get = AsyncMock(
        return_value=httpx.Response(
            200,
            json={
                "name": "sample-pkg",
                "version": "1.2.3",
                "repository": {"url": "git+https://github.com/example/sample-pkg.git"},
                "deprecated": "This version is deprecated",
                "maintainers": [{"name": "alice"}, {"name": "bob"}],
            },
            request=httpx.Request("GET", "https://registry.npmjs.org/sample-pkg/1.2.3"),
        )
    )
    monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

    res = await baseline.npm_metadata("sample-pkg", "1.2.3")
    assert isinstance(res, NpmMeta)
    assert res.name == "sample-pkg"
    assert res.version == "1.2.3"
    assert res.repo_url == "https://github.com/example/sample-pkg"
    assert res.issues_url == "https://github.com/example/sample-pkg/issues"
    assert res.deprecated == "This version is deprecated"
    assert res.maintainers == ["alice", "bob"]

    # 2. 404 Not Found returns NpmMeta without error
    mock_get.return_value = httpx.Response(
        404,
        text="Not Found",
        request=httpx.Request("GET", "https://registry.npmjs.org/missing-pkg/1.0.0"),
    )
    res_404 = await baseline.npm_metadata("missing-pkg", "1.0.0")
    assert isinstance(res_404, NpmMeta)
    assert res_404.name == "missing-pkg"
    assert res_404.latest is None


@pytest.mark.asyncio
async def test_contract_tinyfish_module_functions():
    """Verify tinyfish_client module-level functions return shared models."""
    ledger = FakeLedger()
    mock_sdk = make_mock_sdk()
    client = tf.TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)
    tf.set_module_client(client)

    events: List[ActivityEvent] = []

    async def emit(e: ActivityEvent):
        events.append(e)

    # 1. search_signals -> list[Source]
    sources = await tf.search_signals("lodash", "4.17.21", scan_id="s1", emit=emit)
    assert isinstance(sources, list)
    assert len(sources) > 0
    assert all(isinstance(s, Source) for s in sources)
    assert sources[0].domain == "advisories.example.org"
    assert sources[0].discovered_by == "search"

    # 2. fetch_pages -> list[PageContent]
    pages = await tf.fetch_pages(sources, scan_id="s1", emit=emit)
    assert isinstance(pages, list)
    assert len(pages) > 0
    assert all(isinstance(p, PageContent) for p in pages)
    assert pages[0].discovered_by == "fetch"

    # 3. agent_scan_issues -> list[IssueItem]
    issues = await tf.agent_scan_issues("https://github.com/example/repo/issues", scan_id="s1", emit=emit)
    assert isinstance(issues, list)
    assert all(isinstance(i, IssueItem) for i in issues)

    # 4. create_topic_monitor -> str
    mon_id = await tf.create_topic_monitor("lodash", scan_id="s1", emit=emit)
    assert isinstance(mon_id, str) and mon_id == "mon_contract_123"

    # 5. run_monitor_now -> dict
    mon_run = await tf.run_monitor_now(mon_id, scan_id="s1", emit=emit)
    assert isinstance(mon_run, dict)

    # 6. pause_topic_monitor -> bool
    paused = await tf.pause_topic_monitor(mon_id, scan_id="s1", emit=emit)
    assert paused is True

    # 7. research_report -> ResearchResult
    res_report = await tf.research_report("is lodash vulnerable?", scan_id="s1", emit=emit)
    assert isinstance(res_report, ResearchResult)
    assert res_report.run_id == "res_contract_456"
    assert len(res_report.sources) > 0

    # Verify ActivityEvents were emitted with valid Literals
    assert any(e.api == "search" and e.status == "ok" for e in events)
    assert any(e.api == "fetch" and e.status == "ok" for e in events)
    assert any(e.api == "agent" and e.status == "ok" for e in events)
    assert any(e.api == "monitor" and e.status == "ok" for e in events)
    assert any(e.api == "research" and e.status == "ok" for e in events)


# ---------------------------------------------------------------------------
# 3. Budget Rules Enforcement via Contract Functions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_contract_budget_rules():
    """Verify budget rules: 1 unit per outbound call, cache hit 0, 2 searches max per package."""
    ledger = FakeLedger(dev_cap=5, total_cap=5)
    mock_sdk = make_mock_sdk()
    client = tf.TinyFishClient(
        sdk_client=mock_sdk,
        reserve_fn=ledger.reserve,
        live_enabled=True,
        dev_cap=5,
        total_cap=5,
    )
    tf.set_module_client(client)

    # search_signals runs 2 search queries -> exactly 2 reservations
    await tf.search_signals("express", "4.18.2")
    assert ledger.count == 2
    assert mock_sdk.search.query.await_count == 2

    # Repeat same search -> served from cache -> 0 new reservations
    await tf.search_signals("express", "4.18.2")
    assert ledger.count == 2
    assert mock_sdk.search.query.await_count == 2

    # fetch_pages for 2 sources is 1 batch Fetch -> exactly 1 reservation
    sources = [
        Source(url="https://example.com/one"),
        Source(url="https://example.com/two"),
    ]
    await tf.fetch_pages(sources)
    assert ledger.count == 3
    assert mock_sdk.fetch.get_contents.await_count == 1

    # When budget cap is exhausted, contract functions return empty results without raising
    ledger.count = 5  # Cap reached (5 >= 5)
    empty_sources = await tf.search_signals("new-pkg", "1.0.0")
    assert empty_sources == []

    pause_failed = await tf.pause_topic_monitor("mon_fail")
    assert pause_failed is False


# ---------------------------------------------------------------------------
# 4. Orchestrator Run with USE_STUBS=0
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_orchestrator_live_mode_with_use_stubs_zero(monkeypatch):
    """
    Live-mode orchestrator run with USE_STUBS=0 completes without AttributeError/TypeError,
    uses contract functions, and saves findings.
    """
    from app.config import settings
    orig_use_stubs = settings.use_stubs
    monkeypatch.setenv("USE_STUBS", "0")
    monkeypatch.setenv("TINYFISH_LIVE_ENABLED", "1")
    settings.use_stubs = False

    try:
        ledger = FakeLedger()
        mock_sdk = make_mock_sdk()
        client = tf.TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)
        tf.set_module_client(client)

        # Mock OSV and npm httpx responses
        async def mock_post(url, *args, **kwargs):
            return httpx.Response(200, json={"vulns": []}, request=httpx.Request("POST", str(url)))

        async def mock_get(url, *args, **kwargs):
            return httpx.Response(200, json={"version": "1.0.0", "maintainers": []}, request=httpx.Request("GET", str(url)))

        monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

        # Mock classifier to avoid requiring GEMINI_MODEL in offline tests
        mock_signal = Signal(
            url="https://advisories.example.org/npm/vuln-1",
            security_relevant=True,
            claim="Malicious payload found",
            version_match="confirmed",
            severity="high",
            evidence_quote="Malicious payload found",
        )
        monkeypatch.setattr(
            "app.classifier.classify",
            AsyncMock(return_value=[mock_signal]),
            raising=False,
        )

        lockfile_json = json.dumps({
            "name": "test-contract-project",
            "version": "1.0.0",
            "lockfileVersion": 2,
            "packages": {
                "": {
                    "name": "test-contract-project",
                    "dependencies": {
                        "lodash": "4.17.21"
                    }
                },
                "node_modules/lodash": {
                    "version": "4.17.21",
                    "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
                    "integrity": "sha512-test"
                }
            }
        })

        scan_id = "scan_contract_001"
        db.create_scan(Scan(id=scan_id, status="queued", mode="upload"))

        # Run scan with USE_STUBS=0
        await orchestrator.run_scan(scan_id, lockfile_json)

        scan_data = db.get_scan(scan_id)
        assert scan_data is not None
        assert scan_data.status == "done"
        assert scan_data.packages_done >= 1
    finally:
        settings.use_stubs = orig_use_stubs


# ---------------------------------------------------------------------------
# 5. Adversarial Tests (Step D)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_contract_adversarial_malformed_search_results():
    """Adversarial test: malformed search response (None items, ints, missing fields) does not crash."""
    ledger = FakeLedger()
    mock_sdk = MagicMock()
    mock_sdk.search.query = AsyncMock(
        return_value={
            "results": [
                None,
                1234,
                {},
                {"title": "Missing URL"},
                {"url": "https://valid.example.org/advisory", "snippet": "Found bug"},
            ]
        }
    )
    client = tf.TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)
    tf.set_module_client(client)

    sources = await tf.search_signals("adversarial-pkg", "1.0.0")
    assert isinstance(sources, list)
    assert len(sources) == 1
    assert sources[0].url == "https://valid.example.org/advisory"


@pytest.mark.asyncio
async def test_contract_adversarial_gigantic_page_text():
    """Adversarial test: fetch response with gigantic payload is truncated to 20000 chars."""
    ledger = FakeLedger()
    mock_sdk = MagicMock()
    giant_text = "VULNERABILITY EVIDENCE " * 5000  # > 100,000 chars
    mock_sdk.fetch.get_contents = AsyncMock(
        return_value={
            "results": [
                {"url": "https://example.org/giant", "text": giant_text}
            ]
        }
    )
    client = tf.TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)
    tf.set_module_client(client)

    pages = await tf.fetch_pages([Source(url="https://example.org/giant")])
    assert len(pages) == 1
    assert len(pages[0].text) <= 20000


@pytest.mark.asyncio
async def test_contract_adversarial_unexpected_research_response():
    """Adversarial test: research report response with unexpected shape handles safely."""
    ledger = FakeLedger()
    mock_sdk = MagicMock()
    mock_sdk.research.queue = AsyncMock(return_value={"id": "res_bad"})
    # Status endpoint returns dict with no deep_result and empty evidence
    mock_sdk.research.get = AsyncMock(return_value={"id": "res_bad", "status": "COMPLETED"})

    client = tf.TinyFishClient(sdk_client=mock_sdk, reserve_fn=ledger.reserve, live_enabled=True)
    tf.set_module_client(client)

    res = await tf.research_report("weird query")
    assert isinstance(res, ResearchResult)
    assert res.run_id == "res_bad"
    assert res.sources == []
