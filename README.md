# DepShield

**Proactive dependency supply-chain threat intelligence.** Upload a `package-lock.json`; DepShield checks the OSV/npm baseline, searches the public web for package-specific early signals, verifies evidence and version impact, and displays ranked findings with sources.

Team: The Disruptors · HackIIITD 2026 · Status: implementation not yet started.

## Start
1. Read `AGENTS.md`, `docs/PROJECT_SPEC.md`, `docs/BUDGET_POLICY.md` and `START_HERE.md`.
2. Start in mock mode (`USE_STUBS=1`, `TINYFISH_LIVE_ENABLED=0`).
3. Use one of the four prompts in `prompts/` from its owner's feature branch.
4. Follow `docs/WORKFLOW.md` for PRs and `docs/MENTOR_CHECKPOINTS.md` for milestones.

## Important limitations
- The current `tinyfish_client.py` is a reference implementation and is not yet safe for live use under the team's fixed budget. Aviral must implement the durable per-request gate before any live call.
- Findings are evidence-based risk signals, not proof of compromise. `unknown` baseline or version status must not be labelled safe.
- Historical date-filtered search does not reconstruct the entire public web at a past date.
- The frontend/backend deployment must not enable billable TinyFish calls without a durable event-wide budget ledger.
- Never commit `.env`, API keys, database files, or dependency/build folders.
