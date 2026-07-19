# Design — Team Ops Wave (Events & Hours · Home Refresh · Fundraising)

_Design 2026-07-19. Implementation-ready. Covers backlog Epics A, B, C. Build in the order A → C → B (B ties the others together on the home page)._

## Conventions this codebase already uses (follow them)

- **Schema:** Drizzle in `shared/schema.ts`; export `Table`, `InsertTable` types via `$inferSelect`/`$inferInsert`.
- **New tables on existing DBs:** add an idempotent `ensureXTable()` in `storage.ts` (`CREATE TABLE IF NOT EXISTS …`) and call it in `server/index.ts` startup (fresh installs get it from `drizzle-kit push`).
- **Auth:** every `/api` route is behind `authenticate` (cookie session). Use `req.userId` / `req.userRoles` — **never trust body IDs** (the middleware already overwrites `requesterId`/`createdBy`/`coachId`/etc. with the verified id). Gate writes with `requireRoles(...)` from `server/middleware/auth.ts`.
- **Roles:** `Coach`, `Team Captain`, `SCRUM Master`, `Department Head`, `Safety Trainer`, `Team Member`, `Class Member`, plus `Guest` (session). "Leadership" below = `Coach`, `Team Captain`, `SCRUM Master`.
- **Dates:** date-only values are `YYYY-MM-DD` strings; render/compare via `utils/dates.ts` (`parseLocalDate`, `todayLocalStr`) — never `new Date("2026-…")`.
- **Client API:** add methods to `services/api.ts`; all requests already send the session cookie.
- **Money:** store as **integer cents** to avoid float drift; format in the UI.

---

## Epic A — Event participation & hours

Students sign up for calendar events; leadership accepts them; coaches check them in; hours accrue.

### Data model

Extend `calendar_events` (don't create a parallel event concept):
```
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS signup_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS capacity INTEGER;            -- null = unlimited
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS hours_eligible BOOLEAN NOT NULL DEFAULT true;
```
Default `signup_enabled = true` when the event type ∈ {`outreach`, `volunteer`, `competition`} at creation time (set in the calendar create route), else false. Coaches can toggle it.

New table `event_signups` — **roster only** (who's signed up / accepted). The
actual hours are clocked on the shared time clock (see next block), not stored here:
```
id            serial pk
calendar_event_id integer not null references calendar_events(id) on delete cascade
user_id       integer not null references users(id) on delete cascade
status        text not null default 'requested'   -- requested | accepted | declined | waitlisted
approved_by   integer references users(id)
approved_at   timestamp
note          text
created_at    timestamp not null default now()
UNIQUE (calendar_event_id, user_id)
```

### Hours come from a unified time clock (extend `time_entries`)

Outreach and volunteer time are **clocked in/out exactly like shop time** — same
mechanism, same coach-approval flow, same audit trail — just **categorized**.
Extend the existing `time_entries` rather than inventing a second clock:
```
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'shop';  -- shop | outreach | volunteer | (future)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS calendar_event_id INTEGER REFERENCES calendar_events(id) ON DELETE SET NULL;
```
- A student clocks in and picks **what they're clocking**: *Shop*, or an outreach/volunteer **event they're accepted to** (which sets `kind` + `calendar_event_id`).
- Everything else about the time clock is unchanged: check-in → coach confirm → check-out → coach confirm; `roundedMinutes`; the audit log; the existing approval UI. **Only approved entries count.**
- This means **all hours — shop, outreach, volunteer — live in the timelogs**, differing only by `kind`. Competition hours stay on the existing `competition_checkins` system (already clock-in/out per scout event); optionally fold it in later.

### Endpoints (mount in a new `server/routes/eventSignups.ts`)

| Method & path | Who | Behavior |
|---|---|---|
| `POST /api/calendar/:id/signup` | any member (not guest) | Upsert own signup `status='requested'` (respect `capacity` → `waitlisted` if full). `userId = req.userId`. |
| `DELETE /api/calendar/:id/signup` | self | Remove own signup. |
| `GET /api/calendar/:id/signups` | leadership → full roster; member → own row only | Enriched with user names + each member's clocked minutes for this event (joined from `time_entries`). |
| `PUT /api/signups/:id` | leadership (`requireRoles`) | Set `status` accepted/declined/waitlisted; sets `approvedBy=req.userId`, `approvedAt`. |
| `GET /api/me/clockable-events` | self | Accepted outreach/volunteer events happening now/today the user can clock into (feeds the clock-in "what are you doing?" picker). |
| `GET /api/me/upcoming` | self | Upcoming events (today forward) the user is signed up for / accepted to, **plus** open signup-enabled events they haven't joined. Powers the home "Upcoming" card. |

**Hours endpoints:** none new — reuse the existing time-clock routes (`/time-entries/check-in`, `/check-out`, `/confirm`, …), which now accept a `kind` and optional `calendarEventId` on check-in. A user's outreach/volunteer minutes = approved `time_entries` filtered by `kind` (this is what the requirements summary reads).

### UI

- **Calendar** (`components/Calendar.tsx`): on a `signup_enabled` event, a **student** sees "Sign Up / Signed up ✓ (status) / Withdraw"; **leadership** sees a "Roster" panel to Accept/Decline and (during/after) each member's **clocked minutes for the event** (read-only, from the time clock). Add `signupEnabled` / `capacity` toggles to the event create/edit form.
- **Time page** (`components/TimeTracking.tsx`): the existing check-in flow gains a **"what are you clocking?"** step — *Shop* (default) or one of the user's accepted outreach/volunteer events (from `GET /api/me/clockable-events`), which sets `kind` + `calendarEventId`. My-time-history and the coach approval queue show the `kind` as a small tag. Add a per-category **hours summary** (Shop / Outreach / Volunteer totals).
- **Home** (Epic B): "Upcoming" card from `GET /api/me/upcoming`; the requirement bars read the same clocked hours.

### Decisions to confirm (with recommendation)

1. **One clock for all worked hours** — outreach & volunteer are clock-in/out on the **shared `time_entries` clock**, tagged by `kind` (+ optional event link), reusing the existing coach-approval flow and audit trail. Shop is the default `kind`. ✅ (Owner's direction; cleanest — all hours in the timelogs.)
2. **Competition hours** — stay on the existing `competition_checkins` (scout-event) system for now; can be unified into `time_entries.kind='competition'` later if desired.
3. **event_signups is roster-only** — sign-up/accept controls who's on the list; hours are earned by clocking in against the event. A student must be **accepted** to clock into that event.
4. **Only coach-approved** time entries count toward requirements (same rule as shop).

---

## Epic C — Fundraising tracking

Per-student goal; contributions logged by category; students see progress.

### Data model

Fundraising goal + categories now live inside the unified **Requirements config**
(see the "Requirements & progress" section below — it's the single source of
truth for both the fundraising goal and the per-category hour requirements that
the home dashboard renders). Per-student override stays on `users`:
```
ALTER TABLE users ADD COLUMN IF NOT EXISTS fundraising_goal_cents INTEGER;   -- null = use team default
ALTER TABLE users ADD COLUMN IF NOT EXISTS hour_requirement_overrides JSONB;  -- optional { <reqKey>: minutes }, null = use team defaults
```
New table `fundraising_entries`:
```
id           serial pk
user_id      integer not null references users(id) on delete cascade   -- the student credited
amount_cents integer not null                                          -- >0
category     text not null
description  text not null default ''
occurred_on  text not null                                             -- YYYY-MM-DD
status       text not null default 'verified'                          -- verified | pending  (see decision #1)
verified_by  integer references users(id)
verified_at  timestamp
created_by   integer not null references users(id)
created_at   timestamp not null default now()
```

### Endpoints (`server/routes/fundraising.ts`)

| Method & path | Who | Behavior |
|---|---|---|
| `GET /api/fundraising` | leadership → all; member → own | List entries (filters: userId, status). |
| `POST /api/fundraising` | member (self, `pending`) or leadership (any user, `verified`) | Create entry. `createdBy=req.userId`. Non-leadership may only credit themselves and land `pending`. |
| `PUT /api/fundraising/:id` | leadership | Edit / verify (set `status='verified'`, `verifiedBy`, `verifiedAt`). |
| `DELETE /api/fundraising/:id` | leadership (or creator while `pending`) | Remove. |
| `GET /api/fundraising/summary` | self → own; leadership → everyone | Per-user `{ raisedCents (verified only), goalCents, pendingCents }` + team totals. |
| `PUT /api/settings` (existing) | leadership | Extend to accept the **Requirements config** (below). |

### UI

- **New page `/fundraising`** (add nav item, hide for guests): 
  - **Student view:** a progress bar (verified raised vs their goal), remaining amount, their entries list, and a "Log contribution" form (category, amount, date, description) → creates a `pending` entry.
  - **Leadership view:** a ledger of all entries with verify/edit/delete, per-student totals, team total vs (goal × active students), and an **"Add for student"** form where the coach enters an **amount + a plain-text reason** (the reason maps to `fundraising_entries.description`; coach-entered entries land `verified`).
- **Home** (Epic B): the fundraising requirement is one row of the **Requirements card** (below).

---

## Requirements & progress (the home-dashboard centerpiece)

The home dashboard shows each student their standing against the team's **requirements**: one fundraising target plus any number of **hour requirements** (shop, outreach, volunteer, competition, and custom), each individually **toggleable** and with its own **required amount**, all editable in settings.

### Config (single source of truth in `team_settings`)

```
ALTER TABLE team_settings ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '{...defaults...}';
```
Shape:
```jsonc
{
  "fundraising": { "enabled": true, "goalCents": 25000 },     // "$250 required"
  "hours": [
    {
      "key": "shop", "label": "Shop Time", "enabled": true, "source": "clock:shop",
      // One or more PHASES. Each phase is an independently-configurable, optionally
      // date-bounded requirement. Hours earned within a phase's window count toward it.
      "phases": [
        { "label": "Pre-season", "start": "2025-09-01", "end": "2025-12-31", "requiredMinutes": 1200 },
        { "label": "In-season",  "start": "2026-01-01", "end": "2026-04-30", "requiredMinutes": 2400 }
      ]
    },
    {
      "key": "outreach", "label": "Outreach", "enabled": true, "source": "clock:outreach",
      // A single, whole-year requirement with no window = one phase with null dates.
      "phases": [ { "label": "Season", "start": null, "end": null, "requiredMinutes": 600 } ]
    },
    { "key": "volunteer",   "label": "Volunteer",   "enabled": false, "source": "clock:volunteer",   "phases": [] },
    { "key": "competition", "label": "Competition", "enabled": false, "source": "competition_checkins", "phases": [] }
    // coaches can add custom rows; `source` = "clock:<kind>" (a time_entries kind) or "competition_checkins"
  ]
}
```
- **`enabled: false`** hides that requirement (and all its phases) from the dashboard.
- **`phases`** lets a coach model exactly what they described:
  - **one phase, no dates** → a single blank requirement for the year ("40 h of shop, whenever").
  - **one phase, dated** → a single windowed requirement.
  - **two (or more) phases** → e.g. a **Pre-season** target and a separate **In-season** target, each counted only within its own window. Any mix works.
  - Hours are attributed to a phase when the entry's date falls in `[start, end]` (open-ended if a bound is null). An entry outside every phase's window counts toward none.
- **`source`** tells the summary where the *actual* minutes come from — **all worked hours are in the timelogs (`time_entries`), differing only by `kind`**: `clock:shop` → approved shop entries, `clock:outreach` → approved outreach entries, `clock:volunteer` → approved volunteer entries, and `clock:<custom>` for any future kind. `competition_checkins` → the existing scout-event competition clock. (There is no separate "event hours" store — clocking into an outreach event just writes a `time_entries` row with `kind='outreach'` + the event link.)
- Per-student overrides: `users.fundraising_goal_cents` and `users.hour_requirement_overrides` (keyed by `"<reqKey>:<phaseLabel>"` → minutes) override team defaults for that student; null → team default.

### Summary endpoint

`GET /api/me/requirements` (self) and `GET /api/users/:id/requirements` (self or leadership) → computed progress the dashboard renders directly. **Each enabled requirement returns a row per phase** (earned within that phase's window vs its target):
```jsonc
{
  "fundraising": { "enabled": true, "raisedCents": 8000, "goalCents": 25000, "pendingCents": 1500 },
  "hours": [
    { "key": "shop", "label": "Shop Time", "phases": [
        { "label": "Pre-season", "earnedMinutes": 1350, "requiredMinutes": 1200 },
        { "label": "In-season",  "earnedMinutes": 900,  "requiredMinutes": 2400 }
    ]},
    { "key": "outreach", "label": "Outreach", "phases": [
        { "label": "Season", "earnedMinutes": 300, "requiredMinutes": 600 }
    ]}
    // only enabled requirements/phases are returned
  ]
}
```
Server computes each phase's `earnedMinutes` from the requirement's `source`, counting only entries dated within that phase's `[start, end]`. Fundraising uses **verified** entries only; `pendingCents` is surfaced separately.

### Settings UI (Control Panel)

A **Requirements** panel:
- **Fundraising:** on/off + dollar goal.
- **Hour requirements:** a list of rows, each with an on/off switch, a label, a **source** picker (a time-clock kind — Shop / Outreach / Volunteer / custom — or Competition check-ins), and add/remove for custom rows.
- **Phases within a requirement:** each hour requirement has a small phase editor — add one or more phases, each with an optional **name** (e.g. "Pre-season", "In-season"), **start/end dates** (either blank = open-ended), and a **required-hours** input (entered as hours, stored as minutes). One phase with blank dates = a single whole-year requirement; two = the pre-season/in-season split. This is where a coach chooses "pre + in", "just one", or "blank for the year."

All persist via the existing `PUT /api/settings`.

### Notes
- Enter/display hours as `h:mm` or decimal hours in the UI; **store minutes** everywhere (matches `time_entries.roundedMinutes` and `event_signups.hours`).
- "Shop time" earned = completed **and coach-approved** `time_entries` only (don't count unapproved/pending), to match how the time page tallies.
- The dashboard card degrades gracefully: if nothing is enabled, hide the whole card.

### Decisions to confirm (with recommendation)

1. **Who logs** — students self-report → `pending`; leadership verifies → `verified`; leadership can also enter directly as `verified`. Only **verified** counts toward progress. ✅ Recommended (balances self-service with control).
2. **Goal** — team-wide default in `team_settings`, optional per-student override on `users`. ✅
3. **Overlap with Epic A** — a fundraising *opportunity* (e.g. a concession shift) is just a `calendar_event` students sign up for; when a coach checks them out, optionally prompt to log a fundraising entry. Keep manual entries independent so it works without events too. (Nice-to-have integration; not required for v1.)

---

## Epic B — Home page refresh

Rebuild `components/Home.tsx` to be role-aware and lead with what matters. Demote **System Velocity** (move to War Room / make it a collapsed "Insights" section, don't delete).

### Section priority (top → bottom)

**Everyone:**
1. **Header** — greeting + team.
2. **My Requirements** (the centerpiece — `GET /api/me/requirements`): one card with a row per enabled requirement:
   - **Fundraising:** "You've raised **$X** of **$Y** required" with a progress bar; if there are pending (unverified) contributions, show "+$Z pending" muted.
   - **Each enabled hour requirement:** a progress bar per **phase** — e.g. a single "You've logged **A h** of **B h** of Shop Time required", or, when split, "**Pre-season Shop:** 20 h of 20 h ✓" and "**In-season Shop:** 15 h of 40 h" as two bars grouped under the requirement label.
   - Only enabled requirements/phases render; if none are enabled, the card is hidden.
   - When a **coach** views a student's home (or a leadership dashboard), the fundraising row exposes an inline **"+ Add amount"** (amount + plain-text reason → verified `fundraising_entry`).
3. **Upcoming schedule** (`GET /api/me/upcoming`) — next events with the user's signup status + a one-tap sign-up for open events.
4. **My tasks** — assigned/active tasks (already available in `state.tasks`).

**Coaches/leadership:** 5. **Needs your attention** — pending event check-ins, time approvals, comp approvals, cert requests (counts + quick links).

**Everyone:** 6. **Team briefings** (announcements — keep). 7. **Notifications** (personal mentions — keep). 8. **Insights** (System Velocity chart, collapsed by default; also fix the R6 first-paint min-height while here).

### Notes
- Keep the existing polling/visibility-aware refresh and the `TeamSettings` theming.
- Guests already redirect to `/scout`; no home for them.
- This is the integration surface for A and C — build B last so it can consume both.

---

## Suggested build order & verification

1. **Epic A schema + endpoints** → `event_signups` (roster) + `time_entries.kind`/`calendar_event_id`; verify sign-up/accept via API (member vs coach cookie), and that check-in accepts `kind`+`calendarEventId` and enforces "must be accepted to clock into an event".
2. **Epic A UI** → sign up as a student + coach accepts; on the Time page, clock into the accepted outreach event → clock out → coach approves; confirm the entry is `kind='outreach'` and the minutes land in the outreach requirement (not shop).
3. **Epic C schema + endpoints + page** → log pending as student, verify as coach, confirm summary math (verified-only).
4. **Requirements config** → add the `requirements` JSONB + `GET /api/me/requirements`; build the Control Panel Requirements editor (toggles + required-hours + fundraising goal + optional season window). Verify: disabling a requirement removes its row; overriding a student's goal/hours reflects in the summary; `earnedMinutes` matches `time_entries` (shop, approved only) and `event_signups` (by type), filtered to the season window.
5. **Epic B home rebuild** → confirm each role sees the right sections; the **My Requirements** card renders each enabled row with correct earned/required and hides when nothing is enabled; upcoming pulls live data.
6. Regression: existing calendar, time tracking, and announcements still work.

**Owner deploy note:** no new secrets required for this wave. All additive; existing data untouched.
