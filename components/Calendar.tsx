import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Trophy, Wrench, Flag, Plus, X, Pencil, Trash2, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  type: string;
  location: string;
  createdBy: number;
  createdAt: string;
}

interface CalendarProps {
  currentUser?: any;
}

const TYPE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  practice: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', icon: <Wrench size={10} />, label: 'Practice' },
  competition: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', icon: <Trophy size={10} />, label: 'Competition' },
  meeting: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', icon: <CalendarDays size={10} />, label: 'Meeting' },
  other: { bg: 'bg-slate-100 dark:bg-slate-700/60', text: 'text-slate-600 dark:text-slate-300', icon: <Flag size={10} />, label: 'Other' },
};

const EVENT_TYPES = ['practice', 'competition', 'meeting', 'other'];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const EMPTY_FORM = {
  title: '',
  description: '',
  startDate: '',
  endDate: '',
  startTime: '',
  endTime: '',
  type: 'practice',
  location: '',
};

const Calendar: React.FC<CalendarProps> = ({ currentUser }) => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'list'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [chipPopover, setChipPopover] = useState<{ event: CalendarEvent; x: number; y: number } | null>(null);

  const isCoachOrCaptain = currentUser?.roles?.includes('Coach') || currentUser?.roles?.includes('Team Captain');

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.calendar.getAll();
      setEvents(data);
    } catch (e) {
      console.error('Failed to fetch calendar events:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  useEffect(() => {
    if (!chipPopover) return;
    const close = (e: MouseEvent) => {
      const el = document.getElementById('chip-popover');
      if (el && !el.contains(e.target as Node)) setChipPopover(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [chipPopover]);

  const daysInMonth = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const cells: (number | null)[] = Array(first.getDay()).fill(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach(ev => {
      const key = ev.startDate;
      if (!map[key]) map[key] = [];
      if (!map[key].find(e => e.id === ev.id)) map[key].push(ev);
      if (ev.endDate) {
        let cur = new Date(ev.startDate + 'T12:00:00');
        const end = new Date(ev.endDate + 'T12:00:00');
        cur.setDate(cur.getDate() + 1);
        while (cur <= end) {
          const k = cur.toISOString().slice(0, 10);
          if (!map[k]) map[k] = [];
          map[k].push(ev);
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    return map;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString().slice(0, 10);
    return [...events]
      .filter(ev => ev.startDate >= now)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
      .slice(0, 5);
  }, [events]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  };

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const openAdd = (date?: string) => {
    setEditingEvent(null);
    setForm({ ...EMPTY_FORM, startDate: date || '' });
    setError('');
    setShowModal(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setForm({
      title: ev.title,
      description: ev.description || '',
      startDate: ev.startDate,
      endDate: ev.endDate || '',
      startTime: ev.startTime || '',
      endTime: ev.endTime || '',
      type: ev.type,
      location: ev.location || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required'); return; }
    if (!form.startDate) { setError('Start date is required'); return; }
    if (form.endDate && form.endDate < form.startDate) { setError('End date cannot be before start date'); return; }
    if (form.startTime && form.endTime && !form.endDate && form.endTime < form.startTime) { setError('End time cannot be before start time'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        startDate: form.startDate,
        endDate: form.endDate || null,
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        type: form.type,
        location: form.location.trim(),
      };
      if (editingEvent) {
        await api.calendar.update(editingEvent.id, parseInt(currentUser.id), payload);
      } else {
        await api.calendar.create(parseInt(currentUser.id), payload);
      }
      await fetchEvents();
      setShowModal(false);
    } catch (e: any) {
      setError(e.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ev: CalendarEvent) => {
    if (!confirm(`Delete "${ev.title}"?`)) return;
    try {
      await api.calendar.delete(ev.id, parseInt(currentUser.id));
      await fetchEvents();
    } catch (e) {
      console.error('Failed to delete event:', e);
    }
  };

  const s = (type: string) => TYPE_STYLES[type] || TYPE_STYLES['practice'];

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300 overflow-auto pb-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Calendar</h1>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-0.5">Season Schedule & Events</p>
        </div>
        <div className="flex items-center gap-2">
          {isCoachOrCaptain && (
            <button
              onClick={() => openAdd()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
            >
              <Plus size={12} /> Add Event
            </button>
          )}
          <button
            onClick={() => setView('month')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'month' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
          >
            Month
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'list' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
          >
            List
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-[9px] font-black uppercase">
        {Object.entries(TYPE_STYLES).map(([type, style]) => (
          <span key={type} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}>
            {style.icon} {style.label}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-slate-400" />
        </div>
      ) : view === 'month' ? (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <ChevronLeft size={18} className="text-slate-600 dark:text-slate-300" />
              </button>
              <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {MONTHS[month]} {year}
              </h2>
              <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <ChevronRight size={18} className="text-slate-600 dark:text-slate-300" />
              </button>
            </div>
            <div className="p-3">
              <div className="grid grid-cols-7 mb-1">
                {DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {daysInMonth.map((day, idx) => {
                  if (!day) return <div key={idx} />;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isToday = dateStr === today.toISOString().slice(0, 10);
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                      className={`relative p-1 rounded-lg min-h-[52px] text-left transition-all ${
                        isSelected ? 'bg-slate-900 dark:bg-white ring-2 ring-slate-900 dark:ring-white' :
                        isToday ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-600' :
                        dayEvents.length > 0 ? 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700' :
                        'hover:bg-slate-50 dark:hover:bg-slate-700/30'
                      }`}
                    >
                      <span className={`text-[10px] font-black block mb-0.5 ${
                        isSelected ? 'text-white dark:text-slate-900' :
                        isToday ? 'text-red-600' :
                        'text-slate-700 dark:text-slate-200'
                      }`}>{day}</span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((ev, i) => {
                          const style = s(ev.type);
                          return (
                            <button
                              key={`${ev.id}-${i}`}
                              onClick={e => { e.stopPropagation(); const r = (e.target as HTMLElement).getBoundingClientRect(); setChipPopover({ event: ev, x: r.left, y: r.bottom + 4 }); }}
                              className={`w-full text-left px-1 py-0.5 rounded text-[7px] font-black truncate ${isSelected ? 'bg-white/20 text-white dark:text-slate-900' : `${style.bg} ${style.text}`} hover:opacity-80 transition-opacity`}
                            >
                              {ev.title}
                            </button>
                          );
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[7px] font-black text-slate-400 dark:text-slate-500 pl-1">+{dayEvents.length - 2}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:w-72 xl:w-80 space-y-4">
            {selectedDate && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                    {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                  </h3>
                  {isCoachOrCaptain && (
                    <button
                      onClick={() => openAdd(selectedDate)}
                      className="p-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 transition-all"
                      title="Add event on this day"
                    >
                      <Plus size={12} />
                    </button>
                  )}
                </div>
                {selectedEvents.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase text-center py-4">No events</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map((ev, i) => {
                      const style = s(ev.type);
                      return (
                        <div key={`${ev.id}-${i}`} className={`p-3 rounded-xl ${style.bg}`}>
                          <div className={`flex items-center justify-between mb-1 ${style.text}`}>
                            <div className="flex items-center gap-1.5">
                              {style.icon}
                              <span className="text-[9px] font-black uppercase tracking-wider">{style.label}</span>
                            </div>
                            {isCoachOrCaptain && ev.startDate === selectedDate && (
                              <div className="flex gap-1">
                                <button onClick={() => openEdit(ev)} className="p-1 rounded hover:bg-black/10 transition-colors" title="Edit">
                                  <Pencil size={10} />
                                </button>
                                <button onClick={() => handleDelete(ev)} className="p-1 rounded hover:bg-black/10 transition-colors" title="Delete">
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            )}
                          </div>
                          <p className={`text-xs font-black ${style.text}`}>{ev.title}</p>
                          {ev.startTime && (
                            <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                              {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                            </p>
                          )}
                          {ev.location && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{ev.location}</p>}
                          {ev.description && <p className="text-[9px] text-slate-400 dark:text-slate-500 italic mt-0.5">{ev.description}</p>}
                          {ev.endDate && ev.endDate !== ev.startDate && (
                            <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mt-0.5">
                              Through {new Date(ev.endDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Upcoming Events</h3>
              <div className="space-y-2">
                {upcomingEvents.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase text-center py-3">Nothing upcoming</p>
                ) : upcomingEvents.map(ev => {
                  const style = s(ev.type);
                  const d = new Date(ev.startDate + 'T12:00:00');
                  return (
                    <div key={ev.id} className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 text-center w-10">
                        <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">{d.toLocaleDateString([], { month: 'short', timeZone: 'America/Los_Angeles' })}</div>
                        <div className="text-base font-black text-slate-900 dark:text-white leading-none">{d.getDate()}</div>
                      </div>
                      <div className={`flex-1 p-2 rounded-xl ${style.bg}`}>
                        <div className={`flex items-center gap-1 mb-0.5 ${style.text}`}>
                          {style.icon}
                          <span className="text-[8px] font-black uppercase">{style.label}</span>
                        </div>
                        <p className={`text-[10px] font-black ${style.text}`}>{ev.title}</p>
                        {ev.location && <p className="text-[9px] text-slate-500 dark:text-slate-400">{ev.location}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Season Schedule</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {upcomingEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-sm font-bold uppercase">No upcoming events</div>
            ) : upcomingEvents.map(ev => {
              const style = s(ev.type);
              const d = new Date(ev.startDate + 'T12:00:00');
              return (
                <div key={ev.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">{d.toLocaleDateString([], { month: 'short', timeZone: 'America/Los_Angeles' })}</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{d.getDate()}</div>
                    <div className="text-[8px] font-black text-slate-400 dark:text-slate-500">{d.toLocaleDateString([], { weekday: 'short', timeZone: 'America/Los_Angeles' })}</div>
                  </div>
                  <div className={`w-1 self-stretch rounded-full ${style.text.replace('text-', 'bg-').split(' ')[0]}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${style.bg} ${style.text} text-[8px] font-black uppercase mb-1`}>
                      {style.icon} {style.label}
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{ev.title}</p>
                    {ev.startTime && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                      </p>
                    )}
                    {ev.location && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{ev.location}</p>}
                    {ev.description && <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">{ev.description}</p>}
                    {ev.endDate && ev.endDate !== ev.startDate && (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">
                        Through {new Date(ev.endDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                      </p>
                    )}
                  </div>
                  {isCoachOrCaptain && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(ev)}
                        className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:text-slate-800 dark:hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(ev)}
                        className="p-1.5 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {chipPopover && (() => {
        const ev = chipPopover.event;
        const style = s(ev.type);
        const leftPct = chipPopover.x / window.innerWidth;
        const xPos = leftPct > 0.6 ? 'right' : 'left';
        return (
          <div
            id="chip-popover"
            className="fixed z-[400] w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{ top: Math.min(chipPopover.y, window.innerHeight - 260), [xPos]: xPos === 'left' ? chipPopover.x : window.innerWidth - chipPopover.x - 256 }}
          >
            <div className={`p-3 ${style.bg}`}>
              <div className={`flex items-center justify-between ${style.text}`}>
                <div className="flex items-center gap-1.5">
                  {style.icon}
                  <span className="text-[9px] font-black uppercase tracking-widest">{style.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isCoachOrCaptain && (
                    <>
                      <button
                        onClick={() => { setChipPopover(null); openEdit(ev); }}
                        className="p-1 rounded hover:bg-black/10 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={10} />
                      </button>
                      <button
                        onClick={() => { setChipPopover(null); handleDelete(ev); }}
                        className="p-1 rounded hover:bg-black/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={10} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setChipPopover(null)} className="p-1 rounded hover:bg-black/10 transition-colors">
                    <X size={10} />
                  </button>
                </div>
              </div>
              <p className={`text-sm font-black mt-1 ${style.text}`}>{ev.title}</p>
            </div>
            <div className="p-3 space-y-1.5">
              <div className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {new Date(ev.startDate + 'T12:00:00').toLocaleDateString([], { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                {ev.endDate && ev.endDate !== ev.startDate && (
                  <span> – {new Date(ev.endDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}</span>
                )}
              </div>
              {ev.startTime && (
                <div className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                  {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                </div>
              )}
              {ev.location && <div className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">{ev.location}</div>}
              {ev.description && <div className="text-[9px] text-slate-400 dark:text-slate-500 italic leading-relaxed">{ev.description}</div>}
            </div>
          </div>
        );
      })()}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border-t-4 border-red-600 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <CalendarDays size={18} className="text-red-600" />
                  {editingEvent ? 'Edit Event' : 'Add Event'}
                </h2>
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-0.5">
                  {editingEvent ? 'Update calendar event' : 'Add to season calendar'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
                  placeholder="Event title"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Type</label>
                <div className="flex gap-2 flex-wrap">
                  {EVENT_TYPES.map(t => {
                    const style = TYPE_STYLES[t];
                    const isActive = form.type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setForm(f => ({ ...f, type: t }))}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-black text-[10px] uppercase transition-all ${isActive ? `${style.bg} ${style.text} ring-2 ring-current` : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                      >
                        {style.icon} {style.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Start Time</label>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">End Time</label>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Location</label>
                <input
                  value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
                  placeholder="Location or venue"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Notes</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm resize-none h-20"
                  placeholder="Additional notes"
                />
              </div>

              {error && <p className="text-red-600 text-xs font-bold">{error}</p>}

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 uppercase tracking-widest text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : (editingEvent ? 'Update Event' : 'Add Event')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
