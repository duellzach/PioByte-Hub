---
name: Schema changes need a boot-time ensure* migration, not just drizzle-kit push
description: This project applies schema changes to existing databases via idempotent ensure* methods run at boot, not automatically. Read this before adding any new column/table.
---

Adding a column/table to the schema file alone does not update an existing (non-fresh) database in this project. The boot sequence only auto-applies the full schema when it detects a completely fresh database (no tables yet); on every other boot it just verifies connectivity — it does not diff and apply new columns/tables.

**Why:** the completion-review gate for this project rejects work that adds a schema field without a corresponding boot-time migration, because after merge the deployed app would crash with "column/relation does not exist" until someone manually pushed the schema.

**How to apply:** for any new column/table, pair the schema definition with an idempotent boot-time migration method (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`) invoked during server startup alongside the other existing boot-time migrations, so every environment (including a fresh deploy) self-heals. During development, also run the schema-push command once yourself so the current dev database picks up the change immediately — the boot-time migration is what makes it work everywhere else.
