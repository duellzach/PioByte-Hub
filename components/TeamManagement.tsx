
import React, { useState, useMemo } from 'react';
import { User, AppState, Role, Department, TaskStatus } from '../types';
import { Plus, Search, Mail, Trash2, Trophy, BarChart2, AlertCircle, X, Shield, Settings, Key, UserPlus } from 'lucide-react';
import { DEPARTMENT_COLORS, ROLES, DEPARTMENTS } from '../constants';

interface TeamProps {
  state: AppState;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
}

const TeamManagement: React.FC<TeamProps> = ({ state, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [search, setSearch] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUserForStats, setSelectedUserForStats] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const isCoach = useMemo(() => state.currentUser?.roles.includes(Role.Coach), [state.currentUser]);
  const isCaptain = useMemo(() => state.currentUser?.roles.includes(Role.TeamCaptain), [state.currentUser]);
  
  const canEditUsers = isCoach || isCaptain;

  const filteredUsers = state.users.filter(u => 
    u.name.toLowerCase().includes(search.toLowerCase()) || 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const getUserStats = (userId: string) => {
    const userTasks = state.tasks.filter(t => t.assignees.includes(userId));
    const completedTasks = userTasks.filter(t => t.status === TaskStatus.Complete);
    const totalEffort = completedTasks.reduce((acc, t) => acc + (t.effort || 0), 0);
    const activeTasks = userTasks.filter(t => t.status !== TaskStatus.Complete);

    return { total: userTasks.length, completed: completedTasks.length, effort: totalEffort, active: activeTasks.length };
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

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="relative flex-1 max-w-2xl">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                <input 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="SEARCH TEAM DIRECTORY..."
                    className="w-full pl-16 pr-8 py-5 bg-white border-2 border-slate-100 rounded-[32px] focus:ring-8 focus:ring-red-600/10 focus:border-red-600 outline-none transition-all font-black text-sm uppercase tracking-widest"
                />
            </div>
            {canEditUsers && (
              <button 
                  onClick={() => setIsAdding(true)}
                  className="flex items-center justify-center gap-4 px-10 py-5 bg-red-600 text-white font-black rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all transform active:scale-95 uppercase tracking-widest text-sm"
              >
                  <UserPlus size={20} />
                  Add New Member
              </button>
            )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8">
            {filteredUsers.map(user => {
                const stats = getUserStats(user.id);
                const userIsCoach = user.roles.includes(Role.Coach);
                return (
                    <div key={user.id} className="bg-white p-10 rounded-[40px] border-2 border-slate-100 shadow-sm hover:shadow-2xl hover:border-red-600/20 transition-all relative group overflow-hidden">
                        <div className={`absolute top-0 left-0 w-full h-2 ${userIsCoach ? 'bg-black' : 'bg-slate-100'} group-hover:bg-red-600 transition-colors`} />
                        
                        <div className="absolute top-8 right-8 flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {canEditUsers && (
                            <button 
                                onClick={() => setEditingUser(user)}
                                className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                title="Manage User"
                            >
                                <Settings size={20} />
                            </button>
                          )}
                          {isCoach && user.id !== state.currentUser?.id && (
                            <button 
                                onClick={() => setUserToDelete(user)}
                                className="p-3 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all"
                                title="Delete Member"
                            >
                                <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-6 mb-8">
                            <div className={`w-20 h-20 rounded-3xl ${userIsCoach ? 'bg-black border-slate-700' : 'bg-slate-950 border-slate-900'} text-white flex items-center justify-center text-3xl font-black border-4 shadow-xl group-hover:bg-red-600 group-hover:border-red-500 transition-all transform group-hover:rotate-3`}>
                                {user.name[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">{user.name}</h3>
                                <p className="text-xs text-red-600 font-bold flex items-center gap-2 mt-1">
                                    <Mail size={14} /> @{user.username}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                                    <Shield size={12} /> Ranks & Roles
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {user.roles.map(role => (
                                        <span key={role} className={`px-3 py-1.5 ${role === Role.Coach ? 'bg-black text-white border-black' : 'bg-slate-50 text-slate-900 border-slate-200'} rounded-xl text-[10px] font-black border uppercase tracking-tighter`}>
                                            {role}
                                        </span>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="pt-8 border-t-2 border-slate-50">
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">DONE</p>
                                        <p className="text-2xl font-black text-slate-950">{stats.completed}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">EFFORT</p>
                                        <p className="text-2xl font-black text-red-600">{stats.effort}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">ACTIVE</p>
                                        <p className="text-2xl font-black text-slate-950">{stats.active}</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setSelectedUserForStats(user)}
                                    className="w-full mt-8 flex items-center justify-center gap-3 py-4 text-[10px] font-black text-slate-500 bg-slate-50 rounded-2xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest"
                                >
                                    <BarChart2 size={14} /> View Performance
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Delete Confirmation Modal */}
        {userToDelete && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
              <div className="bg-white rounded-[40px] w-full max-w-xl p-12 shadow-2xl border-t-8 border-red-600">
                  <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[32px] flex items-center justify-center mb-8">
                      <AlertCircle size={48} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-4">Confirm Removal</h2>
                    <p className="text-slate-500 font-medium leading-relaxed">
                      You are about to permanently remove <span className="text-red-600 font-black">{userToDelete.name.toUpperCase()}</span> from the PioBytes operational system.
                    </p>
                  </div>
                  <div className="flex gap-4">
                      <button onClick={() => setUserToDelete(null)} className="flex-1 py-5 text-slate-900 font-black hover:bg-slate-100 rounded-3xl uppercase tracking-widest transition-all text-sm">Abort</button>
                      <button onClick={handleDeleteConfirm} className="flex-1 py-5 bg-red-600 text-white font-black rounded-3xl hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-sm">Confirm</button>
                  </div>
              </div>
          </div>
        )}

        {/* Edit User Modal */}
        {editingUser && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-[48px] w-full max-w-2xl p-16 shadow-2xl border-t-8 border-red-600 overflow-hidden flex flex-col max-h-[90vh]">
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Manage Rank</h2>
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Adjust profile for {editingUser.name}</p>
                      </div>
                      <button onClick={() => setEditingUser(null)} className="p-3 bg-slate-50 rounded-xl hover:text-red-600 transition-all">
                        <X size={24} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-10 pr-2 kanban-scroll">
                        <section>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Shield size={14} className="text-red-600" /> Authorized Roles
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {ROLES.map(role => (
                                    <button
                                        key={role}
                                        onClick={() => {
                                            const newRoles = editingUser.roles.includes(role)
                                                ? editingUser.roles.filter(r => r !== role)
                                                : [...editingUser.roles, role];
                                            setEditingUser({ ...editingUser, roles: newRoles });
                                        }}
                                        className={`p-4 rounded-2xl border-2 text-xs font-black uppercase transition-all text-left flex items-center justify-between ${
                                            editingUser.roles.includes(role)
                                            ? 'bg-red-600 border-red-600 text-white shadow-lg'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {role}
                                        {editingUser.roles.includes(role) && <Plus size={14} className="rotate-45" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        <section>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Settings size={14} className="text-red-600" /> Departments
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                                {DEPARTMENTS.map(dept => (
                                    <button
                                        key={dept}
                                        onClick={() => {
                                            const newDepts = editingUser.departments.includes(dept)
                                                ? editingUser.departments.filter(d => d !== dept)
                                                : [...editingUser.departments, dept];
                                            setEditingUser({ ...editingUser, departments: newDepts });
                                        }}
                                        className={`p-4 rounded-2xl border-2 text-xs font-black uppercase transition-all text-left flex items-center justify-between ${
                                            editingUser.departments.includes(dept)
                                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg'
                                            : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                                        }`}
                                    >
                                        {dept}
                                        {editingUser.departments.includes(dept) && <Plus size={14} className="rotate-45" />}
                                    </button>
                                ))}
                            </div>
                        </section>

                        {isCoach && (
                          <section className="pt-6 border-t border-slate-100">
                             <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Key size={14} className="text-red-600" /> Security Override
                            </label>
                            <button 
                              onClick={handleResetPassword}
                              className="flex items-center gap-3 px-6 py-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-black uppercase tracking-widest text-[10px] hover:bg-red-600 hover:text-white transition-all w-full justify-center"
                            >
                              <Key size={16} /> Reset User Password
                            </button>
                            <p className="text-[9px] text-slate-400 mt-2 text-center uppercase font-bold italic">Resets to default: "password"</p>
                          </section>
                        )}
                    </div>

                    <div className="pt-10">
                        <button 
                            onClick={() => {
                                onUpdateUser(editingUser);
                                setEditingUser(null);
                            }}
                            className="w-full py-6 bg-red-600 text-white font-black rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-sm"
                        >
                            Commit Changes
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Existing Add/Stats modals remain but with matched styling */}
        {/* ... (SelectedUserForStats and AddMember modals kept as they were, integrated into the same theme) ... */}
        {selectedUserForStats && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[70] p-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-[48px] w-full max-w-4xl p-16 max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in duration-300">
                    <div className="flex justify-between items-center mb-12">
                        <div className="flex items-center gap-8">
                            <div className="w-24 h-24 rounded-[32px] bg-red-600 text-white flex items-center justify-center text-4xl font-black shadow-xl shadow-red-600/20 rotate-3">
                                {selectedUserForStats.name[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="text-xs font-black text-red-600 uppercase tracking-[0.3em] mb-1">Member Performance Profile</p>
                              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">{selectedUserForStats.name}</h2>
                            </div>
                        </div>
                        <button onClick={() => setSelectedUserForStats(null)} className="p-4 bg-slate-100 text-slate-500 hover:text-red-600 rounded-2xl transition-all shadow-sm">
                            <X size={28} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto space-y-12 pr-6 kanban-scroll">
                        <section>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                              <Trophy className="text-red-600" size={18} /> MISSION ACCOMPLISHED
                            </h3>
                            <div className="grid grid-cols-1 gap-4">
                                {state.tasks.filter(t => t.assignees.includes(selectedUserForStats.id) && t.status === TaskStatus.Complete).map(t => (
                                    <div key={t.id} className="flex items-center justify-between p-8 bg-slate-50 rounded-[32px] border-2 border-slate-100 group hover:border-red-600/20 transition-all">
                                        <div className="flex items-center gap-6">
                                            <div className="p-3 bg-red-600 text-white rounded-xl shadow-lg">
                                              <Trophy size={20} />
                                            </div>
                                            <span className="text-lg font-black text-slate-800 uppercase tracking-tight">{t.title}</span>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">POINTS AWARDED</p>
                                          <span className="text-xl font-black text-red-600">{t.effort} PTS</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        )}

        {isAdding && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-6 animate-in fade-in duration-300">
                <div className="bg-white rounded-[48px] w-full max-w-2xl p-16 shadow-2xl animate-in zoom-in duration-300 border-t-8 border-red-600">
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-10 text-center">Enlist New Member</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const newUser: User = {
                            id: Date.now().toString(),
                            name: formData.get('name') as string,
                            username: (formData.get('username') as string).toLowerCase(),
                            password: 'password', // Initial password
                            roles: [Role.TeamMember],
                            departments: [Department.Mechanical]
                        };
                        onAddUser(newUser);
                        setIsAdding(false);
                    }} className="space-y-8">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Full Designation (Name)</label>
                            <input name="name" required placeholder="e.g. ALEX RIVERA" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] outline-none focus:border-red-600 transition-all font-black text-lg uppercase tracking-tight" />
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">System Username (Handle)</label>
                            <input name="username" required placeholder="arivera" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] outline-none focus:border-red-600 transition-all font-black text-lg uppercase tracking-tight" />
                        </div>
                        <div className="pt-8 flex gap-4">
                            <button type="button" onClick={() => setIsAdding(false)} className="flex-1 py-6 text-slate-900 font-black hover:bg-slate-100 rounded-[32px] transition-all uppercase tracking-widest text-sm">Cancel</button>
                            <button type="submit" className="flex-1 py-6 bg-red-600 text-white font-black rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-sm">Activate Member</button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};

export default TeamManagement;
