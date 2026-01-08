import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppState, User, Project, Task, Role, Department, TaskStatus, Priority, Notification, Announcement, TimeEntry } from './types';
import Layout from './components/Layout';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import TeamManagement from './components/TeamManagement';
import TimeTracking from './components/TimeTracking';
import TaskModal from './components/TaskModal';
import { api } from './services/api';
import { Database, Zap } from 'lucide-react';

const TeamLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="10" fill="currentColor" />
    <circle cx="12" cy="12" r="5" fill="white" />
    <circle cx="12" cy="88" r="5" fill="white" />
    <circle cx="88" cy="88" r="5" fill="white" />
    <rect x="25" y="8" width="55" height="30" rx="4" fill="white" fillOpacity="0.1" />
    <rect x="58" y="8" width="14" height="24" fill="white" />
    <circle cx="50" cy="48" r="16" fill="white" />
    <circle cx="50" cy="48" r="6" fill="black" />
    <circle cx="56" cy="48" r="2" fill="black" />
    <text x="50" y="82" fontFamily="monospace" fontWeight="900" fontSize="19" fill="white" textAnchor="middle" letterSpacing="-1">10991</text>
  </svg>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    users: [],
    projects: [],
    tasks: [],
    notifications: [],
    announcements: [],
    timeEntries: [],
    currentUser: null
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTaskModal, setActiveTaskModal] = useState<Task | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [users, projects, tasks, notifications, announcements, timeEntries] = await Promise.all([
        api.users.getAll(),
        api.projects.getAll(),
        api.tasks.getAll(),
        api.notifications.getAll(),
        api.announcements.getAll(),
        api.timeEntries.getAll(),
      ]);
      setState(prev => ({
        ...prev,
        users: users.map((u: any) => ({ ...u, id: String(u.id) })),
        projects: projects.map((p: any) => ({ ...p, id: String(p.id), createdAt: new Date(p.createdAt).getTime() })),
        tasks: tasks.map((t: any) => ({ 
          ...t, 
          id: String(t.id), 
          projectId: String(t.projectId),
          assignees: (t.assignees || []).map(String),
          dependencies: (t.dependencies || []).map(String),
          createdAt: new Date(t.createdAt).getTime(),
          completedAt: t.completedAt ? new Date(t.completedAt).getTime() : undefined
        })),
        notifications: notifications.map((n: any) => ({ 
          ...n, 
          id: String(n.id), 
          toUserId: String(n.toUserId), 
          fromUserId: String(n.fromUserId),
          taskId: n.taskId ? String(n.taskId) : undefined,
          timestamp: new Date(n.timestamp).getTime() 
        })),
        announcements: announcements.map((a: any) => ({ 
          ...a, 
          id: String(a.id), 
          authorId: String(a.authorId),
          timestamp: new Date(a.timestamp).getTime() 
        })),
        timeEntries: timeEntries.map((e: any) => ({
          ...e,
          id: String(e.id),
          userId: String(e.userId),
          checkInAt: new Date(e.checkInAt).getTime(),
          checkOutAt: e.checkOutAt ? new Date(e.checkOutAt).getTime() : undefined,
          checkInConfirmedBy: e.checkInConfirmedBy ? String(e.checkInConfirmedBy) : undefined,
          checkInConfirmedAt: e.checkInConfirmedAt ? new Date(e.checkInConfirmedAt).getTime() : undefined,
          checkOutConfirmedBy: e.checkOutConfirmedBy ? String(e.checkOutConfirmedBy) : undefined,
          checkOutConfirmedAt: e.checkOutConfirmedAt ? new Date(e.checkOutConfirmedAt).getTime() : undefined,
          createdAt: new Date(e.createdAt).getTime(),
        })),
      }));
      setIsCloudSynced(true);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setIsCloudSynced(true);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const savedUserId = localStorage.getItem('frc_hub_active_user');
    if (savedUserId && state.users.length > 0 && !state.currentUser) {
      const user = state.users.find(u => u.id === savedUserId);
      if (user) {
        setState(p => ({ ...p, currentUser: user }));
        setIsLoggedIn(true);
      }
    }
  }, [state.users, state.currentUser]);

  const handleSeedDatabase = async () => {
    try {
      await api.seed();
      await fetchData();
      alert("Database seeded successfully! You can now log in as 'captain' with password 'password'.");
    } catch (e) {
      console.error("Seeding failed", e);
      alert("Seeding failed. Please try again.");
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    const taskData: any = { ...updatedTask };
    if (taskData.status === TaskStatus.Complete && !taskData.completedAt) {
      taskData.completedAt = new Date().toISOString();
    } else if (taskData.status !== TaskStatus.Complete) {
      taskData.completedAt = null;
    }
    taskData.projectId = parseInt(taskData.projectId);
    taskData.assignees = taskData.assignees.map(Number);
    taskData.dependencies = taskData.dependencies.map(Number);
    await api.tasks.update(parseInt(updatedTask.id), taskData);
    await fetchData();
  };

  const handleUpdateAnnouncement = async (updatedAnn: Announcement) => {
    const data: any = { ...updatedAnn };
    data.authorId = parseInt(data.authorId);
    await api.announcements.update(parseInt(updatedAnn.id), data);
    await fetchData();
  };

  const handleDeleteTask = async (taskId: string) => {
    await api.tasks.delete(parseInt(taskId));
    await fetchData();
  };

  const handleNotify = async (taskId: string, toUserId: string, message: string) => {
    const isBroadcast = taskId.startsWith('broadcast:');
    await api.notifications.create({
      toUserId: parseInt(toUserId),
      fromUserId: parseInt(state.currentUser?.id || '0'),
      taskId: isBroadcast ? null : parseInt(taskId),
      message: isBroadcast ? `[broadcast:${taskId.split(':')[1]}] ${message}` : message,
      read: false
    });
    await fetchData();
  };

  const handleClearNotification = async (id: string) => {
    const notification = state.notifications.find(n => n.id === id);
    if (notification) {
      await api.notifications.update(parseInt(id), { read: true });
      await fetchData();
    }
  };

  const handleAddAnnouncement = async (ann: Announcement) => {
    const data: any = { ...ann };
    data.authorId = parseInt(data.authorId);
    delete data.id;
    await api.announcements.create(data);
    await fetchData();
  };

  const handleLogin = async (username: string, password?: string) => {
    try {
      const user = await api.auth.login(username, password || '');
      const mappedUser = { ...user, id: String(user.id) };
      setState(prev => ({ ...prev, currentUser: mappedUser }));
      setIsLoggedIn(true);
      localStorage.setItem('frc_hub_active_user', mappedUser.id);
    } catch (error) {
      alert('Invalid credentials. (Default password is "password")');
    }
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, currentUser: null }));
    setIsLoggedIn(false);
    localStorage.removeItem('frc_hub_active_user');
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="bg-white rounded-[40px] p-16 w-full max-w-xl shadow-[0_0_100px_rgba(225,29,72,0.15)] animate-in zoom-in duration-500">
          <div className="text-center mb-12">
            <div className="w-32 h-32 mx-auto mb-8 shadow-2xl shadow-red-600/40 transform rotate-3">
                <TeamLogo className="w-full h-full text-red-600" />
            </div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase mb-3 leading-tight">PIO-BYTES HUB</h1>
            <p className="text-slate-400 font-black text-sm uppercase tracking-widest">TEAM 10991 ROBOTICS</p>
          </div>

          {state.users.length === 0 && isCloudSynced ? (
            <div className="bg-slate-50 border-2 border-slate-100 p-8 rounded-[32px] text-center space-y-6">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Database size={32} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-slate-900 uppercase">Database Empty</h2>
                    <p className="text-xs text-slate-500 font-bold uppercase mt-1">Initialize your team to begin</p>
                </div>
                <button 
                    onClick={handleSeedDatabase}
                    className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                    <Zap size={16} fill="currentColor" />
                    Seed Initial Team
                </button>
            </div>
          ) : (
            <>
              <form onSubmit={(e) => {
                e.preventDefault();
                const username = (e.currentTarget.elements.namedItem('username') as HTMLInputElement).value;
                const password = (e.currentTarget.elements.namedItem('password') as HTMLInputElement).value;
                handleLogin(username, password);
              }} className="space-y-8">
                <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Secure Username</label>
                    <input name="username" placeholder="captain / coach" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-red-600/10 focus:border-red-600 transition-all font-black uppercase text-sm" />
                </div>
                <div className="space-y-2">
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Access Key</label>
                    <input type="password" name="password" placeholder="••••••••" className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl outline-none focus:ring-4 focus:ring-red-600/10 focus:border-red-600 transition-all font-black text-sm" />
                </div>
                <button type="submit" className="w-full py-6 bg-red-600 text-white font-black rounded-3xl hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all transform active:scale-95 text-xl tracking-widest uppercase">
                    Initialize System
                </button>
              </form>
            </>
          )}

          <div className="mt-12 pt-8 border-t border-slate-100 text-center">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">
                {isCloudSynced ? 'Authorized Access Only • Cloud Sync Ready' : 'Connecting to Terminal...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const unreadCount = state.notifications.filter(n => n.toUserId === state.currentUser?.id && !n.read).length;

  return (
    <HashRouter>
      <Layout user={state.currentUser} notificationsCount={unreadCount} onLogout={handleLogout} isSynced={isCloudSynced}>
        <Routes>
          <Route path="/" element={
            <Home 
              state={state} 
              onTaskClick={setActiveTaskModal} 
              onClearNotification={handleClearNotification} 
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onNotify={handleNotify}
            />
          } />
          <Route path="/war-room" element={
            <Dashboard 
              state={state} 
              onUpdateTask={handleUpdateTask} 
              onDeleteTask={handleDeleteTask} 
              onNotify={handleNotify}
            />
          } />
          <Route path="/boards" element={
            <KanbanBoard 
              state={state} 
              onAddTask={async (t) => {
                  const taskData: any = { ...t };
                  if (taskData.status === TaskStatus.Complete) taskData.completedAt = new Date().toISOString();
                  taskData.projectId = parseInt(taskData.projectId);
                  taskData.assignees = taskData.assignees.map(Number);
                  taskData.dependencies = taskData.dependencies.map(Number);
                  delete taskData.id;
                  await api.tasks.create(taskData);
                  await fetchData();
              }}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onNotify={handleNotify}
              onAddProject={async (proj) => {
                const data: any = { ...proj };
                delete data.id;
                await api.projects.create(data);
                await fetchData();
              }}
              onUpdateProject={async (proj) => {
                const data: any = { ...proj };
                data.scrumMasters = proj.scrumMasters.map(Number);
                await api.projects.update(parseInt(proj.id), data);
                await fetchData();
              }}
              onArchiveProject={async (id) => {
                const project = state.projects.find(p => p.id === id);
                await api.projects.update(parseInt(id), { archived: !project?.archived });
                await fetchData();
              }}
            />
          } />
          <Route path="/time" element={
            <TimeTracking state={state} onRefresh={fetchData} />
          } />
          <Route path="/team" element={
            <TeamManagement 
              state={state}
              onAddUser={async (u) => {
                const data: any = { ...u };
                delete data.id;
                await api.users.create(data);
                await fetchData();
              }}
              onUpdateUser={async (u) => {
                await api.users.update(parseInt(u.id), u);
                await fetchData();
              }}
              onDeleteUser={async (id) => {
                await api.users.delete(parseInt(id));
                await fetchData();
              }}
            />
          } />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>

        {activeTaskModal && (
          <TaskModal 
            task={activeTaskModal}
            users={state.users}
            allTasks={state.tasks}
            currentUser={state.currentUser}
            onClose={() => setActiveTaskModal(null)}
            onNotify={(to, msg) => handleNotify(activeTaskModal.id, to, msg)}
            onSave={async (updated) => {
              await handleUpdateTask(updated);
              setActiveTaskModal(null);
            }}
            onDelete={async (id) => {
              await handleDeleteTask(id);
              setActiveTaskModal(null);
            }}
          />
        )}
      </Layout>
    </HashRouter>
  );
};

export default App;
