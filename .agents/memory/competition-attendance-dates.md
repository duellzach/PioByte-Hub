---
name: Competition attendance dates
description: Date semantics and history boundaries for the live competition attendance workflow.
---

For live competition attendance, a missing end date means the event is a one-day event whose effective end is its start date. Events with a start date before today and no end date are historical, not perpetually active. Current events should be preferred over upcoming events when choosing a default.

**Why:** Historical scouting events can retain attendance records, and treating a missing end date as open-ended causes those records to surface as live check-ins or pending approvals.

**How to apply:** Keep the live event selector date-filtered and keep general event/check-in history queries unfiltered so historical attendance remains available for reporting.