import React, { useState, useMemo, useEffect } from 'react';
import { User, AppState, Role, Department, TaskStatus, TimeEntry, TimeEntryAudit } from '../types';
import { Plus, Search, Mail, Trash2, Trophy, BarChart2, AlertCircle, X, Shield, Settings, Key, UserPlus, Edit3, Lock, Eye, EyeOff, Check, Clock, History, VolumeX, Volume2, ShieldCheck, ShieldOff, Award, Download, LayoutList, Archive, ArchiveRestore } from 'lucide-react';
import { api } from '../services/api';
import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { HOUR_CATEGORIES, styleFor } from './hourCategoryStyles';

interface TeamProps {
  state: AppState;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const TeamManagement: React.FC<TeamProps> = ({ state, onAddUser, onUpdateUser, onDeleteUser }) => {
  const { settings } = useTeamSettings();
  const deptNames = settings.departments.map(d => d.name);
  const roleNames = settings.roles.map(r => r.name);

  // Combined hour totals per user (shop clock + competition check-ins), keyed by
  // user id as a string to match User.id.
  const [hourTotals, setHourTotals] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    api.hours.totalsByUser()
      .then(totals => setHourTotals(totals || {}))
      .catch(() => {});
  }, [state.timeEntries]);

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState<Department | 'All'>('All');
  const [roleFilter, setRoleFilter] = useState<Role | 'All'>('All');
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserForStats, setSelectedUserForStats] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [editingTimeEntry, setEditingTimeEntry] = useState<TimeEntry | null>(null);
  const [timeEditForm, setTimeEditForm] = useState({ checkInAt: '', checkOutAt: '', notes: '' });
  const [auditEntry, setAuditEntry] = useState<TimeEntry | null>(null);
  const [auditLogs, setAuditLogs] = useState<TimeEntryAudit[]>([]);
  const [perfCertHistory, setPerfCertHistory] = useState<any[]>([]);
  const [perfHeldCerts, setPerfHeldCerts] = useState<any[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const isCoach = useMemo(() => state.currentUser?.roles.includes(Role.Coach), [state.currentUser]);
  const isCaptain = useMemo(() => state.currentUser?.roles.includes(Role.TeamCaptain), [state.currentUser]);
  const isDeptHead = useMemo(() => state.currentUser?.roles.includes(Role.DepartmentHead), [state.currentUser]);
  
  const canEditUsers = isCoach || isCaptain;
  const canViewCertHistory = isCoach || isCaptain || isDeptHead;

  useEffect(() => {
    if (!selectedUserForStats || !canViewCertHistory || !state.currentUser) {
      setPerfCertHistory([]);
      setPerfHeldCerts([]);
      return;
    }
    const uid = Number(selectedUserForStats.id);
    const requesterId = Number(state.currentUser.id);
    Promise.all([
      api.certRequests.getAll({ requesterId, targetUserId: uid, statuses: ['completed', 'rejected'] }),
      api.certifications.getForUser(uid),
    ]).then(([history, held]) => {
      setPerfCertHistory(history || []);
      setPerfHeldCerts(held || []);
    }).catch(() => {
      setPerfCertHistory([]);
      setPerfHeldCerts([]);
    });
  }, [selectedUserForStats, canViewCertHistory, state.currentUser]);

  const filteredUsers = state.users
    .filter(u => {
      if (u.archived) return false;
      const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
        u.username.toLowerCase().includes(search.toLowerCase());
      const matchesDept = deptFilter === 'All' || u.departments.includes(deptFilter);
      const matchesRole = roleFilter === 'All' || u.roles.includes(roleFilter);
      return matchesSearch && matchesDept && matchesRole;
    })
    .sort((a, b) => {
      const deptA = a.departments[0] || 'zzz';
      const deptB = b.departments[0] || 'zzz';
      if (deptA !== deptB) return deptA.localeCompare(deptB);
      return a.name.localeCompare(b.name);
    });

  const archivedUsers = state.users.filter(u => u.archived);

  const groupedUsers = useMemo(() => {
    const groups: Record<string, User[]> = {};
    filteredUsers.forEach(user => {
      const dept = user.departments[0] || 'Unassigned';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(user);
    });
    return Object.keys(groups)
      .sort((a, b) => {
        if (a === 'Unassigned') return 1;
        if (b === 'Unassigned') return -1;
        return a.localeCompare(b);
      })
      .map(dept => ({ dept, users: groups[dept] }));
  }, [filteredUsers]);

  const getUserStats = (userId: string) => {
    const userTasks = state.tasks.filter(t => t.assignees.includes(userId));
    const completedTasks = userTasks.filter(t => t.status === TaskStatus.Complete);
    const totalEffort = completedTasks.reduce((acc, t) => acc + (t.effort || 0), 0);
    const activeTasks = userTasks.filter(t => t.status !== TaskStatus.Complete);

    return { total: userTasks.length, completed: completedTasks.length, effort: totalEffort, active: activeTasks.length };
  };

  const getUserTimeEntries = (userId: string) => {
    return state.timeEntries
      .filter(e => e.userId === userId)
      .sort((a, b) => new Date(b.checkInAt).getTime() - new Date(a.checkInAt).getTime());
  };

  // Totals come from the combined ledger so competition time counts alongside
  // shop, meeting, outreach, volunteer and other. Falls back to clock-only math
  // until the ledger loads.
  const getUserTotalMinutes = (userId: string) => {
    const fromLedger = hourTotals[userId]?.total;
    if (fromLedger !== undefined) return fromLedger;
    return state.timeEntries
      .filter(e => e.userId === userId && e.status === 'completed' && e.roundedMinutes)
      .reduce((acc, e) => acc + (e.roundedMinutes || 0), 0);
  };

  const getUserHoursByKind = (userId: string) => {
    const totals = hourTotals[userId];
    return HOUR_CATEGORIES
      .map(category => ({ category, minutes: totals?.[category] || 0 }))
      .filter(c => c.minutes > 0);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatTime = (date: Date | number | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZone: 'America/Los_Angeles' });
  };

  const formatDate = (date: Date | number | string) => {
    const d = new Date(date);
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Los_Angeles' });
  };

  const toLocalDateTimeString = (date: Date | number | string) => {
    const d = new Date(date);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(d);
    const get = (t: string) => parts.find(p => p.type === t)?.value || '00';
    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
  };

  // Convert a datetime-local string (which represents Pacific time) to a UTC ISO string.
  // We must NOT use `new Date(str)` directly because that treats the string as local
  // browser time, which may not be Pacific. Instead, we append the correct PT offset.
  const pacificLocalToISO = (localStr: string): string => {
    if (!localStr) return '';
    const datePart = localStr.slice(0, 10); // "YYYY-MM-DD"
    // Use 20:00 UTC on that date as a reference to discover the PT offset (noon-ish PT).
    const ref = new Date(datePart + 'T20:00:00Z');
    const tzAbbr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles', timeZoneName: 'short',
    }).formatToParts(ref).find(p => p.type === 'timeZoneName')?.value;
    const offsetStr = tzAbbr === 'PDT' ? '-07:00' : '-08:00';
    return new Date(localStr + ':00' + offsetStr).toISOString();
  };

  const openTimeEditModal = (entry: TimeEntry) => {
    setEditingTimeEntry(entry);
    setTimeEditForm({
      checkInAt: toLocalDateTimeString(entry.checkInAt),
      checkOutAt: entry.checkOutAt ? toLocalDateTimeString(entry.checkOutAt) : '',
      notes: entry.notes || '',
    });
  };

  const handleSaveTimeEdit = async () => {
    if (!editingTimeEntry || !state.currentUser) return;
    try {
      await api.timeEntries.update(parseInt(editingTimeEntry.id), parseInt(state.currentUser.id), {
        checkInAt: pacificLocalToISO(timeEditForm.checkInAt),
        checkOutAt: timeEditForm.checkOutAt ? pacificLocalToISO(timeEditForm.checkOutAt) : undefined,
        notes: timeEditForm.notes,
      });
      setEditingTimeEntry(null);
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

  const summaryRows = useMemo(() => {
    return state.users
      .slice()
      .sort((a, b) => {
        const dA = a.departments[0] || 'zzz';
        const dB = b.departments[0] || 'zzz';
        if (dA !== dB) return dA.localeCompare(dB);
        return a.name.localeCompare(b.name);
      })
      .map(user => {
        const stats = getUserStats(user.id);
        const minutes = getUserTotalMinutes(user.id);
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          departments: user.departments.join(', ') || '—',
          roles: user.roles.join(', ') || '—',
          completed: stats.completed,
          effort: stats.effort,
          active: stats.active,
          hoursLogged: (minutes / 60).toFixed(1),
          muted: !!user.muted,
        };
      });
  }, [state.users, state.tasks, state.timeEntries, hourTotals]);

  const exportTeamCSV = () => {
    const headers = ['Name', 'Username', 'Departments', 'Roles', 'Tasks Completed', 'Effort Points', 'Active Tasks', 'Hours Logged', 'Status'];
    const rows = summaryRows.map(r => [
      r.name,
      r.username,
      r.departments,
      r.roles,
      r.completed,
      r.effort,
      r.active,
      r.hoursLogged,
      r.muted ? 'Muted' : 'Active',
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      onDeleteUser(userToDelete.id);
      setUserToDelete(null);
    }
  };

  const handleResetPassword = () => {
    if (editingUser && isCoach) {
      const updatedUser = { ...editingUser, password: 'password' };
      onUpdateUser(updatedUser);
      alert(`Password for ${editingUser.name} has been reset to "password".`);
    }
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess(false);

    if (!passwordForm.new || !passwordForm.current) {
      setPasswordError('Please fill in all fields');
      return;
    }

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.new.length < 4) {
      setPasswordError('Password must be at least 4 characters');
      return;
    }

    try {
      const userId = parseInt(state.currentUser!.id);
      await api.changePassword(userId, passwordForm.current, passwordForm.new);
      setPasswordSuccess(true);
      setPasswordForm({ current: '', new: '', confirm: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 1500);
    } catch (error: any) {
      if (error.message.includes('401')) {
        setPasswordError('Current password is incorrect');
      } else {
        setPasswordError('Failed to change password. Please try again.');
      }
    }
  };

  return (
    <div className="space-y-6 md:space-y-12 animate-in fade-in duration-700">
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="SEARCH TEAM..."
                        className="w-full pl-12 md:pl-16 pr-4 md:pr-8 py-3 md:py-5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl md:rounded-[32px] focus:ring-4 md:focus:ring-8 focus:ring-teamColor/10 focus:border-teamColor outline-none transition-all font-black text-xs md:text-sm uppercase tracking-widest dark:text-white"
                    />
                </div>
                <div className="flex gap-2 md:gap-3">
                    <button 
                        onClick={() => setShowPasswordModal(true)}
                        className="flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-5 bg-slate-900 text-white font-black rounded-xl md:rounded-[32px] hover:bg-slate-800 shadow-lg transition-all uppercase tracking-widest text-[10px] md:text-xs"
                    >
                        <Lock size={16} />
                        <span className="hidden sm:inline">Change Password</span>
                    </button>
                    {isCoach && (
                      <>
                        <button
                          onClick={() => setShowSummary(v => !v)}
                          className={`flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-5 font-black rounded-xl md:rounded-[32px] shadow-lg transition-all uppercase tracking-widest text-[10px] md:text-xs ${showSummary ? 'bg-teamColor text-white hover:opacity-90' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                        >
                          <LayoutList size={16} />
                          <span className="hidden sm:inline">Summary</span>
                        </button>
                        {archivedUsers.length > 0 && (
                          <button
                            onClick={() => setShowArchived(v => !v)}
                            className={`flex items-center justify-center gap-2 px-4 md:px-6 py-3 md:py-5 font-black rounded-xl md:rounded-[32px] shadow-lg transition-all uppercase tracking-widest text-[10px] md:text-xs ${showArchived ? 'bg-amber-500 text-white hover:opacity-90' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                          >
                            <Archive size={16} />
                            <span className="hidden sm:inline">Archived ({archivedUsers.length})</span>
                          </button>
                        )}
                      </>
                    )}
                    {canEditUsers && (
                      <button 
                          onClick={() => setIsAdding(true)}
                          className="flex items-center justify-center gap-2 md:gap-4 px-4 md:px-10 py-3 md:py-5 bg-teamColor text-white font-black rounded-xl md:rounded-[32px] hover:opacity-90 shadow-2xl shadow-teamColor/20 transition-all transform active:scale-95 uppercase tracking-widest text-[10px] md:text-sm"
                      >
                          <UserPlus size={16} />
                          <span className="hidden sm:inline">Add Member</span>
                      </button>
                    )}
                </div>
            </div>
            <div className="flex flex-wrap gap-2 md:gap-3">
                <select
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value as Department | 'All')}
                    className="px-3 md:px-4 py-2 md:py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest text-slate-700 dark:text-slate-200 focus:border-teamColor outline-none"
                >
                    <option value="All">All Departments</option>
                    {deptNames.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as Role | 'All')}
                    className="px-3 md:px-4 py-2 md:py-3 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest text-slate-700 dark:text-slate-200 focus:border-teamColor outline-none"
                >
                    <option value="All">All Roles</option>
                    {roleNames.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
                {(deptFilter !== 'All' || roleFilter !== 'All') && (
                    <button
                        onClick={() => { setDeptFilter('All'); setRoleFilter('All'); }}
                        className="px-3 md:px-4 py-2 md:py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 transition-all"
                    >
                        Clear Filters
                    </button>
                )}
            </div>
        </div>

        {isCoach && showSummary && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 overflow-hidden animate-in fade-in duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <LayoutList size={16} className="text-teamColor" />
                <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">Team Summary</span>
                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase">{summaryRows.length} members</span>
              </div>
              <button
                onClick={exportTeamCSV}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-700 text-white font-black rounded-xl hover:bg-slate-700 dark:hover:bg-slate-600 transition-all uppercase tracking-widest text-[10px]"
              >
                <Download size={13} />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Department</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest whitespace-nowrap">Roles</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Done</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Effort</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Active</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Hrs Logged</th>
                    <th className="px-4 py-3 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryRows.map((row, idx) => (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/40 dark:bg-slate-800/20'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-teamColor text-white flex items-center justify-center font-black text-[10px] flex-shrink-0">
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-black text-slate-900 dark:text-white text-[11px]">{row.name}</div>
                            <div className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">@{row.username}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{row.departments}</td>
                      <td className="px-4 py-3 text-[11px] font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap max-w-[150px] truncate" title={row.roles}>{row.roles}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-black text-[11px]">{row.completed}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-black text-[11px]">{row.effort}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg font-black text-[11px] ${row.active > 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>{row.active}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-black text-[11px] px-2 py-1">{row.hoursLogged}h</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {row.muted
                          ? <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 font-black text-[9px] uppercase tracking-wider"><VolumeX size={10} />Muted</span>
                          : <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-black text-[9px] uppercase tracking-wider"><Check size={10} />Active</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="space-y-8 md:space-y-12">
          {groupedUsers.length === 0 && (
            <div className="text-center py-16 text-slate-400 dark:text-slate-500 font-black uppercase text-xs tracking-widest">No members found</div>
          )}
          {groupedUsers.map(({ dept, users: deptUsers }) => (
            <div key={dept}>
              <div className="flex items-center gap-3 mb-4 md:mb-6">
                <div className="w-1 h-6 bg-teamColor rounded-full flex-shrink-0" />
                <h2 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{dept}</h2>
                <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">{deptUsers.length} member{deptUsers.length !== 1 ? 's' : ''}</span>
                <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
            {deptUsers.map(user => {
                const stats = getUserStats(user.id);
                const userIsCoach = user.roles.includes(Role.Coach);
                return (
                    <div key={user.id} className="bg-white dark:bg-slate-800 p-6 md:p-10 rounded-2xl md:rounded-[40px] border-2 border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-2xl hover:border-teamColor/20 transition-all relative group overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1.5 md:h-2 ${userIsCoach ? 'bg-black' : 'bg-slate-100 dark:bg-slate-700'} group-hover:bg-teamColor transition-colors`} />
                        
                        <div className="absolute top-4 md:top-8 right-4 md:right-8 flex gap-1 md:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {canEditUsers && (
                            <button 
                                onClick={() => setEditingUser(user)}
                                className="p-2 md:p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl md:rounded-2xl transition-all"
                                title="Manage User"
                            >
                                <Settings size={16} />
                            </button>
                          )}
                          {isCoach && user.id !== state.currentUser?.id && !user.roles.includes(Role.Coach) && (
                            <button 
                                onClick={() => onUpdateUser({ ...user, muted: !user.muted })}
                                className={`p-2 md:p-3 ${user.muted ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'text-slate-300'} hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl md:rounded-2xl transition-all`}
                                title={user.muted ? "Unmute Member" : "Mute Member"}
                            >
                                {user.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                          )}
                          {isCoach && user.id !== state.currentUser?.id && (
                            <>
                              <button
                                onClick={async () => {
                                  await api.users.archive(parseInt(user.id), true);
                                  onUpdateUser({ ...user, archived: true });
                                }}
                                className="p-2 md:p-3 text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-xl md:rounded-2xl transition-all"
                                title="Archive Member"
                              >
                                <Archive size={16} />
                              </button>
                              <button 
                                  onClick={() => setUserToDelete(user)}
                                  className="p-2 md:p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl md:rounded-2xl transition-all"
                                  title="Delete Member"
                              >
                                  <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 md:gap-6 mb-4 md:mb-8">
                            <div className={`relative w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-3xl ${userIsCoach ? 'bg-black border-slate-700' : 'bg-slate-950 border-slate-900'} text-white flex items-center justify-center text-xl md:text-3xl font-black border-2 md:border-4 shadow-xl group-hover:bg-teamColor group-hover:border-teamColor/70 transition-all transform group-hover:rotate-3`}>
                                {user.name[0].toUpperCase()}
                                {user.muted && (
                                  <div className="absolute -bottom-1 -right-1 p-1 bg-red-600 rounded-full">
                                    <VolumeX size={10} className="text-white" />
                                  </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base md:text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase truncate">{user.name}</h3>
                                  {user.muted && (
                                    <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 text-[8px] font-black rounded-full uppercase">Muted</span>
                                  )}
                                </div>
                                <p className="text-[10px] md:text-xs text-teamColor font-bold flex items-center gap-1 md:gap-2 mt-1">
                                    <Mail size={12} /> @{user.username}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                            <div>
                                <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3 flex items-center gap-1.5">
                                    <Shield size={10} /> Roles
                                </p>
                                <div className="flex flex-wrap gap-1 md:gap-2">
                                    {user.roles.map(role => (
                                        <span key={role} className={`px-2 md:px-3 py-1 md:py-1.5 ${role === Role.Coach ? 'bg-black text-white border-black' : 'bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-600'} rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black border uppercase tracking-tighter`}>
                                            {role}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {user.departments.length > 0 && (
                              <div>
                                <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3">Departments</p>
                                <div className="flex flex-wrap gap-1 md:gap-2">
                                    {user.departments.map(dept => {
                                        const dc = settings.departments.find(d => d.name === dept)?.color || settings.themeColor;
                                        return (
                                          <span key={dept} className="px-2 md:px-3 py-1 md:py-1.5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-tighter border"
                                            style={{ backgroundColor: dc + '18', color: dc, borderColor: dc + '50' }}>
                                            {dept}
                                          </span>
                                        );
                                    })}
                                </div>
                              </div>
                            )}
                            
                            <div className="pt-4 md:pt-8 border-t-2 border-slate-50 dark:border-slate-700">
                                {isCoach ? (
                                  <>
                                    <div className="grid grid-cols-4 gap-2 md:gap-4">
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1">DONE</p>
                                            <p className="text-lg md:text-2xl font-black text-slate-950 dark:text-white">{stats.completed}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1">EFFORT</p>
                                            <p className="text-lg md:text-2xl font-black text-teamColor">{stats.effort}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1">ACTIVE</p>
                                            <p className="text-lg md:text-2xl font-black text-slate-950 dark:text-white">{stats.active}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1">HOURS</p>
                                            <p className="text-lg md:text-2xl font-black text-green-600">{(getUserTotalMinutes(user.id) / 60).toFixed(1)}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedUserForStats(user)}
                                        className="w-full mt-4 md:mt-8 flex items-center justify-center gap-2 md:gap-3 py-2.5 md:py-4 text-[9px] md:text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 rounded-xl md:rounded-2xl hover:bg-teamColor hover:text-white transition-all uppercase tracking-widest"
                                    >
                                        <BarChart2 size={12} /> View Performance
                                    </button>
                                  </>
                                ) : (
                                  <div className="text-center py-2">
                                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                      {stats.active} Active Task{stats.active !== 1 ? 's' : ''}
                                    </p>
                                  </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}
              </div>
            </div>
          ))}
        </div>

        {showArchived && archivedUsers.length > 0 && (
          <div className="mt-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1 h-6 bg-amber-500 rounded-full flex-shrink-0" />
              <h2 className="text-xs md:text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">Archived Members</h2>
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">{archivedUsers.length} member{archivedUsers.length !== 1 ? 's' : ''}</span>
              <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
              {archivedUsers.map(user => (
                <div key={user.id} className="bg-slate-50 dark:bg-slate-800/50 p-6 md:p-8 rounded-2xl border-2 border-amber-200 dark:border-amber-900/40 relative group opacity-70 hover:opacity-100 transition-all">
                  <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-400 rounded-t-2xl" />
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-300 dark:bg-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xl font-black">
                      {user.name[0].toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-slate-600 dark:text-slate-400 uppercase truncate">{user.name}</h3>
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400 text-[8px] font-black rounded-full uppercase flex items-center gap-1">
                          <Archive size={8} /> Archived
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold mt-0.5">@{user.username}</p>
                    </div>
                  </div>
                  {isCoach && (
                    <button
                      onClick={async () => {
                        await api.users.archive(parseInt(user.id), false);
                        onUpdateUser({ ...user, archived: false });
                      }}
                      className="w-full py-2 flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 text-slate-500 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 transition-all"
                    >
                      <ArchiveRestore size={12} /> Restore Member
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-md p-6 md:p-12 shadow-2xl border-t-8 border-slate-900 dark:border-slate-950">
                  <div className="flex justify-between items-start mb-6 md:mb-10">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1 md:mb-2">Change Password</h2>
                      <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px] md:text-xs">Update your access key</p>
                    </div>
                    <button onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordForm({ current: '', new: '', confirm: '' }); }} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-all dark:text-slate-300">
                      <X size={20} />
                    </button>
                  </div>

                  {passwordSuccess ? (
                    <div className="flex flex-col items-center py-8 md:py-12">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-4 md:mb-6">
                        <Check size={32} />
                      </div>
                      <p className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase">Password Updated!</p>
                    </div>
                  ) : (
                    <div className="space-y-4 md:space-y-6">
                      {passwordError && (
                        <div className="p-3 md:p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl md:rounded-2xl text-red-600 dark:text-red-400 text-xs md:text-sm font-bold">
                          {passwordError}
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">Current Password</label>
                        <div className="relative">
                          <input 
                            type={showPasswords ? 'text' : 'password'}
                            value={passwordForm.current}
                            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                            className="w-full p-4 md:p-5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-2xl outline-none focus:border-slate-900 dark:focus:border-white transition-all font-bold text-sm md:text-base pr-12 dark:text-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">New Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'}
                          value={passwordForm.new}
                          onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                          className="w-full p-4 md:p-5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-2xl outline-none focus:border-slate-900 dark:focus:border-white transition-all font-bold text-sm md:text-base dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">Confirm New Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'}
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                          className="w-full p-4 md:p-5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-2xl outline-none focus:border-slate-900 dark:focus:border-white transition-all font-bold text-sm md:text-base dark:text-white"
                        />
                      </div>

                      <button 
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showPasswords ? 'Hide passwords' : 'Show passwords'}
                      </button>

                      <button 
                        onClick={handleChangePassword}
                        className="w-full py-4 md:py-5 bg-slate-900 dark:bg-slate-950 text-white font-black rounded-xl md:rounded-2xl hover:bg-slate-800 shadow-xl transition-all uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2"
                      >
                        <Key size={16} /> Update Password
                      </button>
                    </div>
                  )}
              </div>
          </div>
        )}

        {userToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6 animate-in fade-in duration-300">
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-12 shadow-2xl border-t-8 border-red-600">
                  <div className="flex flex-col items-center text-center mb-6 md:mb-10">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-2xl md:rounded-[32px] flex items-center justify-center mb-4 md:mb-8">
                      <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2 md:mb-4">Confirm Removal</h2>
                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed text-sm md:text-base">
                      You are about to permanently remove <span className="text-red-600 font-black">{userToDelete.name.toUpperCase()}</span> from the team.
                    </p>
                  </div>
                  <div className="flex gap-3 md:gap-4">
                      <button onClick={() => setUserToDelete(null)} className="flex-1 py-4 md:py-5 text-slate-900 dark:text-white font-black hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl md:rounded-3xl uppercase tracking-widest transition-all text-xs md:text-sm">Abort</button>
                      <button onClick={handleDeleteConfirm} className="flex-1 py-4 md:py-5 bg-red-600 text-white font-black rounded-xl md:rounded-3xl hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-xs md:text-sm">Confirm</button>
                  </div>
              </div>
          </div>
        )}

        {editingUser && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 md:p-6 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[48px] w-full max-w-2xl p-6 md:p-16 shadow-2xl border-t-8 border-red-600 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-start mb-6 md:mb-10">
                      <div>
                        <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1 md:mb-2">Manage Member</h2>
                        <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-[9px] md:text-xs">Editing {editingUser.name}</p>
                      </div>
                      <button onClick={() => { setEditingUser(null); setUsernameError(''); }} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-all dark:text-slate-300">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-6 md:space-y-10 pr-2 kanban-scroll">
                        {isCoach && (
                          <section>
                            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Edit3 size={12} className="text-teamColor" /> Profile Information
                            </label>
                            <div className="space-y-3 md:space-y-4">
                              <div>
                                <label className="block text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 md:mb-2 ml-2">Display Name</label>
                                <input 
                                  value={editingUser.name}
                                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                  className="w-full p-3 md:p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-2xl outline-none focus:border-teamColor transition-all font-black text-sm md:text-base uppercase dark:text-white"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 md:mb-2 ml-2">Username (Handle)</label>
                                <input 
                                  value={editingUser.username}
                                  onChange={(e) => {
                                    const newUsername = e.target.value.toLowerCase();
                                    setEditingUser({ ...editingUser, username: newUsername });
                                    const taken = state.users.some(u => u.id !== editingUser.id && u.username.toLowerCase() === newUsername);
                                    setUsernameError(taken ? 'This handle is already taken by another team member' : '');
                                  }}
                                  className={`w-full p-3 md:p-4 bg-slate-50 dark:bg-slate-700 border-2 rounded-xl md:rounded-2xl outline-none transition-all font-bold text-sm md:text-base dark:text-white ${usernameError ? 'border-red-500 focus:border-red-500' : 'border-slate-100 dark:border-slate-600 focus:border-teamColor'}`}
                                />
                                {usernameError && (
                                  <p className="text-red-500 text-[9px] md:text-[10px] font-bold mt-1 ml-2 flex items-center gap-1">
                                    <AlertCircle size={10} /> {usernameError}
                                  </p>
                                )}
                              </div>
                            </div>
                          </section>
                        )}

                        <section>
                            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Shield size={12} className="text-teamColor" /> Authorized Roles
                            </label>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                {roleNames.map(role => (
                                    <button
                                        key={role}
                                        onClick={() => {
                                            const newRoles = (editingUser.roles as string[]).includes(role)
                                                ? editingUser.roles.filter(r => r !== role)
                                                : [...editingUser.roles, role as any];
                                            setEditingUser({ ...editingUser, roles: newRoles });
                                        }}
                                        className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 text-[10px] md:text-xs font-black uppercase transition-all text-left flex items-center justify-between ${
                                            (editingUser.roles as string[]).includes(role)
                                            ? 'bg-teamColor border-teamColor text-white shadow-lg'
                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        {role}
                                        {(editingUser.roles as string[]).includes(role) && <Plus size={12} className="rotate-45" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Settings size={12} className="text-teamColor" /> Departments
                            </label>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                {deptNames.map(dept => (
                                    <button
                                        key={dept}
                                        onClick={() => {
                                            const newDepts = (editingUser.departments as string[]).includes(dept)
                                                ? editingUser.departments.filter(d => d !== dept)
                                                : [...editingUser.departments, dept as any];
                                            setEditingUser({ ...editingUser, departments: newDepts });
                                        }}
                                        className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 text-[10px] md:text-xs font-black uppercase transition-all text-left flex items-center justify-between ${
                                            (editingUser.departments as string[]).includes(dept)
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                            : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                                        }`}
                                    >
                                        {dept}
                                        {(editingUser.departments as string[]).includes(dept) && <Plus size={12} className="rotate-45" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {isCoach && (
                          <section className="pt-4 md:pt-6 border-t border-slate-100 dark:border-slate-700">
                             <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Key size={12} className="text-teamColor" /> Security Override
                            </label>
                            <button 
                              onClick={handleResetPassword}
                              className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl md:rounded-2xl border border-red-100 dark:border-red-700 font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:bg-red-600 hover:text-white transition-all w-full justify-center"
                            >
                              <Key size={14} /> Reset User Password
                            </button>
                            <p className="text-[8px] md:text-[9px] text-slate-400 dark:text-slate-500 mt-2 text-center uppercase font-bold italic">Resets to default: "password"</p>
                          </section>
                        )}
                    </div>

                    <div className="pt-6 md:pt-10">
                        <button 
                            onClick={() => {
                                if (usernameError) return;
                                onUpdateUser(editingUser);
                                setEditingUser(null);
                                setUsernameError('');
                            }}
                            disabled={!!usernameError}
                            className={`w-full py-4 md:py-6 font-black rounded-xl md:rounded-[32px] shadow-2xl transition-all uppercase tracking-widest text-xs md:text-sm ${usernameError ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-teamColor text-white hover:opacity-90 shadow-teamColor/20'}`}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {selectedUserForStats && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 md:p-6 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[48px] w-full max-w-4xl p-6 md:p-16 max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-6 md:mb-12">
                        <div className="flex items-center gap-4 md:gap-8">
                            <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[32px] bg-teamColor text-white flex items-center justify-center text-2xl md:text-4xl font-black shadow-xl shadow-teamColor/20 rotate-3">
                                {selectedUserForStats.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[9px] md:text-xs font-black text-teamColor uppercase tracking-widest mb-0.5 md:mb-1">Performance</p>
                              <h2 className="text-xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">{selectedUserForStats.name}</h2>
                            </div>
                        </div>
                        <button onClick={() => setSelectedUserForStats(null)} className="p-3 md:p-4 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-600 rounded-xl md:rounded-2xl transition-all shadow-sm">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-6 md:space-y-12 pr-2 md:pr-6 kanban-scroll">
                        <section>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
                              <Trophy className="text-teamColor" size={14} /> Completed Tasks
                            </h3>
                            <div className="grid grid-cols-1 gap-3 md:gap-4">
                                {state.tasks.filter(t => t.assignees.includes(selectedUserForStats.id) && t.status === TaskStatus.Complete).map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-4 md:p-8 bg-slate-50 dark:bg-slate-700/50 rounded-xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 group hover:border-teamColor/20 transition-all">
                                        <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-1">
                                            <div className="p-2 md:p-3 bg-teamColor text-white rounded-lg md:rounded-xl shadow-lg flex-shrink-0">
                                              <Trophy size={16} />
                                            </div>
                                            <span className="text-sm md:text-lg font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight truncate">{t.title}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-3">
                                          <p className="text-[8px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5 md:mb-1">Points</p>
                                          <span className="text-base md:text-xl font-black text-teamColor">{t.effort} PTS</span>
                                        </div>
                                    </div>
                                ))}
                                {state.tasks.filter(t => t.assignees.includes(selectedUserForStats.id) && t.status === TaskStatus.Complete).length === 0 && (
                                  <div className="py-8 md:py-12 text-center text-slate-400 dark:text-slate-500 font-bold uppercase">No completed tasks yet</div>
                                )}
                            </div>
                        </section>

                        {isCoach && (
                          <section>
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                              <h3 className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2 md:gap-3">
                                <Clock className="text-teamColor" size={14} /> Time History
                              </h3>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase">Total Hours</p>
                                <p className="text-lg font-black text-green-600">{formatDuration(getUserTotalMinutes(selectedUserForStats.id))}</p>
                              </div>
                            </div>

                            {(() => {
                              const breakdown = getUserHoursByKind(selectedUserForStats.id);
                              const total = breakdown.reduce((acc, c) => acc + c.minutes, 0);
                              return total > 0 ? (
                                <div className="mb-4 md:mb-6 p-4 md:p-5 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Hours by Category</p>
                                  <div className="grid grid-cols-3 gap-3 mb-3">
                                    {breakdown.map(({ category, minutes }) => {
                                      const s = styleFor(category);
                                      return (
                                        <div key={category} className="text-center">
                                          <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${s.text}`}>{s.label}</p>
                                          <p className="text-base md:text-lg font-black text-slate-800 dark:text-slate-100">{(minutes / 60).toFixed(1)}<span className="text-[10px] font-bold text-slate-400 ml-0.5">h</span></p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
                                    {breakdown.map(({ category, minutes }) => {
                                      const s = styleFor(category);
                                      return (
                                        <div
                                          key={category}
                                          className={`${s.dot} rounded-full`}
                                          style={{ width: `${(minutes / total) * 100}%` }}
                                          title={`${s.label}: ${(minutes / 60).toFixed(1)}h`}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null;
                            })()}

                            <div className="space-y-2 max-h-64 overflow-auto">
                              {getUserTimeEntries(selectedUserForStats.id).map(entry => (
                                <div key={entry.id} className="flex items-center justify-between p-3 md:p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-slate-200 dark:hover:border-slate-600 transition-all">
                                  <div>
                                    <p className="text-xs md:text-sm font-black text-slate-800 dark:text-slate-100">{formatDate(entry.checkInAt)}</p>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                                      {formatTime(entry.checkInAt)} - {entry.checkOutAt ? formatTime(entry.checkOutAt) : 'In Progress'}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {entry.roundedMinutes && (
                                      <span className="text-xs font-black text-green-600">{formatDuration(entry.roundedMinutes)}</span>
                                    )}
                                    <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${
                                      !entry.kind || entry.kind === 'shop' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                      entry.kind === 'outreach' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
                                      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                    }`}>
                                      {entry.kind || 'shop'}
                                    </span>
                                    <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${
                                      entry.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                      entry.status === 'checked_in' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
                                      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                                    }`}>
                                      {entry.status.replace('_', ' ')}
                                    </span>
                                    <button onClick={() => openTimeEditModal(entry)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 transition-all">
                                      <Edit3 size={12} />
                                    </button>
                                    <button onClick={() => openAuditModal(entry)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 transition-all">
                                      <History size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {getUserTimeEntries(selectedUserForStats.id).length === 0 && (
                                <div className="py-8 text-center text-slate-400 dark:text-slate-500 font-bold uppercase">No time entries yet</div>
                              )}
                            </div>
                          </section>
                        )}

                        {canViewCertHistory && (
                          <section>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
                              <Award className="text-teamColor" size={14} /> Certification History
                            </h3>

                            {perfHeldCerts.length > 0 && (
                              <div className="mb-4">
                                <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-2">Currently Certified</p>
                                <div className="flex flex-wrap gap-2">
                                  {perfHeldCerts.map((c: any) => (
                                    <span key={c.certId || c.certificationId} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-[10px] font-black uppercase tracking-wide">
                                      <ShieldCheck size={11} /> {c.certName || c.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="space-y-2 max-h-64 overflow-auto">
                              {perfCertHistory.map((req: any) => {
                                const isPass = req.status === 'completed';
                                return (
                                  <div key={req.id} className={`flex items-center justify-between p-3 md:p-4 rounded-xl border transition-all ${isPass ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/40' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/40'}`}>
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${isPass ? 'bg-green-100 dark:bg-green-900/40 text-green-600' : 'bg-red-100 dark:bg-red-900/40 text-red-500'}`}>
                                        {isPass ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{req.certification?.name || req.certName}</p>
                                        {req.certification?.equipment && (
                                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">{req.certification.equipment}</p>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-right flex-shrink-0 ml-3">
                                      <span className={`text-[8px] font-black px-2 py-1 rounded uppercase ${isPass ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                                        {isPass ? 'Passed' : 'Failed'}
                                      </span>
                                      {req.updatedAt && (
                                        <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-1">{formatDate(req.updatedAt)}</p>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {perfCertHistory.length === 0 && perfHeldCerts.length === 0 && (
                                <div className="py-8 text-center text-slate-400 dark:text-slate-500 font-bold uppercase">No certification history</div>
                              )}
                              {perfCertHistory.length === 0 && perfHeldCerts.length > 0 && (
                                <div className="py-4 text-center text-slate-400 dark:text-slate-500 font-bold uppercase text-xs">No past attempts recorded</div>
                              )}
                            </div>
                          </section>
                        )}
                    </div>
                </div>
            </div>
        )}

        {editingTimeEntry && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl border-t-8 border-teamColor">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Edit Time Entry</h2>
                  <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase">{getUserName(editingTimeEntry.userId)}</p>
                </div>
                <button onClick={() => setEditingTimeEntry(null)} className="p-2 bg-slate-50 dark:bg-slate-700 rounded-xl hover:text-red-600 dark:text-slate-300">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Check In</label>
                  <input
                    type="datetime-local"
                    value={timeEditForm.checkInAt}
                    onChange={(e) => setTimeEditForm({ ...timeEditForm, checkInAt: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor font-bold dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Check Out</label>
                  <input
                    type="datetime-local"
                    value={timeEditForm.checkOutAt}
                    onChange={(e) => setTimeEditForm({ ...timeEditForm, checkOutAt: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor font-bold dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Notes</label>
                  <textarea
                    value={timeEditForm.notes}
                    onChange={(e) => setTimeEditForm({ ...timeEditForm, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor font-medium h-20 resize-none dark:text-white"
                    placeholder="Optional notes..."
                  />
                </div>
                <button
                  onClick={handleSaveTimeEdit}
                  className="w-full py-4 bg-teamColor text-white font-black rounded-xl hover:opacity-90 shadow-lg uppercase tracking-widest text-sm"
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
                <button onClick={() => setAuditEntry(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 dark:text-slate-300">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-auto space-y-3">
                {auditLogs.map(log => (
                  <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-black text-teamColor uppercase">{log.actionType.replace('_', ' ')}</span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                        {new Date(log.createdAt).toLocaleString([], { timeZone: 'America/Los_Angeles' })}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400">By: {getUserName(log.actorId)}</p>
                    {log.deltaMinutes !== undefined && log.deltaMinutes !== null && (
                      <p className={`text-xs font-black mt-1 ${log.deltaMinutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.deltaMinutes >= 0 ? '+' : ''}{log.deltaMinutes} minutes
                      </p>
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

        {isAdding && (
            <AddMemberModal 
              users={state.users}
              onAdd={(user) => { onAddUser(user); setIsAdding(false); }}
              onCancel={() => setIsAdding(false)}
            />
        )}
    </div>
  );
};

const AddMemberModal: React.FC<{
  users: User[];
  onAdd: (user: User) => void;
  onCancel: () => void;
}> = ({ users, onAdd, onCancel }) => {
  const { settings } = useTeamSettings();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');

  const handleUsernameChange = (value: string) => {
    const lower = value.toLowerCase();
    setUsername(lower);
    const taken = users.some(u => u.username.toLowerCase() === lower);
    setError(taken ? 'This handle is already taken' : '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error || !name.trim() || !username.trim()) return;
    
    const defaultDept = (settings.departments[0]?.name || Department.Mechanical) as Department;
    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      username: username.toLowerCase(),
      password: 'password',
      roles: [Role.TeamMember],
      departments: [defaultDept]
    };
    onAdd(newUser);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 md:p-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[48px] w-full max-w-2xl p-6 md:p-16 shadow-2xl animate-in zoom-in duration-300 border-t-8 border-teamColor">
        <h2 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-6 md:mb-10 text-center">Add New Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-8">
          <div>
            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">Full Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
              placeholder="e.g. ALEX RIVERA" 
              className="w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[32px] outline-none focus:border-teamColor transition-all font-black text-sm md:text-lg uppercase tracking-tight dark:text-white" 
            />
          </div>
          <div>
            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 md:mb-3 ml-2">Username (Handle)</label>
            <input 
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              required 
              placeholder="arivera" 
              className={`w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-700 border-2 rounded-xl md:rounded-[32px] outline-none transition-all font-black text-sm md:text-lg tracking-tight dark:text-white ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-100 dark:border-slate-600 focus:border-teamColor'}`} 
            />
            {error && (
              <p className="text-red-500 text-[9px] md:text-[10px] font-bold mt-2 ml-2 flex items-center gap-1">
                <AlertCircle size={10} /> {error}
              </p>
            )}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase text-center">Default password will be "password"</p>
          <div className="pt-4 md:pt-8 flex gap-3 md:gap-4">
            <button type="button" onClick={onCancel} className="flex-1 py-4 md:py-6 text-slate-900 dark:text-white font-black hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl md:rounded-[32px] transition-all uppercase tracking-widest text-xs md:text-sm">Cancel</button>
            <button 
              type="submit" 
              disabled={!!error}
              className={`flex-1 py-4 md:py-6 font-black rounded-xl md:rounded-[32px] shadow-2xl transition-all uppercase tracking-widest text-xs md:text-sm ${error ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed' : 'bg-teamColor text-white hover:opacity-90 shadow-teamColor/20'}`}
            >
              Add Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TeamManagement;
