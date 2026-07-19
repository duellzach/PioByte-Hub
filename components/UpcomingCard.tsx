import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, Loader2, MapPin } from 'lucide-react';
import { api } from '../services/api';
import { parseLocalDate } from '../utils/dates';

const TYPE_COLORS: Record<string, string> = {
  outreach: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  volunteer: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  competition: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const STATUS_LABEL: Record<string, string> = {
  requested: 'Requested', accepted: 'Accepted ✓', declined: 'Declined', waitlisted: 'Waitlisted',
};

const UpcomingCard: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const load = async () => {
    try { setEvents(await api.events.myUpcoming()); }
    catch { setEvents([]); }
    finally { setLoaded(true); }
  };
  useEffect(() => { load(); }, []);

  const signUp = async (id: number) => { setBusy(id); try { await api.events.signup(id); await load(); } catch { /* */ } finally { setBusy(null); } };
  const withdraw = async (id: number) => { setBusy(id); try { await api.events.withdraw(id); await load(); } catch { /* */ } finally { setBusy(null); } };

  if (!loaded || events.length === 0) return null;

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-2xl md:rounded-[28px] border-2 border-slate-100 dark:border-slate-700 p-5 space-y-3.5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><CalendarDays size={18} /></div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Upcoming</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Events you can join</p>
        </div>
      </div>

      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
            <div className="text-center flex-shrink-0 w-11">
              <div className="text-[9px] font-black text-teamColor uppercase">{parseLocalDate(e.startDate).toLocaleDateString([], { month: 'short' })}</div>
              <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{parseLocalDate(e.startDate).getDate()}</div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-black text-sm text-slate-900 dark:text-white truncate">{e.title}</p>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide ${TYPE_COLORS[e.type] || 'bg-slate-200 text-slate-600'}`}>{e.type}</span>
              </div>
              <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 truncate">
                {e.startTime ? `${e.startTime} · ` : ''}{e.location ? <><MapPin size={9} /> {e.location}</> : 'No location set'}
              </p>
            </div>
            {e.myStatus ? (
              e.myStatus === 'accepted'
                ? <span className="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0"><Check size={11} /> In</span>
                : <button onClick={() => withdraw(e.id)} disabled={busy === e.id} className="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 flex-shrink-0">{busy === e.id ? '…' : STATUS_LABEL[e.myStatus]}</button>
            ) : (
              <button onClick={() => signUp(e.id)} disabled={busy === e.id} className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-teamColor text-white hover:opacity-90 disabled:opacity-50 flex-shrink-0">{busy === e.id ? '…' : 'Sign Up'}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingCard;
