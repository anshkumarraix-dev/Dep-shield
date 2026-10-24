# Antigravity prompt — Ayush (Next.js frontend + Vercel)

You are Ayush's coding agent in the existing DepShield repo. Build a polished, useful security dashboard that starts with deterministic mock data and switches to the backend by changing environment variables only.

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
Everything under `frontend/**`. Do not edit the backend, root contracts, shared models or deployment files outside `frontend/`; send API mismatches to Ansh.

## Requirements
1. Read the shared contract and mirror `Finding`, `Source`, `Signal`, `ActivityEvent`, `Scan`, dependency graph and replay case shapes in `frontend/src/types.ts` (adjust actual scaffold path if `create-next-app` chooses `src/app`). The backend accepts only `package-lock.json`; do not require `package.json` upload.
2. Scaffold Next.js App Router + TypeScript + Tailwind if `frontend/` is only a placeholder. Don't overwrite a working frontend if one exists. Limit dependencies; use `d3-force` only for the graph if time allows.
3. Build a distinctive security product UI: readable neutral/slate surfaces, blue/cyan accents, amber/red status colours, clear text+icons, subtle purposeful motion, accessible contrast, responsive layout. Avoid generic AI neon-purple/green templates. Do not make colour the only way to express risk.
4. Home view: product explanation, single `package-lock.json` drag/drop upload, scan button, replay case chooser from `GET /api/replay`; mock mode includes at least one historical-style case clearly labelled as demo data. Show exactly what will happen and an error state for invalid files.
5. Scan view: state/progress (`packages_done/packages_total`), results sorted by risk/confidence, filters, package@version, direct/transitive dependency path, confidence, source count, summary, OSV state distinguishing `false` from `null`, evidence drawer with clickable source links, dates, verbatim quote, version-match explanation and `Deep research` action.
6. Prominent live activity panel for Search, Fetch, Agent, Monitor, Research, Gemini, OSV, npm, parser/system. Show action, target, latency/status and counters. Never display API keys or hidden budget secrets.
7. Implement SSE via `EventSource` for `activity`, `finding`, `progress`, `done`, `error`; handle reconnect and late events. Mock stream should use bounded client timers and clean up on unmount. Expose a visible backend/Mock mode badge so judges know when evidence is synthetic.
8. Dependency graph: useful only after core findings view works. Use d3-force with clickable nodes opening the evidence drawer. Show full parsed graph if provided; style flagged nodes distinctly.
9. Deep Research is click-triggered only. Monitor controls must be explicit and warn that each TinyFish request costs about $0.25; show status and paused state, never create a monitor automatically. Do not implement a client loop that polls Research/Monitor endpoints without backend budget enforcement.
10. Vercel: prepare `frontend/README.md` (or frontend-local deploy notes) documenting root directory `frontend`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_USE_MOCKS`, exact CORS requirement and the fact that secret API keys belong only on the backend. Avoid claiming the backend is deployed if it isn't.

## Mock data
Use synthetic, visibly labelled demo signals—not fabricated real-world allegations about real packages. Build enough examples to demonstrate INFO/WATCH/HIGH/CRITICAL cards, a clean dependency, the dependency graph and activity panel. Use reserved test domains or clearly synthetic labels, not fake real incident citations.

## Acceptance
- `npm run dev` with `NEXT_PUBLIC_USE_MOCKS=1` demonstrates upload → progress → findings → evidence drawer without backend or API keys.
- `npm run build` passes.
- With `NEXT_PUBLIC_USE_MOCKS=0` and a valid `NEXT_PUBLIC_API_URL`, the same UI consumes the agreed API/SSE contract without source edits.
- No `dangerouslySetInnerHTML`; all web content is plain text. Record test results and unresolved backend contract needs.
