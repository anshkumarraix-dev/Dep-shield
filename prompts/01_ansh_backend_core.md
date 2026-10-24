# Antigravity prompt — Ansh (backend core + integration owner)

You are Ansh's coding agent in the existing DepShield repository. Ansh owns the shared contracts and integration decisions. Do not create a new repo or push directly to `main`.

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
`backend/app/config.py`, `db.py`, `events.py`, `parser.py`, `stubs.py`, `orchestrator.py`, `main.py`, `backend/requirements.txt`, backend parser/DB/events/integration tests, `AGENTS.md`, `.env.example`, `docs/PROJECT_SPEC.md`, `docs/MENTOR_CHECKPOINTS.md`, `docs/DEPLOYMENT.md`, `docs/WORKFLOW.md`, `START_HERE.md`, `README.md`.

## Goal
Create the smallest reliable backend that works end-to-end using mock data, then integrate Aviral and Aman's modules without changing their owned files. Durable request budgeting is a blocking requirement before live TinyFish is enabled.

## Tasks — in this order
1. Inspect repo status/branch and protect existing work. Implement `config.py` loading root `.env` relative to `__file__`. Default `USE_STUBS=1`, `TINYFISH_LIVE_ENABLED=0`; fail clearly only when a requested feature needs a missing key.
2. Implement SQLite `db.py`: scans/findings, TTL cache, daily per-operation usage, and **atomic event-wide request ledger**. Implement `reserve_tinyfish_request(stage, development_cap, total_cap) -> (allowed,total_used,development_used)` with transaction/lock. Store permanent all-time counts; development cap 48, total cap 64; do not reset event-wide count at midnight. If DB or durable ledger fails, refuse live TinyFish requests (fail closed). Add concurrency/restart tests.
3. Implement `events.py` per-scan bus with replay of past events to late SSE subscribers and safe stream close on done/error.
4. Implement `parse_lockfile(lockfile_text)` for package-lock v2/v3 `packages` map, direct/transitive dependencies, nested `node_modules` resolution, dedupe by `name@version`, and shortest dep path. Provide useful `ValueError` on unsupported/corrupt input and fixture tests. Input is only `package-lock.json`; direct dependencies come from its root package record, so do not require a separate `package.json`.
5. Implement `stubs.py` with the same function signatures as the shared contract. Include a clean package, one single-source WATCH finding, and one corroborated HIGH finding; mock content must be labelled synthetic in UI/tests.
6. Implement `orchestrator.py`: parse all dependencies for the graph, but investigate at most `MAX_PACKAGES_ANALYZED_PER_SCAN=4`, direct dependencies first. Run baseline, Search, selected Fetch, Gemini extraction and pure scoring. Continue if one package fails; emit activity/progress/finding/done/error events and persist results.
7. Implement FastAPI routes from `AGENTS.md`: health, replay listing, scan upload, replay run, scan details, dependency graph, SSE, research-on-click. Start background scan tasks. Add restrictive configurable CORS. Do not automatically run Agent/Monitor/Research on every package.
8. Verify full mock flow from upload to results and SSE. Add offline tests with all external API access mocked. Keep `backend/requirements.txt` minimal and tell Ansh if Python 3.14 installation fails; do not hide failures.
9. Maintain `docs/DEPLOYMENT.md`: Vercel frontend + separate backend. Do not enable live TinyFish on an ephemeral backend filesystem with SQLite budget counters. Do not purchase/enable paid hosting without explicit human approval.

## Time order
- Before 15:00: establish repo/owners, shared spec and starting backend skeleton; do not waste time on CSS or cloud deployment.
- By 17:00: mock backend flow and API contract stable.
- By 21:00: integrate real modules and tests with Aviral/Aman.
- Tomorrow: bug fixes/deploy check only; freeze features by 07:00.

## Acceptance
From `backend/`, `uvicorn app.main:app --reload` starts in stub mode; `GET /api/health` passes; `POST /api/scans` accepts only one `lockfile` file; frontend can receive activity/progress/finding/done; pytest passes for parser/DB/events/orchestrator. Demonstrate the request ledger persists over process restart and rejects an over-cap reservation. No real calls in unit tests.

After each working increment, report files changed, tests actually run, remaining issues, and exact PowerShell `git add`/`git commit`/`git push` commands. Stop at the stated increment rather than refactoring the whole repo.
