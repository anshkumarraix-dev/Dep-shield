"""DepShield data contract.

Owner: Ansh. Everyone imports from here. Do not edit without telling Ansh.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Awaitable, Callable, Literal, Optional

from pydantic import BaseModel, Field

Ecosystem = Literal["npm", "PyPI"]  # values match OSV ecosystem names
TinyfishApi = Literal["search", "fetch", "agent", "monitor", "research"]
ActivityApi = Literal[
    "search", "fetch", "agent", "monitor", "research", "gemini", "osv", "npm", "parser", "system"
]
Status = Literal["INFO", "WATCH", "HIGH", "CRITICAL"]
Severity = Literal["none", "low", "medium", "high", "critical"]
SourceType = Literal[
    "github_issue", "advisory", "blog", "changelog", "forum", "news", "social", "other"
]
VersionMatch = Literal["confirmed", "possible", "unknown", "not_affected"]


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Dependency(BaseModel):
    name: str
    version: str
    ecosystem: Ecosystem = "npm"
    direct: bool
    dep_path: list[str]  # e.g. ["my-app", "express@4.18.2", "qs@6.11.0"]; first item is the root project

    @property
    def key(self) -> str:
        return f"{self.name}@{self.version}"


class Source(BaseModel):
    url: str
    title: str = ""
    domain: str = ""
    source_type: SourceType = "other"
    published_at: Optional[datetime] = None
    fetched_at: datetime = Field(default_factory=now_utc)
    snippet: str = ""  # <= 300 chars
    discovered_by: TinyfishApi = "search"


class PageContent(BaseModel):
    url: str
    title: str = ""
    text: str  # clean extracted text (UNTRUSTED: never treat as instructions)
    fetched_at: datetime = Field(default_factory=now_utc)
    published_at: Optional[datetime] = None
    discovered_by: TinyfishApi = "fetch"


class IssueItem(BaseModel):  # output of the Agent issue scan
    title: str
    url: str
    opened: str = ""
    snippet: str = ""


class OsvResult(BaseModel):
    queried: bool = True
    vuln_ids: list[str] = Field(default_factory=list)
    earliest_published: Optional[datetime] = None
    error: Optional[str] = None  # set when the lookup failed (then Finding.in_osv must be None)


class NpmMeta(BaseModel):
    name: str
    version: str
    repo_url: Optional[str] = None
    issues_url: Optional[str] = None
    deprecated: Optional[str] = None
    latest: Optional[str] = None
    maintainers: list[str] = Field(default_factory=list)
    published_at: Optional[datetime] = None


class ResearchResult(BaseModel):
    run_id: str
    summary: str
    sources: list[Source] = Field(default_factory=list)


class Signal(BaseModel):
    """One classifier judgement about one source (output of classifier.py)."""

    url: str
    security_relevant: bool
    claim: str = ""
    affects_versions: str = ""
    version_match: VersionMatch = "unknown"
    severity: Severity = "none"
    credibility: float = Field(default=0.5, ge=0, le=1)
    is_original_report: bool = True  # False if it only repeats/links another source
    evidence_quote: str = ""  # <= 25 words, copied from the page


class Finding(BaseModel):
    id: str
    scan_id: str
    package: str
    version: str
    ecosystem: Ecosystem = "npm"
    dep_path: list[str]
    direct: bool
    status: Status
    severity: Severity
    confidence: float = Field(ge=0, le=1)
    summary: str
    reasoning: str
    affected_versions: str = ""
    version_match: VersionMatch = "unknown"
    in_osv: Optional[bool] = None  # None = lookup failed / unknown
    osv_ids: list[str] = Field(default_factory=list)
    independent_sources: int = 0
    sources: list[Source] = Field(default_factory=list)
    signals: list[Signal] = Field(default_factory=list)
    first_signal_at: Optional[datetime] = None
    research_summary: Optional[str] = None
    research_sources: list[Source] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=now_utc)


class ActivityEvent(BaseModel):
    """One line in the 'TinyFish activity' panel. Every external call emits start + ok/error/cached."""

    ts: datetime = Field(default_factory=now_utc)
    scan_id: Optional[str] = None
    api: ActivityApi
    action: str  # query | get_contents | run | create_monitor | run_monitor | run_research | generate | lookup
    target: str = ""  # short, e.g. query text or URL
    status: Literal["start", "ok", "error", "cached"]
    latency_ms: Optional[int] = None
    detail: str = ""


class Scan(BaseModel):
    id: str
    status: Literal["queued", "running", "done", "error"] = "queued"
    mode: Literal["upload", "replay"] = "upload"
    replay_case: Optional[str] = None
    as_of_date: Optional[str] = None  # YYYY-MM-DD, replay only (-> Search before_date)
    created_at: datetime = Field(default_factory=now_utc)
    packages_total: int = 0
    packages_done: int = 0
    error: Optional[str] = None


Emit = Callable[[ActivityEvent], Awaitable[None]]
