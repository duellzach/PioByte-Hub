import { Router } from "express";
import { PNG } from "pngjs";
import { storage } from "../storage";
import { getUserRoles, hasAnyRole, COACH_CAPTAIN } from "../helpers";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function fillRect(png: PNG, x0: number, y0: number, w: number, h: number, r: number, g: number, b: number, a = 255) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * png.width + x) * 4;
      png.data[i] = r;
      png.data[i + 1] = g;
      png.data[i + 2] = b;
      png.data[i + 3] = a;
    }
  }
}

function compositeCenter(dst: PNG, src: PNG, targetX: number, targetY: number, targetW: number, targetH: number) {
  for (let dy = 0; dy < targetH; dy++) {
    for (let dx = 0; dx < targetW; dx++) {
      const sx = Math.round(dx * src.width / targetW);
      const sy = Math.round(dy * src.height / targetH);
      const si = (Math.min(sy, src.height - 1) * src.width + Math.min(sx, src.width - 1)) * 4;
      const di = ((targetY + dy) * dst.width + (targetX + dx)) * 4;
      const srcA = src.data[si + 3] / 255;
      if (srcA > 0) {
        dst.data[di]     = Math.round(src.data[si]     * srcA + dst.data[di]     * (1 - srcA));
        dst.data[di + 1] = Math.round(src.data[si + 1] * srcA + dst.data[di + 1] * (1 - srcA));
        dst.data[di + 2] = Math.round(src.data[si + 2] * srcA + dst.data[di + 2] * (1 - srcA));
        dst.data[di + 3] = 255;
      }
    }
  }
}

const router = Router();

const DEFAULT_DEPARTMENTS = [
  { name: 'Mechanical', color: '#f97316' },
  { name: 'Software', color: '#3b82f6' },
  { name: 'Modeling', color: '#8b5cf6' },
  { name: 'Logistics', color: '#22c55e' },
  { name: 'Electrical', color: '#eab308' },
  { name: 'Business', color: '#14b8a6' },
  { name: 'Leadership', color: '#ef4444' },
];

const DEFAULT_ROLES = [
  { name: 'Coach', tier: 'leadership' },
  { name: 'Team Captain', tier: 'leadership' },
  { name: 'SCRUM Master', tier: 'leadership' },
  { name: 'Department Head', tier: 'lead' },
  { name: 'Safety Trainer', tier: 'lead' },
  { name: 'Team Member', tier: 'member' },
  { name: 'Class Member', tier: 'member' },
];

router.get("/settings", async (req, res) => {
  try {
    const settings = await storage.getTeamSettings();
    res.json(settings);
  } catch (error) {
    console.error("Error fetching team settings:", error);
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

router.put("/settings", async (req, res) => {
  try {
    const { requesterId, ...data } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can modify team settings" });
    }
    const settings = await storage.upsertTeamSettings(data);
    res.json(settings);
  } catch (error) {
    console.error("Error updating team settings:", error);
    res.status(500).json({ error: "Failed to update settings" });
  }
});

router.post("/settings/reset", async (req, res) => {
  try {
    const { requesterId } = req.body;
    if (!requesterId) return res.status(400).json({ error: "requesterId is required" });
    const actorRoles = await getUserRoles(parseInt(requesterId));
    if (!hasAnyRole(actorRoles, COACH_CAPTAIN)) {
      return res.status(403).json({ error: "Only Coaches or Captains can reset team settings" });
    }
    const settings = await storage.upsertTeamSettings({
      teamNumber: 10991,
      teamName: 'piobyte',
      themeColor: '#dc2626',
      logoUrl: null,
      teamProgram: 'FRC',
      departments: DEFAULT_DEPARTMENTS,
      roles: DEFAULT_ROLES,
    });
    res.json(settings);
  } catch (error) {
    console.error("Error resetting team settings:", error);
    res.status(500).json({ error: "Failed to reset settings" });
  }
});

router.get("/settings/pwa-icon.png", async (req, res) => {
  try {
    const settings = await storage.getTeamSettings();
    const themeHex = (settings.themeColor as string) || '#dc2626';
    const logoUrl  = settings.logoUrl as string | null;
    const teamNum  = (settings.teamNumber as number) || 10991;
    const SIZE = 512;
    const c = hexToRgb(themeHex);

    const dst = new PNG({ width: SIZE, height: SIZE, filterType: -1 });
    // Initialise buffer to theme color
    fillRect(dst, 0, 0, SIZE, SIZE, c.r, c.g, c.b);

    if (logoUrl) {
      // White inset (the "border" effect)
      fillRect(dst, 36, 36, SIZE - 72, SIZE - 72, 255, 255, 255);
      // Decode stored base64 logo and composite centred
      const base64 = logoUrl.replace(/^data:image\/\w+;base64,/, '');
      const logoBuf = Buffer.from(base64, 'base64');
      const logoPng = PNG.sync.read(logoBuf);
      compositeCenter(dst, logoPng, 64, 64, SIZE - 128, SIZE - 128);
    } else {
      // No logo: just the solid colour background (iOS masks to rounded square)
      // Optionally write team number as simple pixel text — skip for now, solid colour is clean
      void teamNum;
    }

    const out = PNG.sync.write(dst);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(out);
  } catch (error) {
    console.error("Error generating PWA PNG icon:", error);
    res.redirect('/icon-192.png');
  }
});

router.get("/settings/pwa-icon.svg", async (req, res) => {
  try {
    const settings = await storage.getTeamSettings();
    const color = (settings.themeColor as string) || '#dc2626';
    const logo = settings.logoUrl as string | null;
    const teamNumber = (settings.teamNumber as number) || 10991;

    let innerContent: string;
    if (logo) {
      // Logo image centered inside a white padded inset (border = theme color background)
      innerContent = `
  <rect x="36" y="36" width="440" height="440" rx="56" fill="white"/>
  <image x="64" y="64" width="384" height="384" href="${logo}" preserveAspectRatio="xMidYMid meet" clip-path="url(#imgClip)"/>`;
    } else {
      // Fallback: team number text on colored background
      innerContent = `
  <text x="256" y="310" font-family="Arial Black, Arial" font-size="200" font-weight="900" fill="white" text-anchor="middle">${teamNumber}</text>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <clipPath id="imgClip">
      <rect x="64" y="64" width="384" height="384" rx="44"/>
    </clipPath>
  </defs>
  <rect width="512" height="512" rx="80" fill="${color}"/>
  ${innerContent}
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(svg);
  } catch (error) {
    console.error("Error generating PWA icon:", error);
    res.status(500).send('Error generating icon');
  }
});

router.get("/settings/tba-logo", async (req, res) => {
  try {
    const teamNum = req.query.team as string;
    if (!teamNum) return res.status(400).json({ error: "team query param required" });

    const apiKey = process.env.TBA_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "TBA_API_KEY not configured" });

    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1, currentYear + 1];

    for (const year of years) {
      const url = `https://www.thebluealliance.com/api/v3/team/frc${teamNum}/media/${year}`;
      const response = await fetch(url, {
        headers: { "X-TBA-Auth-Key": apiKey },
      });
      if (!response.ok) continue;
      const media: any[] = await response.json();
      const match = media.find((m: any) =>
        ['avatar', 'logo'].includes(m.type) && m.details?.base64Image
      );
      if (match) {
        return res.json({ logoUrl: `data:image/png;base64,${match.details.base64Image}` });
      }
    }

    res.json({ logoUrl: null });
  } catch (error) {
    console.error("Error fetching TBA logo:", error);
    res.status(500).json({ error: "Failed to fetch TBA logo" });
  }
});

router.get("/settings/api-status", (_req, res) => {
  res.json({
    tba: !!process.env.TBA_API_KEY,
    toa: !!process.env.TOA_API_KEY,
    nexus: !!process.env.NEXUS_API_KEY,
  });
});

export default router;
