/**
 * Timezone diagnostic script.
 * Run with: npm run db:diagnose-tz
 */
import { pool } from "./db";

async function main() {
  const client = await pool.connect();
  try {
    console.log("\n=== NODE / PROCESS ===");
    console.log("Node TZ env:      ", process.env.TZ ?? "(not set — uses OS default)");
    console.log("Node local time:  ", new Date().toString());
    console.log("Node UTC time:    ", new Date().toISOString());

    // --- DB server settings ---
    const { rows: tzRows } = await client.query(`
      SELECT name, setting
      FROM pg_settings
      WHERE name IN ('TimeZone', 'log_timezone', 'timezone')
      ORDER BY name
    `);
    console.log("\n=== POSTGRES SERVER SETTINGS ===");
    for (const r of tzRows) console.log(`${r.name.padEnd(20)}: ${r.setting}`);

    // --- What NOW() and NOW() AT TIME ZONE return ---
    const { rows: nowRows } = await client.query(`
      SELECT
        NOW()                            AS db_now,
        NOW() AT TIME ZONE 'UTC'         AS db_now_utc,
        CURRENT_TIMESTAMP                AS current_ts,
        EXTRACT(TIMEZONE FROM NOW())/3600 AS offset_hours
    `);
    console.log("\n=== POSTGRES CURRENT TIME ===");
    const n = nowRows[0];
    console.log("NOW():            ", n.db_now);
    console.log("NOW() AT UTC:     ", n.db_now_utc);
    console.log("CURRENT_TIMESTAMP:", n.current_ts);
    console.log("UTC offset hours: ", n.offset_hours);

    // --- Sample stored timestamps from key tables ---
    const tables: Array<{ label: string; query: string }> = [
      {
        label: "calendar_events (most recent 3)",
        query: `SELECT id, title, start_date, created_at FROM calendar_events ORDER BY created_at DESC LIMIT 3`,
      },
      {
        label: "time_entries (most recent 3)",
        query: `SELECT id, kind, check_in_at, check_out_at FROM time_entries ORDER BY check_in_at DESC LIMIT 3`,
      },
      {
        label: "event_signups w/ attendance (most recent 3)",
        query: `SELECT id, checked_in_at, checked_out_at FROM event_signups WHERE checked_in_at IS NOT NULL ORDER BY checked_in_at DESC LIMIT 3`,
      },
    ];

    for (const { label, query } of tables) {
      try {
        const { rows } = await client.query(query);
        console.log(`\n=== ${label.toUpperCase()} ===`);
        if (rows.length === 0) { console.log("  (no rows)"); continue; }
        for (const r of rows) console.log(" ", JSON.stringify(r));
      } catch (e: any) {
        console.log(`  (skipped — ${e.message})`);
      }
    }

    // --- Round-trip test: write a timestamp, read it back ---
    const testTs = "2026-03-15T14:30:00.000Z"; // known UTC value
    const { rows: rtRows } = await client.query(
      `SELECT $1::timestamptz AS stored, $1::timestamptz AT TIME ZONE 'UTC' AS as_utc`,
      [testTs]
    );
    console.log("\n=== ROUND-TRIP TEST ===");
    console.log("Input (UTC):      ", testTs);
    console.log("Stored (raw):     ", rtRows[0].stored);
    console.log("Read AT UTC:      ", rtRows[0].as_utc);
    const match = new Date(rtRows[0].as_utc).toISOString().startsWith("2026-03-15T14:30");
    console.log("Round-trip OK:    ", match ? "✅ YES" : "❌ NO — timestamps are shifting");

    console.log("\nDone.\n");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
