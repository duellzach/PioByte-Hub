---
name: Cap-exempt (mentor/adult) sign-up roles
description: How the "doesn't count toward event capacity" role toggle is defined and enforced.
---

Roles can be marked `excludeFromCaps` in `team_settings.roles` (jsonb `{name, tier, excludeFromCaps?}`). A
user is exempt from a calendar event's sign-up capacity only when **every** role they hold is marked
exempt — not "at least one." A user with a mix of exempt and non-exempt roles (e.g. Coach + Department
Head, only Coach marked) still counts as an ordinary participant and can be waitlisted.

**Why:** this is the literal wording of the shipped feature spec ("whose roles are all marked this way").
A code-review pass flagged this as likely wrong (expected `some`-style matching) — it isn't; keep `every`
unless the user explicitly changes the requirement.

**How to apply:** the predicate lives in `shared/roles.ts` (`isCapExemptRoles`) and must be reused anywhere
cap-exemption is checked (signup acceptance, accepted-count math, roster display) rather than
reimplemented — duplicated logic drifting out of sync was a review finding. An exempt user's self-signup
is always immediately `accepted`, regardless of whether the event has a capacity at all.

A one-shot DB migration's claim key is permanent once run — if a later commit changes the migration's
body (e.g. a field rename) but reuses the same key, any database that already ran the old body treats the
corrected version as already-done and silently skips it. Give a corrected migration body a new key, and
have it also convert/backfill from the old body's on-disk shape so already-migrated databases still end up
correct.
