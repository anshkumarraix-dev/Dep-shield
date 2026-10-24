# DepShield Frontend (Early-Warning Supply-Chain Threat Intelligence)

Standalone Next.js (App Router) frontend for **DepShield**, an early-warning intelligence layer for public, version-specific dependency threat signals.

---

## 🎯 Product Positioning & Defensible Scope

- **What DepShield Is**: An early-warning intelligence layer for public, version-specific supply-chain threat signals that **complements** existing vulnerability scanners (such as Dependabot, Snyk, and OSV).
- **What DepShield Is NOT**: DepShield does not claim guaranteed zero-day detection or prediction, does not assert that every threat has a public pre-disclosure signal, and is not a replacement for standard CVE scanners.
- **Evidence Standard**:
  - Milestones are strictly separated: **First Public Signal**, **Official Vendor Advisory/Disclosure**, and **Official CVE Publication**.
  - A historical `before_date` parameter or current-web search filter is **not proof of historical availability**. Only contemporaneous, verifiable timestamps count toward lead-time benchmarks. Missing dates remain `null` / `"Unknown"`.
  - Corroboration requires **independent original sources**, not raw domain or URL counts. Reposts, syndicated feeds, and subdomains under the same registrable domain are deduplicated.
  - Confidence ratings represent **uncalibrated heuristic rule scores**, not statistical probabilities.

---

## 🧭 Capability Classification

| Category | Features & Scope |
| :--- | :--- |
| **Implemented (Live Frontend)** | Client-side `package-lock.json` v2/v3 parser, tri-state OSV badge logic (`true` / `false` / `null`), filterable findings table, slide-over evidence drawer, audit telemetry stream, Server-Sent Events (SSE) subscriber client. |
| **Mocked (Hackathon Demo)** | Synthetic demonstration signals (RFC 2606 test domains, zero allegations against real packages), client-side simulated 5-stage bounded scanner, preloaded demo replay sample. |
| **Roadmap (Post-Hackathon)** | Interactive D3-force dependency graph visualization (`d3-force`), automated Pull Request patch generation, continuous webhook/monitor ingestion. |
| **Proposed Validation (Research)** | Quantified lead-time benchmark testing whether public signals consistently precede CVE/advisory publication across a statistically balanced dataset. |

---

## 🚀 Quickstart & Setup

### 1. Installation

```bash
npm install
```

### 2. Run in Mock Mode (Default / 100% Offline)

DepShield starts in mock mode by default (`NEXT_PUBLIC_USE_MOCKS=1`). Zero external network requests or paid APIs are called.

```bash
# Verify .env.local contains NEXT_PUBLIC_USE_MOCKS=1
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser:
- Click **"Load Synthetic Demo Lockfile (Replay)"** to explore the complete threat intelligence workflow immediately.
- Or drag-and-drop your own `package-lock.json` (npm format v2 or v3) to evaluate local package tree coordinates.

---

## ⚙️ Environment Configuration

Configuration is managed via `.env.local` (safe template provided in `.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_USE_MOCKS` | `1` | `1` runs 100% offline demonstration mode. Set to `0` to route traffic to the live FastAPI backend. |
| `NEXT_PUBLIC_API_URL` | `http://127.0.0.1:8000` | Base URL of the backend FastAPI service when `NEXT_PUBLIC_USE_MOCKS=0`. |

> **Safety Guard:** When `NEXT_PUBLIC_USE_MOCKS=1`, an active guard in `src/services/apiClient.ts` blocks all external network requests to prevent accidental leaks or uncounted external calls. Secret API keys belong strictly on the backend and are never exposed to the frontend.

---

## 🔌 Integration Handoff for Ansh (Backend Integration)

When merging this frontend into the main DepShield repository, configure `NEXT_PUBLIC_USE_MOCKS=0` to connect to the FastAPI endpoints.

### 1. Expected Backend REST & SSE Endpoints

| Method | Endpoint | Expected Payload / Response |
| :--- | :--- | :--- |
| `GET` | `/api/v1/scans/summary` | Aggregate scan telemetry (`totalDependenciesScanned`, `criticalCount`, `shieldScore`, etc.). |
| `GET` | `/api/v1/findings` | List of findings. Query filters: `?search=...&risk=...&type=...`. |
| `GET` | `/api/v1/activity` | Chronological activity and audit events feed. |
| `POST` | `/api/v1/scans` | *(Unconfirmed schema)* Submits lockfile for scanning. |
| `GET` | `/api/v1/scans/{id}/events` | Server-Sent Events (SSE) stream (`progress`, `finding`, `activity`, `done`, `error`). |

### 2. Critical OSV Tri-State Contract

The backend finding payload must preserve the tri-state distinction for `in_osv`:
- `in_osv: true` &rarr; Confirmed match in OSV vulnerability database (**OSV Matched**).
- `in_osv: false` &rarr; Explicitly queried in OSV with 0 advisories (**OSV Clean**; flagged strictly by supply-chain heuristics).
- `in_osv: null` &rarr; OSV lookup was not performed / skipped (**OSV Unchecked**; provisional heuristic analysis).

The frontend normalizer (`normalizeFinding` in `src/services/scansService.ts`) supports both Python snake_case (`package_name`, `installed_version`, `is_direct`, `first_signal_at`) and camelCase (`packageName`, `installedVersion`, `firstSignalAt`).

### 3. Required CORS Configuration

FastAPI backend must enable CORS for the frontend origin:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## 🛠️ Verification & Build Checks

```bash
# Code quality & ESLint validation
npm run lint

# Next.js production bundle build & TypeScript typecheck
npm run build
```
