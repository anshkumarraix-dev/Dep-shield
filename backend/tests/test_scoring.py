"""Deterministic tests for scoring.py — 100% offline, no mocks of network/DB/Gemini.

All tests exercise build_finding() or internal helpers directly.
"""
from __future__ import annotations

import hashlib
from typing import Optional

import pytest

from app.models import Dependency, OsvResult, Severity, Signal, Source, VersionMatch
from app.scoring import (
    _compute_confidence,
    _determine_status,
    _finding_id,
    _independent_sources,
    _verify_quote,
    build_finding,
    registrable_domain,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _dep(name="lodash", version="4.17.20", direct=True) -> Dependency:
    return Dependency(
        name=name, version=version, ecosystem="npm",
        direct=direct, dep_path=["my-app", f"{name}@{version}"]
    )


def _sig(
    url="https://github.com/lodash/lodash/issues/1",
    security_relevant=True,
    severity: Severity = "high",
    version_match: VersionMatch = "confirmed",
    is_original=True,
    credibility=0.75,
    evidence_quote="",
    claim="lodash prototype pollution allows remote code execution",
) -> Signal:
    return Signal(
        url=url,
        security_relevant=security_relevant,
        claim=claim,
        affects_versions="<4.17.21",
        version_match=version_match,
        severity=severity,
        credibility=credibility,
        is_original_report=is_original,
        evidence_quote=evidence_quote,
    )


def _src(url="https://github.com/lodash/lodash/issues/1") -> Source:
    return Source(url=url, title="Test Source", domain="github.com", source_type="github_issue")


def _osv(ids=None, error=None) -> OsvResult:
    if error:
        return OsvResult(queried=True, error=error)
    return OsvResult(queried=True, vuln_ids=ids or [])


# ---------------------------------------------------------------------------
# 1. Single independent source → at most WATCH
# ---------------------------------------------------------------------------

def test_single_source_max_watch():
    dep = _dep()
    sig = _sig()
    finding = build_finding(dep, "scan1", [sig], [_src()], _osv())
    assert finding is not None
    assert finding.status == "WATCH", f"Expected WATCH, got {finding.status}"
    assert finding.independent_sources == 1


# ---------------------------------------------------------------------------
# 2. Repost (is_original_report=False) does NOT count as independent
# ---------------------------------------------------------------------------

def test_repost_not_independent():
    dep = _dep()
    sig1 = _sig(url="https://snyk.io/vuln/1", is_original=True)
    sig2 = _sig(url="https://securityweek.com/lodash", is_original=False)  # repost
    finding = build_finding(dep, "scan1", [sig1, sig2], [_src(), _src("https://securityweek.com/lodash")], _osv())
    assert finding is not None
    assert finding.independent_sources == 1
    assert finding.status == "WATCH"  # only 1 independent → not HIGH


# ---------------------------------------------------------------------------
# 3. Two subdomains of same registrable domain are NOT independent
# ---------------------------------------------------------------------------

def test_subdomains_not_independent():
    dep = _dep()
    sig1 = _sig(url="https://blog.snyk.io/research/lodash-vuln")
    sig2 = _sig(url="https://security.snyk.io/vuln/SNYK-JS-LODASH-1")
    # Both are snyk.io — one registrable domain
    finding = build_finding(dep, "scan1", [sig1, sig2], [], _osv())
    assert finding is not None
    assert finding.independent_sources == 1
    assert finding.status == "WATCH"


# ---------------------------------------------------------------------------
# 4. Two truly independent domains reach HIGH when version matches
# ---------------------------------------------------------------------------

def test_two_independent_domains_high():
    dep = _dep()
    sig1 = _sig(url="https://github.com/lodash/lodash/issues/5", version_match="confirmed", severity="high")
    sig2 = _sig(url="https://snyk.io/vuln/SNYK-JS-LODASH-1", version_match="confirmed", severity="high")
    finding = build_finding(dep, "scan1", [sig1, sig2], [], _osv())
    assert finding is not None
    assert finding.status == "HIGH"
    assert finding.independent_sources == 2


# ---------------------------------------------------------------------------
# 5. Two independent sources with "possible" version_match → HIGH (not CRITICAL)
# ---------------------------------------------------------------------------

def test_possible_version_match_high_not_critical():
    dep = _dep()
    sig1 = _sig(url="https://github.com/a/b/issues/1", version_match="possible", severity="critical")
    sig2 = _sig(url="https://bleepingcomputer.com/lodash", version_match="possible", severity="critical")
    finding = build_finding(dep, "scan1", [sig1, sig2], [], _osv())
    assert finding is not None
    assert finding.status == "HIGH"   # possible ≠ confirmed → no CRITICAL


# ---------------------------------------------------------------------------
# 6. CRITICAL requires confirmed version match + critical severity + ≥2 independent
# ---------------------------------------------------------------------------

def test_critical_requires_confirmed_and_critical_severity():
    dep = _dep()
    sig1 = _sig(url="https://github.com/a/b/issues/1", version_match="confirmed", severity="critical")
    sig2 = _sig(url="https://snyk.io/vuln/1", version_match="confirmed", severity="critical")
    finding = build_finding(dep, "scan1", [sig1, sig2], [], _osv())
    assert finding is not None
    assert finding.status == "CRITICAL"


# ---------------------------------------------------------------------------
# 7. not_affected must never be HIGH or CRITICAL
# ---------------------------------------------------------------------------

def test_not_affected_never_high_or_critical():
    dep = _dep()
    sig1 = _sig(url="https://github.com/a/b/issues/1", version_match="not_affected", severity="critical")
    sig2 = _sig(url="https://snyk.io/vuln/1", version_match="not_affected", severity="critical")
    finding = build_finding(dep, "scan1", [sig1, sig2], [], _osv())
    assert finding is not None
    assert finding.status not in ("HIGH", "CRITICAL"), f"Got {finding.status}"
    assert finding.status == "INFO"


# ---------------------------------------------------------------------------
# 8. security_relevant=False signals are ignored entirely
# ---------------------------------------------------------------------------

def test_irrelevant_signals_ignored():
    dep = _dep()
    sig_irrel = _sig(security_relevant=False)
    sig_irrel2 = _sig(url="https://forum.example.com/post", security_relevant=False)
    finding = build_finding(dep, "scan1", [sig_irrel, sig_irrel2], [], _osv())
    # No relevant signals → clean dependency
    assert finding is None


# ---------------------------------------------------------------------------
# 9. Malformed / empty signal list → None (clean dep)
# ---------------------------------------------------------------------------

def test_empty_signals_returns_none():
    dep = _dep()
    finding = build_finding(dep, "scan1", [], [], _osv())
    assert finding is None


# ---------------------------------------------------------------------------
# 10. OSV error → in_osv is None (never False)
# ---------------------------------------------------------------------------

def test_osv_error_yields_in_osv_none():
    dep = _dep()
    sig = _sig()
    finding = build_finding(dep, "scan1", [sig], [_src()], _osv(error="connection refused"))
    assert finding is not None
    assert finding.in_osv is None, f"Expected None, got {finding.in_osv}"


# ---------------------------------------------------------------------------
# 11. Successful OSV lookup with no IDs → in_osv is False
# ---------------------------------------------------------------------------

def test_osv_empty_result_yields_in_osv_false():
    dep = _dep()
    sig = _sig()
    finding = build_finding(dep, "scan1", [sig], [_src()], _osv(ids=[]))
    assert finding is not None
    assert finding.in_osv is False, f"Expected False, got {finding.in_osv}"


# ---------------------------------------------------------------------------
# 12. Stable finding ID — same input always same ID
# ---------------------------------------------------------------------------

def test_stable_finding_id():
    dep = _dep()
    sig = _sig()
    f1 = build_finding(dep, "scan1", [sig], [], _osv())
    f2 = build_finding(dep, "scan2", [sig], [], _osv())  # different scan_id
    assert f1 is not None and f2 is not None
    assert f1.id == f2.id  # scan_id must not affect finding ID
    # ID is deterministic
    expected = _finding_id("lodash", "4.17.20", "npm")
    assert f1.id == expected


# ---------------------------------------------------------------------------
# 13. Confidence clamped to [0, 1]
# ---------------------------------------------------------------------------

def test_confidence_clamped():
    # Pathologically high inputs
    c = _compute_confidence(
        n_independent=100,
        max_credibility=1.0,
        version_match="confirmed",
        severity="critical",
        has_advisory=True,
        in_osv=True,
    )
    assert 0.0 <= c <= 1.0

    # Pathologically low inputs
    c_low = _compute_confidence(
        n_independent=0,
        max_credibility=0.0,
        version_match="not_affected",
        severity="none",
        has_advisory=False,
        in_osv=False,
    )
    assert 0.0 <= c_low <= 1.0


# ---------------------------------------------------------------------------
# 14. registrable_domain helper
# ---------------------------------------------------------------------------

def test_registrable_domain():
    assert registrable_domain("security.snyk.io") == "snyk.io"
    assert registrable_domain("blog.github.com") == "github.com"
    assert registrable_domain("foo.co.uk") == "foo.co.uk"
    assert registrable_domain("github.com") == "github.com"
    assert registrable_domain("sub.sub.example.com") == "example.com"


# ---------------------------------------------------------------------------
# 15. Non-matching evidence quote is downgraded (credibility drops)
# ---------------------------------------------------------------------------

def test_non_matching_quote_downgraded():
    dep = _dep()
    # Quote does NOT appear in the page text
    sig = _sig(evidence_quote="this exact phrase does not exist anywhere on the page text provided")
    page_texts = {sig.url: "This page talks about lodash in general terms."}
    finding = build_finding(dep, "scan1", [sig], [_src()], _osv(), page_texts=page_texts)
    assert finding is not None
    # The signal is still counted (only quote is cleared, credibility reduced)
    # Original credibility was 0.75; after -0.2 it should be 0.55
    assert finding.signals[0].evidence_quote == ""
    assert finding.signals[0].credibility == pytest.approx(0.55, abs=1e-6)


# ---------------------------------------------------------------------------
# 16. Matching evidence quote is preserved
# ---------------------------------------------------------------------------

def test_matching_quote_preserved():
    dep = _dep()
    quote = "prototype pollution vulnerability allows attackers to modify"
    page_text = f"According to researchers, a {quote} object prototypes."
    sig = _sig(evidence_quote=quote)
    page_texts = {sig.url: page_text}
    finding = build_finding(dep, "scan1", [sig], [], _osv(), page_texts=page_texts)
    assert finding is not None
    assert finding.signals[0].evidence_quote == quote


# ---------------------------------------------------------------------------
# 17. _verify_quote: quote >25 words is rejected
# ---------------------------------------------------------------------------

def test_verify_quote_too_long():
    long_q = " ".join([f"word{i}" for i in range(26)])
    assert not _verify_quote(long_q, long_q)  # even if it's a substring, >25 words fails


def test_verify_quote_exact_match():
    page = "The package event-stream 3.3.6 contained a malicious backdoor in flatmap-stream."
    quote = "event-stream 3.3.6 contained a malicious backdoor"
    assert _verify_quote(quote, page)


def test_verify_quote_empty_fails():
    assert not _verify_quote("", "any page text")
    assert not _verify_quote("something", "")


# ---------------------------------------------------------------------------
# 18. Mix of relevant and irrelevant signals — only relevant counted
# ---------------------------------------------------------------------------

def test_mixed_signals_only_relevant_counted():
    dep = _dep()
    rel = _sig(url="https://nvd.nist.gov/vuln/detail/CVE-2021-1234", version_match="confirmed", severity="high")
    irrel = _sig(url="https://example.com/benchmarks", security_relevant=False)
    finding = build_finding(dep, "scan1", [rel, irrel], [], _osv())
    assert finding is not None
    assert all(s.security_relevant for s in finding.signals)
    assert len(finding.signals) == 1


# ---------------------------------------------------------------------------
# 19. OSV None passed → in_osv stays None
# ---------------------------------------------------------------------------

def test_osv_none_parameter():
    dep = _dep()
    sig = _sig()
    finding = build_finding(dep, "scan1", [sig], [], None)  # no OsvResult at all
    assert finding is not None
    assert finding.in_osv is None


# ---------------------------------------------------------------------------
# 20. _independent_sources: advisory domain flagged correctly
# ---------------------------------------------------------------------------

def test_independent_sources_advisory_flag():
    sigs = [
        _sig(url="https://github.com/advisories/GHSA-x123"),
        _sig(url="https://nvd.nist.gov/vuln/detail/CVE-2021-1"),
    ]
    count, has_advisory = _independent_sources(sigs)
    # github.com and nvd.nist.gov are different registrable domains
    assert count == 2
    assert has_advisory is True


# ---------------------------------------------------------------------------
# 21. _determine_status: two independent + high sev + unknown version → WATCH
# ---------------------------------------------------------------------------

def test_two_independent_unknown_version_watch():
    status = _determine_status(
        n_independent=2,
        version_match="unknown",
        severity="high",
        has_advisory=False,
        any_relevant=True,
    )
    assert status == "WATCH"  # HIGH needs confirmed or possible


# ---------------------------------------------------------------------------
# 22. Clean dependency (no signals at all) returns None from build_finding
# ---------------------------------------------------------------------------

def test_clean_dependency_returns_none():
    dep = _dep(name="clean-package", version="1.0.0")
    result = build_finding(dep, "scan1", [], [], _osv(ids=[]))
    assert result is None
