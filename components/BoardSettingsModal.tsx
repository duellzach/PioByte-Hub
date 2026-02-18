import React, { useState } from 'react';
import { Project, User, Department, Role } from '../types';
import { DEPARTMENTS } from '../constants';
import { X, Settings, Archive, Eye, EyeOff, Users, Building2, UserPlus, UserCheck } from 'lucide-react';

interface BoardSettingsModalProps {
  project: Project;
  users: User[];
  currentUser: User | null;
  onClose: () => void;
  onSave: (project: Project) => void;
  onArchive: (id: string) => void;
}

const BoardSettingsModal: React.FC<BoardSettingsModalProps> = ({ 
  project, 
  users, 
  currentUser,
  onClose, 
  onSave,
  onArchive 
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [department, setDepartment] = useState<string>(project.department || '');
  const [scrumMasters, setScrumMasters] = useState<string[]>(project.scrumMasters || []);
  const [showInWarRoom, setShowInWarRoom] = useState(project.showInWarRoom ?? true);
  const [allowAllTaskCreation, setAllowAllTaskCreation] = useState(project.allowAllTaskCreation ?? false);

  const eligibleScrumMasters = users.filter(u => 
    u.roles.includes(Role.ScrumMaster) || 
    u.roles.includes(Role.Coach) || 
    u.roles.includes(Role.TeamCaptain) ||
    u.roles.includes(Role.DepartmentHead)
  );

  const isCoachOrCaptain = currentUser?.roles.some(r => 
    r === Role.Coach || r === Role.TeamCaptain || r === Role.ScrumMaster
  );

  const handleScrumMasterToggle = (userId: string) => {
    if (scrumMasters.includes(userId)) {
      setScrumMasters(scrumMasters.filter(id => id !== userId));
    } else {
      setScrumMasters([...scrumMasters, userId]);
    }
  };

  const handleSave = () => {
    onSave({
      ...project,
      name,
      description,
      department: department || undefined,
      scrumMasters,
      showInWarRoom,
      allowAllTaskCreation
    });
  };

  const handleArchiveToggle = () => {
    onArchive(project.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl border-t-8 border-slate-900">
        <div className="sticky top-0 bg-white dark:bg-slate-800 p-6 md:p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center">
              <Settings size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Board Settings</h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">Configure board options</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 md:p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Board Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-black text-lg uppercase tracking-tight dark:text-white"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Description</label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-24 p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-medium text-slate-700 dark:text-slate-300 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                <Building2 size={14} />
                Department Access
              </label>
              <select 
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-slate-700 dark:text-white"
              >
                <option value="">All Departments (Open)</option>
                {DEPARTMENTS.map(d => (
                  <option key={d} value={d}>{d} Only</option>
                ))}
              </select>
              <p className="text-[9px] text-slate-400 ml-2">Restrict board visibility to specific department members</p>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
                {showInWarRoom ? <Eye size={14} /> : <EyeOff size={14} />}
                War Room Visibility
              </label>
              <button
                onClick={() => setShowInWarRoom(!showInWarRoom)}
                className={`w-full p-4 border-2 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                  showInWarRoom 
                    ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400' 
                    : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                }`}
              >
                {showInWarRoom ? <Eye size={18} /> : <EyeOff size={18} />}
                {showInWarRoom ? 'Visible in War Room' : 'Hidden from War Room'}
              </button>
              <p className="text-[9px] text-slate-400 ml-2">Toggle whether this board shows on the War Room dashboard</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
              {allowAllTaskCreation ? <UserCheck size={14} /> : <UserPlus size={14} />}
              Task Creation Permissions
            </label>
            <button
              onClick={() => setAllowAllTaskCreation(!allowAllTaskCreation)}
              className={`w-full p-4 border-2 rounded-xl font-bold transition-all flex items-center justify-center gap-3 ${
                allowAllTaskCreation 
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400' 
                  : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-500 dark:text-slate-400'
              }`}
            >
              {allowAllTaskCreation ? <UserCheck size={18} /> : <UserPlus size={18} />}
              {allowAllTaskCreation ? 'All Members Can Create Tasks' : 'Leaders Only Can Create Tasks'}
            </button>
            <p className="text-[9px] text-slate-400 ml-2">
              {allowAllTaskCreation 
                ? 'Any team member can create tasks on this board' 
                : 'Only Department Heads, Scrum Masters, Captains, and Coaches can create tasks'}
            </p>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">
              <Users size={14} />
              Scrum Masters / Owners
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {eligibleScrumMasters.map(user => (
                <button
                  key={user.id}
                  onClick={() => handleScrumMasterToggle(user.id)}
                  className={`p-3 rounded-xl border-2 transition-all text-left ${
                    scrumMasters.includes(user.id)
                      ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400'
                      : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-200 dark:hover:border-slate-500'
                  }`}
                >
                  <p className="font-black text-xs uppercase truncate">{user.name}</p>
                  <p className="text-[8px] font-bold uppercase text-slate-400 truncate">{user.roles[0]}</p>
                </button>
              ))}
            </div>
            {eligibleScrumMasters.length === 0 && (
              <p className="text-sm text-slate-400 italic">No eligible scrum masters found</p>
            )}
          </div>

          {isCoachOrCaptain && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={handleArchiveToggle}
                className={`w-full p-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 ${
                  project.archived
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-red-600 hover:text-white'
                }`}
              >
                <Archive size={18} />
                {project.archived ? 'Restore Board' : 'Archive Board'}
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-800 p-6 md:p-8 border-t border-slate-100 dark:border-slate-700 flex gap-4">
          <button 
            onClick={onClose}
            className="flex-1 py-4 text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl uppercase tracking-widest text-xs transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default BoardSettingsModal;
