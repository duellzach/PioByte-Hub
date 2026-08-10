// The single source of truth for hour categories. Calendar event types, time
// clock `kind` values, and requirement configs all draw from this list so the
// three can never drift apart.

export const HOUR_CATEGORIES = ['shop', 'competition', 'meeting', 'volunteer', 'outreach', 'other', 'class', 'fundraising'] as const;

export type HourCategory = typeof HOUR_CATEGORIES[number];

export const HOUR_CATEGORY_LABELS: Record<HourCategory, string> = {
  shop: 'Shop',
  competition: 'Competition',
  meeting: 'Meeting',
  volunteer: 'Volunteer',
  outreach: 'Outreach',
  other: 'Other',
  class: 'Class',
  fundraising: 'Fundraising',
};

// Every category except shop is clocked against a calendar event; shop time is
// the default "I'm here working" state and has no event attached.
export const EVENT_HOUR_CATEGORIES = HOUR_CATEGORIES.filter((c) => c !== 'shop');

// Categories whose check-in flow prompts the member to pick the task they're
// working on, same as a plain shop check-in — currently shop itself and Class
// (a class period is treated like shop time with an event attached).
export const TASK_LINKED_CATEGORIES: readonly HourCategory[] = ['shop', 'class'];

export const isHourCategory = (value: unknown): value is HourCategory =>
  typeof value === 'string' && (HOUR_CATEGORIES as readonly string[]).includes(value);
