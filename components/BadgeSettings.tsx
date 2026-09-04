import React, { useState, useEffect } from 'react';
import { Plus, X, Edit3, Archive, ArchiveRestore, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { BadgeChip, BadgeIconPicker, BadgeColorPicker } from './badgeStyles';

const EMPTY_FORM = { name: '', description: '', icon: 'award', color: '#dc2626' };

/**
 * Coach-authored custom badges (e.g. a Safety Badge), rendered inside a
 * Control Panel SectionCard.
 *
 * Level badges are NOT configured here — they're derived from the department
 * and level of a certification set and awarded automatically, so there is
 * nothing to define.
 */
const BadgeSettings: React.FC = () => {
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    try {
      const data = await api.badges.getDefinitions(true);
      setDefinitions(data || []);
    } catch {
      setDefinitions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const openEdit = (def: any) => {
    setEditTarget(def);
    setForm({ name: def.name, description: def.description || '', icon: def.icon, color: def.color });
    setShowForm(true);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editTarget) {
        await api.badges.updateDefinition(editTarget.id, form);
      } else {
        await api.badges.createDefinition(form);
      }
      closeForm();
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save badge.');
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async (def: any) => {
    try {
      await api.badges.updateDefinition(def.id, { archived: !def.archived });
      await load();
    } catch {
      alert('Failed to update badge.');
    }
  };

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm font-bold">
          <Loader2 size={14} className="animate-spin" /> Loading...
        </div>
      ) : (
        <div className="space-y-2">
          {definitions.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
              No custom badges yet. Create one to award it from the Team page.
            </p>
          )}
          {definitions.map(def => (
            <div
              key={def.id}
              className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl ${def.archived ? 'opacity-50' : ''}`}
            >
              <BadgeChip badge={def} />
              <span className="flex-1 min-w-0 text-[11px] text-slate-500 dark:text-slate-400 font-medium truncate">
                {def.description}
              </span>
              {def.archived && (
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Archived</span>
              )}
              <button
                onClick={() => openEdit(def)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Edit"
              >
                <Edit3 size={13} />
              </button>
              <button
                onClick={() => toggleArchive(def)}
                className="p-1 text-slate-400 hover:text-amber-600 transition-colors"
                title={def.archived ? 'Restore' : 'Archive'}
              >
                {def.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="p-4 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl space-y-4 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
              {editTarget ? 'Edit Badge' : 'New Badge'}
            </p>
            <button onClick={closeForm} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
              <X size={14} />
            </button>
          </div>
          {formError && <p className="text-red-600 text-xs font-bold">{formError}</p>}

          <input
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            placeholder="Badge name (e.g. Safety Badge)"
            className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-bold dark:text-white transition-all"
          />
          <input
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            placeholder="What does it recognize?"
            className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-medium dark:text-white transition-all"
          />

          <div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Icon</p>
            <BadgeIconPicker value={form.icon} onChange={icon => setForm({ ...form, icon })} color={form.color} />
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Color</p>
            <BadgeColorPicker value={form.color} onChange={color => setForm({ ...form, color })} />
          </div>

          <div>
            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Preview</p>
            <BadgeChip badge={{ name: form.name || 'Badge Name', description: form.description, icon: form.icon, color: form.color }} size="md" />
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 bg-teamColor text-white font-black rounded-xl hover:opacity-90 transition-all uppercase tracking-widest text-[10px] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : editTarget ? 'Save Changes' : 'Create Badge'}
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setForm(EMPTY_FORM); setEditTarget(null); setShowForm(true); }}
          className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <Plus size={13} /> Add Badge
        </button>
      )}
    </div>
  );
};

export default BadgeSettings;
