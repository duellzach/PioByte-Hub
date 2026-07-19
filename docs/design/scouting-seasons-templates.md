# Design — Scouting Seasons & Customizable Templates (Epic D)

_Design 2026-07-19. The most invasive change in the app. The guiding principle: **ship the flexible model with a built-in template that reproduces today's behavior exactly, so no existing scouting data is lost and day-one behavior is unchanged.** Then layer customization on top._

## Problem with today's model

`pit_scouts` and `match_scouts` have **hard-coded columns** (pit: `teamNumber, drivetrain, weight, speed, autonomousRoutine, offenseRating, …`; match: `matchNumber, alliance, autoScore, teleopScore, endgameScore, autoClimb, …`). Those columns are wired into the scout forms, the **pako QR share format**, the **CSV export**, and the **analytics** (`PitDisplay.tsx`, `RobotDashboard.tsx`). FRC games change yearly, so the fields need to be team-definable **per season**, with data + analytics scoped to a season.

## Target model

A **season** owns **templates** (one active pit template + one active match template). Scout records store a **JSON `data` blob** keyed by template field keys. Events belong to a season. Everything (data views, CSV, QR, analytics) is season/template-aware.

### New tables (`shared/schema.ts` + `ensureXTable` migrations)

```
seasons:
  id serial pk
  name text not null              -- e.g. "2026 — REBUILT"
  game_name text not null default ''
  year integer
  active boolean not null default false
  created_at timestamp not null default now()

scouting_templates:
  id serial pk
  season_id integer not null references seasons(id) on delete cascade
  kind text not null              -- 'pit' | 'match'
  name text not null default ''
  fields jsonb not null default '[]'   -- Field[] (see below)
  active boolean not null default true
  created_by integer not null references users(id)
  created_at timestamp not null default now()
  -- app-enforced: at most one active template per (season_id, kind)
```

Extend existing tables (all additive, nullable, so old rows keep working):
```
ALTER TABLE scout_events  ADD COLUMN IF NOT EXISTS season_id  INTEGER REFERENCES seasons(id);
ALTER TABLE pit_scouts    ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES scouting_templates(id);
ALTER TABLE pit_scouts    ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
ALTER TABLE match_scouts  ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES scouting_templates(id);
ALTER TABLE match_scouts  ADD COLUMN IF NOT EXISTS data JSONB NOT NULL DEFAULT '{}';
```
Keep the legacy hard-coded columns during the transition (for rollback + old rows). New writes go to `data` (+ `template_id`); a read shim fills `data` from legacy columns for any row where `data` is empty.

### Field model (the `fields` JSON)

```ts
type Field = {
  key: string;          // stable, unique within template, e.g. "auto_score"
  label: string;        // "Auto Score"
  type: 'number' | 'counter' | 'boolean' | 'text' | 'textarea'
      | 'select' | 'multiselect' | 'rating';   // rating = 1–5
  options?: string[];   // select / multiselect
  required?: boolean;
  section?: string;     // group heading, e.g. "Autonomous"
  // analytics hints:
  aggregate?: 'avg' | 'sum' | 'max' | 'none';  // numeric/counter/rating only
  showInSummary?: boolean;                       // show on the robot card
  rankMetric?: boolean;                          // eligible as the default sort/ranking metric
};
```
Two identity fields are always present and not user-removable: pit → `teamNumber`; match → `matchNumber`, `teamNumber`, `alliance`. Enforce in the builder.

## Migration (must not lose data — do first, verify before anything else)

1. Create `seasons`, `scouting_templates`, and the added columns.
2. Insert a default season (e.g. `{name:'2026', active:true}`).
3. Insert **built-in pit + match templates** for that season whose `fields` mirror the current columns, with `key` = the existing column name (so `data` maps 1:1). Match template flags `auto_score`, `teleop_score`, `endgame_score` as `aggregate:'avg'`, `showInSummary:true`, `rankMetric:true`, etc. — reproducing today's analytics.
4. `UPDATE scout_events SET season_id = <default> WHERE season_id IS NULL`.
5. **Backfill** `data` on every existing `pit_scouts` / `match_scouts` from its legacy columns; set `template_id` to the built-in template. (One-time; keep legacy columns for safety.)
6. Verify counts + spot-check a few rows: `data` blob equals the old columns; CSV/QR/analytics still render identically.

## Endpoints (`server/routes/seasons.ts`; gate writes to Coach/Captain)

| Method & path | Behavior |
|---|---|
| `GET /api/seasons` | list seasons |
| `POST /api/seasons` | create (name, gameName, year) |
| `PUT /api/seasons/:id` | edit / set `active` (only one active) |
| `DELETE /api/seasons/:id` | delete (block if events reference it, or reassign) |
| `GET /api/seasons/:id/templates?kind=pit\|match` | active template for that season+kind |
| `POST /api/seasons/:id/templates` | create/replace template (kind, fields[]) — validates unique keys, identity fields present |
| `PUT /api/templates/:id` | edit fields / active |
| `PUT /api/scout-events/:id` (existing) | accept `seasonId` |

Scout create/read routes (`server/routes/scout.ts`) start accepting/returning `data` + `templateId`; keep accepting legacy fields during transition (write them into `data`).

## UI work

- **Season manager** (Control Panel or a Scout sub-tab): list/create seasons, set active, pick the season on event create/edit.
- **Template builder** (new `components/scout/TemplateBuilder.tsx`): per season + kind, add/reorder/edit fields (label, type, options, section, aggregate flags, showInSummary, rankMetric). Save → `POST /seasons/:id/templates`.
- **Dynamic form renderer** (replace `PitScoutForm.tsx` / `MatchScoutForm.tsx` internals): load the event's season → active template → render inputs by field `type`, write to `data`. Keep the QR/offline-queue plumbing.
- **Scout views** (`ScoutEventList`, `PitDisplay`, `RobotDashboard`): read fields from `data` via the template; a **season filter** on the events list and analytics.
- **CSV export** (`server/routes/scout.ts sendScoutCsv`): columns = identity fields + template field labels, values from `data`. (Also apply the B8 formula-injection guard while rewriting.)
- **QR** (`components/scout/ScoutQR.tsx`): bump format to `{ v:2, templateId, records:[data…] }`; importer detects `v` (v1 legacy still supported).

## Analytics (the hard part — scope carefully)

Today `RobotDashboard`/`PitDisplay` assume fixed numeric fields. New approach:
- For each **numeric/counter/rating** field with `aggregate ≠ 'none'`, compute per-team aggregates (avg/sum/max) over the season's match records.
- The robot card shows fields flagged `showInSummary`; the ranking/sort defaults to the field flagged `rankMetric` (fall back to first aggregatable field), and users can sort by any aggregatable field.
- **Defer** composite/derived scoring (e.g. "total points = auto*2 + …") to a later phase; v1 = per-field aggregation + sort. Note this limit to the owner.

## Build order & verification

1. **Schema + migration + built-in templates + backfill** → verify **zero data loss** and that CSV/QR/analytics are byte-for-byte unchanged for the existing event (this is the go/no-go gate).
2. Season + template **CRUD endpoints**.
3. **Template builder UI** + season manager.
4. **Dynamic form renderer** (pit + match) writing `data` → scout a robot/match on a custom template, confirm persistence + CSV.
5. **QR v2** round-trip (export on one device/template, import on another).
6. **Analytics** template-aware aggregation + season filter.
7. Regression: legacy season/event still renders and exports identically.

## Risks / call-outs for the owner
- **Biggest surface in the app**; do it as its own project, not interleaved with other epics.
- Analytics can only be as smart as the template's field flags; composite scoring is a phase-2 item.
- QR format is versioned; field-guide teams already have devices using v1 — v1 import stays supported.
- Recommend a **feature-flagged rollout**: build behind the built-in "legacy" template so current behavior is the default until a team opts into a custom template.
