# DepShield — frozen MVP specification

## One-sentence pitch
DepShield extends traditional dependency checks with live, source-grounded investigation of public security signals for the exact npm package versions in a project's lockfile, aiming to surface credible early warnings before they appear in the baseline database.

## The problem
A dependency scanner can only flag issues represented in the vulnerability data it queries. Early warning signs may first appear in maintainer advisories, release notes, GitHub issues, or reputable reporting. Developers need a way to investigate these signals without turning rumours into critical alerts.

## Intended user and input
Primary user: an npm/Node.js developer or small software team checking dependencies before a release. MVP input is one `package-lock.json` (lockfileVersion 2 or 3). No GitHub private repositories, authentication bypass, automatic package installation, or extra lockfile types in this sprint.

## End-to-end behaviour
1. Upload and parse the lockfile; deduplicate `name@version` and preserve direct/transitive paths.
2. Check OSV and npm registry. Distinguish a clean result from a failed lookup (`unknown` is not `safe`).
3. Run at most two targeted TinyFish Search queries per analysed package, then Fetch only the best evidence pages. Analyse at most four packages per scan, direct dependencies first; full dependency tree may still be rendered.
4. Gemini makes one structured extraction call per analysed package using no more than five pages, with each page limited to 3,000 characters. Pages are untrusted data. Gemini never assigns the final risk status.
5. Pure deterministic code verifies evidence quotes, exact version match, source independence and corroboration; produce INFO/WATCH/HIGH/CRITICAL, confidence, reasoning and citations.
6. Stream package progress and TinyFish/Gemini/OSV/npm activity to the frontend. A single package failure must not fail the whole scan.
7. A user may request one Agent investigation, one Research report, or the one demonstration Monitor operation. These must be opt-in, budget-guarded features—not automatically launched for every package.
8. Replay includes date-filtered search plus a carefully labelled historical evaluation. A past search filter alone does not recreate the whole historical web. Current OSV data must not be presented as if it were available before a historical cutoff.

## Evidence and risk rules
- One independent source can never exceed WATCH.
- HIGH requires at least two independent original reports with matching evidence for the installed version and high/critical severity.
- CRITICAL requires stringent version confirmation and strong independent corroboration, or verified maintainer/advisory evidence corroborated by another source, per the shared contract.
- Reposts of the same underlying report do not count as independent sources. Subdomains under one registrable domain must not be counted as independent.
- `not_affected` must not produce a high-risk alert. Unverified/missing dates, quotes or versions lower confidence or leave status at WATCH/INFO.
- Every displayed quote must be a short verbatim substring of fetched page text, maximum 25 words. Validate this in code.
- If OSV lookup fails, `in_osv=null`, not `false`. Never state “not in OSV” when the lookup failed.
- Avoid phrases such as “zero hallucinations,” “immune to prompt injection,” “guaranteed zero-day detection,” and “first tool ever.” Use test-backed, qualified claims.

## Replay/evaluation requirements
At least one well-sourced incident is the primary demo, plus a benign control. The evaluation file must attach a URL to every asserted publication date. Any uncertain fact is `null` with a note. Compare only information that can be shown to exist before the case cutoff; label present-day baseline lookups separately. Record false positives, source quality, version match and whether a claim is truly pre-cutoff.

## UI scope
- upload lockfile; select replay case; run scan
- status/progress and resilient SSE activity feed
- ranked findings with version, path, confidence, reasoning and clickable sources
- dependency graph if time allows; it is secondary to correct findings
- one-click Research and explicit Monitor control, with visible budget/status states
- plain-text rendering for all fetched data; no `dangerouslySetInnerHTML`
- sensible mock mode for development and judges; clearly label demo/mock findings

## Out of scope for the first submission
Other ecosystems and lockfile types, automated fix PRs, CI/CD blocking, private repository crawling, unattended background monitors, auth, and any promise to detect every zero-day.

## Done means
A clean local startup; mock scan works end-to-end; one real Search/Fetch integration works under the budget guard; Agent, Monitor and Research each have isolated smoke verification and clear graceful failures; unit tests use mocks; a verified incident plus benign control can be reproduced; frontend build passes; deployment is either correctly configured with durable budget storage or explicitly mock-only (never live-billable on an ephemeral/lost ledger).
