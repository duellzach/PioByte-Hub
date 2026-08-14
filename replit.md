# PioByte Hub - FRC Team Project Management

## Overview
PioByte Hub is a web-based project management and tracking system designed for FRC teams. It aims to streamline workflows, manage team members, facilitate communication, and provide FRC-specific tools such as scouting and time tracking. The system is designed to be configurable for any FRC team via a Master Control Panel, enhancing operational efficiency and centralizing team-related project information. Key capabilities include robust project and task management, FRC scouting with AI analysis integrations, an auditable time tracking system, and full team identity customization.

## User Preferences
I prefer iterative development, with clear communication before major architectural or feature changes. I also prefer detailed explanations of new features and their impact. I value clean, readable code and well-structured database schemas. For UI/UX, I lean towards functional, intuitive designs with clear navigation.

## System Architecture

### Frontend
The frontend is built with Vite, React 19, and TypeScript, utilizing `react-router-dom` for navigation and Tailwind CSS for styling. It incorporates `Lucide React` for icons and prioritizes a responsive design with a dark mode toggle. Performance is optimized through code-splitting, manual chunk splitting, build-time CSS compilation, visibility-aware polling, and error boundaries. Dynamic PWA icons and manifest ensure a tailored user experience.

### Backend
The backend is an Express API that communicates with a PostgreSQL database using Drizzle ORM for type-safe data operations.

**The Drizzle config lives at `db/drizzle.config.ts`, not the repo root — don't move it back.** Replit's Publish step looks for a Drizzle project and, on finding one, runs its own `drizzle-kit push` against the *production* database; that push has repeatedly proposed dropping live data this repo's schema never asks to drop (`calendar_feed_tokens`, `time_entries.scout_event_id`, `event_signups.invited_by`/`invited_at`, `calendar_events.invite_only`). Keeping the config out of the conventional location prevents that detection. For the same reason `npm run db:push` is an intentional no-op — the real command is `npm run schema:push`, which passes `--config=db/drizzle.config.ts`.

**Schema changes are applied at boot, never by the post-merge hook.** `scripts/post-merge.sh` deliberately does *not* run `drizzle-kit push`: that hook runs against the live database after every GitHub sync, and `push` prompts to drop anything it thinks is missing (`You're about to delete <table> with N items`) — with `-- --force` it drops silently. Instead, `initializeDatabase()` in `server/index.ts` pushes only when the database is empty (error `42P01`), and existing databases are maintained by the idempotent `ensure*` chain that runs on every start (`ensureCalendarFeedTokens`, `ensureInviteOnlyEvents`, `ensureCompetitionUnification`, …), all using `IF NOT EXISTS`. To add a column, add an `ensure*` function.

### Core Features and Design Decisions
- **Multi-Team Configurability**: A Master Control Panel allows teams to customize identity (team number, name, logo), theme colors, departments, and roles.
- **Project & Task Management**: Includes Kanban boards, task assignment, status tracking, priority setting, department-based filtering, and a "War Room" dashboard. Tasks support dependencies and can be restricted to departmental visibility.
- **FRC Scout Module**: Supports pit and match data collection, QR code-based data sharing (with `pako` compression and `html5-qrcode` scanning), and offline capabilities. Provides a robot dashboard, detailed views, an interactive pit map, and AI integration for report generation. Features include a match claiming system and schedule grid enhancements to track scout availability. Guest PIN access allows read-only viewing of scouting data for alliance partners. CSV export (`GET /api/scout-events/:id/export.csv`) lets any user (including guests) download all pit and match scout data as a structured two-section CSV file.
- **Time Tracking System**: Features check-in/check-out, coach approval workflows, audit trails, and bulk class time additions.
- **Safety Certification System**: Manages certifications, user assignments, and a request workflow with a dedicated `Safety Trainer` role.
- **User Management**: Implements role-based access control (Coach, Captain, Scrum Master, Department Head, Team Member) and department assignments.
- **Calendar**: A month-view and list-view calendar allows coaches/captains to manage events with recurrence, event types, and competition attendance toggles. Supports importing events from The Blue Alliance.
- **Resources Page**: A searchable and filterable database of FRC-relevant external links.
- **Announcements**: Real-time toast notifications for coach/captain announcements.
- **Coach Onboarding Tutorial**: A dismissible 8-step tutorial for new Coach-role users.
- **General Features**: Real-time notifications, dark mode, PWA support with service worker caching, and client-side image compression.

## External Dependencies
- **PostgreSQL**: Replit's integrated database solution.
- **Blue Alliance API**: Used for FRC event data, team information, rankings, and match schedules.
- **Tailwind CSS**: For styling and animations, compiled at build time.
- **Lucide React**: For scalable vector icons.
- **`react-router-dom`**: For client-side routing.
- **`pako`**: For data compression, particularly for QR code generation.
- **`html5-qrcode`**: For QR code scanning.
- **ChatGPT, Google Gemini, Claude**: External AI tools for strategic analysis, integrated via generated text reports.