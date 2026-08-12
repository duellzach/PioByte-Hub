import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, BookOpen, Zap, Code2, Trophy, Cpu, Globe, ChevronRight, Plus, Edit2, Trash2, X, Loader2, ShieldCheck, Check, Tag } from 'lucide-react';
import { api } from '../services/api';
import { useTeamTime } from '../utils/timeFormat';

interface ResourceItem {
  id: number;
  title: string;
  url: string;
  description: string;
  category: string;
  addedBy: number;
  pinned: boolean;
  createdAt: string;
}

interface ResourcesProps {
  currentUser: any;
  users: any[];
}

const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Competition: { icon: <Trophy size={12} />,     color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  Software:    { icon: <Code2 size={12} />,       color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  Vendor:      { icon: <Cpu size={12} />,         color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  Design:      { icon: <Zap size={12} />,         color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
  Training:    { icon: <ShieldCheck size={12} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  Other:       { icon: <Globe size={12} />,       color: 'text-slate-600 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600' },
};

const FALLBACK_COLORS = [
  'text-cyan-600 bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800',
  'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  'text-pink-600 bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800',
  'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800',
  'text-teal-600 bg-teal-50 dark:bg-teal-900/20 border-teal-200 dark:border-teal-800',
];

function getCatMeta(cat: string, allCats: string[]): { icon: React.ReactNode; color: string } {
  if (CAT_META[cat]) return CAT_META[cat];
  const idx = allCats.filter(c => !CAT_META[c]).indexOf(cat);
  return { icon: <Tag size={12} />, color: FALLBACK_COLORS[idx % FALLBACK_COLORS.length] };
}

const EMPTY_FORM = { title: '', url: '', description: '', category: '', pinned: false };

const Resources: React.FC<ResourcesProps> = ({ currentUser, users }) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ResourceItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<ResourceItem | null>(null);
  const catInputRef = useRef<HTMLInputElement>(null);

  const isCoach = currentUser?.roles?.includes('Coach');
  const isPrivilegedUser = currentUser?.roles?.some(r => ['Coach', 'Team Captain', 'Department Head'].includes(r));

  const canEdit = (r: ResourceItem) =>
    isPrivilegedUser || (currentUser && r.addedBy === parseInt(currentUser.id));

  const getUserName = (id: number) => {
    const u = users.find((u: any) => parseInt(u.id) === id);
    return u?.name || 'Unknown';
  };

  const load = useCallback(async () => {
    try {
      const data = await api.resources.getAll();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const availableCategories: string[] = Array.from(new Set(items.map(r => r.category))).sort();

  const filtered = items.filter(r => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q ||
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q);
    const matchesCat = activeCategory === 'All' || r.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const pinned = filtered.filter(r => r.pinned);
  const rest = filtered.filter(r => !r.pinned);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, category: availableCategories[0] || '' });
    setFormError('');
    setShowForm(true);
    setTimeout(() => catInputRef.current?.focus(), 50);
  };

  const openEdit = (r: ResourceItem) => {
    setEditTarget(r);
    setForm({ title: r.title, url: r.url, description: r.description, category: r.category, pinned: r.pinned });
    setFormError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.url.trim()) { setFormError('URL is required.'); return; }
    if (!form.category.trim()) { setFormError('Category is required.'); return; }
    const url = form.url.trim().match(/^https?:\/\//) ? form.url.trim() : `https://${form.url.trim()}`;
    const category = form.category.trim();
    setSaving(true);
    setFormError('');
    try {
      if (editTarget) {
        await api.resources.update(editTarget.id, parseInt(currentUser.id), { ...form, url, category });
      } else {
        await api.resources.create(parseInt(currentUser.id), { ...form, url, category });
      }
      closeForm();
      await load();
    } catch (e: any) {
      setFormError(e.message || 'Failed to save resource.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (r: ResourceItem) => {
    try {
      await api.resources.delete(r.id, parseInt(currentUser.id));
      setDeleteConfirm(null);
      await load();
    } catch (e: any) {
      alert(e.message || 'Failed to delete resource.');
    }
  };

  const handlePinToggle = async (r: ResourceItem) => {
    if (!isCoach) return;
    try {
      await api.resources.update(r.id, parseInt(currentUser.id), { pinned: !r.pinned });
      await load();
    } catch {}
  };

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300 overflow-auto pb-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Resources</h1>
          <p className="text-[10px] font-black text-teamColor uppercase tracking-[0.3em] mt-0.5">Team Links & External Information Hub</p>
        </div>
        {isPrivilegedUser && !showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-teamColor text-white font-black rounded-xl hover:opacity-90 shadow-lg shadow-teamColor/20 text-xs uppercase tracking-widest transition-all"
          >
            <Plus size={14} /> Add Resource
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white dark:bg-slate-800 border-2 border-teamColor/30 rounded-2xl p-5 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {editTarget ? 'Edit Resource' : 'Add Resource'}
              </h2>
              <p className="text-[9px] text-teamColor font-bold uppercase tracking-widest mt-0.5">
                {editTarget ? 'Update link details' : 'Add a new link to the hub'}
              </p>
            </div>
            <button onClick={closeForm} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. WPILib Documentation"
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor dark:text-white text-sm font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">URL *</label>
              <input
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor dark:text-white text-sm font-medium transition-colors"
              />
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                Category *
                <span className="ml-1 normal-case font-medium text-slate-400">(pick existing or type a new one)</span>
              </label>
              <input
                ref={catInputRef}
                list="resource-categories"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Software, Scouting, Safety..."
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor dark:text-white text-sm font-medium transition-colors"
              />
              <datalist id="resource-categories">
                {availableCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
              {availableCategories.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {availableCategories.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all border ${
                        form.category === cat
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent'
                          : `${getCatMeta(cat, availableCategories).color} hover:opacity-80`
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Short description of this resource..."
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor dark:text-white text-sm font-medium transition-colors"
              />
            </div>

            {isCoach && (
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                    form.pinned
                      ? 'bg-teamColor text-white'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <Zap size={12} fill={form.pinned ? 'currentColor' : 'none'} />
                  {form.pinned ? 'Pinned to top' : 'Pin to top'}
                </button>
              </div>
            )}
          </div>

          {formError && (
            <p className="text-red-600 text-xs font-bold mt-3">{formError}</p>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={closeForm}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl text-sm uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-teamColor text-white font-black rounded-xl text-sm uppercase tracking-widest hover:opacity-90 shadow-lg shadow-teamColor/20 transition-all disabled:opacity-50"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : <><Check size={14} /> {editTarget ? 'Save Changes' : 'Add Resource'}</>}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-teamColor transition-colors dark:text-white dark:placeholder-slate-400"
          />
        </div>
      </div>

      {availableCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {['All', ...availableCategories].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                activeCategory === cat
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
              }`}
            >
              {cat === 'All' ? 'All Resources' : cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center py-16">
          <Loader2 size={32} className="text-slate-300 dark:text-slate-600 animate-spin" />
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div>
              <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Zap size={10} className="text-teamColor" fill="currentColor" /> Pinned
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {pinned.map(r => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    addedByName={getUserName(r.addedBy)}
                    allCategories={availableCategories}
                    canEdit={canEdit(r)}
                    isCoach={isCoach}
                    onEdit={() => openEdit(r)}
                    onDelete={() => setDeleteConfirm(r)}
                    onPinToggle={() => handlePinToggle(r)}
                  />
                ))}
              </div>
            </div>
          )}

          {rest.length > 0 && (
            <div>
              {pinned.length > 0 && (
                <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">All Resources</h2>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {rest.map(r => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    addedByName={getUserName(r.addedBy)}
                    allCategories={availableCategories}
                    canEdit={canEdit(r)}
                    isCoach={isCoach}
                    onEdit={() => openEdit(r)}
                    onDelete={() => setDeleteConfirm(r)}
                    onPinToggle={() => handlePinToggle(r)}
                  />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center">
                <BookOpen size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                {search.trim() ? (
                  <>
                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-sm">No results for "{search}"</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Try a different search term</p>
                  </>
                ) : activeCategory !== 'All' ? (
                  <>
                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-sm">No {activeCategory} resources yet</p>
                    {isPrivilegedUser && !showForm && (
                      <button onClick={openAdd} className="mt-4 px-4 py-2 bg-teamColor text-white text-xs font-black rounded-lg hover:opacity-90 uppercase tracking-widest transition-all">
                        Add a {activeCategory} resource
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-sm">No resources yet</p>
                    {isPrivilegedUser && !showForm && (
                      <button onClick={openAdd} className="mt-4 px-4 py-2 bg-teamColor text-white text-xs font-black rounded-lg hover:opacity-90 uppercase tracking-widest transition-all">
                        Add the first resource
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[300] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm shadow-2xl border-t-4 border-red-600 p-6">
            <h2 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Delete Resource?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              "<span className="font-bold text-slate-700 dark:text-slate-200">{deleteConfirm.title}</span>" will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl text-sm uppercase tracking-widest hover:bg-slate-200 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm uppercase tracking-widest hover:bg-red-700 transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ResourceCardProps {
  resource: ResourceItem;
  addedByName: string;
  allCategories: string[];
  canEdit: boolean;
  isCoach: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPinToggle: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, addedByName, allCategories, canEdit, isCoach, onEdit, onDelete, onPinToggle }) => {
  const { fmtDate } = useTeamTime();
  const meta = getCatMeta(resource.category, allCategories);

  return (
    <div className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-teamColor/40 hover:shadow-lg hover:shadow-teamColor/5 transition-all flex flex-col">
      {canEdit && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          {isCoach && (
            <button
              onClick={e => { e.preventDefault(); onPinToggle(); }}
              title={resource.pinned ? 'Unpin' : 'Pin to top'}
              className={`p-1.5 rounded-lg transition-colors ${resource.pinned ? 'bg-teamColor/10 text-teamColor' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-teamColor'}`}
            >
              <Zap size={11} fill={resource.pinned ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            onClick={e => { e.preventDefault(); onEdit(); }}
            className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-blue-600 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={11} />
          </button>
          <button
            onClick={e => { e.preventDefault(); onDelete(); }}
            className="p-1.5 bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col flex-1"
      >
        <div className="flex items-start gap-2 mb-2 pr-16">
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${meta.color}`}>
            {meta.icon}
            {resource.category}
          </div>
          {resource.pinned && <Zap size={9} className="text-teamColor flex-shrink-0 mt-1.5" fill="currentColor" />}
        </div>

        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1 group-hover:text-teamColor transition-colors flex items-center gap-1.5">
          {resource.title}
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-teamColor transition-colors ml-auto flex-shrink-0" />
        </h3>

        {resource.description && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2 mb-2">{resource.description}</p>
        )}

        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-mono truncate mb-2">{resource.url.replace(/^https?:\/\//, '')}</p>

        <div className="mt-auto pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5">
          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Added by</span>
          <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wide">{addedByName}</span>
          <span className="text-[9px] text-slate-300 dark:text-slate-600">·</span>
          <span className="text-[9px] text-slate-400 dark:text-slate-500">
            {fmtDate(resource.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </a>
    </div>
  );
};

export default Resources;
