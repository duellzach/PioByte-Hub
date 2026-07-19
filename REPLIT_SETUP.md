# Replit Setup & Deploy Handoff

This is what Replit (or a person) needs to do to get **PioByte Hub** ready to run after pulling this code. Follow it top to bottom.

Stack: React 19 + Vite + Tailwind (front end) · Express 5 + Drizzle ORM + PostgreSQL (back end) · runs on `tsx` (no separate server build). Deploy target: Replit **Autoscale**.

---

## 1. Required Secrets (Replit → Tools → Secrets)

| Secret | Required? | What it's for | How to get it |
|--------|-----------|---------------|---------------|
| `SESSION_SECRET` | **YES — the app will not start in production without it** | Signs the login session cookie (JWT) | Any long random string. Generate: `openssl rand -base64 48` |
| `VAPID_PUBLIC_KEY` | Recommended (push notifications) | Web Push public key | Run `npx web-push generate-vapid-keys` — use the public key |
| `VAPID_PRIVATE_KEY` | Recommended (push notifications) | Web Push private key | …the private key from the same command. **Keep secret.** |
| `VAPID_SUBJECT` | Optional | Contact for push service | e.g. `mailto:you@yourteam.org` (defaults to a placeholder) |
| `TBA_API_KEY` | Optional | The Blue Alliance (FRC match data) | thebluealliance.com/account — *or* set it in-app via Control Panel → API Integrations |
| `TOA_API_KEY` | Optional | The Orange Alliance (FTC) | theorangealliance.org/account — or in-app |
| `NEXUS_API_KEY` | Optional | FRC Nexus (live event data) | frc.nexus — or in-app |

- **Without `SESSION_SECRET`** the server logs `FATAL: SESSION_SECRET is not set` and exits. Set it first.
- **Without the `VAPID_*` keys** push notifications simply stay disabled (the "Enable notifications" toggle hides, server logs "Web Push disabled") — no errors. Add them whenever you want device notifications.
- `DATABASE_URL` is **provided automatically** by Replit's PostgreSQL — do not set it manually.

Generate the two VAPID keys in one shot:
```bash
npx web-push generate-vapid-keys
```

---

## 2. Database — nothing manual required

Replit's integrated Postgres provides `DATABASE_URL`. On startup the server sets the schema up **automatically**:

- **Fresh database** (no tables): it runs `drizzle-kit push` to create the full schema, then seeds demo accounts.
- **Existing database**: idempotent migrations run on every boot (`ensurePushSubscriptionsTable`, `ensureRecurringTasksTable`, `ensureEventParticipationTables`, `ensureRequirementsAndFundraising`, plus the API-key/calendar column migrations) — they use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, so they are safe to run repeatedly and won't touch existing data.

You do **not** need to run any migration command by hand.

---

## 3. Build & Run

Already configured in `.replit`:
- **Build:** `npm run build` (compiles Tailwind + Vite build to `dist/`)
- **Run (production):** `npm run start` (serves `dist/` + the API on port 5000)
- **Dev:** `npm run dev` (server on 3001 + Vite on 5000 + Tailwind watch)

First time / after pulling: `npm install --legacy-peer-deps` (Replit's post-merge hook already does this).

---

## 4. First run — accounts & passwords

- On a fresh DB the app seeds demo accounts (e.g. `coach_mentor`, `team_captain`, …) with password **`changeme`**.
- **Change these immediately** in Team Management.
- **Password security:** passwords are stored as bcrypt hashes. Any legacy plaintext password is transparently upgraded to a hash the **first time that user logs in** (no action needed, no lockouts).

---

## 5. What's in this push (so you know what to expect)

- **Security hardening:** real login sessions (JWT in httpOnly cookie), password hashing (bcrypt) with lazy migration, server-side authorization on the API, API keys no longer leaked to the client.
- **Push notifications** (Web Push / VAPID) for task mentions, task **assignments**, and coach "Push Alert" broadcasts — Chrome/Android/**Chromebook**; iOS 16.4+ only when installed to the home screen.
- **Task features:** unsaved-changes prompt, created/completed-date documentation, **recurring tasks** (fixed-schedule generator).
- **Team Ops wave:**
  - Event **sign-up → coach accept → clock-in** (outreach/volunteer hours clocked on the shared time clock, tagged by kind).
  - **Fundraising** (students self-report → leadership verifies) with a dedicated page.
  - A configurable **Requirements** system (fundraising goal + per-category hour requirements with pre-season/in-season phases), edited in Control Panel → Requirements.
  - Redesigned **home dashboard** ("My Requirements" + "Upcoming" cards, denser grid).

---

## 6. Post-deploy checklist

1. [ ] `SESSION_SECRET` set (app starts).
2. [ ] `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` set (if you want notifications), then test on a real phone/Chromebook — notifications can't be verified in a headless build.
3. [ ] Log in, **change the demo passwords**.
4. [ ] Control Panel → set Team Identity + (optionally) API keys + configure **Requirements** (fundraising goal / hour requirements) so the home dashboard shows them.
5. [ ] If using FRC/FTC data, add TBA/TOA/Nexus keys (Secrets or Control Panel).

---

## 7. Notes for Autoscale

- The app is stateless-safe: sessions are signed cookies (no server session store), and the recurring-task generator + fresh-DB setup use DB-level guards/locks so multiple instances won't double-generate or double-seed.
- In-memory rate limiters (login/guest) are per-instance — acceptable, not a correctness issue.

Fuller engineering notes and the remaining backlog live in `docs/` (`IMPROVEMENT_PLAN.md`, `FEATURE_BACKLOG.md`, `design/`).
