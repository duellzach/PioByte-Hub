import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, Trash2, RotateCcw, ChevronUp, ChevronDown, Lock, Save, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import {
  IDENTITY_KEYS, keyFromLabel, validateTemplateFields,
  type ScoutKind, type TemplateField, type FieldType,
} from '../../shared/scoutingTemplates';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'number', label: 'Number' },
  { value: 'counter', label: 'Counter (+/−)' },
  { value: 'rating', label: 'Rating (stars)' },
  { value: 'slider', label: 'Slider' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select', label: 'Single select' },
  { value: 'multiselect', label: 'Multi select (tags)' },
  { value: 'photo', label: 'Photo' },
];

const NUMERIC = new Set<FieldType>(['number', 'counter', 'rating', 'slider']);

interface Props {
  seasonId: number;
  seasonName: string;
  kind: ScoutKind;
  onClose: () => void;
}

// Seed a brand-new template with just its locked identity fields.
function seedIdentityFields(kind: ScoutKind): TemplateField[] {
  const idLabels: Record<string, { label: string; type: FieldType; options?: string[] }> = {
    teamNumber: { label: 'Team Number', type: 'number' },
    matchNumber: { label: 'Match Number', type: 'number' },
    matchType: { label: 'Match Type', type: 'select', options: ['practice', 'qualification', 'elimination'] },
    alliance: { label: 'Alliance', type: 'select', options: ['Red', 'Blue'] },
  };
  return IDENTITY_KEYS[kind].map(key => ({
    key, label: idLabels[key].label, type: idLabels[key].type,
    options: idLabels[key].options, identity: true, required: true, section: kind === 'pit' ? 'Identity' : 'Match',
  }));
}

const TemplateBuilder: React.FC<Props> = ({ seasonId, seasonName, kind, onClose }) => {
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [savedFields, setSavedFields] = useState<TemplateField[]>([]); // last persisted, for append-only checks
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const tpl = await api.seasons.getTemplate(seasonId, kind);
        if (cancelled) return;
        if (tpl && tpl.id) {
          setTemplateId(tpl.id);
          setSavedFields(tpl.fields || []);
          setFields(tpl.fields || []);
        } else {
          setTemplateId(null);
          setSavedFields([]);
          setFields(seedIdentityFields(kind));
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load template');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [seasonId, kind]);

  const takenKeys = useMemo(() => new Set(fields.map(f => f.key)), [fields]);
  const active = fields.filter(f => !f.archived);
  const archived = fields.filter(f => f.archived);

  const patch = (key: string, p: Partial<TemplateField>) =>
    setFields(fs => fs.map(f => (f.key === key ? { ...f, ...p } : f)));

  const addField = () => {
    const label = 'New Field';
    const key = keyFromLabel(label, takenKeys);
    setFields(fs => [...fs, { key, label, type: 'number', aggregate: 'none' }]);
  };

  const archiveField = (key: string) =>
    setFields(fs => fs.map(f => (f.key === key ? { ...f, archived: true, archivedAt: Date.now() } : f)));
  const restoreField = (key: string) =>
    setFields(fs => fs.map(f => (f.key === key ? { ...f, archived: false, archivedAt: undefined } : f)));

  // Only unsaved fields (not yet persisted) can be deleted outright; saved keys
  // must be archived to honor the append-only contract.
  const isSaved = (key: string) => savedFields.some(f => f.key === key);
  const deleteUnsaved = (key: string) => setFields(fs => fs.filter(f => f.key !== key));

  const move = (key: string, dir: -1 | 1) => {
    setFields(fs => {
      const i = fs.findIndex(f => f.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= fs.length) return fs;
      const copy = [...fs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const relabel = (key: string, label: string) => {
    // Regenerate the key only while the field is still unsaved (keys are
    // permanent once persisted).
    if (isSaved(key)) { patch(key, { label }); return; }
    const others = new Set(fields.filter(f => f.key !== key).map(f => f.key));
    patch(key, { label, key: keyFromLabel(label || 'field', others) });
  };

  const save = async () => {
    setError(null);
    const check = validateTemplateFields(kind, fields, templateId ? savedFields : undefined);
    if (!check.ok) { setError(check.error || 'Invalid template'); return; }
    setSaving(true);
    try {
      if (templateId) {
        const tpl = await api.seasons.updateTemplate(templateId, { fields });
        setSavedFields(tpl.fields || fields);
      } else {
        const tpl = await api.seasons.createTemplate(seasonId, { kind, name: `${seasonName} ${kind}`, fields });
        setTemplateId(tpl.id);
        setSavedFields(tpl.fields || fields);
      }
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (f: TemplateField) => {
    const saved = isSaved(f.key);
    return (
      <div key={f.key} className={`rounded-xl border-2 p-3 space-y-2 ${f.archived ? 'border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 opacity-70' : 'border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-700/40'}`}>
        <div className="flex items-center gap-2">
          {!f.archived && (
            <div className="flex flex-col">
              <button onClick={() => move(f.key, -1)} className="text-slate-300 hover:text-teamColor"><ChevronUp size={14} /></button>
              <button onClick={() => move(f.key, 1)} className="text-slate-300 hover:text-teamColor"><ChevronDown size={14} /></button>
            </div>
          )}
          <input
            value={f.label}
            onChange={(e) => relabel(f.key, e.target.value)}
            disabled={f.archived}
            className="flex-1 p-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg outline-none focus:border-teamColor font-bold text-sm dark:text-white"
          />
          <select
            value={f.type}
            onChange={(e) => patch(f.key, { type: e.target.value as FieldType })}
            disabled={saved || f.identity}
            title={saved ? 'Type is locked once saved' : ''}
            className="w-32 p-2 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-lg outline-none focus:border-teamColor font-bold text-xs dark:text-white disabled:opacity-60"
          >
            {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {f.identity ? (
            <span className="p-2 text-slate-300" title="Identity field — locked"><Lock size={14} /></span>
          ) : f.archived ? (
            <button onClick={() => restoreField(f.key)} className="p-2 text-slate-400 hover:text-green-600" title="Restore"><RotateCcw size={14} /></button>
          ) : saved ? (
            <button onClick={() => archiveField(f.key)} className="p-2 text-slate-400 hover:text-amber-600" title="Archive (keeps old data)"><Trash2 size={14} /></button>
          ) : (
            <button onClick={() => deleteUnsaved(f.key)} className="p-2 text-slate-400 hover:text-red-600" title="Remove"><X size={14} /></button>
          )}
        </div>

        {!f.archived && !f.identity && (
          <div className="flex flex-wrap items-center gap-2 pl-1">
            <input
              value={f.section || ''}
              onChange={(e) => patch(f.key, { section: e.target.value })}
              placeholder="Section"
              className="w-28 p-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-md outline-none text-xs font-bold dark:text-white"
            />
            {(f.type === 'select' || f.type === 'multiselect') && (
              <input
                value={(f.options || []).join(', ')}
                onChange={(e) => patch(f.key, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                placeholder="Options (comma-separated)"
                className="flex-1 min-w-[10rem] p-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-md outline-none text-xs font-medium dark:text-white"
              />
            )}
            {NUMERIC.has(f.type) && (
              <>
                <select
                  value={f.aggregate || 'none'}
                  onChange={(e) => patch(f.key, { aggregate: e.target.value as any })}
                  className="p-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-md outline-none text-xs font-bold dark:text-white"
                >
                  <option value="none">No aggregate</option>
                  <option value="avg">Average</option>
                  <option value="sum">Sum</option>
                  <option value="max">Max</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={!!f.showInSummary} onChange={(e) => patch(f.key, { showInSummary: e.target.checked })} /> Summary
                </label>
                <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
                  <input type="checkbox" checked={!!f.rankMetric} onChange={(e) => patch(f.key, { rankMetric: e.target.checked })} /> Rank
                </label>
              </>
            )}
            <label className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={!!f.required} onChange={(e) => patch(f.key, { required: e.target.checked })} /> Required
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] w-full max-w-3xl max-h-[92vh] overflow-auto shadow-2xl border-t-8 border-teamColor">
        <div className="sticky top-0 bg-white dark:bg-slate-800 p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center z-10">
          <div>
            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
              {kind === 'pit' ? 'Pit' : 'Match'} Template
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-0.5">{seasonName}</p>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 hover:text-red-600 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-400"><Loader2 className="animate-spin" /></div>
          ) : (
            <>
              {active.map(renderRow)}
              <button onClick={addField} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl text-slate-400 hover:border-teamColor hover:text-teamColor font-black text-xs uppercase tracking-widest transition-all">
                <Plus size={16} /> Add Field
              </button>

              {archived.length > 0 && (
                <div className="pt-2">
                  <button onClick={() => setShowArchived(v => !v)} className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1">
                    {showArchived ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Archived fields ({archived.length})
                  </button>
                  {showArchived && <div className="space-y-2 mt-2">{archived.map(renderRow)}</div>}
                </div>
              )}

              {error && <p className="text-sm font-bold text-red-600 dark:text-red-400">{error}</p>}
            </>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-800 p-6 border-t border-slate-100 dark:border-slate-700 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-slate-400 font-black hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl uppercase tracking-widest text-xs transition-all">Cancel</button>
          <button onClick={save} disabled={saving || loading} className="flex-1 py-3 bg-teamColor text-white font-black rounded-xl hover:opacity-90 shadow-lg uppercase tracking-widest text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Template
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilder;
