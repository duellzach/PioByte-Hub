# Threat Model

## Project Overview

PioByte Hub is a web-based FRC (FIRST Robotics Competition) team management platform. It is a publicly deployed (`reserved_vm`, visibility: `public`) full-stack application built with React 19 + TypeScript (frontend), Express + TypeScript (backend), PostgreSQL via Drizzle ORM. Users are FRC team members with roles: Coach, Team Captain, SCRUM Master, Department Head, Safety Trainer, Team Member, Class Member. A guest PIN system allows external alliance partners read-only access to scouting data. The app is deployed at `https://PiobytesHub.replit.app`.

## Assets

- **User credentials** — usernames and bcrypt-hashed passwords (with legacy plaintext fallback). Compromise enables impersonation and full account access.
- **Scouting data** — strategically sensitive match and pit scouting records. Access by opponents undermines competitive advantage.
- **Time tracking records** — hours logged per team member, used for scholarship tracking, attendance, and awards. Tampering corrupts these records.
- **Safety certification records** — safety training checklists and certifications. Falsification is a safety risk.
- **Session tokens (JWT)** — signed with `SESSION_SECRET`. Compromise allows persistent impersonation.
- **Application secrets** — `SESSION_SECRET`, `DATABASE_URL`, any API keys (Blue Alliance, AI providers). Must be environment-only.
- **Team configuration** — team identity, roles, departments managed through a Master Control Panel.

## Trust Boundaries

- **Browser to API** — all client requests are untrusted. The Express API must authenticate and authorize every sensitive request. `authenticate` middleware enforces session presence; `requireRoles` enforces privilege.
- **Public vs Authenticated boundary** — login and guest-login endpoints are unauthenticated. All other `/api/*` routes require a valid session. The middleware allowlist defines the public surface.
- **Member vs Coach/Captain boundary** — destructive and administrative operations (delete users, approve hours, manage settings) should require elevated roles. Several endpoints were found missing these checks.
- **Guest vs Member boundary** — guest PIN sessions should be scoped to a single scouting event (read-only). The current implementation does not enforce event-ID scoping.
- **API to PostgreSQL** — Drizzle ORM with parameterized queries protects against SQL injection at this boundary.

## Scan Anchors

- **Production entry points:** `server/index.ts` (Express app setup), `server/routes/*.ts` (all API routes mounted at `/api`)
- **Highest-risk areas:** `server/routes/scout.ts` (scouting CRUD, guest access, CSV export), `server/routes/time.ts` (hours approval), `server/routes/users.ts` (auth, user management), `server/routes/safety.ts` (cert management), `server/security.ts` (JWT, password verification)
- **Auth middleware:** `server/middleware/auth.ts` — `authenticate`, `requireRoles`, `guestAllowed`, `ACTOR_FIELDS`
- **Guest access model:** `POST /api/guest-login` → JWT with `{ kind: "guest", eventId: N }` → `guestAllowed()` regex for read-only scout paths
- **Dev-only areas:** `server/reset.ts` (CLI script, not a web endpoint), `server/storage.ts:seedDatabase()` (seeding utility, guarded by empty-users check)

## Threat Categories

### Spoofing

Users authenticate via local username/password (bcrypt). JWT session tokens are signed with `SESSION_SECRET`. The login rate limiter reads raw `X-Forwarded-For` instead of `req.ip`, allowing attackers to bypass it by spoofing the header value — enabling unlimited brute-force. Legacy plaintext passwords use non-constant-time comparison, compounding this risk. **Required guarantee:** Rate limiter MUST use `req.ip` (with `trust proxy` set) rather than raw headers. All password comparisons MUST be constant-time.

### Tampering

Multiple write endpoints lack role authorization. Any authenticated Team Member can: delete all tasks (`DELETE /tasks/:id`), self-approve or bulk-fabricate hours (`time-entries`), falsify safety certification checklists (`PUT /cert-requests/:id/progress`), create/modify scouting data, and unarchive their own account. **Required guarantee:** Every mutation endpoint MUST apply `requireRoles` or ownership checks appropriate to the operation's sensitivity.

### Information Disclosure

- Guest PIN sessions grant read access to ALL events' scouting data, not just the event the guest authenticated for. `guestAllowed()` does not compare the URL event ID to `req.guestEventId`. **Required guarantee:** Guest requests MUST be rejected (403) if the URL event ID differs from `req.guestEventId`.
- The reset script logs plaintext demo passwords to stdout. Mitigated by all passwords being `changeme`, but a pattern to eliminate.

### Elevation of Privilege

- `PUT /users/:id` allows any user to change their own password without providing the current password, and to self-unarchive a deactivated account.
- `POST /api/seed` is accessible to any authenticated user (no-op on populated DB, but dangerous post-wipe).
- Task, project creation, and scouting write endpoints have no role enforcement.
- **Required guarantee:** All privilege-changing operations (password change, unarchive, role assignment) MUST verify caller identity and current credentials or require elevated roles.

### Denial of Service

No rate limiting on non-login endpoints. No documented file upload size caps. External API calls (Blue Alliance) have no explicit timeout enforcement documented in routes.
