# DepShield — shared build contract (read before every task)

## Product goal
DepShield is a developer-facing npm supply-chain threat-intelligence MVP. The user uploads **one `package-lock.json`**. DepShield builds the dependency tree, checks the current OSV/npm baseline, searches public web sources for early security signals, verifies evidence against exact package versions, and shows ranked findings with citations. It must be clear about uncertainty; it must not claim guaranteed zero-day detection.

Hackathon schedule (India time, Saturday 24 Oct 2026): mentor reviews at 15:00, 17:00 and 21:00. Submission deadline is Sunday 25 Oct 2026 at 11:30. See `docs/PROJECT_SPEC.md` and `docs/MENTOR_CHECKPOINTS.md`.

## Stack and environment
- Backend: Python, FastAPI, httpx, pydantic v2, `sqlite3`, pytest; SSE for activity/progress.
- Frontend: Next.js App Router, TypeScript, Tailwind; `d3-force` only if time allows.
- LLM: Gemini via `google-genai`; use the verified `GEMINI_MODEL` from `.env`, never guess a model id.
- Threat baseline: OSV.dev and npm registry. No auth, Celery, Redis or Postgres in the initial local MVP.
- TinyFish: official Python SDK. Existing `backend/app/tinyfish_client.py` is only a reference implementation and MUST be reviewed/fixed before any live request. Its old comments that Search/Fetch are free do not match this team's dashboard observation.
- Team systems: Windows 11, PowerShell 5.1, Python 3.14.4, Node 26.12.1. Use PowerShell syntax only: no `&&`, `source`, `export`, or bash scripts; use `curl.exe`, `$env:NAME="value"`, `.venv\Scripts\Activate.ps1`. If an install fails on Python 3.14, report it and try `py -3.12 -m venv .venv` only with Ansh's approval.
- Load the repo-root `.env` from a path based on `__file__`; do not rely on current working directory.

## Fixed user decisions
- Input scope for MVP: `package-lock.json` only; support lockfileVersion 2 and 3.
- Replay: ordinary date-filtered search AND a more rigorous historical evaluation using dated pre-cutoff evidence and an appropriate historical baseline. A `before_date` filter alone is not proof of a full historical web snapshot.
- Required TinyFish features: Search, Fetch, Agent, Monitor, Research. Search/Fetch form the normal scan path. Agent/Monitor/Research are selective, explicit operations and are not run for every dependency.
- Scoring: use conservative deterministic rules. An LLM extracts claims but does not choose the final status.
- UI: clean professional security console, high readability, restrained motion, neutral/light or slate surfaces with blue/cyan accents and text/icon risk labels. Avoid generic dark-purple/neon-green AI styling. No web text may render as HTML.
- API budget as observed in the team's TinyFish dashboard: assume **every outbound TinyFish API request costs $0.25**, including Search, Fetch, Agent, Monitor operations, Research queue/status polls and any wallet/API call. Caching avoids a request; retries and poll calls are separate request units. Do not replace this rate with published public prices.
- Wallet at planning time: $16 = at most 64 request units if the entire balance remains. Reserve $4 (16 request units) for the final demo. Development cap = 48 request units ($12); total event cap = 64 request units ($16). If the dashboard balance has fallen, Ansh must lower the caps before live testing.
- Deployment: Vercel frontend and a separate backend host. No paid hosting or add-ons without Ansh's explicit approval. Never enable live billable TinyFish operations on a host where its budget ledger can be lost on restart/redeploy.
- Current GitHub repo already exists, but collaborators/branches need setup. Do not blindly clone over an existing folder, overwrite uncommitted work, or push feature work directly to `main`.

## File ownership — strict
| Owner | Files owned |
|---|---|
| Ansh | `backend/app/config.py`, `db.py`, `events.py`, `parser.py`, `stubs.py`, `orchestrator.py`, `main.py`, `backend/requirements.txt`, backend integration/parser/db/event tests, root `AGENTS.md`, `.env.example`, `docs/PROJECT_SPEC.md`, `docs/MENTOR_CHECKPOINTS.md`, `docs/DEPLOYMENT.md`, `docs/WORKFLOW.md`, `START_HERE.md`, `README.md` |
| Aviral | `backend/app/tinyfish_client.py`, `backend/app/baseline.py`, `backend/scripts/**`, `backend/tests/test_tinyfish_client.py`, `backend/tests/test_baseline.py`, `deploy/**` |
| Ayush | `frontend/**` |
| Aman | `backend/app/classifier.py`, `backend/app/scoring.py`, `backend/tests/test_classifier.py`, `backend/tests/test_scoring.py`, `eval/**` |

`backend/app/models.py` is the shared contract. Do not silently edit it. If a necessary contract change is found, notify Ansh with the exact proposed field/signature and wait for Ansh to commit it. Do not edit another owner's files to make tests pass; send them a precise contract request instead.

## Shared function contracts
```python
# Ansh: parser
parse_lockfile(lockfile_text: str) -> list[Dependency]

# Aviral: live external evidence and baseline (all async, non-fatal per package)
search_signals(package: str, version: str, *, before_date: str | None = None,
               scan_id: str | None = None, emit: Emit | None = None) -> list[Source]
fetch_pages(sources: list[Source], *, scan_id: str | None = None,
            emit: Emit | None = None) -> list[PageContent]
agent_scan_issues(issues_url: str, *, scan_id: str | None = None,
                  emit: Emit | None = None) -> list[IssueItem]
create_topic_monitor(package: str, *, scan_id: str | None = None,
                     emit: Emit | None = None) -> str
run_monitor_now(monitor_id: str, *, scan_id: str | None = None,
                emit: Emit | None = None) -> dict
pause_topic_monitor(monitor_id: str, *, scan_id: str | None = None,
                    emit: Emit | None = None) -> bool
research_report(query: str, *, scan_id: str | None = None,
                emit: Emit | None = None) -> ResearchResult
osv_lookup(ecosystem: str, package: str, version: str, *, scan_id: str | None = None,
           emit: Emit | None = None) -> OsvResult
npm_metadata(package: str, version: str, *, scan_id: str | None = None,
             emit: Emit | None = None) -> NpmMeta

# Aman: Gemini extraction and pure deterministic scoring
classify(dep: Dependency, pages: list[PageContent], osv: OsvResult, *,
         scan_id: str | None = None, emit: Emit | None = None) -> list[Signal]
build_finding(dep: Dependency, scan_id: str, signals: list[Signal],
              sources: list[Source], osv: OsvResult) -> Finding | None

# Ansh: database
cache_get(key: str) -> dict | None
cache_set(key: str, value: dict, ttl_s: int) -> None
usage_get(name: str) -> int
usage_incr(name: str) -> int
reserve_tinyfish_request(stage: str, development_cap: int, total_cap: int) -> tuple[bool, int, int]
```

`reserve_tinyfish_request` must be atomic and durable: return `(allowed, total_used, development_used)`, reserve one request before each outbound TinyFish request, use a permanent event-wide counter (not a counter that resets at midnight), and fail closed if the durable ledger is unavailable. In `development` stage reject requests once 48 development requests have been reserved. In `final_demo` stage permit requests only while total usage is below 64. Set stage explicitly; never increase limits automatically. Each failed/timeout call still consumes a reservation because the request may have reached TinyFish. A cache hit consumes no request unit.

Activity events: only external operations emit `ActivityEvent` start/ok/error/cached; pure scoring and local DB operations do not need `emit`. Unit tests must mock every external network/LLM call.

## TinyFish budget/safety rules (non-negotiable)
1. `.env.example` defaults are `USE_STUBS=1` and `TINYFISH_LIVE_ENABLED=0`; the TinyFish client must refuse every real outbound call unless `TINYFISH_LIVE_ENABLED=1` is explicitly set. There must be no accidental live calls during normal startup/tests.
2. Count every actual outbound TinyFish request through the shared durable request governor. This includes each Search query, each Fetch batch, Agent run, Monitor create/run/pause, Research queue and every Research status poll. SDK hidden retries must be disabled (`max_retries=0` if the installed SDK supports it); any deliberate retry must go through a new reservation. Do not auto-retry failed calls.
3. Do not perform a wallet API call automatically at startup, per scan or per request. Check balance in the dashboard manually; if a wallet API call is ever used, it consumes a budget unit too.
4. Cache external responses before spending another request. No real TinyFish or Gemini calls in unit tests.
5. Hard caps: at most 4 packages are actively analysed in one scan; `SEARCH_QUERIES_PER_PACKAGE=2`; fetch only selected evidence and batch URLs; max 2 Agent runs, max 1 Research run, max 1 Monitor creation for the full event, and max 3 Research status polls per run. All these also count toward the 48 development/64 total global caps.
6. Agent, Monitor and Research are user-triggered / carefully smoke-tested only, not automatically launched for every package. Monitor must be paused immediately after the one demonstration run; do not leave paid scheduled monitoring active after the demo without explicit approval.
7. Research poll calls each cost a request unit. Poll at most 3 times, then show the run as pending with its id rather than looping or spending more.
8. Do not run smoke scripts on autopilot. Aviral first fixes budget enforcement and updates the scripts so one explicit invocation cannot fan out into many unbudgeted requests. The human approves each live API smoke test.

## Pipeline contract
1. Parse lockfile v2/v3, normalize/dedupe `name@version`, and build shortest dependency paths. Graph display may include the dependency tree, but analyse at most 4 packages per scan, direct dependencies first.
2. For each analysed dependency: OSV lookup + npm metadata; 2 Search queries maximum; fetch selected URLs; selectively classify pages with one Gemini call per package; deterministic score; persist finding; emit progress/activity.
3. Failure of one API/package must not fail the entire scan. Preserve explicit `unknown` states when lookups fail.
4. Agent is a selective operation for a likely repository issues URL. Research is started only by a user's Deep Research click. Monitor only by explicit user click and must be paused after its demo operation.
5. Replay uses a cutoff date for queries and requires evidence with verifiable publication dates before the cutoff. A live OSV lookup is current, not historical; do not display it as the historical baseline unless the case evaluator accounts for its publication date.

## HTTP API contract
- `GET /api/health`
- `GET /api/replay` -> list available replay cases `{id,title,description,as_of_date}`
- `POST /api/scans` multipart with one field `lockfile` (`package-lock.json`) -> `{scan_id}`
- `POST /api/replay/{case_id}` -> `{scan_id}`
- `GET /api/scans/{id}` -> `{scan,findings}`
- `GET /api/scans/{id}/dependencies` -> `{nodes,edges}`
- `GET /api/scans/{id}/stream` -> SSE events named `activity`, `finding`, `progress`, `done`, `error`; replay past events to late subscribers
- `POST /api/scans/{id}/research/{finding_id}` -> update/return finding with research result
- Explicit Monitor create/run/pause routes must be agreed with Ansh before either side builds UI. No monitor is created automatically by a scan.

## Work style and Git
- Begin by reading this file, `backend/app/models.py`, and only the owner-specific prompt. Avoid repo-wide scans.
- Give a plan of 10 lines or fewer, then implement immediately. Do not ask questions already answered here; ask only for a true blocker.
- Use Windows PowerShell 5.1 commands. Do not use bash syntax.
- Work on `feat/<name>-<area>` branches. Human runs Git commands. Commit small working increments every 20–30 minutes and create PRs into `main`. Ansh reviews merges. Never push feature work to `main`, force-push, or commit `.env`, DB files, or `node_modules`.
- PRs use **Create a merge commit**, not squash, to retain the development history.
- After each increment, state: files changed, commands/tests run, known issue, and exact PowerShell `git add`/`git commit`/`git push` commands. Do not claim tests passed unless you ran them.
