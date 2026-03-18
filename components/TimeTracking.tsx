import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, TimeEntry, TimeEntryAudit, User, Role } from '../types';
import { Clock, LogIn, LogOut, Check, X, Edit3, History, AlertCircle, ChevronDown, ChevronUp, Calendar, Timer, Users, Plus, Trash2, Trophy, MapPin, Flag } from 'lucide-react';
import { api } from '../services/api';

interface TimeTrackingProps {
  state: AppState;
  onRefresh: () => void;
}

const formatTime = (date: Date | number | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' });
};

const formatDate = (date: Date | number | string) => {
  const d = new Date(date);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const toLocalDateTimeString = (date: Date | number | string) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const TimeTracking: React.FC<TimeTrackingProps> = ({ state, onRefresh }) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [auditEntry, setAuditEntry] = useState<TimeEntry | null>(null);
  const [auditLogs, setAuditLogs] = useState<TimeEntryAudit[]>([]);
  const [editForm, setEditForm] = useState({ checkInAt: '', checkOutAt: '', notes: '' });
  const [showHistory, setShowHistory] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  const [compEvents, setCompEvents] = useState<any[]>([]);
  const [selectedCompEventId, setSelectedCompEventId] = useState<number | null>(null);
  const [compCheckins, setCompCheckins] = useState<any[]>([]);
  const [myCompCheckin, setMyCompCheckin] = useState<any | null>(null);
  const [compElapsed, setCompElapsed] = useState<string>('');
  const [compLoading, setCompLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState<any | null>(null);
  const [approveMinutes, setApproveMinutes] = useState('');
  const compElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [bulkForm, setBulkForm] = useState<{ 
    selectedUsers: string[]; 
    minutes: number; 
    notes: string; 
    date: string;
    filterRole: string;
  }>({
    selectedUsers: [],
    minutes: 45,
    notes: 'Class time',
    date: new Date().toISOString().split('T')[0],
    filterRole: '',
  });

  const filteredUsersForBulk = useMemo(() => {
    if (!bulkForm.filterRole) return state.users;
    return state.users.filter(u => u.roles.includes(bulkForm.filterRole as Role));
  }, [state.users, bulkForm.filterRole]);

  const isCoach = useMemo(() => state.currentUser?.roles.includes(Role.Coach), [state.currentUser]);
  const currentUserId = parseInt(state.currentUser?.id || '0');

  const myOpenEntry = useMemo(() => {
    return state.timeEntries.find(e => 
      e.userId === state.currentUser?.id && 
      e.status !== 'completed' &&
      !e.checkOutAt
    );
  }, [state.timeEntries, state.currentUser]);

  const pendingApprovals = useMemo(() => {
    return state.timeEntries.filter(e => 
      e.status === 'pending_check_in' || e.status === 'pending_check_out'
    );
  }, [state.timeEntries]);

  const checkedInStudents = useMemo(() => {
    return state.timeEntries.filter(e => e.status === 'checked_in');
  }, [state.timeEntries]);

  const notCheckedInUsers = useMemo(() => {
    const activeUserIds = state.timeEntries
      .filter(e => e.status === 'checked_in' || e.status === 'pending_check_in' || e.status === 'pending_check_out')
      .map(e => e.userId);
    return state.users.filter(u => !activeUserIds.includes(u.id) && !u.roles.includes(Role.Coach));
  }, [state.timeEntries, state.users]);

  const myEntries = useMemo(() => {
    return state.timeEntries
      .filter(e => e.userId === state.currentUser?.id)
      .sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime());
  }, [state.timeEntries, state.currentUser]);

  const totalHours = useMemo(() => {
    const total = myEntries
      .filter(e => e.status === 'completed' && e.roundedMinutes)
      .reduce((acc, e) => acc + (e.roundedMinutes || 0), 0);
    return total;
  }, [myEntries]);

  const handleCheckIn = async () => {
    try {
      await api.timeEntries.checkIn(currentUserId);
      onRefresh();
    } catch (error) {
      console.error('Check-in failed:', error);
    }
  };

  const handleCheckOut = async () => {
    if (!myOpenEntry) return;
    try {
      await api.timeEntries.checkOut(parseInt(myOpenEntry.id), currentUserId);
      onRefresh();
    } catch (error) {
      console.error('Check-out failed:', error);
    }
  };

  const handleConfirm = async (entryId: string, confirmType: 'check_in' | 'check_out') => {
    try {
      await api.timeEntries.confirm(parseInt(entryId), currentUserId, confirmType);
      onRefresh();
    } catch (error) {
      console.error('Confirm failed:', error);
    }
  };

  const handleCoachCheckOut = async (entryId: string, userId: string) => {
    try {
      await api.timeEntries.checkOut(parseInt(entryId), parseInt(userId));
      onRefresh();
    } catch (error) {
      console.error('Coach check-out failed:', error);
    }
  };

  const handleCoachCheckIn = async (userId: string) => {
    try {
      await api.timeEntries.checkIn(parseInt(userId));
      onRefresh();
    } catch (error) {
      console.error('Coach check-in failed:', error);
    }
  };

  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      checkInAt: toLocalDateTimeString(entry.checkInAt),
      checkOutAt: entry.checkOutAt ? toLocalDateTimeString(entry.checkOutAt) : '',
      notes: entry.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    try {
      await api.timeEntries.update(parseInt(editingEntry.id), currentUserId, {
        checkInAt: new Date(editForm.checkInAt).toISOString(),
        checkOutAt: editForm.checkOutAt ? new Date(editForm.checkOutAt).toISOString() : undefined,
        notes: editForm.notes,
      });
      setEditingEntry(null);
      onRefresh();
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  const openAuditModal = async (entry: TimeEntry) => {
    setAuditEntry(entry);
    try {
      const logs = await api.timeEntries.getAudit(parseInt(entry.id));
      setAuditLogs(logs);
    } catch (error) {
      console.error('Failed to fetch audit:', error);
      setAuditLogs([]);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this time entry? This cannot be undone.')) return;
    try {
      await api.timeEntries.delete(parseInt(entryId), currentUserId);
      onRefresh();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const getUserName = (userId: string) => {
    return state.users.find(u => u.id === userId)?.name || 'Unknown';
  };

  const handleBulkAdd = async () => {
    if (bulkForm.selectedUsers.length === 0 || bulkForm.minutes <= 0) return;
    try {
      await api.timeEntries.bulkAdd(
        currentUserId,
        bulkForm.selectedUsers.map(id => parseInt(id)),
        bulkForm.minutes,
        bulkForm.notes,
        bulkForm.date
      );
      setBulkForm({ selectedUsers: [], minutes: 45, notes: 'Class time', date: new Date().toISOString().split('T')[0], filterRole: '' });
      setShowBulkAdd(false);
      onRefresh();
    } catch (error) {
      console.error('Bulk add failed:', error);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setBulkForm(prev => ({
      ...prev,
      selectedUsers: prev.selectedUsers.includes(userId)
        ? prev.selectedUsers.filter(id => id !== userId)
        : [...prev.selectedUsers, userId]
    }));
  };

  const selectAllUsers = () => {
    const usersToSelect = filteredUsersForBulk;
    const allSelected = usersToSelect.every(u => bulkForm.selectedUsers.includes(u.id));
    setBulkForm(prev => ({
      ...prev,
      selectedUsers: allSelected 
        ? prev.selectedUsers.filter(id => !usersToSelect.some(u => u.id === id))
        : [...new Set([...prev.selectedUsers, ...usersToSelect.map(u => u.id)])]
    }));
  };

  const selectByRole = (role: string) => {
    const usersWithRole = state.users.filter(u => u.roles.includes(role as Role));
    const allSelected = usersWithRole.every(u => bulkForm.selectedUsers.includes(u.id));
    setBulkForm(prev => ({
      ...prev,
      selectedUsers: allSelected
        ? prev.selectedUsers.filter(id => !usersWithRole.some(u => u.id === id))
        : [...new Set([...prev.selectedUsers, ...usersWithRole.map(u => u.id)])]
    }));
  };

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const events = await api.scout.getEvents();
        const active = events.filter((e: any) => !e.archived);
        setCompEvents(active);
        if (active.length > 0 && !selectedCompEventId) {
          setSelectedCompEventId(active[0].id);
        }
      } catch {}
    };
    loadEvents();
  }, []);

  const fetchCompCheckins = async (eventId: number) => {
    if (!eventId) return;
    try {
      const checkins = await api.competitionCheckins.listByEvent(eventId);
      setCompCheckins(checkins);
      const mine = checkins.find((c: any) => c.userId === currentUserId && !c.checkOutAt);
      setMyCompCheckin(mine || null);
    } catch {}
  };

  useEffect(() => {
    if (!selectedCompEventId) return;
    fetchCompCheckins(selectedCompEventId);
    const interval = setInterval(() => fetchCompCheckins(selectedCompEventId!), 15000);
    return () => clearInterval(interval);
  }, [selectedCompEventId, currentUserId]);

  useEffect(() => {
    if (compElapsedRef.current) clearInterval(compElapsedRef.current);
    if (!myCompCheckin) { setCompElapsed(''); return; }
    const tick = () => {
      const ms = Date.now() - new Date(myCompCheckin.checkInAt).getTime();
      const totalMinutes = Math.floor(ms / 60000);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      setCompElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    compElapsedRef.current = setInterval(tick, 30000);
    return () => { if (compElapsedRef.current) clearInterval(compElapsedRef.current); };
  }, [myCompCheckin]);

  const handleCompCheckIn = async () => {
    if (!selectedCompEventId) return;
    setCompLoading(true);
    try {
      await api.competitionCheckins.checkIn(currentUserId, selectedCompEventId);
      await fetchCompCheckins(selectedCompEventId);
    } catch (e: any) {
      alert(e.message || 'Check-in failed');
    } finally {
      setCompLoading(false);
    }
  };

  const handleCompCheckOut = async () => {
    if (!myCompCheckin) return;
    setCompLoading(true);
    try {
      await api.competitionCheckins.checkOut(myCompCheckin.id);
      await fetchCompCheckins(selectedCompEventId!);
    } catch (e: any) {
      alert(e.message || 'Check-out failed');
    } finally {
      setCompLoading(false);
    }
  };

  const handleCompApprove = async () => {
    if (!showApproveModal) return;
    const mins = approveMinutes ? parseInt(approveMinutes) : undefined;
    try {
      await api.competitionCheckins.approve(showApproveModal.id, currentUserId, mins);
      setShowApproveModal(null);
      setApproveMinutes('');
      if (selectedCompEventId) await fetchCompCheckins(selectedCompEventId);
    } catch (e: any) {
      alert(e.message || 'Approve failed');
    }
  };

  const handleCompDelete = async (id: number) => {
    if (!confirm('Delete this competition check-in?')) return;
    try {
      await api.competitionCheckins.delete(id);
      if (selectedCompEventId) await fetchCompCheckins(selectedCompEventId);
    } catch {}
  };

  const selectedCompEvent = compEvents.find(e => e.id === selectedCompEventId);
  const myTodayCompCheckin = selectedCompEventId
    ? compCheckins.find((c: any) => c.userId === currentUserId)
    : null;

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Time Clock</h2>
              <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Track your hours</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Hours</p>
              <p className="text-2xl md:text-3xl font-black text-red-600">{formatDuration(totalHours)}</p>
            </div>
          </div>

          {myOpenEntry ? (
            <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl md:rounded-2xl p-4 md:p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500 text-white rounded-xl md:rounded-2xl flex items-center justify-center animate-pulse">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-black text-green-800 dark:text-green-100 uppercase">Clocked In</p>
                    <p className="text-[10px] md:text-xs text-green-600 dark:text-green-400 font-bold">
                      Since {formatTime(myOpenEntry.checkInAt)} on {formatDate(myOpenEntry.checkInAt)}
                    </p>
                    {myOpenEntry.status === 'pending_check_in' && (
                      <p className="text-[9px] text-orange-600 dark:text-orange-400 font-bold uppercase mt-1">Awaiting coach confirmation</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={myOpenEntry.status === 'pending_check_in'}
                  className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${
                    myOpenEntry.status === 'pending_check_in' 
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
                  }`}
                >
                  <LogOut size={16} /> Check Out
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleCheckIn}
              className="w-full flex items-center justify-center gap-3 py-4 md:py-6 bg-green-600 text-white font-black rounded-xl md:rounded-2xl hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all uppercase tracking-widest text-sm md:text-base mb-6"
            >
              <LogIn size={20} /> Check In
            </button>
          )}

          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="w-full flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-widest"
          >
            <span>My Time History</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-3 max-h-64 overflow-auto">
              {myEntries.slice(0, 20).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                  <div>
                    <p className="text-xs md:text-sm font-black text-slate-800 dark:text-slate-100">{formatDate(entry.checkInAt)}</p>
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold">
                      {formatTime(entry.checkInAt)} - {entry.checkOutAt ? formatTime(entry.checkOutAt) : 'In Progress'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    {entry.status === 'completed' && entry.roundedMinutes && (
                      <span className="text-xs md:text-sm font-black text-green-600 dark:text-green-400">{formatDuration(entry.roundedMinutes)}</span>
                    )}
                    <span className={`text-[8px] md:text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                      entry.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                      entry.status === 'checked_in' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                      'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                    }`}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {myEntries.length === 0 && (
                <p className="text-center text-slate-400 dark:text-slate-500 py-6 text-sm font-bold">No time entries yet</p>
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-950 rounded-2xl md:rounded-[32px] p-6 md:p-8 text-white">
          <div className="flex items-center gap-3 mb-6">
            <Timer size={20} className="text-red-500" />
            <h3 className="text-base md:text-lg font-black uppercase tracking-tight">Quick Stats</h3>
          </div>
          <div className="space-y-4">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">This Week</p>
              <p className="text-2xl font-black">{formatDuration(
                myEntries
                  .filter(e => {
                    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    return new Date(e.checkInAt).getTime() > weekAgo && e.roundedMinutes;
                  })
                  .reduce((acc, e) => acc + (e.roundedMinutes || 0), 0)
              )}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1">Sessions</p>
              <p className="text-2xl font-black">{myEntries.filter(e => e.status === 'completed').length}</p>
            </div>
          </div>
        </div>
      </div>

      {compEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-violet-200 dark:border-violet-700 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 rounded-xl flex items-center justify-center">
                <Trophy size={20} />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Competition Attendance</h3>
                <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold uppercase tracking-widest">Track your time at competition</p>
              </div>
            </div>
            {compEvents.length > 1 && (
              <select
                value={selectedCompEventId || ''}
                onChange={(e) => setSelectedCompEventId(parseInt(e.target.value))}
                className="p-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-xs font-bold outline-none focus:border-violet-600 dark:text-white"
              >
                {compEvents.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
          </div>

          {selectedCompEvent && (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <MapPin size={12} className="text-slate-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate">
                {selectedCompEvent.name}{selectedCompEvent.location ? ` • ${selectedCompEvent.location}` : ''}
              </span>
            </div>
          )}

          {!isCoach && (
            <div>
              {(() => {
                const myCheckin = compCheckins.find((c: any) => c.userId === currentUserId);
                if (!myCheckin) {
                  return (
                    <button
                      onClick={handleCompCheckIn}
                      disabled={compLoading}
                      className="w-full flex items-center justify-center gap-3 py-4 md:py-5 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-600/20 transition-all uppercase tracking-widest text-sm disabled:opacity-50"
                    >
                      <Flag size={18} /> Check In to Competition
                    </button>
                  );
                }
                if (myCheckin.status === 'checked_in') {
                  return (
                    <div className="bg-violet-50 dark:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-700 rounded-xl p-4 md:p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-violet-500 text-white rounded-xl flex items-center justify-center animate-pulse">
                            <Trophy size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-violet-800 dark:text-violet-100 uppercase">At Competition</p>
                            <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">Since {formatTime(myCheckin.checkInAt)}</p>
                            {compElapsed && <p className="text-xs font-black text-violet-700 dark:text-violet-300 mt-0.5">{compElapsed} elapsed</p>}
                          </div>
                        </div>
                        <button
                          onClick={handleCompCheckOut}
                          disabled={compLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50"
                        >
                          <LogOut size={14} /> Check Out
                        </button>
                      </div>
                    </div>
                  );
                }
                if (myCheckin.status === 'pending_approval') {
                  return (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-xl p-4 text-center">
                      <p className="text-xs font-black text-orange-700 dark:text-orange-300 uppercase">Checked Out — Awaiting Coach Approval</p>
                      <p className="text-[10px] text-orange-500 font-bold mt-1">
                        {formatTime(myCheckin.checkInAt)} – {myCheckin.checkOutAt ? formatTime(myCheckin.checkOutAt) : ''}
                      </p>
                    </div>
                  );
                }
                if (myCheckin.status === 'approved') {
                  return (
                    <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-xl p-4 text-center">
                      <p className="text-xs font-black text-green-700 dark:text-green-300 uppercase">Attendance Approved</p>
                      {myCheckin.roundedMinutes && (
                        <p className="text-2xl font-black text-green-600 dark:text-green-400 mt-1">{formatDuration(myCheckin.roundedMinutes)}</p>
                      )}
                      <p className="text-[10px] text-green-500 font-bold mt-1">
                        Approved by {myCheckin.approvedByName || 'coach'}
                      </p>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}

          {isCoach && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{compCheckins.length} attendance records</p>
              </div>
              {compCheckins.length === 0 && (
                <p className="text-center text-slate-400 dark:text-slate-500 py-6 text-sm font-bold">No check-ins yet for this event</p>
              )}
              {compCheckins.map((checkin: any) => (
                <div key={checkin.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 dark:bg-violet-900/30 rounded-xl flex items-center justify-center font-black text-violet-700 dark:text-violet-300">
                      {(checkin.userName || 'U')[0]}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 dark:text-slate-100">{checkin.userName || `User ${checkin.userId}`}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                        {formatTime(checkin.checkInAt)}
                        {checkin.checkOutAt ? ` – ${formatTime(checkin.checkOutAt)}` : ' (still here)'}
                        {checkin.roundedMinutes ? ` • ${formatDuration(checkin.roundedMinutes)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                      checkin.status === 'approved' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                      checkin.status === 'pending_approval' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                      'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                    }`}>
                      {checkin.status === 'checked_in' ? 'Present' : checkin.status === 'pending_approval' ? 'Pending' : 'Approved'}
                    </span>
                    {checkin.status === 'pending_approval' && (
                      <button
                        onClick={() => {
                          const dur = checkin.checkOutAt
                            ? Math.ceil((new Date(checkin.checkOutAt).getTime() - new Date(checkin.checkInAt).getTime()) / 60000)
                            : 0;
                          setApproveMinutes(String(Math.ceil(dur / 15) * 15));
                          setShowApproveModal(checkin);
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                      >
                        <Check size={12} /> Approve
                      </button>
                    )}
                    {checkin.status === 'checked_in' && (
                      <button
                        onClick={async () => {
                          try {
                            await api.competitionCheckins.checkOut(checkin.id);
                            if (selectedCompEventId) await fetchCompCheckins(selectedCompEventId);
                          } catch {}
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-orange-600 transition-all"
                      >
                        <LogOut size={12} /> Check Out
                      </button>
                    )}
                    <button
                      onClick={() => handleCompDelete(checkin.id)}
                      className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showApproveModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border-t-8 border-green-500">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Approve Attendance</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{showApproveModal.userName}</p>
              </div>
              <button onClick={() => setShowApproveModal(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors"><X size={16} /></button>
            </div>
            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Approved Minutes (rounded)</label>
              <input
                type="number"
                value={approveMinutes}
                onChange={(e) => setApproveMinutes(e.target.value)}
                step="15"
                min="0"
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-green-500 dark:text-white font-bold"
              />
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowApproveModal(null)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-xs uppercase hover:bg-slate-200 transition-all">Cancel</button>
              <button onClick={handleCompApprove} className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl text-xs uppercase hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all">Approve</button>
            </div>
          </div>
        </div>
      )}

      {isCoach && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-blue-200 dark:border-blue-700 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Bulk Add Time</h3>
                <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest">Add class time for multiple members</p>
              </div>
            </div>
            <button
              onClick={() => setShowBulkAdd(!showBulkAdd)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-blue-700 transition-all"
            >
              <Plus size={14} /> {showBulkAdd ? 'Hide' : 'Add Time'}
            </button>
          </div>

          {showBulkAdd && (
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Quick Select by Role</label>
                <div className="flex flex-wrap gap-2">
                  {[Role.ClassMember, Role.TeamMember, Role.DepartmentHead, Role.TeamCaptain, Role.ScrumMaster].map(role => {
                    const usersWithRole = state.users.filter(u => u.roles.includes(role));
                    const allSelected = usersWithRole.length > 0 && usersWithRole.every(u => bulkForm.selectedUsers.includes(u.id));
                    return (
                      <button
                        key={role}
                        onClick={() => selectByRole(role)}
                        disabled={usersWithRole.length === 0}
                        className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                          usersWithRole.length === 0
                            ? 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 cursor-not-allowed'
                            : allSelected
                              ? 'bg-green-600 text-white'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 hover:text-blue-700 dark:hover:text-blue-300'
                        }`}
                      >
                        {role} ({usersWithRole.length})
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={selectAllUsers}
                  className={`p-3 rounded-xl border-2 text-xs font-black uppercase transition-all ${
                    bulkForm.selectedUsers.length === state.users.length
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-400'
                  }`}
                >
                  {bulkForm.selectedUsers.length === state.users.length ? 'Deselect All' : 'Select All'}
                </button>
                {state.users.map(user => (
                  <button
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className={`p-3 rounded-xl border-2 text-xs font-bold transition-all truncate ${
                      bulkForm.selectedUsers.includes(user.id)
                        ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-200'
                    }`}
                  >
                    {user.name.split(' ')[0]}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Minutes</label>
                  <input
                    type="number"
                    value={bulkForm.minutes}
                    onChange={(e) => setBulkForm({ ...bulkForm, minutes: parseInt(e.target.value) || 0 })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-blue-600 dark:text-white font-bold"
                    min="1"
                    step="15"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Date</label>
                  <input
                    type="date"
                    value={bulkForm.date}
                    onChange={(e) => setBulkForm({ ...bulkForm, date: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-blue-600 dark:text-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Notes</label>
                  <input
                    type="text"
                    value={bulkForm.notes}
                    onChange={(e) => setBulkForm({ ...bulkForm, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-blue-600 dark:text-white font-bold"
                    placeholder="Class time"
                  />
                </div>
              </div>

              <button
                onClick={handleBulkAdd}
                disabled={bulkForm.selectedUsers.length === 0 || bulkForm.minutes <= 0}
                className={`w-full py-4 font-black rounded-xl uppercase tracking-widest text-sm transition-all ${
                  bulkForm.selectedUsers.length === 0 || bulkForm.minutes <= 0
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                }`}
              >
                Add {bulkForm.minutes} Minutes to {bulkForm.selectedUsers.length} Members
              </button>
            </div>
          )}
        </div>
      )}

      {isCoach && pendingApprovals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-orange-200 dark:border-orange-700 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-xl flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Pending Approvals</h3>
              <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-widest">{pendingApprovals.length} entries need confirmation</p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingApprovals.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 dark:bg-slate-600 rounded-xl flex items-center justify-center font-black text-slate-600 dark:text-slate-300">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{getUserName(entry.userId)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      {formatDate(entry.checkInAt)} • {formatTime(entry.checkInAt)}
                      {entry.checkOutAt && ` - ${formatTime(entry.checkOutAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                    entry.status === 'pending_check_in' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                  }`}>
                    {entry.status === 'pending_check_in' ? 'Check-In' : 'Check-Out'}
                  </span>
                  <button
                    onClick={() => handleConfirm(entry.id, entry.status === 'pending_check_in' ? 'check_in' : 'check_out')}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={() => openEditModal(entry)}
                    className="p-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => openAuditModal(entry)}
                    className="p-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
                  >
                    <History size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-all"
                    title="Delete Entry"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCoach && checkedInStudents.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-green-200 dark:border-green-700 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Currently Checked In</h3>
              <p className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-widest">{checkedInStudents.length} students working</p>
            </div>
          </div>

          <div className="space-y-3">
            {checkedInStudents.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-green-200 dark:bg-green-900/40 rounded-xl flex items-center justify-center font-black text-green-700 dark:text-green-300">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100">{getUserName(entry.userId)}</p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                      Checked in at {formatTime(entry.checkInAt)} • {formatDate(entry.checkInAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-black px-2 py-1 rounded-lg uppercase bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300">
                    Active
                  </span>
                  <button
                    onClick={() => handleCoachCheckOut(entry.id, entry.userId)}
                    className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                  >
                    <LogOut size={12} /> Check Out
                  </button>
                  <button
                    onClick={() => openEditModal(entry)}
                    className="p-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCoach && notCheckedInUsers.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-200 dark:border-slate-700 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Not Checked In</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{notCheckedInUsers.length} students available</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {notCheckedInUsers.map(user => (
              <div key={user.id} className="flex items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center font-black text-sm text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {user.name[0]}
                  </div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user.name.split(' ')[0]}</p>
                </div>
                <button
                  onClick={() => handleCoachCheckIn(user.id)}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all flex-shrink-0 shadow-lg shadow-green-600/20"
                  title="Check In"
                >
                  <LogIn size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCoach && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-6">All Time Entries</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {state.timeEntries.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 hover:border-slate-200 dark:hover:border-slate-500 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-300">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-100">{getUserName(entry.userId)}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400">
                      {formatDate(entry.checkInAt)} • {formatTime(entry.checkInAt)}
                      {entry.checkOutAt && ` - ${formatTime(entry.checkOutAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {entry.roundedMinutes && (
                    <span className="text-xs font-black text-green-600 dark:text-green-400">{formatDuration(entry.roundedMinutes)}</span>
                  )}
                  <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${
                    entry.status === 'completed' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                    entry.status === 'checked_in' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' :
                    'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                  }`}>
                    {entry.status.replace('_', ' ')}
                  </span>
                  <button onClick={() => openEditModal(entry)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <Edit3 size={12} />
                  </button>
                  <button onClick={() => openAuditModal(entry)} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                    <History size={12} />
                  </button>
                  <button onClick={() => handleDelete(entry.id)} className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
            {state.timeEntries.length === 0 && (
              <p className="text-center text-slate-400 dark:text-slate-500 py-8 font-bold">No time entries recorded yet</p>
            )}
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Edit Time Entry</h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase">{getUserName(editingEntry.userId)}</p>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Check In</label>
                <input
                  type="datetime-local"
                  value={editForm.checkInAt}
                  onChange={(e) => setEditForm({ ...editForm, checkInAt: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Check Out</label>
                <input
                  type="datetime-local"
                  value={editForm.checkOutAt}
                  onChange={(e) => setEditForm({ ...editForm, checkOutAt: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium h-20 resize-none"
                  placeholder="Optional notes..."
                />
              </div>
              <button
                onClick={handleSaveEdit}
                className="w-full py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 uppercase tracking-widest text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {auditEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Audit Log</h2>
                <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase">{getUserName(auditEntry.userId)} - {formatDate(auditEntry.checkInAt)}</p>
              </div>
              <button onClick={() => setAuditEntry(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto space-y-3">
              {auditLogs.map(log => (
                <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-red-600 uppercase">{log.actionType.replace('_', ' ')}</span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                      {new Date(log.createdAt).toLocaleString([], { timeZone: 'America/Los_Angeles' })}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">By: {getUserName(log.actorId)}</p>
                  {log.deltaMinutes !== undefined && log.deltaMinutes !== null && (
                    <p className={`text-xs font-black mt-1 ${log.deltaMinutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {log.deltaMinutes >= 0 ? '+' : ''}{log.deltaMinutes} minutes
                    </p>
                  )}
                  {log.previousValues && Object.keys(log.previousValues).length > 0 && (
                    <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-bold">Previous:</span> {JSON.stringify(log.previousValues)}
                    </div>
                  )}
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p className="text-center text-slate-400 dark:text-slate-500 py-6 font-bold">No audit records</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTracking;
