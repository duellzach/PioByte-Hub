# PIO-BYTES Hub - FRC Team 10991 Project Management

## Overview
A task management and project tracking system for FRC (FIRST Robotics Competition) Team 10991 PIO-BYTES. The application allows managing projects, tasks, team members, and communications through a web interface.

## Architecture

### Frontend (Vite + React)
- **Port**: 5000
- **Framework**: React 19 with TypeScript
- **Routing**: react-router-dom with HashRouter
- **Styling**: Tailwind CSS (via CDN)
- **Icons**: Lucide React

### Backend (Express API)
- **Port**: 3001
- **Database**: PostgreSQL (Replit built-in)
- **ORM**: Drizzle ORM

### Project Structure
```
├── App.tsx                 # Main application component
├── types.ts                # TypeScript type definitions
├── constants.tsx           # App constants (colors, statuses, etc.)
├── index.tsx               # Application entry point
├── index.html              # HTML template
├── components/
│   ├── BoardSettingsModal.tsx  # Board settings configuration
│   ├── Dashboard.tsx       # War Room dashboard view
│   ├── Home.tsx            # Home/feed view
│   ├── KanbanBoard.tsx     # Kanban board for task management
│   ├── Layout.tsx          # App layout wrapper
│   ├── Scout.tsx           # FRC scouting module (pit/match/QR)
│   ├── TaskModal.tsx       # Task detail/edit modal
│   ├── TeamManagement.tsx  # Team member management
│   └── TimeTracking.tsx    # Time clock & hours tracking
├── services/
│   └── api.ts              # Frontend API client
├── server/
│   ├── index.ts            # Express API server
│   ├── db.ts               # Database connection
│   └── storage.ts          # Database operations
├── shared/
│   └── schema.ts           # Drizzle database schema
├── vite.config.ts          # Vite configuration
├── drizzle.config.ts       # Drizzle ORM configuration
└── package.json            # Dependencies and scripts
```

## Running the Application

```bash
npm run dev         # Start both frontend and backend
npm run server      # Start only backend API
npm run client      # Start only frontend
npm run db:push     # Push schema changes to database
```

## Default Login Credentials
After seeding the database:
- **Username**: captain | **Password**: password
- **Username**: coach | **Password**: password  
- **Username**: mech_lead | **Password**: password

## Key Features
- Project and task management with Kanban boards
- Team member management with roles and departments
- Real-time notifications and announcements
- Task assignment, status tracking, and priority setting
- Department-based filtering
- "War Room" dashboard for operational overview
- **Time Tracking System**:
  - Check-in/check-out for team members
  - Coach approval workflow (pending_check_in → checked_in → pending_check_out → completed)
  - Quarter-hour rounding (rounds UP to nearest 15 minutes)
  - Full audit trail for all time entry changes
  - Coaches can edit times and view audit logs
  - Team hours displayed on login screen
  - Coaches can view/edit time history in user profiles (Team page)
  - Bulk add class time for multiple members at once

- **FRC Scout Module**:
  - Tournament event management (create, edit, delete events)
  - Pit scouting with robot specs, drivetrain, capabilities/deficiencies tags, ratings (offense/defense/overall 1-10)
  - Match scouting with fuel scoring (Rebuilt theme), counter inputs (+/- buttons), alliance tracking (Red/Blue), climb levels
  - Robot dashboard showing all scouted robots with search, detail views, match history
  - QR code data sharing for offline environments (pako compression, chunked QR codes for large datasets)
  - Selective match export — choose which matches to include in QR codes
  - QR import via camera scanner (html5-qrcode dynamic import) with chunk collection and preview
  - Pit Display tab — compact W/L record, event schedule with clickable team links, robot leaderboard
  - Robot detail view includes performance analysis (fuel accuracy, climb rate, defense stats, etc.)
  - Blue Alliance API integration — live win/loss record, event schedule, upcoming matches on Pit Display
  - TBA event key field on scout events links to thebluealliance.com data
  - Auto-import teams from TBA — pulls team names, numbers, and locations into pit scout entries for editing
  - Event creation restricted to Coach and TeamCaptain roles
  - Database: scout_events, pit_scouts, match_scouts tables
  - 14 REST API endpoints including bulk import/export
  - Self-contained component with internal state management (no routing for sub-views)

## Recent Changes (March 2026 — Session 2)
- **Match Claiming System**:
  - Scouts can claim upcoming TBA matches to indicate who's scouting what
  - Claimed matches stored in localStorage under `piobyte_claims` (persists offline)
  - Claim/Unclaim buttons in Matches tab; shows who has claimed each match
  - "Scout" button quick-fills the match number in the recording form

- **Unscouted Matches Section**:
  - Matches tab shows unscouted teams with TBA video links (YouTube + TBA page links)
  - Identifies which teams in each match haven't been scouted yet
  - "Record" button quick-fills match number for fast entry from video footage

- **AI Match Analysis (Gemini Export)**:
  - "AI" button on each upcoming match in Pit Display generates a detailed scouting report
  - Report includes all 6 teams' pit data, match history averages, TBA rankings
  - Full-screen modal with copy-to-clipboard and download-as-text options
  - Designed to paste into Google Gemini or ChatGPT for strategic match analysis

- **Enhanced Match Form**:
  - Match Type selector (Practice / Qualification / Elimination)
  - Separate Auto Fuel and Tele-Op Fuel counters with +1, +5, +10 quick-add buttons
  - "Auto Used" dropdown auto-populates from the team's scouted auto options
  - Driving Skill Rating and FIRST Core Values Rating (star selectors)
  - Match list shows all new fields: type badge, auto/teleop split, driving/CV ratings

- **Enhanced Pit Scout Form**:
  - Fuel Capacity numeric input
  - Shooter Type selector (Turret / Launcher / None)
  - Field Traversal selector (Over Bump / Under Trench / Both / Neither)
  - Auto Options tag input — list all autonomous routines the robot can run

- **Robot Detail View Enhancements**:
  - Shows new fields: Shooter Type, Fuel Capacity, Field Traversal, Auto Routines
  - TBA Season Events section — fetches all events for the current year, shows location, dates, rank, and W-L-T record from TBA live data
  - Prior event cards link directly to TBA for full event details
  - Current event highlighted in red

## Recent Changes (March 2026)
- **Dark Mode**:
  - Toggle in sidebar (Moon/Sun icon) switches between light and dark themes
  - Preference saved to localStorage and persists across reloads
  - Tailwind `class` strategy dark mode with global CSS overrides in index.css
- **Robot QR Export**:
  - "Select Robots" section added to QR Export alongside matches
  - QR payload v3 includes `r` array with abbreviated robot fields
  - Import side parses v3 robot data with duplicate detection by teamNumber
  - Backward compatible with v2 match-only imports
- **Robot Sorting**:
  - Toggle button in robots tab sorts by team number (#) or name (A-Z)
  - Match history in robot detail sorted by match number
- **Match Roster View**:
  - List/Roster toggle in matches tab
  - Roster groups matches by match number with Red vs Blue alliance columns
  - Clicking a robot in roster opens their detail view
- **Robot Photo Capture**:
  - Camera/file input in pit scout form captures robot photos
  - Images compressed client-side (max 800px, JPEG 0.7 quality)
  - Photos stored as base64 data URL in photoUrl field
  - Photos displayed on robot cards (thumbnail) and detail view (header)
  - Express JSON body limit increased to 10mb for photo uploads
- **PWA Support**:
  - Service worker caches app shell for offline access
  - Web manifest with floppy disc team logo icons (192/512px)
  - "Add to Home Screen" support for mobile/Chromebook
  - Offline match scouting via localStorage queue with auto-sync

## Recent Changes (February 2026)
- **Home Page Event Countdown**:
  - Upcoming scout events displayed on Home page with live countdown timers
  - Shows "HAPPENING NOW" with green pulse for active events
  - Real-time countdown updates every second
- **Match Scout Averaging**:
  - When multiple people scout the same robot in the same match, statistics are averaged
  - "AVG of N" badge shown in match history for averaged entries
- **TBA Rankings Leaderboard**:
  - Pit Display leaderboard now uses TBA ranking points for sort order when available
  - Shows official rank, W-L-T record, and RP values
  - Falls back to scout overall rating when no TBA data available

## Recent Changes (February 2025)
- **Backlog Status**:
  - New "Backlog" status added before "Not Started" for long-term brainstorming tasks
  - Purple color theme for Backlog items
  - Displays on both Kanban boards and War Room dashboard
- **Larger Comment Box**:
  - Comment input changed from single-line to multi-line textarea (4 rows)
  - Comment display area increased from max-h-64 to max-h-96
  - Enter to send, Shift+Enter for new line
- **Database Optimization**:
  - Data refresh interval increased from 5 to 15 seconds
  - Reduces PostgreSQL compute hours by ~67%
- **Success Criteria Enhancements**:
  - Success criteria upgraded from plain text to checkable items with completion tracking
  - Click the circle/checkbox to mark a criterion as complete or incomplete
  - Inline text editing — click on any criterion text to edit it directly
  - Completed items show green background with strikethrough text
  - Progress counter shows "X/Y completed" at the top of the section
  - Backward compatible — existing string-based criteria auto-migrate to the new format

## Recent Changes (January 2025)
- **Task Completion Celebration**:
  - Confetti animation plays when a task is marked as Complete
  - Colorful confetti falls from the top of the screen for 4 seconds
- **Task Creation Restrictions**:
  - Only Department Heads, Scrum Masters, Team Captains, and Coaches can create tasks
  - Regular team members can view and update tasks but cannot create new ones
- **Leadership Department**:
  - Added "Leadership" as a new department option
- **War Room Metrics Minimized**:
  - Compact inline stats bar replaces large metric cards
  - More screen space for task boards
- **Team Page Enhancements**:
  - Department and role filters added
  - Departments displayed on user cards
  - Done/Effort stats visible only to coaches
- **Mute Feature**:
  - Coaches can mute/unmute team members from the Team page
  - Muted users cannot post announcements or broadcast messages
  - Muted users cannot comment on announcements or tasks
  - Visual indicator (muted badge) shown on user cards
  - Coaches cannot be muted
- **Board Settings Feature**:
  - Boards can be assigned to departments for access control
  - Scrum Masters can be assigned to boards for ownership tracking
  - Assigned scrum masters automatically get the Scrum Master role
  - Scrum master names displayed on War Room project rows with badge
  - Boards can be hidden from War Room dashboard via toggle
  - Archive/restore toggle for boards
  - Coaches and captains can see all boards regardless of department
  - "Allow All Task Creation" toggle - when enabled, any team member can create tasks on that board
- **Task Assignment Improvements**:
  - "Authorized Units" filtered by selected sectors (departments)
  - Search box to filter users by username when assigning tasks
- Collapsible sidebar in Layout with smooth transitions
- Removed "Build 2025" badge from header

## Previous Changes (December 2024)
- Migrated from Firebase to Replit PostgreSQL database
- Removed AI/Gemini features
- Created Express API backend
- Added Drizzle ORM for database operations
- Updated frontend to use REST API instead of Firebase real-time sync
- Added time tracking with coach approval workflow and audit logging
- Responsive design for 4K, 1080p, and mobile screens
- User management: coaches can edit names/handles, users can change passwords
