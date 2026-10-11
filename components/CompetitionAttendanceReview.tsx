import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronUp, Clock3, FileClock, Link2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../services/api';

type Decisions = { departure: 'calendar' | 'scout'; switch: 'preserve' | 'merge'; zero: 'keep' | 'remove' };
type ReviewPreview = {
  fingerprint: string;
  applied: boolean;
  event: { title: string; date: string; calendarEventId: number; scoutEventId: number };
  beforeMinutes: number;
  memberTotals: { userId: number; userName: string; beforeMinutes: number }[];
  cases: { key: string; title: string; userId: number; userName: string; entries: any[]; audits: any[]; options: { value: string; label: string; afterMinutes: number }[]; defaultChoice?: string }[];
  decisions?: Partial<Decisions>;
  afterMinutes: number;
  afterMemberTotals: { userId: number; userName: string; beforeMinutes: number; afterMinutes: number }[];
};

const initialDecisions: Partial<Decisions> = {};
const matchesDecisions = (value: Partial<Decisions> | undefined, selected: Partial<Decisions>) =>
  !!value && value.departure === selected.departure && value.switch === selected.switch && value.zero === selected.zero &&
  !!selected.departure && !!selected.switch && !!selected.zero;
const fmtDate = (value: string) => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date not set';
const minuteLabel = (value: number) => `${value} min`;
const readable = (value: unknown) => typeof value === 'string' ? value.replace(/_/g, ' ') : JSON.stringify(value);

const CompetitionAttendanceReview: React.FC<{ onMutation?: () => void }> = ({ onMutation }) => {
  const [manage, setManage] = useState<any | null>(null);
  const [preview, setPreview] = useState<ReviewPreview | null>(null);
  const [previewValid, setPreviewValid] = useState(false);
  const [decisions, setDecisions] = useState<Partial<Decisions>>(initialDecisions);
  const [calendarId, setCalendarId] = useState('');
  const [scoutId, setScoutId] = useState('');
  const [reason, setReason] = useState('');
  const [linkConfirmed, setLinkConfirmed] = useState(false);
  const [recordsConfirmed, setRecordsConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const previewRequest = useRef(0);

  const reload = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setPreviewLoading(false);
    setError('');
    const requestId = ++previewRequest.current;
    const [managementResult, previewResult] = await Promise.allSettled([
      api.competitionAttendance.manage(),
      api.competitionAttendance.preview(),
    ]);
    const messages: string[] = [];
    if (managementResult.status === 'fulfilled') setManage(managementResult.value);
    else messages.push(managementResult.reason?.message || 'Could not load event links.');
    if (requestId === previewRequest.current) {
      if (previewResult.status === 'fulfilled') {
        setPreview(previewResult.value);
        const loadedDecisions = previewResult.value.decisions || {};
        setDecisions(loadedDecisions);
        // GET is evidence display only. Applying always requires an explicit fresh POST review.
        setPreviewValid(false);
      } else {
        setPreviewValid(false);
        if (previewResult.reason?.status === 409) messages.push('No current First Chance preview is available. Event linking is still available; reload when records are ready.');
        else messages.push(previewResult.reason?.message || 'Could not load the First Chance preview.');
        setPreview(current => current?.applied ? current : null);
      }
      setError(messages.join(' '));
      if (messages.length === 0) setSuccess('');
    }
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const calendars = manage?.calendars || [];
  const scouts = manage?.scouts || [];
  const selectedCalendar = calendars.find((item: any) => String(item.id) === calendarId);
  const selectedScout = scouts.find((item: any) => String(item.id) === scoutId);
  const allChosen = !!decisions.departure && !!decisions.switch && !!decisions.zero;
  const mappedToEvent = !!preview && calendars.some((item: any) => item.id === preview.event.calendarEventId && item.scoutEventId === preview.event.scoutEventId);
  const canApply = !!preview && previewValid && matchesDecisions(preview.decisions, decisions) && !preview.applied && allChosen && reason.trim().length >= 8 && linkConfirmed && recordsConfirmed && mappedToEvent && !previewLoading && !applying && !error;

  const refreshPreview = async () => {
    if (!allChosen) return;
    const requested = decisions as Decisions;
    const requestId = ++previewRequest.current;
    setPreviewLoading(true);
    setPreviewValid(false);
    setError('');
    setSuccess('');
    setLinkConfirmed(false);
    setRecordsConfirmed(false);
    try {
      const freshPreview = await api.competitionAttendance.previewDecisions(requested);
      if (requestId !== previewRequest.current) return;
      setPreview(freshPreview);
      setPreviewValid(matchesDecisions(freshPreview.decisions, requested));
      if (!matchesDecisions(freshPreview.decisions, requested)) setError('The server preview did not reflect all selected decisions. Review again before applying.');
    } catch (e: any) {
      if (requestId !== previewRequest.current) return;
      setError(e?.status === 409 ? 'The attendance records changed while reviewing. Reload to get a fresh preview.' : e?.message || 'Could not calculate the selected review.');
    } finally {
      if (requestId === previewRequest.current) setPreviewLoading(false);
    }
  };

  const chooseDecision = (key: keyof Decisions, value: Decisions[keyof Decisions]) => {
    setDecisions(current => ({ ...current, [key]: value }));
    setPreviewValid(false);
    setLinkConfirmed(false);
    setRecordsConfirmed(false);
    setError('');
  };

  const saveLink = async () => {
    if (!selectedCalendar || !selectedScout) return;
    setSavingLink(true); setError(''); setSuccess('');
    try {
      await api.competitionAttendance.link(Number(selectedCalendar.id), Number(selectedScout.id));
      setSuccess('Calendar and scouting event identity linked explicitly.');
      setLinkConfirmed(false);
      setRecordsConfirmed(false);
      await reload(true);
      onMutation?.();
    } catch (e: any) {
      setError(e?.status === 409 ? 'The event link changed. Reload and verify the current identity.' : e?.message || 'Could not save the event link.');
    } finally { setSavingLink(false); }
  };

  const applyReview = async () => {
    if (!canApply || !preview) return;
    setApplying(true); setError(''); setSuccess('');
    try {
      const result = await api.competitionAttendance.apply({
        fingerprint: preview.fingerprint,
        reason: reason.trim(),
        confirmed: true,
        linkConfirmed: true,
        decisions: decisions as Decisions,
      });
      setPreview(result);
      setPreviewValid(false);
      setSuccess('First Chance attendance review applied. Original records and audit history remain preserved.');
      onMutation?.();
    } catch (e: any) {
      setPreviewValid(false);
      if (e?.status === 409) setError('This preview is stale because attendance changed. Nothing was applied. Reload and review the new evidence.');
      else setError(e?.message || 'Could not apply the attendance review.');
    } finally { setApplying(false); }
  };

  const totals = useMemo(() => preview?.afterMemberTotals || [], [preview]);
  return (
    <section aria-labelledby="competition-review-title" className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-900/70 dark:bg-indigo-950/20 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300"><ShieldCheck size={20} /></div>
          <div>
            <h2 id="competition-review-title" className="text-base font-black text-slate-900 dark:text-white">Competition credit review</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-300">Reconcile the FIRST Chance records without editing or deleting the original evidence. Credits are based on explicit event identity, never a name match.</p>
          </div>
        </div>
        <button type="button" onClick={() => reload()} disabled={loading || applying} className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs font-bold text-indigo-800 hover:bg-indigo-100 disabled:opacity-60 dark:border-indigo-800 dark:bg-slate-800 dark:text-indigo-200 dark:hover:bg-slate-700">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload evidence
        </button>
      </div>

      {error && <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0" /><span>{error}</span></div>}
      {success && <div role="status" className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"><Check size={17} className="mt-0.5 shrink-0" /><span>{success}</span></div>}

      {loading && !manage ? <div className="mt-5 space-y-3" aria-label="Loading attendance review"><div className="h-12 animate-pulse rounded-lg bg-indigo-100 dark:bg-slate-700" /><div className="h-24 animate-pulse rounded-lg bg-indigo-100 dark:bg-slate-700" /></div> : (
        <>
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center gap-2"><Link2 size={15} className="text-indigo-600 dark:text-indigo-300" /><h3 className="text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200">Verified event identity</h3></div>
            <p className="mb-3 text-xs leading-5 text-slate-500 dark:text-slate-400">Link one calendar event to one scouting event by ID. No automatic name matching is used.</p>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Calendar event
                <select aria-label="Calendar event" value={calendarId} onChange={e => setCalendarId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                  <option value="">Choose calendar event…</option>{calendars.map((item: any) => <option key={item.id} value={item.id}>{item.title} · {fmtDate(item.startDate)}{item.scoutEventId ? ` · linked #${item.scoutEventId}` : ''}</option>)}
                </select>
              </label>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Scouting event
                <select aria-label="Scouting event" value={scoutId} onChange={e => setScoutId(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white">
                  <option value="">Choose scouting event…</option>{scouts.map((item: any) => <option key={item.id} value={item.id}>{item.name || item.title} · {fmtDate(item.startDate)} · #{item.id}</option>)}
                </select>
              </label>
              <button type="button" onClick={saveLink} disabled={!selectedCalendar || !selectedScout || savingLink} className="self-end rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">{savingLink ? 'Saving…' : 'Save explicit link'}</button>
            </div>
            {selectedCalendar && selectedScout && <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">This explicitly links calendar ID {selectedCalendar.id} to scouting event ID {selectedScout.id}.</p>}
          </div>

          {!preview ? <div className="mt-5 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">No First Chance preview is available yet. Reload to check for a review.</div> : (
            <div className="mt-5 space-y-4">
              {preview.applied && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">This review has already been applied. Original records remain available below.</div>}
              <div className="rounded-xl border border-indigo-200 bg-white p-4 dark:border-indigo-900 dark:bg-slate-900/60">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div><h3 className="font-black text-slate-900 dark:text-white">{preview.event?.title || 'FIRST Chance attendance'}</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{fmtDate(preview.event?.date)} · Calendar #{preview.event?.calendarEventId} ↔ Scout #{preview.event?.scoutEventId}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${mappedToEvent ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200'}`}>{mappedToEvent ? 'Identity linked' : 'Identity needs confirmation'}</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Team total before</p><p className="mt-1 text-xl font-black tabular-nums text-slate-900 dark:text-white">{minuteLabel(preview.beforeMinutes)}</p></div>
                  <div className="rounded-lg bg-indigo-50 p-3 dark:bg-indigo-950/50"><p className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Team total after selection</p><p className="mt-1 text-xl font-black tabular-nums text-indigo-900 dark:text-indigo-100">{previewLoading ? 'Updating…' : minuteLabel(preview.afterMinutes)}</p></div>
                </div>
                <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
                  {totals.map(member => <div key={member.userId} className="flex justify-between gap-3 py-2 text-xs"><span className="font-semibold text-slate-700 dark:text-slate-200">{member.userName}</span><span className="tabular-nums text-slate-500 dark:text-slate-400">{member.beforeMinutes} → <strong className="text-slate-900 dark:text-white">{member.afterMinutes} min</strong></span></div>)}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {([
                  ['departure', 'Departure time', [['calendar', 'Use verified calendar · 600 min'], ['scout', 'Use scouting record · 570 min']]],
                  ['switch', 'Duplicate session', [['preserve', 'Preserve both · 600 min'], ['merge', 'Merge duplicate credit · 585 min']]],
                  ['zero', 'Zero-minute record', [['keep', 'Keep record · 690 min'], ['remove', 'Reject zero credit · 675 min']]],
                ] as const).map(([key, title, choices]) => (
                  <fieldset key={key} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
                    <legend className="px-1 text-xs font-black text-slate-800 dark:text-slate-100">{title}</legend>
                    <div className="mt-1 space-y-2">{choices.map(([value, label]) => <label key={value} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"><input type="radio" name={`decision-${key}`} value={value} checked={decisions[key] === value} disabled={preview.applied || previewLoading} onChange={() => chooseDecision(key, value as any)} className="mt-0.5 accent-indigo-700" /><span>{label}</span></label>)}</div>
                  </fieldset>
                ))}
              </div>

              <div className="space-y-3">
                <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-slate-700 dark:text-slate-200"><FileClock size={15} /> Original evidence and audit history</h3>
                {preview.cases.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-slate-600 dark:text-slate-400">No duplicate, departure, switch, or zero-minute cases need a decision. Reload to check for new evidence.</div>}
                {preview.cases.map(item => (
                  <div key={item.key} className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/60">
                    <button type="button" aria-expanded={!!expanded[item.key]} onClick={() => setExpanded(old => ({ ...old, [item.key]: !old[item.key] }))} className="flex w-full items-center justify-between gap-3 p-3 text-left">
                      <span><span className="block text-xs font-black text-slate-800 dark:text-slate-100">{item.title}</span><span className="mt-1 block text-[11px] text-slate-500 dark:text-slate-400">{item.userName} · {item.entries.length} original record{item.entries.length === 1 ? '' : 's'}</span></span>
                      {expanded[item.key] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    {expanded[item.key] && <div className="border-t border-slate-100 p-3 dark:border-slate-700">
                      <div className="space-y-2">{item.entries.map((entry: any) => <div key={entry.id} className="rounded-lg bg-slate-50 p-3 text-[11px] dark:bg-slate-800">
                        <div className="flex flex-wrap justify-between gap-2 font-bold text-slate-800 dark:text-slate-100"><span>Original record #{entry.id} · {entry.status}</span><span>{entry.roundedMinutes} min</span></div>
                        <p className="mt-1 text-slate-500 dark:text-slate-400">In {entry.checkInAt ? new Date(entry.checkInAt).toLocaleString() : '—'} · Out {entry.checkOutAt ? new Date(entry.checkOutAt).toLocaleString() : '—'}</p>
                        <p className="text-slate-500 dark:text-slate-400">Calendar #{entry.calendarEventId ?? '—'} · Scout #{entry.scoutEventId ?? '—'}{entry.notes ? ` · ${entry.notes}` : ''}</p>
                      </div>)}</div>
                      <h4 className="mt-3 flex items-center gap-1 text-[10px] font-black uppercase text-slate-500"><Clock3 size={12} /> Audit trail</h4>
                      {item.audits.length ? <div className="mt-2 space-y-2">{item.audits.map((audit: any, index: number) => <div key={`${audit.entryId}-${audit.createdAt}-${index}`} className="rounded-lg border border-slate-100 p-2 text-[10px] dark:border-slate-700"><p className="font-bold text-slate-700 dark:text-slate-200">#{audit.entryId} · {readable(audit.actionType)} · {audit.createdAt ? new Date(audit.createdAt).toLocaleString() : 'time unavailable'}</p><p className="mt-1 break-words text-slate-500 dark:text-slate-400">Before: {readable(audit.previousValues ?? {})}<br />After: {readable(audit.newValues ?? {})}</p></div>)}</div> : <p className="mt-2 text-[11px] text-slate-500">No audit changes recorded.</p>}
                    </div>}
                  </div>
                ))}
              </div>

              {!preview.applied && <button type="button" onClick={refreshPreview} disabled={!allChosen || previewLoading} className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-white px-4 py-2.5 text-xs font-black text-indigo-800 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-indigo-800 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-slate-800">
                <RefreshCw size={14} className={previewLoading ? 'animate-spin' : ''} /> {previewLoading ? 'Reviewing selected changes…' : 'Review selected changes'}
              </button>}

              {!preview.applied && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/30">
                <h3 className="text-xs font-black uppercase tracking-wide text-amber-900 dark:text-amber-200">Review and apply</h3>
                <label className="mt-3 block text-xs font-bold text-slate-700 dark:text-slate-200">Reason for this correction <span className="font-normal text-slate-500">(at least 8 characters)</span>
                  <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="mt-1 block w-full rounded-lg border border-amber-300 bg-white p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400 dark:border-amber-900 dark:bg-slate-900 dark:text-white" placeholder="Explain the evidence and selected credit treatment." />
                </label>
                <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={linkConfirmed} onChange={e => setLinkConfirmed(e.target.checked)} className="mt-1 accent-indigo-700" />I explicitly confirm FIRST Chance calendar event 55 is the same event as scouting event 13. This identity is based on my verification, not a name match.</label>
                {!mappedToEvent && <p className="mt-1 pl-6 text-[11px] font-semibold text-amber-800 dark:text-amber-200">Save the explicit calendar ↔ scouting ID link above before applying this review.</p>}
                <label className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-700 dark:text-slate-200"><input type="checkbox" checked={recordsConfirmed} onChange={e => setRecordsConfirmed(e.target.checked)} className="mt-1 accent-indigo-700" />I acknowledge original records and audit evidence are preserved; redundant credit is rejected rather than deleting evidence.</label>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[11px] text-amber-900 dark:text-amber-200">All three choices, reason, and both confirmations are required. Applying is never automatic.</p>
                  <button type="button" onClick={applyReview} disabled={!canApply} className="inline-flex items-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-xs font-black text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50">{applying ? <><Loader2 size={14} className="animate-spin" /> Applying…</> : <><Check size={14} /> Apply reviewed correction</>}</button>
                </div>
              </div>}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default CompetitionAttendanceReview;
