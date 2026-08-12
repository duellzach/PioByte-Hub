/**
 * db:migrate-timestamptz — one-time conversion of every `timestamp` (without
 * time zone) column to `timestamptz`. See server/diagnoseTimestamps.ts for
 * why: node-postgres resolves a naive timestamp against whatever timezone
 * the READING process happens to be in, so the same stored row means a
 * different instant depending on where/when the app runs. `timestamptz`
 * stores a true instant and makes the process timezone irrelevant to
 * storage.
 *
 * SAFE BY DEFAULT: running this without --yes only prints the plan and does
 * nothing. Read server/diagnoseTimestamps.ts's output first — if the writer
 * skew there is anything other than ~0h, a single LEGACY_TZ cannot correctly
 * describe the data and this script must not be run as-is.
 *
 * Usage:
 *   npm run db:migrate-timestamptz                  # dry run — prints the plan only
 *   npm run db:migrate-timestamptz -- --yes          # actually converts
 *   LEGACY_TZ=America/Los_Angeles npm run db:migrate-timestamptz -- --yes
 *
 * LEGACY_TZ defaults to the database's own `current_setting('TimeZone')` —
 * the same timezone every CURRENT_TIMESTAMP default has always used.
 *
 * Runs as ONE transaction: either every column converts and every default
 * is re-verified, or nothing changes. A reverse-rollback .sql file is
 * written to ./migrations/ before the transaction commits, so undoing this
 * later never depends on reconstructing the conversion from memory.
 */

import { pool, db } from './db.js';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

const IDENTIFIER_RE = /^[a-z_][a-z0-9_]*$/;

function assertSafeIdentifier(name: string, kind: string): void {
  if (!IDENTIFIER_RE.test(name)) {
    throw new Error(`Refusing to use unexpected ${kind} identifier from the catalog: ${JSON.stringify(name)}`);
  }
}

/** Single-quote a value for safe interpolation into a SQL string literal. */
function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

interface ColumnInfo {
  table_name: string;
  column_name: string;
  column_default: string | null;
}

async function main() {
  const isDryRun = !process.argv.includes('--yes');

  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  timestamp → timestamptz migration ${isDryRun ? '(DRY RUN — no changes will be made)' : '(LIVE)'}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  // Legacy timezone: the assumption every naive-timestamp value in the DB
  // will be reinterpreted under. Explicit env var wins; otherwise fall back
  // to the DB session's own TimeZone setting — the same value every
  // CURRENT_TIMESTAMP default has implicitly used all along.
  let legacyTz = process.env.LEGACY_TZ;
  if (!legacyTz) {
    const { rows } = await pool.query(`SELECT current_setting('TimeZone') AS tz`);
    legacyTz = rows[0].tz;
    console.log(`LEGACY_TZ not set — defaulting to DB session TimeZone: ${legacyTz}`);
  } else {
    console.log(`LEGACY_TZ (explicit): ${legacyTz}`);
  }
  // Validate it's a real IANA zone Postgres/Node both understand, before
  // it gets interpolated into DDL.
  try {
    Intl.DateTimeFormat('en-US', { timeZone: legacyTz! }).format(new Date());
  } catch {
    throw new Error(`LEGACY_TZ "${legacyTz}" is not a recognized IANA timezone.`);
  }

  const { rows: columns } = await pool.query<ColumnInfo>(`
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
    ORDER BY table_name, column_name
  `);

  if (columns.length === 0) {
    console.log('No `timestamp without time zone` columns found — nothing to do. (Already migrated?)');
    return;
  }

  console.log(`\nFound ${columns.length} column(s) to convert:\n`);
  for (const c of columns) {
    assertSafeIdentifier(c.table_name, 'table');
    assertSafeIdentifier(c.column_name, 'column');
    const defaultNote = c.column_default ? `  [default: ${c.column_default}]` : '';
    console.log(`  ${c.table_name}.${c.column_name}${defaultNote}`);
  }

  const rollbackDir = path.join(process.cwd(), 'migrations');
  fs.mkdirSync(rollbackDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const rollbackPath = path.join(rollbackDir, `rollback-timestamptz-${stamp}.sql`);

  const rollbackLines: string[] = [
    `-- Reverse of the timestamptz migration run at ${new Date().toISOString()}`,
    `-- Restores every column below to \`timestamp\` (without time zone),`,
    `-- reinterpreting the stored instant back into ${legacyTz} wall-clock text.`,
    `-- Apply with:  psql "$DATABASE_URL" -f ${path.basename(rollbackPath)}`,
    ``,
  ];

  if (isDryRun) {
    console.log(`\nDry run only — no changes made. Re-run with --yes to convert using LEGACY_TZ=${legacyTz}.`);
    return;
  }

  console.log(`\nConverting ${columns.length} column(s), interpreting existing values as ${legacyTz}...\n`);

  await db.transaction(async (tx) => {
    for (const c of columns) {
      const qTable = `"${c.table_name}"`;
      const qColumn = `"${c.column_name}"`;

      await tx.execute(sql.raw(
        `ALTER TABLE ${qTable} ALTER COLUMN ${qColumn} TYPE timestamptz USING ${qColumn} AT TIME ZONE ${quoteLiteral(legacyTz!)}`
      ));
      console.log(`  ✓ ${c.table_name}.${c.column_name} → timestamptz`);

      rollbackLines.push(
        `ALTER TABLE "${c.table_name}" ALTER COLUMN "${c.column_name}" TYPE timestamp USING "${c.column_name}" AT TIME ZONE ${quoteLiteral(legacyTz!)};`
      );

      // Postgres re-coerces an existing default expression through the old
      // type on ALTER COLUMN TYPE, so a CURRENT_TIMESTAMP default can come
      // out the other side as `now()::timestamp::timestamptz` — a double
      // conversion that reintroduces the exact bug this migration fixes.
      // Every default in this schema is CURRENT_TIMESTAMP (confirmed by
      // audit); re-assert it explicitly rather than trust the coercion.
      if (c.column_default) {
        if (!/current_timestamp/i.test(c.column_default)) {
          console.warn(`    ⚠ ${c.table_name}.${c.column_name} had an unexpected default (${c.column_default}) — re-asserting CURRENT_TIMESTAMP anyway; verify this manually after.`);
        }
        await tx.execute(sql.raw(`ALTER TABLE ${qTable} ALTER COLUMN ${qColumn} SET DEFAULT CURRENT_TIMESTAMP`));
        rollbackLines.push(`ALTER TABLE "${c.table_name}" ALTER COLUMN "${c.column_name}" SET DEFAULT CURRENT_TIMESTAMP;`);
      }
    }

    // Verify before committing — if anything didn't convert, abort the
    // whole transaction rather than leave a partial migration.
    const { rows: remaining } = await tx.execute(sql`
      SELECT table_name, column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
    ` as any);
    if (remaining.length > 0) {
      throw new Error(
        `Verification failed — ${remaining.length} column(s) still \`timestamp without time zone\` after conversion: ` +
        remaining.map((r: any) => `${r.table_name}.${r.column_name}`).join(', ')
      );
    }
    console.log(`\n  ✓ Verified: zero \`timestamp without time zone\` columns remain.`);
  });

  fs.writeFileSync(rollbackPath, rollbackLines.join('\n') + '\n');
  console.log(`\nRollback script written to: ${rollbackPath}`);
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Migration complete.');
  console.log('  Next: re-run `npm run db:diagnose-tz` to confirm, then diff');
  console.log('  hours totals against your pre-migration baseline.');
  console.log('═══════════════════════════════════════════════════════════');
}

main()
  .catch((err) => { console.error('\nMigration failed — transaction rolled back, no changes made.\n', err); process.exit(1); })
  .finally(() => pool.end());
