"""Baseline threat intelligence and registry metadata lookups.

Owner: Aviral.
Implements:
- OSV API query (https://api.osv.dev/v1/query) for known vulnerability baselines
- npm registry metadata query (https://registry.npmjs.org/) for provenance and deprecation
- Resilient timeouts and error handling (never silently treat lookup failure as "clean")
- Caching with configurable TTL
- ActivityEvents emission for UI activity feed
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import quote

import httpx

from . import db
from .config import settings
from .models import ActivityEvent, Emit, NpmMeta, OsvResult

logger = logging.getLogger(__name__)

OSV_QUERY_URL = "https://api.osv.dev/v1/query"
NPM_REGISTRY_URL = "https://registry.npmjs.org"
DEFAULT_TIMEOUT_S = 15.0


def _clean_repo_url(url: str | None) -> str | None:
    """Normalize git/npm repository URLs to clean HTTPS web URLs."""
    if not url or not isinstance(url, str):
        return None
    cleaned = url.strip()
    if cleaned.startswith("git+"):
        cleaned = cleaned[4:]
    if cleaned.startswith("git://"):
        cleaned = "https://" + cleaned[6:]
    if cleaned.startswith("ssh://git@github.com/"):
        cleaned = "https://github.com/" + cleaned[len("ssh://git@github.com/"):]
    if cleaned.startswith("github:"):
        cleaned = "https://github.com/" + cleaned[7:]
    if cleaned.endswith(".git"):
        cleaned = cleaned[:-4]
    return cleaned


def _parse_iso_datetime(date_str: str | None) -> datetime | None:
    """Parse ISO date-time string safely to UTC datetime."""
    if not date_str or not isinstance(date_str, str):
        return None
    try:
        # Normalize trailing Z to +00:00 for fromisoformat compatibility
        normalized = date_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        return None


async def osv_lookup(
    ecosystem: str,
    package: str,
    version: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> OsvResult:
    """Query the OSV.dev database for known vulnerabilities for an exact package version.

    Contract:
    - Never mark a failed lookup as clean (error must be set and queried=False).
    - Emits ActivityEvent on start and ok/error/cached.
    - Caches responses when cache is enabled.
    """
    target = f"{package}@{version}"
    cache_key = f"osv:{ecosystem}:{package}:{version}"

    # 1. Check TTL Cache
    if settings.use_cache:
        cached_data = db.cache_get(cache_key)
        if cached_data is not None:
            if emit:
                await emit(
                    ActivityEvent(
                        scan_id=scan_id,
                        api="osv",
                        action="lookup",
                        target=target,
                        status="cached",
                        detail=f"Served from cache ({len(cached_data.get('vuln_ids', []))} vulnerabilities)",
                    )
                )
            try:
                return OsvResult.model_validate(cached_data)
            except Exception as e:
                logger.warning("Failed to deserialize cached OSV result: %s", e)

    # 2. Emit start event
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="osv",
                action="lookup",
                target=target,
                status="start",
            )
        )

    # 3. Perform HTTP lookup
    payload = {
        "package": {
            "name": package,
            "ecosystem": ecosystem,
        },
        "version": version,
    }

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            resp = await client.post(OSV_QUERY_URL, json=payload)

        if resp.status_code != 200:
            err_msg = f"OSV query returned HTTP {resp.status_code}: {resp.text[:200]}"
            logger.warning("OSV lookup error for %s: %s", target, err_msg)
            if emit:
                await emit(
                    ActivityEvent(
                        scan_id=scan_id,
                        api="osv",
                        action="lookup",
                        target=target,
                        status="error",
                        detail=err_msg,
                    )
                )
            return OsvResult(queried=False, vuln_ids=[], earliest_published=None, error=err_msg)

        data = resp.json()
        vulns = data.get("vulns", [])
        vuln_ids: list[str] = [v["id"] for v in vulns if isinstance(v, dict) and "id" in v]

        # Extract earliest published date among reported vulnerabilities
        earliest_dt: datetime | None = None
        for v in vulns:
            if not isinstance(v, dict):
                continue
            pub_str = v.get("published") or v.get("modified")
            dt = _parse_iso_datetime(pub_str)
            if dt:
                if earliest_dt is None or dt < earliest_dt:
                    earliest_dt = dt

        result = OsvResult(
            queried=True,
            vuln_ids=vuln_ids,
            earliest_published=earliest_dt,
            error=None,
        )

        # 4. Cache successful response
        if settings.use_cache:
            db.cache_set(cache_key, result.model_dump(mode="json"), ttl_s=3600)

        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="osv",
                    action="lookup",
                    target=target,
                    status="ok",
                    detail=f"{len(vuln_ids)} vulnerabilities found",
                )
            )

        return result

    except httpx.TimeoutException as exc:
        err_msg = f"OSV lookup timed out after {DEFAULT_TIMEOUT_S}s"
        logger.warning("OSV timeout for %s: %s", target, exc)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="osv",
                    action="lookup",
                    target=target,
                    status="error",
                    detail=err_msg,
                )
            )
        return OsvResult(queried=False, vuln_ids=[], earliest_published=None, error=err_msg)

    except Exception as exc:
        err_msg = f"OSV lookup failed: {exc}"
        logger.warning("OSV exception for %s: %s", target, exc)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="osv",
                    action="lookup",
                    target=target,
                    status="error",
                    detail=err_msg,
                )
            )
        return OsvResult(queried=False, vuln_ids=[], earliest_published=None, error=err_msg)


async def npm_metadata(
    package: str,
    version: str,
    *,
    scan_id: str | None = None,
    emit: Emit | None = None,
) -> NpmMeta:
    """Fetch package and version metadata from npm registry.

    Contract:
    - Extracts repo_url, issues_url, maintainers, published_at, deprecated, latest.
    - Emits ActivityEvent on start and ok/error/cached.
    - Caches responses when cache is enabled.
    - Failures return fallback metadata with original name and version, never crashing.
    """
    target = f"{package}@{version}"
    cache_key = f"npm:{package}:{version}"

    # 1. Check TTL Cache
    if settings.use_cache:
        cached_data = db.cache_get(cache_key)
        if cached_data is not None:
            if emit:
                await emit(
                    ActivityEvent(
                        scan_id=scan_id,
                        api="npm",
                        action="lookup",
                        target=target,
                        status="cached",
                        detail="Served from cache",
                    )
                )
            try:
                return NpmMeta.model_validate(cached_data)
            except Exception as e:
                logger.warning("Failed to deserialize cached npm metadata: %s", e)

    # 2. Emit start event
    if emit:
        await emit(
            ActivityEvent(
                scan_id=scan_id,
                api="npm",
                action="lookup",
                target=target,
                status="start",
            )
        )

    # 3. Perform HTTP lookup
    # Scoped package names like @scope/pkg are encoded as @scope%2fpkg
    encoded_pkg = quote(package, safe="@")
    url = f"{NPM_REGISTRY_URL}/{encoded_pkg}"
    headers = {"Accept": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT_S) as client:
            resp = await client.get(url, headers=headers)

        if resp.status_code == 404:
            err_msg = f"Package {package} not found in npm registry"
            if emit:
                await emit(
                    ActivityEvent(
                        scan_id=scan_id,
                        api="npm",
                        action="lookup",
                        target=target,
                        status="error",
                        detail=err_msg,
                    )
                )
            return NpmMeta(name=package, version=version)

        if resp.status_code != 200:
            err_msg = f"npm registry returned HTTP {resp.status_code}"
            if emit:
                await emit(
                    ActivityEvent(
                        scan_id=scan_id,
                        api="npm",
                        action="lookup",
                        target=target,
                        status="error",
                        detail=err_msg,
                    )
                )
            return NpmMeta(name=package, version=version)

        data = resp.json()

        # Extract latest dist-tag
        dist_tags = data.get("dist-tags", {})
        latest = dist_tags.get("latest") if isinstance(dist_tags, dict) else None

        # Version-specific record
        versions = data.get("versions", {})
        ver_info = versions.get(version, {}) if isinstance(versions, dict) else {}

        # Repository URL
        raw_repo = ver_info.get("repository") or data.get("repository")
        repo_url_str: str | None = None
        if isinstance(raw_repo, dict):
            repo_url_str = raw_repo.get("url")
        elif isinstance(raw_repo, str):
            repo_url_str = raw_repo
        repo_url = _clean_repo_url(repo_url_str)

        # Issues URL
        raw_bugs = ver_info.get("bugs") or data.get("bugs")
        issues_url: str | None = None
        if isinstance(raw_bugs, dict):
            issues_url = raw_bugs.get("url")
        elif isinstance(raw_bugs, str):
            issues_url = raw_bugs
        elif repo_url and "github.com" in repo_url:
            issues_url = f"{repo_url}/issues"

        # Deprecation notice
        deprecated = ver_info.get("deprecated")
        if not isinstance(deprecated, str):
            deprecated = None

        # Maintainers
        raw_maintainers = ver_info.get("maintainers") or data.get("maintainers") or []
        maintainers: list[str] = []
        if isinstance(raw_maintainers, list):
            for m in raw_maintainers:
                if isinstance(m, dict) and "name" in m:
                    maintainers.append(m["name"])
                elif isinstance(m, str):
                    maintainers.append(m)

        # Published date
        time_map = data.get("time", {})
        pub_str = time_map.get(version) if isinstance(time_map, dict) else None
        published_at = _parse_iso_datetime(pub_str)

        result = NpmMeta(
            name=package,
            version=version,
            repo_url=repo_url,
            issues_url=issues_url,
            deprecated=deprecated,
            latest=latest,
            maintainers=maintainers,
            published_at=published_at,
        )

        # Cache successful metadata
        if settings.use_cache:
            db.cache_set(cache_key, result.model_dump(mode="json"), ttl_s=3600)

        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="npm",
                    action="lookup",
                    target=target,
                    status="ok",
                    detail="Registry metadata retrieved",
                )
            )

        return result

    except httpx.TimeoutException as exc:
        err_msg = f"npm registry lookup timed out after {DEFAULT_TIMEOUT_S}s"
        logger.warning("npm metadata timeout for %s: %s", target, exc)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="npm",
                    action="lookup",
                    target=target,
                    status="error",
                    detail=err_msg,
                )
            )
        return NpmMeta(name=package, version=version)

    except Exception as exc:
        err_msg = f"npm metadata lookup failed: {exc}"
        logger.warning("npm metadata exception for %s: %s", target, exc)
        if emit:
            await emit(
                ActivityEvent(
                    scan_id=scan_id,
                    api="npm",
                    action="lookup",
                    target=target,
                    status="error",
                    detail=err_msg,
                )
            )
        return NpmMeta(name=package, version=version)
