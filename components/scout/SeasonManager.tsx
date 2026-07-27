import React, { useState, useEffect } from 'react';
import { X, Plus, Star, Pencil, Trash2, Settings2, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../services/api';
import TemplateBuilder from './TemplateBuilder';
import type { ScoutKind } from '../../shared/scoutingTemplates';

interface Props {
  onClose: () => void;
  onChanged?: () => void; // parent refetch (events reference seasons)
}

interface SeasonRow {
  id: number;
  name: string;
  gameName: string;
  year: number | null;
  active: boolean;
}

const SeasonManager: React.FC<Props> = ({ onClose, onChanged }) => {
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<SeasonRow> | null>(null); // create/edit form
  const [builder, setBuilder] = useState<{ seasonId: number; seasonName: string; kind: ScoutKind } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setSeasons(await api.seasons.getAll());
    } catch {
      setError('Failed to load seasons');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const saveSeason = async () => {
    if (!editing || !editing.name?.trim()) return;
    setError(null);
    try {
      if (editing.id) {
        await api.seasons.update(editing.id, { name: editing.name, gameName: editing.gameName, year: editing.year });
      } else {
        await api.seasons.create({ name: editing.name.trim(), gameName: editing.gameName, year: editing.year, active: seasons.length === 0 });
      }
      setEditing(null);
      await load();
      onChanged?.();
    } catch (e: any) {
      setError(e?.message || 'Failed to save season');
    }
  };

  const setActive = async (id: number) => {
    try {
      await api.seasons.update(id, { active: true });
      await load();
      onChanged?.();
    } catch (e: any) { setError(e?.message || 'Failed to set active season'); }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this season? This is blocked if any events are assigned to it.')) return;
    setError(null);
    try {
      await api.seasons.delete(id);
      await load();
      onChanged?.();
    } catch (e: any) { setError(e?.message || 'Cannot delete season'); }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[115] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl border-t-8 border-slate-900">
        <div className="sticky top-0 bg-white dark:bg-slate-800 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Scouting Seasons</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">Define games & customize templates</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="animate-spin" /></div>
          ) : (
            <>
              {seasons.map(s => (
                <div key={s.id} className="rounded-xl border-2 border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-700/40 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">{s.name}</h3>
                        {s.active && (
                          <span className="flex items-center gap-1 text-[9px] font-black text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-700">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                        {s.gameName || 'No game name'}{s.year ? ` · ${s.year}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {!s.active && (
                        <button onClick={() => setActive(s.id)} title="Set active" className="p-2 text-slate-400 hover:text-green-600"><Star size={16} /></button>
                      )}
                      <button onClick={() => setEditing(s)} title="Edit" className="p-2 text-slate-400 hover:text-teamColor"><Pencil size={16} /></button>
                      <button onClick={() => remove(s.id)} title="Delete" className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => setBuilder({ seasonId: s.id, seasonName: s.name, kind: 'pit' })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-teamColor hover:text-white transition-all">
                      <Settings2 size={13} /> Pit Template
                    </button>
                    <button onClick={() => setBuilder({ seasonId: s.id, seasonName: s.name, kind: 'match' })}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-teamColor hover:text-white transition-all">
                      <Settings2 size={13} /> Match Template
                    </button>
                  </div>
                </div>
              ))}

              {editing ? (
                <div className="rounded-xl border-2 border-teamColor/40 bg-teamColor/5 p-4 space-y-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-teamColor">{editing.id ? 'Edit Season' : 'New Season'}</p>
                  <input autoFocus value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Season name (e.g. 2027 — REBUILT)"
                    className="w-full p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg outline-none focus:border-teamColor font-bold text-sm dark:text-white" />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={editing.gameName || ''} onChange={(e) => setEditing({ ...editing, gameName: e.target.value })}
                      placeholder="Game name"
                      className="p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg outline-none focus:border-teamColor font-bold text-sm dark:text-white" />
                    <input type="number" value={editing.year ?? ''} onChange={(e) => setEditing({ ...editing, year: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="Year"
                      className="p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg outline-none focus:border-teamColor font-bold text-sm dark:text-white" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditing(null)} className="flex-1 py-2 text-slate-400 font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
                    <button onClick={saveSeason} disabled={!editing.name?.trim()} className="flex-1 py-2 bg-teamColor text-white font-black uppercase tracking-widest text-[10px] rounded-lg hover:opacity-90 disabled:opacity-50">Save</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditing({ name: '', gameName: '', year: new Date().getFullYear() })}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 hover:border-teamColor hover:text-teamColor font-black text-xs uppercase tracking-widest transition-all">
                  <Plus size={16} /> New Season
                </button>
              )}

              {error && <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </div>
      </div>

      {builder && (
        <TemplateBuilder
          seasonId={builder.seasonId}
          seasonName={builder.seasonName}
          kind={builder.kind}
          onClose={() => setBuilder(null)}
        />
      )}
    </div>
  );
};

export default SeasonManager;
