import React from 'react';
import { Wrench, Trophy, CalendarDays, Users, Megaphone, Flag } from 'lucide-react';
import { HOUR_CATEGORIES, HOUR_CATEGORY_LABELS, type HourCategory } from '../shared/hourCategories';

// Shared badge styling for the six hour categories, so an event looks the same
// on the calendar as the time clocked against it does on the Time page.

export interface CategoryStyle {
  bg: string;
  text: string;
  border?: string;
  dot: string;
  icon: React.ReactNode;
  label: string;
}

export const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  shop:        { bg: 'bg-blue-100 dark:bg-blue-900/40',     text: 'text-blue-700 dark:text-blue-300',     dot: 'bg-blue-500',   icon: <Wrench size={10} />,       label: HOUR_CATEGORY_LABELS.shop },
  competition: { bg: 'bg-red-100 dark:bg-red-900/40',       text: 'text-red-700 dark:text-red-300',       dot: 'bg-red-500',    icon: <Trophy size={10} />,       label: HOUR_CATEGORY_LABELS.competition },
  meeting:     { bg: 'bg-amber-100 dark:bg-amber-900/40',   text: 'text-amber-700 dark:text-amber-300',   dot: 'bg-amber-500',  icon: <CalendarDays size={10} />, label: HOUR_CATEGORY_LABELS.meeting },
  volunteer:   { bg: 'bg-green-100 dark:bg-green-900/40',   text: 'text-green-700 dark:text-green-300',   dot: 'bg-green-500',  icon: <Users size={10} />,        label: HOUR_CATEGORY_LABELS.volunteer },
  outreach:    { bg: 'bg-violet-100 dark:bg-violet-900/40', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500', icon: <Megaphone size={10} />,    label: HOUR_CATEGORY_LABELS.outreach },
  other:       { bg: 'bg-slate-100 dark:bg-slate-700/60',   text: 'text-slate-600 dark:text-slate-300',   dot: 'bg-slate-400',  icon: <Flag size={10} />,         label: HOUR_CATEGORY_LABELS.other },
};

export const styleFor = (category?: string | null): CategoryStyle =>
  CATEGORY_STYLES[category || 'shop'] || CATEGORY_STYLES.other;

/** Small pill used wherever a time entry or event needs its category shown. */
export const CategoryBadge: React.FC<{ category?: string | null; className?: string }> = ({ category, className = '' }) => {
  const s = styleFor(category);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wide ${s.bg} ${s.text} ${className}`}>
      {s.icon} {s.label}
    </span>
  );
};

export { HOUR_CATEGORIES, HOUR_CATEGORY_LABELS };
export type { HourCategory };
