---
name: Keep delegated completion scoped to the helper
description: Helper completion callbacks can affect the main assigned task in this workspace.
---

Only the main agent should propose follow-ups or mark the assigned project task complete. A delegated frontend helper should report its files and verification results, not close the project task.

**Why:** A UI-only helper's completion changed the shared task to ready before the main agent had finished backend guards and full-request validation. This is platform task-assignment behavior, not something discoverable in application code.

**How to apply:** Explicitly exclude task-management and completion callbacks in helper briefs. If a helper has already closed the shared task, check its ownership before resuming further changes. Resuming can preserve an isolated-agent assignment that the main chat cannot complete; if completion rejects ownership, ask the user to assign it to the main chat rather than repeatedly retrying. Verify the complete request and request a fresh completion review once correctly assigned.
