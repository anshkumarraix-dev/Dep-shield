"""Deterministic evidence scoring layer.

Owner: Aman. No network, DB, or Gemini calls here — pure synchronous logic.

Entry point
-----------
    build_finding(dep, scan_id, signals, sources, osv) -> Finding | None

Rules (from PROJECT_SPEC / AGENTS.md)
--------------------------------------
- security_relevant=False signals are ignored.
- Deduplicate by (original_report_url_domain, registrable_domain_of_source).
  Two subdomains of the same registrable domain are NOT independent.
  A mere repost (is_original_report=False) is NOT an independent source.
- One independent source → at most WATCH.
- HIGH requires ≥2 independent originals + high/critical severity + version match
  of "confirmed" or "possible".
- CRITICAL requires ≥2 independent originals + "confirmed" version_match + critical
  severity, OR a verified maintainer/advisory source plus one other independent
  original with "confirmed" version and critical severity.
- not_affected version_match → never HIGH/CRITICAL.
- OSV error → in_osv=None. Successful lookup with empty IDs → in_osv=False.
- Stable finding ID derived from package@version hash (not random).
- Confidence ∈ [0,1] clamped; transparent formula described in reasoning.
"""
from __future__ import annotations

import hashlib
import re
from typing import Optional

from .models import (
    Dependency,
    Finding,
    OsvResult,
    Signal,
    Source,
    Status,
    Severity,
    VersionMatch,
)

# ---------------------------------------------------------------------------
# Registrable-domain helpers
# ---------------------------------------------------------------------------

# Simple public-suffix approximation: strip leading host labels until we have
# eTLD+1.  We recognise a handful of two-level TLDs used by security sources.
_TWO_LEVEL = frozenset(
    {
        "co.uk", "org.uk", "me.uk", "ac.uk",
        "com.au", "net.au", "org.au",
        "co.jp", "co.nz", "co.in",
        "github.io", "gitlab.io",
    }
)


def registrable_domain(domain: str) -> str:
    """Return the registrable domain (eTLD+1) for deduplication purposes.

    Examples
    --------
    >>> registrable_domain("security.snyk.io")
    'snyk.io'
    >>> registrable_domain("blog.github.com")
    'github.com'
    >>> registrable_domain("foo.co.uk")
    'foo.co.uk'
    """
    parts = domain.lower().strip(".").split(".")
    if len(parts) <= 2:
        return domain.lower()
    # Check for known two-level TLDs
    candidate_two = ".".join(parts[-2:])
    if candidate_two in _TWO_LEVEL:
        if len(parts) >= 3:
            return ".".join(parts[-3:])
        return candidate_two
    return ".".join(parts[-2:])


def _source_domain(url: str) -> str:
    """Extract registrable domain from a URL."""
    try:
        from urllib.parse import urlparse
        host = urlparse(url).netloc.lower()
        host = host.split(":")[0]  # strip port
        if host.startswith("www."):
            host = host[4:]
        return registrable_domain(host)
    except Exception:
        return url


# ---------------------------------------------------------------------------
# Severity helpers
# ---------------------------------------------------------------------------

_SEV_RANK: dict[str, int] = {
    "none": 0, "low": 1, "medium": 2, "high": 3, "critical": 4,
}


def _sev_rank(s: str) -> int:
    return _SEV_RANK.get(s, 0)


def _max_severity(signals: list[Signal]) -> Severity:
    best = "none"
    for sig in signals:
        if _sev_rank(sig.severity) > _sev_rank(best):
            best = sig.severity
    return best  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Source independence logic
# ---------------------------------------------------------------------------

def _is_advisory_domain(domain: str) -> bool:
    """Heuristic: is this domain likely an official security advisory source?"""
    advisory_markers = (
        "github.com",        # GitHub Advisories / GHSA
        "nvd.nist.gov",
        "osv.dev",
        "snyk.io",
        "cve.org",
        "cve.mitre.org",
        "huntr.com",
        "huntr.dev",
        "socket.dev",
        "vuldb.com",
        "npmjs.com",         # npm security advisories
    )
    return any(domain == m or domain.endswith("." + m) for m in advisory_markers)


def _independent_sources(relevant: list[Signal]) -> tuple[int, bool]:
    """Return (count_independent_originals, has_advisory_or_maintainer).

    Two signals are NOT independent when:
    - Either is is_original_report=False (repost).
    - They share the same registrable domain.

    We count distinct (registrable_domain, original_report_key) pairs where
    is_original_report=True.  The "original_report_key" is the registrable
    domain of the source URL itself — same source, different sub-pages still
    count as one if same domain.
    """
    seen_domains: set[str] = set()
    count = 0
    has_advisory = False
    for sig in relevant:
        if not sig.is_original_report:
            continue
        dom = _source_domain(sig.url)
        if dom in seen_domains:
            continue
        seen_domains.add(dom)
        count += 1
        if _is_advisory_domain(dom):
            has_advisory = True
    return count, has_advisory


# ---------------------------------------------------------------------------
# Stable Finding ID
# ---------------------------------------------------------------------------

def _finding_id(package: str, version: str, ecosystem: str) -> str:
    """Stable, deterministic ID for a (package, version, ecosystem) triple."""
    raw = f"{ecosystem}:{package}@{version}"
    digest = hashlib.sha1(raw.encode()).hexdigest()[:12]
    return f"find_{digest}"


# ---------------------------------------------------------------------------
# Confidence formula (transparent)
# ---------------------------------------------------------------------------

def _compute_confidence(
    *,
    n_independent: int,
    max_credibility: float,
    version_match: VersionMatch,
    severity: Severity,
    has_advisory: bool,
    in_osv: Optional[bool],
) -> float:
    """Transparent confidence ∈ [0,1].

    Formula
    -------
    base = 0.20 × min(n_independent, 3) / 3
           + 0.30 × max_credibility
           + 0.20 × version_bonus
           + 0.15 × severity_bonus
           + 0.10 × advisory_bonus
           + 0.05 × osv_bonus
    clamped to [0, 1].

    Each component is documented in reasoning so reviewers can audit it.
    """
    indep_part = 0.20 * min(n_independent, 3) / 3
    cred_part = 0.30 * max_credibility

    version_bonus = {"confirmed": 1.0, "possible": 0.6, "unknown": 0.2, "not_affected": 0.0}.get(version_match, 0.2)
    version_part = 0.20 * version_bonus

    sev_bonus = _sev_rank(severity) / 4.0  # 0..1
    sev_part = 0.15 * sev_bonus

    advisory_part = 0.10 if has_advisory else 0.0

    if in_osv is True:
        osv_part = 0.05
    elif in_osv is False:
        osv_part = 0.0
    else:  # None (error)
        osv_part = 0.02  # slight uncertainty boost

    raw = indep_part + cred_part + version_part + sev_part + advisory_part + osv_part
    return round(min(1.0, max(0.0, raw)), 4)


# ---------------------------------------------------------------------------
# Status determination
# ---------------------------------------------------------------------------

def _determine_status(
    *,
    n_independent: int,
    version_match: VersionMatch,
    severity: Severity,
    has_advisory: bool,
    any_relevant: bool,
) -> Status:
    """Apply the spec rules strictly, from most to least restrictive.

    CRITICAL
    --------
    - ≥2 independent originals AND version_match="confirmed" AND severity="critical"
    - OR: has_advisory=True AND ≥1 other independent original AND version_match="confirmed"
      AND severity="critical"

    HIGH
    ----
    - ≥2 independent originals AND version_match in ("confirmed", "possible")
      AND severity in ("high", "critical")

    WATCH
    -----
    - ≥1 independent original with security-relevant signals.

    INFO / None
    -----------
    - No relevant signals → return None (clean dep).
    - Any relevant signal that doesn't meet WATCH conditions → INFO.
    """
    if version_match == "not_affected":
        # not_affected must never be HIGH/CRITICAL
        if any_relevant:
            return "INFO"
        return "INFO"  # still INFO, won't return None for signal-less case below

    if not any_relevant:
        return "INFO"  # fallback; caller checks for zero signals

    # CRITICAL
    if (
        n_independent >= 2
        and version_match == "confirmed"
        and severity == "critical"
    ):
        return "CRITICAL"
    if (
        has_advisory
        and n_independent >= 2
        and version_match == "confirmed"
        and severity == "critical"
    ):
        return "CRITICAL"

    # HIGH
    if (
        n_independent >= 2
        and version_match in ("confirmed", "possible")
        and _sev_rank(severity) >= _sev_rank("high")
    ):
        return "HIGH"

    # WATCH — any independent original source
    if n_independent >= 1:
        return "WATCH"

    # INFO — signals exist but no independent originals (all reposts, same domain, etc.)
    return "INFO"


# ---------------------------------------------------------------------------
# Summary / reasoning builders
# ---------------------------------------------------------------------------

def _build_reasoning(
    *,
    n_independent: int,
    version_match: VersionMatch,
    severity: Severity,
    has_advisory: bool,
    in_osv: Optional[bool],
    status: Status,
    confidence: float,
    conf_parts: dict[str, float],
    filtered_count: int,
    total_count: int,
) -> str:
    lines = [
        f"Status={status} | confidence={confidence:.4f}",
        f"Signals: {total_count} total, {filtered_count} security-relevant after filtering.",
        f"Independent original sources (distinct registrable domains): {n_independent}.",
        f"Best version_match={version_match}, severity={severity}, advisory_source={has_advisory}.",
        f"OSV: {'in OSV' if in_osv else ('not in OSV' if in_osv is False else 'lookup failed/unknown')}.",
        "",
        "Confidence breakdown (see scoring.py for formula):",
    ]
    for name, val in conf_parts.items():
        lines.append(f"  {name}: {val:.4f}")
    lines.append(
        "Rules applied: one source→WATCH; not_affected→INFO; "
        "HIGH needs ≥2 indep + (high|critical) sev + (confirmed|possible) version; "
        "CRITICAL needs ≥2 indep + confirmed + critical sev."
    )
    return "\n".join(lines)


def _build_summary(
    package: str,
    version: str,
    status: Status,
    severity: Severity,
    version_match: VersionMatch,
    n_independent: int,
) -> str:
    if status == "INFO":
        return f"{package}@{version}: no credible security signals detected."
    vm_phrase = {
        "confirmed": "confirmed to affect",
        "possible": "possibly affects",
        "unknown": "may affect",
        "not_affected": "does not affect",
    }.get(version_match, "may affect")
    return (
        f"{package}@{version}: {n_independent} independent source(s) report {severity}-severity "
        f"issue that {vm_phrase} this version. Status: {status}."
    )


# ---------------------------------------------------------------------------
# Quote verification
# ---------------------------------------------------------------------------

def _verify_quote(quote: str, page_text: str) -> bool:
    """Return True iff quote is a non-empty <=25-word verbatim substring of page_text."""
    if not quote or not page_text:
        return False
    words = quote.split()
    if len(words) > 25:
        return False
    return quote in page_text


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_finding(
    dep: Dependency,
    scan_id: str,
    signals: list[Signal],
    sources: list[Source],
    osv: Optional[OsvResult],
    *,
    page_texts: Optional[dict[str, str]] = None,  # url -> full page text for quote verification
) -> Optional[Finding]:
    """Build a deterministic Finding from classifier signals.

    Parameters
    ----------
    dep        : The dependency being scored.
    scan_id    : Identifier of the parent scan.
    signals    : List of Signal objects produced by classifier.py.
    sources    : List of Source objects (metadata about fetched pages).
    osv        : OsvResult from the OSV lookup (may be None if lookup was skipped).
    page_texts : Mapping of URL→full page text used to verify evidence_quote fields.
                 When None, quote verification is skipped (tests may pass {} to disable).

    Returns
    -------
    Finding or None. Returns None only when there are zero security-relevant
    signals (a genuinely clean dependency).
    """
    # --- 1. Filter to security-relevant signals only -----------------------
    relevant = [s for s in signals if s.security_relevant]

    # --- 2. Verify evidence quotes; drop/downgrade signals with bad quotes -
    if page_texts is not None and page_texts:
        verified: list[Signal] = []
        for sig in relevant:
            if sig.evidence_quote:
                page_text = page_texts.get(sig.url, "")
                if not _verify_quote(sig.evidence_quote, page_text):
                    # Downgrade: clear the quote and reduce credibility
                    sig = sig.model_copy(
                        update={
                            "evidence_quote": "",
                            "credibility": max(0.0, sig.credibility - 0.2),
                        }
                    )
            verified.append(sig)
        relevant = verified

    # --- 3. If no relevant signals, this dependency is clean ---------------
    if not relevant:
        return None

    # --- 4. Compute independence -------------------------------------------
    n_independent, has_advisory = _independent_sources(relevant)

    # --- 5. Best-case version_match & severity across all relevant signals -
    # For version_match, "confirmed" > "possible" > "unknown" > "not_affected"
    vm_rank = {"confirmed": 3, "possible": 2, "unknown": 1, "not_affected": 0}
    best_vm: VersionMatch = max(relevant, key=lambda s: vm_rank.get(s.version_match, 0)).version_match
    best_sev: Severity = _max_severity(relevant)
    max_cred = max(s.credibility for s in relevant)

    # --- 6. Collect affected_versions string --------------------------------
    affected_strs = [s.affects_versions for s in relevant if s.affects_versions]
    affected_versions = "; ".join(dict.fromkeys(affected_strs))  # deduplicate, order-preserving

    # --- 7. OSV fields ------------------------------------------------------
    if osv is None or osv.error:
        in_osv: Optional[bool] = None
        osv_ids: list[str] = []
    elif osv.vuln_ids:
        in_osv = True
        osv_ids = list(osv.vuln_ids)
    else:
        in_osv = False
        osv_ids = []

    # --- 8. Determine status ------------------------------------------------
    status = _determine_status(
        n_independent=n_independent,
        version_match=best_vm,
        severity=best_sev,
        has_advisory=has_advisory,
        any_relevant=bool(relevant),
    )

    # --- 9. Confidence ------------------------------------------------------
    conf_parts: dict[str, float] = {
        "sources(20%)":  round(0.20 * min(n_independent, 3) / 3, 4),
        "credibility(30%)": round(0.30 * max_cred, 4),
        "version_match(20%)": round(0.20 * {"confirmed": 1.0, "possible": 0.6, "unknown": 0.2, "not_affected": 0.0}.get(best_vm, 0.2), 4),
        "severity(15%)": round(0.15 * _sev_rank(best_sev) / 4, 4),
        "advisory(10%)": round(0.10 if has_advisory else 0.0, 4),
        "osv(5%)": round(0.05 if in_osv else (0.02 if in_osv is None else 0.0), 4),
    }
    confidence = _compute_confidence(
        n_independent=n_independent,
        max_credibility=max_cred,
        version_match=best_vm,
        severity=best_sev,
        has_advisory=has_advisory,
        in_osv=in_osv,
    )

    # --- 10. Build stable ID & texts ---------------------------------------
    finding_id = _finding_id(dep.name, dep.version, dep.ecosystem)

    summary = _build_summary(dep.name, dep.version, status, best_sev, best_vm, n_independent)
    reasoning = _build_reasoning(
        n_independent=n_independent,
        version_match=best_vm,
        severity=best_sev,
        has_advisory=has_advisory,
        in_osv=in_osv,
        status=status,
        confidence=confidence,
        conf_parts=conf_parts,
        filtered_count=len(relevant),
        total_count=len(signals),
    )

    # --- 11. first_signal_at from sources ----------------------------------
    dated_sources = [s for s in sources if s.published_at]
    first_signal_at = min((s.published_at for s in dated_sources), default=None)

    return Finding(
        id=finding_id,
        scan_id=scan_id,
        package=dep.name,
        version=dep.version,
        ecosystem=dep.ecosystem,
        dep_path=dep.dep_path,
        direct=dep.direct,
        status=status,
        severity=best_sev,
        confidence=confidence,
        summary=summary,
        reasoning=reasoning,
        affected_versions=affected_versions,
        version_match=best_vm,
        in_osv=in_osv,
        osv_ids=osv_ids,
        independent_sources=n_independent,
        sources=sources,
        signals=relevant,
        first_signal_at=first_signal_at,
    )
