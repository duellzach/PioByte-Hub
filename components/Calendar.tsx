import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Trophy, Wrench, Flag, Repeat } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  type: 'practice' | 'competition' | 'meeting' | 'deadline';
  location?: string;
  notes?: string;
  recurring?: 'weekly' | 'biweekly';
}

const SEED_EVENTS: CalendarEvent[] = [
  { id: 'p1', title: 'Team Practice', date: '2026-01-06', type: 'practice', location: 'Build Room', recurring: 'biweekly' },
  { id: 'p2', title: 'Team Practice', date: '2026-01-10', type: 'practice', location: 'Build Room', recurring: 'weekly' },
  { id: 'c1', title: 'San Diego Regional', date: '2026-03-05', endDate: '2026-03-08', type: 'competition', location: 'San Diego, CA', notes: 'Week 1 Regional' },
  { id: 'c2', title: 'LA Regional', date: '2026-03-19', endDate: '2026-03-22', type: 'competition', location: 'Los Angeles, CA', notes: 'Week 3 Regional' },
  { id: 'c3', title: 'CHS District Championship', date: '2026-04-09', endDate: '2026-04-12', type: 'competition', location: 'Virginia', notes: 'District Championship' },
  { id: 'm1', title: 'Strategy Meeting', date: '2026-03-01', type: 'meeting', location: 'Build Room' },
  { id: 'd1', title: 'Robot Bag Deadline', date: '2026-02-18', type: 'deadline', notes: 'Robot must be competition-ready' },
];

const TYPE_STYLES: Record<CalendarEvent['type'], { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  practice: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', icon: <Wrench size={10} />, label: 'Practice' },
  competition: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', icon: <Trophy size={10} />, label: 'Competition' },
  meeting: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', icon: <CalendarDays size={10} />, label: 'Meeting' },
  deadline: { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', icon: <Flag size={10} />, label: 'Deadline' },
};

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function expandRecurring(events: CalendarEvent[], year: number, month: number): CalendarEvent[] {
  const expanded: CalendarEvent[] = [];
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);

  events.forEach(ev => {
    if (!ev.recurring) {
      expanded.push(ev);
      return;
    }
    const seed = new Date(ev.date);
    const intervalDays = ev.recurring === 'weekly' ? 7 : 14;
    let cur = new Date(seed);
    while (cur <= monthEnd) {
      if (cur >= monthStart) {
        expanded.push({
          ...ev,
          id: `${ev.id}-${cur.toISOString().slice(0,10)}`,
          date: cur.toISOString().slice(0,10),
          recurring: undefined,
        });
      }
      cur = new Date(cur.getTime() + intervalDays * 86400000);
    }
  });
  return expanded;
}

const Calendar: React.FC = () => {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<'month' | 'list'>('month');

  const allEvents = useMemo(() => expandRecurring(SEED_EVENTS, year, month), [year, month]);

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
    allEvents.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
      if (ev.endDate) {
        let cur = new Date(ev.date);
        const end = new Date(ev.endDate);
        cur.setDate(cur.getDate() + 1);
        while (cur <= end) {
          const key = cur.toISOString().slice(0,10);
          if (!map[key]) map[key] = [];
          map[key].push({ ...ev, id: `${ev.id}-cont-${key}` });
          cur.setDate(cur.getDate() + 1);
        }
      }
    });
    return map;
  }, [allEvents]);

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

  const upcomingEvents = useMemo(() => {
    const now = new Date().toISOString().slice(0,10);
    return SEED_EVENTS
      .filter(ev => ev.date >= now)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 12);
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300 overflow-auto pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Calendar</h1>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-0.5">Season Schedule & Events</p>
        </div>
        <div className="flex items-center gap-2">
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

      {view === 'month' ? (
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
                  const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                  const dayEvents = eventsByDate[dateStr] || [];
                  const isToday = dateStr === today.toISOString().slice(0,10);
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
                        {dayEvents.slice(0, 2).map(ev => {
                          const s = TYPE_STYLES[ev.type];
                          return (
                            <div key={ev.id} className={`w-full px-1 py-0.5 rounded text-[7px] font-black truncate ${isSelected ? 'bg-white/20 text-white dark:text-slate-900' : `${s.bg} ${s.text}`}`}>
                              {ev.title}
                            </div>
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
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                </h3>
                {selectedEvents.length === 0 ? (
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase text-center py-4">No events</p>
                ) : (
                  <div className="space-y-2">
                    {selectedEvents.map(ev => {
                      const s = TYPE_STYLES[ev.type];
                      return (
                        <div key={ev.id} className={`p-3 rounded-xl ${s.bg}`}>
                          <div className={`flex items-center gap-1.5 mb-1 ${s.text}`}>
                            {s.icon}
                            <span className="text-[9px] font-black uppercase tracking-wider">{s.label}</span>
                          </div>
                          <p className={`text-xs font-black ${s.text}`}>{ev.title}</p>
                          {ev.location && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{ev.location}</p>}
                          {ev.notes && <p className="text-[9px] text-slate-400 dark:text-slate-500 italic mt-0.5">{ev.notes}</p>}
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
                  const s = TYPE_STYLES[ev.type];
                  const d = new Date(ev.date + 'T12:00:00');
                  return (
                    <div key={ev.id} className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 text-center w-10">
                        <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">{d.toLocaleDateString([], { month: 'short', timeZone: 'America/Los_Angeles' })}</div>
                        <div className="text-base font-black text-slate-900 dark:text-white leading-none">{d.getDate()}</div>
                      </div>
                      <div className={`flex-1 p-2 rounded-xl ${s.bg}`}>
                        <div className={`flex items-center gap-1 mb-0.5 ${s.text}`}>
                          {s.icon}
                          <span className="text-[8px] font-black uppercase">{s.label}</span>
                          {ev.recurring && <Repeat size={8} className="ml-auto opacity-60" />}
                        </div>
                        <p className={`text-[10px] font-black ${s.text}`}>{ev.title}</p>
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
              const s = TYPE_STYLES[ev.type];
              const d = new Date(ev.date + 'T12:00:00');
              return (
                <div key={ev.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex-shrink-0 w-12 text-center">
                    <div className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">{d.toLocaleDateString([], { month: 'short', timeZone: 'America/Los_Angeles' })}</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white leading-none">{d.getDate()}</div>
                    <div className="text-[8px] font-black text-slate-400 dark:text-slate-500">{d.toLocaleDateString([], { weekday: 'short', timeZone: 'America/Los_Angeles' })}</div>
                  </div>
                  <div className={`w-1 self-stretch rounded-full ${s.text.replace('text-', 'bg-').split(' ')[0]}`} />
                  <div className="flex-1 min-w-0">
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${s.bg} ${s.text} text-[8px] font-black uppercase mb-1`}>
                      {s.icon} {s.label}
                    </div>
                    <p className="text-sm font-black text-slate-900 dark:text-white uppercase">{ev.title}</p>
                    {ev.location && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{ev.location}</p>}
                    {ev.notes && <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">{ev.notes}</p>}
                    {ev.endDate && (
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase mt-0.5">
                        Through {new Date(ev.endDate + 'T12:00:00').toLocaleDateString([], { month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' })}
                      </p>
                    )}
                  </div>
                  {ev.recurring && (
                    <div className="flex-shrink-0 text-slate-300 dark:text-slate-600" title={`Repeats ${ev.recurring}`}>
                      <Repeat size={14} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
