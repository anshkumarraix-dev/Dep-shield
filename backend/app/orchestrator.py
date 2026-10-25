"""Scan orchestrator pipeline.

Owner: Ansh.
Coordinates:
- Lockfile parsing and dependency graph extraction
- Slicing to MAX_PACKAGES_ANALYZED_PER_SCAN (default 4), direct dependencies first
- Baseline (OSV & npm) lookups
- Targeted Search & Fetch
- Gemini classification
- Pure deterministic scoring
- Per-package error isolation (one failure does not crash the scan)
- SSE event streaming and SQLite persistence
"""
from __future__ import annotations

import logging

from . import db
from .config import settings
from .events import event_bus, make_emitter
from .models import ActivityEvent, Dependency, Finding
from .parser import parse_lockfile

logger = logging.getLogger(__name__)

# Import stubs as standard fallback / mock implementation
from . import stubs


def _get_pipeline_modules():
    """Dynamically load live modules if stubs are disabled, or raise RuntimeError."""
    if settings.use_stubs:
        return stubs, stubs, stubs, stubs

    try:
        import importlib
        _baseline = importlib.import_module(".baseline", package=__package__)
        _classifier = importlib.import_module(".classifier", package=__package__)
        _scoring = importlib.import_module(".scoring", package=__package__)
        _tinyfish = importlib.import_module(".tinyfish_client", package=__package__)
        return _baseline, _tinyfish, _classifier, _scoring
    except Exception as e:
        err_msg = f"Failed to load live pipeline modules: {e}"
        logger.error(err_msg)
        raise RuntimeError(err_msg) from e


def build_graph_data(deps: list[Dependency]) -> tuple[list[dict], list[dict]]:
    """Build nodes and edges structure for UI visualization."""
    nodes: list[dict] = []
    edges: list[dict] = []
    seen_nodes = set()

    for dep in deps:
        if dep.key not in seen_nodes:
            seen_nodes.add(dep.key)
            nodes.append({
                "id": dep.key,
                "name": dep.name,
                "version": dep.version,
                "direct": dep.direct,
                "dep_path": dep.dep_path,
            })

        # Add edges along the dependency chain
        if len(dep.dep_path) >= 2:
            parent = dep.dep_path[-2]
            child = dep.key
            edges.append({"source": parent, "target": child})

    return nodes, edges


async def run_scan(scan_id: str, lockfile_text: str, as_of_date: str | None = None) -> None:
    """Execute the end-to-end scan pipeline."""
    emit = make_emitter(scan_id)
    scan = db.get_scan(scan_id)
    if not scan:
        logger.error("Scan %s not found in DB", scan_id)
        return

    db.update_scan(scan_id, status="running")
    await emit(
        ActivityEvent(
            scan_id=scan_id,
            api="system",
            action="start",
            target=scan_id,
            status="ok",
            detail=f"Scan started in {'stub' if settings.use_stubs else 'live'} mode",
        )
    )

    # 1. Parse lockfile
    try:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="parser",
                action="parse",
                target="package-lock.json",
                status="start",
            )
        )
        dependencies = parse_lockfile(lockfile_text)
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="parser",
                action="parse",
                target="package-lock.json",
                status="ok",
                detail=f"Parsed {len(dependencies)} total unique dependencies",
            )
        )
    except (ValueError, KeyError) as exc:
        err_msg = str(exc)
        logger.error("Failed to parse lockfile for scan %s: %s", scan_id, err_msg)
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="parser",
                action="parse",
                target="package-lock.json",
                status="error",
                detail=err_msg,
            )
        )
        db.update_scan(scan_id, status="error", error=err_msg)
        await event_bus.publish(scan_id, "error", {"scan_id": scan_id, "error": err_msg})
        return

    # 2. Persist dependency graph
    nodes, edges = build_graph_data(dependencies)
    db.save_dependency_graph(scan_id, nodes, edges)

    # 3. Select packages to analyze (direct dependencies first, capped at MAX_PACKAGES_ANALYZED_PER_SCAN)
    packages_to_analyze = dependencies[: settings.max_packages_analyzed_per_scan]
    total_pkgs = len(packages_to_analyze)
    db.update_scan(scan_id, packages_total=total_pkgs, packages_done=0)

    await event_bus.publish(
        scan_id,
        "progress",
        {
            "packages_total": total_pkgs,
            "packages_done": 0,
            "packages_failed": 0,
            "status": "running",
        },
    )

    try:
        baseline_mod, tf_mod, classifier_mod, scoring_mod = _get_pipeline_modules()
    except RuntimeError as err:
        err_msg = str(err)
        logger.error("Scan %s aborted: %s", scan_id, err_msg)
        db.update_scan(scan_id, status="error", error=err_msg)
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="system",
                action="error",
                target=scan_id,
                status="error",
                detail=err_msg,
            )
        )
        await event_bus.publish(scan_id, "error", {"scan_id": scan_id, "error": err_msg})
        return

    # 4. Investigate each selected package with isolated error handling
    packages_done = 0
    packages_failed = 0
    failed_packages: list[str] = []
    for dep in packages_to_analyze:
        try:
            # Baseline lookups
            osv_res = await baseline_mod.osv_lookup(
                dep.ecosystem, dep.name, dep.version, scan_id=scan_id, emit=emit
            )
            _npm_meta = await baseline_mod.npm_metadata(
                dep.name, dep.version, scan_id=scan_id, emit=emit
            )

            # Web search
            sources = await tf_mod.search_signals(
                dep.name, dep.version, before_date=as_of_date, scan_id=scan_id, emit=emit
            )

            # Fetch top evidence pages
            pages_to_fetch = sources[: settings.max_urls_fetched_per_package]
            pages = await tf_mod.fetch_pages(pages_to_fetch, scan_id=scan_id, emit=emit)

            # Gemini classification
            signals = await classifier_mod.classify(
                dep, pages, osv_res, scan_id=scan_id, emit=emit
            )

            # Deterministic scoring
            page_texts = {p.url: p.text for p in pages}
            try:
                finding = scoring_mod.build_finding(
                    dep,
                    scan_id,
                    signals,
                    sources,
                    osv_res,
                    page_texts=page_texts,
                    strict_quotes=True,
                )
            except TypeError as te:
                if "strict_quotes" in str(te):
                    finding = scoring_mod.build_finding(
                        dep,
                        scan_id,
                        signals,
                        sources,
                        osv_res,
                        page_texts=page_texts,
                    )
                else:
                    raise
            if finding:
                db.save_finding(finding)
                await event_bus.publish(scan_id, "finding", finding.model_dump(mode="json"))

        except Exception as pkg_err:  # noqa: BLE001 (isolated package failure must never crash whole scan)
            packages_failed += 1
            failed_packages.append(f"{dep.name}@{dep.version}")
            logger.error("Error analyzing package %s@%s: %s", dep.name, dep.version, pkg_err)
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="system",
                    action="error",
                    target=f"{dep.name}@{dep.version}",
                    status="error",
                    detail=f"Package analysis encountered error: {pkg_err}",
                )
            )

        packages_done += 1
        db.update_scan(scan_id, packages_done=packages_done)
        await event_bus.publish(
            scan_id,
            "progress",
            {
                "packages_total": total_pkgs,
                "packages_done": packages_done,
                "packages_failed": packages_failed,
                "status": "running",
            },
        )

    # 5. Scan finished
    if total_pkgs > 0 and packages_failed == total_pkgs:
        err_msg = f"All {total_pkgs} packages failed analysis"
        logger.error("Scan %s failed: %s", scan_id, err_msg)
        db.update_scan(scan_id, status="error", error=err_msg)
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="system",
                action="error",
                target=scan_id,
                status="error",
                detail=err_msg,
            )
        )
        await event_bus.publish(scan_id, "error", {"scan_id": scan_id, "error": err_msg})
        return

    if packages_failed > 0:
        partial_msg = f"Partial: {packages_failed} of {total_pkgs} packages could not be analysed (not checked, NOT safe)"
        db.update_scan(scan_id, status="done", error=partial_msg)
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="system",
                action="done",
                target=scan_id,
                status="ok",
                detail=f"Scan complete with partial failures: {packages_failed}/{total_pkgs} failed. {partial_msg}",
            )
        )
        await event_bus.publish(
            scan_id,
            "done",
            {
                "scan_id": scan_id,
                "status": "done",
                "packages_failed": packages_failed,
            },
        )
    else:
        db.update_scan(scan_id, status="done")
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="system",
                action="done",
                target=scan_id,
                status="ok",
                detail=f"Scan complete. Analyzed {packages_done}/{total_pkgs} packages.",
            )
        )
        await event_bus.publish(
            scan_id,
            "done",
            {
                "scan_id": scan_id,
                "status": "done",
                "packages_failed": 0,
            },
        )


async def run_research(scan_id: str, finding_id: str) -> Finding | None:
    """Execute on-demand Deep Research for a specific finding."""
    finding = db.get_finding(scan_id, finding_id)
    if not finding:
        return None

    emit = make_emitter(scan_id)
    _, tf_mod, _, _ = _get_pipeline_modules()

    query = f"{finding.package} {finding.version} security supply chain advisory maintainer provenance"
    res = await tf_mod.research_report(query, scan_id=scan_id, emit=emit)

    finding.research_summary = res.summary
    finding.research_sources = res.sources
    db.save_finding(finding)

    # Notify SSE listeners
    await event_bus.publish(scan_id, "finding", finding.model_dump(mode="json"))
    return finding
