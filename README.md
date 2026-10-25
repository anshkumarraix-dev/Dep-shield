# DepShield

**Proactive dependency supply-chain threat intelligence.** Upload a `package-lock.json`; DepShield checks the OSV/npm baseline, searches the public web for package-specific early signals, verifies evidence and version impact, and displays ranked findings with sources.

Team: The Disruptors · HackIIITD 2026 · Status: MVP implemented and hardened (end-to-end pipeline, deterministic scoring, SSE streaming, and durable budget governor verified).

## Run locally (PowerShell 5.1)

### 1. Environment configuration
Copy `.env.example` to `.env` (kept locally, never committed). Defaults run in safe offline mock mode:
```powershell
# Safe offline mock mode (zero cost, no outbound API calls)
$env:USE_STUBS="1"
$env:TINYFISH_LIVE_ENABLED="0"
$env:TINYFISH_BUDGET_STAGE="development"
```

### 2. Backend setup and server
From repository root in PowerShell 5.1:
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Run backend API server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### 3. Frontend setup and dev server
In a separate PowerShell 5.1 terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with the DepShield security console.

### 4. Running tests
```powershell
# Backend pytest suite (offline, mocked sockets)
cd backend
.\.venv\Scripts\Activate.ps1
python -m pytest -v

# Frontend test suite
cd frontend
npm test
```

## Important limitations
- Live TinyFish and Gemini calls are gated by strict budget enforcement ($0.25/unit, 48 development request cap, 64 event total cap). Live calls fail closed unless `TINYFISH_LIVE_ENABLED=1` is explicitly set and durable SQLite ledger is available.
- Findings are evidence-based risk signals, not proof of compromise. `unknown` baseline or version status must not be labelled safe.
- Historical date-filtered search does not reconstruct the entire public web at a past date.
- The frontend/backend deployment must not enable billable TinyFish calls without a durable event-wide budget ledger.
- Never commit `.env`, API keys, database files, or dependency/build folders.
