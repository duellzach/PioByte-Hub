import React, { useEffect, useState } from 'react';
import { DollarSign, Plus, Check, Trash2, Clock, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { todayLocalStr } from '../utils/dates';

interface FundraisingProps {
  currentUser: any;
  users: any[];
}

const fmtMoney = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

const Fundraising: React.FC<FundraisingProps> = ({ currentUser, users }) => {
  const { settings } = useTeamSettings();
  const roles: string[] = currentUser?.roles || [];
  const isLeadership = roles.some((r) => ['Coach', 'Team Captain', 'SCRUM Master'].includes(r));
  const categories: string[] = (settings as any).fundraisingCategories || ['Concessions', 'Farmers Market', 'Parent Night Out', 'Sponsorship', 'Other'];

  const [entries, setEntries] = useState<any[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ userId: '', amount: '', category: categories[0] || 'Other', description: '', occurredOn: todayLocalStr() });

  const userName = (id: number) => users.find((u) => String(u.id) === String(id))?.name || `User ${id}`;

  const load = async () => {
    setLoading(true);
    try {
      const [e, s] = await Promise.all([api.fundraising.list(), api.requirements.mine().catch(() => null)]);
      setEntries(e);
      setSummary(s);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setError('');
    const cents = Math.round(parseFloat(form.amount) * 100);
    if (!cents || cents <= 0) { setError('Enter a positive amount.'); return; }
    setSaving(true);
    try {
      await api.fundraising.create({
        userId: isLeadership && form.userId ? parseInt(form.userId) : undefined,
        amountCents: cents,
        category: form.category,
        description: form.description,
        occurredOn: form.occurredOn,
      });
      setForm({ ...form, amount: '', description: '' });
      await load();
    } catch (e: any) {
      setError(e?.message || 'Could not add contribution.');
    } finally { setSaving(false); }
  };

  const verify = async (id: number) => { await api.fundraising.update(id, { status: 'verified' }).catch(() => {}); await load(); };
  const remove = async (id: number) => { await api.fundraising.delete(id).catch(() => {}); await load(); };

  const f = summary?.fundraising;

  return (
    <div className="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Fundraising</h1>
        <p className="text-teamColor font-black text-xs uppercase tracking-widest mt-1">Contributions & progress</p>
      </div>

      {/* Own progress (everyone) */}
      {f?.enabled && (
        <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 p-8">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">My Progress</span>
            <span className="text-sm font-black text-teamColor">{fmtMoney(f.raisedCents)} <span className="text-slate-400">of {fmtMoney(f.goalCents)}</span></span>
          </div>
          <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full bg-teamColor rounded-full transition-all" style={{ width: `${f.goalCents > 0 ? Math.min(100, (f.raisedCents / f.goalCents) * 100) : 0}%` }} />
          </div>
          {f.pendingCents > 0 && <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold mt-2">+{fmtMoney(f.pendingCents)} pending verification</p>}
        </div>
      )}

      {/* Log a contribution */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 p-8 space-y-4">
        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{isLeadership ? 'Add a contribution' : 'Log a contribution'}</h2>
        <div className="grid grid-cols-2 gap-3">
          {isLeadership && (
            <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="col-span-2 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-teamColor dark:text-white">
              <option value="">— Credit which student? —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
            <input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} type="number" min="0" step="0.01" placeholder="Amount" className="w-full pl-7 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-teamColor dark:text-white" />
          </div>
          <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-teamColor dark:text-white">
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} type="date" className="p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-teamColor dark:text-white" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={isLeadership ? 'Reason (plain text)' : 'Description'} className="p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-bold outline-none focus:border-teamColor dark:text-white" />
        </div>
        {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
        {!isLeadership && <p className="text-[11px] text-slate-400 font-bold">Your contribution will be pending until a coach verifies it.</p>}
        <button onClick={handleAdd} disabled={saving} className="w-full py-3.5 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {isLeadership ? 'Add Contribution' : 'Log Contribution'}
        </button>
      </div>

      {/* Ledger */}
      <div className="bg-white dark:bg-slate-800 rounded-3xl border-2 border-slate-100 dark:border-slate-700 p-8">
        <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4">{isLeadership ? 'Team Ledger' : 'My Contributions'}</h2>
        {loading ? (
          <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
        ) : entries.length === 0 ? (
          <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-6">No contributions yet</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                <div className="w-9 h-9 rounded-xl bg-teamColor/10 text-teamColor flex items-center justify-center flex-shrink-0"><DollarSign size={16} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm text-slate-900 dark:text-white">{fmtMoney(e.amountCents)} <span className="text-slate-400 font-bold">· {e.category}</span></p>
                  <p className="text-[11px] text-slate-400 font-bold truncate">{isLeadership ? `${userName(e.userId)} · ` : ''}{e.occurredOn}{e.description ? ` · ${e.description}` : ''}</p>
                </div>
                {e.status === 'pending'
                  ? <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1"><Clock size={10} /> Pending</span>
                  : <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Verified</span>}
                {isLeadership && (
                  <>
                    {e.status === 'pending' && <button onClick={() => verify(e.id)} title="Verify" className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"><Check size={16} /></button>}
                    <button onClick={() => remove(e.id)} title="Delete" className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={15} /></button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Fundraising;
