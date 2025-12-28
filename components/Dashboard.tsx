
import React, { useMemo, useState } from 'react';
import { AppState, TaskStatus, Task, Project, Department, Role, Announcement } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS, DEPARTMENT_COLORS } from '../constants';
import { ListTodo, Timer, Ban, ExternalLink, ChevronRight, Zap, Users, Activity, CheckCircle2, AlertTriangle, MessageSquare, Flag, LifeBuoy, Megaphone, TrendingUp } from 'lucide-react';
import TaskModal from './TaskModal';

interface DashboardProps {
  state: AppState;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onNotify: (taskId: string, toUserId: string, message: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, onUpdateTask, onDeleteTask, onNotify }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const activeProjects = useMemo(() => {
    return state.projects.filter(p => !p.archived);
  }, [state.projects]);

  const tasksByMatrix = useMemo(() => {
    const matrix: Record<string, Record<TaskStatus, Task[]>> = {};
    activeProjects.forEach(proj => {
      matrix[proj.id] = {
        [TaskStatus.NotStarted]: [],
        [TaskStatus.InProgress]: [],
        [TaskStatus.Blocked]: [],
        [TaskStatus.Complete]: [],
      };
    });
    state.tasks.forEach(task => {
      if (matrix[task.projectId]) {
        matrix[task.projectId][task.status].push(task);
      }
    });
    return matrix;
  }, [state.tasks, activeProjects]);

  const currentWeekEffort = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return state.tasks.reduce((acc, t) => {
        if (t.status === TaskStatus.Complete && t.completedAt && t.completedAt >= startOfWeek.getTime()) {
            return acc + (t.effort || 0);
        }
        return acc;
    }, 0);
  }, [state.tasks]);

  const livePulse = useMemo(() => {
    const activities = state.tasks.flatMap(t => t.history.map(h => {
      const user = state.users.find(u => u.id === h.userId);
      const project = state.projects.find(p => p.id === t.projectId);
      return { 
        type: 'activity',
        ...h, 
        taskTitle: t.title, 
        taskId: t.id, 
        taskObj: t,
        userName: user?.name || 'System',
        userRole: user?.roles[0] || 'Member',
        projectName: project?.name || 'Unknown Project',
        dept: t.departments[0] || 'General'
      };
    }));

    const anns = state.announcements
      .filter(ann => {
        if (ann.scope === 'Global') return true;
        return state.currentUser?.departments.includes(ann.targetDepartment!);
      })
      .map(ann => {
        const user = state.users.find(u => u.id === ann.authorId);
        return {
          type: 'announcement',
          id: ann.id,
          timestamp: ann.timestamp,
          text: ann.text,
          userName: user?.name || 'System',
          userRole: user?.roles[0] || 'Member',
          scope: ann.scope,
          targetDepartment: ann.targetDepartment,
          commentCount: ann.comments?.length || 0
        };
      });

    return [...activities, ...anns]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 30);
  }, [state.tasks, state.users, state.projects, state.announcements, state.currentUser]);

  const deptStats = useMemo(() => {
    const stats: Record<Department, number> = {} as any;
    Object.values(Department).forEach(d => stats[d] = 0);
    state.tasks.forEach(t => {
      if (t.status !== TaskStatus.Complete) {
        t.departments.forEach(d => stats[d]++);
      }
    });
    return stats;
  }, [state.tasks]);

  return (
    <div className="w-full h-full flex flex-col gap-8 animate-in fade-in duration-1000">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="bg-slate-950 p-6 rounded-[32px] border border-white/10 shadow-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.3em] mb-1">Weekly Effort</p>
            <p className="text-4xl font-black text-white">{currentWeekEffort} <span className="text-sm font-bold text-slate-500 uppercase">PTS</span></p>
          </div>
          <TrendingUp size={40} className="text-red-600 opacity-50" />
        </div>

        <div className="xl:col-span-3 bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-8 overflow-x-auto kanban-scroll">
          <div className="flex-shrink-0 border-r border-slate-100 pr-8">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dept Load</p>
            <div className="flex items-center gap-2">
              <Users size={20} className="text-red-600" />
              <span className="font-black text-slate-900 uppercase">Active Units</span>
            </div>
          </div>
          <div className="flex gap-6">
            {Object.entries(deptStats).map(([dept, count]) => (
              <div key={dept} className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-400 uppercase">{dept}</span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-red-600" style={{ width: `${Math.min(100, ((count as number) / 10) * 100)}%` }} />
                  </div>
                  <span className="text-xs font-black text-slate-900">{count as number}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_450px] gap-8 overflow-hidden">
        <div className="flex flex-col gap-6 overflow-auto pr-4 kanban-scroll">
          <div className="grid grid-cols-[300px_1fr_1fr_1fr] gap-4 sticky top-0 z-20 bg-slate-50/90 backdrop-blur-md pb-4">
            <div className="flex flex-col justify-end">
              <h1 className="text-3xl font-black text-slate-950 tracking-tighter uppercase leading-none">WAR ROOM</h1>
              <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mt-1">Multi-Board Operations</p>
            </div>
            <StatusHeader label="NOT STARTED" colorClass="bg-slate-300" />
            <StatusHeader label="IN PROGRESS" colorClass="bg-red-600" />
            <StatusHeader label="BLOCKED" colorClass="bg-black" />
          </div>

          <div className="space-y-6 pb-20">
            {activeProjects.map(project => (
              <div key={project.id} className="grid grid-cols-[300px_1fr_1fr_1fr] gap-4 min-h-[200px] group">
                <div className="bg-white p-6 rounded-3xl border-2 border-slate-100 shadow-sm flex flex-col justify-center transition-all group-hover:border-red-600/30">
                  <h3 className="text-lg font-black text-slate-900 leading-tight mb-2 uppercase break-words">{project.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold line-clamp-2 uppercase leading-relaxed mb-4">{project.description}</p>
                  <div className="flex items-center gap-2 text-[9px] font-black text-red-600">
                    <Activity size={12} />
                    <span>{tasksByMatrix[project.id][TaskStatus.InProgress].length} ACTIVE</span>
                  </div>
                </div>
                <MatrixCell tasks={tasksByMatrix[project.id][TaskStatus.NotStarted]} onTaskClick={setSelectedTask} />
                <MatrixCell tasks={tasksByMatrix[project.id][TaskStatus.InProgress]} onTaskClick={setSelectedTask} />
                <MatrixCell tasks={tasksByMatrix[project.id][TaskStatus.Blocked]} onTaskClick={setSelectedTask} />
              </div>
            ))}
          </div>
        </div>

        <div className="hidden lg:flex flex-col bg-slate-950 rounded-[40px] border border-white/5 shadow-2xl p-8 overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-black text-white tracking-tight uppercase">Live Pulse</h2>
              <p className="text-[9px] font-black text-red-500 uppercase tracking-[0.3em]">Operational Flow</p>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Active Stream</span>
               <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
            </div>
          </div>

          <div className="flex-1 overflow-auto space-y-4 pr-2 kanban-scroll">
            {livePulse.map((pulse: any, idx) => {
              if (pulse.type === 'announcement') {
                return (
                  <div key={`ann-${pulse.id}`} className={`p-6 rounded-2xl border-2 border-red-600/30 bg-red-600/10 shadow-lg shadow-red-900/10 animate-pulse-slow`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <Megaphone size={18} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">{pulse.userName}</p>
                        <p className="text-[8px] font-bold text-red-500 uppercase tracking-[0.2em]">{pulse.scope === 'Global' ? 'GLOBAL BROADCAST' : `DEPT UPDATE: ${pulse.targetDepartment}`}</p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-white leading-relaxed uppercase italic">
                      "{pulse.text}"
                    </p>
                    <div className="mt-4 pt-3 border-t border-red-600/20 flex justify-between items-center text-[8px] font-black text-red-400 uppercase tracking-widest">
                       <span className="flex items-center gap-1"><MessageSquare size={10} /> {pulse.commentCount} THREADS</span>
                       <span>{new Date(pulse.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                );
              }

              const isSOSActive = pulse.action.toUpperCase().includes('HELP REQUESTED');
              const isSOSResolved = pulse.action.toUpperCase().includes('RESOLVED');
              const isBlocking = pulse.action.toUpperCase().includes('BLOCKED');
              const isComplete = pulse.action.toUpperCase().includes('COMPLETE');
              
              const pulseClass = isSOSActive ? 'bg-red-600 border-red-400' :
                                isSOSResolved ? 'bg-slate-900/50 border-green-900/30' :
                                isBlocking ? 'bg-black border-slate-700' : 
                                isComplete ? 'bg-green-950/20 border-green-900/30' : 
                                'bg-white/5 border-white/5';

              return (
                <div key={`act-${idx}`} className={`p-5 rounded-2xl border transition-all hover:bg-white/5 group/pulse ${pulseClass}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] ${
                        isSOSActive ? 'bg-white text-red-600' : isSOSResolved ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {isSOSActive ? <LifeBuoy size={14} /> : isComplete ? <CheckCircle2 size={14} /> : <Activity size={14} />}
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase text-white leading-none">{pulse.userName}</p>
                        <p className={`text-[8px] font-bold uppercase tracking-widest ${isSOSActive ? 'text-white/60' : 'text-slate-500'}`}>{pulse.userRole}</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className={`text-[11px] font-black uppercase tracking-tight ${isSOSActive ? 'text-white' : 'text-slate-300'}`}>
                      {pulse.action}
                    </p>
                    <p className={`text-[9px] font-bold uppercase tracking-widest ${isSOSActive ? 'text-white/50' : 'text-red-500/80'}`}>
                      Target: {pulse.taskTitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div className="mt-8 pt-6 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <div className="flex items-center gap-2">
                <Flag size={12} />
                <span>Season 2025</span>
              </div>
              <span className="text-green-500">Secure Node</span>
            </div>
          </div>
        </div>
      </div>

      {selectedTask && (
        <TaskModal 
          task={selectedTask}
          users={state.users}
          allTasks={state.tasks}
          currentUser={state.currentUser}
          onClose={() => setSelectedTask(null)}
          onNotify={(to, msg) => onNotify(selectedTask.id, to, msg)}
          onSave={(updated) => {
            onUpdateTask(updated);
            setSelectedTask(null);
          }}
          onDelete={(id) => {
            onDeleteTask(id);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
};

const StatusHeader: React.FC<{ label: string; colorClass: string }> = ({ label, colorClass }) => (
  <div className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
    <div className={`w-3 h-3 rounded-full ${colorClass}`} />
    <h4 className="text-[10px] font-black text-slate-900 tracking-widest uppercase">{label}</h4>
  </div>
);

const MatrixCell: React.FC<{ tasks: Task[]; onTaskClick: (t: Task) => void }> = ({ tasks, onTaskClick }) => (
  <div className="flex flex-col gap-2 p-3 bg-slate-100/50 rounded-3xl border-2 border-slate-50 min-h-[150px]">
    {tasks.length > 0 ? tasks.map(task => (
      <button 
        key={task.id}
        onClick={() => onTaskClick(task)}
        className={`w-full text-left bg-white px-4 py-3 rounded-xl border-2 shadow-sm hover:shadow-lg hover:scale-[1.02] transition-all flex flex-col group/card ${
            task.helpRequested ? 'border-red-600 animate-pulse' : 'border-slate-200 hover:border-red-600/30'
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className={`text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-tighter ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
          <span className="text-[8px] font-black text-slate-400 uppercase">
            {task.effort} PTS
          </span>
        </div>
        <h5 className="text-[11px] font-black text-slate-900 leading-none truncate group-hover/card:text-red-600 transition-colors uppercase tracking-tight">
          {task.title}
        </h5>
      </button>
    )) : (
      <div className="flex-1 flex items-center justify-center text-[8px] font-black text-slate-300 uppercase tracking-widest italic">
        Standing By
      </div>
    )}
  </div>
);

export default Dashboard;
