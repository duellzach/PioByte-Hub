
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppState, User, Project, Task, Role, Department, TaskStatus, Priority, Notification, Announcement } from './types';
import Layout from './components/Layout';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import TeamManagement from './components/TeamManagement';
import TaskModal from './components/TaskModal';
import { saveDoc, removeDoc, syncCollection, tasksCol, usersCol, projectsCol, notificationsCol, announcementsCol } from './services/firebase';
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

const DEFAULT_USERS: User[] = [
  { id: '1', username: 'captain', password: 'password', name: 'John Doe', roles: [Role.TeamCaptain, Role.ScrumMaster], departments: [Department.Software, Department.Modeling] },
  { id: '2', username: 'coach', password: 'password', name: 'Mentor Mike', roles: [Role.Coach], departments: [Department.Logistics, Department.Business] },
  { id: '3', username: 'mech_lead', password: 'password', name: 'Jane Smith', roles: [Role.DepartmentHead], departments: [Department.Mechanical] },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    users: [],
    projects: [],
    tasks: [],
    notifications: [],
    announcements: [],
    currentUser: null
  });

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeTaskModal, setActiveTaskModal] = useState<Task | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Synchronize with Firebase Real-time
  useEffect(() => {
    const unsubTasks = syncCollection(tasksCol, (data) => setState(p => ({ ...p, tasks: data as Task[] })));
    const unsubUsers = syncCollection(usersCol, (data) => setState(p => ({ ...p, users: data as User[] })));
    const unsubProjs = syncCollection(projectsCol, (data) => setState(p => ({ ...p, projects: data as Project[] })));
    const unsubNotifs = syncCollection(notificationsCol, (data) => setState(p => ({ ...p, notifications: data as Notification[] })));
    const unsubAnns = syncCollection(announcementsCol, (data) => setState(p => ({ ...p, announcements: data as Announcement[] })), 'timestamp');

    // Basic heuristic for sync status
    const timer = setTimeout(() => setIsCloudSynced(true), 1000);

    return () => {
      unsubTasks();
      unsubUsers();
      unsubProjs();
      unsubNotifs();
      unsubAnns();
      clearTimeout(timer);
    };
  }, []);

  // Handle Session persistence
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
        for (const user of DEFAULT_USERS) {
            await saveDoc("users", user);
        }
        await saveDoc("projects", {
            id: 'proj-1',
            name: '2025 Competition Robot',
            description: 'Initial season build',
            createdAt: Date.now(),
            archived: false
        });
        alert("Database seeded successfully! You can now log in as 'captain' with password 'password'.");
    } catch (e) {
        console.error("Seeding failed", e);
        alert("Seeding failed. Check your Firebase config and Firestore rules.");
    }
  };

  const handleUpdateTask = async (updatedTask: Task) => {
    const taskData = { ...updatedTask };
    if (taskData.status === TaskStatus.Complete && !taskData.completedAt) {
      taskData.completedAt = Date.now();
    } else if (taskData.status !== TaskStatus.Complete) {
      taskData.completedAt = undefined;
    }
    await saveDoc("tasks", taskData);
  };

  const handleUpdateAnnouncement = async (updatedAnn: Announcement) => {
    await saveDoc("announcements", updatedAnn);
  };

  const handleDeleteTask = async (taskId: string) => {
    await removeDoc("tasks", taskId);
  };

  const handleNotify = async (taskId: string, toUserId: string, message: string) => {
    const newNotification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      toUserId,
      fromUserId: state.currentUser?.id || 'unknown',
      taskId,
      message,
      timestamp: Date.now(),
      read: false
    };
    await saveDoc("notifications", newNotification);
  };

  const handleClearNotification = async (id: string) => {
    const notification = state.notifications.find(n => n.id === id);
    if (notification) {
      await saveDoc("notifications", { ...notification, read: true });
    }
  };

  const handleAddAnnouncement = async (ann: Announcement) => {
    await saveDoc("announcements", ann);
  };

  const handleLogin = (username: string, password?: string) => {
    const user = state.users.find(u => u.username === username.toLowerCase());
    if (user && user.password === password) {
      setState(prev => ({ ...prev, currentUser: user }));
      setIsLoggedIn(true);
      localStorage.setItem('frc_hub_active_user', user.id);
    } else {
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
                  if (t.status === TaskStatus.Complete) t.completedAt = Date.now();
                  t.createdAt = Date.now();
                  await saveDoc("tasks", t);
              }}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onNotify={handleNotify}
              onAddProject={async (proj) => await saveDoc("projects", proj)}
              onArchiveProject={async (id) => {
                const proj = state.projects.find(p => p.id === id);
                if (proj) await saveDoc("projects", { ...proj, archived: true });
              }}
            />
          } />
          <Route path="/team" element={
            <TeamManagement 
              state={state}
              onAddUser={async (u) => await saveDoc("users", u)}
              onUpdateUser={async (u) => await saveDoc("users", u)}
              onDeleteUser={async (id) => await removeDoc("users", id)}
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
