import type { Request, Response } from "express";
import { storage } from "../storage";

/**
 * Public privacy policy at /privacy — Meta requires one (App settings → Basic →
 * Privacy policy URL) before a coach can connect the team's Facebook Page and
 * Instagram account. Server-rendered plain HTML so it loads without the SPA or
 * a session. The data-deletion section doubles as Meta's "User data deletion"
 * instructions URL (/privacy#data-deletion).
 *
 * PRIVACY_CONTACT_EMAIL sets the contact address; without it the page points
 * people to the team's coaches.
 */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const EFFECTIVE_DATE = "October 1, 2026";

export async function privacyPolicy(_req: Request, res: Response) {
  let teamName = "our robotics team";
  let appName = "PioByte Hub";
  try {
    const s = await storage.getTeamSettings();
    const num = s.teamNumber ? ` (Team ${s.teamNumber})` : "";
    if (s.teamName) teamName = `${s.teamName}${num}`;
  } catch { /* render with defaults */ }
  const email = process.env.PRIVACY_CONTACT_EMAIL;
  const contact = email
    ? `<a href="mailto:${esc(email)}">${esc(email)}</a>`
    : "one of the team's coaches";

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy · ${esc(appName)}</title>
<style>
  :root { color-scheme: light dark; --fg: #0f172a; --muted: #475569; --bg: #ffffff; --accent: #dc2626; }
  @media (prefers-color-scheme: dark) { :root { --fg: #e2e8f0; --muted: #94a3b8; --bg: #0f172a; } }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 720px; margin: 0 auto; padding: 40px 20px 64px; }
  h1 { font-size: 1.9rem; margin: 0 0 4px; }
  h2 { font-size: 1.15rem; margin: 32px 0 8px; }
  p, li { color: var(--fg); }
  .muted { color: var(--muted); font-size: .9rem; }
  a { color: var(--accent); }
  ul { padding-left: 1.25rem; }
</style>
</head>
<body>
<main>
<h1>Privacy Policy</h1>
<p class="muted">${esc(appName)} · ${esc(teamName)} · Effective ${EFFECTIVE_DATE}</p>

<p>${esc(appName)} is the private team-management app used by ${esc(teamName)}. Team members, mentors and coaches use it for projects and tasks, time tracking, scouting, certifications, the team calendar, and managing the team's social media. Only people with a team account can sign in. This policy explains what the app stores and how it's used.</p>

<h2>Information we collect</h2>
<ul>
  <li><strong>Account information:</strong> name, username, team roles and departments, and a securely hashed password. Coaches create accounts for team members.</li>
  <li><strong>Team activity:</strong> tasks, comments, time check-ins and hours, event sign-ups, certifications and badges, fundraising entries, and scouting data about competition robots.</li>
  <li><strong>Notifications:</strong> if you turn on device notifications, your browser's push subscription details.</li>
  <li><strong>Social media posts:</strong> captions, photos and videos that team members upload when drafting a post for the team's Instagram or Facebook, plus each post's review history (who submitted, approved, or requested changes).</li>
</ul>

<h2>Facebook and Instagram</h2>
<p>A coach can connect the team's Facebook Page and its linked Instagram professional account. When they do, Meta gives the app an access token for those team accounts only. We use it to:</p>
<ul>
  <li>publish posts that a coach has approved, at the scheduled time;</li>
  <li>read back each published post's link so the team can see it went out.</li>
</ul>
<p>The token is stored encrypted on our server and is never shown in the app. We do not read anyone's personal Facebook or Instagram profile, friends, or messages. We do not use data from Meta for advertising, and we do not sell or share it.</p>

<h2>How we use information</h2>
<p>Only to run the team: organizing work, recording hours, tracking training, planning events, and sharing approved team news on social media. Photos of team members are posted only after a coach approves the post and in line with the team's media-release requirements.</p>

<h2>Sharing</h2>
<p>We don't sell personal information. Information leaves the app only:</p>
<ul>
  <li>when an approved post is published to the team's Facebook Page or Instagram account;</li>
  <li>with the services that host and run the app (for example, our hosting provider and its storage), which process it on our behalf.</li>
</ul>

<h2>Students</h2>
<p>Many team members are high-school students. Their accounts are created and managed by the team's coaches, and anything posted to the team's public social media must be approved by a coach first.</p>

<h2>Security</h2>
<p>Access requires a team login. Passwords are hashed, social media tokens are encrypted, and uploaded media is only reachable through short-lived signed links.</p>

<h2 id="data-deletion">Data retention and deletion</h2>
<p>We keep team information while you're part of the team and for team records afterward. To have your account or your data deleted, contact ${contact}. We'll remove it, except where the team needs to keep a record (for example, logged volunteer hours).</p>
<p>To remove the app's access to the team's Facebook and Instagram accounts, a coach can click <strong>Disconnect</strong> on the app's Social → Accounts page, or remove "${esc(appName)}" under Business Integrations in Facebook's settings. Posts already published remain on Facebook or Instagram until they're deleted there.</p>

<h2>Changes</h2>
<p>If we change this policy, we'll update this page and the effective date above.</p>

<h2>Contact</h2>
<p>Questions about this policy or your data: contact ${contact}.</p>
</main>
</body>
</html>`);
}
