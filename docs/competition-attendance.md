# Shared competition attendance

Competition attendance now uses one visit in the general time clock, calendar roster, and Competition Attendance.

## Before the next competition

1. Publish the updated app. The development schema includes the nullable calendar-to-scouting event link; Publish must apply that additive schema change to production. **Do not overwrite production data with development data.**
2. Sign in as a Coach and open **Time Tracking → Coach Tools → Competition Review → Verified event identity**.
3. Optionally link the calendar competition to its scouting event (needed only to tie older scouting-event attendance to it). Their date ranges must agree. Names are never used to guess a relationship.

Scouting-event check-in is retired: members check in to the competition's calendar event from the Time Clock. Existing scouting-event sessions can still be checked out, approved, rejected and audited.

A check-in from another screen reuses the same open visit. Simultaneous check-ins are serialized per member. A member can still start a genuinely separate visit after checking out. Check-in request identifiers make delayed retries return the original visit even after it closes.

Checkout and approval update the same record and mirror calendar attendance. Approving a resolved visit cannot award hours again. Exceptional credits require an explanation. Rejected history cannot be reopened by approvals, roster edits, or reading the time-entry list.

## FIRST Chance, October 4, 2026

**The code does not automatically correct production hours.**

After publishing, a Coach must:

1. Link the FIRST Chance calendar and scouting events.
2. Inspect the five cases and their original records/audit evidence.
3. Verify which of the two conflicting departure times is correct.
4. Decide whether the nearly continuous calendar-to-scouting switch should retain separately rounded credit or become one uninterrupted visit.
5. Decide whether the zero-length first visit intentionally earned an exceptional 15 minutes. The separate later visit is always preserved.
6. Select **Review selected changes** and inspect member and team totals.
7. Enter the reason, confirm the event identity and record-preservation behavior, then apply the review.

The three confirmed redundant full-day credits are rejected, not deleted. If the switch is merged, its legitimate attendance survives on one record. Original values remain in the audit trail, and task segments remain attached to their original records. Repeat application is a no-op; changed evidence invalidates an old preview.

Once applied, verify the published member/team hours reports. A read-only production database check can independently confirm totals and unchanged unrelated entries.

## Verification

`npx tsx server/competition-attendance.test.ts`

Runs authenticated API and concurrency checks with synthetic fixtures in a disposable development-only schema. It refuses production execution, does not copy production data, and drops its fixture schema afterward.
