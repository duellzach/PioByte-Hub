import { Router } from "express";
import { vapidPublicKey, saveSubscription, removeSubscription, pushConfigured } from "../push";

const router = Router();

// The client needs the VAPID public key to create a subscription.
router.get("/push/vapid-public-key", (_req, res) => {
  res.json({ publicKey: vapidPublicKey(), enabled: pushConfigured });
});

router.post("/push/subscribe", async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: "Authentication required" });
    const sub = req.body?.subscription ?? req.body;
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return res.status(400).json({ error: "Invalid push subscription" });
    }
    await saveSubscription(req.userId, sub);
    res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    res.status(500).json({ error: "Failed to save push subscription" });
  }
});

router.post("/push/unsubscribe", async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: "endpoint is required" });
    await removeSubscription(endpoint);
    res.json({ ok: true });
  } catch (error) {
    console.error("Error removing push subscription:", error);
    res.status(500).json({ error: "Failed to remove push subscription" });
  }
});

export default router;
