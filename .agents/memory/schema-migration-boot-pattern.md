---
name: Managed schema changes supersede the legacy boot convention
description: Avoid copying legacy startup DDL when adding schema fields to the managed database.
---

New schema fields must be applied to the development database and then reach the managed production database through Publish. Do not add startup-time DDL or custom production migration scripts.

**Why:** The older project convention used boot-time ensures, but the current managed-database instructions require Publish to own the production schema diff. A schema declaration alone still does not update development, and blindly pushing the entire legacy schema can propose destructive changes.

**How to apply:** Read the database skill and its publish migration reference before schema work. Apply non-destructive development changes, verify them, then ask the user to publish without overwriting production data. Leave unrelated legacy ensures alone.
