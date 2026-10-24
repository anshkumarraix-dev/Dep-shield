# TinyFish cost and request-control policy

**Source of truth:** the team's TinyFish dashboard reportedly charges `$0.25` per request. Use this observed account rate, even if public plans list different pricing. Recheck the actual dashboard balance before live testing.

- Planning balance: `$16` = 64 request units if all of that balance remains.
- Protect final demo: `$4` = 16 request units.
- Development cap: 48 request units = `$12`.
- Total hard cap: 64 request units = `$16`.
- A cache hit makes no TinyFish request and costs no request unit.
- Each outbound TinyFish API operation counts: every Search query, Fetch batch, Agent operation, Monitor create/run/pause, Research queue and status-poll, and any optional wallet API call. A failed or timed-out request still counts.
- SDK retries are disabled. Automatic retries are not allowed. A deliberate retry must reserve a new unit first.
- The request ledger must be durable and atomic. It must survive process restarts and must NOT reset at midnight. If durable storage is unavailable, fail closed: refuse live TinyFish calls and explain why. Do not silently switch to an in-memory ledger for billable calls.
- In `development` stage, refuse after 48 reserved requests. Before final demo, Ansh manually switches `TINYFISH_BUDGET_STAGE=final_demo`; the 64-total cap still applies. Never change the stage automatically.
- Scan caps: analyse at most four packages, two Search queries per package, fetch only the selected evidence URLs. Agent runs at most twice, Research one run, Monitor creation one time and no more than three Research status polls. All are also covered by the global cap.
- No real calls in tests. Default is `USE_STUBS=1` and `TINYFISH_LIVE_ENABLED=0`.
- No wallet API polling at startup or per scan. Check balance manually in the TinyFish dashboard. If an optional script calls `wallet.get`, it must reserve one request and require an explicit `--wallet` flag.
- Monitor must be user-triggered. After its one demonstration run, pause it and verify the paused state; do not leave a recurring paid monitor running after the event without the user's explicit approval.
- Research starts once per event. Make at most three status-poll requests. If still running, return the run id and pending state; do not keep polling in the background.

**Budget gate required before the first live smoke test:** Ansh's SQLite ledger implementation and Aviral's pre-request guard must both be present and tested. Do not run the current starter `smoke_tinyfish.py` as-is: it currently calls the wallet automatically, fans out multiple Search queries, runs replay Search, and calls the wallet again; its old retry/cap behaviour is not compatible with this fixed budget.
