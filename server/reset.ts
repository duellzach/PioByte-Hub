/**
 * db:reset — wipes all user data and re-seeds demo accounts.
 * Run with:  npm run db:reset
 *
 * Safe to run on a fresh remix so the new owner starts with a clean slate
 * that has working login credentials but no team-specific data.
 */

import { pool, db } from './db.js';
import * as schema from '../shared/schema.js';
import { sql } from 'drizzle-orm';

async function reset() {
  console.log('⏳  Wiping all data …');

  await db.transaction(async (tx) => {
    // Leaf tables first, then parents.
    // TRUNCATE … CASCADE handles most FKs, but explicit order avoids issues
    // with tables that only have ON DELETE RESTRICT.
    await tx.execute(sql`TRUNCATE TABLE
      match_exceptions,
      team_claims,
      competition_checkin_audit,
      competition_checkins,
      guest_tokens,
      event_info,
      competition_assignments,
      match_scouts,
      pit_scouts,
      scout_events,
      fullscreen_alerts,
      calendar_events,
      resources,
      user_badges,
      badge_definitions,
      trainer_scopes,
      certification_requests,
      user_certifications,
      safety_certifications,
      general_tasks,
      time_entry_audit,
      time_entries,
      notifications,
      announcements,
      tasks,
      projects,
      users
    RESTART IDENTITY CASCADE`);

    // Reset team settings to a clean generic default (remove logo + team-specific values)
    await tx.execute(sql`
      UPDATE team_settings SET
        team_number  = 0,
        team_name    = 'My FRC Team',
        theme_color  = '#dc2626',
        logo_url     = NULL,
        departments  = ${JSON.stringify([
          { name: 'Mechanical',  color: '#f97316' },
          { name: 'Software',    color: '#3b82f6' },
          { name: 'Modeling',    color: '#8b5cf6' },
          { name: 'Logistics',   color: '#22c55e' },
          { name: 'Electrical',  color: '#eab308' },
          { name: 'Business',    color: '#14b8a6' },
          { name: 'Leadership',  color: '#ef4444' },
        ])}::jsonb,
        roles = ${JSON.stringify([
          { name: 'Coach',           tier: 'leadership' },
          { name: 'Team Captain',    tier: 'leadership' },
          { name: 'SCRUM Master',    tier: 'leadership' },
          { name: 'Department Head', tier: 'lead'       },
          { name: 'Trainer',         tier: 'lead'       },
          { name: 'Team Member',     tier: 'member'     },
          { name: 'Class Member',    tier: 'member'     },
        ])}::jsonb,
        updated_at = NOW()
    `);
  });

  console.log('✅  All tables cleared.');

  // Seed demo accounts — every password is "changeme"
  console.log('🌱  Seeding demo accounts …');

  const demoUsers = [
    { username: 'coach_mentor',   password: 'changeme', name: 'Coach Mentor',    roles: ['Coach'],                              departments: ['Leadership', 'Business']     },
    { username: 'team_captain',   password: 'changeme', name: 'Team Captain',    roles: ['Team Captain', 'SCRUM Master'],       departments: ['Software', 'Leadership']      },
    { username: 'mech_lead',      password: 'changeme', name: 'Mechanical Lead', roles: ['Department Head'],                    departments: ['Mechanical']                  },
    { username: 'sw_lead',        password: 'changeme', name: 'Software Lead',   roles: ['Department Head'],                    departments: ['Software']                    },
    { username: 'elec_lead',      password: 'changeme', name: 'Electrical Lead', roles: ['Department Head'],                    departments: ['Electrical']                  },
    { username: 'trainer',        password: 'changeme', name: 'Sam Trainer',     roles: ['Trainer'],                            departments: ['Mechanical', 'Electrical']    },
    { username: 'member1',        password: 'changeme', name: 'Team Member',     roles: ['Team Member'],                        departments: ['Software']                    },
  ];

  const inserted = await db.insert(schema.users).values(demoUsers).returning();
  const coachId = inserted[0].id;

  // One starter project so the Boards page isn't empty
  await db.insert(schema.projects).values({
    name: 'Competition Robot',
    description: 'Main build-season project.',
    archived: false,
  });

  // A few starter resources
  const starterResources = [
    { title: 'The Blue Alliance',       url: 'https://thebluealliance.com',          description: 'FRC event data, match results, team info',  category: 'FRC Resources', addedBy: coachId },
    { title: 'FRC Game Manual',         url: 'https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system', description: 'Official game and robot rules', category: 'FRC Resources', addedBy: coachId },
    { title: 'Chief Delphi',            url: 'https://www.chiefdelphi.com',          description: 'FRC community forum',                        category: 'FRC Resources', addedBy: coachId },
    { title: 'FIRST Robotics',          url: 'https://www.firstinspires.org/robotics/frc', description: 'Official FIRST FRC program page',        category: 'FRC Resources', addedBy: coachId },
    { title: 'WPILib Documentation',    url: 'https://docs.wpilib.org',              description: 'Robot programming library docs',             category: 'Programming',   addedBy: coachId },
  ];
  await db.insert(schema.resources).values(starterResources);

  console.log('✅  Done! Demo accounts ready:');
  console.log('');
  console.log('   Username          Role');
  console.log('   ─────────────────────────────────');
  for (const u of demoUsers) {
    console.log(`   ${u.username.padEnd(17)} ${u.roles[0]}`);
  }
  console.log('');
  // Passwords are intentionally NOT logged — stdout is often captured by log
  // aggregators. All seeded accounts share the documented dev password.
  console.log('   All demo accounts use the standard seed password (see server/reset.ts).');
  console.log('   ⚠️  Change all passwords after your first login.');
}

reset()
  .catch((err) => { console.error('Reset failed:', err); process.exit(1); })
  .finally(() => pool.end());
