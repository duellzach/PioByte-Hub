import React, { useState, useMemo } from 'react';
import { AppState, Task, TaskStatus, Department, Project, Priority } from '../types';
import { STATUSES, DEPARTMENTS, STATUS_COLORS, PRIORITY_COLORS } from '../constants';
import { Plus, GripVertical, FolderPlus, LifeBuoy, AlertTriangle, X, CheckCircle, Folder, Clock, ChevronDown } from 'lucide-react';
import TaskModal from './TaskModal';

interface KanbanBoardProps {
  state: AppState;
  onUpdateTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
  onAddTask: (task: Task) => void;
  onAddProject: (p: Project) => void;
  onArchiveProject: (id: string) => void;
  onNotify: (taskId: string, toUserId: string, message: string) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ state, onUpdateTask, onDeleteTask, onAddTask, onAddProject, onArchiveProject, onNotify }) => {
  const [activeProjectId, setActiveProjectId] = useState<string>(state.projects.find(p => !p.archived)?.id || '');
  const [deptFilter, setDeptFilter] = useState<Department | 'All'>('All');
  const [view, setView] = useState<'board' | 'help'>('board');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  
  const [blockingTask, setBlockingTask] = useState<{id: string, newStatus: TaskStatus} | null>(null);
  const [blockReasonInput, setBlockReasonInput] = useState('');

  const [mobileStatus, setMobileStatus] = useState<TaskStatus>(TaskStatus.NotStarted);

  const activeProject = useMemo(() => state.projects.find(p => p.id === activeProjectId), [state.projects, activeProjectId]);

  const projectTasks = useMemo(() => {
    let tasks = state.tasks.filter(t => t.projectId === activeProjectId);
    if (deptFilter !== 'All') {
      tasks = tasks.filter(t => t.departments.includes(deptFilter));
    }
    return tasks;
  }, [state.tasks, activeProjectId, deptFilter]);

  const helpWantedTasks = useMemo(() => {
    return state.tasks.filter(t => t.helpRequested && !state.projects.find(p => p.id === t.projectId)?.archived);
  }, [state.tasks, state.projects]);

  const tasksByStatus = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      [TaskStatus.NotStarted]: [],
      [TaskStatus.InProgress]: [],
      [TaskStatus.Blocked]: [],
      [TaskStatus.Complete]: [],
    };
    projectTasks.forEach(t => map[t.status].push(t));
    return map;
  }, [projectTasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: TaskStatus) => {
    const taskId = e.dataTransfer.getData('taskId');
    const task = state.tasks.find(t => t.id === taskId);
    if (task && task.status !== newStatus) {
      if (newStatus === TaskStatus.Blocked) {
        setBlockingTask({ id: taskId, newStatus });
      } else {
        onUpdateTask({ ...task, status: newStatus, blockedReason: '' });
      }
    }
  };

  const submitBlockReason = () => {
    if (!blockingTask || !blockReasonInput.trim()) return;
    const task = state.tasks.find(t => t.id === blockingTask.id);
    if (task) {
      const history = [{
        id: Date.now().toString(),
        userId: state.currentUser?.id || 'system',
        action: `BLOCKED: ${blockReasonInput}`,
        timestamp: Date.now()
      }, ...task.history];
      onUpdateTask({ ...task, status: blockingTask.newStatus, blockedReason: blockReasonInput, history });
    }
    setBlockingTask(null);
    setBlockReasonInput('');
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim()) return;
    const newId = `proj-${Date.now()}`;
    const newProject: Project = {
      id: newId,
      name: newProjectName,
      description: newProjectDesc,
      createdAt: Date.now(),
      archived: false
    };
    onAddProject(newProject);
    setActiveProjectId(newId);
    setNewProjectName('');
    setNewProjectDesc('');
    setShowNewProjectModal(false);
  };

  const toggleHelp = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const newState = !task.helpRequested;
    const history = [{
      id: Date.now().toString(),
      userId: state.currentUser?.id || 'system',
      action: newState ? 'SOS: HELP REQUESTED' : 'SOS: HELP RESOLVED',
      timestamp: Date.now()
    }, ...task.history];
    onUpdateTask({ ...task, helpRequested: newState, history });
  };

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
            <button 
                onClick={() => setView('board')} 
                className={`px-3 md:px-6 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${view === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Board
            </button>
            <button 
                onClick={() => setView('help')} 
                className={`px-3 md:px-6 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 md:gap-2 ${view === 'help' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500'}`}
            >
                <span className="hidden sm:inline">Help</span> SOS
                {helpWantedTasks.length > 0 && <span className="bg-white text-red-600 px-1.5 rounded-full text-[8px]">{helpWantedTasks.length}</span>}
            </button>
          </div>

          {view === 'board' && (
            <>
              <select 
                value={activeProjectId} 
                onChange={(e) => setActiveProjectId(e.target.value)}
                className="flex-1 min-w-0 sm:flex-none sm:min-w-[160px] md:min-w-[200px] px-3 md:px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold text-sm text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-red-600/20"
              >
                {state.projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                <optgroup label="Archived">
                    {state.projects.filter(p => p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </optgroup>
              </select>
              <button 
                  onClick={() => setShowNewProjectModal(true)}
                  className="p-2 md:p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                  title="Create New Project"
              >
                  <FolderPlus size={16} />
              </button>
              <select 
                value={deptFilter} 
                onChange={(e) => setDeptFilter(e.target.value as Department | 'All')}
                className="hidden sm:block px-3 md:px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm outline-none focus:ring-2 focus:ring-red-600/20"
              >
                <option value="All">All Depts</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </>
          )}

          <button 
            onClick={() => setShowAddModal(true)}
            className="ml-auto flex items-center justify-center gap-1 md:gap-2 px-4 md:px-6 py-2 md:py-3 bg-red-600 text-white font-black rounded-xl md:rounded-2xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] md:text-xs tracking-wider"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New</span> Task
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <>
          <div className="md:hidden flex gap-1 overflow-x-auto pb-2">
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => setMobileStatus(status)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-[9px] font-black uppercase tracking-tight transition-all ${
                  mobileStatus === status 
                    ? 'bg-slate-900 text-white' 
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {status} ({tasksByStatus[status].length})
              </button>
            ))}
          </div>

          <div className="md:hidden flex-1 overflow-auto">
            <div className="space-y-3 pb-4">
              {tasksByStatus[mobileStatus].map(task => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  onClick={() => setSelectedTask(task)}
                  onToggleHelp={(e) => toggleHelp(task, e)}
                  onDragStart={(e) => handleDragStart(e, task.id)}
                />
              ))}
              {tasksByStatus[mobileStatus].length === 0 && (
                <div className="py-12 text-center text-slate-400 text-sm font-bold uppercase">
                  No tasks in this column
                </div>
              )}
            </div>
          </div>

          <div className="hidden md:grid flex-1 grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 2xl:gap-6 overflow-hidden">
            {STATUSES.map(status => (
              <div 
                key={status} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
                className="flex flex-col h-full bg-slate-100/40 rounded-xl md:rounded-2xl 2xl:rounded-[32px] border border-slate-200"
              >
                <div className="p-3 md:p-4 2xl:p-6 flex items-center justify-between bg-white/50 rounded-t-xl md:rounded-t-2xl 2xl:rounded-t-[32px] border-b border-slate-100">
                  <div className="flex items-center gap-2 md:gap-3">
                    <span className={`w-2 md:w-3 h-2 md:h-3 rounded-full ${STATUS_COLORS[status].split(' ')[0]}`} />
                    <h3 className="font-black text-slate-800 text-[9px] md:text-[10px] uppercase tracking-wider">{status}</h3>
                  </div>
                  <span className="bg-white text-slate-500 text-[9px] md:text-[10px] font-black px-2 py-0.5 md:py-1 rounded-lg border border-slate-200">
                    {tasksByStatus[status].length}
                  </span>
                </div>
                <div className="flex-1 overflow-auto p-3 md:p-4 2xl:p-6 space-y-3 md:space-y-4 kanban-scroll">
                  {tasksByStatus[status].map(task => (
                    <TaskCard 
                      key={task.id} 
                      task={task} 
                      onClick={() => setSelectedTask(task)}
                      onToggleHelp={(e) => toggleHelp(task, e)}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="flex-1 bg-white rounded-2xl md:rounded-[40px] border-2 border-slate-100 shadow-sm p-6 md:p-12 overflow-auto kanban-scroll">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-12">
            <div className="flex items-center gap-4 md:gap-6">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-red-100 text-red-600 rounded-2xl md:rounded-[24px] flex items-center justify-center">
                <LifeBuoy size={24} />
              </div>
              <div>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">Help Wanted</h2>
                <p className="text-slate-400 font-bold text-xs md:text-sm uppercase tracking-widest">Active SOS signals</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 md:gap-4">
              {helpWantedTasks.map(task => (
                <div 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className="bg-slate-50 border-2 border-slate-100 rounded-2xl md:rounded-[32px] p-4 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 md:gap-6 hover:border-red-600/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-4 md:gap-6">
                    <div className="w-10 h-10 md:w-12 md:h-12 bg-red-600 text-white rounded-xl md:rounded-2xl flex items-center justify-center animate-pulse shadow-lg shadow-red-600/40">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-sm md:text-lg font-black text-slate-900 uppercase tracking-tight truncate">{task.title}</h3>
                        <span className={`text-[7px] md:text-[8px] font-black px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-xs text-slate-500 font-medium truncate uppercase tracking-widest">
                        {state.projects.find(p => p.id === task.projectId)?.name} • {task.departments.join(' & ')}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => toggleHelp(task, e)}
                    className="w-full sm:w-auto px-4 md:px-6 py-2 md:py-3 bg-white border border-slate-200 text-red-600 font-black text-[9px] md:text-[10px] rounded-xl md:rounded-2xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest shadow-sm"
                  >
                    Resolve SOS
                  </button>
                </div>
              ))}
              {helpWantedTasks.length === 0 && (
                <div className="py-16 md:py-24 text-center">
                  <CheckCircle size={48} className="text-slate-100 mx-auto mb-4 md:mb-6" />
                  <p className="text-xl md:text-2xl font-black text-slate-300 uppercase tracking-tighter">No Active SOS</p>
                  <p className="text-slate-400 text-sm mt-2">All departments nominal.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-12 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-6 md:mb-10">
              <div>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">New Project</h2>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Create a new Kanban board</p>
              </div>
              <button onClick={() => setShowNewProjectModal(false)} className="p-2 md:p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 md:space-y-8">
              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Project Name</label>
                <input 
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. Robot Build 2025"
                  className="w-full p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-black text-base md:text-lg uppercase tracking-tight"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
                <textarea 
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="What's this project about?"
                  className="w-full h-24 md:h-32 p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-slate-700 resize-none"
                />
              </div>

              <button 
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="w-full py-4 md:py-6 bg-red-600 text-white font-black rounded-xl md:rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50"
              >
                <Folder size={16} />
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}

      {blockingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 md:p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-12 shadow-2xl border-t-8 border-black">
            <div className="flex flex-col items-center text-center mb-6 md:mb-10">
              <div className="w-14 h-14 md:w-20 md:h-20 bg-slate-100 text-slate-900 rounded-2xl md:rounded-[28px] flex items-center justify-center mb-4 md:mb-6">
                <AlertTriangle size={28} />
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Block Report</h2>
              <p className="text-slate-400 text-xs md:text-sm font-bold uppercase tracking-widest">What's blocking this task?</p>
            </div>
            <div className="space-y-4 md:space-y-6">
              <textarea 
                autoFocus
                value={blockReasonInput}
                onChange={(e) => setBlockReasonInput(e.target.value)}
                placeholder="e.g. Waiting on parts shipment..."
                className="w-full h-24 md:h-32 p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[32px] outline-none focus:border-black transition-all font-medium text-slate-700 resize-none"
              />
              <div className="flex gap-3 md:gap-4">
                <button onClick={() => setBlockingTask(null)} className="flex-1 py-3 md:py-5 text-slate-400 font-black hover:bg-slate-100 rounded-xl md:rounded-[24px] uppercase tracking-widest text-[9px] md:text-[10px]">Cancel</button>
                <button 
                  disabled={!blockReasonInput.trim()}
                  onClick={submitBlockReason} 
                  className="flex-1 py-3 md:py-5 bg-black text-white font-black rounded-xl md:rounded-[24px] hover:bg-slate-900 shadow-xl disabled:opacity-30 uppercase tracking-widest text-[9px] md:text-[10px] transition-all"
                >
                  Confirm Block
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(selectedTask || showAddModal) && (
        <TaskModal 
          task={selectedTask || {
            id: Math.random().toString(36).substr(2, 9),
            projectId: activeProjectId,
            title: '',
            description: '',
            status: TaskStatus.NotStarted,
            priority: Priority.Medium,
            effort: 1,
            departments: [],
            assignees: [],
            successCriteria: [],
            attachments: [],
            comments: [],
            history: [{ id: Date.now().toString(), userId: 'system', action: 'Task Created', timestamp: Date.now() }],
            startDate: new Date().toISOString().split('T')[0],
            dueDate: new Date().toISOString().split('T')[0],
            dependencies: [],
            createdAt: Date.now()
          }}
          users={state.users}
          allTasks={state.tasks}
          currentUser={state.currentUser}
          onClose={() => {
              setSelectedTask(null);
              setShowAddModal(false);
          }}
          onNotify={(to, msg) => onNotify(selectedTask?.id || 'new', to, msg)}
          onSave={(task) => {
              if (selectedTask) onUpdateTask(task);
              else onAddTask(task);
              setSelectedTask(null);
              setShowAddModal(false);
          }}
          onDelete={onDeleteTask}
        />
      )}
    </div>
  );
};

const TaskCard: React.FC<{ 
    task: Task; 
    onClick: () => void; 
    onToggleHelp: (e: React.MouseEvent) => void;
    onDragStart: (e: React.DragEvent) => void 
}> = ({ task, onClick, onToggleHelp, onDragStart }) => {
    return (
        <div 
            onClick={onClick}
            draggable
            onDragStart={onDragStart}
            className={`group bg-white p-4 md:p-5 2xl:p-6 rounded-xl md:rounded-2xl 2xl:rounded-[28px] border-2 shadow-sm hover:shadow-lg hover:scale-[1.01] transition-all cursor-grab active:cursor-grabbing relative overflow-hidden ${
                task.helpRequested ? 'border-red-600 shadow-red-600/5' : 'border-slate-100 hover:border-red-600/30'
            }`}
        >
            {task.helpRequested && (
                <div className="absolute top-0 right-0 px-2 py-0.5 bg-red-600 text-white text-[6px] md:text-[7px] font-black uppercase tracking-widest">
                    SOS
                </div>
            )}
            <div className="flex justify-between items-start mb-2 md:mb-4">
                <div className="flex gap-1.5 md:gap-2">
                    <span className={`text-[7px] md:text-[8px] font-black px-1.5 md:px-2 py-0.5 rounded-md md:rounded-lg uppercase ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                    </span>
                    <span className="text-[7px] md:text-[8px] font-black px-1.5 md:px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md md:rounded-lg border border-slate-200">
                        {task.effort}pt
                    </span>
                </div>
                <GripVertical size={12} className="text-slate-200 group-hover:text-slate-400 hidden md:block" />
            </div>
            <h4 className="text-xs md:text-sm font-black text-slate-900 leading-tight mb-2 md:mb-4 uppercase tracking-tight group-hover:text-red-600 transition-colors line-clamp-2">
                {task.title}
            </h4>
            <div className="space-y-2 md:space-y-4">
                <div className="flex flex-wrap gap-1 items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                        {task.departments.slice(0, 2).map(d => (
                            <span key={d} className="text-[6px] md:text-[7px] font-black text-slate-400 uppercase">
                                {d}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 text-[7px] md:text-[8px] font-black text-slate-400 uppercase">
                        <Clock size={10} className="text-red-600/50" />
                        {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                </div>
                <div className="flex items-center justify-between pt-2 md:pt-4 border-t border-slate-50">
                    <div className="flex -space-x-1.5 md:-space-x-2">
                        {task.assignees.slice(0, 3).map((id, i) => (
                            <div key={id} className="w-5 h-5 md:w-6 md:h-6 rounded-md md:rounded-lg bg-slate-950 text-white border-2 border-white flex items-center justify-center text-[7px] md:text-[8px] font-black shadow-sm">
                                {id[0]}
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={onToggleHelp}
                        className={`p-1.5 md:p-2 rounded-lg md:rounded-xl transition-all ${
                            task.helpRequested ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title="Request SOS"
                    >
                        <LifeBuoy size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KanbanBoard;
