#!/bin/bash
set -e

npm install --legacy-peer-deps

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
