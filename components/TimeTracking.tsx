import React, { useState, useMemo } from 'react';
import { AppState, TimeEntry, TimeEntryAudit, User, Role } from '../types';
import { Clock, LogIn, LogOut, Check, X, Edit3, History, AlertCircle, ChevronDown, ChevronUp, Calendar, Timer } from 'lucide-react';
import { api } from '../services/api';

interface TimeTrackingProps {
  state: AppState;
  onRefresh: () => void;
}

const formatTime = (date: Date | number | string) => {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date: Date | number | string) => {
  const d = new Date(date);
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
};

const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const TimeTracking: React.FC<TimeTrackingProps> = ({ state, onRefresh }) => {
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
  const [auditEntry, setAuditEntry] = useState<TimeEntry | null>(null);
  const [auditLogs, setAuditLogs] = useState<TimeEntryAudit[]>([]);
  const [editForm, setEditForm] = useState({ checkInAt: '', checkOutAt: '', notes: '' });
  const [showHistory, setShowHistory] = useState(false);

  const isCoach = useMemo(() => state.currentUser?.roles.includes(Role.Coach), [state.currentUser]);
  const currentUserId = parseInt(state.currentUser?.id || '0');

  const myOpenEntry = useMemo(() => {
    return state.timeEntries.find(e => 
      e.userId === state.currentUser?.id && 
      (!e.checkOutAt || e.status !== 'completed')
    );
  }, [state.timeEntries, state.currentUser]);

  const pendingApprovals = useMemo(() => {
    return state.timeEntries.filter(e => 
      e.status === 'pending_check_in' || e.status === 'pending_check_out'
    );
  }, [state.timeEntries]);

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

  const openEditModal = (entry: TimeEntry) => {
    setEditingEntry(entry);
    setEditForm({
      checkInAt: new Date(entry.checkInAt).toISOString().slice(0, 16),
      checkOutAt: entry.checkOutAt ? new Date(entry.checkOutAt).toISOString().slice(0, 16) : '',
      notes: entry.notes || '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry) return;
    try {
      await api.timeEntries.update(parseInt(editingEntry.id), currentUserId, {
        checkInAt: editForm.checkInAt,
        checkOutAt: editForm.checkOutAt || undefined,
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

  const getUserName = (userId: string) => {
    return state.users.find(u => u.id === userId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Time Clock</h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest">Track your hours</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Hours</p>
              <p className="text-2xl md:text-3xl font-black text-red-600">{formatDuration(totalHours)}</p>
            </div>
          </div>

          {myOpenEntry ? (
            <div className="bg-green-50 border-2 border-green-200 rounded-xl md:rounded-2xl p-4 md:p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-green-500 text-white rounded-xl md:rounded-2xl flex items-center justify-center animate-pulse">
                    <Clock size={20} />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-black text-green-800 uppercase">Clocked In</p>
                    <p className="text-[10px] md:text-xs text-green-600 font-bold">
                      Since {formatTime(myOpenEntry.checkInAt)} on {formatDate(myOpenEntry.checkInAt)}
                    </p>
                    {myOpenEntry.status === 'pending_check_in' && (
                      <p className="text-[9px] text-orange-600 font-bold uppercase mt-1">Awaiting coach confirmation</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleCheckOut}
                  disabled={myOpenEntry.status === 'pending_check_in'}
                  className={`flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest transition-all ${
                    myOpenEntry.status === 'pending_check_in' 
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                      : 'bg-red-600 text-white hover:bg-red-700 shadow-lg'
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
            className="w-full flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl text-slate-600 font-bold text-xs uppercase tracking-widest"
          >
            <span>My Time History</span>
            {showHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {showHistory && (
            <div className="mt-4 space-y-3 max-h-64 overflow-auto">
              {myEntries.slice(0, 20).map(entry => (
                <div key={entry.id} className="flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs md:text-sm font-black text-slate-800">{formatDate(entry.checkInAt)}</p>
                    <p className="text-[10px] md:text-xs text-slate-500 font-bold">
                      {formatTime(entry.checkInAt)} - {entry.checkOutAt ? formatTime(entry.checkOutAt) : 'In Progress'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 md:gap-3">
                    {entry.status === 'completed' && entry.roundedMinutes && (
                      <span className="text-xs md:text-sm font-black text-green-600">{formatDuration(entry.roundedMinutes)}</span>
                    )}
                    <span className={`text-[8px] md:text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                      entry.status === 'completed' ? 'bg-green-100 text-green-700' :
                      entry.status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {entry.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {myEntries.length === 0 && (
                <p className="text-center text-slate-400 py-6 text-sm font-bold">No time entries yet</p>
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

      {isCoach && pendingApprovals.length > 0 && (
        <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-orange-200 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
              <AlertCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">Pending Approvals</h3>
              <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest">{pendingApprovals.length} entries need confirmation</p>
            </div>
          </div>

          <div className="space-y-3">
            {pendingApprovals.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center font-black text-slate-600">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-800">{getUserName(entry.userId)}</p>
                    <p className="text-[10px] text-slate-500 font-bold">
                      {formatDate(entry.checkInAt)} • {formatTime(entry.checkInAt)}
                      {entry.checkOutAt && ` - ${formatTime(entry.checkOutAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase ${
                    entry.status === 'pending_check_in' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {entry.status === 'pending_check_in' ? 'Check-In' : 'Check-Out'}
                  </span>
                  <button
                    onClick={() => handleConfirm(entry.id, entry.status === 'pending_check_in' ? 'check_in' : 'check_out')}
                    className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg font-bold text-[10px] uppercase hover:bg-green-700 transition-all"
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={() => openEditModal(entry)}
                    className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => openAuditModal(entry)}
                    className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all"
                  >
                    <History size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isCoach && (
        <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
          <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight mb-6">All Time Entries</h3>
          <div className="space-y-2 max-h-96 overflow-auto">
            {state.timeEntries.map(entry => (
              <div key={entry.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center font-bold text-sm text-slate-600">
                    {getUserName(entry.userId)[0]}
                  </div>
                  <div>
                    <p className="text-xs md:text-sm font-bold text-slate-800">{getUserName(entry.userId)}</p>
                    <p className="text-[9px] md:text-[10px] text-slate-500">
                      {formatDate(entry.checkInAt)} • {formatTime(entry.checkInAt)}
                      {entry.checkOutAt && ` - ${formatTime(entry.checkOutAt)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {entry.roundedMinutes && (
                    <span className="text-xs font-black text-green-600">{formatDuration(entry.roundedMinutes)}</span>
                  )}
                  <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${
                    entry.status === 'completed' ? 'bg-green-100 text-green-700' :
                    entry.status === 'checked_in' ? 'bg-blue-100 text-blue-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {entry.status.replace('_', ' ')}
                  </span>
                  <button onClick={() => openEditModal(entry)} className="p-1.5 text-slate-400 hover:text-slate-600">
                    <Edit3 size={12} />
                  </button>
                  <button onClick={() => openAuditModal(entry)} className="p-1.5 text-slate-400 hover:text-slate-600">
                    <History size={12} />
                  </button>
                </div>
              </div>
            ))}
            {state.timeEntries.length === 0 && (
              <p className="text-center text-slate-400 py-8 font-bold">No time entries recorded yet</p>
            )}
          </div>
        </div>
      )}

      {editingEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl md:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Edit Time Entry</h2>
                <p className="text-slate-400 text-xs font-bold uppercase">{getUserName(editingEntry.userId)}</p>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-2 bg-slate-100 rounded-xl hover:text-red-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Check In</label>
                <input
                  type="datetime-local"
                  value={editForm.checkInAt}
                  onChange={(e) => setEditForm({ ...editForm, checkInAt: e.target.value })}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Check Out</label>
                <input
                  type="datetime-local"
                  value={editForm.checkOutAt}
                  onChange={(e) => setEditForm({ ...editForm, checkOutAt: e.target.value })}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-bold"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-medium h-20 resize-none"
                  placeholder="Optional notes..."
                />
              </div>
              <button
                onClick={handleSaveEdit}
                className="w-full py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg uppercase tracking-widest text-sm"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {auditEntry && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl md:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Audit Log</h2>
                <p className="text-slate-400 text-xs font-bold uppercase">{getUserName(auditEntry.userId)} - {formatDate(auditEntry.checkInAt)}</p>
              </div>
              <button onClick={() => setAuditEntry(null)} className="p-2 bg-slate-100 rounded-xl hover:text-red-600">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto space-y-3">
              {auditLogs.map(log => (
                <div key={log.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-black text-red-600 uppercase">{log.actionType.replace('_', ' ')}</span>
                    <span className="text-[9px] text-slate-400 font-bold">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-600">By: {getUserName(log.actorId)}</p>
                  {log.deltaMinutes !== undefined && log.deltaMinutes !== null && (
                    <p className={`text-xs font-black mt-1 ${log.deltaMinutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {log.deltaMinutes >= 0 ? '+' : ''}{log.deltaMinutes} minutes
                    </p>
                  )}
                  {log.previousValues && Object.keys(log.previousValues).length > 0 && (
                    <div className="mt-2 text-[10px] text-slate-500">
                      <span className="font-bold">Previous:</span> {JSON.stringify(log.previousValues)}
                    </div>
                  )}
                </div>
              ))}
              {auditLogs.length === 0 && (
                <p className="text-center text-slate-400 py-6 font-bold">No audit records</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimeTracking;
