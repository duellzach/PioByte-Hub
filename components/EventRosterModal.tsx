import React, { useEffect, useState } from 'react';
import { X, Check, Ban, Loader2, Users, Clock, LogIn, LogOut, Pencil, UserPlus, Search } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  eventId: number;
  eventTitle: string;
  eventStartDate: string;
  isCoach: boolean;
  onClose: () => void;
}

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
};

const durMinutes = (inAt: string, outAt: string | null): number | null => {
  if (!outAt) return null;
  return Math.round((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000);
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const toTimeInput = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const mergeTime = (baseIso: string, timeStr: string): string => {
  const d = new Date(baseIso);
  const [h, m] = timeStr.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const STATUS: Record<string, { label: string; cls: string }> = {
  requested:  { label: 'Requested',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  accepted:   { label: 'Accepted',   cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  declined:   { label: 'Declined',   cls: 'bg-slate-200 text-slate-500 dark:bg-slate-600' },
  waitlisted: { label: 'Waitlisted', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  invited:    { label: 'Invited',    cls: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' },
};

type EditTarget = { signupId: number; field: 'in' | 'out'; value: string };

const EventRosterModal: React.FC<Props> = ({ eventId, eventTitle, eventStartDate, isCoach, onClose }) => {
  const today = new Date().toISOString().slice(0, 10);
  const eventIsActive = eventStartDate <= today;

  const [tab, setTab] = useState<'roster' | 'attendance'>('roster');
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [walkinSearch, setWalkinSearch] = useState('');
  const [walkinBusy, setWalkinBusy] = useState<number | null>(null);
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, u] = await Promise.all([
        api.events.roster(eventId),
        isCoach ? api.users.getAll() : Promise.resolve([]),
      ]);
      setRoster(r);
      setAllUsers((u as any[]).filter((u: any) => !u.archived));
    } catch { setRoster([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [eventId]);

  const setStatus = async (signupId: number, status: string) => {
    await api.events.setSignupStatus(signupId, status).catch(() => {});
    await load();
  };

  const doCheckin = async (userId: number) => {
    setActionBusy(userId);
    try { await api.events.checkin(eventId, userId); await load(); }
    finally { setActionBusy(null); }
  };

  const doCheckout = async (signupId: number, userId: number) => {
    setActionBusy(userId);
    try { await api.events.checkout(eventId, signupId); await load(); }
    finally { setActionBusy(null); }
  };

  const doWalkin = async (userId: number) => {
    setWalkinBusy(userId);
    try { await api.events.checkin(eventId, userId); setWalkinSearch(''); await load(); }
    finally { setWalkinBusy(null); }
  };

  const startEdit = (signup: any, field: 'in' | 'out') => {
    const iso = field === 'in' ? signup.checkedInAt : signup.checkedOutAt;
    setEditTarget({ signupId: signup.id, field, value: iso ? toTimeInput(iso) : toTimeInput(new Date().toISOString()) });
  };

  const saveEdit = async () => {
    if (!editTarget || editSaving) return;
    const signup = roster.find((s) => s.id === editTarget.signupId);
    if (!signup) { setEditTarget(null); return; }
    const baseIso = editTarget.field === 'in'
      ? (signup.checkedInAt || new Date().toISOString())
      : (signup.checkedOutAt || new Date().toISOString());
    const newIso = mergeTime(baseIso, editTarget.value);
    const patch = editTarget.field === 'in' ? { checkedInAt: newIso } : { checkedOutAt: newIso };
    setEditSaving(true);
    try { await api.events.editAttendance(editTarget.signupId, patch).catch(() => {}); await load(); }
    finally { setEditSaving(false); setEditTarget(null); }
  };

  const rosterUserIds = new Set(roster.map((s) => s.userId));
  const walkinCandidates = walkinSearch.trim().length > 1
    ? allUsers.filter((u) => !rosterUserIds.has(u.id) && u.name.toLowerCase().includes(walkinSearch.toLowerCase()))
    : [];

  const checkedIn  = roster.filter((s) => s.checkedInAt && !s.checkedOutAt);
  const checkedOut = roster.filter((s) => s.checkedInAt && s.checkedOutAt);
  const expected   = roster.filter((s) => s.status === 'accepted' && !s.checkedInAt);
  const others     = roster.filter((s) => s.status !== 'accepted' && !s.checkedInAt);

  const TimeBtn: React.FC<{ signup: any; field: 'in' | 'out'; isoVal: string | null }> = ({ signup, field, isoVal }) => {
    const isMe = editTarget?.signupId === signup.id && editTarget?.field === field;
    if (isMe) {
      return (
        <input
          type="time"
          className="text-[11px] border border-teamColor rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-[5.5rem]"
          value={editTarget!.value}
          autoFocus
          onChange={(e) => setEditTarget({ ...editTarget!, value: e.target.value })}
          onBlur={saveEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } if (e.key === 'Escape') setEditTarget(null); }}
        />
      );
    }
    return (
      <button
        className="inline-flex items-center gap-0.5 text-[11px] text-slate-600 dark:text-slate-300 hover:text-teamColor group/tb"
        onClick={() => startEdit(signup, field)}
      >
        {isoVal ? fmtTime(isoVal) : <span className="text-slate-400">—</span>}
        <Pencil size={8} className="opacity-0 group-hover/tb:opacity-100 transition-opacity ml-0.5 text-slate-400" />
      </button>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl max-h-[88vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Event Roster</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate max-w-[14rem]">{eventTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={20} /></button>
        </div>

        {/* Tabs — only coaches see Attendance, and only when event is today or past */}
        {isCoach && eventIsActive && (
          <div className="flex border-b border-slate-100 dark:border-slate-700 px-5 flex-shrink-0">
            {(['roster', 'attendance'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b-2 transition-colors ${
                  tab === t
                    ? 'border-teamColor text-teamColor'
                    : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {t === 'roster' ? 'Roster' : `Attendance${checkedIn.length + checkedOut.length > 0 ? ` (${checkedIn.length + checkedOut.length})` : ''}`}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" size={22} /></div>
          ) : tab === 'roster' ? (

            /* ── ROSTER TAB ── */
            roster.length === 0 ? (
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
                          <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Clock size={9} /> {fmtHours(s.clockedMinutes)} clocked
                          </p>
                        )}
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${st.cls}`}>{st.label}</span>
                      {isCoach && s.status !== 'accepted' && (
                        <button onClick={() => setStatus(s.id, 'accepted')} title="Accept"
                          className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg">
                          <Check size={16} />
                        </button>
                      )}
                      {isCoach && s.status !== 'declined' && (
                        <button onClick={() => setStatus(s.id, 'declined')} title="Decline"
                          className="p-2 text-slate-400 hover:text-red-600 rounded-lg">
                          <Ban size={15} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )

          ) : (

            /* ── ATTENDANCE TAB ── */
            <div className="space-y-6">

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Here Now',    value: checkedIn.length,  cls: 'text-emerald-600' },
                  { label: 'Expected',    value: expected.length,   cls: 'text-amber-600'   },
                  { label: 'Checked Out', value: checkedOut.length, cls: 'text-slate-500'   },
                ].map(({ label, value, cls }) => (
                  <div key={label} className="text-center bg-slate-50 dark:bg-slate-700/50 rounded-2xl py-3">
                    <p className={`text-xl font-black ${cls}`}>{value}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Currently checked in */}
              {checkedIn.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full inline-block animate-pulse" /> Here Now
                  </p>
                  <div className="space-y-1.5">
                    {checkedIn.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-slate-900 dark:text-white truncate">{s.userName}</p>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-400 font-bold">
                            In: <TimeBtn signup={s} field="in" isoVal={s.checkedInAt} />
                          </div>
                        </div>
                        <button
                          disabled={actionBusy === s.userId}
                          onClick={() => doCheckout(s.id, s.userId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-red-400 hover:text-red-600 transition-all text-slate-500 dark:text-slate-300 disabled:opacity-40"
                        >
                          {actionBusy === s.userId ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />} Check Out
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expected (accepted, not arrived) */}
              {expected.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2">Expected</p>
                  <div className="space-y-1.5">
                    {expected.map((s) => (
                      <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl">
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm text-slate-900 dark:text-white truncate">{s.userName}</p>
                          <p className="text-[10px] text-slate-400 font-bold">RSVP'd · not yet arrived</p>
                        </div>
                        <button
                          disabled={actionBusy === s.userId}
                          onClick={() => doCheckin(s.userId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-emerald-400 hover:text-emerald-600 transition-all text-slate-500 dark:text-slate-300 disabled:opacity-40"
                        >
                          {actionBusy === s.userId ? <Loader2 size={10} className="animate-spin" /> : <LogIn size={10} />} Check In
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checked out */}
              {checkedOut.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2">Checked Out</p>
                  <div className="space-y-1.5">
                    {checkedOut.map((s) => {
                      const dur = durMinutes(s.checkedInAt, s.checkedOutAt);
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl opacity-80 hover:opacity-100 transition-opacity">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-sm text-slate-700 dark:text-slate-300 truncate">{s.userName}</p>
                              {dur !== null && dur >= 0 && (
                                <span className="text-[9px] font-black text-teamColor">{fmtHours(dur)}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400 font-bold flex-wrap">
                              <span className="flex items-center gap-1">In: <TimeBtn signup={s} field="in" isoVal={s.checkedInAt} /></span>
                              <span className="flex items-center gap-1">Out: <TimeBtn signup={s} field="out" isoVal={s.checkedOutAt} /></span>
                            </div>
                          </div>
                          <button
                            onClick={() => doCheckin(s.userId)}
                            disabled={actionBusy === s.userId}
                            title="Re-check in"
                            className="p-2 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all disabled:opacity-40"
                          >
                            {actionBusy === s.userId ? <Loader2 size={12} className="animate-spin" /> : <LogIn size={14} />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Walk-in */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <UserPlus size={10} /> Walk-In
                </p>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search team members…"
                    value={walkinSearch}
                    onChange={(e) => setWalkinSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-2.5 text-xs font-bold bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:border-teamColor text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                </div>
                {walkinCandidates.length > 0 && (
                  <div className="mt-1.5 space-y-1">
                    {walkinCandidates.slice(0, 6).map((u: any) => (
                      <div key={u.id} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <p className="text-sm font-black text-slate-900 dark:text-white">{u.name}</p>
                        <button
                          disabled={walkinBusy === u.id}
                          onClick={() => doWalkin(u.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40"
                        >
                          {walkinBusy === u.id ? <Loader2 size={10} className="animate-spin" /> : <LogIn size={10} />} Check In
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {walkinSearch.trim().length > 1 && walkinCandidates.length === 0 && (
                  <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">No results — already on roster or not found</p>
                )}
              </div>

              {/* Other sign-ups (non-accepted, not checked in) */}
              {others.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Other Sign-ups</p>
                  <div className="space-y-1.5">
                    {others.map((s) => {
                      const st = STATUS[s.status] || STATUS.requested;
                      return (
                        <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-2xl opacity-60">
                          <p className="flex-1 font-black text-sm text-slate-700 dark:text-slate-300 truncate">{s.userName}</p>
                          <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase ${st.cls}`}>{st.label}</span>
                          <button
                            disabled={actionBusy === s.userId}
                            onClick={() => doCheckin(s.userId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-emerald-400 hover:text-emerald-600 transition-all text-slate-400 disabled:opacity-40"
                          >
                            {actionBusy === s.userId ? <Loader2 size={10} className="animate-spin" /> : <LogIn size={10} />} Check In
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {roster.length === 0 && checkedIn.length === 0 && expected.length === 0 && (
                <p className="text-center text-xs text-slate-400 font-bold uppercase tracking-widest py-4">
                  No sign-ups yet — use Walk-In above to check students in directly.
                </p>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventRosterModal;
