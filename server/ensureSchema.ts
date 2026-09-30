/**
 * `npm run db:ensure` — bring THIS environment's database up to what the
 * server creates at boot, without starting the server. Run by
 * scripts/post-merge.sh after every GitHub sync so the Replit workspace
 * database never falls behind production (see server/bootMigrations.ts for
 * why that matters: it's what makes Publish propose DROP TABLE).
 *
 * Never drops anything; safe to run any number of times. A completely empty
 * database is left alone — starting the app bootstraps it (initializeDatabase).
 */
import { pool } from "./db.js";
import { ensurePreTrafficSchema, runBootMigrations } from "./bootMigrations";

async function main() {
  try {
    await pool.query("SELECT 1 FROM team_settings LIMIT 1");
  } catch (e: any) {
    if (e?.code === "42P01") {
      console.log("db:ensure — empty database; start the app once to bootstrap it. Nothing to do.");
      return;
    }
    throw e;
  }
  await ensurePreTrafficSchema();
  await runBootMigrations();
  console.log("db:ensure — database schema is up to date.");
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("db:ensure failed:", e);
    process.exit(1);
  });
