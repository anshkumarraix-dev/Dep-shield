# DepShield Live Execution Run Log

## Budget Rules & Safety Limits
- Every outbound TinyFish request costs **1 unit ($0.25)** under our team ledger policy.
- **Development stage cap:** 48 request units ($12.00).
- **Final demo reserve:** 16 request units ($4.00), total cap 64 request units ($16.00).
- Live execution happens **only locally with human confirmation** from Ansh.
- Check `GET /api/health` before and after each run to verify the durable SQLite ledger.

---

## Planned Run Sequence

| Stage | Planned Action | Target Command | Est. Units | Stage Cap | Cumulative Est. |
|---|---|---|---|---|---|
| **Step 1** | Offline Dry Run | `python backend\scripts\smoke_tinyfish.py` | 0 | 48 (dev) | 0 |
| **Step 2** | Live Smoke Test | `python backend\scripts\smoke_tinyfish.py --search-fetch --confirm-spend` | 2 | 48 (dev) | 2 |
| **Step 3** | Replay: event-stream | Replay `event-stream-2018` with `MAX_PACKAGES_ANALYZED_PER_SCAN=2` | ~6 | 48 (dev) | ~8 |
| **Step 4** | Replay: benign control | Replay `benign-control-clean` with `MAX_PACKAGES_ANALYZED_PER_SCAN=2` | ~6 | 48 (dev) | ~14 |
| **Step 5** | Final Demo Run | Live scan with `TINYFISH_BUDGET_STAGE=final_demo` (Ansh only) | ~10–14 | 64 (final) | ~24–28 |

*Total development spend is planned at ~14 units, well below the 48-unit development cap.*

---

## Live Execution Audit Table

Fill in this table during live testing:

| Time (IST) | Command / Action | Units Reserved Before | Units After (`/api/health`) | Delta Units | Result (OK / Refused / Fail) | Notes / Observations |
|---|---|---|---|---|---|---|
| YYYY-MM-DD HH:MM | `python backend\scripts\smoke_tinyfish.py` | 0 | 0 | 0 | OK | Dry run verified zero network calls. |
|  | `python backend\scripts\smoke_tinyfish.py --search-fetch --confirm-spend` |  |  |  |  | Typed 'SPEND 2 UNITS' at prompt. |
|  | POST `/api/replay/event-stream-2018` (`MAX_PACKAGES_ANALYZED_PER_SCAN=2`) |  |  |  |  | Live search + fetch on event-stream & flatmap-stream. |
|  | POST `/api/replay/benign-control-clean` (`MAX_PACKAGES_ANALYZED_PER_SCAN=2`) |  |  |  |  | Live search + fetch on express & lodash. |
|  | Final Mentor / Judge Demo (`TINYFISH_BUDGET_STAGE=final_demo`) |  |  |  |  | Live execution reserved for final demo slot. |

---

## Pre-Run Verification Checklist
Before running any command that touches live APIs:
1. [ ] Confirm TinyFish dashboard balance matches ledger expectations.
2. [ ] Query `http://localhost:8000/api/health` to record `tinyfish_requests_used`.
3. [ ] Run `python backend\scripts\check_secrets.py --working-tree`.
4. [ ] Ensure `TINYFISH_LIVE_ENABLED=1` is exported only in the current PowerShell terminal session.
