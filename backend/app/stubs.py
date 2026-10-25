"""Synthetic stubs matching the shared contract.

Owner: Ansh.
Provides offline mock data with:
- Clean package (no findings)
- Single-source WATCH finding
- Corroborated HIGH finding
- Realistic ActivityEvents for UI activity feed
All mock content is clearly labelled [SYNTHETIC].
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from urllib.parse import urlparse

from .models import (
    ActivityEvent,
    Dependency,
    Emit,
    Finding,
    IssueItem,
    NpmMeta,
    OsvResult,
    PageContent,
    ResearchResult,
    Signal,
    Source,
)


def _now() -> datetime:
    return datetime.now(UTC)


async def _emit_event(
    emit: Emit | None,
    scan_id: str | None,
    api: str,
    action: str,
    target: str,
    status: str,
    detail: str = "",
    latency_ms: int = 40,
) -> None:
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api=api,  # type: ignore
                action=action,
                target=target,
                status=status,  # type: ignore
                latency_ms=latency_ms,
                detail=detail,
            )
        )


async def osv_lookup(
    ecosystem: str,
    package: str,
    version: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> OsvResult:
    target = f"{package}@{version}"
    await _emit_event(emit, scan_id, "osv", "lookup", target, "start")
    await asyncio.sleep(0.02)

    # In our synthetic world, mock packages do not have existing OSV entries unless specified
    await _emit_event(emit, scan_id, "osv", "lookup", target, "ok", "0 vulnerabilities found")
    return OsvResult(queried=True, vuln_ids=[], earliest_published=None, error=None)


async def npm_metadata(
    package: str,
    version: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> NpmMeta:
    target = f"{package}@{version}"
    await _emit_event(emit, scan_id, "npm", "lookup", target, "start")
    await asyncio.sleep(0.02)
    await _emit_event(emit, scan_id, "npm", "lookup", target, "ok", "Registry metadata retrieved")

    return NpmMeta(
        name=package,
        version=version,
        repo_url=f"https://github.com/synthetic/{package}",
        issues_url=f"https://github.com/synthetic/{package}/issues",
        latest=version,
        maintainers=["synthetic-maintainer"],
        published_at=_now(),
    )


async def search_signals(
    package: str,
    version: str,
    *,
    before_date: str | None = None,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[Source]:
    target = f'"{package}" security OR exploit OR advisory'
    await _emit_event(emit, scan_id, "search", "query", target, "start")
    await asyncio.sleep(0.03)

    pkg_lower = package.lower()

    if "event-stream" in pkg_lower or "high" in pkg_lower or "flatmap" in pkg_lower:
        # Corroborated HIGH case: 2 independent sources
        sources = [
            Source(
                url="https://advisory.synthetic.test/GHSA-synth-01",
                title=f"[SYNTHETIC] Malicious injection in {package}",
                domain="advisory.synthetic.test",
                source_type="advisory",
                published_at=_now(),
                snippet=f"[SYNTHETIC] Version {version} contains malicious payload targeting credentials.",
                discovered_by="search",
            ),
            Source(
                url="https://threatpost.synthetic.test/news/supply-chain-alert",
                title=f"[SYNTHETIC] Threat intel report on {package} compromise",
                domain="threatpost.synthetic.test",
                source_type="news",
                published_at=_now(),
                snippet=f"[SYNTHETIC] Independent security researchers confirm {version} injects unauthorized code.",
                discovered_by="search",
            ),
        ]
        await _emit_event(emit, scan_id, "search", "query", target, "ok", f"Found {len(sources)} sources")
        return sources

    if "debug" in pkg_lower or "watch" in pkg_lower or "minimist" in pkg_lower:
        # Single-source WATCH case: 1 source
        sources = [
            Source(
                url="https://forum.synthetic.test/threads/unverified-behavior",
                title=f"[SYNTHETIC] Community discussion regarding {package} {version}",
                domain="forum.synthetic.test",
                source_type="forum",
                published_at=_now(),
                snippet=f"[SYNTHETIC] Possible unexpected prototype pollution behavior noticed in {version}.",
                discovered_by="search",
            )
        ]
        await _emit_event(emit, scan_id, "search", "query", target, "ok", f"Found {len(sources)} sources")
        return sources

    # Clean package: 0 security signals found
    await _emit_event(emit, scan_id, "search", "query", target, "ok", "0 security signals found")
    return []


async def fetch_pages(
    sources: list[Source],
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[PageContent]:
    if not sources:
        return []

    target = f"{len(sources)} URLs"
    await _emit_event(emit, scan_id, "fetch", "get_contents", target, "start")
    await asyncio.sleep(0.04)

    pages: list[PageContent] = []
    for s in sources:
        quote = s.snippet or f"Discussion of {s.title}"
        text = f"{s.title}\n\nPublication Date: 2026-10-24\n\nDetailed analysis:\n{quote}\n\nEvidence confirms matching package dependencies."
        pages.append(
            PageContent(
                url=s.url,
                title=s.title,
                text=text,
                fetched_at=_now(),
                published_at=s.published_at,
                discovered_by="fetch",
            )
        )

    await _emit_event(emit, scan_id, "fetch", "get_contents", target, "ok", f"Fetched {len(pages)} pages")
    return pages


async def classify(
    dep: Dependency,
    pages: list[PageContent],
    osv: OsvResult,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[Signal]:
    target = f"{dep.name}@{dep.version}"
    await _emit_event(emit, scan_id, "gemini", "generate", target, "start")
    await asyncio.sleep(0.03)

    if not pages:
        await _emit_event(emit, scan_id, "gemini", "generate", target, "ok", "No evidence pages to classify")
        return []

    signals: list[Signal] = []
    for page in pages:
        if "advisory" in page.url or "threatpost" in page.url:
            signals.append(
                Signal(
                    url=page.url,
                    security_relevant=True,
                    claim=f"[SYNTHETIC] Verified malicious payload reported in {dep.name} {dep.version}.",
                    affects_versions=f"={dep.version}",
                    version_match="confirmed",
                    severity="high",
                    credibility=0.9,
                    is_original_report=True,
                    evidence_quote="Evidence confirms matching package dependencies.",
                )
            )
        else:
            signals.append(
                Signal(
                    url=page.url,
                    security_relevant=True,
                    claim=f"[SYNTHETIC] Unconfirmed anomalous behavior in {dep.name}.",
                    affects_versions=dep.version,
                    version_match="possible",
                    severity="medium",
                    credibility=0.6,
                    is_original_report=True,
                    evidence_quote="Possible unexpected prototype pollution behavior noticed.",
                )
            )

    await _emit_event(emit, scan_id, "gemini", "generate", target, "ok", f"Extracted {len(signals)} signals")
    return signals


def build_finding(
    dep: Dependency,
    scan_id: str,
    signals: list[Signal],
    sources: list[Source],
    osv: OsvResult,
    *,
    page_texts: dict[str, str] | None = None,
    strict_quotes: bool = False,
) -> Finding | None:
    """Pure deterministic scoring stub."""
    relevant_signals = [s for s in signals if s.security_relevant]
    if not relevant_signals and not osv.vuln_ids:
        return None

    # Count independent original domains
    domains = set()
    for s in sources:
        try:
            d = urlparse(s.url).netloc.lower()
            if d:
                domains.add(d)
        except (ValueError, AttributeError):
            continue

    finding_id = f"f_{dep.name.replace('/', '_')}_{dep.version}"

    if len(domains) >= 2 and any(s.severity in ("high", "critical") for s in relevant_signals):
        # Corroborated HIGH
        return Finding(
            id=finding_id,
            scan_id=scan_id,
            package=dep.name,
            version=dep.version,
            ecosystem="npm",
            dep_path=dep.dep_path,
            direct=dep.direct,
            status="HIGH",
            severity="high",
            confidence=0.88,
            summary=f"[SYNTHETIC] Corroborated security signals detected for {dep.name}@{dep.version}",
            reasoning="Two independent domains reported matching high-severity malicious package behavior.",
            affected_versions=f"={dep.version}",
            version_match="confirmed",
            in_osv=False,
            osv_ids=[],
            independent_sources=len(domains),
            sources=sources,
            signals=relevant_signals,
            first_signal_at=_now(),
        )

    # Single source or uncorroborated: WATCH
    return Finding(
        id=finding_id,
        scan_id=scan_id,
        package=dep.name,
        version=dep.version,
        ecosystem="npm",
        dep_path=dep.dep_path,
        direct=dep.direct,
        status="WATCH",
        severity="medium",
        confidence=0.60,
        summary=f"[SYNTHETIC] Single-source early warning signal for {dep.name}@{dep.version}",
        reasoning="Single external report found. Per conservative scoring rules, one source cannot exceed WATCH.",
        affected_versions=dep.version,
        version_match="possible",
        in_osv=False,
        osv_ids=[],
        independent_sources=len(domains),
        sources=sources,
        signals=relevant_signals,
        first_signal_at=_now(),
    )


# ---------------------------------------------------------------------------
# Selective operations: Agent, Monitor, Research
# ---------------------------------------------------------------------------


async def agent_scan_issues(
    issues_url: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> list[IssueItem]:
    await _emit_event(emit, scan_id, "agent", "run", issues_url, "start")
    await asyncio.sleep(0.05)
    items = [
        IssueItem(
            title="[SYNTHETIC] Issue #104: Malicious script injection in build hook",
            url=f"{issues_url}/104",
            opened="2026-10-23",
            snippet="Reported malicious postinstall script downloading unexpected payload.",
        ),
        IssueItem(
            title="[SYNTHETIC] Issue #108: Security advisory follow-up",
            url=f"{issues_url}/108",
            opened="2026-10-24",
            snippet="Confirming version bump removes suspicious telemetry code.",
        ),
    ]
    await _emit_event(emit, scan_id, "agent", "run", issues_url, "ok", f"Scanned issues; found {len(items)} items")
    return items


async def create_topic_monitor(
    package: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> str:
    monitor_id = f"mon_synth_{package}"
    await _emit_event(emit, scan_id, "monitor", "create_monitor", package, "start")
    await asyncio.sleep(0.03)
    await _emit_event(emit, scan_id, "monitor", "create_monitor", package, "ok", f"Created monitor id: {monitor_id}")
    return monitor_id


async def run_monitor_now(
    monitor_id: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> dict:
    await _emit_event(emit, scan_id, "monitor", "run_monitor", monitor_id, "start")
    await asyncio.sleep(0.04)
    res = {
        "monitor_id": monitor_id,
        "status": "ok",
        "last_checked": _now().isoformat(),
        "alerts_triggered": 0,
        "message": "[SYNTHETIC] Monitor run completed; zero new anomalies detected.",
    }
    await _emit_event(emit, scan_id, "monitor", "run_monitor", monitor_id, "ok", "Monitor run clean")
    return res


async def pause_topic_monitor(
    monitor_id: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> bool:
    await _emit_event(emit, scan_id, "monitor", "run", f"pause:{monitor_id}", "start")
    await asyncio.sleep(0.02)
    await _emit_event(emit, scan_id, "monitor", "run", f"pause:{monitor_id}", "ok", "Monitor successfully paused")
    return True


async def research_report(
    query: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> ResearchResult:
    await _emit_event(emit, scan_id, "research", "run_research", query, "start")
    await asyncio.sleep(0.06)
    result = ResearchResult(
        run_id="res_synth_987",
        summary=f"[SYNTHETIC] Deep research completed for query '{query}'. Corroborated git provenance and maintainer accounts across official npm registry and mirrors.",
        sources=[
            Source(
                url="https://research.synthetic.test/report/provenance",
                title="[SYNTHETIC] Dependency Provenance Investigation",
                domain="research.synthetic.test",
                source_type="advisory",
                snippet="Independent audit of publish tokens and signing keys shows clean release history.",
            )
        ],
    )
    await _emit_event(emit, scan_id, "research", "run_research", query, "ok", "Research report generated")
    return result
