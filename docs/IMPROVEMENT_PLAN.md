# PioByte Hub — Assessment & Improvement Plan

_Assessed 2026-07-18. This document is written as a handoff: each work package (WP) below is self-contained enough to give to a developer or AI model as a standalone task. Do them in the order listed unless noted._

## Context every implementer must know

- **This is a Replit app.** Changes pushed to GitHub (`duellzach/PioByte-Home`) flow back into the Replit workspace and deploy via Replit **Autoscale** (`.replit → [deployment]`, `build: npm run build`, `run: npm run start`).
- **Autoscale = possibly multiple stateless instances.** Anything in-process (in-memory sessions, rate-limit Maps, caches) is per-instance and lost on restart. Auth must be stateless (signed cookie/JWT) or DB-backed — never an in-memory session store.
- **Do not modify `.replit` ports or workflows** unless a WP explicitly says so. Dev: server on 3001 + Vite; Prod: server on 5000 serving `dist/`.
- **No native Node modules.** Use `bcryptjs` (pure JS), not `bcrypt`, to avoid nix build issues in Replit.
- **Runtime is `tsx`** (no server build step). Keep it that way.
- **Secrets live in Replit Secrets** (env vars). Any new secret (e.g. `SESSION_SECRET`) must be added there by the owner before deploy — call this out in your handback notes.
- Stack: React 19 + Vite + Tailwind (build-time CSS), Express 5, Drizzle ORM + Postgres, PWA w/ service worker + offline queue. ~24k lines TS/TSX.

## Current-state assessment (summary)

**Good:** clean per-feature route separation (`server/routes/*`), Drizzle ORM everywhere (no SQL injection surface), typed schema (`shared/schema.ts`), role model already defined (Coach / Team Captain / Scrum Master / Department Head / Safety Trainer / Team Member) with server-side role checks in `server/helpers.ts`, guest-PIN flow with rate limiting, thoughtful PWA/offline support, fresh-DB auto-bootstrap for painless remixing.

**Critical flaws (all fixable without re-architecture):**

| # | Issue | Where |
|---|-------|-------|
| 1 | Passwords stored & compared in **plaintext** | `shared/schema.ts` (users.password), `server/routes/users.ts` (`user.password === password`), `server/storage.ts` seeds |
| 2 | `GET /api/users` **returns every user's password**; `POST /login` returns the full user row incl. password | `server/routes/users.ts` |
| 3 | **No authentication layer.** Identity = `requesterId` field in the request body (≈69 uses across `server/routes/`), fully client-spoofable. Anyone can pass `requesterId` of a Coach. | all route files |
| 4 | User CRUD wide open: anyone can `PUT /api/users/:id` (set any password), `DELETE`, or create users with no auth | `server/routes/users.ts` |
| 5 | `cors()` open to all origins | `server/index.ts` |
| 6 | External API keys (TBA/TOA/Nexus) stored plaintext in `team_settings` table; the update route is guarded only by spoofable `requesterId` | `server/routes/settings.ts`, `server/helpers.ts` |
| 7 | `drizzle-kit push --force` + demo-account seeding run **automatically at server startup** — racy under autoscale, dangerous against a DB with real data | `server/index.ts` |
| 8 | Repo hygiene: `zipFile.zip`, `.DS_Store`, `attached_assets/`, `.replit_integration_files/` committed; `.gitignore` does **not** cover `.env` | repo root |
| 9 | `@google/genai` is a dependency but only referenced by unwired `.replit_integration_files/` code | `package.json` |
| 10 | No tests, no lint config; `services/api.ts` is `any`-typed throughout | — |
| 11 | **`GET /api/settings` returns the TBA/TOA/Nexus API keys in plaintext to any caller** (client fetches it on every app load, pre-login) | `server/routes/settings.ts` GET `/settings` |
| 12 | **Time-tracking approval endpoints have NO role check at all** — `confirm`, `PUT /time-entries/:id` (edit times), `DELETE`, and `bulk-add` trust a body-supplied `coachId` without verifying it belongs to a coach. A student can approve, edit, or delete their own hours | `server/routes/time.ts` |
| 13 | `POST /api/seed` is unauthenticated (harmless once users exist, but shouldn't be public) | `server/routes/resources.ts` |
| 14 | Tasks, projects, notifications, announcements routers have zero authorization — anyone can read all notifications and edit/delete any announcement, task, or project | `server/routes/tasks.ts`, `projects.ts`, `notifications.ts` |
| 15 | Scout `POST /scout-events/:id/import` is an unauthenticated bulk-write; TBA/TOA/Nexus proxy routes are an unauthenticated proxy that burns the team's API quota | `server/routes/scout.ts` |

**Bugs found in full read (not security):**

| # | Bug | Where |
|---|-----|-------|
| B1 | `getCompetitionEventAudit(eventCheckinIds)` ignores its filter argument entirely and returns the whole audit table | `server/storage.ts` ~line 670 |
| B2 | `patchCalendarEventDeletedDates` writes `JSON.stringify(deduped)` into a jsonb column → likely double-encoded string instead of an array; verify read path and fix to pass the array directly | `server/storage.ts` ~line 1040 |
| B3 | Password-reset inconsistency: TeamManagement resets to `'password'`, seeds use `'changeme'`, `POST /users` defaults to `'password'`, and the login-failure alert leaks the default ("Default password is \"password\"") | `components/TeamManagement.tsx:258`, `App.tsx:359`, `server/routes/users.ts` |
| B4 | `GET /time-entries` performs DB writes (status fix-ups) inside the read loop — racy with concurrent polls and slow; move to write-path logic or one-time migration | `server/routes/time.ts` |
| B5 | Scout routes build user maps with `u.displayName \|\| u.username` but the schema has no `displayName` field (real field is `name`) — always falls back to username | `server/routes/scout.ts:103,117` |
| B6 | Login screen hint and seed-success alert reference `captain10991`, but the seeded username is `team_captain` | `App.tsx` login form + `handleSeedDatabase` |
| B7 | `scripts/post-merge.sh` runs `npm run db:push --force` — the `--force` goes to npm, not drizzle-kit, so the flag is silently dropped (`\|\| true` hides any failure). Should be `npm run db:push -- --force` if intended — but see WP5 before "fixing" (auto-push on merge is itself questionable) | `scripts/post-merge.sh` |
| B8 | CSV export doesn't guard against spreadsheet formula injection (cell starting with `=`, `+`, `-`, `@`) | `server/routes/scout.ts` `sendScoutCsv` |
| B9 | Duplicate route implementations: guest-pin CRUD and CSV export each exist under two path prefixes (`/events/…` and `/scout/events/…`) — consolidate to one and redirect/alias the other | `server/routes/scout.ts` |

---

## WP1 — Repo & secrets hygiene (small, do first)

**Goal:** stop future leaks, clean the repo. No behavior changes.

1. Append to `.gitignore`: `.env`, `.env.*`, `*.zip`, `.DS_Store` (already there but recommit), `attached_assets/`.
2. `git rm --cached` and delete: `zipFile.zip`, `.DS_Store`, `attached_assets/` (Replit agent scratch artifacts — the two pasted-doc `.txt` files, a PNG, and an `openapi_*.json`; nothing imports them).
3. Decide `.replit_integration_files/`: nothing outside it imports it. Either delete it **and** remove `@google/genai` from `package.json`, or leave both untouched if the owner plans to wire Gemini soon. **Ask the owner; default = delete.**
4. Do **not** touch `.agents/`, `.replit`, `replit.md` (Replit needs these).

**Acceptance:** `npm run build` and `npm run dev` still work; `git status` clean; no `.env` can ever be committed.

## WP2 — Password hashing (critical)

**Goal:** no plaintext passwords at rest, no passwords in API responses. Must not lock out existing users.

1. Add `bcryptjs` (NOT `bcrypt`).
2. `server/routes/users.ts`:
   - `POST /login`: fetch user, compare with `bcrypt.compare`. **Lazy migration:** if the stored value is not a bcrypt hash (doesn't start with `$2`) and strictly equals the submitted password, accept, then immediately hash-and-save. This migrates the existing team on their next login with zero downtime.
   - `POST /users` and `PUT /users/:id` and `/users/:id/change-password`: hash before storing. Remove the `password: req.body.password || 'password'` default — require a password ≥ 8 chars (zod).
3. **Strip password from every response.** Add `sanitizeUser(u)` (omit `password`) in `server/helpers.ts`; apply in `GET /users`, `POST /login`, `POST /users`, `PUT /users/:id`, and anywhere else a user row is returned (grep `res.json` in routes + check `server/storage.ts` returns).
4. `server/storage.ts` `seedDatabase()`: hash the seeded `changeme` passwords too.
5. Add login rate limiting mirroring the existing `guestLoginAttempts` pattern in the same file (10 attempts / 15 min / IP). Note in code: per-instance under autoscale, acceptable.
6. **Strip API keys from `GET /api/settings`** (finding #11): omit `tbaApiKey`/`toaApiKey`/`nexusApiKey` from the response (the UI only needs `GET /settings/api-status` booleans, which already exist). This is a two-line fix — do it in this WP, don't wait for WP4.
7. Fix the B3 password-default inconsistency while in these files: remove the plaintext default entirely (require a password on create), change TeamManagement's reset flow to set a coach-entered temporary password, and delete the "Default password is…" hint from the login error.

**Acceptance:** existing plaintext user can still log in once and their row becomes a `$2…` hash; `GET /api/users` response contains no `password` key; new users require a real password.

## ✅ WP2 — DONE (2026-07-18)

Implemented and verified live:
- Added `server/security.ts` (`hashPassword`, `verifyPassword` with lazy-migration signal, `isHashed`, `sanitizeUser`) using **`bcryptjs`** (pure-JS, Replit-safe).
- `POST /login`: bcrypt verify + **lazy migration** (legacy plaintext row accepted once, then rehashed) + IP rate limit (10/15min). Verified: `member1`/`coach_mentor` still log in with `changeme`, and their DB rows became `$2a$…` hashes afterward; users who haven't logged in stay plaintext until they do (zero lockouts).
- `POST /users`, `PUT /users/:id`, `/users/:id/change-password`: hash before store, enforce ≥8 chars, removed the `'password'` default.
- **Passwords stripped from every response** (`GET /users`, login, create, update) via `sanitizeUser`. Verified: `GET /api/users` no longer contains a `password` field.
- **API keys stripped from `GET /settings`** (finding #11/R3). Verified: response no longer contains `tbaApiKey`/`toaApiKey`/`nexusApiKey`.
- Seed (`storage.seedDatabase`) now hashes demo passwords.
- Client: login error no longer leaks the default password and now surfaces the real server message (e.g. rate-limit).

**Still open after WP2 → WP3 closes it:** the unauthenticated `PUT /api/users/:id` account-takeover (#4) — needs the auth middleware below, because WP2 hardened *how* passwords are stored but not *who* may change them.

## ✅ WP3 — DONE (2026-07-18)

Implemented and verified live against the running app:
- **JWT session in an httpOnly cookie** (`server/security.ts`: `signSession`/`verifySession`, `SESSION_COOKIE`, cookie options; `SESSION_SECRET` from env with a dev fallback). `app.set('trust proxy', 1)` + `cookie-parser` added; prod boot **fails fast if `SESSION_SECRET` is unset**; CORS is same-origin in prod, `credentials`-enabled localhost in dev.
- **Auth middleware** (`server/middleware/auth.ts`) gates all `/api` routes with a small public allowlist (login, guest-login, settings read + PWA icons/logos). Attaches `req.userId`/`req.userRoles` from the token.
- **Guest tokens** are scoped: read-only scouting for their event only; everything else 403.
- **`requesterId` sweep closed at the middleware layer** — for authenticated members the server overwrites the well-known actor fields (`requesterId`, `createdBy`, `coachId`, `actorId`, `grantedBy`, `trainerId`, `updatedBy`, `deletedBy`, `authorId`) with the verified `req.userId`, so the ~69 spoofable sites can no longer be forged (subject `userId` fields left intact). No per-route edits needed; client stays backward-compatible.
- **User management locked down**: create/delete → Coach/Team Captain; edit → self or Coach/Captain (role/password changes on others stripped for non-privileged); change-password → self only; added `GET /me` and `POST /logout`.
- **Client**: `services/api.ts` sends the cookie (`credentials: 'include'`) and has `auth.me()`/`auth.logout()`; `App.tsx` restores the session via `/me` on boot (no longer trusts localStorage for auth), gates polling on login, and calls `/logout` on sign-out.

**Verified live (re-ran the proven exploits + escalation cases):**
- Anonymous `GET /api/users` → **401** (was 200 leaking passwords). Anonymous `PUT /api/users/:id` account-takeover → **401** (was 200). ✅ **Account takeover closed.**
- Logged-in Team Member: overwrite coach password → 403; create user → 403; self-grant Coach role → stripped; forge `requesterId`/`coachId` for a coach-only action → 403. ✅ **Privilege escalation closed.**
- Legit coach action with a forged `requesterId: 99999` → created, attributed to the real coach (`createdBy: 1`). Guest: reads scouting (200), blocked from users/writes/calendar (403). Login→dashboard, session-persist-on-reload, and logout→login all work in the browser; cookie survives the Vite proxy.

**⚠️ Owner action before deploy:** add a long random **`SESSION_SECRET`** to Replit Secrets. Without it, production boot aborts by design.

## WP3 — original plan (for reference)

**Goal:** replace body-supplied `requesterId` with server-verified identity. Keep the existing role logic — it's fine — just feed it a trustworthy user ID.

**Design (stateless, autoscale-safe):**
1. On successful `POST /login`, issue a JWT (payload: `{ userId, roles }`, 30-day expiry) signed with `process.env.SESSION_SECRET`, set as an **httpOnly, sameSite=lax, secure** cookie. Add `app.set('trust proxy', 1)` in `server/index.ts` (Replit terminates TLS at a proxy). Add `cookie-parser`. Fail fast at startup if `SESSION_SECRET` is unset in production (generate a dev fallback in dev).
2. Auth middleware on `/api`:
   - Public allowlist: `POST /login`, `POST /guest-login`, `GET /manifest.json`, `/api/settings/pwa-icon.*`, `/api/settings/tba-logo`, plus the guest-readable scout endpoints (see step 4).
   - Everything else: verify JWT, attach `req.userId` (extend Express `Request` via a `.d.ts`).
3. **Sweep all ~69 `requesterId` sites** in `server/routes/*.ts`: replace `req.body.requesterId` / `req.query.requesterId` with `req.userId`. Keep every existing `getUserRoles`/`hasAnyRole` check as-is. Remove `requesterId` from client payloads in `services/api.ts` afterward (server should ignore any still sent).
4. **Guest flow:** `POST /guest-login` issues a *guest JWT* `{ guest: true, eventId }`. Middleware lets guest tokens through **only** to read-only scout endpoints for that `eventId` (event data, pit/match scout reads, `GET /api/scout-events/:id/export.csv`). Everything else 403s for guests.
5. Lock down user management: create/delete users and editing *other* users' roles/passwords → Coach/Team Captain only; any user may edit own profile and change own password (verified against current hash).
5b. **Routes with NO checks today that must gain them in the sweep** (findings #12–#15): all of `time.ts`'s confirm/edit/delete/bulk-add (Coach/Captain only — this is the audit-integrity core), `POST /api/seed` (remove or Coach-only), tasks/projects CRUD (any authenticated member may create/update; delete → Coach/Captain/project scrum-master), notifications (users may only read their own and mark their own read), announcements PUT/DELETE (author or Coach/Captain), scout `import` (authenticated members only), and the TBA/TOA/Nexus proxy routes (authenticated members + guests scoped to their event).
6. Add `POST /logout` (clear cookie) and `GET /me` (return sanitized current user from token). Client (`App.tsx` lines ~242–394): replace the `localStorage.getItem('frc_hub_active_user')` trust-the-ID pattern with a `GET /me` call on boot; keep localStorage only as a UX hint. Fetch calls are same-origin so cookies flow automatically; verify `apiRequest` needs no change (it shouldn't).
7. **Deploy note for owner:** add `SESSION_SECRET` (long random string) to Replit Secrets before this lands.

**Acceptance:** `curl PUT /api/users/1` with no cookie → 401. A Team Member's cookie on a Coach-only route → 403. Login → app works as before. Guest PIN → can view/export that event's scouting only. `grep -rn "requesterId" server/` → 0 hits.

## WP4 — API hardening (do with or right after WP3)

1. CORS: in production, drop `cors()` entirely (same-origin app — server serves the client). In dev keep it for `localhost` Vite origin only: `cors({ origin: /localhost/, credentials: true })` gated on `!isProduction`.
2. Add zod validation to mutating routes. `zod` + `drizzle-zod` are already installed — use `createInsertSchema` from the Drizzle tables in `shared/schema.ts` and `.parse(req.body)` in routes; 400 with the zod message on failure. Prioritize: users, settings, time, tasks; then the rest.
3. Add `helmet` (disable CSP initially to avoid breaking the PWA/inline assets; enable piecemeal later).
4. Keep `express.json({ limit: '10mb' })` (needed for base64 logo/PWA-icon uploads in settings) but apply a `1mb` limit to all routers except settings if straightforward.

**Acceptance:** app functions identically in the browser; malformed POST bodies get 400s not 500s; responses carry helmet headers.

## WP5 — Startup & deployment correctness

**Goal:** make boot safe for a real, multi-instance deployment.

1. `server/index.ts` `initializeDatabase()`: keep the fresh-DB detection, but wrap schema push + seeding in a Postgres **advisory lock** (`SELECT pg_advisory_lock(…)`) so concurrent autoscale instances don't race.
2. Gate demo-account seeding behind `SEED_DEMO_USERS !== 'false'` (default on, so Replit remixes still work) and stop printing the password to console — print `see storage.ts seedDatabase()` instead.
3. Leave `drizzle-kit push --force` for the fresh-DB case only (it already is), but add a loud log line warning it should never run against a DB with data. Longer term (optional): move to `drizzle-kit generate` + committed migrations.
4. Document in `README.md`: required env vars (`DATABASE_URL`, `SESSION_SECRET`, optional `TBA_API_KEY`/`TOA_API_KEY`/`NEXUS_API_KEY`), and that in-memory rate limits/caches are per-instance.

**Acceptance:** two simultaneous cold boots against an empty DB don't double-seed; boot against an existing DB touches nothing.

## WP6 — Bug fixes from full audit (small, independent)

Fix bugs B1–B9 from the findings table above. Each is one-file and self-contained; B1 (audit filter ignored), B2 (jsonb double-encode — verify then fix), B4 (writes during GET), and B8 (CSV formula injection: prefix `'` when a cell starts with `=`, `+`, `-`, `@`) are the ones with user-visible impact. B7: decide with the owner whether post-merge auto-push should exist at all before touching the flag.

## WP7 — Performance & polish (ongoing, lower priority)

0. `App.tsx` polls six full collections (users, projects, tasks, notifications, announcements, **all time entries**) every 15s for every logged-in user — payload grows all season. After WP3 lands: fetch notifications scoped to the current user, move time entries to the TimeTracking page's own fetch, and consider `If-None-Match`/ETag or a `?since=` param on the hot polls.
1. Type `services/api.ts` against `types.ts` (it's `any` end-to-end today), and reconcile the client's string-ID convention with the server's numeric IDs (pick one; the String()/parseInt() mapping boilerplate in `App.tsx` is a recurring bug source).
2. Add `vitest` + `supertest`; seed an in-memory/ephemeral Postgres or mock storage. Minimum suite: login (hash + lazy migration), auth middleware (401/403 matrix), guest scoping, one zod-validation case per high-traffic router.
3. Split `App.tsx` (741 lines, one giant `useState`) into context/reducer — only when touching it anyway; not worth a dedicated pass yet.
4. Optional: ESLint flat config + prettier, CI via GitHub Action running `tsc --noEmit` + vitest (this also backflows fine — Replit ignores `.github/`).

## Explicitly out of scope / do-not-do

- No framework migrations (stay Vite/Express/Drizzle/tsx).
- No changes to `.replit` `[deployment]`, workflows, or port mappings.
- Don't encrypt the TBA/TOA/Nexus keys in-DB (they're low-sensitivity, read-only data keys); prefer moving them to Replit Secrets env vars — helpers already fall back to `process.env`.
- Don't touch the QR/pako scouting data format — devices in the field depend on it.

## Suggested handoff sequencing

| Order | WP | Size | Depends on |
|-------|----|------|-----------|
| 1 | WP1 hygiene | S | — |
| 2 | WP2 hashing | M | — |
| 3 | WP3 auth | L | WP2 |
| 4 | WP4 hardening | M | WP3 |
| 5 | WP5 startup | S | — (parallel-safe) |
| 6 | WP6 bug fixes | S | — (parallel-safe) |
| 7 | WP7 perf/quality | M | best after WP3 |

## Functional testing (live run)

The app was run end-to-end locally (embedded Postgres + `npm run dev`, driven through a browser as the seeded `coach_mentor`). What worked and what broke:

**Worked:** login + coach onboarding tour; Home dashboard; Kanban board load; **task creation persisted** to DB and re-rendered; Team page (members grouped by dept); Scout empty state; **time check-in** created an entry + audit row and correctly surfaced the just-created task in the "what are you working on" picker (good cross-feature integration); pending-approval UI appeared. Console was clean of errors throughout; no unhandled network failures.

**Confirmed live findings:**

| ID | Severity | What was observed |
|----|----------|-------------------|
| R1 / R1b | ✅ **FIXED (2026-07-18)** | Added `utils/dates.ts` (`parseLocalDate`, `todayLocalStr`, `formatLocalDate`) and routed all date-only rendering/comparison through it: `KanbanBoard.tsx` (card + create default), `TaskModal.tsx` (create default), `Home.tsx` (event dates, task due, active/upcoming logic), `Calendar.tsx` (today highlight + upcoming filter), `TimeTracking.tsx` (event-active/check-in "today"). Verified live at 5:33pm PDT (the failure window): board card now shows "Jul 18", calendar today-highlight and event chip both land on the 18th, and the event appears in "Upcoming Events". |
| R1b | **High** (bug) | **R1 confirmed decisively on the Calendar.** Created an event with start date **2026-07-18**; the server stored `"2026-07-18"` correctly, but the month grid renders the event chip on **July 17**, and the "Upcoming Events" panel shows **"Nothing Upcoming"** for a today-dated event. Same root cause as R1: `new Date("YYYY-MM-DD")` parses as UTC midnight, which is the prior day (and "in the past") once localized to PDT. This is now proven across three surfaces (board card, calendar grid, upcoming list) — promote R1 to a **prioritized fix**: introduce a `parseLocalDate(s)` helper (split the string, construct `new Date(y, m-1, d)`) and route all date-only rendering + comparisons through it. Also fixes the "upcoming events never show" defect. |
| R1 | Medium (bug) | **Task due-date is off by one day.** A task created today (2026-07-18) with due date 2026-07-18 renders on the board card as **"Jul 17"**. Timestamps (e.g. time-clock "Sat, Jul 18") render correctly — so the bug is isolated to **date-string** fields parsed as UTC midnight then shown in local time (PDT). Fix: parse/format `startDate`/`dueDate` as local dates (split the `YYYY-MM-DD` string, or append `T00:00` local) everywhere date-only strings are shown — check `KanbanBoard.tsx`, `TaskModal.tsx`, `Calendar.tsx`, `Home.tsx` countdowns. Add to WP6. |
| R2 | Low (polish) | **Brand name is inconsistent across screens:** login shows "PioByte HUB", the coach tour says "PIO-BYTES Hub", the sidebar "piobyte Hub", headers "PIOBYTE HUB". Pick one canonical casing and derive display casing from CSS, not four hard-coded strings. Add to WP7. |
| R3 | Confirms #11 | `GET /api/settings` network payload contains `tbaApiKey`/`toaApiKey`/`nexusApiKey` keys directly (null only because none set yet). Verified in-browser. |
| R4 | Confirms #12 | Logged in as coach, the time-clock "Pending Approvals" card let me **approve my own check-in** — the self-approval path is reachable in the UI, not just theoretical. |

**Second functional pass — scouting flow (all working):** created a scout event ("Test Regional 2026"), added a pit scout (Team 254), generated a **pako-compressed QR export** (rendered correctly), and pulled the **CSV export** (well-formed two-section output). Event dates render correctly here (raw ISO string, no `new Date()` wrap) — reinforcing that R1 is specific to components that wrap date-only strings in `new Date()`. All create/persist/re-fetch cycles worked; console stayed clean.

**Additional findings from pass 2:**

| ID | Severity | What was observed |
|----|----------|-------------------|
| R5 | Low (cosmetic) | In the **scout event-detail view at ~800px width (tablet portrait)**, the tab strip (Robots/Matches/Info/…) has a ~15px negative left offset, so the first tab tucks partially under the sidebar. Objectively: `main` starts at the sidebar's right edge (no container overlap) but the tab-strip's left is ~15px inside it. No horizontal page overflow. Fine on wide desktop and on mobile (sidebar collapses to a hamburger cleanly, no overflow). Fix: align the tab-strip's left padding with the main content container. |
| R6 | Low (bug) | Dashboard **"System Velocity" Recharts chart logs `width(-1) height(-1)`** repeatedly — its `ResponsiveContainer` has a zero/negative-size parent on first paint, so the chart may not render until a resize. Give the chart container an explicit min-height. |

**Interaction note (not app bugs):** several coordinate-based clicks didn't register during testing after a viewport resize created a screenshot-scaling offset; the same actions succeeded via element refs / programmatic clicks, and the underlying handlers all worked. Data entered via inputs that didn't re-fire React onChange (a test-harness artifact) didn't persist — not an application defect.

**Third functional pass — full feature sweep (everything below verified working in-browser):**

| Feature | Result |
|---------|--------|
| Auth — coach login, **guest PIN login**, logout, **client route guards** | ✅ Guest correctly limited to read-only Events; nav to `/control-panel` as guest redirects to `/scout` |
| Tasks / Boards / War Room | ✅ Create persists; board + war-room pulse feed render |
| **Time tracking full lifecycle** | ✅ check-in → coach **approve** → check-out (requires handoff note when task-linked) → pending check-out approval. Solid state machine + validation |
| Scouting — event, **pit scout, match scout, QR export, CSV export** | ✅ All persist; pako QR renders; CSV well-formed |
| Safety — create certification | ✅ Persists, shows in list |
| Calendar — create event | ✅ Persists — **but exposes R1b date bug** |
| Control Panel — team identity, theme palette, **API keys** | ✅ Renders/saves — **but exposes R3 key leak** |
| Resources | ✅ Seeded FRC links, categories, pinned section, search/filter |
| **Announcements / broadcast** | ✅ Global broadcast posts, toast fires, logs to Team Briefings |
| Dark mode | ✅ Toggles cleanly, persists across nav |
| Responsive | ✅ Mobile collapses to hamburger, no overflow; only R5 tablet-band glitch |

**R6 update:** the System Velocity chart's `width(-1)` warning is **first-paint-only** — the chart renders correctly after any navigation. Lower priority than first thought; still worth a min-height to avoid the initial blank frame.

**Genuinely not exercised** (needs external keys / hardware): QR *scan-back* import (needs a camera), offline-queue sync (needs network toggling), live TBA/Nexus/TOA imports (need real API keys). These are the remaining gaps for the WP6 automated suite.

**Overall functional verdict:** the application is **feature-complete and the happy paths are robust** — every create/update/approve flow tested persisted correctly and the state machines (time tracking especially) are well-built. The defects found are concentrated in (a) the date-string timezone bug (R1/R1b, three surfaces) and (b) the security/auth model (WP2–WP4), not in the feature logic itself.

## Security findings — proven live (not theoretical)

> **STATUS (2026-07-18): all three CLOSED by WP2 + WP3 and re-verified against the running app.**
> 1. Password disclosure → passwords stripped from responses + bcrypt-hashed at rest (WP2). `GET /api/users` now 401 anonymous.
> 2. Account takeover → `PUT /api/users/:id` now requires auth + Coach/Captain; anonymous → 401, member-on-coach → 403 (WP3).
> 3. API-key disclosure → keys stripped from `GET /settings` (WP2).

These were demonstrated against the running app during review. All are pre-auth (no token/cookie) unless noted:

1. **Plaintext password disclosure (#1/#2):** `GET /api/users` with no authentication returns every user record **including the `password` field in cleartext** (observed `"changeme"`). Verified via direct request.
2. **Unauthenticated account takeover (#4):** `PUT /api/users/7` with body `{"password":"…"}` and **no auth** returned `200` and overwrote the account's password; a subsequent `POST /api/login` with the injected password returned a valid session. Two anonymous requests fully compromise any account, including a Coach. (Password restored after the test.)
3. **API-key disclosure (#11/R3):** saved a sentinel TBA key via the Control Panel, then `GET /api/settings` **with no authentication** returned `tbaApiKey: "SENTINEL-LEAK-TEST-KEY-123456"`. The client fetches this endpoint on every load, pre-login — so every anonymous visitor to the deployed app can exfiltrate the team's TBA/TOA/Nexus keys. (Sentinel cleared after the test.)

These three alone justify treating WP2 + WP3 as release-blocking before any public Replit deployment.

## ✅ Feature — Web Push notifications (2026-07-18)

Device notifications for the PWA (personal mentions + fullscreen "PUSH ALERT" broadcasts).

**Built & verified:**
- `web-push` + VAPID. `server/push.ts` (`sendPushToUsers`, subscribe/remove, dead-sub pruning on 404/410). `push_subscriptions` table (schema + idempotent `CREATE TABLE IF NOT EXISTS` migration run at startup). Routes: `GET /push/vapid-public-key`, `POST /push/subscribe`, `POST /push/unsubscribe`. Wired into `POST /notifications` (→ recipient) and `POST /fullscreen-alerts` (→ all members).
- Service worker (`public/sw.js`, cache bumped to v4): `push` + `notificationclick` handlers.
- Client: `services/push.ts` (support detection, permission, subscribe/unsubscribe), `api.push.*`, and a sidebar toggle in `Layout.tsx` (ENABLE NOTIFS / NOTIFICATIONS ON / NOTIFS BLOCKED).
- Verified live: table created; VAPID endpoint returns the key (`enabled:true`); subscribe stores a row; **creating a notification fired a real `webpush.sendNotification` attempt** (server log: `Push send failed: … p256dh value should be 65 bytes` — failed only because the test subscription used a fake key); toggle renders and correctly reflects the browser's denied-permission state.

**Notification triggers** (each also fires a device push): (1) @mention in a task comment, (2) @mention in a broadcast thread, (3) Coach/Captain fullscreen "PUSH ALERT" → all members, and (4) **task assignment** — added 2026-07-18 (`notifyNewAssignees` in `App.tsx`, wired into both task create and update; notifies newly-added assignees, excludes the assigner). Verified live: assigning member1 created "You were assigned to task: …" for them, no self-notification for the assigner. Push title made event-agnostic (`{sender} • PioByte Hub`) so it reads right for mentions and assignments.

**Platform support:** Chrome/Edge desktop + **Android + ChromeOS (Chromebooks)** — full support. **iOS/iPadOS**: only 16.4+ and only when the app is **installed to the home screen** (Apple limitation).

**Can't be verified here:** an actual notification appearing on a device — the sandbox browser denies notification permission and there's no real device. Test on a Chromebook/phone after deploy.

**⚠️ Owner action before deploy:** add **`VAPID_PUBLIC_KEY`** and **`VAPID_PRIVATE_KEY`** to Replit Secrets (generate a pair with `npx web-push generate-vapid-keys`; optionally `VAPID_SUBJECT=mailto:you@team.org`). Without them the feature stays cleanly disabled (toggle hidden / server logs "Web Push disabled"). Push needs HTTPS — Replit provides it.

## ✅ Feature requests — task improvements (2026-07-18)

- **Task update-check (unsaved-changes prompt)** — `TaskModal.tsx`: a `taskSignature` diff detects uncommitted edits; the X button routes through `handleCloseAttempt`, which shows an "Unsaved Changes" dialog (Commit Mission / Discard & Close / Keep Editing) only when there are real changes. Verified live: edit→prompt, discard→not saved, no-edit→closes directly.
- **Task start/completion documentation** — created date already shown ("POSTED …"); added an editable **"Completed On"** field that appears when status = Complete, pre-filled with the auto-set completion date and overridable when the task was actually finished on a different day. Verified: marking complete showed the field with today; overriding to 2026-07-15 persisted (`status: Complete`, `completed_at` → Jul 15).
- **Task assignment notifications** (from the earlier push work) — assigning a user now creates a notification + push.
- **Recurring tasks** — ✅ **DONE (fixed-schedule model, owner's choice).** New `recurring_task_templates` table (+ idempotent `CREATE TABLE IF NOT EXISTS` migration). A template defines a task + frequency (daily/weekly/biweekly/monthly) + due offset; a server scheduler (`generateDueRecurringTasks`, run on startup and hourly) stamps out a normal task each interval. Generation is **concurrency-safe** (guarded UPDATE on `last_generated_date` so multiple autoscale instances never double-generate) and idempotent (won't regenerate until the interval elapses). Routes `GET/POST/PUT/DELETE /recurring-tasks` + `/generate-now`, gated to Coach/Captain/SCRUM Master/Dept Head. UI: `RecurringTasksModal` opened from a Repeat button on the Kanban board — list, active/pause toggle, delete, and a create form. Verified live: creating a template immediately generated its first task; simulating a day's passing generated exactly one more (no duplicates); UI create round-tripped and generated an instance.
- **Outreach / competition hours** — deferred by owner for now.

## Review coverage statement

Assessment based on: line-by-line read of **100% of the server** (`server/index.ts`, `db.ts`, `helpers.ts`, all 1,284 lines of `storage.ts`, all 12 route files) and the client core (`App.tsx`, `services/api.ts`, `services/offlineQueue.ts`, `public/sw.js`, `vite.config.ts`, `index.tsx`, `contexts/`, `utils/`, `shared/schema.ts`). The ~16,700 lines of UI components were **systematically pattern-audited** (XSS sinks, password handling, polling loops, API usage) with targeted reads of TeamManagement, ControlPanel, ScoutQR, and Scout flows — not read line-by-line. Component-internal logic bugs (e.g., in PitDisplay's 866 lines of rendering) may exist beyond this list; they are lower-stakes than the server findings.

Owner actions required along the way: add `SESSION_SECRET` to Replit Secrets (before WP3 deploy); decide fate of `.replit_integration_files/` + Gemini dep (WP1 step 3); log in once per user after WP2 ships so hashes migrate.
