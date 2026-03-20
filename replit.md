# PIO-BYTES Hub - FRC Team 10991 Project Management

## Overview
PIO-BYTES Hub is a comprehensive web-based task management and project tracking system designed for FRC Team 10991. Its primary purpose is to streamline project workflows, manage team members, facilitate communication, and provide specialized tools for FRC-specific activities like scouting and time tracking. The system aims to enhance operational efficiency, improve data-driven decision-making, and centralize all team-related project information. Key capabilities include robust project and task management, detailed FRC scouting with AI analysis integrations, and an auditable time tracking system.

## User Preferences
I prefer iterative development, with clear communication before major architectural or feature changes. I also prefer detailed explanations of new features and their impact. I value clean, readable code and well-structured database schemas. For UI/UX, I lean towards functional, intuitive designs with clear navigation.

## System Architecture

### Frontend
The application utilizes Vite and React 19 with TypeScript for the frontend, running on port 5000. It employs `react-router-dom` with `HashRouter` for navigation and `Tailwind CSS` (PostCSS build, v3 + `tailwindcss-animate`) for styling, complemented by `Lucide React` for icons. The UI/UX prioritizes a dark mode toggle for user preference and a responsive design adapting to various screen sizes.

**Performance optimizations (Task #26)**:
- All 9 page routes are **code-split** via `React.lazy` + `Suspense` — heavy pages (Scout 4400 lines, TimeTracking, SafetyCertifications, etc.) only load when first navigated to.
- **Vite manual chunk splitting**: vendor-react, vendor-charts, vendor-icons, vendor-qr chunks let browsers cache third-party libraries independently.
- **Tailwind CSS compiled at build time** via PostCSS (`tailwind.config.cjs`, `postcss.config.cjs`); CDN runtime removed — eliminates the production console warning and reduces client-side work.
- **Visibility-aware polling**: both the 15s global data poll and 10s alert poll pause automatically when the browser tab is hidden and resume on focus.
- **Error boundary** (`components/ErrorBoundary.tsx`) wraps all route content — a crash in one page shows a recovery UI instead of a blank screen.
- **Express `compression` middleware** on server/index.ts — all API responses are gzip compressed.

### Backend
The backend is an Express API running on port 3001, interacting with a PostgreSQL database provided by Replit. Drizzle ORM is used for database operations, ensuring a type-safe and efficient data layer.

### Key Technical Implementations and Features
- **Safety Certification System (Backend)**: Three new DB tables (`safety_certifications`, `user_certifications`, `certification_requests`), a `Safety Trainer` role, and `requiredCertificationId` FK on tasks. Full REST API: CRUD for certifications, grant/revoke user certifications, certification request workflow (create → claim → progress → complete/reject with auto-grant), and trainer filtering. Client API methods in `services/api.ts`.
- **Project & Task Management**: Kanban boards, task assignment, status tracking, priority setting, department-based filtering, and a "War Room" dashboard. Task creation is role-restricted, and success criteria are interactive and trackable.
- **Time Tracking System**: Features check-in/check-out, coach approval workflows, quarter-hour rounding, a full audit trail, and bulk class time addition.
- **FRC Scout Module**:
    - **Data Collection**: Pit scouting (robot specs, capabilities, ratings), match scouting (fuel scoring, alliance tracking, climb levels), and event management.
    - **Data Sharing**: QR code generation (pako compression, chunked for large datasets) and import via camera scanner with dynamic `html5-qrcode`. Offline scouting is supported via localStorage queue with auto-sync.
    - **Analysis & Display**: Robot dashboard with search, detailed views including cross-event match data, Pit Display with two sub-tabs (Live: 2-column 4K-optimized grid with Nexus upcoming matches + event schedule; Rankings: full TBA event standings with team 10991 highlighted + scouted robot leaderboard).
    - **External Integrations**: Blue Alliance API for live win/loss records, event schedules, upcoming matches, and auto-import of team data.
    - **AI Integration**: "Copy for AI" function generates comprehensive scouting reports for external AI analysis tools like ChatGPT, Gemini, or Claude.
    - **Scout Workflow**: Match claiming system for scouts, unscouted match/robot tracking with quick-entry buttons.
- **User Management**: Role-based access control (Coach, Captain, Scrum Master, Department Head, Team Member), user muting capabilities for coaches, and department assignments.
- **Task Board Visibility (deptOnly)**: A `deptOnly` boolean field on tasks controls which boards they appear on. `deptOnly: false` (default) = appears on both the project Kanban board and departmental boards. `deptOnly: true` = hidden from project boards, only visible on the relevant departmental board. Toggle is exposed in TaskModal's "Board Visibility" section (two-button selector). New tasks created while on a dept board default to `deptOnly: true`; tasks created on a project board default to `deptOnly: false`. TaskCard shows a blue "Dept Only" badge when set.
- **Task Dependency Chain**: Tasks can declare dependencies on other tasks in the same project. Status change to "In Progress" (both via modal select and drag-and-drop in KanbanBoard) is blocked if unmet dependencies exist, with an alert listing the blocking tasks. TaskCard shows a "Waiting on deps" badge + grey border when blocked by unmet deps. Dep picker in TaskModal right panel allows searching/toggling dep tasks with status chips and remove buttons.
- **War Room Enhancements**: Blocked tasks section now renders separately with a red ring and pulsing dot, hidden when empty. Task names use `line-clamp-2` (not truncated). Blocked cards show `blockedReason` in italic.
- **Announcement Toast**: When a coach/captain posts an announcement, a dark toast notification slides up from the bottom of the screen for 6 seconds, showing scope and message text.
- **Team Sort by Department**: Team Management page now sorts users alphabetically by primary department first, then by name within each department.
- **Calendar Page** (`/calendar`): Month-view calendar and list view backed by `calendar_events` DB table. Coaches/Captains can add, edit, and delete events via a modal form. Six event types: Shop (blue), Competition (red/attending or slate/not-attending with dashed border), Meeting (amber), Volunteer (green), Outreach (violet), Other (slate). Old "practice" type migrated to "shop". **Recurring events**: weekly recurrence with "Ends On" date; client-side expansion of virtual instances; per-instance popover with "Edit this", "Delete this", "Delete all" actions; `deletedDates` JSON column tracks skipped dates; exception rows stored with `parentEventId`+`instanceDate`. **Competition attending toggle**: `attending` boolean (default true); non-attending competitions show slate/dashed style + "Not Attending" badge everywhere. **TBA import**: Coach/Captain header button fetches team 10991's 2026 TBA events, shows checklist modal, imports selected as competition events (skips duplicates by title+startDate). Schema additions: `recurrenceType`, `recurrenceEndsOn`, `parentEventId`, `instanceDate`, `deletedDates`, `attending`. New API routes: `PATCH /api/calendar/:id/deleted-dates`, `GET /api/calendar/tba-preview`, `POST /api/calendar/tba-import`. Seeded with 7 events on first run.
- **Resources Page** (`/resources`): Fully DB-backed (`resources` table: id, title, url, description, category, addedBy FK, pinned bool, createdAt) searchable and filterable hub of FRC-relevant external links. Categories: Competition, Software, Vendor, Design, Training, Other. Any logged-in user can add resources; coaches/captains or the original creator can edit/delete. Coaches/captains can toggle pinned status. Pinned resources appear at top. Seeded with 18 curated FRC links on first startup. Full REST API: `GET/POST /api/resources`, `PUT/DELETE /api/resources/:id`. Client methods in `api.resources.*`.
- **General Features**: Real-time notifications, dark mode toggle, PWA support with service worker caching, and client-side image compression for photo uploads.

## External Dependencies
- **PostgreSQL**: Replit's built-in database.
- **Blue Alliance API**: Used for fetching FRC event data, team information, rankings, and match schedules.
- **Tailwind CSS** (PostCSS build, v3): Compiled at build time; config in `tailwind.config.cjs` + `postcss.config.cjs`; `tailwindcss-animate` plugin for enter/exit animations; `index.css` is the entry stylesheet.
- **Lucide React**: For icons.
- **`react-router-dom`**: For client-side routing.
- **`pako`**: For data compression, specifically for QR code generation.
- **`html5-qrcode`**: For QR code scanning capabilities.
- **ChatGPT, Google Gemini, Claude**: Integrated as external AI tools for strategic analysis via generated text reports.