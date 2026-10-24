"""Offline tests for tinyfish_client: fakes return REAL SDK response models, so field names are verified."""
import asyncio
from types import SimpleNamespace

import pytest
from tinyfish import (
    AgentRunResponse, FetchResponse, FetchResult, MonitorCreateResponse, MonitorRunResponse,
    ResearchRunAsyncResponse, ResearchRunDetail, RunStatus, SearchQueryResponse, SearchResult,
)

from app import tinyfish_client as tf
from app.models import Source


def run(coro):
    return asyncio.run(coro)


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    tf._mem_cache.clear()
    tf._mem_usage.clear()
    monkeypatch.setenv("USE_CACHE", "1")
    monkeypatch.setenv("SEARCH_QUERIES_PER_PACKAGE", "2")
    monkeypatch.setenv("MAX_URLS_FETCHED_PER_PACKAGE", "3")
    monkeypatch.setenv("RESEARCH_POLL_S", "0")
    yield


def sr(pos, url, title, snippet="", date=None):
    return SearchResult(position=pos, site_name="s", snippet=snippet, title=title, url=url, date=date)


class FakeSearch:
    def __init__(self, results):
        self.results, self.calls = results, []

    async def query(self, query, **kw):
        self.calls.append((query, kw))
        return SearchQueryResponse(query=query, results=self.results, total_results=len(self.results), page=1)


def patch_client(monkeypatch, **resources):
    monkeypatch.setattr(tf, "_client", lambda: SimpleNamespace(**resources))


def collector():
    events = []

    async def emit(e):
        events.append(e)

    return events, emit


def test_classify_source():
    assert tf.classify_source("https://github.com/o/r/issues/116") == "github_issue"
    assert tf.classify_source("https://github.com/advisories/GHSA-xxxx") == "advisory"
    assert tf.classify_source("https://security.snyk.io/vuln/SNYK-JS-X") == "advisory"
    assert tf.classify_source("https://www.bleepingcomputer.com/news/x") == "news"
    assert tf.classify_source("https://medium.com/@a/post") == "blog"
    assert tf.classify_source("https://news.ycombinator.com/item?id=1") == "forum"
    assert tf.classify_source("https://example.com/") == "other"


def test_search_dedupes_ranks_filters_and_caches(monkeypatch):
    results = [
        sr(1, "https://github.com/o/event-stream/issues/116", "event-stream backdoor reported", "malicious flatmap-stream", "2018-11-20"),
        sr(2, "https://github.com/o/event-stream/issues/116/?utm_source=x", "dupe", "dupe"),
        sr(3, "https://random.example.com/cooking", "best pasta recipes", "no relation"),
        sr(4, "https://medium.com/@a/event-stream-analysis", "event-stream analysis", "notes"),
    ]
    fake = FakeSearch(results)
    patch_client(monkeypatch, search=fake)
    events, emit = collector()
    out = run(tf.search_signals("event-stream", "3.3.6", before_date="2018-11-25", scan_id="s1", emit=emit))
    urls = [s.url for s in out]
    assert urls[0].startswith("https://github.com/o/event-stream/issues/116")
    assert len(urls) == len({tf._normalize_url(u) for u in urls}) == 2  # dupe merged, pasta filtered
    assert out[0].published_at is not None and out[0].source_type == "github_issue"
    assert all(kw.get("before_date") == "2018-11-25" for _, kw in fake.calls)
    n_calls = len(fake.calls)
    out2 = run(tf.search_signals("event-stream", "3.3.6", before_date="2018-11-25", scan_id="s1", emit=emit))
    assert len(fake.calls) == n_calls and [s.url for s in out2] == urls  # served from cache
    assert any(e.status == "cached" for e in events) and any(e.status == "ok" and e.api == "search" for e in events)


def test_search_survives_total_failure(monkeypatch):
    class Boom:
        async def query(self, *a, **k):
            raise ValueError("nope")

    patch_client(monkeypatch, search=Boom())
    assert run(tf.search_signals("x", "1.0.0")) == []


def test_fetch_pages_parses_and_reports_errors(monkeypatch):
    class FakeFetch:
        async def get_contents(self, urls, **kw):
            assert kw["format"] == "markdown"
            return FetchResponse.model_validate({
                "results": [{"url": urls[0], "title": "T", "text": "x" * 9000, "format": "markdown", "published_date": "2018-11-20"}],
                "errors": [{"url": urls[1], "error": "timeout"}] if len(urls) > 1 else [],
            })

    patch_client(monkeypatch, fetch=FakeFetch())
    events, emit = collector()
    srcs = [Source(url="https://a.example/1"), Source(url="https://a.example/2")]
    pages = run(tf.fetch_pages(srcs, scan_id="s1", emit=emit))
    assert len(pages) == 1 and len(pages[0].text) == 6000 and pages[0].published_at is not None
    assert any(e.status == "error" and e.detail == "timeout" for e in events)


def test_agent_budget_cap_and_blocked(monkeypatch):
    calls = []

    class FakeAgent:
        async def run(self, **kw):
            calls.append(kw)
            return AgentRunResponse.model_validate({
                "status": RunStatus.COMPLETED,
                "run_id": "run_1",
                "result": {
                    "blocked": False,
                    "issues": [
                        {
                            "title": "Possible RCE in parser",
                            "url": "https://github.com/o/r/issues/9",
                            "opened": "2026-01-01",
                            "snippet": "s",
                        }
                    ],
                },
                "num_of_steps": 4,
            })

    patch_client(monkeypatch, agent=FakeAgent())
    monkeypatch.setenv("MAX_AGENT_RUNS", "1")
    items = run(tf.agent_scan_issues("https://github.com/o/r/issues"))
    assert len(items) == 1 and items[0].title.startswith("Possible RCE")
    assert run(tf.agent_scan_issues("https://github.com/o/r2/issues")) == []  # cap reached, no call made
    assert len(calls) == 1

    class Blocked:
        async def run(self, **kw):
            return AgentRunResponse.model_validate({
                "status": RunStatus.COMPLETED,
                "run_id": "run_2",
                "result": {"blocked": True, "issues": []},
                "num_of_steps": 1,
            })

    tf._mem_usage.clear(); tf._mem_cache.clear()
    patch_client(monkeypatch, agent=Blocked())
    assert run(tf.agent_scan_issues("https://github.com/o/r3/issues")) == []


def test_monitor_create_cap_and_run(monkeypatch):
    now = "2026-10-24T10:00:00Z"
    monitor = {"id": "mon_1", "type": "search", "config": {"query": "q"}, "schedule_cron": "0 */6 * * *", "status": "active", "created_at": now, "updated_at": now}
    srun = {"id": "r1", "request_id": None, "query": "q", "status_code": 200, "result_count": 2,
            "results": [sr(1, "https://a.example/old", "old").model_dump(), sr(2, "https://a.example/new", "new thing").model_dump()],
            "new_result_positions": [2], "created_at": now}

    class FakeMonitors:
        async def create(self, **kw):
            assert kw["type"] == "search" and kw["config"]["query"].startswith("lodash")
            return MonitorCreateResponse.model_validate({"monitor": monitor, "run": srun})

        async def run(self, monitor_id):
            return MonitorRunResponse.model_validate({"run": srun})

    patch_client(monkeypatch, monitors=FakeMonitors())
    monkeypatch.setenv("MAX_MONITORS", "1")
    assert run(tf.create_topic_monitor("lodash")) == "mon_1"
    assert run(tf.create_topic_monitor("express")) == ""  # cap reached
    res = run(tf.run_monitor_now("mon_1"))
    assert res["total_results"] == 2 and [r["url"] for r in res["new_results"]] == ["https://a.example/new"]


def test_research_polls_until_done_and_caches(monkeypatch):
    states = iter(["RUNNING", "COMPLETED"])

    class FakeResearch:
        async def queue(self, **kw):
            assert kw["mode"] == "deep"
            return ResearchRunAsyncResponse(research_run_id="rr_1", error=None)

        async def get(self, run_id):
            st = next(states)
            d = {"research_run_id": run_id, "status": st, "query": "q", "run_ids": [], "quick_result": None,
                 "quick_result_summary": None, "deep_result": None, "created_at": None, "completed_at": None,
                 "error": None, "research_plan": None, "evidence": None, "iterations": None}
            if st == "COMPLETED":
                d["deep_result"] = {"result": "Report text", "citations": ["https://a.example/c1"]}
                d["evidence"] = [{"url": "https://a.example/c1", "title": "C1", "published_date": "2026-01-02",
                                  "subquestions_covered": [], "source_quality": "high",
                                  "claims": [{"claim": "c", "snippet": "snip", "subquestion_id": "1", "confidence": "high"}]}]
            return ResearchRunDetail.model_validate(d)

    patch_client(monkeypatch, research=FakeResearch())
    res = run(tf.research_report("is lodash 4.17.20 affected?"))
    assert res.run_id == "rr_1" and res.summary == "Report text" and res.sources[0].snippet == "snip"
    again = run(tf.research_report("is lodash 4.17.20 affected?"))  # cache: iterator is exhausted, so a 2nd call would raise
    assert again.summary == "Report text"


def test_research_budget_cap(monkeypatch):
    monkeypatch.setenv("MAX_RESEARCH_RUNS", "0")
    patch_client(monkeypatch, research=SimpleNamespace())
    res = run(tf.research_report("anything"))
    assert res.run_id == "" and "budget" in res.summary
