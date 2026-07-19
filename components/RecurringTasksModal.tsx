import React, { useState, useEffect } from 'react';
import { X, Repeat, Trash2, Plus, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useTeamSettings } from '../contexts/TeamSettingsContext';

interface Project { id: string; name: string; }
interface RecurringTasksModalProps {
  projects: Project[];
  canManage: boolean;
  onClose: () => void;
  onGenerated?: () => void;
}

const FREQUENCIES = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Every month' },
];

const RecurringTasksModal: React.FC<RecurringTasksModalProps> = ({ projects, canManage, onClose, onGenerated }) => {
  const { settings } = useTeamSettings();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', projectId: projects[0]?.id || '', frequency: 'weekly', priority: 'Medium',
    effort: 1, dueOffsetDays: 0, departments: [] as string[],
  });

  const load = async () => {
    setLoading(true);
    try { setTemplates(await api.recurringTasks.getAll()); }
    catch { setTemplates([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const projectName = (id: number) => projects.find(p => String(p.id) === String(id))?.name || `Project ${id}`;
  const freqLabel = (f: string) => FREQUENCIES.find(x => x.value === f)?.label || f;

  const handleCreate = async () => {
    setError('');
    if (!form.title.trim()) { setError('Give the task a title.'); return; }
    if (!form.projectId) { setError('Pick a project.'); return; }
    setSaving(true);
    try {
      await api.recurringTasks.create({
        title: form.title.trim(), description: form.description, projectId: parseInt(form.projectId),
        frequency: form.frequency, priority: form.priority, effort: form.effort,
        dueOffsetDays: form.dueOffsetDays, departments: form.departments,
      });
      setForm({ ...form, title: '', description: '' });
      await load();
      onGenerated?.();
    } catch (e: any) {
      setError(e?.message || 'Could not create the recurring task.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    await api.recurringTasks.delete(id).catch(() => {});
    await load();
  };

  const toggleActive = async (t: any) => {
    await api.recurringTasks.update(t.id, { active: !t.active }).catch(() => {});
    await load();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-t-8 border-teamColor" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><Repeat size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Recurring Tasks</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Auto-created on a fixed schedule</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={22} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Existing templates */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
            ) : templates.length === 0 ? (
              <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-6">No recurring tasks yet</p>
            ) : templates.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-slate-900 dark:text-white truncate">{t.title}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {freqLabel(t.frequency)} · {projectName(t.projectId)}{t.lastGeneratedDate ? ` · last: ${t.lastGeneratedDate}` : ''}
                  </p>
                </div>
                {canManage && (
                  <>
                    <button onClick={() => toggleActive(t)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${t.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-200 text-slate-500 dark:bg-slate-600'}`}>
                      {t.active ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Create form */}
          {canManage && (
            <div className="pt-6 border-t border-slate-100 dark:border-slate-700 space-y-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">New recurring task</p>
              <input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Sort mechanical hardware"
                className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor transition-all font-bold text-sm dark:text-white"
              />
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor transition-all font-bold text-sm dark:text-white resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Project</label>
                  <select value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-xs font-black outline-none focus:border-teamColor dark:text-white">
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Frequency</label>
                  <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-xs font-black outline-none focus:border-teamColor dark:text-white">
                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Priority</label>
                  <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-xs font-black outline-none focus:border-teamColor dark:text-white">
                    {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Due (days after)</label>
                  <input type="number" min={0} value={form.dueOffsetDays} onChange={e => setForm({ ...form, dueOffsetDays: parseInt(e.target.value) || 0 })} className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-xs font-black outline-none focus:border-teamColor dark:text-white" />
                </div>
              </div>
              {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
              <button onClick={handleCreate} disabled={saving} className="w-full py-4 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Add Recurring Task
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecurringTasksModal;
