// This lives in db/ rather than the repo root ON PURPOSE — do not move it back.
//
// Replit's Publish step looks for a Drizzle project and, on finding one, runs
// its own `drizzle-kit push` against the PRODUCTION database. That push has
// repeatedly proposed dropping live data (the calendar_feed_tokens table,
// time_entries.scout_event_id, event_signups.invited_by/invited_at,
// calendar_events.invite_only) — none of which this repo's schema asks for.
// Keeping the config out of the conventional root location stops it being
// picked up. See replit.md.
//
// Everything that legitimately needs it passes --config=db/drizzle.config.ts:
//   * npm run schema:push / schema:studio
//   * initializeDatabase() in server/index.ts (fresh-database bootstrap only)
//
// Paths below stay CWD-relative (npm scripts run from the repo root), not
// relative to this file — verified against a scratch database.
import { defineConfig } from "drizzle-kit";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
