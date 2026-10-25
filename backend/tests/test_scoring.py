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


# ---------------------------------------------------------------------------
# 23. Task 3a: Confirmed low + critical unknown must NOT be HIGH or CRITICAL
# ---------------------------------------------------------------------------

def test_per_signal_evaluation_confirmed_low_and_critical_unknown_not_high_or_critical():
    """3a: Signal A: version confirmed, severity low.
    Signal B (different source): severity critical, version unknown.
    Must NOT be HIGH or CRITICAL; fields must not be cross-combined.
    """
    dep = _dep()
    sig_a = _sig(
        url="https://domain-a.com/vuln",
        version_match="confirmed",
        severity="low",
        is_original=True,
    )
    sig_b = _sig(
        url="https://domain-b.com/vuln",
        version_match="unknown",
        severity="critical",
        is_original=True,
    )
    finding = build_finding(
        dep, "scan1", [sig_a, sig_b],
        [_src("https://domain-a.com/vuln"), _src("https://domain-b.com/vuln")],
        _osv(),
    )
    assert finding is not None
    assert finding.status not in ("HIGH", "CRITICAL")
    assert finding.status == "WATCH"
    # Proves severity and version_match are not cross-combined to critical+confirmed
    assert not (finding.severity == "critical" and finding.version_match == "confirmed")


# ---------------------------------------------------------------------------
# 24. Task 3b: Two independent original reports, high + confirmed + verified -> HIGH
# ---------------------------------------------------------------------------

def test_two_independent_reports_high_confirmed_verified_yields_high():
    """3b: Two independent original reports, each high severity + confirmed version + verified quote -> HIGH."""
    dep = _dep()
    quote_a = "vulnerability in version 4.17.20 allows remote code execution"
    quote_b = "confirmed flaw in 4.17.20 discovered by researchers"
    page_a = f"Security Advisory: {quote_a} under specific conditions."
    page_b = f"Report: {quote_b} affecting multiple applications."
    sig_a = _sig(
        url="https://domain-a.com/advisory",
        severity="high",
        version_match="confirmed",
        evidence_quote=quote_a,
        is_original=True,
    )
    sig_b = _sig(
        url="https://domain-b.com/report",
        severity="high",
        version_match="confirmed",
        evidence_quote=quote_b,
        is_original=True,
    )
    page_texts = {
        sig_a.url: page_a,
        sig_b.url: page_b,
    }
    finding = build_finding(
        dep, "scan1", [sig_a, sig_b],
        [_src(sig_a.url), _src(sig_b.url)],
        _osv(),
        page_texts=page_texts,
        strict_quotes=True,
    )
    assert finding is not None
    assert finding.status == "HIGH"
    assert finding.independent_sources == 2


# ---------------------------------------------------------------------------
# 25. Task 3c: strict_quotes=True and one quote missing -> capped at WATCH
# ---------------------------------------------------------------------------

def test_strict_quotes_one_quote_missing_capped_at_watch():
    """3c: strict_quotes=True and one of those two quotes is not in the page text -> capped at WATCH."""
    dep = _dep()
    quote_a = "vulnerability in version 4.17.20 allows remote code execution"
    quote_b = "confirmed flaw in 4.17.20 discovered by researchers"
    page_a = f"Security Advisory: {quote_a} under specific conditions."
    page_b = "Completely unrelated text without the quote."
    sig_a = _sig(
        url="https://domain-a.com/advisory",
        severity="high",
        version_match="confirmed",
        evidence_quote=quote_a,
        is_original=True,
    )
    sig_b = _sig(
        url="https://domain-b.com/report",
        severity="high",
        version_match="confirmed",
        evidence_quote=quote_b,
        is_original=True,
    )
    page_texts = {
        sig_a.url: page_a,
        sig_b.url: page_b,
    }
    finding = build_finding(
        dep, "scan1", [sig_a, sig_b],
        [_src(sig_a.url), _src(sig_b.url)],
        _osv(),
        page_texts=page_texts,
        strict_quotes=True,
    )
    assert finding is not None
    assert finding.status == "WATCH"


# ---------------------------------------------------------------------------
# 26. Task 3d: strict_quotes=True with page_texts=None -> never above WATCH
# ---------------------------------------------------------------------------

def test_strict_quotes_page_texts_none_never_above_watch():
    """3d: strict_quotes=True with page_texts=None -> never above WATCH."""
    dep = _dep()
    sig_a = _sig(
        url="https://domain-a.com/advisory",
        severity="critical",
        version_match="confirmed",
        evidence_quote="critical remote code execution vulnerability found",
        is_original=True,
    )
    sig_b = _sig(
        url="https://domain-b.com/report",
        severity="critical",
        version_match="confirmed",
        evidence_quote="critical remote code execution vulnerability confirmed",
        is_original=True,
    )
    finding = build_finding(
        dep, "scan1", [sig_a, sig_b],
        [_src(sig_a.url), _src(sig_b.url)],
        _osv(),
        page_texts=None,
        strict_quotes=True,
    )
    assert finding is not None
    assert finding.status not in ("HIGH", "CRITICAL")
    assert finding.status == "WATCH"


# ---------------------------------------------------------------------------
# 27. Task 3e: Two copies of one report -> one independent source
# ---------------------------------------------------------------------------

def test_two_copies_of_one_report_one_independent_source():
    """3e: Two copies of one report (is_original_report False, or the same domain) -> one independent source."""
    dep = _dep()
    # Case 1: is_original_report=False on domain B (repost)
    sig_orig = _sig(url="https://domain-a.com/advisory", is_original=True, severity="high", version_match="confirmed")
    sig_repost = _sig(url="https://domain-b.com/repost", is_original=False, severity="high", version_match="confirmed")
    f1 = build_finding(dep, "scan1", [sig_orig, sig_repost], [_src(sig_orig.url), _src(sig_repost.url)], _osv())
    assert f1 is not None
    assert f1.independent_sources == 1
    assert f1.status == "WATCH"

    # Case 2: same domain
    sig_dom1 = _sig(url="https://sub1.snyk.io/vuln1", is_original=True, severity="high", version_match="confirmed")
    sig_dom2 = _sig(url="https://sub2.snyk.io/vuln2", is_original=True, severity="high", version_match="confirmed")
    f2 = build_finding(dep, "scan1", [sig_dom1, sig_dom2], [_src(sig_dom1.url), _src(sig_dom2.url)], _osv())
    assert f2 is not None
    assert f2.independent_sources == 1
    assert f2.status == "WATCH"


# ---------------------------------------------------------------------------
# 28. Task 3f: Conflicting not_affected vs confirmed -> WATCH with conflict note
# ---------------------------------------------------------------------------

def test_conflicting_not_affected_vs_confirmed_caps_at_watch():
    """3f: Conflicting not_affected vs confirmed -> WATCH with a conflict note."""
    dep = _dep()
    sig_confirmed = _sig(
        url="https://domain-a.com/report1",
        version_match="confirmed",
        severity="high",
        is_original=True,
    )
    sig_not_affected = _sig(
        url="https://domain-b.com/report2",
        version_match="not_affected",
        severity="high",
        is_original=True,
    )
    finding = build_finding(
        dep, "scan1", [sig_confirmed, sig_not_affected],
        [_src(sig_confirmed.url), _src(sig_not_affected.url)],
        _osv(),
    )
    assert finding is not None
    assert finding.status == "WATCH"
    assert "conflicting reports" in finding.reasoning.lower()


# ---------------------------------------------------------------------------
# 29. Task 3g: Overlong quote (>25 words) and empty quote are unverified
# ---------------------------------------------------------------------------

def test_overlong_quote_and_empty_quote_unverified_in_strict_mode():
    """3g: Overlong quote (more than 25 words) and empty quote are unverified."""
    dep = _dep()
    overlong_quote = " ".join([f"word{i}" for i in range(26)])
    page_text = f"prefix {overlong_quote} suffix"
    sig_long = _sig(
        url="https://domain-a.com/vuln",
        evidence_quote=overlong_quote,
        severity="high",
        version_match="confirmed",
        is_original=True,
    )
    sig_empty = _sig(
        url="https://domain-b.com/vuln",
        evidence_quote="",
        severity="high",
        version_match="confirmed",
        is_original=True,
    )
    page_texts = {
        sig_long.url: page_text,
        sig_empty.url: "some text",
    }
    finding = build_finding(
        dep, "scan1", [sig_long, sig_empty],
        [_src(sig_long.url), _src(sig_empty.url)],
        _osv(),
        page_texts=page_texts,
        strict_quotes=True,
    )
    assert finding is not None
    assert finding.status == "WATCH"
    for s in finding.signals:
        assert s.evidence_quote == ""


# ---------------------------------------------------------------------------
# 30. Task 3h: Failed OSV lookup -> in_osv is None (never False)
# ---------------------------------------------------------------------------

def test_failed_osv_lookup_in_osv_is_none():
    """3h: Failed OSV lookup -> in_osv is None (never False)."""
    dep = _dep()
    sig = _sig(url="https://domain-a.com/vuln")

    # 1. Error during lookup
    osv_err = _osv(error="Network connection failed")
    f_err = build_finding(dep, "scan1", [sig], [_src(sig.url)], osv_err)
    assert f_err is not None
    assert f_err.in_osv is None

    # 2. Not queried
    osv_unqueried = OsvResult(queried=False)
    f_unqueried = build_finding(dep, "scan1", [sig], [_src(sig.url)], osv_unqueried)
    assert f_unqueried is not None
    assert f_unqueried.in_osv is None

    # 3. osv is None parameter
    f_none = build_finding(dep, "scan1", [sig], [_src(sig.url)], None)
    assert f_none is not None
    assert f_none.in_osv is None


# ---------------------------------------------------------------------------
# 31. Official advisory + one other independent source -> CRITICAL
# ---------------------------------------------------------------------------

def test_official_advisory_plus_one_other_source_yields_critical():
    dep = _dep()
    sig_adv = _sig(
        url="https://github.com/advisories/GHSA-1234",
        severity="critical",
        version_match="confirmed",
        is_original=True,
    )
    sig_other = _sig(
        url="https://snyk.io/vuln/SNYK-1234",
        severity="high",
        version_match="confirmed",
        is_original=True,
    )
    finding = build_finding(
        dep, "scan1", [sig_adv, sig_other],
        [_src(sig_adv.url), _src(sig_other.url)],
        _osv(),
    )
    assert finding is not None
    assert finding.status == "CRITICAL"
    assert finding.severity == "critical"
    assert finding.version_match == "confirmed"
    assert finding.independent_sources >= 2
