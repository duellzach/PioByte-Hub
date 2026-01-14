
import React, { useState, useMemo, useRef } from 'react';
import { X, Calendar, Plus, MessageSquare, History as HistoryIcon, Trash2, CheckCircle, BarChart3, AtSign, LifeBuoy, AlertTriangle, Clock, Search } from 'lucide-react';
import { Task, TaskStatus, Priority, Department, User, Activity, Comment, Role } from '../types';
import { STATUS_COLORS, PRIORITY_COLORS, DEPARTMENTS, PRIORITIES, STATUSES, EFFORT_POINTS } from '../constants';

interface TaskModalProps {
  task: Task | null;
  users: User[];
  allTasks: Task[];
  currentUser: User | null;
  onClose: () => void;
  onSave: (task: Task) => void;
  onSaveWithoutClose?: (task: Task) => void;
  onNotify?: (toUserId: string, message: string) => void;
  onDelete?: (taskId: string) => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ task, users, allTasks, currentUser, onClose, onSave, onSaveWithoutClose, onNotify, onDelete }) => {
  const [editedTask, setEditedTask] = useState<Task>(task || {
    id: Math.random().toString(36).substr(2, 9),
    projectId: 'default',
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
    helpRequested: false,
    blockedReason: '',
    createdAt: Date.now()
  });

  const [newComment, setNewComment] = useState('');
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const commentInputRef = useRef<HTMLInputElement>(null);

  const filteredUsersForAssignment = useMemo(() => {
    let filtered = users;
    if (editedTask.departments.length > 0) {
      filtered = filtered.filter(u => 
        u.departments.some(d => editedTask.departments.includes(d))
      );
    }
    if (assigneeSearch.trim()) {
      const search = assigneeSearch.toLowerCase();
      filtered = filtered.filter(u => 
        u.username.toLowerCase().includes(search) || 
        u.name.toLowerCase().includes(search)
      );
    }
    return filtered;
  }, [users, editedTask.departments, assigneeSearch]);

  const logActivity = (action: string) => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      userId: currentUser?.id || 'unknown', 
      action,
      timestamp: Date.now()
    };
    setEditedTask(prev => ({
      ...prev,
      history: [newActivity, ...prev.history]
    }));
  };

  const isMuted = currentUser?.muted === true;
  const isCoach = currentUser?.roles.includes(Role.Coach);

  const deleteComment = (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    const deleteActivity: Activity = {
      id: Date.now().toString(),
      userId: currentUser?.id || 'unknown',
      action: 'Comment deleted by coach',
      timestamp: Date.now()
    };
    const updatedTask = {
      ...editedTask,
      comments: editedTask.comments.filter(c => c.id !== commentId),
      history: [deleteActivity, ...editedTask.history]
    };
    setEditedTask(updatedTask);
    if (onSaveWithoutClose) onSaveWithoutClose(updatedTask);
  };

  const addComment = () => {
    if (!newComment.trim() || isMuted) return;
    const commentId = Date.now().toString();
    const comment: Comment = {
        id: commentId,
        userId: currentUser?.id || 'unknown',
        text: newComment,
        timestamp: Date.now()
    };
    
    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    let match;
    const notifiedIds = new Set<string>();
    
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const username = match[1].toLowerCase();
      const mentionedUser = users.find(u => u.username.toLowerCase() === username);
      if (mentionedUser && mentionedUser.id !== currentUser?.id && onNotify) {
        onNotify(mentionedUser.id, `Mentioned you in task "${editedTask.title}": ${newComment}`);
        notifiedIds.add(mentionedUser.id);
      }
    }

    const commentPreview = newComment.length > 25 ? newComment.substring(0, 25) + '...' : newComment;
    const commentActivity: Activity = {
      id: (Date.now() + 1).toString(),
      userId: currentUser?.id || 'unknown',
      action: `Comment posted: "${commentPreview}"`,
      timestamp: Date.now()
    };
    
    const updatedTask = {
      ...editedTask,
      comments: [comment, ...editedTask.comments],
      history: [commentActivity, ...editedTask.history]
    };
    
    setEditedTask(updatedTask);
    if (onSaveWithoutClose) onSaveWithoutClose(updatedTask);
    
    setNewComment('');
    setMentionFilter(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewComment(val);
    
    const cursorPosition = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];
    
    if (lastWord.startsWith('@')) {
      setMentionFilter(lastWord.slice(1).toLowerCase());
    } else {
      setMentionFilter(null);
    }
  };

  const insertMention = (username: string) => {
    if (!commentInputRef.current) return;
    const val = newComment;
    const cursorPosition = commentInputRef.current.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const textAfterCursor = val.slice(cursorPosition);
    
    const words = textBeforeCursor.split(/\s/);
    words[words.length - 1] = `@${username} `;
    
    const newText = words.join(' ') + textAfterCursor;
    setNewComment(newText);
    setMentionFilter(null);
    commentInputRef.current.focus();
  };

  const filteredMentionUsers = useMemo(() => {
    if (mentionFilter === null) return [];
    return users.filter(u => 
      u.username.toLowerCase().includes(mentionFilter) || 
      u.name.toLowerCase().includes(mentionFilter)
    ).slice(0, 5);
  }, [mentionFilter, users]);

  const toggleHelp = () => {
    const newState = !editedTask.helpRequested;
    setEditedTask({...editedTask, helpRequested: newState});
    logActivity(newState ? 'SOS: HELP REQUESTED' : 'SOS: HELP RESOLVED');
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1).toLowerCase();
        const exists = users.some(u => u.username.toLowerCase() === username);
        if (exists) {
          return <span key={i} className="text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded-lg border border-red-100">{part}</span>;
        }
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[40px] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in duration-300">
        <header className="p-8 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex-1 flex items-center gap-6">
            <button 
                onClick={toggleHelp}
                className={`p-4 rounded-2xl transition-all shadow-lg ${editedTask.helpRequested ? 'bg-red-600 text-white animate-pulse' : 'bg-white text-slate-300 border border-slate-200 hover:text-red-600'}`}
                title="Toggle SOS"
            >
                <LifeBuoy size={24} />
            </button>
            <div className="flex-1">
                <input 
                  value={editedTask.title}
                  onChange={(e) => setEditedTask({...editedTask, title: e.target.value})}
                  placeholder="Task Title"
                  className="text-3xl font-black text-slate-900 bg-transparent border-none outline-none focus:ring-4 focus:ring-red-600/10 rounded-xl px-2 w-full uppercase tracking-tighter"
                />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 flex items-center gap-1.5 mt-1">
                   <Clock size={10} /> POSTED {new Date(editedTask.createdAt).toLocaleDateString()} {new Date(editedTask.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {onDelete && (
                <button onClick={() => onDelete(editedTask.id)} className="p-3 text-slate-300 hover:text-red-600 transition-colors">
                    <Trash2 size={24} />
                </button>
            )}
            <button onClick={onClose} className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-slate-600 shadow-sm transition-all">
              <X size={24} />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-3 gap-0">
          <div className="lg:col-span-2 p-10 space-y-10 border-r border-slate-100">
            {editedTask.status === TaskStatus.Blocked && editedTask.blockedReason && (
              <div className="bg-red-50 border-2 border-red-100 p-8 rounded-[32px] flex items-start gap-6">
                <div className="p-3 bg-red-600 text-white rounded-2xl">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h4 className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-1">Block Report</h4>
                    <p className="text-slate-700 font-bold text-lg leading-tight uppercase tracking-tight">{editedTask.blockedReason}</p>
                </div>
              </div>
            )}

            <section>
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Mission Intel (Description)</h3>
              <textarea 
                value={editedTask.description}
                onChange={(e) => setEditedTask({...editedTask, description: e.target.value})}
                className="w-full h-40 p-8 bg-slate-50 border-2 border-slate-100 rounded-[32px] focus:ring-4 focus:ring-red-600/10 focus:border-red-600 focus:bg-white outline-none transition-all resize-none text-slate-700 leading-relaxed font-medium"
                placeholder="What needs to be done?"
              />
            </section>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Success Criteria</h3>
              </div>
              <ul className="space-y-3">
                {editedTask.successCriteria.map((criterion, idx) => (
                  <li key={idx} className="flex items-start gap-4 p-5 bg-slate-50 rounded-[24px] border border-slate-100 group">
                    <CheckCircle size={20} className="text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700 font-bold uppercase text-xs tracking-tight flex-1">{criterion}</span>
                    <button 
                      onClick={() => setEditedTask({
                        ...editedTask, 
                        successCriteria: editedTask.successCriteria.filter((_, i) => i !== idx)
                      })}
                      className="text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </li>
                ))}
                <div className="flex items-center gap-3">
                    <input 
                        id="new-criterion"
                        className="flex-1 text-sm p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold uppercase placeholder:font-normal" 
                        placeholder="Add manual criterion..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const val = (e.target as HTMLInputElement).value;
                                if (val) {
                                    setEditedTask(prev => ({...prev, successCriteria: [...prev.successCriteria, val]}));
                                    (e.target as HTMLInputElement).value = '';
                                }
                            }
                        }}
                    />
                </div>
              </ul>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t border-slate-100">
                <section className="relative">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                        <MessageSquare size={16} /> Comms
                    </h3>
                    
                    {mentionFilter !== null && filteredMentionUsers.length > 0 && (
                      <div className="absolute bottom-[80px] left-0 w-full z-20 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                        {filteredMentionUsers.map(u => (
                          <button 
                            key={u.id}
                            onClick={() => insertMention(u.username)}
                            className="w-full p-4 flex items-center gap-3 hover:bg-slate-50 text-left transition-colors border-b border-slate-100 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-black text-[10px]">
                              {u.name[0]}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 uppercase">@{u.username}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">{u.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="space-y-4 mb-6 max-h-64 overflow-auto pr-2 kanban-scroll">
                        {editedTask.comments.map(c => {
                          const user = users.find(u => u.id === c.userId);
                          return (
                            <div key={c.id} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 group">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{user?.name || 'Unknown'}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(c.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      {isCoach && (
                                        <button 
                                          onClick={() => deleteComment(c.id)}
                                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-all"
                                          title="Delete comment"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      )}
                                    </div>
                                </div>
                                <div className="text-sm text-slate-600 leading-relaxed font-medium">
                                  {renderCommentText(c.text)}
                                </div>
                            </div>
                          );
                        })}
                    </div>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                              ref={commentInputRef}
                              value={newComment}
                              onChange={handleInputChange}
                              onKeyDown={(e) => e.key === 'Enter' && addComment()}
                              placeholder="Message... @handle"
                              className="w-full text-sm p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all pr-12 font-medium"
                          />
                          <AtSign size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                        </div>
                        <button onClick={addComment} className="px-6 bg-red-600 text-white rounded-[24px] hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all">
                            <Plus size={20} />
                        </button>
                    </div>
                </section>
                <section>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2 ml-1">
                        <HistoryIcon size={16} /> Operations Log
                    </h3>
                    <div className="space-y-4 max-h-64 overflow-auto kanban-scroll pr-4">
                        {editedTask.history.map(h => {
                          const user = users.find(u => u.id === h.userId);
                          const isSOS = h.action.includes('SOS');
                          const isResolved = h.action.includes('RESOLVED');
                          return (
                            <div key={h.id} className="flex gap-4 text-xs">
                                <div className={`w-1 rounded-full ${isSOS && !isResolved ? 'bg-red-600' : isResolved ? 'bg-green-500' : 'bg-red-600/20'}`} />
                                <div>
                                    <p className={`font-black uppercase tracking-tight text-[10px] ${isSOS && !isResolved ? 'text-red-600' : isResolved ? 'text-green-600' : 'text-slate-800'}`}>{h.action}</p>
                                    <p className="text-slate-400 text-[9px] font-bold uppercase mt-0.5">{user?.name} • {new Date(h.timestamp).toLocaleString()}</p>
                                </div>
                            </div>
                          );
                        })}
                    </div>
                </section>
            </div>
          </div>

          <div className="bg-slate-50/50 p-10 space-y-8">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Task Status</label>
              <select 
                value={editedTask.status}
                onChange={(e) => {
                    const newStatus = e.target.value as TaskStatus;
                    setEditedTask({...editedTask, status: newStatus});
                    logActivity(`Status changed to ${newStatus.toUpperCase()}`);
                }}
                className={`w-full p-5 rounded-[24px] border-2 border-slate-100 text-[11px] font-black uppercase tracking-[0.2em] outline-none focus:border-red-600 transition-all ${STATUS_COLORS[editedTask.status]}`}
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-200">
               <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Calendar size={12} /> Start Date
                  </label>
                  <input 
                    type="date"
                    value={editedTask.startDate}
                    onChange={(e) => setEditedTask({...editedTask, startDate: e.target.value})}
                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all"
                  />
               </div>
               <div className="space-y-3">
                  <label className="block text-[10px] font-black text-red-600 uppercase tracking-widest ml-1 flex items-center gap-1.5">
                    <Calendar size={12} /> Due Date
                  </label>
                  <input 
                    type="date"
                    value={editedTask.dueDate}
                    onChange={(e) => setEditedTask({...editedTask, dueDate: e.target.value})}
                    className="w-full p-4 bg-white border-2 border-slate-100 rounded-[20px] text-xs font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all"
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Priority</label>
                <select 
                  value={editedTask.priority}
                  onChange={(e) => {
                      setEditedTask({...editedTask, priority: e.target.value as Priority});
                      logActivity(`Priority changed to ${e.target.value.toUpperCase()}`);
                  }}
                  className={`w-full p-5 rounded-[24px] border-2 border-slate-100 text-[10px] font-black uppercase tracking-widest outline-none focus:border-red-600 transition-all ${PRIORITY_COLORS[editedTask.priority]}`}
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1 flex items-center gap-1.5">
                    <BarChart3 size={12} /> Effort
                </label>
                <select 
                  value={editedTask.effort}
                  onChange={(e) => {
                      setEditedTask({...editedTask, effort: parseInt(e.target.value)});
                      logActivity(`Effort set to ${e.target.value} PTS`);
                  }}
                  className="w-full p-5 rounded-[24px] border-2 border-slate-100 text-xs font-black uppercase tracking-widest bg-white outline-none focus:border-red-600 transition-all"
                >
                  {EFFORT_POINTS.map(pt => <option key={pt} value={pt}>{pt} points</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Assigned Sectors</label>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENTS.map(dept => (
                  <button
                    key={dept}
                    onClick={() => {
                        const newDepts = editedTask.departments.includes(dept)
                            ? editedTask.departments.filter(d => d !== dept)
                            : [...editedTask.departments, dept];
                        setEditedTask({...editedTask, departments: newDepts});
                    }}
                    className={`px-4 py-2 text-[9px] font-black uppercase tracking-widest rounded-xl border transition-all ${
                        editedTask.departments.includes(dept)
                        ? 'bg-slate-950 text-white border-slate-800 shadow-lg scale-105'
                        : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Authorized Units</label>
              <div className="relative mb-3">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by username..."
                  value={assigneeSearch}
                  onChange={(e) => setAssigneeSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border-2 border-slate-100 rounded-xl text-sm font-medium outline-none focus:border-red-600 transition-colors"
                />
              </div>
              {editedTask.departments.length === 0 && (
                <p className="text-[9px] text-amber-600 font-bold mb-2 ml-1">Select sectors above to filter available units</p>
              )}
              <div className="space-y-2 max-h-48 overflow-auto kanban-scroll pr-2">
                {filteredUsersForAssignment.length === 0 ? (
                  <p className="text-center text-slate-400 text-xs font-bold py-4">No matching users found</p>
                ) : (
                  filteredUsersForAssignment.map(u => (
                    <button
                      key={u.id}
                      onClick={() => {
                          const newAssignees = editedTask.assignees.includes(u.id)
                              ? editedTask.assignees.filter(id => id !== u.id)
                              : [...editedTask.assignees, u.id];
                          setEditedTask({...editedTask, assignees: newAssignees});
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-[20px] text-[10px] font-black border-2 transition-all uppercase tracking-tight ${
                          editedTask.assignees.includes(u.id)
                          ? 'bg-red-50 border-red-600/20 text-red-600 shadow-sm'
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-950 text-white flex items-center justify-center text-[10px] font-black">
                          {u.name[0]}
                      </div>
                      <div className="text-left">
                        <p className="tracking-tight">{u.name}</p>
                        <p className="text-[8px] opacity-50 font-bold">@{u.username}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="pt-8 border-t border-slate-200">
                <button 
                  onClick={() => {
                    onSave(editedTask);
                  }}
                  className="w-full py-6 bg-red-600 text-white font-black rounded-[28px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-[0.2em] text-sm"
                >
                  Commit Mission
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskModal;
