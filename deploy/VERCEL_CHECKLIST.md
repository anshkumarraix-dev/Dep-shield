# Vercel Deployment Checklist (Frontend Only)

## Overview
This checklist governs deploying the **DepShield Next.js frontend only** to Vercel's free tier for hackathon mentor reviews and judge demonstrations.

> **CRITICAL ARCHITECTURAL POLICY:**
> - The live billable backend runs **strictly on a local machine** with the durable SQLite budget ledger (`depshield.db`).
> - The Vercel frontend is deployed in **safe mock mode** (`NEXT_PUBLIC_USE_MOCKS=1`).
> - No paid cloud resources, hosting upgrades, or live billable API calls on ephemeral hosts.

---

## 1. Project Configuration in Vercel

| Setting | Value | Notes |
|---|---|---|
| **Framework Preset** | Next.js | Automatically detected |
| **Root Directory** | `frontend` | **Must be set to `frontend`**, not repo root |
| **Build Command** | `npm run build` | Next.js App Router build |
| **Output Directory** | `.next` (default) | Managed by Vercel |
| **Install Command** | `npm install` | Uses `package-lock.json` |
| **Node.js Version** | `20.x` or `22.x` | Set under Settings &rarr; General |

---

## 2. Environment Variables

Configure under **Settings &rarr; Environment Variables**:

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCKS` | `1` | **Required.** Activates offline mock/demo findings, clearly labelled. |
| `NEXT_PUBLIC_API_URL` | *(leave empty)* | Not needed in mock mode. Frontend serves canned replay fixtures directly. |

*Never commit `.env.local` or any API keys (`TINYFISH_API_KEY`, `GEMINI_API_KEY`) to Git or Vercel.*

---

## 3. Post-Deployment Verification Checklist

1. [ ] **Homepage loads:** App shell renders cleanly with header, pitch, and upload dropzone.
2. [ ] **Demo / Mock badge visible:** Visual indicator shows `MOCK MODE` / `DEMO DATA` so reviewers know signals are synthesized fixtures.
3. [ ] **Replay selector functional:** Selecting `event-stream-2018`, `ua-parser-js-2021`, or `benign-control-clean` populates findings table.
4. [ ] **Findings render properly:** Severity badges, source links, confidence breakdown, and reasoning render in plain text (no unescaped HTML).
5. [ ] **Console check:** Browser DevTools Console has zero uncaught exceptions, zero CORS errors, and zero failed network calls.
6. [ ] **No bundle leaks:** Source maps or client bundle contain no API keys, credentials, or private repository paths.

---

## 4. Why Backend is NOT on Vercel or Render Free

Per `docs/DEPLOYMENT.md` and `docs/BUDGET_POLICY.md`:
- TinyFish budget tracking requires an atomic, permanent SQLite ledger.
- Ephemeral containers (like Render Free or serverless lambdas) lose filesystem state on spin-down or restart, resetting the request counter and risking runaway spend against our $16 wallet limit.
- Live mentor/judge scans using real TinyFish units are performed exclusively via local PowerShell terminal where `reserve_tinyfish_request` is durable.
