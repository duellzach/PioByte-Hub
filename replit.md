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

## Recent Changes (January 2025)
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
