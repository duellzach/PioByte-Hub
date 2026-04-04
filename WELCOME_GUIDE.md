# PIO-BYTES Hub — Welcome Guide
### FRC Team 10991 | Project & Scouting Management System

---

> **How to use this document:** Copy all content into a new Google Doc.  
> Each `[SCREENSHOT: ...]` label marks where to insert a screenshot you capture from the live app.  
> Delete this note before sharing with the team.

---

## Table of Contents

1. [What Is PIO-BYTES Hub?](#1-what-is-pio-bytes-hub)
2. [Logging In for the First Time](#2-logging-in-for-the-first-time)
3. [Understanding Roles](#3-understanding-roles)
4. [Pages at a Glance](#4-pages-at-a-glance)
5. [Feature Guide — By Role](#5-feature-guide--by-role)
   - [Coaches](#51-coaches)
   - [Team Captains & SCRUM Masters](#52-team-captains--scrum-masters)
   - [Department Heads](#53-department-heads)
   - [Team Members](#54-team-members)
   - [Safety Trainers](#55-safety-trainers)
6. [Feature Deep-Dives](#6-feature-deep-dives)
   - [War Room Dashboard](#61-war-room-dashboard)
   - [Kanban Boards](#62-kanban-boards)
   - [Time Tracking](#63-time-tracking)
   - [Scout Module](#64-scout-module)
   - [Safety Certifications](#65-safety-certifications)
   - [Calendar](#66-calendar)
   - [Resources Hub](#67-resources-hub)
   - [Team Management](#68-team-management)
   - [Announcements](#69-announcements)
7. [Tips & Best Practices](#7-tips--best-practices)
8. [FAQ](#8-faq)

---

## 1. What Is PIO-BYTES Hub?

PIO-BYTES Hub is Team 10991's all-in-one operations platform. It replaces scattered spreadsheets, group chats, and paper sign-in sheets with a single web app that every team member can access from any device.

**What it does:**

- Tracks every project task across all departments on Kanban boards
- Gives coaches a real-time "War Room" view of team progress
- Records student time, requires coach approval, and maintains a full audit trail
- Powers FRC match scouting with live data from The Blue Alliance and Nexus APIs
- Manages safety certifications and can lock tasks behind required certs
- Keeps the team calendar and a shared library of FRC resources

**Where to find it:** Ask your coach for the web address. The app works in any modern browser and can be added to your phone's home screen like an app.

---

## 2. Logging In for the First Time

[SCREENSHOT: Full login screen — show the PIO-BYTES Hub logo at top center, the "Secure Username" and "Access Key" input fields, and the red "Initialize System" button. Make sure the page background is black and the card has the team logo.]

1. Open the app URL in your browser.
2. Enter the **username** your coach gave you.
3. Enter your **password** (default is `changeme` — you will be prompted to change it on first use).
4. Tap **Initialize System**.

> **If the screen shows "Database Empty":** A coach must click "Seed Initial Team" to set up the database before anyone can log in. This only happens on a brand-new installation.

**Changing your password:**
Navigate to **Team Management**, find your own name, click the edit icon, and use the "Change Password" option. Passwords are your responsibility — do not share them.

**Staying logged in:**
The app remembers your login when you close and reopen the browser tab. To log out, click your name in the sidebar and tap **Logout**.

---

## 3. Understanding Roles

Every user has one or more roles. Your role determines what you can see and do.

| Role | Who | What They Can Do |
|---|---|---|
| **Coach** | Adult mentors | Full access — manage users, approve time, post announcements, everything |
| **Team Captain** | Student leaders | Create/edit tasks and projects, post announcements, manage assignments |
| **SCRUM Master** | Sprint managers | Create/manage tasks, move items on Kanban boards, access War Room |
| **Department Head** | Dept leads | Manage tasks within their department, view their department's board |
| **Safety Trainer** | Cert instructors | Process safety certification requests, grant/revoke certifications |
| **Team Member** | General students | View boards, update assigned tasks, check in/out for time tracking |
| **Class Member** | Class participants | Limited view — time tracking and basic task access |

> A user can hold multiple roles at once. For example, a Team Captain might also be a SCRUM Master.

---

## 4. Pages at a Glance

Navigate using the sidebar on the left (desktop) or the bottom bar (mobile).

[SCREENSHOT: Full sidebar open — show all navigation icons and labels: Home, War Room, Boards, Time, Scout, Safety, Team, Calendar, Resources. Capture in dark mode if the team uses it. Also show the PIO-BYTES logo at the top of the sidebar and the dark mode toggle icon at the bottom.]

| Page | Icon | Summary |
|---|---|---|
| **Home** | House | Team feed, notifications, announcements |
| **War Room** | Crosshair/grid | Full project status matrix across all active boards |
| **Boards** | Columns | Kanban task boards per project and department |
| **Time Tracking** | Clock | Check in/out, coach approvals, time audit |
| **Scout** | Target | FRC match scouting, pit data, live TBA/Nexus feeds |
| **Safety** | Shield | Certifications, requests, trainer workflows |
| **Team** | People | User management, roles, departments |
| **Calendar** | Calendar | Shop sessions, competitions, meetings, outreach |
| **Resources** | Bookmark | Shared FRC links, vendor pages, training docs |

---

## 5. Feature Guide — By Role

### 5.1 Coaches

As a Coach, you have full access to everything. Your primary daily tasks are:

**At the start of each meeting:**
- Open **Time Tracking** → approve pending check-ins (amber-highlighted rows)
- Glance at **War Room** for any blocked or at-risk tasks

**During the season:**
- Add new team members via **Team Management** → New User
- Post reminders and safety notices via **Home → Announcements**
- Import competition dates from TBA in the **Calendar** page
- Review certification requests in **Safety Certifications**

**At competition:**
- Open **Scout → Pit Display** on a large screen for a 4K-optimized live view
- Monitor upcoming matches via the Nexus Schedule tab
- Use Scout → Robot Dashboard to pull up scouted data on any team

**Coach-only actions:**
- Muting a user (silences their notifications without removing access)
- Deleting users
- Posting Global announcements (all members see a toast popup)
- Triggering the "Seed Initial Team" on a fresh database
- Importing TBA competition events into the calendar

---

### 5.2 Team Captains & SCRUM Masters

Captains focus on the project boards and team coordination.

**Your key tools:**
- **Boards** — Create new projects, create and assign tasks, drag cards between columns
- **War Room** — Monitor blocked tasks and sprint progress
- **Home** — Post team announcements (Department or Global scope)
- **Calendar** — Add meetings, outreach events, and volunteer sessions

**Creating a task:**
1. Go to **Boards** and select a project.
2. Click **+ Add Task** in any column.
3. Fill in the title, priority, department, assignees, effort estimate, and any success criteria.
4. Toggle "Board Visibility" if the task should only appear on a department board.

**Tracking sprints:**
Use the Blocked section in War Room (shown with a red ring) to spot and unblock dependencies quickly. SCRUM Masters can update task statuses and add notes directly from the task modal.

---

### 5.3 Department Heads

Department Heads see a filtered view of their department's work.

**Your key tools:**
- **Boards → Department Board** — Shows only your department's tasks (including dept-only tasks)
- **Boards → Project Boards** — Shows tasks marked visible to all boards
- **War Room** — Full project view (read-only helpful context)

**Creating a department task:**
When creating a task from your department board, the "Dept Only" toggle is on by default — the task stays private to your board. Turn it off if it belongs on the project board too.

**Tracking your team:**
Use assignee filters on the Kanban board to see exactly who is working on what in your department.

---

### 5.4 Team Members

Team Members primarily interact with assigned tasks and time tracking.

**Your daily workflow:**
1. **Check in** when you arrive — open **Time Tracking → Check In**.
2. Work on your assigned tasks — open them from **Boards** or the **Home** feed.
3. Update task status (e.g., move from "Not Started" to "In Progress") when you begin work.
4. Mark success criteria complete inside the task modal as you finish sub-items.
5. **Check out** when you leave — Time Tracking → Check Out.

**Scouting (if assigned):**
- Claim matches in the Scout module from the Schedule Grid.
- Fill out the Match Scout form for each robot you observe.
- Use QR codes to share scouting data with teammates without an internet connection.

---

### 5.5 Safety Trainers

Safety Trainers process certification requests from team members.

**Your workflow:**
1. Open **Safety Certifications**.
2. Find pending requests in the "Requests" tab — they show the member's name, the cert they want, and their current progress notes.
3. Claim a request (marks it as in-progress with you).
4. Update progress notes as you work through the training steps.
5. Mark Complete (auto-grants the cert to the member) or Reject with a reason.

You can also directly grant or revoke certifications on a member's profile from the Certifications tab.

---

## 6. Feature Deep-Dives

### 6.1 War Room Dashboard

The War Room gives coaches and captains a birds-eye view of every active project at once.

[SCREENSHOT: War Room page — show at least two project sections expanded, each with a task matrix of columns (Backlog, Not Started, In Progress, Blocked, Complete) and colored task cards inside each cell. If any task is blocked, show the red ring and pulsing dot on that section. Ideally show one completed task count badge in green.]

**How to read it:**
- Each row is a project. Each column is a task status.
- Numbers inside cells = count of tasks at that status.
- A **red ring** on a project section means one or more tasks are blocked — the blocked list expands below it.
- Tasks marked "Dept Only" do not appear here (they live only on dept boards).

**During stand-ups:** Project the War Room on a screen. Walk down the rows: anything in Blocked needs immediate discussion.

---

### 6.2 Kanban Boards

[SCREENSHOT: Kanban board page — show a project board with at least 3 columns (Not Started, In Progress, Complete) each containing 2-3 task cards. Show the project selector dropdown at the top left. Show at least one card with a priority badge (e.g., red "Critical" or orange "High"), an assignee avatar, and an effort number. Optionally show the blue "Dept Only" badge on one card.]

**Switching boards:**
Use the project dropdown at the top to switch between project boards and department boards. Archived projects are accessible via the small archive icon next to the dropdown.

**Moving tasks:**
Drag a card from one column to another to update its status. If a task has unmet dependencies, dropping it into "In Progress" will show an alert listing the blocking tasks.

**Task dependencies:**
Inside a task modal, use the "Dependencies" section to declare that this task must wait for another to be complete before it can start.

**Dept Only toggle:**
Tasks with "Dept Only" enabled appear only on their department's board, not on the main project board. Use this for internal department work that the whole team doesn't need to see.

---

### 6.3 Time Tracking

[SCREENSHOT: Time Tracking page — show the main table of time entries with columns for Name, Check-In, Check-Out, Duration, and Approved status. Highlight one pending row in amber. Show the "Check In" and "Check Out" buttons at the top for the current user. If possible, show the quarter-hour rounded duration values in the Duration column.]

**For students:**
- Tap **Check In** when you arrive. The system records your time with a Pacific timezone timestamp.
- Tap **Check Out** when you leave.
- Durations are rounded to the nearest quarter hour for the audit trail.

**For coaches:**
- Pending approvals are highlighted in amber.
- Click **Approve** to confirm or **Reject** to flag an incorrect entry.
- Use **Add Class Time** to bulk-log a session for all present students at once.
- The audit log shows who approved each entry and when.

---

### 6.4 Scout Module

The Scout module has several sub-sections, each accessed by tabs inside the page.

[SCREENSHOT: Scout page — show the top tab bar with tabs: Events, Robots, Schedule Grid, Pit Display, and the active tab highlighted. Show at least one event listed with its name and date. If a current event is selected, show the Schedule Grid tab with rows of match numbers and scouted team numbers in the cells.]

#### Events Tab
Manage scouting events. Create an event (competition or scrimmage), enter a Nexus event key and/or TBA event key to enable live data.

#### Robots (Pit Scouting) Tab
Search all scouted robots. Shows specs, capabilities, and ratings. Use **Import from TBA** to pull in all teams registered for an event automatically.

[SCREENSHOT: Robot Dashboard — show the search bar at top, and a grid of robot cards below. Each card should show a team number, team name, robot photo (if scouted), and a row of capability badges (e.g., Can Climb, Auto Scorer). Highlight one card with the red team border for Team 10991.]

#### Schedule Grid
Shows all qualification matches for the selected event. Your assigned scouts can claim matches, and scouted team numbers appear in the cells. The "Scouts on Duty" row at the top counts how many scouts are active per match.

[SCREENSHOT: Schedule Grid — show the top "Scouts on duty" count row, then several match rows below with team numbers filled in. Show at least one cell with an off/break diagonal stripe pattern. Show column headers with match numbers.]

#### Pit Display (Coach / Competition Screen)
Designed for a 4K or large monitor. Shows two sub-tabs:

- **Live:** Two-column grid of upcoming matches (Nexus schedule) on the left, event schedule on the right. Match statuses update in real time.
- **Rankings:** Full TBA event standings with Team 10991 highlighted, plus a scouted robot leaderboard sorted by overall rating.

[SCREENSHOT: Pit Display — Live tab — show the two-column layout with the Nexus upcoming matches list on the left (showing team numbers, match labels, and status badges like "Queuing", "On Field", "Done") and the full schedule on the right. The screen should look large and clean, designed for 4K projection.]

#### Pit Map
Click the **Map** tab inside an event to see the interactive pit map pulled from FRC Nexus. Search by team number or team name — the map auto-scrolls and highlights the searched team in orange.

[SCREENSHOT: Pit Map tab — show the SVG pit map with numbered pit spots, and one pit highlighted in orange after a search. Show the search field at the top with a team number entered.]

#### Offline Scouting & QR Sync
If the venue has no internet:
1. Scout normally — entries queue in your browser's local storage.
2. When you're back online, entries auto-sync to the server.
3. To share data without internet, use **QR Code Export** — it compresses your scouting data into scannable chunks. Another device can import it using the built-in QR scanner.

[SCREENSHOT: QR Code export modal — show the QR code chunks displayed, a chunk counter (e.g., "Chunk 2 of 4"), and the Prev/Next navigation buttons. Include a note overlay if one is shown indicating the chunk size.]

---

### 6.5 Safety Certifications

[SCREENSHOT: Safety Certifications page — show the Certifications tab with a list of defined certifications (e.g., Drill Press Safety, Lathe Safety), each showing the number of certified members and a green "Certified" or grey "Not Certified" badge for the current user. Show a "Request Certification" button on one cert that the user doesn't hold.]

**Defining certifications (Coach/Captain only):**
Click **New Certification** → enter a name, description, and optionally a required pass score. Certs can then be required on specific tasks.

**Requiring a cert on a task:**
Inside a task modal, use the "Required Certification" dropdown in the right panel. Members without the cert cannot change the task's status to "In Progress."

**Request workflow:**
1. Member clicks "Request Certification" on the cert they want.
2. A Safety Trainer claims the request.
3. Trainer updates progress notes step by step.
4. Trainer marks Complete → cert is automatically granted to the member.

---

### 6.6 Calendar

[SCREENSHOT: Calendar page — show the month-view calendar grid with several colored event dots on dates. Show at least one Shop event (blue), one Competition event (red, with "Attending" indicator), and one Meeting event (amber). In the sidebar or below the calendar, show the legend or list view of upcoming events. Show the "Import from TBA" button at the top right if visible.]

**Event types and colors:**
| Type | Color | Use For |
|---|---|---|
| Shop | Blue | Regular build sessions |
| Competition | Red (attending) / Slate dashed (not attending) | FRC events |
| Meeting | Amber | Team or sub-team meetings |
| Volunteer | Green | Community volunteer events |
| Outreach | Violet | Outreach and STEM demos |
| Other | Slate | Miscellaneous |

**Adding events (Coach/Captain):**
Click any date on the calendar → fill in the event form. Enable "Repeats Weekly" for recurring shop sessions and set an end date.

**TBA Import:**
Click the TBA button at the top → a checklist of Team 10991's 2026 TBA events appears → select which ones to import → click Import. Duplicate events (same title + date) are skipped automatically.

**Competition Attending toggle:**
Click a competition event → Edit → toggle "Attending." Non-attending events show in slate with a dashed border and a "Not Attending" badge so the team knows you're not going.

---

### 6.7 Resources Hub

[SCREENSHOT: Resources page — show the search bar at top, category filter chips below it (All, Competition, Software, Vendor, Design, Training, Other), and a grid of resource cards. Each card should show a title, category badge, description, and a link icon. Show at least one pinned resource at the top with a pin icon highlighted.]

The Resources page is a curated library of FRC-relevant links maintained by the whole team.

**Adding a resource:** Any logged-in member can click **Add Resource** → fill in the title, URL, description, and category.

**Pinning (Coach/Captain):** Click the pin icon on a resource card to keep it at the top of the list for everyone. Use this for the most critical links — the team's GitHub, vendor accounts, your robot's CAD folder, etc.

**Editing/deleting:** Coaches, captains, or the original creator can edit or delete any resource.

**Suggested links to add first:**
- Team GitHub repository
- CAD/Onshape project link
- Chief Delphi team thread
- FRC Game Manual (current season)
- REV Robotics documentation
- WPILib documentation
- Team 10991 social media channels

---

### 6.8 Team Management

[SCREENSHOT: Team Management page — show the user list sorted by department, with department header rows (e.g., "Business", "Electrical", "Mechanical") separating groups of users. Show one user card expanded to show their role badges, department tags, and action buttons (Edit, Delete, Mute). Capture in a state where at least 5 users are visible.]

**Adding a new member:**
Click **New User** → enter a username, real name, temporary password, role(s), and department(s). The member logs in and should change their password immediately.

**Role assignment tips:**
- A student can be both "Team Member" and "Safety Trainer" if they are certified to run cert sessions.
- SCRUM Master role grants task management access — assign it to sprint leads.
- Department Head gives access to the department's filtered board.

**Muting a user:**
Coaches can mute a user to silence their ability to send notifications and post. This is a lightweight moderation tool — the user can still work normally. Unmute at any time.

---

### 6.9 Announcements

[SCREENSHOT: Home page — show the Announcements section with 2-3 posted announcements. One should be marked "Global" (shown with a globe or all-team indicator) and one "Department" scoped (showing which department). Show the author name and timestamp on each. Coaches/Captains: show the "New Announcement" compose button. Also show the toast notification that slides up from the bottom of the screen if one was recently posted.]

Announcements live on the Home page feed.

**Posting:**
1. Click **New Announcement**.
2. Choose scope: **Global** (everyone) or **Department** (select a specific department).
3. Type your message and submit.

**Real-time toast:** Every member currently in the app sees a dark notification slide up at the bottom of their screen for 6 seconds. They can tap "View →" to jump to the Home feed.

**Best uses:**
- Safety reminders before shop sessions
- Competition-day callouts ("Drivers meeting in 10 min at pit A4")
- Build milestone celebrations
- Schedule changes

---

## 7. Tips & Best Practices

**For coaches:**
- Set up all user accounts before the first meeting so students can log in immediately.
- Require the relevant safety certifications on every task that involves power tools. This enforces accountability automatically.
- Use the "Dept Only" task flag to keep internal department work off the main board — reduces noise.
- Archive projects at season end rather than deleting them — archived boards are accessible via the archive toggle on the Boards page.

**For students:**
- Check in every time you're working. Inconsistent time records affect the team's grant reporting.
- Keep task statuses current — a task that says "Not Started" when you've been working on it for a week misleads the whole team.
- Add progress notes inside tasks when you're blocked — describe what you tried, not just "it's not working."

**For competition:**
- Load the Pit Display on a dedicated tablet or laptop before you enter the event venue, so it's cached for offline use.
- Assign scouts before the event starts using the Schedule Grid — use the Scout claims system so everyone knows which matches they own.
- Export your scouting data via QR code to a backup device at lunch in case your primary device loses connection.

---

## 8. FAQ

**Q: I can't log in — what do I do?**  
A: Double-check your username (case-sensitive, no spaces). If you've forgotten your password, ask a coach to reset it via Team Management. The default password on new accounts is `changeme`.

**Q: My time entry shows the wrong check-in time.**  
A: Ask a coach to reject the incorrect entry and either re-add it manually via "Add Class Time" or have you check in again. All entries have a full audit trail so corrections are recorded.

**Q: A task is in "Blocked" — what does that mean?**  
A: It means the person working on it hit an obstacle they can't resolve alone. Check the task modal for a blockedReason note. If it has unmet dependencies (other tasks that must complete first), they show in the War Room under the task's project.

**Q: Can I use the Scout module without internet?**  
A: Yes. Match scouting forms save locally if the server is unreachable. Once you reconnect, they sync automatically. You'll see a banner indicating how many entries are queued.

**Q: How do I get a safety certification?**  
A: On the Safety Certifications page, find the cert you need and click "Request Certification." A Safety Trainer will claim your request, walk you through the requirements, and grant it upon completion.

**Q: The Pit Display map isn't loading.**  
A: The pit map loads from Nexus and requires the event's Nexus key to be set. Ask your coach to check the event settings. Each error state has a "Try Again" button — try that first if the map loaded before.

**Q: Why can't I see a task on the project board?**  
A: It may be marked "Dept Only," meaning it only shows on its department's board. Dept-only tasks show a blue "Dept Only" badge. Ask the task creator or a coach/captain if it needs to be made visible on the project board.

**Q: How do I add our competition to the calendar?**  
A: Coaches can click the TBA button on the Calendar page → select events from a checklist of Team 10991's registered 2026 TBA events → click Import. The system skips duplicates automatically.

---

*PIO-BYTES Hub — FRC Team 10991 · Built for the 2026 season*  
*For technical issues, contact your team's software lead or coach.*
