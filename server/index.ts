import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { storage } from "./storage";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.use(express.static(path.join(__dirname, "../dist")));
}

app.get("/api/users", async (req, res) => {
  try {
    const users = await storage.getUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const existingUser = await storage.getUserByUsername(req.body.username?.toLowerCase());
    if (existingUser) {
      return res.status(400).json({ error: "Username already taken" });
    }
    const user = await storage.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

app.put("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (req.body.username) {
      const existingUser = await storage.getUserByUsername(req.body.username.toLowerCase());
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }
    const user = await storage.updateUser(id, req.body);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete("/api/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await storage.getUserByUsername(username.toLowerCase());
    if (user && user.password === password) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});

app.get("/api/projects", async (req, res) => {
  try {
    const projects = await storage.getProjects();
    res.json(projects);
  } catch (error) {
    console.error("Error fetching projects:", error);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const project = await storage.createProject(req.body);
    res.status(201).json(project);
  } catch (error) {
    console.error("Error creating project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.put("/api/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const project = await storage.updateProject(id, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

app.delete("/api/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteProject(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

app.get("/api/tasks", async (req, res) => {
  try {
    const tasks = await storage.getTasks();
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

app.post("/api/tasks", async (req, res) => {
  try {
    const task = await storage.createTask(req.body);
    res.status(201).json(task);
  } catch (error) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const task = await storage.updateTask(id, req.body);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteTask(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

app.get("/api/notifications", async (req, res) => {
  try {
    const notifications = await storage.getNotifications();
    res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

app.post("/api/notifications", async (req, res) => {
  try {
    const notification = await storage.createNotification(req.body);
    res.status(201).json(notification);
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({ error: "Failed to create notification" });
  }
});

app.put("/api/notifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const notification = await storage.updateNotification(id, req.body);
    if (!notification) return res.status(404).json({ error: "Notification not found" });
    res.json(notification);
  } catch (error) {
    console.error("Error updating notification:", error);
    res.status(500).json({ error: "Failed to update notification" });
  }
});

app.delete("/api/notifications/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteNotification(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ error: "Failed to delete notification" });
  }
});

app.get("/api/announcements", async (req, res) => {
  try {
    const announcements = await storage.getAnnouncements();
    res.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

app.post("/api/announcements", async (req, res) => {
  try {
    const announcement = await storage.createAnnouncement(req.body);
    res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({ error: "Failed to create announcement" });
  }
});

app.put("/api/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const announcement = await storage.updateAnnouncement(id, req.body);
    if (!announcement) return res.status(404).json({ error: "Announcement not found" });
    res.json(announcement);
  } catch (error) {
    console.error("Error updating announcement:", error);
    res.status(500).json({ error: "Failed to update announcement" });
  }
});

app.delete("/api/announcements/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteAnnouncement(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting announcement:", error);
    res.status(500).json({ error: "Failed to delete announcement" });
  }
});

app.post("/api/users/:id/change-password", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { currentPassword, newPassword } = req.body;
    
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (user.password !== currentPassword) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    
    const updated = await storage.updateUser(id, { password: newPassword });
    res.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

app.post("/api/seed", async (req, res) => {
  try {
    await storage.seedDatabase();
    res.json({ success: true, message: "Database seeded successfully" });
  } catch (error) {
    console.error("Error seeding database:", error);
    res.status(500).json({ error: "Failed to seed database" });
  }
});

if (isProduction) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

const PORT = isProduction ? 5000 : 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
