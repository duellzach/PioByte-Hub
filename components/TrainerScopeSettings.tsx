import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Check, AlertTriangle } from 'lucide-react';
import { api } from '../services/api';
import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { LEVELS } from '../shared/certifications';
import type { User } from '../types';

interface TrainerScopeSettingsProps {
  users: User[];
}

/** "None" is a level-0 sentinel meaning "no scope row for this department". */
const NO_SCOPE = 0;

/**
 * Assign training authority by department and level.
 *
 * A trainer scoped to Manufacturing at level 1 can claim and sign off only
 * Manufacturing Level 1 requests. This replaces the old implicit rule (holding
 * the certification plus carrying the role), so a member with no scope rows
 * cannot train anything — Coaches excepted, since they bypass scopes entirely.
 */
const TrainerScopeSettings: React.FC<TrainerScopeSettingsProps> = ({ users }) => {
  const { settings } = useTeamSettings();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [scopes, setScopes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [allScopes, setAllScopes] = useState<any[]>([]);

  // General is a track of its own, keyed by '' so it round-trips as null.
  const tracks = useMemo(
    () => ['', ...settings.departments.map(d => d.name)],
    [settings.departments],
  );

  const loadAll = async () => {
    try {
      setAllScopes(await api.trainerScopes.getAll());
    } catch {
      setAllScopes([]);
    }
  };

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!selectedUserId) { setScopes({}); return; }
    setLoading(true);
    setSaved(false);
    setError('');
    api.trainerScopes.getForUser(parseInt(selectedUserId))
      .then(rows => {
        const next: Record<string, number> = {};
        for (const row of rows) next[row.department ?? ''] = row.maxLevel;
        setScopes(next);
      })
      .catch(() => setScopes({}))
      .finally(() => setLoading(false));
  }, [selectedUserId]);

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const payload = Object.entries(scopes)
        .filter(([, level]) => level !== NO_SCOPE)
        .map(([department, maxLevel]) => ({
          department: department === '' ? null : department,
          maxLevel,
        }));
      await api.trainerScopes.setForUser(parseInt(selectedUserId), payload);
      setSaved(true);
      await loadAll();
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      setError(e.message || 'Failed to save training scopes.');
    } finally {
      setSaving(false);
    }
  };

  /** Who currently trains what, so a coach can see coverage at a glance. */
  const coverage = useMemo(() => {
    const byUser: Record<number, { name: string; parts: string[] }> = {};
    for (const scope of allScopes) {
      const entry = (byUser[scope.userId] ||= { name: scope.userName, parts: [] });
      entry.parts.push(`${scope.department ?? 'General'} L${scope.maxLevel}`);
    }
    return Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name));
  }, [allScopes]);

  const activeUsers = users.filter(u => !u.archived);

  return (
    <div className="space-y-5">
      {coverage.length === 0 ? (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
          <AlertTriangle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
            Nobody is assigned as a trainer yet. Until someone is scoped, only Coaches can sign off certification requests.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Current Trainers</p>
          {coverage.map(entry => (
            <div key={entry.name} className="flex items-start gap-2 text-[11px]">
              <span className="font-black text-slate-700 dark:text-slate-200 w-32 flex-shrink-0 truncate">{entry.name}</span>
              <span className="text-slate-500 dark:text-slate-400 font-medium">{entry.parts.join(' · ')}</span>
            </div>
          ))}
        </div>
      )}

      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
          Assign scopes to
        </label>
        <select
          value={selectedUserId}
          onChange={e => setSelectedUserId(e.target.value)}
          className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-bold dark:text-white transition-all"
        >
          <option value="">Select a member...</option>
          {activeUsers.map(u => (
            <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>
          ))}
        </select>
      </div>

      {selectedUserId && (
        loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {tracks.map(track => {
                const label = track === '' ? 'General' : track;
                const color = track === ''
                  ? '#475569'
                  : (settings.departments.find(d => d.name === track)?.color || settings.themeColor);
                const current = scopes[track] ?? NO_SCOPE;
                return (
                  <div key={track || '__general'} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                    <span
                      className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border flex-shrink-0 w-28 text-center truncate"
                      style={{ backgroundColor: color + '18', color, borderColor: color + '50' }}
                    >
                      {label}
                    </span>
                    <div className="flex gap-1 flex-1">
                      <button
                        onClick={() => setScopes({ ...scopes, [track]: NO_SCOPE })}
                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                          current === NO_SCOPE
                            ? 'bg-slate-900 dark:bg-slate-500 text-white'
                            : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                        }`}
                      >
                        None
                      </button>
                      {LEVELS.map(level => (
                        <button
                          key={level}
                          onClick={() => setScopes({ ...scopes, [track]: level })}
                          title={`Can train levels 1 through ${level}`}
                          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                            current === level
                              ? 'text-white'
                              : 'bg-white dark:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                          }`}
                          style={current === level ? { backgroundColor: color } : undefined}
                        >
                          Up to L{level}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-2.5 bg-teamColor text-white font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving
                ? <><Loader2 size={12} className="animate-spin" /> Saving...</>
                : saved
                  ? <><Check size={12} /> Saved</>
                  : 'Save Training Scopes'}
            </button>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium leading-relaxed">
              "Up to L2" means this member can sign off Level 1 and Level 2 certifications in that department — nothing higher, and nothing in other departments. Coaches can sign off everything without a scope.
            </p>
          </>
        )
      )}
    </div>
  );
};

export default TrainerScopeSettings;
