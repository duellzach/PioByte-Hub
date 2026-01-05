import React, { useMemo, useState } from 'react';
import { AppState, TaskStatus, Task, Project, Department } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../constants';
import { Timer, Activity, CheckCircle2, AlertTriangle, MessageSquare, Flag, LifeBuoy, Megaphone, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import TaskModal from './TaskModal';

interface DashboardProps {
  state: AppState;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onNotify: (taskId: string, toUserId: string, message: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, onUpdateTask, onDeleteTask, onNotify }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showPulse, setShowPulse] = useState(false);

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

  const totalActive = state.tasks.filter(t => t.status === TaskStatus.InProgress).length;
  const totalBlocked = state.tasks.filter(t => t.status === TaskStatus.Blocked).length;

  return (
    <div className="w-full h-full flex flex-col gap-4 md:gap-6 2xl:gap-8 animate-in fade-in duration-1000">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 2xl:gap-6">
        <StatCard label="Weekly Effort" value={`${currentWeekEffort}`} unit="PTS" icon={<TrendingUp size={20} />} accent />
        <StatCard label="Active Tasks" value={`${totalActive}`} unit="LIVE" icon={<Activity size={20} />} />
        <StatCard label="Blocked" value={`${totalBlocked}`} unit="HELD" icon={<AlertTriangle size={20} />} warning={totalBlocked > 0} />
        <StatCard label="Projects" value={`${activeProjects.length}`} unit="OPS" icon={<Flag size={20} />} />
      </div>

      <div className="lg:hidden">
        <button 
          onClick={() => setShowPulse(!showPulse)}
          className="w-full flex items-center justify-between p-4 bg-slate-950 text-white rounded-2xl"
        >
          <span className="text-xs font-black uppercase tracking-widest">Live Pulse Feed</span>
          {showPulse ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        {showPulse && (
          <div className="mt-2 bg-slate-950 rounded-2xl p-4 max-h-64 overflow-auto">
            <PulseFeed livePulse={livePulse.slice(0, 10)} />
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 md:gap-6 overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-slate-950 tracking-tighter uppercase leading-none">WAR ROOM</h1>
              <p className="text-[9px] md:text-[10px] font-black text-red-600 uppercase tracking-widest mt-1">Multi-Board Operations</p>
            </div>
            <div className="hidden sm:flex gap-2">
              <StatusBadge label="Not Started" color="bg-slate-300" />
              <StatusBadge label="In Progress" color="bg-red-600" />
              <StatusBadge label="Blocked" color="bg-black" />
            </div>
          </div>

          <div className="flex-1 overflow-auto pr-2 kanban-scroll space-y-4 md:space-y-6 pb-4">
            {activeProjects.map(project => (
              <ProjectRow 
                key={project.id}
                project={project}
                tasks={tasksByMatrix[project.id]}
                onTaskClick={setSelectedTask}
              />
            ))}
          </div>
        </div>

        <div className="hidden lg:flex w-64 xl:w-72 flex-col bg-slate-950 rounded-2xl border border-white/5 shadow-2xl p-4 overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-white tracking-tight uppercase">Live Pulse</h2>
              <p className="text-[8px] font-black text-red-500 uppercase tracking-[0.3em]">Operational Flow</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse shadow-[0_0_10px_rgba(225,29,72,0.8)]" />
            </div>
          </div>

          <div className="flex-1 overflow-auto space-y-3 pr-2 kanban-scroll">
            <PulseFeed livePulse={livePulse} />
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

const StatCard: React.FC<{ label: string; value: string; unit: string; icon: React.ReactNode; accent?: boolean; warning?: boolean }> = 
  ({ label, value, unit, icon, accent, warning }) => (
  <div className={`p-3 md:p-4 2xl:p-6 rounded-xl md:rounded-2xl 2xl:rounded-[32px] border shadow-sm flex items-center justify-between ${
    accent ? 'bg-slate-950 border-white/10' : warning ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'
  }`}>
    <div>
      <p className={`text-[8px] md:text-[9px] 2xl:text-[10px] font-black uppercase tracking-widest mb-0.5 ${
        accent ? 'text-red-500' : warning ? 'text-red-600' : 'text-slate-400'
      }`}>{label}</p>
      <p className={`text-lg md:text-2xl 2xl:text-4xl font-black ${accent ? 'text-white' : 'text-slate-900'}`}>
        {value} <span className={`text-[8px] md:text-[10px] 2xl:text-sm font-bold uppercase ${accent ? 'text-slate-500' : 'text-slate-400'}`}>{unit}</span>
      </p>
    </div>
    <div className={`hidden sm:block ${accent ? 'text-red-600 opacity-50' : warning ? 'text-red-400' : 'text-slate-300'}`}>
      {icon}
    </div>
  </div>
);

const StatusBadge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
    <div className={`w-2 h-2 rounded-full ${color}`} />
    <span className="text-[8px] 2xl:text-[10px] font-black text-slate-600 uppercase tracking-tight">{label}</span>
  </div>
);

const ProjectRow: React.FC<{ 
  project: Project; 
  tasks: Record<TaskStatus, Task[]>; 
  onTaskClick: (t: Task) => void 
}> = ({ project, tasks, onTaskClick }) => {
  const [expanded, setExpanded] = useState(true);
  
  return (
    <div className="bg-white rounded-xl md:rounded-2xl 2xl:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 md:p-4 2xl:p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="text-left">
          <h3 className="text-sm md:text-base 2xl:text-lg font-black text-slate-900 leading-tight uppercase">{project.name}</h3>
          <p className="text-[9px] md:text-[10px] text-slate-400 font-bold line-clamp-1 uppercase">{project.description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-[9px] font-black text-red-600">
            <Activity size={12} />
            <span>{tasks[TaskStatus.InProgress].length} ACTIVE</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>
      
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:gap-3 p-3 md:p-4 2xl:p-6 pt-0 md:pt-0 2xl:pt-0">
          <StatusColumn status={TaskStatus.NotStarted} tasks={tasks[TaskStatus.NotStarted]} onTaskClick={onTaskClick} label="Not Started" />
          <StatusColumn status={TaskStatus.InProgress} tasks={tasks[TaskStatus.InProgress]} onTaskClick={onTaskClick} label="In Progress" />
          <StatusColumn status={TaskStatus.Blocked} tasks={tasks[TaskStatus.Blocked]} onTaskClick={onTaskClick} label="Blocked" />
        </div>
      )}
    </div>
  );
};

const StatusColumn: React.FC<{ 
  status: TaskStatus;
  tasks: Task[]; 
  onTaskClick: (t: Task) => void;
  label: string;
}> = ({ status, tasks, onTaskClick, label }) => (
  <div className="bg-slate-50 rounded-lg md:rounded-xl 2xl:rounded-2xl p-2 md:p-3 min-h-[80px] md:min-h-[100px]">
    <div className="flex items-center gap-2 mb-2 sm:hidden">
      <div className={`w-2 h-2 rounded-full ${
        status === TaskStatus.NotStarted ? 'bg-slate-300' : 
        status === TaskStatus.InProgress ? 'bg-red-600' : 'bg-black'
      }`} />
      <span className="text-[8px] font-black text-slate-500 uppercase">{label}</span>
    </div>
    <div className="space-y-2">
      {tasks.map(task => (
        <button 
          key={task.id}
          onClick={() => onTaskClick(task)}
          className={`w-full text-left bg-white px-3 py-2 md:px-4 md:py-3 rounded-lg md:rounded-xl border-2 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all ${
            task.helpRequested ? 'border-red-600' : 'border-slate-100 hover:border-red-600/30'
          }`}
        >
          <div className="flex justify-between items-center mb-1">
            <span className={`text-[7px] md:text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </span>
            <span className="text-[7px] md:text-[8px] font-black text-slate-400">{task.effort} PTS</span>
          </div>
          <h5 className="text-[10px] md:text-[11px] font-black text-slate-900 leading-tight truncate uppercase">{task.title}</h5>
        </button>
      ))}
      {tasks.length === 0 && (
        <div className="flex items-center justify-center h-12 text-[8px] font-black text-slate-300 uppercase italic">
          Empty
        </div>
      )}
    </div>
  </div>
);

const PulseFeed: React.FC<{ livePulse: any[] }> = ({ livePulse }) => (
  <>
    {livePulse.map((pulse: any, idx) => {
      if (pulse.type === 'announcement') {
        return (
          <div key={`ann-${pulse.id}`} className="p-3 md:p-4 2xl:p-6 rounded-xl 2xl:rounded-2xl border-2 border-red-600/30 bg-red-600/10">
            <div className="flex items-center gap-2 md:gap-3 mb-2">
              <div className="w-8 h-8 2xl:w-10 2xl:h-10 bg-red-600 rounded-lg 2xl:rounded-xl flex items-center justify-center text-white">
                <Megaphone size={14} />
              </div>
              <div>
                <p className="text-[9px] 2xl:text-[10px] font-black text-white uppercase">{pulse.userName}</p>
                <p className="text-[7px] 2xl:text-[8px] font-bold text-red-500 uppercase tracking-widest">
                  {pulse.scope === 'Global' ? 'GLOBAL' : pulse.targetDepartment}
                </p>
              </div>
            </div>
            <p className="text-[10px] 2xl:text-sm font-black text-white leading-relaxed uppercase italic line-clamp-2">
              "{pulse.text}"
            </p>
          </div>
        );
      }

      const isSOSActive = pulse.action.toUpperCase().includes('HELP REQUESTED');
      const isComplete = pulse.action.toUpperCase().includes('COMPLETE');
      
      return (
        <div key={`act-${idx}`} className={`p-3 2xl:p-5 rounded-xl 2xl:rounded-2xl border transition-all ${
          isSOSActive ? 'bg-red-600 border-red-400' : 
          isComplete ? 'bg-green-950/20 border-green-900/30' : 
          'bg-white/5 border-white/5'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-6 h-6 2xl:w-8 2xl:h-8 rounded-lg flex items-center justify-center ${
              isSOSActive ? 'bg-white text-red-600' : isComplete ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {isSOSActive ? <LifeBuoy size={12} /> : isComplete ? <CheckCircle2 size={12} /> : <Activity size={12} />}
            </div>
            <p className="text-[9px] 2xl:text-[10px] font-black uppercase text-white">{pulse.userName}</p>
          </div>
          <p className={`text-[9px] 2xl:text-[11px] font-black uppercase tracking-tight line-clamp-1 ${isSOSActive ? 'text-white' : 'text-slate-300'}`}>
            {pulse.action}
          </p>
          <p className="text-[8px] 2xl:text-[9px] font-bold uppercase text-red-500/80 line-clamp-1">
            {pulse.taskTitle}
          </p>
        </div>
      );
    })}
  </>
);

export default Dashboard;
