import React, { useState, useMemo } from 'react';
import { User, AppState, Role, Department, TaskStatus, TimeEntry, TimeEntryAudit } from '../types';
import { Plus, Search, Mail, Trash2, Trophy, BarChart2, AlertCircle, X, Shield, Settings, Key, UserPlus, Edit3, Lock, Eye, EyeOff, Check, Clock, History, VolumeX, Volume2 } from 'lucide-react';
import { DEPARTMENT_COLORS, ROLES, DEPARTMENTS } from '../constants';
import { api } from '../services/api';

interface TeamProps {
  state: AppState;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const TeamManagement: React.FC<TeamProps> = ({ state, onAddUser, onUpdateUser, onDeleteUser }) => {
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

  const isCoach = useMemo(() => state.currentUser?.roles.includes(Role.Coach), [state.currentUser]);
  const isCaptain = useMemo(() => state.currentUser?.roles.includes(Role.TeamCaptain), [state.currentUser]);
  
  const canEditUsers = isCoach || isCaptain;

  const filteredUsers = state.users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'All' || u.departments.includes(deptFilter);
    const matchesRole = roleFilter === 'All' || u.roles.includes(roleFilter);
    return matchesSearch && matchesDept && matchesRole;
  });

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

  const getUserTotalMinutes = (userId: string) => {
    return state.timeEntries
      .filter(e => e.userId === userId && e.status === 'completed' && e.roundedMinutes)
      .reduce((acc, e) => acc + (e.roundedMinutes || 0), 0);
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
        checkInAt: new Date(timeEditForm.checkInAt).toISOString(),
        checkOutAt: timeEditForm.checkOutAt ? new Date(timeEditForm.checkOutAt).toISOString() : undefined,
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
                        className="w-full pl-12 md:pl-16 pr-4 md:pr-8 py-3 md:py-5 bg-white border-2 border-slate-100 rounded-xl md:rounded-[32px] focus:ring-4 md:focus:ring-8 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all font-black text-xs md:text-sm uppercase tracking-widest"
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
                    {canEditUsers && (
                      <button 
                          onClick={() => setIsAdding(true)}
                          className="flex items-center justify-center gap-2 md:gap-4 px-4 md:px-10 py-3 md:py-5 bg-red-600 text-white font-black rounded-xl md:rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all transform active:scale-95 uppercase tracking-widest text-[10px] md:text-sm"
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
                    className="px-3 md:px-4 py-2 md:py-3 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest text-slate-700 focus:border-red-600 outline-none"
                >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                    ))}
                </select>
                <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as Role | 'All')}
                    className="px-3 md:px-4 py-2 md:py-3 bg-white border-2 border-slate-100 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest text-slate-700 focus:border-red-600 outline-none"
                >
                    <option value="All">All Roles</option>
                    {ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                    ))}
                </select>
                {(deptFilter !== 'All' || roleFilter !== 'All') && (
                    <button
                        onClick={() => { setDeptFilter('All'); setRoleFilter('All'); }}
                        className="px-3 md:px-4 py-2 md:py-3 bg-slate-100 text-slate-600 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase tracking-widest hover:bg-red-100 hover:text-red-600 transition-all"
                    >
                        Clear Filters
                    </button>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-8">
            {filteredUsers.map(user => {
                const stats = getUserStats(user.id);
                const userIsCoach = user.roles.includes(Role.Coach);
                return (
                    <div key={user.id} className="bg-white p-6 md:p-10 rounded-2xl md:rounded-[40px] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-red-600/20 transition-all relative group overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-1.5 md:h-2 ${userIsCoach ? 'bg-black' : 'bg-slate-100'} group-hover:bg-red-600 transition-colors`} />
                        
                        <div className="absolute top-4 md:top-8 right-4 md:right-8 flex gap-1 md:gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {canEditUsers && (
                            <button 
                                onClick={() => setEditingUser(user)}
                                className="p-2 md:p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all"
                                title="Manage User"
                            >
                                <Settings size={16} />
                            </button>
                          )}
                          {isCoach && user.id !== state.currentUser?.id && !user.roles.includes(Role.Coach) && (
                            <button 
                                onClick={() => onUpdateUser({ ...user, muted: !user.muted })}
                                className={`p-2 md:p-3 ${user.muted ? 'text-red-600 bg-red-50' : 'text-slate-300'} hover:text-red-600 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all`}
                                title={user.muted ? "Unmute Member" : "Mute Member"}
                            >
                                {user.muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>
                          )}
                          {isCoach && user.id !== state.currentUser?.id && (
                            <button 
                                onClick={() => setUserToDelete(user)}
                                className="p-2 md:p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl md:rounded-2xl transition-all"
                                title="Delete Member"
                            >
                                <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 md:gap-6 mb-4 md:mb-8">
                            <div className={`relative w-14 h-14 md:w-20 md:h-20 rounded-xl md:rounded-3xl ${userIsCoach ? 'bg-black border-slate-700' : 'bg-slate-950 border-slate-900'} text-white flex items-center justify-center text-xl md:text-3xl font-black border-2 md:border-4 shadow-xl group-hover:bg-red-600 group-hover:border-red-500 transition-all transform group-hover:rotate-3`}>
                                {user.name[0].toUpperCase()}
                                {user.muted && (
                                  <div className="absolute -bottom-1 -right-1 p-1 bg-red-600 rounded-full">
                                    <VolumeX size={10} className="text-white" />
                                  </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base md:text-xl font-black text-slate-900 tracking-tighter uppercase truncate">{user.name}</h3>
                                  {user.muted && (
                                    <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded-full uppercase">Muted</span>
                                  )}
                                </div>
                                <p className="text-[10px] md:text-xs text-red-600 font-bold flex items-center gap-1 md:gap-2 mt-1">
                                    <Mail size={12} /> @{user.username}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 md:space-y-6">
                            <div>
                                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 flex items-center gap-1.5">
                                    <Shield size={10} /> Roles
                                </p>
                                <div className="flex flex-wrap gap-1 md:gap-2">
                                    {user.roles.map(role => (
                                        <span key={role} className={`px-2 md:px-3 py-1 md:py-1.5 ${role === Role.Coach ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-900 border-slate-200'} rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black border uppercase tracking-tighter`}>
                                            {role}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {user.departments.length > 0 && (
                              <div>
                                <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3">Departments</p>
                                <div className="flex flex-wrap gap-1 md:gap-2">
                                    {user.departments.map(dept => (
                                        <span key={dept} className="px-2 md:px-3 py-1 md:py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-tighter">
                                            {dept}
                                        </span>
                                    ))}
                                </div>
                              </div>
                            )}
                            
                            <div className="pt-4 md:pt-8 border-t-2 border-slate-50">
                                {isCoach ? (
                                  <>
                                    <div className="grid grid-cols-3 gap-2 md:gap-4">
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">DONE</p>
                                            <p className="text-lg md:text-2xl font-black text-slate-950">{stats.completed}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">EFFORT</p>
                                            <p className="text-lg md:text-2xl font-black text-red-600">{stats.effort}</p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">ACTIVE</p>
                                            <p className="text-lg md:text-2xl font-black text-slate-950">{stats.active}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedUserForStats(user)}
                                        className="w-full mt-4 md:mt-8 flex items-center justify-center gap-2 md:gap-3 py-2.5 md:py-4 text-[9px] md:text-[10px] font-black text-slate-500 bg-slate-50 rounded-xl md:rounded-2xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest"
                                    >
                                        <BarChart2 size={12} /> View Performance
                                    </button>
                                  </>
                                ) : (
                                  <div className="text-center py-2">
                                    <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
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

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 md:p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-md p-6 md:p-12 shadow-2xl border-t-8 border-slate-900">
                  <div className="flex justify-between items-start mb-6 md:mb-10">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase mb-1 md:mb-2">Change Password</h2>
                      <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-xs">Update your access key</p>
                    </div>
                    <button onClick={() => { setShowPasswordModal(false); setPasswordError(''); setPasswordForm({ current: '', new: '', confirm: '' }); }} className="p-2 md:p-3 bg-slate-50 rounded-xl hover:text-red-600 transition-all">
                      <X size={20} />
                    </button>
                  </div>

                  {passwordSuccess ? (
                    <div className="flex flex-col items-center py-8 md:py-12">
                      <div className="w-16 h-16 md:w-20 md:h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4 md:mb-6">
                        <Check size={32} />
                      </div>
                      <p className="text-lg md:text-xl font-black text-slate-900 uppercase">Password Updated!</p>
                    </div>
                  ) : (
                    <div className="space-y-4 md:space-y-6">
                      {passwordError && (
                        <div className="p-3 md:p-4 bg-red-50 border border-red-200 rounded-xl md:rounded-2xl text-red-600 text-xs md:text-sm font-bold">
                          {passwordError}
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 ml-2">Current Password</label>
                        <div className="relative">
                          <input 
                            type={showPasswords ? 'text' : 'password'}
                            value={passwordForm.current}
                            onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                            className="w-full p-4 md:p-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-slate-900 transition-all font-bold text-sm md:text-base pr-12"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 ml-2">New Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'}
                          value={passwordForm.new}
                          onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                          className="w-full p-4 md:p-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-slate-900 transition-all font-bold text-sm md:text-base"
                        />
                      </div>

                      <div>
                        <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 ml-2">Confirm New Password</label>
                        <input 
                          type={showPasswords ? 'text' : 'password'}
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                          className="w-full p-4 md:p-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-slate-900 transition-all font-bold text-sm md:text-base"
                        />
                      </div>

                      <button 
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showPasswords ? <EyeOff size={14} /> : <Eye size={14} />}
                        {showPasswords ? 'Hide passwords' : 'Show passwords'}
                      </button>

                      <button 
                        onClick={handleChangePassword}
                        className="w-full py-4 md:py-5 bg-slate-900 text-white font-black rounded-xl md:rounded-2xl hover:bg-slate-800 shadow-xl transition-all uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2"
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
              <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-12 shadow-2xl border-t-8 border-red-600">
                  <div className="flex flex-col items-center text-center mb-6 md:mb-10">
                    <div className="w-16 h-16 md:w-24 md:h-24 bg-red-100 text-red-600 rounded-2xl md:rounded-[32px] flex items-center justify-center mb-4 md:mb-8">
                      <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2 md:mb-4">Confirm Removal</h2>
                    <p className="text-slate-500 font-medium leading-relaxed text-sm md:text-base">
                      You are about to permanently remove <span className="text-red-600 font-black">{userToDelete.name.toUpperCase()}</span> from the team.
                    </p>
                  </div>
                  <div className="flex gap-3 md:gap-4">
                      <button onClick={() => setUserToDelete(null)} className="flex-1 py-4 md:py-5 text-slate-900 font-black hover:bg-slate-100 rounded-xl md:rounded-3xl uppercase tracking-widest transition-all text-xs md:text-sm">Abort</button>
                      <button onClick={handleDeleteConfirm} className="flex-1 py-4 md:py-5 bg-red-600 text-white font-black rounded-xl md:rounded-3xl hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-xs md:text-sm">Confirm</button>
                  </div>
              </div>
          </div>
        )}

        {editingUser && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 md:p-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl md:rounded-[48px] w-full max-w-2xl p-6 md:p-16 shadow-2xl border-t-8 border-red-600 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-start mb-6 md:mb-10">
                      <div>
                        <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-1 md:mb-2">Manage Member</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[9px] md:text-xs">Editing {editingUser.name}</p>
                      </div>
                      <button onClick={() => { setEditingUser(null); setUsernameError(''); }} className="p-2 md:p-3 bg-slate-50 rounded-xl hover:text-red-600 transition-all">
                        <X size={20} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-6 md:space-y-10 pr-2 kanban-scroll">
                        {isCoach && (
                          <section>
                            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Edit3 size={12} className="text-red-600" /> Profile Information
                            </label>
                            <div className="space-y-3 md:space-y-4">
                              <div>
                                <label className="block text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mb-1 md:mb-2 ml-2">Display Name</label>
                                <input 
                                  value={editingUser.name}
                                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                                  className="w-full p-3 md:p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-red-600 transition-all font-black text-sm md:text-base uppercase"
                                />
                              </div>
                              <div>
                                <label className="block text-[8px] md:text-[9px] font-bold text-slate-400 uppercase mb-1 md:mb-2 ml-2">Username (Handle)</label>
                                <input 
                                  value={editingUser.username}
                                  onChange={(e) => {
                                    const newUsername = e.target.value.toLowerCase();
                                    setEditingUser({ ...editingUser, username: newUsername });
                                    const taken = state.users.some(u => u.id !== editingUser.id && u.username.toLowerCase() === newUsername);
                                    setUsernameError(taken ? 'This handle is already taken by another team member' : '');
                                  }}
                                  className={`w-full p-3 md:p-4 bg-slate-50 border-2 rounded-xl md:rounded-2xl outline-none transition-all font-bold text-sm md:text-base ${usernameError ? 'border-red-500 focus:border-red-500' : 'border-slate-100 focus:border-red-600'}`}
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
                            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Shield size={12} className="text-red-600" /> Authorized Roles
                            </label>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                {ROLES.map(role => (
                                    <button
                                        key={role}
                                        onClick={() => {
                                            const newRoles = editingUser.roles.includes(role)
                                                ? editingUser.roles.filter(r => r !== role)
                                                : [...editingUser.roles, role];
                                            setEditingUser({ ...editingUser, roles: newRoles });
                                        }}
                                        className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 text-[10px] md:text-xs font-black uppercase transition-all text-left flex items-center justify-between ${
                                            editingUser.roles.includes(role)
                                            ? 'bg-red-600 border-red-600 text-white shadow-lg'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {role}
                                        {editingUser.roles.includes(role) && <Plus size={12} className="rotate-45" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Settings size={12} className="text-red-600" /> Departments
                            </label>
                            <div className="grid grid-cols-2 gap-2 md:gap-3">
                                {DEPARTMENTS.map(dept => (
                                    <button
                                        key={dept}
                                        onClick={() => {
                                            const newDepts = editingUser.departments.includes(dept)
                                                ? editingUser.departments.filter(d => d !== dept)
                                                : [...editingUser.departments, dept];
                                            setEditingUser({ ...editingUser, departments: newDepts });
                                        }}
                                        className={`p-3 md:p-4 rounded-xl md:rounded-2xl border-2 text-[10px] md:text-xs font-black uppercase transition-all text-left flex items-center justify-between ${
                                            editingUser.departments.includes(dept)
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {dept}
                                        {editingUser.departments.includes(dept) && <Plus size={12} className="rotate-45" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {isCoach && (
                          <section className="pt-4 md:pt-6 border-t border-slate-100">
                             <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 md:mb-4 flex items-center gap-2">
                                <Key size={12} className="text-red-600" /> Security Override
                            </label>
                            <button 
                              onClick={handleResetPassword}
                              className="flex items-center gap-2 md:gap-3 px-4 md:px-6 py-3 md:py-4 bg-red-50 text-red-600 rounded-xl md:rounded-2xl border border-red-100 font-black uppercase tracking-widest text-[9px] md:text-[10px] hover:bg-red-600 hover:text-white transition-all w-full justify-center"
                            >
                              <Key size={14} /> Reset User Password
                            </button>
                            <p className="text-[8px] md:text-[9px] text-slate-400 mt-2 text-center uppercase font-bold italic">Resets to default: "password"</p>
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
                            className={`w-full py-4 md:py-6 font-black rounded-xl md:rounded-[32px] shadow-2xl transition-all uppercase tracking-widest text-xs md:text-sm ${usernameError ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'}`}
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {selectedUserForStats && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-4 md:p-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-2xl md:rounded-[48px] w-full max-w-4xl p-6 md:p-16 max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-6 md:mb-12">
                        <div className="flex items-center gap-4 md:gap-8">
                            <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[32px] bg-red-600 text-white flex items-center justify-center text-2xl md:text-4xl font-black shadow-xl shadow-red-600/20 rotate-3">
                                {selectedUserForStats.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[9px] md:text-xs font-black text-red-600 uppercase tracking-widest mb-0.5 md:mb-1">Performance</p>
                              <h2 className="text-xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase">{selectedUserForStats.name}</h2>
                            </div>
                        </div>
                        <button onClick={() => setSelectedUserForStats(null)} className="p-3 md:p-4 bg-slate-100 text-slate-500 hover:text-red-600 rounded-xl md:rounded-2xl transition-all shadow-sm">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-6 md:space-y-12 pr-2 md:pr-6 kanban-scroll">
                        <section>
                            <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
                              <Trophy className="text-red-600" size={14} /> Completed Tasks
                            </h3>
                            <div className="grid grid-cols-1 gap-3 md:gap-4">
                                {state.tasks.filter(t => t.assignees.includes(selectedUserForStats.id) && t.status === TaskStatus.Complete).map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-4 md:p-8 bg-slate-50 rounded-xl md:rounded-[32px] border-2 border-slate-100 group hover:border-red-600/20 transition-all">
                                        <div className="flex items-center gap-3 md:gap-6 min-w-0 flex-1">
                                            <div className="p-2 md:p-3 bg-red-600 text-white rounded-lg md:rounded-xl shadow-lg flex-shrink-0">
                                              <Trophy size={16} />
                                            </div>
                                            <span className="text-sm md:text-lg font-black text-slate-800 uppercase tracking-tight truncate">{t.title}</span>
                                        </div>
                                        <div className="text-right flex-shrink-0 ml-3">
                                          <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5 md:mb-1">Points</p>
                                          <span className="text-base md:text-xl font-black text-red-600">{t.effort} PTS</span>
                                        </div>
                                    </div>
                                ))}
                                {state.tasks.filter(t => t.assignees.includes(selectedUserForStats.id) && t.status === TaskStatus.Complete).length === 0 && (
                                  <div className="py-8 md:py-12 text-center text-slate-400 font-bold uppercase">No completed tasks yet</div>
                                )}
                            </div>
                        </section>

                        {isCoach && (
                          <section>
                            <div className="flex items-center justify-between mb-4 md:mb-6">
                              <h3 className="text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 md:gap-3">
                                <Clock className="text-red-600" size={14} /> Time History
                              </h3>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-slate-400 uppercase">Total Hours</p>
                                <p className="text-lg font-black text-green-600">{formatDuration(getUserTotalMinutes(selectedUserForStats.id))}</p>
                              </div>
                            </div>
                            <div className="space-y-2 max-h-64 overflow-auto">
                              {getUserTimeEntries(selectedUserForStats.id).map(entry => (
                                <div key={entry.id} className="flex items-center justify-between p-3 md:p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-all">
                                  <div>
                                    <p className="text-xs md:text-sm font-black text-slate-800">{formatDate(entry.checkInAt)}</p>
                                    <p className="text-[10px] text-slate-500 font-bold">
                                      {formatTime(entry.checkInAt)} - {entry.checkOutAt ? formatTime(entry.checkOutAt) : 'In Progress'}
                                    </p>
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
                                    <button onClick={() => openTimeEditModal(entry)} className="p-1.5 text-slate-400 hover:text-red-600">
                                      <Edit3 size={12} />
                                    </button>
                                    <button onClick={() => openAuditModal(entry)} className="p-1.5 text-slate-400 hover:text-red-600">
                                      <History size={12} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                              {getUserTimeEntries(selectedUserForStats.id).length === 0 && (
                                <div className="py-8 text-center text-slate-400 font-bold uppercase">No time entries yet</div>
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
            <div className="bg-white rounded-2xl md:rounded-[32px] w-full max-w-lg p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Edit Time Entry</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase">{getUserName(editingTimeEntry.userId)}</p>
                </div>
                <button onClick={() => setEditingTimeEntry(null)} className="p-2 bg-slate-100 rounded-xl hover:text-red-600">
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Check In</label>
                  <input
                    type="datetime-local"
                    value={timeEditForm.checkInAt}
                    onChange={(e) => setTimeEditForm({ ...timeEditForm, checkInAt: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Check Out</label>
                  <input
                    type="datetime-local"
                    value={timeEditForm.checkOutAt}
                    onChange={(e) => setTimeEditForm({ ...timeEditForm, checkOutAt: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea
                    value={timeEditForm.notes}
                    onChange={(e) => setTimeEditForm({ ...timeEditForm, notes: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-red-600 font-medium h-20 resize-none"
                    placeholder="Optional notes..."
                  />
                </div>
                <button
                  onClick={handleSaveTimeEdit}
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
                        {new Date(log.createdAt).toLocaleString([], { timeZone: 'America/Los_Angeles' })}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-600">By: {getUserName(log.actorId)}</p>
                    {log.deltaMinutes !== undefined && log.deltaMinutes !== null && (
                      <p className={`text-xs font-black mt-1 ${log.deltaMinutes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.deltaMinutes >= 0 ? '+' : ''}{log.deltaMinutes} minutes
                      </p>
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
    
    const newUser: User = {
      id: Date.now().toString(),
      name: name.trim(),
      username: username.toLowerCase(),
      password: 'password',
      roles: [Role.TeamMember],
      departments: [Department.Mechanical]
    };
    onAdd(newUser);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4 md:p-6 animate-in fade-in duration-300">
      <div className="bg-white rounded-2xl md:rounded-[48px] w-full max-w-2xl p-6 md:p-16 shadow-2xl animate-in zoom-in duration-300 border-t-8 border-red-600">
        <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-6 md:mb-10 text-center">Add New Member</h2>
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-8">
          <div>
            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 ml-2">Full Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
              placeholder="e.g. ALEX RIVERA" 
              className="w-full p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[32px] outline-none focus:border-red-600 transition-all font-black text-sm md:text-lg uppercase tracking-tight" 
            />
          </div>
          <div>
            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 md:mb-3 ml-2">Username (Handle)</label>
            <input 
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              required 
              placeholder="arivera" 
              className={`w-full p-4 md:p-6 bg-slate-50 border-2 rounded-xl md:rounded-[32px] outline-none transition-all font-black text-sm md:text-lg tracking-tight ${error ? 'border-red-500 focus:border-red-500' : 'border-slate-100 focus:border-red-600'}`} 
            />
            {error && (
              <p className="text-red-500 text-[9px] md:text-[10px] font-bold mt-2 ml-2 flex items-center gap-1">
                <AlertCircle size={10} /> {error}
              </p>
            )}
          </div>
          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase text-center">Default password will be "password"</p>
          <div className="pt-4 md:pt-8 flex gap-3 md:gap-4">
            <button type="button" onClick={onCancel} className="flex-1 py-4 md:py-6 text-slate-900 font-black hover:bg-slate-100 rounded-xl md:rounded-[32px] transition-all uppercase tracking-widest text-xs md:text-sm">Cancel</button>
            <button 
              type="submit" 
              disabled={!!error}
              className={`flex-1 py-4 md:py-6 font-black rounded-xl md:rounded-[32px] shadow-2xl transition-all uppercase tracking-widest text-xs md:text-sm ${error ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'}`}
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
