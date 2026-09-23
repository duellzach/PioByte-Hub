import React, { useEffect, useState } from 'react';
import { Plus, Loader2, ArrowUp, ArrowDown, Archive, RotateCcw, Check, X, Edit3 } from 'lucide-react';
import { api } from '../services/api';

interface Props { isCoach: boolean; }

interface Item { id: number; label: string; description: string; sortOrder: number; archived: boolean; }

/**
 * Coach-defined membership checklist ("Register with FIRST", "Pay Club Dues",
 * "Sign Handbook Contract"). Items are ticked off per student from the Team
 * page's Progress view; students see their own ticks, read-only, on Home.
 */
const ChecklistSettings: React.FC<Props> = ({ isCoach }) => {
  const [items, setItems] = useState<Item[] | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [editing, setEditing] = useState<{ id: number; label: string; description: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    api.requirements.checklistItems(isCoach)
      .then(rows => setItems(rows))
      .catch(e => { setItems([]); setError(e?.message || 'Could not load checklist'); });

  useEffect(() => { load(); }, [isCoach]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try { await fn(); await load(); }
    catch (e: any) { setError(e?.message || 'Something went wrong'); }
    finally { setBusy(false); }
  };

  if (!items) return <div className="flex justify-center py-6 text-slate-400"><Loader2 className="animate-spin" size={20} /></div>;

  const active = items.filter(i => !i.archived);
  const archived = items.filter(i => i.archived);

  const move = (idx: number, dir: -1 | 1) => {
    const a = active[idx], b = active[idx + dir];
    if (!a || !b) return;
    run(async () => {
      // Swap positions; fall back to index when two items share a sortOrder.
      const aOrder = a.sortOrder === b.sortOrder ? idx : a.sortOrder;
      const bOrder = a.sortOrder === b.sortOrder ? idx + dir : b.sortOrder;
      await api.requirements.updateChecklistItem(a.id, { sortOrder: bOrder });
      await api.requirements.updateChecklistItem(b.id, { sortOrder: aOrder });
    });
  };

  const inputCls = 'w-full px-3 py-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-medium dark:text-white';

  return (
    <div className="space-y-3">
      {!isCoach && (
        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Only Coaches can change the checklist or tick items off.</p>
      )}
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}

      {active.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500">No checklist items yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {active.map((item, idx) => (
            <li key={item.id} className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
              {editing?.id === item.id ? (
                <div className="flex-1 space-y-1.5">
                  <input className={inputCls} value={editing.label} onChange={e => setEditing({ ...editing, label: e.target.value })} />
                  <input className={inputCls} value={editing.description} placeholder="Description (optional)" onChange={e => setEditing({ ...editing, description: e.target.value })} />
                  <div className="flex gap-1.5">
                    <button
                      disabled={busy || !editing.label.trim()}
                      onClick={() => run(async () => { await api.requirements.updateChecklistItem(item.id, { label: editing.label, description: editing.description }); setEditing(null); })}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-teamColor text-white rounded-lg text-[10px] font-black uppercase disabled:opacity-50"
                    ><Check size={12} /> Save</button>
                    <button onClick={() => setEditing(null)} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 rounded-lg text-[10px] font-black uppercase"><X size={12} /> Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.label}</p>
                    {item.description && <p className="text-[11px] text-slate-500 dark:text-slate-400">{item.description}</p>}
                  </div>
                  {isCoach && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button title="Move up" disabled={busy || idx === 0} onClick={() => move(idx, -1)} className="p-1.5 rounded-lg text-slate-400 hover:text-teamColor disabled:opacity-30"><ArrowUp size={14} /></button>
                      <button title="Move down" disabled={busy || idx === active.length - 1} onClick={() => move(idx, 1)} className="p-1.5 rounded-lg text-slate-400 hover:text-teamColor disabled:opacity-30"><ArrowDown size={14} /></button>
                      <button title="Edit" disabled={busy} onClick={() => setEditing({ id: item.id, label: item.label, description: item.description })} className="p-1.5 rounded-lg text-slate-400 hover:text-teamColor"><Edit3 size={14} /></button>
                      <button title="Archive (keeps past completions)" disabled={busy} onClick={() => run(() => api.requirements.updateChecklistItem(item.id, { archived: true }))} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600"><Archive size={14} /></button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {isCoach && (
        <div className="flex flex-col sm:flex-row gap-2">
          <input className={inputCls} value={label} placeholder="New item, e.g. Register with FIRST" onChange={e => setLabel(e.target.value)} />
          <input className={inputCls} value={description} placeholder="Description (optional)" onChange={e => setDescription(e.target.value)} />
          <button
            disabled={busy || !label.trim()}
            onClick={() => run(async () => { await api.requirements.createChecklistItem({ label, description }); setLabel(''); setDescription(''); })}
            className="flex items-center justify-center gap-1 px-4 py-2 bg-teamColor text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50 shrink-0"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />} Add
          </button>
        </div>
      )}

      {isCoach && archived.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-black text-slate-400 uppercase tracking-widest text-[10px]">Archived ({archived.length})</summary>
          <ul className="mt-2 space-y-1">
            {archived.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700/40">
                <span className="text-slate-500 dark:text-slate-400 line-through">{item.label}</span>
                <button disabled={busy} onClick={() => run(() => api.requirements.updateChecklistItem(item.id, { archived: false }))} className="flex items-center gap-1 text-[10px] font-black text-teamColor uppercase"><RotateCcw size={11} /> Restore</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};

export default ChecklistSettings;
