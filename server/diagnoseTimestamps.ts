/**
 * db:diagnose-tz — read-only report on the `timestamp` (without time zone)
 * column bug: every such column's stored value depends on whatever timezone
 * the reading Node process happens to be in (confirmed directly: reading the
 * same row gives a different instant under TZ=UTC vs. an unset TZ). This
 * script answers the one question that decides whether the migration in
 * server/migrateTimestamptz.ts is safe to run: which timezone was the
 * EXISTING data actually written in?
 *
 * Run with:  npm run db:diagnose-tz
 * Makes no writes.
 */

import { pool } from './db.js';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  timestamp-without-time-zone diagnostic (read-only)');
  console.log('═══════════════════════════════════════════════════════════\n');

  // 1. What timezone did CURRENT_TIMESTAMP-defaulted columns (35 of 49) use?
  const dbTz = await pool.query(`SELECT current_setting('TimeZone') AS tz`);
  console.log(`DB session TimeZone (used by every CURRENT_TIMESTAMP default): ${dbTz.rows[0].tz}`);

  // 2. What timezone does THIS process (and therefore app-written columns:
  //    check_in_at, checked_in_at, verified_at, etc — 14 of 49) use?
  const nodeTz = process.env.TZ || '(unset)';
  const resolvedTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log(`Node process.env.TZ: ${nodeTz}`);
  console.log(`Node resolved timezone: ${resolvedTz}\n`);

  // 3. The decisive test. time_entries.check_in_at is written by the app
  //    (JS Date) and time_entries.created_at by the DB (CURRENT_TIMESTAMP)
  //    in the SAME insert (server/routes/time.ts check-in handler), so if
  //    the two writers agreed, skew should be ~0 for every row. A skew of
  //    ±7h/±8h means the app and DB clocks disagreed — a single LEGACY_TZ
  //    cannot correctly describe both column groups.
  console.log('─── Writer skew: time_entries (check_in_at vs created_at) ───');
  const teSkew = await pool.query(`
    SELECT id, check_in_at, created_at,
           EXTRACT(EPOCH FROM (check_in_at - created_at)) / 3600.0 AS skew_hours
    FROM time_entries ORDER BY id DESC LIMIT 20
  `);
  if (teSkew.rows.length === 0) {
    console.log('  (no rows)');
  } else {
    for (const r of teSkew.rows) {
      console.log(`  id=${r.id}  check_in_at=${r.check_in_at.toISOString()}  created_at=${r.created_at.toISOString()}  skew=${Number(r.skew_hours).toFixed(2)}h`);
    }
  }

  console.log('\n─── Writer skew: event_signups (checked_in_at vs created_at) ───');
  const esSkew = await pool.query(`
    SELECT id, checked_in_at, created_at,
           EXTRACT(EPOCH FROM (checked_in_at - created_at)) / 3600.0 AS skew_hours
    FROM event_signups WHERE checked_in_at IS NOT NULL ORDER BY id DESC LIMIT 20
  `);
  if (esSkew.rows.length === 0) {
    console.log('  (no rows with checked_in_at)');
  } else {
    for (const r of esSkew.rows) {
      console.log(`  id=${r.id}  checked_in_at=${r.checked_in_at.toISOString()}  created_at=${r.created_at.toISOString()}  skew=${Number(r.skew_hours).toFixed(2)}h`);
    }
  }

  console.log('\n─── Writer skew: fundraising_entries (verified_at vs created_at) ───');
  const feSkew = await pool.query(`
    SELECT id, verified_at, created_at,
           EXTRACT(EPOCH FROM (verified_at - created_at)) / 3600.0 AS skew_hours
    FROM fundraising_entries WHERE verified_at IS NOT NULL ORDER BY id DESC LIMIT 20
  `);
  if (feSkew.rows.length === 0) {
    console.log('  (no rows with verified_at)');
  } else {
    for (const r of feSkew.rows) {
      console.log(`  id=${r.id}  verified_at=${r.verified_at.toISOString()}  created_at=${r.created_at.toISOString()}  skew=${Number(r.skew_hours).toFixed(2)}h`);
    }
  }

  // 4. Row counts per table with a timestamp column, so the lock/rewrite
  //    cost is known before Step 1 runs.
  console.log('\n─── Row counts (tables with timestamp columns) ───');
  const tableRows = await pool.query(`
    SELECT DISTINCT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
    ORDER BY table_name
  `);
  for (const { table_name } of tableRows.rows) {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM ${JSON.stringify(table_name).slice(1, -1)}`);
    console.log(`  ${table_name}: ${rows[0].n}`);
  }

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('How to read this:');
  console.log('  skew ≈ 0h everywhere  → the DB and Node clocks agreed. One');
  console.log('                          LEGACY_TZ describes all data; the');
  console.log('                          migration in migrateTimestamptz.ts');
  console.log('                          is safe to run.');
  console.log('  skew ≈ ±7h / ±8h      → the two writers disagreed (this is');
  console.log('                          the PDT/PST offset). STOP — a single');
  console.log('                          timezone cannot correctly convert');
  console.log('                          both CURRENT_TIMESTAMP-defaulted and');
  console.log('                          app-written columns. Re-plan before');
  console.log('                          running the migration.');
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .catch((err) => { console.error('Diagnostic failed:', err); process.exit(1); })
  .finally(() => pool.end());
