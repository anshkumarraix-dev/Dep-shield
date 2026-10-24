# Internal mentor checkpoints — 24–25 October 2026

These are our internal acceptance targets, not official judge scoring weights.

## 15:00 Saturday — idea review
Explain the CVE-data blind spot, what users upload, the source-grounded pipeline, conservative scoring, budget controls and how replay is labelled honestly. Have a crisp architecture and a running repository skeleton if available. Do not present planned features as already finished.

Suggested 30-second explanation:
> “DepShield checks the exact npm versions in a lockfile against known vulnerability data, then investigates carefully selected public security signals with TinyFish. Gemini extracts claims and quotes, while deterministic rules decide the risk status. We show the evidence, source independence and uncertainty so early warnings are useful without treating rumours as critical vulnerabilities.”

## 17:00 Saturday — implementation review
Target: local app starts, mock upload-to-results path works, frontend is usable, the backend emits progress/activity events, and Aviral has demonstrated one Search and one Fetch request through the durable budget gate. Tests use mocks. Keep `USE_STUBS=1` for the stable demo path.

## 21:00 Saturday — integration review
Target: one end-to-end scan through real Search/Fetch evidence and deterministic scoring; one isolated Agent smoke run; one Monitor create/demo operation followed by pause; one Research run with no more than three polls. Each request is budgeted and failures are shown gracefully. Do not run these together automatically or repeat them without approval.

## Sunday 25 October — submission
- By 07:00: feature freeze, except critical fixes.
- 07:00–10:00: clean install, regression tests, deployment verification, screenshots/demo recording, README and presentation consistency checks.
- Aim to submit by 10:45, leaving buffer before the 11:30 deadline.

## Score evidence to collect
- one verified historical incident and one benign control
- proof that cited quotes occur in fetched text
- version match and source independence explanation
- test results, measured scan latency, request-unit usage
- working screenshots or live run for mock mode and live mode clearly separated
