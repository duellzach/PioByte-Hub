/**
 * Every idempotent schema/data step the server runs at boot, in one place so
 * the server and `npm run db:ensure` (server/ensureSchema.ts) can't drift.
 *
 * WHY THE SCRIPT EXISTS: Replit's Publish compares the workspace
 * (development) database with production and offers to make production match.
 * These steps run at boot, so production gets new tables as soon as a new
 * build starts — but the development database only gets them if someone runs
 * the app in the workspace. Any table that exists only in production then
 * shows up in the publish dialog as `DROP TABLE … CASCADE`, and approving it
 * deletes live data. (This happened to calendar_feed_tokens in August and to
 * the social_* tables in September.) scripts/post-merge.sh runs db:ensure
 * after every GitHub sync so the two databases stay in step.
 *
 * Everything here must stay safe to run repeatedly against any database:
 * CREATE/ALTER … IF NOT EXISTS, or claimMigration()-guarded one-shots.
 */
import { storage } from "./storage";
import { ensureSocialTables, migrateMediaManagerRole } from "./social/store";

/** Tables that routes query unconditionally — must exist before traffic. */
export async function ensurePreTrafficSchema(): Promise<void> {
  // calendar/upcoming routes query event_shifts and event_signups.shift_id
  // unconditionally, so early requests would 500 against missing objects.
  try {
    await storage.ensureEventShiftsTable();
    await storage.ensureSignupShiftIdColumn();
  } catch (e) {
    console.error("Event shifts migration failed — shift signup routes will error until this is fixed:", e);
  }
  // Same reason: the Social page's routes query these tables unconditionally.
  try {
    await ensureSocialTables();
  } catch (e) {
    console.error("Social media tables migration failed — the Social page will error until this is fixed:", e);
  }
}

/** Everything else, in the order the boot chain has always used. */
export async function runBootMigrations(): Promise<void> {
  try {
    // Must succeed before any claimMigration() call below can work — the
    // one-shot data migrations (competition unification, outreach hours
    // backfill, stuck check-in cleanup) all depend on this table existing.
    await storage.ensureSchemaMigrationsTable();
  } catch (e) {
    console.error("schema_migrations table creation failed — one-shot migrations below cannot run safely:", e);
  }
  try {
    await storage.migrateApiKeyColumns();
    await storage.ensureTeamTimezoneColumn();
    await storage.migrateCalendarTypes();
    await storage.ensurePushSubscriptionsTable();
    await storage.ensureRecurringTasksTable();
    await storage.ensureEventParticipationTables();
    await storage.ensureInviteOnlyEvents();
    await storage.ensureCompetitionUnification();
    await storage.ensureCalendarFeedTokens();
    await storage.ensureRequirementsAndFundraising();
    await storage.ensureRequirementChecklist();
    await storage.ensureArchiveColumns();
    await storage.ensureAttendanceColumns();
    await storage.ensureProjectLinksColumn();
    await storage.ensureTaskSegments();
    await storage.ensureCertificationLevelsAndBadges();
    await storage.ensureCalendarCommentsColumn();
    await storage.ensureRecurrenceDaysColumn();
    await storage.ensureBacklogStatusDefault();
  } catch (e) {
    console.warn("Boot migration chain failed:", e);
  }
  // Certifications v2 one-shots, in their own block so a failure here can't
  // abort the chain above. Order matters: the role rename must land before
  // scopes are seeded from it, and the columns must exist before badges are
  // backfilled against them. Each is claimMigration-guarded and runs once.
  try {
    await storage.migrateTrainerRoleRename();
    await storage.seedTrainerScopes();
    await storage.backfillLevelBadges();
    await storage.migrateCoachCapExempt();
  } catch (e) {
    console.warn("Certifications v2 migration skipped:", e);
  }
  // Social media: add the Media Manager role to existing teams.
  try {
    await migrateMediaManagerRole();
  } catch (e) {
    console.warn("Media Manager role migration skipped:", e);
  }
  try {
    await storage.ensureScoutingSeasonsTables();
  } catch (e) {
    console.warn("Scouting seasons migration skipped:", e);
  }
  try {
    await storage.backfillNexusEventKeys();
  } catch (e) {
    console.warn("Nexus key backfill skipped:", e);
  }
  try {
    await storage.backfillOutreachHours();
  } catch (e) {
    console.warn("Outreach hours backfill skipped:", e);
  }
  // Must run after the backfills above are confirmed gated, and before the
  // unique index below — the index would otherwise trip on the very rows
  // this cleanup is about to remove.
  try {
    await storage.cleanupStuckCompetitionEntries();
  } catch (e) {
    console.warn("Stuck competition check-in cleanup skipped:", e);
  }
  try {
    await storage.ensureCompetitionEntryUniqueIndex();
  } catch (e) {
    // Failure here means duplicate competition rows exist in the database —
    // possibly double-counted completed entries inflating someone's hours.
    // Needs investigation, not a silent skip.
    console.error("Competition unique index NOT created — duplicate rows likely exist:", e);
  }
}
