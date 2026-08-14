import React, { useMemo, useState } from 'react';
import { X, FileSpreadsheet, Download, Upload, Sparkles, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { api } from '../services/api';
import { STATUSES, PRIORITIES, EFFORT_POINTS } from '../constants';
import {
  parseCsv, toCsv, buildTemplateCsv, buildAiInstructions, rowsToDraftTasks, tasksToCsvRows,
  DraftTask, RowError,
} from '../utils/taskCsv';

interface Project { id: string; name: string; }
interface UserLite { id: string; username: string; }
interface TaskLite {
  id: string; title: string; description?: string; status: string; priority: string; effort?: number;
  departments?: string[]; assignees?: string[]; contributors?: string[];
  successCriteria?: { text: string }[]; startDate?: string; dueDate?: string; deptOnly?: boolean; dependencies?: string[];
}

interface TaskImportExportModalProps {
  project: Project;
  boardTasks: TaskLite[];
  users: UserLite[];
  onClose: () => void;
  onImported?: () => void;
}

const norm = (s: string) => s.trim().toLowerCase();

function downloadBlob(content: string, filename: string, type = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TaskImportExportModal: React.FC<TaskImportExportModalProps> = ({ project, boardTasks, users, onClose, onImported }) => {
  const { settings } = useTeamSettings();
  const deptNames = settings.departments.map(d => d.name);

  const [tab, setTab] = useState<'import' | 'export'>('import');
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  const [rowErrors, setRowErrors] = useState<(RowError[] | null)[]>([]);
  const [rowWarnings, setRowWarnings] = useState<(RowError[] | null)[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: { row: number; message: string }[] } | null>(null);
  const [copied, setCopied] = useState(false);

  const ctx = useMemo(() => ({
    users,
    departments: deptNames,
    statuses: STATUSES as unknown as string[],
    priorities: PRIORITIES as unknown as string[],
    effortPoints: EFFORT_POINTS,
    existingTasks: boardTasks.map(t => ({ id: t.id, title: t.title })),
  }), [users, deptNames, boardTasks]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setParseError('');
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = String(reader.result || '');
        const rows = parseCsv(text);
        if (rows.length < 2) { setParseError('No task rows found in this file.'); setDrafts([]); return; }
        const result = rowsToDraftTasks(rows, ctx);
        setDrafts(result.drafts);
        setRowErrors(result.rowErrors);
        setRowWarnings(result.rowWarnings);
        setExcluded(new Set(result.rowErrors.map((e, i) => (e ? i : -1)).filter(i => i >= 0)));
      } catch {
        setParseError('Could not read that file — is it a valid CSV?');
        setDrafts([]);
      }
    };
    reader.readAsText(file);
  };

  const includedIndices = useMemo(
    () => drafts.map((_, i) => i).filter(i => !rowErrors[i] && !excluded.has(i)),
    [drafts, rowErrors, excluded],
  );
  const readyCount = includedIndices.length;
  const attentionCount = rowErrors.filter(Boolean).length;

  // A row's same-file Dependencies link only survives if its target is
  // actually being imported. Recomputed live so unchecking a target row
  // (or it having an error) immediately warns whatever depends on it —
  // this can't be decided once at parse time.
  const titleToRowIndex = useMemo(() => {
    const m = new Map<string, number>();
    drafts.forEach((d, i) => { if (d.title) m.set(norm(d.title), i); });
    return m;
  }, [drafts]);

  const includedTitleSet = useMemo(
    () => new Set(includedIndices.map(i => norm(drafts[i].title))),
    [includedIndices, drafts],
  );

  const displayWarnings = useMemo(() => {
    return drafts.map((d, i) => {
      const warnings = [...(rowWarnings[i] || [])];
      for (const depTitle of d.dependencyTitles) {
        const targetIdx = titleToRowIndex.get(norm(depTitle));
        const targetMissing = targetIdx === undefined || !includedTitleSet.has(norm(depTitle));
        if (targetMissing) {
          warnings.push({
            row: i + 2, column: 'Dependencies',
            message: `"${depTitle}" isn't being imported — this task will come in without that link.`,
          });
        }
      }
      return warnings.length ? warnings : null;
    });
  }, [drafts, rowWarnings, titleToRowIndex, includedTitleSet]);

  const toggleExcluded = (i: number) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setImportResult(null);
    try {
      const toSend = includedIndices.map(i => ({
        ...drafts[i],
        // Only forward same-file links whose target row is also included.
        dependencyTitles: drafts[i].dependencyTitles.filter(t => includedTitleSet.has(norm(t))),
      }));
      const res = await api.tasks.bulkCreate({
        projectId: parseInt(project.id),
        tasks: toSend,
      });
      setImportResult({ created: res.created, errors: res.errors || [] });
      if (res.created > 0) onImported?.();
      if (res.created === toSend.length) {
        setDrafts([]); setRowErrors([]); setRowWarnings([]); setExcluded(new Set()); setFileName('');
      }
    } catch (e: any) {
      setParseError(e?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadBlob(buildTemplateCsv({ departments: deptNames }), `task-import-template.csv`);
  };

  const handleCopyAiInstructions = async () => {
    const text = buildAiInstructions({
      users, departments: deptNames,
      statuses: STATUSES as unknown as string[], priorities: PRIORITIES as unknown as string[],
      effortPoints: EFFORT_POINTS,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      downloadBlob(text, 'ai-import-instructions.txt', 'text/plain');
    }
  };

  const handleExport = () => {
    const tasksById = new Map(boardTasks.map(t => [t.id, t]));
    const rows = tasksToCsvRows(boardTasks, { users, tasksById });
    const safeName = project.name.replace(/[^a-z0-9_\-]/gi, '_');
    downloadBlob(toCsv(rows), `${safeName}-tasks-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl border-t-8 border-teamColor" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teamColor/10 text-teamColor rounded-xl flex items-center justify-center"><FileSpreadsheet size={20} /></div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Import / Export Tasks</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{project.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X size={22} /></button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl border border-slate-200 dark:border-slate-600 shadow-inner w-fit">
            <button onClick={() => setTab('import')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'import' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}>Import</button>
            <button onClick={() => setTab('export')} className={`px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${tab === 'export' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}>Export</button>
          </div>
        </div>

        {tab === 'import' ? (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">1. Get a template</p>
              <div className="flex flex-wrap gap-2">
                <button onClick={handleDownloadTemplate} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <Download size={14} /> Download CSV Template
                </button>
                <button onClick={handleCopyAiInstructions} className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
                  {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <Sparkles size={14} />}
                  {copied ? 'Copied' : 'Copy AI Instructions'}
                </button>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Paste "Copy AI Instructions" plus your scope doc into Claude, ChatGPT, or Gemini to draft a starter backlog — then review and edit the CSV it gives you before importing.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">2. Upload your CSV</p>
              <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-2xl cursor-pointer hover:border-teamColor transition-colors text-slate-500 dark:text-slate-400">
                <Upload size={18} />
                <span className="text-sm font-bold">{fileName || 'Choose a CSV file…'}</span>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </label>
              {parseError && <p className="text-red-500 text-xs font-bold flex items-center gap-1.5"><AlertTriangle size={14} /> {parseError}</p>}
            </div>

            {drafts.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">3. Review {drafts.length} rows</p>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    {readyCount} ready{attentionCount > 0 ? ` · ${attentionCount} need attention` : ''}
                  </p>
                </div>
                <div className="max-h-72 overflow-y-auto border border-slate-100 dark:border-slate-700 rounded-2xl divide-y divide-slate-100 dark:divide-slate-700">
                  {drafts.map((d, i) => {
                    const errs = rowErrors[i];
                    const warns = displayWarnings[i];
                    const isExcluded = excluded.has(i);
                    return (
                      <div key={i} className={`p-3 flex items-start gap-3 ${errs ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                        <input
                          type="checkbox"
                          checked={!isExcluded && !errs}
                          disabled={!!errs}
                          onChange={() => toggleExcluded(i)}
                          className="mt-1"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${errs ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-white'}`}>
                            Row {i + 2}: {d.title || <span className="italic text-slate-400">(no title)</span>}
                          </p>
                          {errs && errs.map((e, ei) => (
                            <p key={ei} className="text-[11px] text-red-500 flex items-center gap-1"><AlertTriangle size={11} /> {e.column}: {e.message}</p>
                          ))}
                          {warns && warns.map((w, wi) => (
                            <p key={wi} className="text-[11px] text-amber-500 flex items-center gap-1"><AlertTriangle size={11} /> {w.column}: {w.message}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {importResult && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 size={16} /> Imported {importResult.created} task{importResult.created === 1 ? '' : 's'}.
                    {importResult.errors.length > 0 && <span className="text-amber-600 dark:text-amber-400"> {importResult.errors.length} rejected server-side.</span>}
                  </div>
                )}

                <button
                  onClick={handleImport}
                  disabled={readyCount === 0 || importing}
                  className="w-full py-4 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 disabled:opacity-50 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                >
                  {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  Import {readyCount} Task{readyCount === 1 ? '' : 's'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Exports the {boardTasks.length} task{boardTasks.length === 1 ? '' : 's'} currently shown for <span className="font-bold text-slate-700 dark:text-slate-200">{project.name}</span> — if a department filter is active on the board, only that subset is included.
            </p>
            <button
              onClick={handleExport}
              className="w-full py-4 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
            >
              <Download size={16} /> Export This Board
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskImportExportModal;
