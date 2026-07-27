import React, { useMemo, useState, useRef, useEffect } from 'react';
import { AppState, TaskStatus, Task, Project, Department, User } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS } from '../constants';
import { Timer, Activity, CheckCircle2, MessageSquare, LifeBuoy, Megaphone, ChevronDown, ChevronUp, UserCheck, Play, Pause } from 'lucide-react';
import TaskModal from './TaskModal';
import { ProjectLinkChip } from './ProjectLinks';

interface DashboardProps {
  state: AppState;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onNotify: (taskId: string, toUserId: string, message: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, onUpdateTask, onDeleteTask, onNotify }) => {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showPulse, setShowPulse] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollDirection = useRef<'down' | 'up'>('down');

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    
    const scrollContainer = scrollRef.current;
    const scrollSpeed = 1;
    const pauseAtEnds = 2000;
    let isPaused = false;
    
    const interval = setInterval(() => {
      if (isPaused || !scrollContainer) return;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      const maxScroll = scrollHeight - clientHeight;
      
      if (scrollDirection.current === 'down') {
        if (scrollTop >= maxScroll - 2) {
          isPaused = true;
          setTimeout(() => {
            scrollDirection.current = 'up';
            isPaused = false;
          }, pauseAtEnds);
        } else {
          scrollContainer.scrollTop += scrollSpeed;
        }
      } else {
        if (scrollTop <= 2) {
          isPaused = true;
          setTimeout(() => {
            scrollDirection.current = 'down';
            isPaused = false;
          }, pauseAtEnds);
        } else {
          scrollContainer.scrollTop -= scrollSpeed;
        }
      }
    }, 30);
    
    return () => clearInterval(interval);
  }, [autoScroll]);

  const activeProjects = useMemo(() => {
    return state.projects.filter(p => !p.archived && p.showInWarRoom !== false);
  }, [state.projects]);

  const tasksByMatrix = useMemo(() => {
    const matrix: Record<string, Record<TaskStatus, Task[]>> = {};
    activeProjects.forEach(proj => {
      matrix[proj.id] = {
        [TaskStatus.Backlog]: [],
        [TaskStatus.NotStarted]: [],
        [TaskStatus.InProgress]: [],
        [TaskStatus.Blocked]: [],
        [TaskStatus.Complete]: [],
      };
    });
    state.tasks.forEach(task => {
      if (matrix[task.projectId] && !task.deptOnly) {
        matrix[task.projectId][task.status].push(task);
      }
    });
    return matrix;
  }, [state.tasks, activeProjects]);

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

  return (
    <div className="w-full h-full flex flex-col gap-3 md:gap-4 2xl:gap-6 animate-in fade-in duration-1000">
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
          <div className="flex items-center justify-end mb-2">
            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                autoScroll 
                  ? 'bg-teamColor text-white' 
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
              }`}
            >
              {autoScroll ? <Pause size={12} /> : <Play size={12} />}
              {autoScroll ? 'Auto-Scroll On' : 'Auto-Scroll'}
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-auto pr-2 kanban-scroll space-y-3 md:space-y-4 pb-4">
            {activeProjects.map(project => (
              <ProjectRow 
                key={project.id}
                project={project}
                tasks={tasksByMatrix[project.id]}
                onTaskClick={setSelectedTask}
                users={state.users}
              />
            ))}
          </div>
        </div>

        <div className="hidden lg:flex w-64 xl:w-72 flex-col bg-slate-950 rounded-2xl border border-white/5 shadow-2xl p-4 overflow-hidden flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-white tracking-tight uppercase">Live Pulse</h2>
              <p className="text-[8px] font-black text-teamColor uppercase tracking-[0.3em]">Operational Flow</p>
            </div>
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-teamColor animate-pulse" />
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
          onSaveWithoutClose={(updated) => {
            onUpdateTask(updated);
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
    accent ? 'bg-slate-950 border-white/10' : warning ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900/30' : 'bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700'
  }`}>
    <div>
      <p className={`text-[8px] md:text-[9px] 2xl:text-[10px] font-black uppercase tracking-widest mb-0.5 ${
        accent ? 'text-red-500' : warning ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
      }`}>{label}</p>
      <p className={`text-lg md:text-2xl 2xl:text-4xl font-black ${accent ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
        {value} <span className={`text-[8px] md:text-[10px] 2xl:text-sm font-bold uppercase ${accent ? 'text-slate-500' : 'text-slate-400 dark:text-slate-500'}`}>{unit}</span>
      </p>
    </div>
    <div className={`hidden sm:block ${accent ? 'text-red-600 opacity-50' : warning ? 'text-red-400' : 'text-slate-300 dark:text-slate-600'}`}>
      {icon}
    </div>
  </div>
);

const ProjectRow: React.FC<{ 
  project: Project; 
  tasks: Record<TaskStatus, Task[]>; 
  onTaskClick: (t: Task) => void;
  users: User[];
}> = ({ project, tasks, onTaskClick, users }) => {
  const [expanded, setExpanded] = useState(true);
  
  const scrumMasterDisplay = useMemo(() => {
    if (!project.scrumMasters || project.scrumMasters.length === 0) return null;
    return project.scrumMasters
      .map(id => {
        const user = users.find(u => u.id === id);
        return user ? `@${user.username}` : null;
      })
      .filter(Boolean)
      .join(', ');
  }, [project.scrumMasters, users]);
  
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl 2xl:rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <button 
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3 md:p-4 2xl:p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="text-left">
          <h3 className="text-sm md:text-base 2xl:text-lg font-black text-slate-900 dark:text-white leading-tight uppercase">{project.name}</h3>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <p className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 font-bold line-clamp-1 uppercase">{project.description}</p>
            {scrumMasterDisplay && (
              <span className="inline-flex items-center gap-1 text-[8px] md:text-[9px] font-black text-teamColor bg-teamColor/5 dark:bg-teamColor/10 px-2 py-0.5 rounded-full border border-teamColor/20">
                <UserCheck size={10} />
                SM: {scrumMasterDisplay}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 text-[9px] font-black text-teamColor">
            <Activity size={12} />
            <span>{tasks[TaskStatus.InProgress].length} ACTIVE</span>
          </div>
          {expanded ? <ChevronUp size={16} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={16} className="text-slate-400 dark:text-slate-500" />}
        </div>
      </button>
      
      {expanded && (
        <div className="p-3 md:p-4 2xl:p-6 pt-0 md:pt-0 2xl:pt-0">
          {project.links?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {project.links.map(link => <ProjectLinkChip key={link.id} link={link} compact />)}
            </div>
          )}
          <div className={`grid grid-cols-1 gap-2 md:gap-3 ${tasks[TaskStatus.Blocked].length > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <StatusColumn status={TaskStatus.Backlog} tasks={tasks[TaskStatus.Backlog]} onTaskClick={onTaskClick} label="Backlog" />
            <StatusColumn status={TaskStatus.NotStarted} tasks={tasks[TaskStatus.NotStarted]} onTaskClick={onTaskClick} label="Not Started" />
            <StatusColumn status={TaskStatus.InProgress} tasks={tasks[TaskStatus.InProgress]} onTaskClick={onTaskClick} label="In Progress" />
            {tasks[TaskStatus.Blocked].length > 0 && (
              <StatusColumn status={TaskStatus.Blocked} tasks={tasks[TaskStatus.Blocked]} onTaskClick={onTaskClick} label="Blocked" />
            )}
          </div>
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
}> = ({ status, tasks, onTaskClick, label }) => {
  const isBlocked = status === TaskStatus.Blocked;
  return (
    <div className={`rounded-lg md:rounded-xl 2xl:rounded-2xl p-2 md:p-3 min-h-[80px] md:min-h-[100px] max-h-[300px] 2xl:max-h-[400px] overflow-auto kanban-scroll ${
      isBlocked
        ? 'bg-red-50/60 dark:bg-red-950/20 border-2 border-red-500 dark:border-red-600 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
        : 'bg-slate-50 dark:bg-slate-700/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isBlocked ? 'bg-red-600 animate-pulse' :
          status === TaskStatus.Backlog ? 'bg-purple-400' :
          status === TaskStatus.NotStarted ? 'bg-slate-300 dark:bg-slate-600' :
          'bg-teamColor'
        }`} />
        <span className={`text-[8px] font-black uppercase tracking-widest ${
          isBlocked ? 'text-red-600 dark:text-red-500' : 'text-slate-500 dark:text-slate-400'
        }`}>
          {isBlocked ? `Blocked — ${tasks.length} task${tasks.length !== 1 ? 's' : ''}` : label}
        </span>
      </div>
      <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2">
        {tasks.map(task => (
          <button 
            key={task.id}
            onClick={() => onTaskClick(task)}
            className={`w-full text-left bg-white dark:bg-slate-800 px-2 py-1.5 md:px-3 md:py-2 rounded-lg shadow-sm hover:shadow-md hover:scale-[1.01] transition-all ${
              isBlocked
                ? 'border-2 border-red-300 dark:border-red-700 ring-2 ring-red-500 ring-offset-1 dark:ring-offset-red-950'
                : task.helpRequested
                  ? 'border border-red-600 dark:border-red-500'
                  : 'border border-slate-100 dark:border-slate-600 hover:border-teamColor/30'
            }`}
          >
            <div className="flex justify-between items-center mb-0.5">
              <span className={`text-[6px] md:text-[7px] font-black px-1 py-0.5 rounded uppercase ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority}
              </span>
              <span className="text-[6px] md:text-[7px] font-black text-slate-400 dark:text-slate-500">{task.effort}pt</span>
            </div>
            <h5 className={`text-[9px] md:text-[10px] font-black leading-tight uppercase break-words ${
              isBlocked ? 'text-red-700 dark:text-red-400' : 'text-slate-900 dark:text-white'
            }`}>{task.title}</h5>
            {isBlocked && task.blockedReason && (
              <p className="text-[7px] md:text-[8px] font-medium text-red-500 dark:text-red-400 italic mt-0.5">"{task.blockedReason}"</p>
            )}
          </button>
        ))}
        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-12 text-[8px] font-black text-slate-300 dark:text-slate-600 uppercase italic col-span-full">
            Empty
          </div>
        )}
      </div>
    </div>
  );
};

const PulseFeed: React.FC<{ livePulse: any[] }> = ({ livePulse }) => (
  <>
    {livePulse.map((pulse: any, idx) => {
      if (pulse.type === 'announcement') {
        return (
          <div key={`ann-${pulse.id}`} className="p-3 md:p-4 2xl:p-6 rounded-xl 2xl:rounded-2xl border-2 border-teamColor/30 bg-teamColor/10 overflow-hidden">
            <div className="flex items-center gap-2 md:gap-3 mb-2 min-w-0">
              <div className="w-8 h-8 2xl:w-10 2xl:h-10 bg-teamColor rounded-lg 2xl:rounded-xl flex items-center justify-center text-white flex-shrink-0">
                <Megaphone size={14} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] 2xl:text-[10px] font-black text-white uppercase truncate">{pulse.userName}</p>
                <p className="text-[7px] 2xl:text-[8px] font-bold text-teamColor/70 uppercase tracking-widest truncate">
                  {pulse.scope === 'Global' ? 'GLOBAL' : pulse.targetDepartment}
                </p>
              </div>
            </div>
            <p className="text-[10px] 2xl:text-sm font-black text-white leading-relaxed uppercase italic line-clamp-2 break-words">
              "{pulse.text}"
            </p>
          </div>
        );
      }

      const isSOSActive = pulse.action.toUpperCase().includes('HELP REQUESTED');
      const isComplete = pulse.action.toUpperCase().includes('COMPLETE');
      
      return (
        <div key={`act-${idx}`} className={`p-3 2xl:p-5 rounded-xl 2xl:rounded-2xl border transition-all overflow-hidden ${
          isSOSActive ? 'bg-red-600 border-red-400' : 
          isComplete ? 'bg-green-950/20 border-green-900/30' : 
          'bg-white/5 border-white/5'
        }`}>
          <div className="flex items-center gap-2 mb-2 min-w-0">
            <div className={`w-6 h-6 2xl:w-8 2xl:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              isSOSActive ? 'bg-white text-red-600' : isComplete ? 'bg-green-600 text-white' : 'bg-slate-800 text-slate-400'
            }`}>
              {isSOSActive ? <LifeBuoy size={12} /> : isComplete ? <CheckCircle2 size={12} /> : <Activity size={12} />}
            </div>
            <p className="text-[9px] 2xl:text-[10px] font-black uppercase text-white truncate min-w-0">{pulse.userName}</p>
          </div>
          <p className={`text-[9px] 2xl:text-[11px] font-black uppercase tracking-tight line-clamp-2 break-words ${isSOSActive ? 'text-white' : 'text-slate-300'}`}>
            {pulse.action}
          </p>
          <p className="text-[8px] 2xl:text-[9px] font-bold uppercase text-red-500/80 line-clamp-1 break-words">
            {pulse.taskTitle}
          </p>
        </div>
      );
    })}
  </>
);

export default Dashboard;
