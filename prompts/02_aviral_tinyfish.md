# Antigravity prompt — Aviral (TinyFish + baseline + budget-safe deployment)

You are Aviral's coding agent. Your job is the only code allowed to make outbound TinyFish requests. The current `backend/app/tinyfish_client.py` is a reference implementation, **not safe for live use yet**. Do not call the API until budget guard and smoke script fixes are committed and Ansh explicitly approves the first smoke.

COMMON RULES FOR ALL AGENTS
- This is a time-critical hackathon; output a plan of no more than 10 lines, then start. Only ask a question if a real blocker prevents safe implementation.
- Read `AGENTS.md`, `backend/app/models.py`, `docs/PROJECT_SPEC.md`, and your prompt. Do not scan the whole repository.
- Edit only your owned files. Ask Ansh for a shared contract change; do not silently edit models or another agent's code.
- Use PowerShell 5.1 commands only. Do not run real TinyFish/Gemini calls in tests. Do not run live calls until the global SQLite budget guard is implemented and Ansh explicitly approves a smoke test.
- Never open/print/commit `.env` or API keys. The app must start in `USE_STUBS=1`, `TINYFISH_LIVE_ENABLED=0` mode.
- Every outbound TinyFish request is treated as $0.25: 48 development request units max and 64 total max only if the full $16 balance remains, reserving 16 requests/$4 for final demo. Cached responses cost no request unit. No uncounted retries; each poll is a separate unit.
- Work in 20–30 minute increments and commit only your own files. Print exact PowerShell Git commands, but the human runs them. Push your feature branch and open a PR into `main`; do not push feature work directly to `main`.
- Report exactly what you tested and what remains unverified. Never claim a feature or test works merely because its code was generated.


## Files you own
`backend/app/tinyfish_client.py`, `backend/app/baseline.py`, `backend/scripts/**`, `backend/tests/test_tinyfish_client.py`, `backend/tests/test_baseline.py`, `deploy/**`.

## First tasks — do not skip order
1. Review existing client and eight offline tests. Preserve verified pieces; do not rewrite from scratch. Identify every TinyFish outbound method and every path that retries/polls.
2. **Budget gate first:** refuse real calls unless `TINYFISH_LIVE_ENABLED=1`; use Ansh's `reserve_tinyfish_request()` before every actual outbound TinyFish request after checking cache. Use `AsyncTinyFish(max_retries=0)` if the installed SDK supports it so hidden retries cannot bypass the ledger. Do not auto-retry. A manual retry requires a new reservation. Failed/timeouts still count. If the database/ledger cannot be imported or used, fail closed—no in-memory budget fallback for live calls.
3. The hard caps are 48 development request units, 64 total units, observed rate `$0.25/request`, `$4`/16 units held for final demo. Use `TINYFISH_BUDGET_STAGE=development` until Ansh explicitly changes it. Search/Fetch are counted too, regardless of public pricing. `cache_hit` makes no request. Do not poll wallet automatically; Ansh checks the dashboard.
4. Fix `_call` so each API request attempt gets one fresh reservation, an ActivityEvent and a timeout. Remove unbounded/hidden retries. Every Research `.get()` poll and every Monitor create/run/pause operation must be guarded. Research is one run max and up to three status-poll requests. Add `pause_topic_monitor()` and pause immediately after a demo Monitor operation.
5. Reduce scan workload to at most 2 Search queries/package, selected Fetch pages, max 4 analysed packages per scan. Add robust cache keys and useful failure events. All web text remains untrusted.
6. Replace `smoke_tinyfish.py` with explicit, conservative modes: default dry/offline mode performs no live requests; `--search-fetch` performs at most one Search query and one Fetch batch after a warning/explicit confirmation flag; `--agent` one Agent request; `--monitor` one create/demo operation and pause; `--research` queue + no more than three polls. Do not auto-call `wallet.get`. Each operation requires an explicit flag and prints request-unit usage from local ledger. Save only selected public fetched text to fixtures; don't print keys.
7. Only after Ansh approves, use one Search + one Fetch request for the first live smoke. If they pass, run one Agent operation. After Ansh approves a later step, do one Monitor operation and pause it; do one Research run with up to three polls. Do not repeatedly tune queries with live requests; test ranking with recorded fixtures. If a live API fails, inspect only its specific official TinyFish reference page.
8. Build `baseline.py`: `osv_lookup` via OSV POST and npm registry metadata via `httpx`, 15-second timeouts, cached where useful, ActivityEvents `osv`/`npm`; catch errors and return `OsvResult(error=...)` / safe defaults, never mark failed lookup as clean. Unit tests mock HTTP only.
9. Build `backend/scripts/list_gemini_models.py` for Aman; it must load `.env` but never print the API key. It can list model IDs when the human explicitly runs it; do not call Gemini automatically during tests.
10. Add `backend/scripts/try_classifier.py` after Aman's classifier/scoring signatures are agreed. The script loads saved page fixtures, runs classify + build_finding, prints JSON, and makes no external requests. It belongs to `backend/scripts/**` (your ownership). Coordinate with Aman rather than writing inside his files.
11. Add a backend deployment blueprint in `deploy/` only after local tests. Document that live billing requires a durable DB/volume for request accounting. Do not recommend Render Free + local SQLite for billable operations (its filesystem is ephemeral); do not create paid infrastructure without approval. Provide a safe mock deployment alternative.

## Must-fix issues in current reference implementation
- Search/Fetch are currently not covered by the global budget guard despite this dashboard charging for every request.
- `AsyncTinyFish()` defaults to internal retries in the inspected SDK; prevent hidden uncounted retries.
- Research polling currently calls `.research.get()` directly in a loop without request accounting/cap; wrap every poll and stop after three.
- Monitor run has no global request reservation; monitor creation and scheduled runs can spend money after demo; add explicit pause and do not schedule unattended monitoring.
- `wallet_balance()` calls `wallet.get`; it must never run automatically or without request reservation.
- Old smoke script automatically runs wallet + multiple searches + fetch + replay + wallet. It is not safe for the fixed budget; replace it before first use.
- Existing cache fallback to memory is acceptable for offline tests, but live calls must fail closed if durable request ledger is missing.

## Acceptance
- Offline tests assert each outbound method reserves exactly one unit; cache hits reserve zero; failures still count; cap rejects before any call; no hidden retry; Research polls stop after three; Monitor is paused; missing ledger refuses a live call.
- Baseline tests use mocked `httpx`, no real network.
- First live integration smoke requires Ansh's explicit approval and only spends one Search + one Fetch unit initially.
- Show actual test results honestly. Do not claim five live API integrations pass until each has been tested individually within the cap.
