
import React, { useMemo, useState, useRef } from 'react';
import { AppState, Task, Notification, TaskStatus, Role, Announcement, Department, Comment } from '../types';
import { Bell, CheckCircle, Clock, ArrowRight, MessageSquare, Megaphone, Send, X, AtSign, Plus, BarChart3, TrendingUp, Trash2 } from 'lucide-react';
import { PRIORITY_COLORS } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HomeProps {
  state: AppState;
  onTaskClick: (task: Task) => void;
  onClearNotification: (id: string) => void;
  onAddAnnouncement: (ann: Announcement) => void;
  onUpdateAnnouncement: (ann: Announcement) => void;
  onDeleteAnnouncement: (annId: string) => void;
  onNotify: (taskId: string, toUserId: string, message: string) => void;
}

const Home: React.FC<HomeProps> = ({ state, onTaskClick, onClearNotification, onAddAnnouncement, onUpdateAnnouncement, onDeleteAnnouncement, onNotify }) => {
  const user = state.currentUser;
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastScope, setBroadcastScope] = useState<'Global' | 'Department'>('Global');
  const [targetDept, setTargetDept] = useState<Department>(user?.departments[0] || Department.Mechanical);
  
  const [newComment, setNewComment] = useState('');
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);

  const isMuted = user?.muted === true;
  const isCoach = user?.roles.includes(Role.Coach);

  const deleteAnnouncementComment = (commentId: string) => {
    if (!selectedAnnouncement || !confirm('Delete this comment?')) return;
    const updatedAnn = {
      ...selectedAnnouncement,
      comments: selectedAnnouncement.comments?.filter(c => c.id !== commentId) || []
    };
    onUpdateAnnouncement(updatedAnn);
    setSelectedAnnouncement(updatedAnn);
  };

  const handleDeleteAnnouncement = (annId: string) => {
    if (!confirm('Delete this announcement? This cannot be undone.')) return;
    onDeleteAnnouncement(annId);
    if (selectedAnnouncement?.id === annId) {
      setSelectedAnnouncement(null);
    }
  };

  const canBroadcastGlobal = useMemo(() => 
    !isMuted && (user?.roles.includes(Role.TeamCaptain) || user?.roles.includes(Role.Coach)), 
    [user, isMuted]
  );

  const canBroadcastDept = useMemo(() => 
    !isMuted && (user?.roles.includes(Role.DepartmentHead) || 
    user?.roles.includes(Role.TeamCaptain) || 
    user?.roles.includes(Role.Coach)), 
    [user, isMuted]
  );

  const myTasks = useMemo(() => {
    return state.tasks.filter(t => t.assignees.includes(user?.id || '') && t.status !== TaskStatus.Complete);
  }, [state.tasks, user]);

  const visibleAnnouncements = useMemo(() => {
    return state.announcements.filter(ann => {
      if (ann.scope === 'Global') return true;
      if (ann.scope === 'Department') {
        return user?.departments.includes(ann.targetDepartment!);
      }
      return false;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [state.announcements, user]);

  const myNotifications = useMemo(() => {
    return state.notifications
      .filter(n => String(n.toUserId) === String(user?.id))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [state.notifications, user]);

  const myTotalHours = useMemo(() => {
    const totalMins = state.timeEntries
      .filter(e => String(e.userId) === String(user?.id) && e.status === 'completed' && e.roundedMinutes)
      .reduce((acc, e) => acc + (e.roundedMinutes || 0), 0);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return { hours, mins, totalMins };
  }, [state.timeEntries, user]);

  const velocityData = useMemo(() => {
    const weeks: Record<string, number> = {};
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - (i * 7));
        const startOfWeek = new Date(d);
        startOfWeek.setDate(d.getDate() - d.getDay());
        const weekKey = `${startOfWeek.getMonth() + 1}/${startOfWeek.getDate()}`;
        weeks[weekKey] = 0;
    }

    state.tasks.forEach(task => {
        if (task.status === TaskStatus.Complete && task.completedAt) {
            const compDate = new Date(task.completedAt);
            const startOfCompWeek = new Date(compDate);
            startOfCompWeek.setDate(compDate.getDate() - compDate.getDay());
            const weekKey = `${startOfCompWeek.getMonth() + 1}/${startOfCompWeek.getDate()}`;
            if (weeks[weekKey] !== undefined) {
                weeks[weekKey] += (task.effort || 0);
            }
        }
    });

    return Object.entries(weeks).map(([name, points]) => ({ name, points }));
  }, [state.tasks]);

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

  const handleSendBroadcast = () => {
    if (!broadcastText.trim() || isMuted) return;
    const ann: Announcement = {
      id: Date.now().toString(),
      authorId: user?.id || 'unknown',
      text: broadcastText,
      timestamp: Date.now(),
      scope: broadcastScope,
      targetDepartment: broadcastScope === 'Department' ? targetDept : undefined,
      comments: []
    };
    onAddAnnouncement(ann);
    setBroadcastText('');
    setIsBroadcasting(false);
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
    return state.users.filter(u => 
      u.username.toLowerCase().includes(mentionFilter) || 
      u.name.toLowerCase().includes(mentionFilter)
    ).slice(0, 5);
  }, [mentionFilter, state.users]);

  const handleAddComment = () => {
    if (!newComment.trim() || !selectedAnnouncement || isMuted) return;
    
    const comment: Comment = {
      id: Date.now().toString(),
      userId: user?.id || 'unknown',
      text: newComment,
      timestamp: Date.now()
    };

    const updatedAnn = {
      ...selectedAnnouncement,
      comments: [comment, ...(selectedAnnouncement.comments || [])]
    };

    const mentionRegex = /@([a-zA-Z0-9._-]+)/g;
    let match;
    while ((match = mentionRegex.exec(newComment)) !== null) {
      const username = match[1].toLowerCase();
      const mentionedUser = state.users.find(u => u.username.toLowerCase() === username);
      if (mentionedUser && String(mentionedUser.id) !== String(user?.id)) {
        onNotify('broadcast:' + selectedAnnouncement.id, String(mentionedUser.id), `Mentioned you in a broadcast thread: "${newComment}"`);
      }
    }

    onUpdateAnnouncement(updatedAnn);
    setSelectedAnnouncement(updatedAnn);
    setNewComment('');
    setMentionFilter(null);
  };

  const renderCommentText = (text: string) => {
    const parts = text.split(/(@[a-zA-Z0-9._-]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const username = part.slice(1).toLowerCase();
        const exists = state.users.some(u => u.username.toLowerCase() === username);
        if (exists) {
          return <span key={i} className="text-red-600 font-black bg-red-50 px-1.5 py-0.5 rounded-lg border border-red-100">{part}</span>;
        }
      }
      return part;
    });
  };

  return (
    <div className="w-full h-full animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start gap-8 mb-12">
        <div className="flex-1">
          <p className="text-[11px] font-black text-red-600 uppercase tracking-[0.2em]">Operational Dashboard</p>
          <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-tight">Welcome, {user?.name.split(' ')[0]}</h1>
          <div className="flex items-center gap-6 mt-3">
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Team 10991 • PioBytes Robotics</p>
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-red-600" />
                <span className="text-[10px] font-black text-slate-950 uppercase tracking-widest">Wk Effort: {currentWeekEffort} PTS</span>
              </div>
              <div className="h-4 w-[1px] bg-slate-200"></div>
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-red-600" />
                <span className="text-[10px] font-black text-slate-950 uppercase tracking-widest">
                  Total Hours: {myTotalHours.hours > 0 ? `${myTotalHours.hours}h ${myTotalHours.mins}m` : `${myTotalHours.mins}m`}
                </span>
              </div>
          </div>
        </div>
        
        {(canBroadcastGlobal || canBroadcastDept) && (
          <button 
            onClick={() => {
              setIsBroadcasting(true);
              setBroadcastScope(canBroadcastGlobal ? 'Global' : 'Department');
            }}
            className="flex items-center gap-3 px-8 py-4 bg-red-600 text-white font-black rounded-[28px] hover:bg-red-700 shadow-xl shadow-red-600/20 transition-all uppercase text-xs tracking-widest"
          >
            <Megaphone size={18} />
            New Broadcast
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 mb-12">
        <section className="xl:col-span-2 bg-white rounded-[40px] border border-slate-200 p-10 shadow-sm overflow-hidden flex flex-col h-[400px]">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-3">
                        <BarChart3 className="text-red-600" /> System Velocity
                    </h2>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Accomplished Effort Points per Week</p>
                </div>
            </div>
            <div className="flex-1 -ml-8">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={velocityData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorPoints" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#E11D48" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#E11D48" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis 
                            dataKey="name" 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }}
                        />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fontSize: 10, fontWeight: 900, fill: '#94A3B8' }}
                        />
                        <Tooltip 
                            contentStyle={{ 
                                backgroundColor: '#0F172A', 
                                border: 'none', 
                                borderRadius: '16px', 
                                padding: '12px 16px',
                                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)'
                            }}
                            itemStyle={{ color: '#FFFFFF', fontWeight: 900, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                            labelStyle={{ color: '#E11D48', fontWeight: 900, fontSize: '8px', marginBottom: '4px', textTransform: 'uppercase' }}
                        />
                        <Area 
                            type="monotone" 
                            dataKey="points" 
                            stroke="#E11D48" 
                            strokeWidth={4}
                            fillOpacity={1} 
                            fill="url(#colorPoints)" 
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>

        {/* Announcements Preview in a compact column */}
        <section className="bg-slate-950 rounded-[40px] p-10 flex flex-col h-[400px]">
          <h2 className="text-xs font-black text-red-500 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
             <Megaphone size={16} /> Team Briefings
          </h2>
          <div className="flex-1 overflow-auto space-y-4 pr-2 kanban-scroll">
            {visibleAnnouncements.map(ann => {
              const author = state.users.find(u => u.id === ann.authorId);
              return (
                <div 
                  key={ann.id} 
                  onClick={() => setSelectedAnnouncement(ann)}
                  className="bg-white/5 border border-white/10 p-6 rounded-[24px] hover:bg-white/10 transition-all cursor-pointer group relative"
                >
                  {isCoach && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteAnnouncement(ann.id); }}
                      className="absolute top-3 right-3 p-1.5 text-white/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete announcement"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  <p className="text-white text-xs font-bold leading-relaxed line-clamp-3 mb-4 italic">"{ann.text}"</p>
                  <div className="flex justify-between items-center border-t border-white/5 pt-3">
                     <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">@{author?.username}</span>
                     <span className="text-[8px] font-bold text-slate-500 uppercase">{new Date(ann.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
            {visibleAnnouncements.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                    <Megaphone size={32} className="text-white/5 mb-4" />
                    <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em]">Static Stream</p>
                </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <Clock className="text-red-600" /> My Active Tasks
            </h2>
            <span className="px-4 py-1 bg-red-600 text-white text-[10px] font-black rounded-full shadow-lg">
              {myTasks.length} PENDING
            </span>
          </div>

          <div className="space-y-4">
            {myTasks.length > 0 ? myTasks.map(task => (
              <button
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="w-full text-left bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-xl hover:border-red-600/50 hover:scale-[1.01] transition-all group"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className={`text-[9px] font-black px-3 py-1 rounded-full uppercase ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="text-[9px] font-black px-3 py-1 bg-slate-100 text-slate-500 rounded-full uppercase">
                      {task.effort} PTS
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 group-hover:text-red-600 transition-colors">
                    DUE {new Date(task.dueDate).toLocaleDateString()}
                  </span>
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-2 group-hover:text-red-600 transition-colors">
                  {task.title.toUpperCase()}
                </h3>
                <p className="text-slate-400 text-sm line-clamp-1 mb-6">
                  {task.description}
                </p>
                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                  <div className="flex gap-1">
                    {task.departments.map(d => (
                      <span key={d} className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{d}</span>
                    ))}
                  </div>
                  <ArrowRight size={18} className="text-slate-200 group-hover:text-red-600 group-hover:translate-x-2 transition-all" />
                </div>
              </button>
            )) : (
              <div className="bg-white p-16 rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                <CheckCircle size={48} className="text-slate-100 mb-4" />
                <p className="text-lg font-black text-slate-300 uppercase tracking-widest">All Clear</p>
                <p className="text-slate-400 text-sm mt-1">No tasks assigned to you right now.</p>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-8">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase flex items-center gap-3">
              <Bell className="text-red-600" /> Notifications
            </h2>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Personal Mentions</span>
          </div>

          <div className="space-y-4">
            {myNotifications.length > 0 ? myNotifications.map(n => {
              const isBroadcast = n.message.startsWith('[broadcast:');
              const broadcastMatch = n.message.match(/^\[broadcast:(\d+)\]\s*/);
              const displayMessage = broadcastMatch ? n.message.replace(broadcastMatch[0], '') : n.message;
              const broadcastId = broadcastMatch ? broadcastMatch[1] : null;
              
              return (
              <div 
                key={n.id} 
                className={`p-8 rounded-[32px] border transition-all flex items-start gap-6 bg-white border-slate-200 ${!n.read ? 'shadow-lg border-l-4 border-l-red-600' : 'opacity-60'}`}
              >
                <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center font-black ${isBroadcast ? 'bg-slate-900 text-white' : 'bg-red-50 text-red-600'}`}>
                  {isBroadcast ? <Megaphone size={20} /> : <MessageSquare size={20} />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-sm font-black text-slate-900 uppercase">
                      {isBroadcast ? 'Briefing Mention' : 'Mission Mention'}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(n.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-slate-500 text-sm mb-4 leading-relaxed italic">
                    <span className="font-bold text-slate-900 not-italic">@{state.users.find(u => String(u.id) === String(n.fromUserId))?.username || 'System'}</span>: "{displayMessage.length > 80 ? displayMessage.substring(0, 80) + '...' : displayMessage}"
                  </p>
                  <div className="flex gap-4">
                    {isBroadcast ? (
                       <button 
                        onClick={() => {
                            const ann = state.announcements.find(a => String(a.id) === broadcastId);
                            if (ann) setSelectedAnnouncement(ann);
                        }}
                        className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline"
                      >
                        Launch Discussion
                      </button>
                    ) : (
                      <button 
                        onClick={() => {
                          const task = state.tasks.find(t => String(t.id) === String(n.taskId));
                          if (task) onTaskClick(task);
                        }}
                        className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline"
                      >
                        Examine Task
                      </button>
                    )}
                    {!n.read && (
                      <button 
                        onClick={() => onClearNotification(String(n.id))}
                        className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                      >
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}) : (
              <div className="bg-white p-16 rounded-[40px] border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                <Bell size={48} className="text-slate-100 mb-4" />
                <p className="text-lg font-black text-slate-300 uppercase tracking-widest">No Alerts</p>
                <p className="text-slate-400 text-sm mt-1">You're caught up with all mentions.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedAnnouncement && (
         <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-2xl h-[80vh] flex flex-col shadow-2xl overflow-hidden border-t-8 border-red-600">
             <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                <div>
                   <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">Broadcast Thread</h2>
                   <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Briefing Discussion Sector</p>
                </div>
                <div className="flex items-center gap-2">
                  {isCoach && (
                    <button 
                      onClick={() => handleDeleteAnnouncement(selectedAnnouncement.id)}
                      className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all"
                      title="Delete announcement"
                    >
                      <Trash2 size={20} />
                    </button>
                  )}
                  <button onClick={() => setSelectedAnnouncement(null)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                    <X size={24} />
                  </button>
                </div>
             </div>

             <div className="flex-1 overflow-auto p-8 space-y-8 kanban-scroll">
                <div className="bg-slate-950 text-white p-8 rounded-[32px] shadow-xl border border-white/5">
                   <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-black text-xs">
                         {state.users.find(u => u.id === selectedAnnouncement.authorId)?.name[0]}
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-tight">{state.users.find(u => u.id === selectedAnnouncement.authorId)?.name}</p>
                         <p className="text-[8px] font-bold text-red-500 uppercase tracking-widest mt-0.5">Originator</p>
                      </div>
                   </div>
                   <p className="text-lg font-bold leading-relaxed italic">"{selectedAnnouncement.text}"</p>
                </div>

                <div className="space-y-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                       <MessageSquare size={14} /> Team Response
                    </h3>
                    <div className="space-y-4">
                       {selectedAnnouncement.comments?.map(c => {
                          const author = state.users.find(u => u.id === c.userId);
                          return (
                            <div key={c.id} className="bg-slate-50 p-6 rounded-[24px] border border-slate-100 group">
                               <div className="flex justify-between items-center mb-2">
                                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">{author?.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-[8px] text-slate-400 font-bold uppercase">{new Date(c.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    {isCoach && (
                                      <button 
                                        onClick={() => deleteAnnouncementComment(c.id)}
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
                </div>
             </div>

             <div className="p-8 border-t border-slate-100 bg-slate-50/50 relative">
                {/* Mention Dropdown */}
                {mentionFilter !== null && filteredMentionUsers.length > 0 && (
                  <div className="absolute bottom-[80px] left-8 right-8 z-20 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
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

                <div className="flex gap-3">
                   <div className="relative flex-1">
                      <input 
                         ref={commentInputRef}
                         value={newComment}
                         onChange={handleInputChange}
                         onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                         placeholder="Post response... @handle"
                         className="w-full text-sm p-5 bg-white border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all pr-12 font-medium"
                      />
                      <AtSign size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300" />
                   </div>
                   <button 
                    onClick={handleAddComment}
                    className="px-8 bg-red-600 text-white rounded-[24px] hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all flex items-center justify-center"
                   >
                      <Plus size={24} />
                   </button>
                </div>
             </div>
          </div>
         </div>
      )}

      {/* Broadcast Create Modal */}
      {isBroadcasting && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-xl p-12 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Initialize Broadcast</h2>
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Operational Intel Transmission</p>
              </div>
              <button onClick={() => setIsBroadcasting(false)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                {canBroadcastGlobal && (
                  <button 
                    onClick={() => setBroadcastScope('Global')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${broadcastScope === 'Global' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Global
                  </button>
                )}
                {canBroadcastDept && (
                  <button 
                    onClick={() => setBroadcastScope('Department')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${broadcastScope === 'Department' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    Department
                  </button>
                )}
              </div>

              {broadcastScope === 'Department' && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Select Target Sector</label>
                  <select 
                    value={targetDept}
                    onChange={(e) => setTargetDept(e.target.value as Department)}
                    className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none font-black text-xs uppercase"
                  >
                    {state.currentUser?.roles.some(r => r === Role.TeamCaptain || r === Role.Coach) 
                      ? Object.values(Department).map(d => <option key={d} value={d}>{d}</option>)
                      : user?.departments.map(d => <option key={d} value={d}>{d}</option>)
                    }
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Intel Stream (Message)</label>
                <textarea 
                  autoFocus
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Type briefing message..."
                  className="w-full h-40 p-8 bg-slate-50 border-2 border-slate-100 rounded-[32px] outline-none focus:border-red-600 transition-all font-bold text-slate-700 resize-none"
                />
              </div>

              <button 
                onClick={handleSendBroadcast}
                disabled={!broadcastText.trim()}
                className="w-full py-6 bg-red-600 text-white font-black rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-[0.2em] text-sm flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Send size={18} />
                Commence Transmission
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Home;
