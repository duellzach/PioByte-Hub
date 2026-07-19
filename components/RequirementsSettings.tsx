import React, { useEffect, useState } from 'react';
import { Target, Plus, Trash2, Loader2, Check } from 'lucide-react';
import { api } from '../services/api';

interface Props { currentUserId: string | null; }

const SOURCES = [
  { value: 'clock:shop', label: 'Shop time clock' },
  { value: 'clock:outreach', label: 'Outreach clock' },
  { value: 'clock:volunteer', label: 'Volunteer clock' },
  { value: 'competition_checkins', label: 'Competition check-ins' },
];
const minToHours = (m: number) => (m ? +(m / 60).toFixed(2) : 0);
const hoursToMin = (h: number) => Math.round((h || 0) * 60);

const RequirementsSettings: React.FC<Props> = ({ currentUserId }) => {
  const [req, setReq] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.settings.get().then((s) => {
      setReq(s.requirements || { fundraising: { enabled: false, goalCents: 0 }, hours: [] });
      setCategories(s.fundraisingCategories || ['Concessions', 'Farmers Market', 'Parent Night Out', 'Sponsorship', 'Other']);
    }).catch(() => { setReq({ fundraising: { enabled: false, goalCents: 0 }, hours: [] }); setCategories(['Other']); });
  }, []);

  if (!req) return <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>;

  const patch = (fn: (r: any) => void) => { const next = JSON.parse(JSON.stringify(req)); fn(next); setReq(next); setSaved(false); };

  const save = async () => {
    setError(''); setSaving(true);
    try {
      await api.settings.update({ requesterId: currentUserId ? parseInt(currentUserId) : 0, requirements: req, fundraisingCategories: categories });
      setSaved(true);
    } catch (e: any) { setError(e?.message || 'Could not save.'); }
    finally { setSaving(false); }
  };

  const addCategory = () => {
    const c = newCategory.trim();
    if (c && !categories.includes(c)) { setCategories([...categories, c]); setNewCategory(''); setSaved(false); }
  };
  const removeCategory = (c: string) => { setCategories(categories.filter((x) => x !== c)); setSaved(false); };

  const f = req.fundraising || { enabled: false, goalCents: 0 };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><Target size={20} /></div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Requirements</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">What students must meet this season</p>
        </div>
      </div>

      {/* Fundraising */}
      <div className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-5 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={f.enabled} onChange={(e) => patch((r) => { r.fundraising = { ...r.fundraising, enabled: e.target.checked }; })} className="w-4 h-4" style={{ accentColor: 'var(--team-color)' }} />
          <span className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">Fundraising requirement</span>
        </label>
        {f.enabled && (
          <div className="flex items-center gap-2 pl-7">
            <span className="text-xs font-bold text-slate-500">Goal $</span>
            <input type="number" min="0" value={f.goalCents ? f.goalCents / 100 : ''} onChange={(e) => patch((r) => { r.fundraising.goalCents = Math.round((parseFloat(e.target.value) || 0) * 100); })} className="w-28 p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-sm font-bold outline-none focus:border-teamColor dark:text-white" />
          </div>
        )}
        {/* Contribution types (categories) */}
        <div className="pl-7 space-y-2">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Contribution types</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1.5 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold dark:text-white">
                {c}
                <button onClick={() => removeCategory(c)} className="text-slate-400 hover:text-red-600"><Trash2 size={12} /></button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }} placeholder="Add a type (e.g. Car Wash)" className="flex-1 p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-teamColor dark:text-white" />
            <button onClick={addCategory} className="px-3 py-2 bg-slate-100 dark:bg-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-200 hover:bg-slate-200 flex items-center gap-1"><Plus size={12} /> Add</button>
          </div>
        </div>
      </div>

      {/* Hour requirements */}
      <div className="space-y-3">
        {(req.hours || []).map((h: any, hi: number) => (
          <div key={hi} className="bg-slate-50 dark:bg-slate-700/40 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-3">
              <input type="checkbox" checked={h.enabled} onChange={(e) => patch((r) => { r.hours[hi].enabled = e.target.checked; })} className="w-4 h-4" style={{ accentColor: 'var(--team-color)' }} />
              <input value={h.label} onChange={(e) => patch((r) => { r.hours[hi].label = e.target.value; })} className="flex-1 p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-sm font-black outline-none focus:border-teamColor dark:text-white" />
              <select value={h.source} onChange={(e) => patch((r) => { r.hours[hi].source = e.target.value; })} className="p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-teamColor dark:text-white">
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button onClick={() => patch((r) => { r.hours.splice(hi, 1); })} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
            </div>
            {h.enabled && (
              <div className="pl-7 space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phases</p>
                {(h.phases || []).map((ph: any, pi: number) => (
                  <div key={pi} className="flex items-center gap-2 flex-wrap">
                    <input value={ph.label} onChange={(e) => patch((r) => { r.hours[hi].phases[pi].label = e.target.value; })} placeholder="Phase" className="w-28 p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-teamColor dark:text-white" />
                    <input type="date" value={ph.start || ''} onChange={(e) => patch((r) => { r.hours[hi].phases[pi].start = e.target.value || null; })} className="p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-teamColor dark:text-white" />
                    <input type="date" value={ph.end || ''} onChange={(e) => patch((r) => { r.hours[hi].phases[pi].end = e.target.value || null; })} className="p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-teamColor dark:text-white" />
                    <span className="text-xs font-bold text-slate-500">req</span>
                    <input type="number" min="0" step="0.5" value={minToHours(ph.requiredMinutes)} onChange={(e) => patch((r) => { r.hours[hi].phases[pi].requiredMinutes = hoursToMin(parseFloat(e.target.value)); })} className="w-16 p-2 bg-white dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-teamColor dark:text-white" />
                    <span className="text-xs font-bold text-slate-500">h</span>
                    <button onClick={() => patch((r) => { r.hours[hi].phases.splice(pi, 1); })} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={13} /></button>
                  </div>
                ))}
                <button onClick={() => patch((r) => { r.hours[hi].phases.push({ label: 'Phase', start: null, end: null, requiredMinutes: 0 }); })} className="text-[10px] font-black text-teamColor uppercase tracking-widest flex items-center gap-1"><Plus size={12} /> Add phase</button>
              </div>
            )}
          </div>
        ))}
        <button onClick={() => patch((r) => { r.hours = r.hours || []; r.hours.push({ key: `custom_${Date.now()}`, label: 'New Requirement', enabled: true, source: 'clock:shop', phases: [{ label: 'Season', start: null, end: null, requiredMinutes: 0 }] }); })} className="text-xs font-black text-slate-500 hover:text-teamColor uppercase tracking-widest flex items-center gap-1.5"><Plus size={14} /> Add hour requirement</button>
      </div>

      {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
      <button onClick={save} disabled={saving} className="w-full py-3.5 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : saved ? <Check size={16} /> : null} {saved ? 'Saved' : 'Save Requirements'}
      </button>
    </div>
  );
};

export default RequirementsSettings;
