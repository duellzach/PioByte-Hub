import React from 'react';
import { Github, FileText, Box, Link2 } from 'lucide-react';
import { Attachment } from '../types';

/** The link kinds a board overview can hold, with display metadata. */
export const LINK_TYPES: { value: Attachment['type']; label: string }[] = [
  { value: 'doc', label: 'Doc / Slides' },
  { value: 'github', label: 'GitHub' },
  { value: 'cad', label: 'CAD (Fusion 360)' },
  { value: 'other', label: 'Other' },
];

export function linkIcon(type: string, size = 14) {
  switch (type) {
    case 'github': return <Github size={size} />;
    case 'cad': return <Box size={size} />;
    case 'doc': return <FileText size={size} />;
    default: return <Link2 size={size} />;
  }
}

/**
 * Ensure a user-entered URL is absolute so `<a href>` doesn't resolve it
 * relative to the app. Mirrors the normalization in components/Resources.tsx.
 */
export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

interface ProjectLinkChipProps {
  link: Attachment;
  compact?: boolean;
}

/** A single external-resource chip; opens in a new tab, safe rel attrs. */
export const ProjectLinkChip: React.FC<ProjectLinkChipProps> = ({ link, compact }) => (
  <a
    href={normalizeUrl(link.url)}
    target="_blank"
    rel="noopener noreferrer"
    onClick={(e) => e.stopPropagation()}
    title={link.label || link.url}
    className={`inline-flex items-center gap-1.5 rounded-lg border-2 border-slate-100 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:border-teamColor hover:text-teamColor transition-all font-bold ${
      compact ? 'p-1.5' : 'px-3 py-1.5 text-xs'
    }`}
  >
    {linkIcon(link.type, compact ? 14 : 14)}
    {!compact && <span className="truncate max-w-[12rem]">{link.label || link.url}</span>}
  </a>
);
