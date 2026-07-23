// The single source of truth for hour categories. Calendar event types, time
// clock `kind` values, and requirement configs all draw from this list so the
// three can never drift apart.

export const HOUR_CATEGORIES = ['shop', 'competition', 'meeting', 'volunteer', 'outreach', 'other'] as const;

export type HourCategory = typeof HOUR_CATEGORIES[number];

export const HOUR_CATEGORY_LABELS: Record<HourCategory, string> = {
  shop: 'Shop',
  competition: 'Competition',
  meeting: 'Meeting',
  volunteer: 'Volunteer',
  outreach: 'Outreach',
  other: 'Other',
};

// Every category except shop is clocked against a calendar event; shop time is
// the default "I'm here working" state and has no event attached.
export const EVENT_HOUR_CATEGORIES = HOUR_CATEGORIES.filter((c) => c !== 'shop');

export const isHourCategory = (value: unknown): value is HourCategory =>
  typeof value === 'string' && (HOUR_CATEGORIES as readonly string[]).includes(value);
