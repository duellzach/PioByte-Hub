/**
 * Read-only: lists task comment/history authors that don't resolve to a user
 * (what the app shows as "Unknown" / "System" / "Former member").
 * Run with: npm run db:diagnose-authors
 */
import { pool } from "./db";

async function main() {
  const client = await pool.connect();
  try {
    for (const col of ["comments", "history"] as const) {
      const { rows } = await client.query(`
        SELECT e->>'userId' AS user_id, count(*)::int AS entries, count(DISTINCT t.id)::int AS tasks,
               to_timestamp(max((e->>'timestamp')::bigint) / 1000.0) AS latest
        FROM tasks t, jsonb_array_elements(t.${col}) e
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id::text = e->>'userId')
        GROUP BY 1 ORDER BY entries DESC`);
      console.log(`\n=== task ${col}: unresolved authors ===`);
      if (rows.length === 0) console.log("(none)");
      for (const r of rows) {
        const kind = /^\d+$/.test(r.user_id ?? "") ? "deleted user" : "no user recorded";
        console.log(`${String(r.user_id).padEnd(12)} ${kind.padEnd(17)} ${r.entries} entries on ${r.tasks} tasks, latest ${r.latest?.toISOString?.() ?? r.latest}`);
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
