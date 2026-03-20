import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, TimeEntry, TimeEntryAudit, Role, AvailableTask, GeneralTask, TimeEntryWithTaskInfo } from '../types';
import { Clock, LogIn, LogOut, Check, X, Edit3, History, AlertCircle, ChevronDown, ChevronUp, Users, Plus, Trash2, Trophy, MapPin, Flag, Briefcase, ListChecks, CheckSquare, Square, Loader2, Pencil, Archive } from 'lucide-react';
import { api } from '../services/api';
import { PRIORITY_COLORS } from '../constants';

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
  const [showNotCheckedIn, setShowNotCheckedIn] = useState(false);
  const [showAllEntries, setShowAllEntries] = useState(false);

  const [compEvents, setCompEvents] = useState<any[]>([]);
  const [selectedCompEventId, setSelectedCompEventId] = useState<number | null>(null);
  const [compCheckins, setCompCheckins] = useState<any[]>([]);
  const [myCompCheckin, setMyCompCheckin] = useState<any | null>(null);
  const [compElapsed, setCompElapsed] = useState<string>('');
  const [compLoading, setCompLoading] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState<any | null>(null);
  const [approveMinutes, setApproveMinutes] = useState('');
  const compElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualAddForm, setManualAddForm] = useState({ userId: '', minutes: '60', notes: '' });
  const [compAuditModal, setCompAuditModal] = useState<{ checkinId: number; userName: string } | null>(null);
  const [compAuditLogs, setCompAuditLogs] = useState<any[]>([]);
  const [compAuditLoading, setCompAuditLoading] = useState(false);

  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [taskPickerLoading, setTaskPickerLoading] = useState(false);
  const [availableAssignedTasks, setAvailableAssignedTasks] = useState<AvailableTask[]>([]);
  const [availableOpenTasks, setAvailableOpenTasks] = useState<AvailableTask[]>([]);
  const [availableGeneralTasks, setAvailableGeneralTasks] = useState<GeneralTask[]>([]);
  const [pickerSelectedTaskId, setPickerSelectedTaskId] = useState<number | null>(null);
  const [pickerSelectedGeneralTaskId, setPickerSelectedGeneralTaskId] = useState<number | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<number | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);

  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [checkoutHandoffNote, setCheckoutHandoffNote] = useState('');
  const [checkoutMarkComplete, setCheckoutMarkComplete] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [showGenTaskSettings, setShowGenTaskSettings] = useState(false);
  const [genTasks, setGenTasks] = useState<GeneralTask[]>([]);
  const [genTasksLoading, setGenTasksLoading] = useState(false);
  const [genTaskForm, setGenTaskForm] = useState({ name: '', description: '' });
  const [editingGenTask, setEditingGenTask] = useState<GeneralTask | null>(null);
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
  const isCoachOrCaptain = useMemo(() => state.currentUser?.roles.some(r => [Role.Coach, Role.TeamCaptain].includes(r as Role)), [state.currentUser]);
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
    setCheckInLoading(true);
    setPickerSelectedTaskId(null);
    setPickerSelectedGeneralTaskId(null);
    try {
      const entry = await api.timeEntries.checkIn(currentUserId);
      const entryId = parseInt(entry.id);
      setPendingEntryId(entryId);
      setShowTaskPicker(true);
      setTaskPickerLoading(true);
      const [allAvailableTasks, generalTaskList] = await Promise.all([
        api.timeEntries.availableTasks(currentUserId),
        api.generalTasks.getAll(false),
      ]);
      setAvailableAssignedTasks(allAvailableTasks.filter((t: AvailableTask) => t.isAssigned));
      setAvailableOpenTasks(allAvailableTasks.filter((t: AvailableTask) => !t.isAssigned));
      setAvailableGeneralTasks(generalTaskList);
    } catch (error) {
      console.error('Check-in failed:', error);
      onRefresh();
    } finally {
      setCheckInLoading(false);
      setTaskPickerLoading(false);
    }
  };

  const handlePickTask = async (taskId: number | null, generalTaskId: number | null) => {
    if (pendingEntryId !== null && (taskId !== null || generalTaskId !== null)) {
      try {
        await api.timeEntries.setWorkingOn(pendingEntryId, currentUserId, taskId, generalTaskId);
      } catch (error) {
        console.error('Set working on failed:', error);
      }
    }
    setShowTaskPicker(false);
    setPendingEntryId(null);
    onRefresh();
  };

  const openCheckoutModal = () => {
    if (!myOpenEntry) return;
    if (myOpenEntry.workingOnTaskId || myOpenEntry.workingOnGeneralTaskId) {
      setCheckoutHandoffNote('');
      setCheckoutMarkComplete(false);
      setShowCheckoutModal(true);
    } else {
      handleCheckOut();
    }
  };

  const handleCheckOut = async (handoffNote?: string, markComplete?: boolean) => {
    if (!myOpenEntry) return;
    setCheckoutLoading(true);
    try {
      await api.timeEntries.checkOut(parseInt(myOpenEntry.id), currentUserId, {
        taskHandoffNote: handoffNote,
        markTaskComplete: markComplete,
      });
      setShowCheckoutModal(false);
      onRefresh();
    } catch (error) {
      console.error('Check-out failed:', error);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const loadGenTasks = async () => {
    setGenTasksLoading(true);
    try {
      const items = await api.generalTasks.getAll(true, currentUserId);
      setGenTasks(items);
    } catch {
      setGenTasks([]);
    } finally {
      setGenTasksLoading(false);
    }
  };

  const handleSaveGenTask = async () => {
    if (!genTaskForm.name.trim()) return;
    try {
      if (editingGenTask) {
        await api.generalTasks.update(editingGenTask.id, { name: genTaskForm.name, description: genTaskForm.description || '' }, currentUserId);
      } else {
        await api.generalTasks.create(genTaskForm.name, genTaskForm.description || '', currentUserId);
      }
      setGenTaskForm({ name: '', description: '' });
      setEditingGenTask(null);
      loadGenTasks();
    } catch (error) {
      console.error('Save gen task failed:', error);
    }
  };

  const handleToggleGenTaskActive = async (task: any) => {
    try {
      await api.generalTasks.update(task.id, { active: !task.active }, currentUserId);
      loadGenTasks();
    } catch (error) {
      console.error('Toggle gen task failed:', error);
    }
  };

  const handleDeleteGenTask = async (id: number) => {
    if (!window.confirm('Delete this general task permanently?')) return;
    try {
      await api.generalTasks.delete(id, currentUserId);
      loadGenTasks();
    } catch (error) {
      console.error('Delete gen task failed:', error);
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
        const today = new Date().toISOString().slice(0, 10);
        const active = events.filter((e: any) =>
          !e.archived && (!e.endDate || e.endDate >= today)
        );
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
    const openCheckin = compCheckins.find((c: any) => c.userId === currentUserId && c.status === 'checked_in' && !c.checkOutAt);
    if (!openCheckin) return;
    setCompLoading(true);
    try {
      await api.competitionCheckins.checkOut(openCheckin.id);
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
    if (!confirm('Delete this competition check-in record?')) return;
    try {
      await api.competitionCheckins.delete(id, currentUserId);
      if (selectedCompEventId) await fetchCompCheckins(selectedCompEventId);
    } catch (e: any) { alert(e.message || 'Delete failed'); }
  };

  const openCompAudit = async (checkinId: number, userName: string) => {
    setCompAuditModal({ checkinId, userName });
    setCompAuditLoading(true);
    try {
      const logs = await api.competitionCheckins.getAudit(checkinId);
      setCompAuditLogs(logs);
    } catch { setCompAuditLogs([]); }
    finally { setCompAuditLoading(false); }
  };

  const handleManualAdd = async () => {
    if (!manualAddForm.userId || !manualAddForm.minutes || !selectedCompEventId) return;
    try {
      await api.competitionCheckins.manualAdd(
        currentUserId,
        parseInt(manualAddForm.userId),
        selectedCompEventId,
        parseInt(manualAddForm.minutes),
        manualAddForm.notes || undefined
      );
      setShowManualAdd(false);
      setManualAddForm({ userId: '', minutes: '60', notes: '' });
      await fetchCompCheckins(selectedCompEventId);
    } catch (e: any) { alert(e.message || 'Manual add failed'); }
  };

  const selectedCompEvent = compEvents.find(e => e.id === selectedCompEventId);

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 md:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-slate-400" />
            <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Time Clock</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Week — <span className="text-slate-700 dark:text-slate-200 font-black">{formatDuration(myEntries.filter(e => { const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000; return new Date(e.checkInAt).getTime() > weekAgo && e.roundedMinutes; }).reduce((acc, e) => acc + (e.roundedMinutes || 0), 0))}</span>
            </span>
            <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-400">
              Sessions — <span className="text-slate-700 dark:text-slate-200 font-black">{myEntries.filter(e => e.status === 'completed').length}</span>
            </span>
            <span className="px-2.5 py-1 bg-red-50 dark:bg-red-900/20 rounded-lg text-[10px] font-black text-red-600 dark:text-red-400">
              Total — {formatDuration(totalHours)}
            </span>
          </div>
        </div>

        {myOpenEntry ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 bg-green-500 text-white rounded-lg flex items-center justify-center animate-pulse shrink-0">
                  <Clock size={15} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black text-green-800 dark:text-green-100 uppercase">Clocked In</p>
                  <p className="text-[10px] text-green-600 dark:text-green-400 font-bold">
                    Since {formatTime(myOpenEntry.checkInAt)} on {formatDate(myOpenEntry.checkInAt)}
                  </p>
                  {myOpenEntry.workingOnTaskTitle && (
                    <p className="text-[9px] text-blue-600 dark:text-blue-400 font-bold mt-0.5 flex items-center gap-1 truncate">
                      <Briefcase size={9} /> {myOpenEntry.workingOnTaskTitle}
                    </p>
                  )}
                  {myOpenEntry.workingOnGeneralTaskName && (
                    <p className="text-[9px] text-violet-600 dark:text-violet-400 font-bold mt-0.5 flex items-center gap-1 truncate">
                      <ListChecks size={9} /> {myOpenEntry.workingOnGeneralTaskName}
                    </p>
                  )}
                  {myOpenEntry.status === 'pending_check_in' && (
                    <p className="text-[9px] text-orange-600 dark:text-orange-400 font-bold uppercase mt-1">Awaiting coach confirmation</p>
                  )}
                </div>
              </div>
              <button
                onClick={openCheckoutModal}
                disabled={myOpenEntry.status === 'pending_check_in' || checkoutLoading}
                className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${
                  myOpenEntry.status === 'pending_check_in' 
                    ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                    : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
                }`}
              >
                <LogOut size={14} /> Check Out
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCheckIn}
            disabled={checkInLoading}
            className="w-full flex items-center justify-center gap-3 py-4 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 transition-all uppercase tracking-widest text-sm mb-4 disabled:opacity-70"
          >
            {checkInLoading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            Check In
          </button>
        )}

        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl text-slate-500 dark:text-slate-400 font-bold text-xs uppercase tracking-widest"
        >
          <span>My Time History</span>
          {showHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showHistory && (
          <div className="mt-3 space-y-2 max-h-64 overflow-auto">
            {myEntries.slice(0, 20).map(entry => (
              <div key={entry.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                <div>
                  <p className="text-xs font-black text-slate-800 dark:text-slate-100">{formatDate(entry.checkInAt)}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {formatTime(entry.checkInAt)} - {entry.checkOutAt ? formatTime(entry.checkOutAt) : 'In Progress'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {entry.status === 'completed' && entry.roundedMinutes && (
                    <span className="text-xs font-black text-green-600 dark:text-green-400">{formatDuration(entry.roundedMinutes)}</span>
                  )}
                  <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${
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

      {compEvents.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 border-l-4 border-l-violet-400 p-4 md:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Trophy size={15} className="text-violet-500" />
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Competition Attendance</h3>
            </div>
            {compEvents.length > 1 && (
              <select
                value={selectedCompEventId || ''}
                onChange={(e) => setSelectedCompEventId(parseInt(e.target.value))}
                className="p-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold outline-none focus:border-violet-500 dark:text-white"
              >
                {compEvents.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
          </div>

          {selectedCompEvent && (
            <div className="flex items-center gap-2 mb-4 px-3 py-1.5 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
              <MapPin size={11} className="text-slate-400 flex-shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate">
                {selectedCompEvent.name}{selectedCompEvent.location ? ` • ${selectedCompEvent.location}` : ''}
              </span>
            </div>
          )}

          {!isCoach && (
            <div className="space-y-4">
              {(() => {
                const myCheckins = compCheckins.filter((c: any) => c.userId === currentUserId);
                const openCheckin = myCheckins.find((c: any) => c.status === 'checked_in' && !c.checkOutAt);
                const pendingCheckin = myCheckins.find((c: any) => c.status === 'pending_approval');
                const today = new Date().toISOString().slice(0, 10);
                const eventStarted = !selectedCompEvent?.startDate || selectedCompEvent.startDate <= today;
                const canCheckIn = !openCheckin && !pendingCheckin && eventStarted;
                return (
                  <>
                    {!eventStarted && !openCheckin && !pendingCheckin && (
                      <div className="w-full py-4 text-center bg-slate-50 dark:bg-slate-700/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-600">
                        <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase">Event starts {selectedCompEvent?.startDate}</p>
                      </div>
                    )}
                    {canCheckIn && (
                      <button
                        onClick={handleCompCheckIn}
                        disabled={compLoading}
                        className="w-full flex items-center justify-center gap-3 py-4 md:py-5 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 shadow-lg shadow-violet-600/20 transition-all uppercase tracking-widest text-sm disabled:opacity-50"
                      >
                        <Flag size={18} /> Check In to Competition
                      </button>
                    )}
                    {openCheckin && (
                      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-violet-500 text-white rounded-lg flex items-center justify-center animate-pulse">
                              <Trophy size={15} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-violet-800 dark:text-violet-100 uppercase">At Competition</p>
                              <p className="text-[10px] text-violet-600 dark:text-violet-400 font-bold">Since {formatTime(openCheckin.checkInAt)}</p>
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
                    )}
                    {pendingCheckin && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-center">
                        <p className="text-xs font-black text-orange-700 dark:text-orange-300 uppercase">Checked Out — Awaiting Coach Approval</p>
                        <p className="text-[10px] text-orange-500 font-bold mt-1">
                          {formatTime(pendingCheckin.checkInAt)} – {pendingCheckin.checkOutAt ? formatTime(pendingCheckin.checkOutAt) : ''}
                        </p>
                      </div>
                    )}
                    {myCheckins.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Your Sessions This Event</p>
                        {myCheckins.map((c: any) => (
                          <div key={c.id} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                              {formatTime(c.checkInAt)}{c.checkOutAt ? ` → ${formatTime(c.checkOutAt)}` : ' (open)'}
                              {c.roundedMinutes ? ` • ${formatDuration(c.roundedMinutes)}` : ''}
                            </p>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase ${
                              c.status === 'approved' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                              c.status === 'pending_approval' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                              c.status === 'rejected' ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400' :
                              'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300'
                            }`}>
                              {c.status === 'checked_in' ? 'Present' : c.status === 'pending_approval' ? 'Pending' : c.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {isCoach && (() => {
            const memberRows = state.users.map(user => {
              const uid = parseInt(user.id);
              const sessions = compCheckins.filter((c: any) => c.userId === uid);
              const openSession = sessions.find((c: any) => c.status === 'checked_in' && !c.checkOutAt);
              const pendingSession = sessions.find((c: any) => c.status === 'pending_approval');
              const latestApproved = sessions.filter((c: any) => c.status === 'approved').sort(
                (a: any, b: any) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime()
              )[0];
              const activeSession = openSession || pendingSession;
              const displayStatus = openSession ? 'checked_in' : pendingSession ? 'pending_approval' : latestApproved ? 'approved' : 'not_checked_in';
              return { user, uid, sessions, openSession, pendingSession, latestApproved, activeSession, displayStatus };
            });
            const present = memberRows.filter(r => r.displayStatus === 'checked_in');
            const pending = memberRows.filter(r => r.displayStatus === 'pending_approval');
            const approved = memberRows.filter(r => r.displayStatus === 'approved');
            const absent = memberRows.filter(r => r.displayStatus === 'not_checked_in');

            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex gap-3 text-[10px] font-black uppercase">
                    <span className="text-violet-600 dark:text-violet-400">{present.length} present</span>
                    <span className="text-orange-500">{pending.length} pending</span>
                    <span className="text-green-600 dark:text-green-400">{approved.length} approved</span>
                    <span className="text-slate-400">{absent.length} absent</span>
                  </div>
                  <button
                    onClick={() => setShowManualAdd(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 text-white rounded-xl font-black text-[10px] uppercase hover:bg-violet-700 shadow-lg shadow-violet-600/20 transition-all"
                  >
                    <Plus size={12} /> Manual Add
                  </button>
                </div>

                {memberRows.length === 0 && (
                  <p className="text-center text-slate-400 dark:text-slate-500 py-6 text-sm font-bold">No team members found</p>
                )}

                {memberRows.map(({ user, openSession, pendingSession, latestApproved, displayStatus }) => (
                  <div key={user.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2 px-1 border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0 ${
                        displayStatus === 'checked_in' ? 'bg-violet-500 text-white' :
                        displayStatus === 'pending_approval' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                        displayStatus === 'approved' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                        'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                      }`}>
                        {(user.name || user.username || 'U')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user.name || user.username}</p>
                        <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                          {openSession ? `Since ${formatTime(openSession.checkInAt)}` :
                           pendingSession ? `${formatTime(pendingSession.checkInAt)} → ${pendingSession.checkOutAt ? formatTime(pendingSession.checkOutAt) : '?'}` :
                           latestApproved ? `${formatDuration(latestApproved.roundedMinutes)} approved` :
                           'Not checked in'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                        displayStatus === 'checked_in' ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300' :
                        displayStatus === 'pending_approval' ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                        displayStatus === 'approved' ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' :
                        'bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                      }`}>
                        {displayStatus === 'checked_in' ? 'Present' :
                         displayStatus === 'pending_approval' ? 'Pending' :
                         displayStatus === 'approved' ? 'Approved' : 'Absent'}
                      </span>
                      {pendingSession && (
                        <>
                          <button
                            onClick={() => {
                              const dur = pendingSession.checkOutAt
                                ? Math.ceil((new Date(pendingSession.checkOutAt).getTime() - new Date(pendingSession.checkInAt).getTime()) / 60000)
                                : 0;
                              setApproveMinutes(String(Math.ceil(dur / 15) * 15));
                              setShowApproveModal({ ...pendingSession, userName: user.name || user.username });
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-green-700 transition-all shadow-lg shadow-green-600/20"
                          >
                            <Check size={12} /> Approve
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await api.competitionCheckins.reject(pendingSession.id, currentUserId);
                                if (selectedCompEventId) await fetchCompCheckins(selectedCompEventId);
                              } catch (e: any) { alert(e.message || 'Reject failed'); }
                            }}
                            className="flex items-center gap-1 px-3 py-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg font-bold text-[10px] uppercase hover:bg-red-200 dark:hover:bg-red-900/60 transition-all"
                          >
                            <X size={12} /> Reject
                          </button>
                        </>
                      )}
                      {openSession && (
                        <button
                          onClick={async () => {
                            try {
                              await api.competitionCheckins.checkOut(openSession.id);
                              if (selectedCompEventId) await fetchCompCheckins(selectedCompEventId);
                            } catch {}
                          }}
                          className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-orange-600 transition-all"
                        >
                          <LogOut size={12} /> Check Out
                        </button>
                      )}
                      {(openSession || pendingSession || latestApproved) && (
                        <>
                          <button
                            onClick={() => openCompAudit(
                              (openSession || pendingSession || latestApproved)!.id,
                              user.name || user.username || 'Member'
                            )}
                            className="p-2 bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-500 transition-all"
                            title="View audit trail"
                          >
                            <History size={14} />
                          </button>
                          <button
                            onClick={() => handleCompDelete((openSession || pendingSession || latestApproved)!.id)}
                            className="p-2 bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/60 transition-all"
                            title="Delete record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
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
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Approved Minutes (rounded to 15)</label>
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

      {showManualAdd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl border-t-8 border-violet-500">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Manual Add Time</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{selectedCompEvent?.name}</p>
              </div>
              <button onClick={() => setShowManualAdd(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors"><X size={16} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Member</label>
                <select
                  value={manualAddForm.userId}
                  onChange={(e) => setManualAddForm(f => ({ ...f, userId: e.target.value }))}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-violet-500 dark:text-white font-bold"
                >
                  <option value="">Select member...</option>
                  {state.users.filter(u => u.id !== String(currentUserId)).map(u => (
                    <option key={u.id} value={u.id}>{u.name || u.username}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Minutes</label>
                <input
                  type="number"
                  value={manualAddForm.minutes}
                  onChange={(e) => setManualAddForm(f => ({ ...f, minutes: e.target.value }))}
                  step="15"
                  min="15"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-violet-500 dark:text-white font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Notes (optional)</label>
                <input
                  type="text"
                  value={manualAddForm.notes}
                  onChange={(e) => setManualAddForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. arrived early setup"
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-violet-500 dark:text-white font-bold"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowManualAdd(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-xs uppercase hover:bg-slate-200 transition-all">Cancel</button>
              <button
                onClick={handleManualAdd}
                disabled={!manualAddForm.userId || !manualAddForm.minutes}
                className="flex-1 py-3 bg-violet-600 text-white font-black rounded-xl text-xs uppercase hover:bg-violet-700 shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
              >
                Add Approved Time
              </button>
            </div>
          </div>
        </div>
      )}

      {compAuditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl border-t-8 border-slate-500">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase">Competition Audit Trail</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase">{compAuditModal.userName}</p>
              </div>
              <button onClick={() => setCompAuditModal(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors"><X size={16} /></button>
            </div>
            {compAuditLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : compAuditLogs.length === 0 ? (
              <p className="text-center text-slate-400 dark:text-slate-500 py-6 text-sm font-bold">No audit records found</p>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {compAuditLogs.map((log: any) => (
                  <div key={log.id} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-violet-600 dark:text-violet-400">
                          {log.actionType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">
                          by {log.actorName}
                        </p>
                        {log.newValues && Object.keys(log.newValues).length > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            {Object.entries(log.newValues).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                          </p>
                        )}
                      </div>
                      <p className="text-[9px] text-slate-400 font-bold whitespace-nowrap flex-shrink-0">
                        {new Date(log.createdAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {isCoachOrCaptain && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-0">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Coach Tools</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setShowGenTaskSettings(true); loadGenTasks(); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg font-bold text-xs uppercase hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300 transition-all"
              >
                <ListChecks size={13} /> Manage Tasks
              </button>
              {isCoach && (
                <button
                  onClick={() => setShowBulkAdd(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-xs uppercase hover:bg-blue-700 transition-all"
                >
                  <Plus size={13} /> Bulk Add Time
                </button>
              )}
            </div>
          </div>

          {isCoach && showBulkAdd && (
            <div className="space-y-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Quick Select by Role</label>
                <button onClick={() => setShowBulkAdd(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors" title="Close"><X size={14} /></button>
              </div>
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={15} className="text-orange-500" />
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Pending Approvals</h3>
            <span className="ml-auto text-[9px] font-black px-2 py-0.5 bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400 rounded-md uppercase">{pendingApprovals.length} pending</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {pendingApprovals.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-slate-200 dark:bg-slate-600 rounded-lg flex items-center justify-center font-black text-xs text-slate-600 dark:text-slate-300 flex-shrink-0">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getUserName(entry.userId)}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-4 md:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-green-500" />
            <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Currently Checked In</h3>
            <span className="ml-auto text-[9px] font-black px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-md uppercase">{checkedInStudents.length} active</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {checkedInStudents.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center font-black text-xs text-green-700 dark:text-green-300 flex-shrink-0">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{getUserName(entry.userId)}</p>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">
                      Since {formatTime(entry.checkInAt)} • {formatDate(entry.checkInAt)}
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
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setShowNotCheckedIn(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400 flex-shrink-0" />
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Not Checked In</h3>
              <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md uppercase">{notCheckedInUsers.length}</span>
            </div>
            {showNotCheckedIn ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
          </button>

          {showNotCheckedIn && (
            <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 animate-in slide-in-from-top-1 fade-in duration-200">
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
          )}
        </div>
      )}

      {isCoach && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setShowAllEntries(v => !v)}
            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History size={15} className="text-slate-400 flex-shrink-0" />
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">All Time Entries</h3>
              <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md uppercase">{state.timeEntries.length}</span>
            </div>
            {showAllEntries ? <ChevronUp size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />}
          </button>

          {showAllEntries && (
          <div className="px-4 pb-4 animate-in slide-in-from-top-1 fade-in duration-200">
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

      {showTaskPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">What are you working on?</h2>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mt-0.5">Optional — skip to just check in</p>
              </div>
              <button onClick={() => handlePickTask(null, null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            {taskPickerLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={28} className="animate-spin text-red-600" />
              </div>
            ) : (
              <div className="flex-1 overflow-auto space-y-4">
                {availableAssignedTasks.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Briefcase size={10} /> Assigned to You
                    </p>
                    <div className="space-y-2">
                      {availableAssignedTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setPickerSelectedTaskId(pickerSelectedTaskId === task.id ? null : task.id);
                            setPickerSelectedGeneralTaskId(null);
                          }}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                            pickerSelectedTaskId === task.id
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                              : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-600'}`}>
                              {task.priority}
                            </span>
                            <span className="text-[7px] font-black text-slate-400 dark:text-slate-500">{task.effort}pt</span>
                          </div>
                          <p className="text-[10px] font-black text-slate-900 dark:text-white truncate uppercase leading-tight">{task.title}</p>
                          {pickerSelectedTaskId === task.id && (
                            <div className="mt-1.5 flex items-center gap-1 text-blue-600">
                              <CheckSquare size={11} />
                              <span className="text-[9px] font-black uppercase">Selected</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableOpenTasks.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <Users size={10} /> Open to Contribute
                    </p>
                    <div className="space-y-2">
                      {availableOpenTasks.map(task => (
                        <button
                          key={task.id}
                          onClick={() => {
                            setPickerSelectedTaskId(pickerSelectedTaskId === task.id ? null : task.id);
                            setPickerSelectedGeneralTaskId(null);
                          }}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                            pickerSelectedTaskId === task.id
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30'
                              : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-700 hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[7px] font-black px-1.5 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] ?? 'bg-slate-100 text-slate-600'}`}>
                              {task.priority}
                            </span>
                            <span className="text-[7px] font-black text-slate-400 dark:text-slate-500">{task.effort}pt</span>
                          </div>
                          <p className="text-[10px] font-black text-slate-900 dark:text-white truncate uppercase leading-tight">{task.title}</p>
                          {pickerSelectedTaskId === task.id && (
                            <div className="mt-1.5 flex items-center gap-1 text-orange-600">
                              <CheckSquare size={11} />
                              <span className="text-[9px] font-black uppercase">Selected</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableGeneralTasks.length > 0 && (
                  <div>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <ListChecks size={10} /> General Tasks
                    </p>
                    <div className="space-y-2">
                      {availableGeneralTasks.map(gt => (
                        <button
                          key={gt.id}
                          onClick={() => {
                            setPickerSelectedGeneralTaskId(pickerSelectedGeneralTaskId === gt.id ? null : gt.id);
                            setPickerSelectedTaskId(null);
                          }}
                          className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3 ${
                            pickerSelectedGeneralTaskId === gt.id
                              ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30'
                              : 'border-slate-100 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700'
                          }`}
                        >
                          {pickerSelectedGeneralTaskId === gt.id ? <CheckSquare size={16} className="text-violet-600 shrink-0 mt-0.5" /> : <Square size={16} className="text-slate-400 shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white">{gt.name}</p>
                            {gt.description && <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{gt.description}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {availableAssignedTasks.length === 0 && availableOpenTasks.length === 0 && availableGeneralTasks.length === 0 && (
                  <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm font-bold">No tasks available</p>
                )}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => handlePickTask(null, null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 text-xs uppercase tracking-widest"
              >
                Skip
              </button>
              <button
                onClick={() => handlePickTask(pickerSelectedTaskId, pickerSelectedGeneralTaskId)}
                className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl hover:bg-green-700 shadow-lg shadow-green-600/20 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <Check size={14} />
                {pickerSelectedTaskId || pickerSelectedGeneralTaskId ? 'Confirm Selection' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCheckoutModal && myOpenEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg p-6 shadow-2xl">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Check Out</h2>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mt-0.5 flex items-center gap-1">
                  {myOpenEntry.workingOnTaskTitle && <><Briefcase size={9} /> {myOpenEntry.workingOnTaskTitle}</>}
                  {myOpenEntry.workingOnGeneralTaskName && <><ListChecks size={9} /> {myOpenEntry.workingOnGeneralTaskName}</>}
                </p>
              </div>
              <button onClick={() => setShowCheckoutModal(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {myOpenEntry.workingOnTaskId && (
                <button
                  onClick={() => setCheckoutMarkComplete(!checkoutMarkComplete)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all text-left ${
                    checkoutMarkComplete
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                      : 'border-slate-200 dark:border-slate-700 hover:border-green-300'
                  }`}
                >
                  {checkoutMarkComplete ? <CheckSquare size={18} className="text-green-600 shrink-0" /> : <Square size={18} className="text-slate-400 shrink-0" />}
                  <span className={`text-sm font-black uppercase tracking-wide ${checkoutMarkComplete ? 'text-green-700 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'}`}>
                    Mark task as complete
                  </span>
                </button>
              )}

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                  Handoff Note {!checkoutMarkComplete && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={checkoutHandoffNote}
                  onChange={e => setCheckoutHandoffNote(e.target.value)}
                  rows={3}
                  placeholder={checkoutMarkComplete ? 'Optional completion notes...' : 'What did you accomplish? What\'s next for this task?'}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium resize-none text-sm"
                />
              </div>

              {(() => {
                const noteRequired = !checkoutMarkComplete && !checkoutHandoffNote.trim();
                return (
                  <button
                    onClick={() => handleCheckOut(checkoutHandoffNote.trim() || undefined, checkoutMarkComplete)}
                    disabled={checkoutLoading || noteRequired}
                    className={`w-full py-3.5 font-black rounded-xl text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                      checkoutLoading || noteRequired
                        ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20'
                    }`}
                  >
                    {checkoutLoading ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                    {noteRequired ? 'Add a handoff note to continue' : 'Confirm Check Out'}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {showGenTaskSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-start mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">General Tasks</h2>
                <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase mt-0.5">Always-available recurring tasks for check-in</p>
              </div>
              <button onClick={() => setShowGenTaskSettings(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-3">
              <input
                type="text"
                value={genTaskForm.name}
                onChange={e => setGenTaskForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Task name (e.g. Scouting matches)"
                className="w-full p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-bold text-sm"
              />
              <input
                type="text"
                value={genTaskForm.description}
                onChange={e => setGenTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
                className="w-full p-2.5 bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white font-medium text-sm"
              />
              <div className="flex gap-2">
                {editingGenTask && (
                  <button onClick={() => { setEditingGenTask(null); setGenTaskForm({ name: '', description: '' }); }} className="flex-1 py-2.5 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-black text-xs uppercase">Cancel</button>
                )}
                <button
                  onClick={handleSaveGenTask}
                  disabled={!genTaskForm.name.trim()}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-black text-xs uppercase hover:bg-red-700 disabled:opacity-40"
                >
                  {editingGenTask ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-2">
              {genTasksLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-red-600" /></div>
              ) : genTasks.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-slate-500 py-8 text-sm font-bold">No general tasks yet</p>
              ) : (
                genTasks.map(gt => (
                  <div key={gt.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${gt.active ? 'border-slate-100 dark:border-slate-700' : 'border-dashed border-slate-200 dark:border-slate-700 opacity-60'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-black truncate ${gt.active ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 line-through'}`}>{gt.name}</p>
                      {gt.description && <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{gt.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditingGenTask(gt); setGenTaskForm({ name: gt.name, description: gt.description || '' }); }} className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg text-blue-600 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => handleToggleGenTaskActive(gt)} className={`p-1.5 rounded-lg transition-colors ${gt.active ? 'hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600' : 'hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600'}`}>
                        <Archive size={13} />
                      </button>
                      {isCoach && (
                        <button onClick={() => handleDeleteGenTask(gt.id)} className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg text-red-500 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
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
