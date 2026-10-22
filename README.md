# qorgan

qorgan helps people check whether a new credit or installment plan is affordable *before* they sign. It weighs the
new payment against their income, mandatory expenses and existing debts. Then it explains the risk, shows safer
alternatives and builds a plan. qorgan is not a lender. The UI is in Russian and Kazakh.

- **frontend/**: React 18 + TypeScript + Vite + React Router + TanStack Query
- **dss/**: lab work — the standalone pandas/Streamlit version of the multi-criteria DSS (WSM + TOPSIS) for
  choosing a credit offer. The same model is built into the app as the «Выбор банка» screen (`/dss`,
  `backend/app/services/dss.py`). See [dss/README.md](dss/README.md).
- **backend/**: FastAPI + Pydantic. Data lives **in memory** for now. Every place that will need a database is
  marked `TODO: Database`.

## Run it

Requirements: Python 3.11+ and Node 18+.

```bash
# 1. API on http://127.0.0.1:8000  (docs at /docs)
cd backend
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 2. Web app on http://localhost:5173  (proxies /api to the API)
cd frontend
npm install
npm run dev
```

Run the API with a single worker. The in-memory store is per process and is reset on every restart.

Tests: `cd backend && pytest`. Type check and build: `cd frontend && npm run build`.

### Demo accounts

All demo accounts use the password `qorgan2026`. They are seeded on startup (`QORGAN_SEED_DEMO=0` turns this off).

| Phone | Who | Shows |
| --- | --- | --- |
| +7 701 234 56 78 | Айгерим | The main design scenario: 5 credits, 47% debt load, a smartphone on installments rated high risk |
| +7 701 555 01 01 | Мадина | A new account with no data: onboarding and the empty dashboard |
| +7 701 777 00 00 | Ерлан | A low debt load, so purchase checks come out green or yellow |
| +7 701 999 00 00 | Данияр | An overdue microloan and a stale credit report |

During registration, the SMS code is returned in the API response (`dev_code`) and shown on screen. No SMS is sent.

### Settings (environment variables)

| Variable | Default | Purpose |
| --- | --- | --- |
| `QORGAN_JWT_SECRET` | dev value | Secret that signs access tokens. Set a real one outside local dev. |
| `QORGAN_CORS_ORIGINS` | `http://localhost:5173,…` | Allowed web origins |
| `QORGAN_EXPOSE_DEV_CODES` | `1` | Return SMS codes in responses |
| `QORGAN_AI_OFFLINE` | `0` | `1` simulates an assistant outage (the "AI unavailable" screen) |
| `QORGAN_SEED_DEMO` | `1` | Seed the demo accounts on startup |
| `QORGAN_API_URL` (frontend) | `http://127.0.0.1:8000` | Where the Vite dev server proxies `/api` |

## How the assessment works

These are the rules from the design system ("Шкала qorgan"):

- **Debt load** = monthly credit payments ÷ income
- **Free money** = income − mandatory expenses − credit payments
- **Low risk**: load up to 30% *and* at least 20% of income left free
- **Medium risk**: load 30–45% *or* 10–20% of income left free
- **High risk**: load from 45% *or* less than 10% of income left free
- **Insufficient data**: income, expenses or credits are missing. qorgan then shows no risk level at all.

Alternatives (`backend/app/services/scenarios.py`) are: a longer term, a cheaper model, waiting until the most
expensive short debt is closed, and saving up without a new debt. qorgan recommends the one with the lowest risk,
and the soonest purchase among equals.

## «Выбор банка» (multi-criteria DSS)

The screen at `/dss` ranks six conditional bank offers for a purchase by six criteria (ГЭСВ, overpayment, debt
load after the deal, approval time, bank reliability, flexibility) with two methods, WSM and TOPSIS. Overpayment
and debt load are computed from the signed-in user's income and credits, so each demo account gives a different
matrix. Weights and matrix cells are editable; `GET /api/dss/problem?price=` returns the default problem and
`POST /api/dss/rank` validates, normalizes, ranks and compares. Bank conditions are illustrative, not live tariffs.

## Project layout

```
backend/app/
  main.py            FastAPI app, CORS, routers, demo seed on startup
  models.py          domain entities (one per future DB table)
  db/memory.py       in-memory stand-in for the database
  db/repositories.py the only code that reads/writes stored data
  services/          finance maths, assessment, scenarios, dashboard + plan, assistant, reports, consents, dss (WSM + TOPSIS)
  routers/           auth, me, credits, reports, overview (dashboard/checks/scenarios/plan), ai, notifications, consents, dss
  seed.py            demo accounts
frontend/src/
  api/               fetch client, types, React Query hooks
  i18n/              language provider + shared strings; each page has its own i18n.ts (ru + kk)
  components/        UI kit, app shell (sidebar / tablet rail / mobile bottom nav), charts, icons
  pages/             Landing, Auth, Onboarding, Dashboard, Credits, Check, Result, Scenarios, Plan, Dss, AI,
                     Notifications, Profile
```

## Not implemented yet

**Database.** Find every spot with `grep -rn "TODO: Database" backend`. The plan:

1. Add SQLAlchemy + Alembic + a PostgreSQL driver (see `requirements.txt`) and `database_url` in `app/config.py`.
2. Turn each entity in `app/models.py` into a table. The comments note the indexes and foreign keys.
3. Reimplement the repositories in `app/db/repositories.py` on a DB session, keeping the same method signatures.
   Open the session per request in `get_repositories()`.
4. Put sessions, SMS codes and revoked tokens in Redis with a TTL.
5. Move `seed.py` to a dev-only fixtures script.

**Integrations**, marked `TODO: Integration`:

- SMS delivery
- real parsing of credit bureau PDFs (the current parser checks the file, then returns a sample)
- an LLM behind qorgan AI (it is rule-based today)
- a scheduler for payment reminders and the email or browser channels
