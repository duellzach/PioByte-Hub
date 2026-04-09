import { Router } from "express";
import { storage } from "../storage";

const router = Router();

router.get("/users", async (req, res) => {
  try {
    const users = await storage.getUsers();
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

router.post("/users", async (req, res) => {
  try {
    const normalizedUsername = req.body.username?.toLowerCase().trim();
    const existingUser = await storage.getUserByUsername(normalizedUsername);
    if (existingUser) {
      return res.status(400).json({ error: "Username already taken" });
    }
    const userData = {
      ...req.body,
      username: normalizedUsername,
      password: req.body.password || 'password'
    };
    const user = await storage.createUser(userData);
    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Failed to create user" });
  }
});

router.put("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updateData = { ...req.body };
    if (updateData.username) {
      updateData.username = updateData.username.toLowerCase().trim();
      const existingUser = await storage.getUserByUsername(updateData.username);
      if (existingUser && existingUser.id !== id) {
        return res.status(400).json({ error: "Username already taken" });
      }
    }
    const user = await storage.updateUser(id, updateData);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

router.delete("/users/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteUser(id);
    res.status(204).send();
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = username.toLowerCase().trim();
    const user = await storage.getUserByUsername(normalizedUsername);
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

router.post("/guest-login", async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) return res.status(400).json({ error: "PIN is required" });
    const token = await storage.getGuestTokenByPin(String(pin).trim());
    if (!token) return res.status(404).json({ error: "Invalid or expired PIN" });
    res.json({ eventId: token.eventId, eventName: token.eventName, pin: token.pin, label: token.label });
  } catch (error) {
    console.error("Error with guest login:", error);
    res.status(500).json({ error: "Failed to process guest login" });
  }
});

router.post("/users/:id/change-password", async (req, res) => {
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
    await storage.updateUser(id, { password: newPassword });
    res.json({ success: true });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;
