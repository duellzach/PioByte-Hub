-- ===========================================================================
-- Forward migration: timestamp (without time zone) -> timestamptz
-- ===========================================================================
--
-- WHAT THIS DOES: converts every `timestamp without time zone` column in the
-- public schema to `timestamptz`, reinterpreting the stored naive values as
-- wall-clock time in a single legacy timezone.
--
-- WHAT THIS DOES NOT DO: there is no DROP in this file. No table, column,
-- constraint, or index is removed, added, or renamed. The only things that
-- change are column *types* and `CURRENT_TIMESTAMP` *defaults*. A production
-- deploy plan proposing to drop `calendar_feed_tokens`, `scout_event_id`,
-- `invited_by`, `invited_at`, or `invite_only` is NOT this migration and
-- should not be approved.
--
-- WHY: node-postgres resolves a naive timestamp against whatever timezone the
-- READING process happens to be in, so the same stored row means a different
-- instant depending on where/when the app runs. `timestamptz` stores a true
-- instant and makes the process timezone irrelevant to storage. This is the
-- SQL equivalent of `npm run db:migrate-timestamptz`
-- (server/migrateTimestamptz.ts) — use that script instead if you can run it,
-- since it also writes a rollback file before committing.
--
-- SAFETY PROPERTIES:
--   * Single transaction. Any failure rolls everything back; a partial
--     conversion is never committed.
--   * Discovery-based. It converts exactly the columns that are still naive
--     on THIS database at THIS moment, so it is idempotent — running it a
--     second time is a no-op.
--   * Verified before commit. If any naive column remains afterward, the
--     transaction aborts.
--
-- BEFORE RUNNING:
--   1. Back up the database (pg_dump). This rewrites every timestamp value.
--   2. Run `npm run db:diagnose-tz` and read the writer-skew output. If skew
--      is anything other than ~0h, a single legacy timezone cannot correctly
--      describe the data and this migration must not be run as-is.
--   3. Confirm the legacy timezone below is right for your data.
--
-- APPLY WITH:
--   psql "$DATABASE_URL" -f migrations/timestamptz-forward-2026-08-13.sql
--
-- ===========================================================================

BEGIN;

DO $$
DECLARE
  -- The timezone every existing naive value will be interpreted as.
  --
  -- Defaults to the database's own TimeZone setting — the same zone every
  -- CURRENT_TIMESTAMP default has implicitly used all along, and the same
  -- fallback server/migrateTimestamptz.ts uses when LEGACY_TZ is unset.
  --
  -- To override (equivalent to `LEGACY_TZ=... npm run db:migrate-timestamptz`),
  -- replace the line below with an explicit IANA zone, e.g.:
  --   legacy_tz text := 'America/Los_Angeles';
  legacy_tz text := current_setting('TimeZone');

  col        record;
  n_converted int := 0;
  n_remaining int := 0;
BEGIN
  -- Fail fast on a bogus zone rather than interpolating it into DDL.
  BEGIN
    PERFORM now() AT TIME ZONE legacy_tz;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'legacy_tz "%" is not a recognized timezone.', legacy_tz;
  END;

  RAISE NOTICE 'Interpreting existing naive timestamps as: %', legacy_tz;

  FOR col IN
    SELECT table_name, column_name, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND data_type = 'timestamp without time zone'
    ORDER BY table_name, column_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN %I TYPE timestamptz USING %I AT TIME ZONE %L',
      col.table_name, col.column_name, col.column_name, legacy_tz
    );
    n_converted := n_converted + 1;
    RAISE NOTICE '  converted %.% -> timestamptz', col.table_name, col.column_name;

    -- Postgres re-coerces an existing default expression through the OLD type
    -- on ALTER COLUMN TYPE, so a CURRENT_TIMESTAMP default can come out the
    -- other side as `now()::timestamp::timestamptz` — a double conversion that
    -- reintroduces the exact bug this migration fixes. Re-assert it explicitly
    -- rather than trust the coercion.
    IF col.column_default IS NOT NULL THEN
      -- Every timestamp default in shared/schema.ts is CURRENT_TIMESTAMP (all
      -- 35 of them, verified). Anything else means this database has drifted
      -- from the schema, so abort and let a human look rather than silently
      -- replacing a real default. Deliberately stricter than
      -- server/migrateTimestamptz.ts, which warns and overwrites: aborting is
      -- recoverable, silently overwriting a production default is not.
      IF col.column_default !~* 'current_timestamp' THEN
        RAISE EXCEPTION
          '%.% has an unexpected default (%). This database has drifted from shared/schema.ts. Rolling back — inspect that column and re-run once resolved.',
          col.table_name, col.column_name, col.column_default;
      END IF;
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN %I SET DEFAULT CURRENT_TIMESTAMP',
        col.table_name, col.column_name
      );
    END IF;
  END LOOP;

  IF n_converted = 0 THEN
    RAISE NOTICE 'No `timestamp without time zone` columns found — nothing to do (already migrated?).';
  END IF;

  -- Verify before committing: if anything did not convert, abort the whole
  -- transaction rather than leave a partial migration.
  SELECT count(*) INTO n_remaining
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND data_type = 'timestamp without time zone';

  IF n_remaining > 0 THEN
    RAISE EXCEPTION
      'Verification failed — % column(s) still `timestamp without time zone` after conversion. Rolling back.',
      n_remaining;
  END IF;

  RAISE NOTICE 'Converted % column(s). Verified: zero naive timestamp columns remain.', n_converted;
END
$$;

COMMIT;

-- ===========================================================================
-- AFTER RUNNING:
--   * Re-run `npm run db:diagnose-tz` to confirm.
--   * Diff hours totals against your pre-migration baseline.
--   * Re-trigger the deploy; a freshly-computed schema diff should now be
--     empty. If it STILL proposes dropping calendar_feed_tokens /
--     scout_event_id / invited_by / invited_at / invite_only, do not approve
--     it — that is a stale cached plan, not a real diff.
--
-- TO ROLL BACK: restore the pg_dump taken beforehand. (Reversing in place
-- means converting each column back with
-- `TYPE timestamp USING <col> AT TIME ZONE '<legacy_tz>'` — see the existing
-- migrations/rollback-timestamptz-*.sql files for that shape.)
-- ===========================================================================
