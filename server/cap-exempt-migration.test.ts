/**
 * Regression test for storage.migrateCoachCapExempt() against a database
 * that already ran an earlier, differently-named build of this migration.
 *
 * A prior implementation of the "mentor/adult doesn't count toward event
 * caps" feature wrote a `capExempt` key under migration key
 * 'coach-role-cap-exempt-default'. The shipped implementation reads only
 * `excludeFromCaps`. If the corrective migration reused that same key, it
 * would be permanently skipped on any database where the old body already
 * ran, leaving `capExempt: true` on disk with no `excludeFromCaps` — silently
 * defeating the whole feature for existing teams. This test simulates that
 * exact database state and asserts the migration still converts it.
 *
 * Requires a database connection (uses the real `storage`/`db`):
 *
 *   node_modules/.bin/tsx server/cap-exempt-migration.test.ts
 */
import assert from "node:assert/strict";
import { db } from "./db";
import { storage } from "./storage";
import { sql } from "drizzle-orm";

async function main() {
  // Snapshot the current team_settings.roles so the test can restore it.
  const before = await storage.getTeamSettings();
  const originalRoles = (before as any).roles;

  try {
    // Simulate: an earlier build already claimed the legacy migration key,
    // and left a role with only the old `capExempt` field.
    await db.execute(sql`
      INSERT INTO schema_migrations (key) VALUES ('coach-role-cap-exempt-default')
      ON CONFLICT (key) DO NOTHING
    `);
    await db.execute(sql`
      UPDATE team_settings SET roles = '[
        {"name": "Coach", "tier": "leadership", "capExempt": true},
        {"name": "Mentor", "tier": "leadership", "capExempt": false},
        {"name": "Team Captain", "tier": "leadership"}
      ]'::jsonb
    `);

    await storage.migrateCoachCapExempt();

    const after: any = await storage.getTeamSettings();
    const roles: { name: string; excludeFromCaps?: boolean; capExempt?: boolean }[] = after.roles;
    const coach = roles.find(r => r.name === "Coach");
    const mentor = roles.find(r => r.name === "Mentor");
    const captain = roles.find(r => r.name === "Team Captain");

    assert.equal(
      coach?.excludeFromCaps, true,
      "legacy capExempt:true on Coach must convert to excludeFromCaps:true even though the old migration key is already claimed",
    );
    assert.equal(
      mentor?.excludeFromCaps, false,
      "an explicit legacy capExempt:false must convert to excludeFromCaps:false, not be treated as unset",
    );
    assert.equal(
      captain?.excludeFromCaps, undefined,
      "a role with no legacy capExempt key and not named Coach must stay untouched",
    );

    // Running it again must be a no-op (migration key is now claimed) and
    // must not clobber a team's own explicit choice made in between.
    await db.execute(sql`
      UPDATE team_settings SET roles = jsonb_set(roles, '{0,excludeFromCaps}', 'false')
      WHERE roles->0->>'name' = 'Coach'
    `);
    await storage.migrateCoachCapExempt();
    const afterSecond: any = await storage.getTeamSettings();
    assert.equal(
      afterSecond.roles[0].excludeFromCaps, false,
      "migration must not re-run and overwrite a choice made after the first run",
    );

    console.log("All cap-exempt migration tests passed.");
  } finally {
    // Restore original state so this test leaves no residue.
    await db.execute(sql`
      UPDATE team_settings SET roles = ${JSON.stringify(originalRoles)}::jsonb
    `);
    await db.execute(sql`
      DELETE FROM schema_migrations WHERE key IN ('coach-role-cap-exempt-default', 'coach-role-cap-exempt-default-v2')
    `);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
