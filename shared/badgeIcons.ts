// The badge icon and color palettes.
//
// Split from the rendering (components/badgeStyles.tsx) so the server can
// validate a submitted icon key and color without importing JSX — the same
// split as shared/hourCategories.ts vs components/hourCategoryStyles.tsx.
//
// Colors are stored and rendered as hex, applied through an inline `style`
// attribute. They must NEVER become composed Tailwind classes: Tailwind is
// compiled at build time here against a fixed `content` glob, so a class like
// `bg-${color}-100` is purged and silently renders as nothing.

export const BADGE_ICON_KEYS = [
  'award', 'medal', 'trophy', 'star', 'crown', 'sparkles',
  'shield', 'hardHat', 'wrench', 'hammer', 'cog', 'ruler',
  'zap', 'cpu', 'circuit', 'code', 'rocket', 'flame',
  'target', 'heart', 'book', 'users', 'megaphone', 'flask',
] as const;

export type BadgeIconKey = typeof BADGE_ICON_KEYS[number];

export function isBadgeIconKey(value: string): boolean {
  return (BADGE_ICON_KEYS as readonly string[]).includes(value);
}

/** The palette offered in the picker. Any valid hex is accepted on save. */
export const BADGE_COLORS = [
  '#dc2626', '#ea580c', '#f59e0b', '#eab308',
  '#65a30d', '#16a34a', '#0d9488', '#0891b2',
  '#2563eb', '#4f46e5', '#7c3aed', '#c026d3',
  '#db2777', '#a16207', '#475569', '#0f172a',
] as const;

export function isBadgeColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

/** Fallback for a level badge with no department color, and for bad input. */
export const NEUTRAL_BADGE_COLOR = '#475569';
