import express from "express";
import cors from "cors";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { storage } from "./storage";
import { pool } from "./db.js";

import usersRouter from "./routes/users";
import projectsRouter from "./routes/projects";
import tasksRouter from "./routes/tasks";
import notificationsRouter from "./routes/notifications";
import timeRouter from "./routes/time";
import scoutRouter from "./routes/scout";
import competitionRouter from "./routes/competition";
import alertsRouter from "./routes/alerts";
import safetyRouter from "./routes/safety";
import calendarRouter from "./routes/calendar";
import resourcesRouter from "./routes/resources";
import settingsRouter from "./routes/settings";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Ensures the PostgreSQL schema exists before the server accepts traffic.
 * On a fresh remix the database has no tables at all — this detects that
 * (error code 42P01) and runs `drizzle-kit push` to create them, then seeds
 * the demo accounts so the login screen works immediately.
 */
async function initializeDatabase() {
  let needsPush = false;

  try {
    await pool.query("SELECT 1 FROM team_settings LIMIT 1");
    console.log("✅  Database schema verified.");
  } catch (err: any) {
    if (err.code === "42P01") {
      needsPush = true;
    } else {
      console.error("Database connection error:", err.message);
      process.exit(1);
    }
  }

  if (needsPush) {
    console.log("⏳  Fresh database detected — pushing schema …");
    const result = spawnSync(
      "npx",
      ["drizzle-kit", "push", "--force"],
      { stdio: "inherit", shell: true }
    );
    if (result.status !== 0) {
      console.error("Schema push failed. Exiting.");
      process.exit(1);
    }
    console.log("✅  Schema push complete.");
  }

  // Auto-seed demo accounts if the users table is empty
  try {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS n FROM users");
    if (rows[0].n === 0) {
      console.log("🌱  Seeding demo accounts …");
      await storage.seedDatabase();
      console.log("✅  Demo accounts ready (password: changeme).");
    }
  } catch (e) {
    console.warn("Auto-seed skipped:", e);
  }
}

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const isProduction = process.env.NODE_ENV === "production";

// Dynamic manifest.json — always served before static files so it reflects current team settings
app.get("/manifest.json", async (req, res) => {
  try {
    const settings = await storage.getTeamSettings();
    const name = (settings.teamName as string) || 'PioByte Hub';
    const color = (settings.themeColor as string) || '#dc2626';
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-cache');
    res.json({
      name,
      short_name: name,
      description: `FRC Team ${settings.teamNumber} Project Management & Scouting`,
      start_url: "/",
      display: "standalone",
      background_color: "#0f172a",
      theme_color: color,
      orientation: "any",
      icons: [
        { src: "/api/settings/pwa-icon.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        { src: "/api/settings/pwa-icon.svg", sizes: "any", type: "image/svg+xml" },
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
    });
  } catch {
    res.status(500).json({ error: "Failed to generate manifest" });
  }
});

if (isProduction) {
  app.use('/sw.js', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    next();
  });
  app.use(express.static(path.join(__dirname, "../dist")));
}

app.use("/api", usersRouter);
app.use("/api", projectsRouter);
app.use("/api", tasksRouter);
app.use("/api", notificationsRouter);
app.use("/api", timeRouter);
app.use("/api", scoutRouter);
app.use("/api", competitionRouter);
app.use("/api", alertsRouter);
app.use("/api", safetyRouter);
app.use("/api", calendarRouter);
app.use("/api", resourcesRouter);
app.use("/api", settingsRouter);

if (isProduction) {
  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

const PORT = isProduction ? 5000 : 3001;

// Initialize DB before accepting any traffic
initializeDatabase().then(() => {
  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on port ${PORT}`);
    try {
      await storage.migrateCalendarTypes();
    } catch (e) {
      console.warn("Calendar type migration skipped:", e);
    }
    try {
      await storage.backfillNexusEventKeys();
    } catch (e) {
      console.warn("Nexus key backfill skipped:", e);
    }
    try {
      const allUsers = await storage.getUsers();
      if (allUsers.length > 0) {
        const coachOrCaptain = allUsers.find(u => (u.roles as string[]).some(r => ['Coach', 'Team Captain'].includes(r)));
        if (coachOrCaptain) {
          await storage.seedCalendarEvents(coachOrCaptain.id);
          await storage.seedResources(coachOrCaptain.id);
        }
      }
    } catch (e) {
      console.warn("Seed skipped:", e);
    }
  });
}).catch((err) => {
  console.error("Fatal: database initialization failed:", err);
  process.exit(1);
});
