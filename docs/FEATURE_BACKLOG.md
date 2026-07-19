# PioByte Hub — Requested Feature Backlog

_Captured 2026-07-19. Large, not-yet-started features requested by the owner. Each is a multi-part epic; design/prioritization pending. See IMPROVEMENT_PLAN.md for completed work (R1, WP2 auth-hashing, WP3 auth, push, task features)._

> **Detailed, implementation-ready designs now exist:**
> - Epics A + B + C → [`design/team-ops-events-home-fundraising.md`](design/team-ops-events-home-fundraising.md)
> - Epic D → [`design/scouting-seasons-templates.md`](design/scouting-seasons-templates.md)
>
> The sections below are the summary/requirements; the design docs have schema DDL, endpoints, UI, migration, and verification.

---

## Epic A — Event participation & hours (outreach / volunteer / competition)

Turn calendar events into things students sign up for and get hours credited toward.

- **Sign-up:** students sign up for an event from the **calendar** (types include outreach / volunteer / competition).
- **Acceptance:** coaches + leadership **accept/decline** students onto an event (roster).
- **Hours = clock in/out** (owner's direction): outreach & volunteer are **clocked on the same time clock as shop time**, just tagged by category (`time_entries.kind` + optional event link), reusing the existing coach-approval flow. A student must be accepted to clock into an event. **All worked hours now live in the timelogs**, differing only by kind. Competition stays on its existing scout-event check-in for now.
- **Home:** an **"Upcoming" schedule visible to everyone** + the requirements card reads clocked hours.

**Rough shape:** `event_signups` (roster: userId, calendarEventId, status, approvedBy). `time_entries` gains `kind` + `calendar_event_id`. Sign-up/accept endpoints; the existing time-clock check-in accepts `kind`/`calendarEventId`. Calendar signup button + coach roster; Time-page "what are you clocking?" picker; home "Upcoming" card. **Full design → `design/team-ops-events-home-fundraising.md`.**

---

## Epic B — Home page refresh

Reprioritize the home page to surface the most relevant info per user. "System Velocity" is nice-to-have, not critical — demote or drop it.

**Centerpiece: a "My Requirements" card** showing the student's standing against team requirements — fundraising ("raised $X of $Y") **and** per-category hour requirements ("A h of B h shop time", "C h of D h outreach", …). Every requirement is **individually toggleable and configurable in settings** (on/off + required hours per category; fundraising goal too). Coaches can add a fundraising amount + plain-text reason inline. Details + the unified `requirements` settings model in the design doc.

**Likely priority order (to confirm):** My Requirements → Upcoming events + sign-up status (Epic A) → assigned/active tasks → pending approvals (coaches) → announcements/notifications. Role-aware (coach vs student vs guest).

---

## Epic C — Fundraising tracking

Students have a fundraising goal and can see progress toward it.

- Per-student goal of **$X** (team-wide default, possibly overridable per student).
- Credit earned a **variety of ways**: concessions at sporting events, farmer's market stalls, parent night outs, etc. (categories).
- **Students can see their own progress** (raised vs goal); leadership sees team totals.

**Key design decisions to confirm:**
1. Who logs a contribution — student self-reports (then coach verifies), or leadership enters it? (Leaning: logged by leadership or self-reported + verified, with a `verifiedBy`.)
2. Is the goal one team-wide number, or per-student?
3. Are fundraising "opportunities" (concession shifts, market stalls) themselves events students sign up for — i.e. does this overlap with Epic A's sign-up flow?

**Rough shape:** `fundraising_entries` (userId, amount, category, description, date, verifiedBy) + a goal setting (team default in `team_settings`, optional per-user override). Student progress bar; leadership ledger + totals.

---

## Epic D — Scouting seasons & customizable templates

Make scouting adapt to each year's game instead of the current hard-coded pit/match fields.

- **Custom data collection:** define what data is collected in the **pit** and for **each match** — a **template creator**.
- **Seasons/game types:** templates are saved to a **season**; **events are assigned to a season**; scouting data + **analytics are scoped by season**.
- Sort/filter scouting data by season/game type.

**Key design decisions to confirm:**
1. This is the heaviest item: today `pit_scouts` / `match_scouts` have **hard-coded columns** (teamNumber, drivetrain, autoScore, teleopScore, …) used by the forms, **QR share format** (pako), **CSV export**, and analytics. Custom templates mean moving to a **flexible field model** (a `seasons` table + `scouting_templates` defining fields {key,label,type,options}, and scout records storing a JSON `data` blob keyed by field). That's a broad change across schema, forms, QR, CSV, PitDisplay/RobotDashboard analytics.
2. Migration: keep existing scout data working (map current columns to a built-in "legacy/2026" template) so nothing is lost.
3. Field types to support: number, boolean, text, single-select, multi-select, rating, counter — confirm the set.
4. Analytics: which aggregations should be season/template-aware (they currently assume fixed fields like autoScore/teleopScore).

**Rough shape:** `seasons` (name, gameName, year, active); `scouting_templates` (seasonId, kind: pit|match, fields JSON); `scout_events.seasonId`; pit/match scout records gain a `data` JSONB (keep legacy columns during transition). Template-builder UI; dynamic form renderer; season selector on events + analytics.

---

## Sequencing note

Epics A + B + C are closely related (participation, home, fundraising all revolve around students + events) and could ship as one coordinated wave. Epic D (scouting) is independent and the most architecturally invasive — best done as its own focused project with a migration plan so no existing scouting data is lost.

**Also still pending:** WP1 repo hygiene, WP4 (zod/helmet), WP5 (startup advisory-lock), and pushing the completed work (R1/WP2/WP3/push/task-features) to GitHub — which needs `SESSION_SECRET` + `VAPID_*` in Replit Secrets.
