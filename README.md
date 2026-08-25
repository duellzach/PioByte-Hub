# PioByte Hub

FRC (FIRST Robotics Competition) team management hub — tasks, scouting, scheduling, and team management.

Stack: React 19 + Vite + Tailwind (front end) · Express 5 + Drizzle ORM + PostgreSQL (back end).

## Run Locally

**Prerequisites:** Node.js, a PostgreSQL database

1. Install dependencies:
   `npm install`
2. Set `DATABASE_URL` (and, for production, `SESSION_SECRET` — see [REPLIT_SETUP.md](REPLIT_SETUP.md) for the full list of env vars).
3. Run the app:
   `npm run dev`

See [REPLIT_SETUP.md](REPLIT_SETUP.md) for full deploy/setup details and [WELCOME_GUIDE.md](WELCOME_GUIDE.md) for a tour of the app.

## License

Copyright FRC 10991 Piobyte (2026). Licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md) — free to use, modify, and share for noncommercial purposes; commercial use requires permission from FRC 10991 Piobyte.
