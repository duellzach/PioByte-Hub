import React, { useState, useEffect, useCallback } from 'react';
import { ExternalLink, Search, BookOpen, Zap, Code2, Trophy, Cpu, Globe, Youtube, ChevronRight, Plus, Edit2, Trash2, X, Loader2, Pin, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

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
}

const CATEGORIES = ['Competition', 'Software', 'Vendor', 'Design', 'Training', 'Other'] as const;
type Category = typeof CATEGORIES[number];

const CAT_META: Record<string, { icon: React.ReactNode; color: string }> = {
  Competition: { icon: <Trophy size={12} />, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
  Software:    { icon: <Code2 size={12} />,  color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  Vendor:      { icon: <Cpu size={12} />,    color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  Design:      { icon: <Zap size={12} />,    color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
  Training:    { icon: <ShieldCheck size={12} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  Other:       { icon: <Globe size={12} />,  color: 'text-slate-600 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600' },
};

const EMPTY_FORM = { title: '', url: '', description: '', category: 'Competition' as Category, pinned: false };

const Resources: React.FC<ResourcesProps> = ({ currentUser }) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ResourceItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<ResourceItem | null>(null);

  const isCoachOrCaptain = currentUser?.roles?.includes('Coach') || currentUser?.roles?.includes('Team Captain');

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

  const canEdit = (r: ResourceItem) =>
    isCoachOrCaptain || (currentUser && r.addedBy === parseInt(currentUser.id));

  const openAdd = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (r: ResourceItem) => {
    setEditTarget(r);
    setForm({ title: r.title, url: r.url, description: r.description, category: r.category as Category, pinned: r.pinned });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setFormError('Title is required.'); return; }
    if (!form.url.trim()) { setFormError('URL is required.'); return; }
    const url = form.url.trim().startsWith('http') ? form.url.trim() : `https://${form.url.trim()}`;
    setSaving(true);
    setFormError('');
    try {
      if (editTarget) {
        await api.resources.update(editTarget.id, parseInt(currentUser.id), { ...form, url });
      } else {
        await api.resources.create(parseInt(currentUser.id), { ...form, url });
      }
      setShowModal(false);
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
    if (!isCoachOrCaptain) return;
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
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-0.5">Team Links & External Information Hub</p>
        </div>
        {currentUser && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 text-xs uppercase tracking-widest transition-all"
          >
            <Plus size={14} /> Add Resource
          </button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-red-600 transition-colors dark:text-white dark:placeholder-slate-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All', ...CATEGORIES].map(cat => (
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

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={32} className="text-slate-300 dark:text-slate-600 animate-spin" />
        </div>
      ) : (
        <>
          {pinned.length > 0 && (
            <div>
              <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                <Zap size={10} className="text-red-600" fill="currentColor" /> Pinned
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {pinned.map(r => (
                  <ResourceCard
                    key={r.id}
                    resource={r}
                    canEdit={canEdit(r)}
                    isCoach={isCoachOrCaptain}
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
                    canEdit={canEdit(r)}
                    isCoach={isCoachOrCaptain}
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
                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-sm">No resources found</p>
                {currentUser && (
                  <button onClick={openAdd} className="mt-4 px-4 py-2 bg-red-600 text-white text-xs font-black rounded-lg hover:bg-red-700 uppercase tracking-widest transition-all">
                    Add the first one
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg shadow-2xl border-t-4 border-red-600">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editTarget ? 'Edit Resource' : 'Add Resource'}
                </h2>
                <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest mt-0.5">
                  {editTarget ? 'Update link details' : 'Add a new link to the hub'}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Title *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. WPILib Documentation"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white text-sm font-medium transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">URL *</label>
                <input
                  value={form.url}
                  onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://docs.wpilib.org"
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white text-sm font-medium transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of this resource..."
                  rows={2}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 dark:text-white text-sm font-medium transition-colors resize-none"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
                        form.category === cat
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {isCoachOrCaptain && (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wide transition-all ${
                      form.pinned
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Zap size={12} fill={form.pinned ? 'currentColor' : 'none'} />
                    {form.pinned ? 'Pinned' : 'Pin to top'}
                  </button>
                </div>
              )}

              {formError && (
                <p className="text-red-600 text-xs font-bold">{formError}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-black rounded-xl text-sm uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 py-2.5 bg-red-600 text-white font-black rounded-xl text-sm uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : (editTarget ? 'Save Changes' : 'Add Resource')}
                </button>
              </div>
            </div>
          </div>
        </div>
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
  canEdit: boolean;
  isCoach: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPinToggle: () => void;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, canEdit, isCoach, onEdit, onDelete, onPinToggle }) => {
  const cat = CAT_META[resource.category] || CAT_META.Other;

  return (
    <div className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-red-600/40 hover:shadow-lg hover:shadow-red-600/5 transition-all">
      {canEdit && (
        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {isCoach && (
            <button
              onClick={e => { e.preventDefault(); onPinToggle(); }}
              title={resource.pinned ? 'Unpin' : 'Pin to top'}
              className={`p-1.5 rounded-lg transition-colors ${resource.pinned ? 'bg-red-100 dark:bg-red-900/30 text-red-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-red-600'}`}
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
        className="block"
      >
        <div className="flex items-start justify-between gap-2 mb-2 pr-16">
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${cat.color}`}>
            {cat.icon}
            {resource.category}
          </div>
        </div>
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1 group-hover:text-red-600 transition-colors flex items-center gap-1.5">
          {resource.title}
          {resource.pinned && <Zap size={9} className="text-red-600 flex-shrink-0" fill="currentColor" />}
          <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 group-hover:text-red-600 transition-colors ml-auto" />
        </h3>
        {resource.description && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed line-clamp-2">{resource.description}</p>
        )}
        <p className="text-[9px] text-slate-400 dark:text-slate-600 font-mono mt-1.5 truncate">{resource.url.replace(/^https?:\/\//, '')}</p>
      </a>
    </div>
  );
};

export default Resources;
