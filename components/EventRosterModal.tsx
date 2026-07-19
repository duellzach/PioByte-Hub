import React, { useEffect, useState } from 'react';
import { X, Check, Ban, Loader2, Users, Clock } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  eventId: number;
  eventTitle: string;
  onClose: () => void;
}

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};
const STATUS: Record<string, { label: string; cls: string }> = {
  requested: { label: 'Requested', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  accepted: { label: 'Accepted', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  declined: { label: 'Declined', cls: 'bg-slate-200 text-slate-500 dark:bg-slate-600' },
  waitlisted: { label: 'Waitlisted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const EventRosterModal: React.FC<Props> = ({ eventId, eventTitle, onClose }) => {
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setRoster(await api.events.roster(eventId)); }
    catch { setRoster([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [eventId]);

  const setStatus = async (signupId: number, status: string) => {
    await api.events.setSignupStatus(signupId, status).catch(() => {});
    await load();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><Users size={20} /></div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Roster</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[16rem]">{eventTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : roster.length === 0 ? (
            <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-8">No sign-ups yet</p>
          ) : (
            <div className="space-y-2">
              {roster.map((s) => {
                const st = STATUS[s.status] || STATUS.requested;
                return (
                  <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-2xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-slate-900 dark:text-white truncate">{s.userName}</p>
                      {s.clockedMinutes > 0 && (
                        <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1"><Clock size={9} /> {fmtHours(s.clockedMinutes)} clocked</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${st.cls}`}>{st.label}</span>
                    {s.status !== 'accepted' && (
                      <button onClick={() => setStatus(s.id, 'accepted')} title="Accept" className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg"><Check size={16} /></button>
                    )}
                    {s.status !== 'declined' && (
                      <button onClick={() => setStatus(s.id, 'declined')} title="Decline" className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Ban size={15} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventRosterModal;
