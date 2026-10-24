# Deployment plan: Vercel frontend + separate Python backend

## Default approach
- Frontend: deploy `frontend/` to Vercel; set `NEXT_PUBLIC_API_URL` to the backend base URL and `NEXT_PUBLIC_USE_MOCKS=0` only when the live backend is ready. Use Vercel environment variables, not committed env files.
- Backend: FastAPI service with a start command equivalent to `uvicorn app.main:app --host 0.0.0.0 --port $PORT` from `backend/` (adapt `$PORT` syntax for the selected host's runtime). Configure TinyFish/Gemini keys as private service environment variables.
- Configure CORS for the exact Vercel production/preview origins; no wildcard CORS for a live API with billable external operations.
- Provide `/api/health` and a short manual deployment checklist. Never expose TinyFish or Gemini keys to browser code.

## Persistence is a launch blocker for live TinyFish
The hard budget guard lives in a durable SQLite ledger for the local MVP. Before enabling live billable calls in a cloud backend, verify that its file storage survives process restart, redeploy and idle spin-down. Render Free web services have ephemeral filesystems and spin down after 15 minutes idle, so a local SQLite database can disappear; a fresh empty budget ledger could accidentally permit overspending. See Render's official limitations: https://render.com/docs/free and https://render.com/docs/disks.

Therefore:
1. Do not enable live TinyFish on Render Free with local SQLite budget tracking.
2. If an existing backend-host account offers a persistent volume/durable database without a new payment, Ansh can use it after verifying persistence. Otherwise use the cloud frontend in clearly labelled mock/replay mode and keep the live billable integration on the local backend for the mentor demo, or ask for approval before adding paid hosting/durable storage.
3. A backend deployed with `USE_STUBS=1` and `TINYFISH_LIVE_ENABLED=0` may be used as a public preview, but label mocked findings clearly.
4. No agent may purchase a plan, attach a paid resource, or enable a billable unattended monitor without Ansh's explicit approval.

## Final deployment verification
- health route is reachable; CORS is restrictive; frontend calls correct backend URL
- scan starts and SSE is visible; refresh/reconnect does not corrupt status
- backend has durable event-wide budget ledger before live calls are enabled
- `.env`, API keys, SQLite files and local build outputs are absent from Git
- the final demo's TinyFish requests remain within 64 total units and at least 16 units were reserved until final-demo stage
