
import React, { useState, useMemo } from 'react';
import { AppState, Task, TaskStatus, Department, Project, Priority } from '../types';
import { STATUSES, DEPARTMENTS, STATUS_COLORS, DEPARTMENT_COLORS, PRIORITY_COLORS } from '../constants';
import { Plus, AlertCircle, Calendar, GripVertical, Archive, FolderPlus, LifeBuoy, AlertTriangle, X, CheckCircle, Folder, Clock } from 'lucide-react';
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
    <div className="h-full flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button 
                onClick={() => setView('board')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'board' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
                Board
            </button>
            <button 
                onClick={() => setView('help')} 
                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${view === 'help' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:text-red-500'}`}
            >
                Help Wanted
                {helpWantedTasks.length > 0 && <span className="bg-white text-red-600 px-1.5 rounded-full text-[8px]">{helpWantedTasks.length}</span>}
            </button>
          </div>

          {view === 'board' && (
            <>
                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Select Project</label>
                    <div className="flex gap-2">
                        <select 
                        value={activeProjectId} 
                        onChange={(e) => setActiveProjectId(e.target.value)}
                        className="px-4 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 shadow-sm outline-none focus:ring-2 focus:ring-red-600/20 min-w-[200px]"
                        >
                        {state.projects.filter(p => !p.archived).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        <optgroup label="Archived">
                            {state.projects.filter(p => p.archived).map(p => <option key={p.id} value={p.id}>{p.name} (Archived)</option>)}
                        </optgroup>
                        </select>
                        <button 
                            onClick={() => setShowNewProjectModal(true)}
                            className="p-2.5 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
                            title="Create New Project"
                        >
                            <FolderPlus size={18} />
                        </button>
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Filter Dept</label>
                    <select 
                    value={deptFilter} 
                    onChange={(e) => setDeptFilter(e.target.value as Department | 'All')}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 shadow-sm outline-none focus:ring-2 focus:ring-red-600/20"
                    >
                    <option value="All">All Departments</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </div>
            </>
          )}
        </div>

        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center gap-2 px-8 py-3 bg-red-600 text-white font-black rounded-2xl hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all h-fit uppercase text-xs tracking-widest"
        >
          <Plus size={18} />
          Launch Task
        </button>
      </div>

      {view === 'board' ? (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 overflow-hidden">
            {STATUSES.map(status => (
            <div 
                key={status} 
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
                className="flex flex-col h-full bg-slate-100/40 rounded-[32px] border border-slate-200"
            >
                <div className="p-6 flex items-center justify-between bg-white/50 rounded-t-[32px] border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[status].split(' ')[0]}`} />
                    <h3 className="font-black text-slate-800 text-[10px] uppercase tracking-[0.2em]">{status}</h3>
                </div>
                <span className="bg-white text-slate-500 text-[10px] font-black px-2.5 py-1 rounded-xl border border-slate-200">
                    {tasksByStatus[status].length}
                </span>
                </div>
                <div className="flex-1 overflow-auto p-6 space-y-4 kanban-scroll">
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
      ) : (
        <div className="flex-1 bg-white rounded-[40px] border-2 border-slate-100 shadow-sm p-12 overflow-auto kanban-scroll">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-[24px] flex items-center justify-center">
                        <LifeBuoy size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Help Wanted Terminal</h2>
                        <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">Active SOS signals from all sectors</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {helpWantedTasks.map(task => (
                        <div 
                            key={task.id} 
                            onClick={() => setSelectedTask(task)}
                            className="bg-slate-50 border-2 border-slate-100 rounded-[32px] p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-red-600/30 transition-all cursor-pointer group"
                        >
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center animate-pulse shadow-lg shadow-red-600/40">
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">{task.title}</h3>
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${PRIORITY_COLORS[task.priority]}`}>
                                            {task.priority}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-1 uppercase tracking-widest">
                                        {state.projects.find(p => p.id === task.projectId)?.name} • {task.departments.join(' & ')}
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={(e) => toggleHelp(task, e)}
                                className="px-6 py-3 bg-white border border-slate-200 text-red-600 font-black text-[10px] rounded-2xl hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest shadow-sm"
                            >
                                Resolve SOS
                            </button>
                        </div>
                    ))}
                    {helpWantedTasks.length === 0 && (
                        <div className="py-24 text-center">
                            <CheckCircle size={64} className="text-slate-100 mx-auto mb-6" />
                            <p className="text-2xl font-black text-slate-300 uppercase tracking-tighter">No Units In Distress</p>
                            <p className="text-slate-400 text-sm mt-2">All departments reporting nominal status.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-xl p-12 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">New Operation</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Deploy New Project & Kanban Board</p>
              </div>
              <button onClick={() => setShowNewProjectModal(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-8">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Project Designation (Name)</label>
                <input 
                  autoFocus
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g. PIT STRUCTURE REBUILD"
                  className="w-full p-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] outline-none focus:border-red-600 transition-all font-black text-lg uppercase tracking-tight"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Mission Briefing (Description)</label>
                <textarea 
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  placeholder="Strategic objectives for this board..."
                  className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-slate-700 resize-none"
                />
              </div>

              <button 
                onClick={handleCreateProject}
                disabled={!newProjectName.trim()}
                className="w-full py-6 bg-red-600 text-white font-black rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Folder size={18} />
                Initialize Project
              </button>
            </div>
          </div>
        </div>
      )}

      {blockingTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-xl p-12 shadow-2xl border-t-8 border-black">
                <div className="flex flex-col items-center text-center mb-10">
                    <div className="w-20 h-20 bg-slate-100 text-slate-900 rounded-[28px] flex items-center justify-center mb-6">
                        <AlertTriangle size={40} />
                    </div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase mb-2">Block Report Required</h2>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest leading-relaxed">
                        Specify exactly what is hindering progress for this mission.
                    </p>
                </div>
                <div className="space-y-6">
                    <textarea 
                        autoFocus
                        value={blockReasonInput}
                        onChange={(e) => setBlockReasonInput(e.target.value)}
                        placeholder="e.g. Waiting on missing hardware shipment..."
                        className="w-full h-32 p-6 bg-slate-50 border-2 border-slate-100 rounded-[32px] outline-none focus:border-black transition-all font-medium text-slate-700 resize-none"
                    />
                    <div className="flex gap-4">
                        <button onClick={() => setBlockingTask(null)} className="flex-1 py-5 text-slate-400 font-black hover:bg-slate-100 rounded-[24px] uppercase tracking-widest text-[10px]">Cancel</button>
                        <button 
                            disabled={!blockReasonInput.trim()}
                            onClick={submitBlockReason} 
                            className="flex-1 py-5 bg-black text-white font-black rounded-[24px] hover:bg-slate-900 shadow-xl disabled:opacity-30 uppercase tracking-widest text-[10px] transition-all"
                        >
                            Finalize Block
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
            className={`group bg-white p-6 rounded-[28px] border-2 shadow-sm hover:shadow-xl hover:scale-[1.02] transition-all cursor-grab active:cursor-grabbing relative overflow-hidden ${
                task.helpRequested ? 'border-red-600 shadow-red-600/5' : 'border-slate-100 hover:border-red-600/30'
            }`}
        >
            {task.helpRequested && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-red-600 text-white text-[7px] font-black uppercase tracking-widest">
                    SOS ACTIVE
                </div>
            )}
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-lg uppercase ${PRIORITY_COLORS[task.priority]}`}>
                        {task.priority}
                    </span>
                    <span className="text-[8px] font-black px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                        {task.effort} PTS
                    </span>
                </div>
                <GripVertical size={14} className="text-slate-200 group-hover:text-slate-400" />
            </div>
            <h4 className="text-sm font-black text-slate-900 leading-tight mb-4 uppercase tracking-tight group-hover:text-red-600 transition-colors">
                {task.title}
            </h4>
            <div className="space-y-4">
                <div className="flex flex-wrap gap-1 items-center justify-between">
                    <div className="flex flex-wrap gap-1">
                        {task.departments.map(d => (
                            <span key={d} className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">
                                {d}
                            </span>
                        ))}
                    </div>
                    <div className="flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase">
                        <Clock size={10} className="text-red-600/50" />
                        {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex -space-x-2">
                        {task.assignees.slice(0, 3).map((id, i) => (
                            <div key={id} className="w-6 h-6 rounded-lg bg-slate-950 text-white border-2 border-white flex items-center justify-center text-[8px] font-black shadow-sm">
                                {id[0]}
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={onToggleHelp}
                        className={`p-2 rounded-xl transition-all ${
                            task.helpRequested ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50'
                        }`}
                        title="Request SOS"
                    >
                        <LifeBuoy size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default KanbanBoard;
