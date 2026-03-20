import React, { useState, useEffect, useCallback, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppState, User, Project, Task, Role, Department, TaskStatus, Priority, Notification, Announcement, TimeEntry } from './types';
import Layout from './components/Layout';
import Home from './components/Home';
import Dashboard from './components/Dashboard';
import KanbanBoard from './components/KanbanBoard';
import TeamManagement from './components/TeamManagement';
import TimeTracking from './components/TimeTracking';
import Scout from './components/Scout';
import SafetyCertifications from './components/SafetyCertifications';
import Calendar from './components/Calendar';
import Resources from './components/Resources';
import TaskModal from './components/TaskModal';
import Confetti from './components/Confetti';
import { api } from './services/api';
import { Database, Zap, X, Bell, ShieldAlert, AlertTriangle } from 'lucide-react';

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
  const [showConfetti, setShowConfetti] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('piobyte_dark_mode') === 'true');
  const [globalAlerts, setGlobalAlerts] = useState<any[]>([]);
  const [annToast, setAnnToast] = useState<{ text: string; scope: string; dept?: string; authorName?: string } | null>(null);
  const lastShownAnnRef = useRef<string | null>(localStorage.getItem('lastSeenAnnouncementId'));
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<number>>(() => {
    try {
      const stored = sessionStorage.getItem('piobyte_dismissed_alerts');
      return stored ? new Set(JSON.parse(stored)) : new Set<number>();
    } catch { return new Set<number>(); }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('piobyte_dark_mode', String(darkMode));
  }, [darkMode]);

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
        projects: projects.map((p: any) => ({ ...p, id: String(p.id), createdAt: new Date(p.createdAt).getTime(), scrumMasters: (p.scrumMasters || []).map(String) })),
        tasks: tasks.map((t: any) => ({ 
          ...t, 
          id: String(t.id), 
          projectId: String(t.projectId),
          assignees: (t.assignees || []).map(String),
          contributors: (t.contributors || []).map(String),
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
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    if (!annToast) return;
    const timer = setTimeout(() => setAnnToast(null), 8000);
    return () => clearTimeout(timer);
  }, [annToast]);

  useEffect(() => {
    if (!isLoggedIn || !state.currentUser || !state.announcements.length) return;
    const sorted = [...state.announcements].sort((a, b) => b.timestamp - a.timestamp);
    const latest = sorted[0];
    if (!latest) return;
    if (lastShownAnnRef.current === null) {
      lastShownAnnRef.current = latest.id;
      localStorage.setItem('lastSeenAnnouncementId', latest.id);
      return;
    }
    if (latest.id === lastShownAnnRef.current) return;
    lastShownAnnRef.current = latest.id;
    if (latest.authorId === state.currentUser.id) return;
    const isGlobal = latest.scope === 'Global';
    const isDeptMatch = state.currentUser.departments.some((d: string) => d === latest.targetDepartment);
    if (!isGlobal && !isDeptMatch) return;
    const author = state.users.find((u: any) => u.id === latest.authorId);
    setAnnToast({
      text: latest.text,
      scope: latest.scope || 'Global',
      dept: latest.targetDepartment,
      authorName: author?.name || 'Team',
    });
    localStorage.setItem('lastSeenAnnouncementId', latest.id);
  }, [state.announcements, state.currentUser, isLoggedIn, state.users]);

  const fetchAlerts = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const alerts = await api.fullscreenAlerts.list(true);
      setGlobalAlerts(alerts.filter((a: any) => a.targetAll));
    } catch {}
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, [fetchAlerts, isLoggedIn]);

  const dismissAlert = (id: number) => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem('piobyte_dismissed_alerts', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

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
    const existingTask = state.tasks.find(t => t.id === updatedTask.id);
    const isNewlyCompleted = updatedTask.status === TaskStatus.Complete && existingTask?.status !== TaskStatus.Complete;
    
    const taskData: any = { ...updatedTask };
    if (taskData.status === TaskStatus.Complete && !taskData.completedAt) {
      taskData.completedAt = new Date().toISOString();
    } else if (taskData.status !== TaskStatus.Complete) {
      taskData.completedAt = null;
    }
    taskData.projectId = parseInt(taskData.projectId);
    taskData.assignees = taskData.assignees.map(Number);
    taskData.contributors = (taskData.contributors || []).map(Number);
    taskData.dependencies = taskData.dependencies.map(Number);
    await api.tasks.update(parseInt(updatedTask.id), taskData);
    
    if (isNewlyCompleted) {
      setShowConfetti(true);
    }
    
    await fetchData();
  };

  const handleUpdateAnnouncement = async (updatedAnn: Announcement) => {
    const data: any = { ...updatedAnn };
    data.authorId = parseInt(data.authorId);
    await api.announcements.update(parseInt(updatedAnn.id), data);
    await fetchData();
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    await api.announcements.delete(parseInt(annId));
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
    setAnnToast({ text: ann.text, scope: ann.scope || 'Global', dept: ann.targetDepartment, authorName: 'You' });
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
        <div className="bg-white dark:bg-slate-900 rounded-[40px] p-16 w-full max-w-xl shadow-[0_0_100px_rgba(225,29,72,0.15)] animate-in zoom-in duration-500">
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
  
  const activeProjects = state.projects.filter(p => !p.archived && p.showInWarRoom !== false);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const weeklyEffort = state.tasks.reduce((acc, t) => {
    if (t.status === TaskStatus.Complete && t.completedAt && t.completedAt >= startOfWeek.getTime()) {
      return acc + (t.effort || 0);
    }
    return acc;
  }, 0);
  
  const layoutStats = {
    weeklyEffort,
    activeCount: state.tasks.filter(t => t.status === TaskStatus.InProgress).length,
    blockedCount: state.tasks.filter(t => t.status === TaskStatus.Blocked).length,
    projectCount: activeProjects.length
  };

  return (
    <HashRouter>
      <Layout user={state.currentUser} notificationsCount={unreadCount} onLogout={handleLogout} isSynced={isCloudSynced} stats={layoutStats} darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)}>
        <Routes>
          <Route path="/" element={
            <Home 
              state={state} 
              onTaskClick={setActiveTaskModal} 
              onClearNotification={handleClearNotification} 
              onAddAnnouncement={handleAddAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onDeleteAnnouncement={handleDeleteAnnouncement}
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
                  taskData.contributors = (taskData.contributors || []).map(Number);
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
                for (const smId of proj.scrumMasters) {
                  const user = state.users.find(u => u.id === smId);
                  if (user && !user.roles.includes(Role.ScrumMaster)) {
                    await api.users.update(parseInt(smId), { roles: [...user.roles, Role.ScrumMaster] });
                  }
                }
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
          <Route path="/scout" element={
            <Scout currentUser={state.currentUser} />
          } />
          <Route path="/safety" element={
            <SafetyCertifications currentUser={state.currentUser} />
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
          <Route path="/calendar" element={<Calendar currentUser={state.currentUser} />} />
          <Route path="/resources" element={<Resources />} />
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
            onSaveWithoutClose={async (updated) => {
              await handleUpdateTask(updated);
            }}
            onDelete={async (id) => {
              await handleDeleteTask(id);
              setActiveTaskModal(null);
            }}
          />
        )}
        <Confetti show={showConfetti} onComplete={() => setShowConfetti(false)} />

        {annToast && (
          <div className="fixed bottom-6 right-6 z-[400] animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm w-full">
            <div className="bg-slate-950 dark:bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-red-600 rounded-xl flex items-center justify-center">
                <Bell size={14} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-0.5">
                  {annToast.scope === 'Global' ? 'Global Announcement' : `${annToast.dept} Announcement`}
                </p>
                {annToast.authorName && (
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-1">{annToast.authorName}</p>
                )}
                <p className="text-xs font-bold text-white leading-snug line-clamp-3">
                  {annToast.text.length > 100 ? `${annToast.text.slice(0, 100)}\u2026` : annToast.text}
                </p>
                <button
                  onClick={() => { window.location.hash = '#/'; setAnnToast(null); }}
                  className="mt-2 text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors"
                >
                  View &rarr;
                </button>
              </div>
              <button onClick={() => setAnnToast(null)} className="flex-shrink-0 text-slate-500 hover:text-white transition-colors mt-0.5">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {(() => {
          const now = new Date();
          const undismissed = globalAlerts.filter(a =>
            a.active &&
            !dismissedAlertIds.has(a.id) &&
            (!a.expiresAt || new Date(a.expiresAt) > now)
          );
          if (undismissed.length === 0) return null;
          const alert = undismissed[0];
          const borderColor = alert.type === 'safety' ? 'border-red-600' : alert.type === 'urgent' ? 'border-orange-500' : 'border-blue-500';
          const iconColor = alert.type === 'safety' ? 'text-red-600' : alert.type === 'urgent' ? 'text-orange-500' : 'text-blue-500';
          const bgColor = alert.type === 'safety' ? 'bg-red-50 dark:bg-red-900/20' : alert.type === 'urgent' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
          const Icon = alert.type === 'safety' ? ShieldAlert : alert.type === 'urgent' ? AlertTriangle : Bell;
          return (
            <div className="fixed inset-0 z-[500] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className={`bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl border-t-8 ${borderColor}`}>
                <div className="flex justify-end mb-2">
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className={`w-16 h-16 ${bgColor} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <Icon size={32} className={iconColor} />
                </div>
                <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${iconColor}`}>
                  {alert.type === 'safety' ? '⚠ Safety Alert' : alert.type === 'urgent' ? '! Urgent' : 'Team Notification'}
                </p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">{alert.message}</p>
                {undismissed.length > 1 && (
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-4">{undismissed.length - 1} more alert{undismissed.length > 2 ? 's' : ''} pending</p>
                )}
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className={`mt-6 px-8 py-3 font-black text-sm uppercase tracking-widest rounded-2xl text-white transition-all ${
                    alert.type === 'safety' ? 'bg-red-600 hover:bg-red-700' : alert.type === 'urgent' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          );
        })()}
      </Layout>
    </HashRouter>
  );
};

export default App;
