import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

interface SelectableUser {
  id: number | string;
  name: string;
  username: string;
}

interface UserMultiSelectProps {
  users: SelectableUser[];
  selectedIds: (number | string)[];
  onChange: (ids: (number | string)[]) => void;
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * Search-as-you-type, toggle-on-click list for picking a set of users —
 * shared UI for anywhere the app needs "invite specific people" (event
 * invites, task assignment, etc.). Styling mirrors the house pattern used
 * throughout the app (search box + kanban-scroll toggle list).
 */
const UserMultiSelect: React.FC<UserMultiSelectProps> = ({
  users,
  selectedIds,
  onChange,
  placeholder = 'Search by name or username...',
  emptyLabel = 'No matching users found',
  className = '',
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
  }, [users, search]);

  const toggle = (id: number | string) => {
    const isSelected = selectedIds.some((s) => String(s) === String(id));
    onChange(isSelected ? selectedIds.filter((s) => String(s) !== String(id)) : [...selectedIds, id]);
  };

  return (
    <div className={className}>
      <div className="relative mb-3">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-medium outline-none focus:border-teamColor transition-colors dark:text-white"
        />
      </div>
      <div className="space-y-2 max-h-48 overflow-auto kanban-scroll pr-2">
        {filtered.length === 0 ? (
          <p className="text-center text-slate-400 dark:text-slate-500 text-xs font-bold py-4">{emptyLabel}</p>
        ) : (
          filtered.map((u) => {
            const isSelected = selectedIds.some((s) => String(s) === String(u.id));
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-[20px] text-[10px] font-black border-2 transition-all uppercase tracking-tight ${
                  isSelected
                    ? 'bg-teamColor/5 dark:bg-teamColor/10 border-teamColor/20 dark:border-teamColor text-teamColor shadow-sm'
                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${isSelected ? 'bg-teamColor text-white' : 'bg-slate-950 dark:bg-slate-900 text-white'}`}>
                  {u.name[0]}
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="tracking-tight truncate">{u.name}</p>
                  <p className="text-[8px] opacity-50 font-bold">@{u.username}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UserMultiSelect;
