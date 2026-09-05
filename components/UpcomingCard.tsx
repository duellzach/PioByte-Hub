import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { parseLocalDate } from '../utils/dates';
import { styleFor } from './hourCategoryStyles';

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
    <div className={`bg-white dark:bg-slate-800 rounded-2xl md:rounded-[28px] border-2 border-slate-100 dark:border-slate-700 p-5 flex flex-col gap-3.5 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><CalendarDays size={18} /></div>
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Upcoming</h3>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Events you can join</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto kanban-scroll space-y-2 -mr-1 pr-1">
        {events.map((e) => (
          /*
            Four cards across leaves each one ~240px wide, so a row here has only
            ~162px of usable width. The old layout spent 44px of that on a
            stacked date block and put the title, badge and button on the same
            line, which cut names down to "Build Ni…".

            The date is now a chip on the meta line instead of a column, so the
            title gets the full row width at every size, and flex-wrap drops the
            action button to its own line only when it genuinely cannot fit.
          */
          <div key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
            <div className="flex-1 min-w-[7rem]">
              <p className="font-black text-sm text-slate-900 dark:text-white truncate">{e.title}</p>
              <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1.5 min-w-0 mt-0.5">
                <span className="text-teamColor font-black uppercase tracking-wide flex-shrink-0">
                  {parseLocalDate(e.startDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wide flex-shrink-0 ${styleFor(e.type).bg} ${styleFor(e.type).text}`}>{e.type}</span>
                <span className="truncate">
                  {e.startTime ? `${e.startTime} · ` : ''}{e.location ? e.location : 'No location set'}
                </span>
              </p>
              {e.capacity != null && (
                <p className={`text-[9px] font-black uppercase tracking-wide mt-0.5 ${e.acceptedCount >= e.capacity ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {e.acceptedCount >= e.capacity
                    ? `Full · ${e.acceptedCount}/${e.capacity} — waitlist open`
                    : `${e.capacity - e.acceptedCount} spot${e.capacity - e.acceptedCount === 1 ? '' : 's'} left`}
                </p>
              )}
            </div>
            {e.myStatus ? (
              e.myStatus === 'accepted'
                ? <span className="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 flex items-center gap-1 flex-shrink-0 ml-auto"><Check size={11} /> In</span>
                : <button onClick={() => withdraw(e.id)} disabled={busy === e.id} className="px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-200 flex-shrink-0 ml-auto">{busy === e.id ? '…' : STATUS_LABEL[e.myStatus]}</button>
            ) : (
              <button onClick={() => signUp(e.id)} disabled={busy === e.id} className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest bg-teamColor text-white hover:opacity-90 disabled:opacity-50 flex-shrink-0 ml-auto">{busy === e.id ? '…' : 'Sign Up'}</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UpcomingCard;
