import React from 'react';
import {
  Award, Medal, Trophy, Star, Crown, Sparkles,
  ShieldCheck, HardHat, Wrench, Hammer, Cog, Ruler,
  Zap, Cpu, CircuitBoard, Code2, Rocket, Flame,
  Target, Heart, BookOpen, Users, Megaphone, FlaskConical,
} from 'lucide-react';
import { BADGE_ICON_KEYS, BADGE_COLORS, NEUTRAL_BADGE_COLOR } from '../shared/badgeIcons';
import { levelBadgeLabel } from '../shared/certifications';
import type { Badge, BadgeDefinition } from '../types';

/**
 * Icon key -> component. A hardcoded map, matching `linkIcon()` in
 * components/ProjectLinks.tsx and CATEGORY_STYLES in
 * components/hourCategoryStyles.tsx. Deliberately NOT a dynamic import:
 * lucide-react is statically imported and manually chunked in vite.config.ts,
 * and a dynamic lookup would defeat that.
 */
const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  award: Award, medal: Medal, trophy: Trophy, star: Star, crown: Crown,
  sparkles: Sparkles, shield: ShieldCheck, hardHat: HardHat, wrench: Wrench,
  hammer: Hammer, cog: Cog, ruler: Ruler, zap: Zap, cpu: Cpu,
  circuit: CircuitBoard, code: Code2, rocket: Rocket, flame: Flame,
  target: Target, heart: Heart, book: BookOpen, users: Users,
  megaphone: Megaphone, flask: FlaskConical,
};

export function badgeIcon(key: string, size = 14): React.ReactNode {
  const Icon = ICONS[key] ?? Award;
  return <Icon size={size} />;
}

export { BADGE_ICON_KEYS, BADGE_COLORS };

/** A badge resolved into everything needed to render it. */
export interface ResolvedBadge {
  id: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  kind: 'level' | 'custom';
  earnedAt: string;
  automatic: boolean;
}

/**
 * Resolve a stored badge for display.
 *
 * A LEVEL badge has no definition row — its label comes from the department
 * and level, and its color from that department's color in team settings. That
 * means renaming or recoloring a department automatically restyles its badges,
 * with nothing to keep in sync.
 *
 * A CUSTOM badge reads its name, icon and color from its definition.
 */
export function resolveBadge(
  badge: Badge,
  definitions: BadgeDefinition[],
  departments: { name: string; color: string }[],
): ResolvedBadge | null {
  if (badge.kind === 'level') {
    const department = badge.department ?? null;
    const color = department
      ? (departments.find(d => d.name === department)?.color ?? NEUTRAL_BADGE_COLOR)
      : NEUTRAL_BADGE_COLOR;
    return {
      id: badge.id,
      name: levelBadgeLabel(department, badge.level ?? 1),
      description: `Earned by completing every ${department ?? 'General'} Level ${badge.level ?? 1} certification.`,
      icon: 'shield',
      color,
      kind: 'level',
      earnedAt: badge.earnedAt,
      automatic: badge.awardedBy == null,
    };
  }
  const definition = definitions.find(d => d.id === badge.badgeDefinitionId);
  if (!definition) return null; // definition deleted outright; nothing to draw
  return {
    id: badge.id,
    name: definition.name,
    description: definition.description,
    icon: definition.icon,
    color: definition.color,
    kind: 'custom',
    earnedAt: badge.earnedAt,
    automatic: false,
  };
}

interface BadgeChipProps {
  badge: Pick<ResolvedBadge, 'name' | 'description' | 'icon' | 'color'>;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}

/**
 * One badge chip. Colors are inline hex, never Tailwind classes — see the note
 * in shared/badgeIcons.ts about the build-time purge.
 */
export const BadgeChip: React.FC<BadgeChipProps> = ({ badge, size = 'sm', onRemove }) => (
  <span
    title={badge.description || badge.name}
    className={`inline-flex items-center gap-1.5 rounded-lg md:rounded-xl font-black uppercase tracking-tighter border ${
      size === 'sm' ? 'px-2 md:px-3 py-1 md:py-1.5 text-[8px] md:text-[10px]' : 'px-3 py-1.5 text-[10px]'
    }`}
    style={{
      backgroundColor: badge.color + '18',
      color: badge.color,
      borderColor: badge.color + '50',
    }}
  >
    {badgeIcon(badge.icon, size === 'sm' ? 11 : 14)}
    <span className="truncate max-w-[10rem]">{badge.name}</span>
    {onRemove && (
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
        title="Revoke badge"
      >
        ×
      </button>
    )}
  </span>
);

interface BadgeIconPickerProps {
  value: string;
  onChange: (key: string) => void;
  color: string;
}

export const BadgeIconPicker: React.FC<BadgeIconPickerProps> = ({ value, onChange, color }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {BADGE_ICON_KEYS.map(key => (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        title={key}
        className={`aspect-square flex items-center justify-center rounded-lg border-2 transition-all ${
          value === key
            ? 'border-current'
            : 'border-slate-100 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
        }`}
        style={value === key ? { color, backgroundColor: color + '18' } : undefined}
      >
        {badgeIcon(key, 15)}
      </button>
    ))}
  </div>
);

interface BadgeColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export const BadgeColorPicker: React.FC<BadgeColorPickerProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-8 gap-1.5">
    {BADGE_COLORS.map(color => (
      <button
        key={color}
        type="button"
        onClick={() => onChange(color)}
        title={color}
        className={`aspect-square rounded-lg border-2 transition-all ${
          value === color ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'
        }`}
        style={{ backgroundColor: color }}
      />
    ))}
  </div>
);
