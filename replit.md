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
│   ├── Dashboard.tsx       # War Room dashboard view
│   ├── Home.tsx            # Home/feed view
│   ├── KanbanBoard.tsx     # Kanban board for task management
│   ├── Layout.tsx          # App layout wrapper
│   ├── TaskModal.tsx       # Task detail/edit modal
│   └── TeamManagement.tsx  # Team member management
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

## Recent Changes (December 2024)
- Migrated from Firebase to Replit PostgreSQL database
- Removed AI/Gemini features
- Created Express API backend
- Added Drizzle ORM for database operations
- Updated frontend to use REST API instead of Firebase real-time sync
