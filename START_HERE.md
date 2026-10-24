# Start here — DepShield prompt pack v2

You have not started implementation yet. This pack is designed for four parallel Antigravity Pro sessions and uses the existing DepShield GitHub repository.

## 1. Ansh: prepare the repository first
- Confirm repository access and add Aviral, Ayush and Aman as collaborators.
- Read `AGENTS.md`, `docs/PROJECT_SPEC.md`, `docs/BUDGET_POLICY.md` and `docs/MENTOR_CHECKPOINTS.md`.
- Apply these files to the existing repository only after checking `git status` and reviewing the diff. Do not overwrite `.env` or other local work.
- Create/commit the shared contract and tell the other three when `main` is ready to pull.

## 2. Four simultaneous agents
Each person checks out their own branch, opens their prompt file, and pastes the whole file into Antigravity as the first instruction:

| Person | Prompt | Owned scope |
|---|---|---|
| Ansh | `prompts/01_ansh_backend_core.md` | config, durable DB/budget ledger, parser, SSE, stubs, FastAPI |
| Aviral | `prompts/02_aviral_tinyfish.md` | budget-safe TinyFish wrapper, OSV/npm baseline, scripts and backend deployment blueprint |
| Ayush | `prompts/03_ayush_frontend.md` | frontend, mock mode, Vercel setup |
| Aman | `prompts/04_aman_classifier_scoring.md` | Gemini extraction, deterministic scoring, verified replay evaluation |

All prompts share the same API contract and fixed budget. Agents must not change another person's files or silently change shared models.

## 3. Critical safety warning: do not run the old smoke script yet
The existing starter `backend/scripts/smoke_tinyfish.py` calls wallet APIs and fans out multiple searches/fetches without enforcing the new global request-unit cap. **Do not run it until Aviral has updated `tinyfish_client.py` and the script, and Ansh's durable budget ledger tests pass.** First smoke should be explicitly approved by Ansh and use one Search + one Fetch request only.

## 4. Environment
- Root `.env.example` is a template only. Copy to `.env` and fill keys locally; never commit it.
- Start with `USE_STUBS=1`, `TINYFISH_LIVE_ENABLED=0`, `TINYFISH_BUDGET_STAGE=development`.
- Every outbound TinyFish request is budgeted as $0.25 based on your dashboard. 48 development requests max; keep 16 request units/$4 reserved for the final demo. Total hard cap 64 only if the entire original $16 remains.
- Tests use mocks. Live tests are manual, limited and each request counts.

## 5. Time checkpoints
See `docs/MENTOR_CHECKPOINTS.md`. Prioritise a runnable mock end-to-end path by 17:00, one carefully budgeted real Search/Fetch check, and full controlled integration by 21:00.
