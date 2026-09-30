#!/bin/bash
set -e

npm install --legacy-peer-deps

# Bring the workspace database up to what production creates at boot. Without
# this, tables the new code adds exist only in production, and Replit's
# Publish offers to "fix" the difference with DROP TABLE — approving that has
# deleted live data (social_* tables, Sep 2026). Additive only; never drops.
# Non-fatal: a database hiccup mustn't block the sync.
npm run db:ensure || echo "WARNING: db:ensure failed — run 'npm run db:ensure' (or start the app) before publishing."

# NO `drizzle-kit push` here — deliberately.
#
# This hook runs against the LIVE database after every GitHub sync. `push`
# diffs the schema against the database and prompts to drop anything it
# believes is missing ("You're about to delete <table> with N items"), and
# "fixing" it to `-- --force` would execute those drops silently instead of
# prompting. Neither is something a post-sync hook should be able to do.
#
# It is also redundant:
#   * Fresh database — initializeDatabase() in server/index.ts detects it
#     (error 42P01) and runs drizzle-kit push itself before serving traffic.
#   * Existing database — maintained by the idempotent ensure* chain in
#     server/index.ts (ensureCalendarFeedTokens, ensureInviteOnlyEvents,
#     ensureCompetitionUnification, …), which use IF NOT EXISTS.
#
# To add a column, add an ensure* function — don't reinstate a push here.
