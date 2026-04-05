import React from 'react';
import { X, Calendar, AlertCircle, Zap, Brain } from 'lucide-react';
import { useTeamSettings } from '../../contexts/TeamSettingsContext';

interface PitDisplayProps {
  pitSubTab: 'live' | 'rankings';
  setPitSubTab: (t: 'live' | 'rankings') => void;
  pitDisplayAlerts: any[];
  dismissedPitAlertIds: Set<number>;
  onDismissPitAlert: (id: number) => void;
  nexusData: any;
  nexusLoading: boolean;
  nexusError: string | null;
  nexusCountdown: string | null;
  onFetchNexusData: (key: string) => void;
  onFetchTbaData: (key: string) => void;
  tbaMatches: any[];
  tbaLoading: boolean;
  tbaRecord: { wins: number; losses: number; ties: number } | null;
  tbaRankings: Map<number, { rank: number; rp: number; record: string }>;
  pitScouts: any[];
  matchScoutsData: any[];
  activeEvent: any;
  isCoachOrCaptain: boolean;
  dismissedBreaks: Set<string>;
  setDismissedBreaks: React.Dispatch<React.SetStateAction<Set<string>>>;
  dismissedAnnouncements: Set<string>;
  setDismissedAnnouncements: React.Dispatch<React.SetStateAction<Set<string>>>;
  dismissedParts: Set<string>;
  setDismissedParts: React.Dispatch<React.SetStateAction<Set<string>>>;
  onOpenRobotByNumber: (num: number) => void;
  onSetSelectedRobot: (r: any) => void;
  onGenerateGeminiReport: (m: any) => void;
}

const extractAnnouncementText = (a: any): string => {
  if (typeof a === 'string') return a;
  return a?.message ?? a?.text ?? a?.body ?? a?.content ?? a?.announcement ?? a?.description ?? '';
};

const extractPartsRequestText = (r: any): string => {
  if (typeof r === 'string') return r;
  return r?.parts ?? r?.request ?? r?.item ?? r?.part ?? r?.message ?? r?.text ?? r?.description ?? '';
};

const PitDisplay: React.FC<PitDisplayProps> = ({
  pitSubTab, setPitSubTab, pitDisplayAlerts, dismissedPitAlertIds, onDismissPitAlert,
  nexusData, nexusLoading, nexusError, nexusCountdown, onFetchNexusData, onFetchTbaData,
  tbaMatches, tbaLoading, tbaRecord, tbaRankings, pitScouts, matchScoutsData,
  activeEvent, isCoachOrCaptain, dismissedBreaks, setDismissedBreaks,
  dismissedAnnouncements, setDismissedAnnouncements, dismissedParts, setDismissedParts,
  onOpenRobotByNumber, onSetSelectedRobot, onGenerateGeminiReport,
}) => {
  const { settings } = useTeamSettings();
  const teamNumber = settings.teamNumber;
  const frcKey = `frc${teamNumber}`;
  return (
    <div className="space-y-6 md:space-y-8">

      <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl w-fit">
        {(['live', 'rankings'] as const).map(sub => (
          <button key={sub} onClick={() => setPitSubTab(sub)}
            className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              pitSubTab === sub
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}>
            {sub === 'live' ? '⚡ Live' : '🏆 Rankings'}
          </button>
        ))}
      </div>

      {(() => {
        const now = new Date();
        const undismissed = pitDisplayAlerts.filter(a =>
          !dismissedPitAlertIds.has(a.id) &&
          (!a.expiresAt || new Date(a.expiresAt) > now)
        );
        if (undismissed.length === 0) return null;
        const a = undismissed[0];
        const isSafety = a.type === 'safety';
        const pitBorderColor = isSafety ? 'border-red-600' : 'border-orange-500';
        const pitIconColor = isSafety ? 'text-red-600' : 'text-orange-500';
        const pitBgCard = isSafety ? 'bg-red-600/15' : 'bg-orange-500/15';
        const pitBtnColor = isSafety ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600';
        const pitLabel = isSafety ? 'Safety Alert' : a.type === 'urgent' ? 'Urgent Alert' : 'Pit Display Alert';
        const pitIcon = isSafety ? '⚠' : '!';
        return (
          <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
            <div className={`bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl border-t-8 ${pitBorderColor} ring-4 ring-offset-2 ring-offset-black ${isSafety ? 'ring-red-600/40' : 'ring-orange-500/40'}`}>
              <div className="flex justify-end mb-2">
                <button onClick={() => onDismissPitAlert(a.id)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
                  <span className="text-lg font-black">✕</span>
                </button>
              </div>
              <div className={`w-16 h-16 ${pitBgCard} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                <span className={`text-3xl font-black ${pitIconColor}`}>{pitIcon}</span>
              </div>
              <p className={`text-[10px] font-black uppercase tracking-widest mb-3 ${pitIconColor}`}>{pitLabel}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">{a.message}</p>
              {undismissed.length > 1 && (
                <p className="text-xs text-slate-400 font-bold mt-3">{undismissed.length - 1} more alert{undismissed.length > 2 ? 's' : ''} pending</p>
              )}
              <button onClick={() => onDismissPitAlert(a.id)}
                className={`mt-6 px-8 py-3 font-black text-sm uppercase tracking-widest rounded-2xl text-white transition-all ${pitBtnColor}`}>
                Dismiss
              </button>
            </div>
          </div>
        );
      })()}

      {nexusData && (() => {
        const firstPendingAnnouncement = nexusData.announcements?.find(
          (a: any) => !dismissedAnnouncements.has(String(a?.id ?? extractAnnouncementText(a)))
        );
        const firstPendingPart = nexusData.partsRequests?.find(
          (r: any) => !dismissedParts.has(String(r?.id ?? extractPartsRequestText(r)))
        );
        const matches: any[] = nexusData.matches || [];
        const activeStatusSet = new Set(['Now queuing', 'On deck', 'On field']);
        const activeMatchIdx = matches.findIndex((m: any) => activeStatusSet.has(m.status));
        const lastCompletedIdx = (() => {
          for (let i = matches.length - 1; i >= 0; i--) {
            if (!activeStatusSet.has(matches[i].status) && matches[i].status !== 'Queuing soon') return i;
          }
          return -1;
        })();
        const breakMatchIdx = activeMatchIdx >= 0 ? activeMatchIdx : lastCompletedIdx;
        const breakMatch = breakMatchIdx >= 0 ? matches[breakMatchIdx] : null;
        const breakId = breakMatch
          ? `${activeEvent?.id ?? ''}::${breakMatch.label ?? ''}::${breakMatch.breakAfter ?? ''}`
          : '';
        const nextMatchAfterBreak = breakMatchIdx >= 0 ? matches[breakMatchIdx + 1] : null;
        const resumeTime = nextMatchAfterBreak?.times?.estimatedQueueTime || nextMatchAfterBreak?.times?.estimatedStartTime;
        const pendingBreak = breakMatch?.breakAfter && !dismissedBreaks.has(breakId) ? breakMatch : null;

        if (pendingBreak) {
          return (
            <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl border-t-8 border-orange-500">
                <div className="flex justify-end mb-2">
                  <button onClick={() => setDismissedBreaks(prev => new Set([...prev, breakId]))} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-all"><X size={20} /></button>
                </div>
                <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} className="text-orange-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Break After This Match</h2>
                <p className="text-base text-slate-700 dark:text-slate-300 font-medium">{pendingBreak.breakAfter}</p>
                {resumeTime && (
                  <p className="text-sm text-orange-600 font-black mt-3">
                    Resumes at {new Date(resumeTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT
                  </p>
                )}
              </div>
            </div>
          );
        }

        if (firstPendingAnnouncement) {
          const key = String(firstPendingAnnouncement.id ?? firstPendingAnnouncement.message ?? firstPendingAnnouncement);
          return (
            <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl border-t-8 border-yellow-500">
                <div className="flex justify-end mb-2">
                  <button onClick={() => setDismissedAnnouncements(prev => new Set([...prev, key]))} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-all"><X size={20} /></button>
                </div>
                <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Zap size={32} className="text-yellow-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">Announcement</h2>
                <p className="text-base text-slate-700 dark:text-slate-300 font-medium">{extractAnnouncementText(firstPendingAnnouncement)}</p>
              </div>
            </div>
          );
        }

        if (firstPendingPart) {
          const key = String(firstPendingPart.id ?? firstPendingPart.message ?? firstPendingPart);
          return (
            <div className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg p-8 text-center shadow-2xl border-t-8 border-red-600">
                <div className="flex justify-end mb-2">
                  <button onClick={() => setDismissedParts(prev => new Set([...prev, key]))} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-all"><X size={20} /></button>
                </div>
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <AlertCircle size={32} className="text-red-600" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-3">Parts Request</h2>
                {(firstPendingPart?.requestedByTeam ?? firstPendingPart?.teamNumber) && (
                  <p className="text-sm font-black text-red-600 dark:text-red-400 mb-2 uppercase tracking-widest">Team {firstPendingPart.requestedByTeam ?? firstPendingPart.teamNumber}</p>
                )}
                <p className="text-base text-slate-700 dark:text-slate-300 font-medium">{extractPartsRequestText(firstPendingPart)}</p>
                {firstPendingPart?.quantity != null && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Qty: {firstPendingPart.quantity}</p>
                )}
                {firstPendingPart?.notes && extractPartsRequestText(firstPendingPart) !== firstPendingPart.notes && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">{firstPendingPart.notes}</p>
                )}
              </div>
            </div>
          );
        }

        return null;
      })()}

      {pitSubTab === 'live' && (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6 2xl:gap-8">

          <div>
            {activeEvent?.nexusEventKey ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-600/10 to-blue-600/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">FRC Nexus Live</span>
                    {nexusData?.nowQueuing && (
                      <span className="px-2.5 py-1 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest animate-pulse">
                        {typeof nexusData.nowQueuing === 'string' ? nexusData.nowQueuing : (nexusData.nowQueuing?.label ?? nexusData.nowQueuing?.match ?? '')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {nexusLoading && <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Refreshing...</span>}
                    <button onClick={() => onFetchNexusData(activeEvent.nexusEventKey)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-lg text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                      Refresh
                    </button>
                  </div>
                </div>

                {nexusError ? (
                  <div className="px-6 py-8 text-center">
                    <p className="text-sm font-black text-red-500 uppercase tracking-tight">Error loading Nexus data</p>
                    <p className="text-xs text-slate-400 mt-1">{nexusError}</p>
                  </div>
                ) : nexusLoading && !nexusData ? (
                  <div className="px-6 py-8 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">Loading live data...</div>
                ) : nexusData ? (
                  <div className="p-6 space-y-6">
                    {(() => {
                      const ourMatches = (nexusData.matches || []).filter(
                        (m: any) => (m.redTeams || []).includes(teamNumber) || (m.blueTeams || []).includes(teamNumber)
                      );
                      const activeMatch = ourMatches.find((m: any) =>
                        m.status === 'Now queuing' || m.status === 'On deck' || m.status === 'On field'
                      );
                      const nextMatch = ourMatches.find((m: any) => m.status === 'Queuing soon');

                      const statusColor = (status: string) => {
                        if (status === 'Now queuing') return 'bg-red-600 text-white';
                        if (status === 'On deck') return 'bg-orange-500 text-white';
                        if (status === 'On field') return 'bg-green-600 text-white';
                        if (status === 'Queuing soon') return 'bg-blue-600 text-white';
                        return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
                      };

                      const teamBadge = (num: number, alliance: 'red' | 'blue') => (
                        <span key={num} className={`px-2 py-1 rounded-lg text-[11px] font-black ${
                          num === teamNumber
                            ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-black'
                            : alliance === 'red'
                            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        }`}>
                          {num === teamNumber ? '★ ' : ''}{num}
                        </span>
                      );

                      return (
                        <>
                          {(activeMatch || nexusCountdown) && (
                            <div className={`rounded-2xl p-5 flex items-center justify-between gap-4 ${
                              activeMatch?.status === 'Now queuing' ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700' :
                              activeMatch?.status === 'On deck' ? 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700' :
                              activeMatch?.status === 'On field' ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700' :
                              'bg-violet-50 dark:bg-violet-900/20 border-2 border-violet-200 dark:border-violet-800'
                            }`}>
                              <div>
                                {activeMatch && (
                                  <>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${statusColor(activeMatch.status)}`}>{activeMatch.status}</span>
                                      <span className="text-sm font-black text-slate-900 dark:text-white">{activeMatch.label}</span>
                                    </div>
                                    <div className="flex gap-3 mt-2">
                                      <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest mr-1">Red</span>
                                        {(activeMatch.redTeams || []).map((t: number) => teamBadge(t, 'red'))}
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest mr-1">Blue</span>
                                        {(activeMatch.blueTeams || []).map((t: number) => teamBadge(t, 'blue'))}
                                      </div>
                                    </div>
                                  </>
                                )}
                                {!activeMatch && nextMatch && (
                                  <p className="text-sm font-black text-slate-900 dark:text-white">Next: {nextMatch.label}</p>
                                )}
                              </div>
                              {nexusCountdown && (
                                <div className="text-right flex-shrink-0">
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Queue in</p>
                                  <p className={`text-3xl font-black tabular-nums ${
                                    nexusCountdown === 'Queue now!' ? 'text-red-600 animate-pulse' : 'text-slate-900 dark:text-white'
                                  }`}>{nexusCountdown}</p>
                                </div>
                              )}
                            </div>
                          )}

                          {nexusData.announcements?.length > 0 && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-xl p-4">
                              <p className="text-[9px] font-black text-yellow-700 dark:text-yellow-300 uppercase tracking-widest mb-2">Announcements</p>
                              {nexusData.announcements.map((a: any, i: number) => (
                                <p key={i} className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">{extractAnnouncementText(a)}</p>
                              ))}
                            </div>
                          )}

                          {nexusData.matches?.length > 0 && (() => {
                            const timeStr = (t: string) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
                            const activeStatuses = new Set(['Queuing soon', 'Now queuing', 'On deck', 'On field']);
                            const completedStatuses = new Set(['Results posted', 'Complete', 'Completed', 'Done', 'Played']);
                            const matches: any[] = nexusData.matches;

                            // TBA ground-truth: qual match numbers where actual_time is set = played
                            const tbaPlayedNums = new Set<number>(
                              tbaMatches
                                .filter((m: any) => m.actual_time != null && m.comp_level === 'qm')
                                .map((m: any) => m.match_number as number)
                            );
                            // Extract qual match number from Nexus label (e.g. "Qualification 15" → 15)
                            const parseNum = (label: string): number | null => {
                              const d = label?.match(/\d+/);
                              return d ? parseInt(d[0]) : null;
                            };
                            // A Nexus match is truly done if TBA says so, or its status explicitly says so
                            const isTrulyDone = (m: any): boolean => {
                              const num = parseNum(m.label);
                              if (num != null && tbaPlayedNums.has(num)) return true;
                              const s = m.status;
                              return completedStatuses.has(s) || (s && !activeStatuses.has(s) && !s.toLowerCase().includes('schedul'));
                            };
                            // A Nexus match is truly active only if its status is active AND TBA hasn't confirmed it done
                            const isTrulyActive = (m: any): boolean => {
                              if (!activeStatuses.has(m.status)) return false;
                              const num = parseNum(m.label);
                              return num == null || !tbaPlayedNums.has(num);
                            };

                            const firstActiveIdx = matches.findIndex(isTrulyActive);
                            const lastCompletedIdx = (() => {
                              for (let i = matches.length - 1; i >= 0; i--) {
                                if (isTrulyDone(matches[i])) return i;
                              }
                              return -1;
                            })();
                            const anchorIdx = firstActiveIdx >= 0
                              ? firstActiveIdx
                              : lastCompletedIdx >= 0
                                ? Math.min(lastCompletedIdx + 1, matches.length - 1)
                                : 0;
                            const next10 = matches.slice(anchorIdx, anchorIdx + 10);
                            if (next10.length === 0) return null;
                            return (
                              <div>
                                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Upcoming Matches</p>
                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                                        <th className="px-3 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                                        <th className="px-3 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Match</th>
                                        <th className="px-3 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Red</th>
                                        <th className="px-3 py-2 text-left text-[9px] font-black text-slate-400 uppercase tracking-widest">Blue</th>
                                        <th className="px-3 py-2 text-right text-[9px] font-black text-slate-400 uppercase tracking-widest">Queue / Start</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {next10.map((m: any, i: number) => {
                                        const isOurs = [...(m.redTeams || []), ...(m.blueTeams || [])].includes(teamNumber);
                                        const queueTime = m.times?.estimatedQueueTime;
                                        const startTime = m.times?.estimatedStartTime;
                                        return (
                                          <tr key={i} className={`border-b last:border-b-0 transition-all ${
                                            isOurs
                                              ? 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20 border-b-red-100 dark:border-b-red-900'
                                              : 'border-b-slate-100 dark:border-b-slate-700 odd:bg-white dark:odd:bg-transparent even:bg-slate-50/50 dark:even:bg-slate-700/20'
                                          }`}>
                                            <td className="px-3 py-2">
                                              {(() => {
                                                const done = isTrulyDone(m);
                                                const label = done ? 'Done' :
                                                  m.status === 'Queuing soon' ? 'Soon' :
                                                  m.status === 'Now queuing' ? 'Queue' :
                                                  m.status === 'On deck' ? 'Deck' :
                                                  m.status === 'On field' ? 'Field' : '—';
                                                const color = done ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400' : statusColor(m.status);
                                                return <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${color}`}>{label}</span>;
                                              })()}
                                            </td>
                                            <td className={`px-3 py-2 font-black text-sm ${isOurs ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>
                                              {m.label}{isOurs && ' ★'}
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="flex gap-1 flex-wrap">{(m.redTeams || []).map((t: number) => teamBadge(t, 'red'))}</div>
                                            </td>
                                            <td className="px-3 py-2">
                                              <div className="flex gap-1 flex-wrap">{(m.blueTeams || []).map((t: number) => teamBadge(t, 'blue'))}</div>
                                            </td>
                                            <td className="px-3 py-2 text-right text-[10px] text-slate-400 dark:text-slate-500 font-bold whitespace-nowrap">
                                              {queueTime && <div>Q {timeStr(queueTime)}</div>}
                                              {startTime && <div>▶ {timeStr(startTime)}</div>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })()}

                          {nexusData.partsRequests?.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-xl p-4">
                              <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-2">Parts Requests</p>
                              <div className="space-y-2">
                                {nexusData.partsRequests.map((r: any, i: number) => {
                                  const desc = extractPartsRequestText(r);
                                  return (
                                    <div key={i} className="flex items-start gap-2">
                                      {(r?.requestedByTeam ?? r?.teamNumber) && (
                                        <span className="flex-shrink-0 px-2 py-0.5 bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 rounded font-black text-[10px]">
                                          #{r.requestedByTeam ?? r.teamNumber}
                                        </span>
                                      )}
                                      <div className="min-w-0">
                                        <p className="text-sm text-red-800 dark:text-red-200 font-medium leading-snug">{desc}</p>
                                        {r?.quantity != null && <p className="text-[10px] text-red-500 dark:text-red-400 font-bold">Qty: {r.quantity}</p>}
                                        {r?.notes && desc !== r.notes && <p className="text-[10px] text-red-500 dark:text-red-400 italic">{r.notes}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : null}
              </div>
            ) : (
              isCoachOrCaptain && (
                <div className="bg-violet-50 dark:bg-violet-900/20 rounded-2xl md:rounded-[32px] border-2 border-violet-200 dark:border-violet-700 p-6 text-center">
                  <p className="text-sm font-black text-violet-700 dark:text-violet-300 uppercase tracking-tight">No Nexus Event Key</p>
                  <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">Open Event Settings and add the event key to enable live queue data</p>
                </div>
              )
            )}
          </div>

          <div className="space-y-4">
            {activeEvent?.tbaEventKey && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Event Schedule</h3>
                  <button onClick={() => onFetchTbaData(activeEvent.tbaEventKey)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Refresh
                  </button>
                </div>

                {tbaLoading ? (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">Loading schedule...</div>
                ) : (() => {
                  const teamMatches = tbaMatches
                    .filter((m: any) =>
                      m.alliances?.red?.team_keys?.includes(frcKey) ||
                      m.alliances?.blue?.team_keys?.includes(frcKey)
                    )
                    .sort((a: any, b: any) => {
                      if (a.predicted_time && b.predicted_time) return a.predicted_time - b.predicted_time;
                      if (a.time && b.time) return a.time - b.time;
                      return (a.match_number || 0) - (b.match_number || 0);
                    });

                  const isPlayed = (m: any) => {
                    if (m.actual_time) return true;
                    const redScore = m.alliances?.red?.score;
                    const blueScore = m.alliances?.blue?.score;
                    return redScore !== null && redScore !== undefined && redScore >= 0 &&
                           blueScore !== null && blueScore !== undefined && blueScore >= 0;
                  };
                  const playedMatches = teamMatches.filter(isPlayed);
                  const upcomingMatches = teamMatches.filter((m: any) => !isPlayed(m));

                  const getMatchLabel = (m: any) => {
                    const compLevel = m.comp_level || 'qm';
                    const num = m.match_number || 0;
                    const set = m.set_number || 0;
                    if (compLevel === 'qm') return `Qual ${num}`;
                    if (compLevel === 'qf') return `QF ${set}-${num}`;
                    if (compLevel === 'sf') return `SF ${set}-${num}`;
                    if (compLevel === 'f') return `Final ${num}`;
                    return `Match ${num}`;
                  };

                  const getOurAlliance = (m: any) => {
                    if (m.alliances?.red?.team_keys?.includes(frcKey)) return 'red';
                    return 'blue';
                  };

                  const renderTeamLink = (teamKey: string) => {
                    const num = parseInt(teamKey.replace('frc', ''));
                    const hasScouted = pitScouts.some((ps: any) => ps.teamNumber === num);
                    return (
                      <span key={teamKey} onClick={(e) => { e.stopPropagation(); if (hasScouted) onOpenRobotByNumber(num); }}
                        className={`${hasScouted ? 'text-red-600 underline cursor-pointer hover:text-red-800' : 'text-slate-700 dark:text-slate-300'} font-black`}>
                        {num}
                      </span>
                    );
                  };

                  return (
                    <div className="space-y-6">
                      {upcomingMatches.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                            Up Next
                          </h4>
                          <div className="space-y-2">
                            {upcomingMatches.slice(0, 10).map((m: any) => {
                              const ourAlliance = getOurAlliance(m);
                              const partnerKeys = (m.alliances?.[ourAlliance]?.team_keys || []).filter((t: string) => t !== frcKey);
                              const opponentKeys = (m.alliances?.[ourAlliance === 'red' ? 'blue' : 'red']?.team_keys || []);
                              const time = m.predicted_time || m.time;
                              return (
                                <div key={m.key} className={`p-4 rounded-xl border-2 ${ourAlliance === 'red' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${ourAlliance === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                                        {getMatchLabel(m)}
                                      </span>
                                      <div>
                                        <p className="text-sm text-slate-900 dark:text-white flex items-center gap-1">
                                          <span className="text-slate-400 dark:text-slate-500 text-xs">w/</span>
                                          {partnerKeys.length > 0 ? partnerKeys.map((t: string, i: number) => (
                                            <span key={t}>{i > 0 && <span className="text-slate-300">, </span>}{renderTeamLink(t)}</span>
                                          )) : '—'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                          <span className="text-slate-400 dark:text-slate-500">vs</span>
                                          {opponentKeys.length > 0 ? opponentKeys.map((t: string, i: number) => (
                                            <span key={t}>{i > 0 && <span className="text-slate-300">, </span>}{renderTeamLink(t)}</span>
                                          )) : '—'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {time && (
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                          {new Date(time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
                                        </span>
                                      )}
                                      <button onClick={() => onGenerateGeminiReport(m)} title="Generate AI match analysis"
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-[9px] font-black hover:from-violet-700 hover:to-blue-700 transition-all active:scale-95">
                                        <Brain size={11} /> AI
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {playedMatches.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Completed Matches</h4>
                          <div className="space-y-2">
                            {playedMatches.map((m: any) => {
                              const ourAlliance = getOurAlliance(m);
                              const didWin = m.winning_alliance === ourAlliance;
                              const didTie = m.winning_alliance === '';
                              const ourScore = m.alliances?.[ourAlliance]?.score ?? '—';
                              const theirScore = m.alliances?.[ourAlliance === 'red' ? 'blue' : 'red']?.score ?? '—';
                              return (
                                <div key={m.key} className={`p-4 rounded-xl border-2 ${
                                  didWin ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20' : didTie ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${ourAlliance === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                                        {getMatchLabel(m)}
                                      </span>
                                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                        didWin ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : didTie ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                      }`}>
                                        {didWin ? 'WIN' : didTie ? 'TIE' : 'LOSS'}
                                      </span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">{ourScore} – {theirScore}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {teamMatches.length === 0 && (
                        <div className="py-12 text-center">
                          <Calendar size={40} className="text-slate-200 mx-auto mb-3" />
                          <p className="text-sm font-black text-slate-300 uppercase tracking-tight">No schedule available yet</p>
                          <p className="text-xs text-slate-400 mt-1">Match schedule will appear once posted on The Blue Alliance</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {!activeEvent?.tbaEventKey && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-2xl md:rounded-[32px] border-2 border-yellow-200 dark:border-yellow-700 p-6 md:p-8 text-center">
                <Calendar size={32} className="text-yellow-500 mx-auto mb-3" />
                <p className="text-sm font-black text-yellow-800 uppercase tracking-tight">No TBA Event Linked</p>
                <p className="text-xs text-yellow-600 mt-1">Edit this event and add a Blue Alliance event key to see live schedule and win/loss record</p>
              </div>
            )}
          </div>
        </div>
      )}

      {pitSubTab === 'rankings' && (
        <div className="space-y-8">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                <span>Event Rankings</span>
                {activeEvent?.tbaEventKey && (
                  <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg">TBA Live</span>
                )}
              </h3>
              {tbaRecord && (
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team {teamNumber}</span>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 font-black text-xs rounded-lg">{tbaRecord.wins}W</span>
                    <span className="px-2.5 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-black text-xs rounded-lg">{tbaRecord.losses}L</span>
                    {tbaRecord.ties > 0 && (
                      <span className="px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 font-black text-xs rounded-lg">{tbaRecord.ties}T</span>
                    )}
                  </div>
                </div>
              )}
            </div>
            {tbaRankings.size === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-black text-slate-300 uppercase tracking-tight">No rankings yet</p>
                <p className="text-xs text-slate-400 mt-1">Rankings will appear once qualifying matches have begun</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-700">
                      <th className="pb-3 text-left text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-16">Rank</th>
                      <th className="pb-3 text-left text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team</th>
                      <th className="pb-3 text-right text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-16">RP</th>
                      <th className="pb-3 text-right text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-24">Record</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                    {Array.from(tbaRankings.entries())
                      .sort((a, b) => a[1].rank - b[1].rank)
                      .map(([teamNum, r]) => {
                        const isOurTeam = teamNum === teamNumber;
                        return (
                          <tr key={teamNum} className={`transition-colors ${isOurTeam ? 'bg-red-50 dark:bg-red-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/30'}`}>
                            <td className="py-2.5 pr-4">
                              <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black ${
                                r.rank === 1 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                                r.rank === 2 ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300' :
                                r.rank === 3 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-300' :
                                'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'
                              }`}>{r.rank}</span>
                            </td>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`font-black ${isOurTeam ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>Team {teamNum}</span>
                                {isOurTeam && <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black rounded uppercase tracking-widest">Us</span>}
                              </div>
                            </td>
                            <td className="py-2.5 text-right">
                              <span className={`text-xs font-black tabular-nums ${isOurTeam ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>{r.rp.toFixed(2)}</span>
                            </td>
                            <td className="py-2.5 text-right">
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tabular-nums">{r.record}</span>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {pitScouts.length > 0 && (() => {
            const hasRankings = tbaRankings.size > 0;
            const sorted = [...pitScouts].sort((a: any, b: any) => {
              if (hasRankings) {
                const aRank = tbaRankings.get(a.teamNumber);
                const bRank = tbaRankings.get(b.teamNumber);
                if (aRank && bRank) return aRank.rank - bRank.rank;
                if (aRank) return -1;
                if (bRank) return 1;
              }
              return (b.overallRating || 0) - (a.overallRating || 0);
            });
            return (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                    {hasRankings ? 'Event Rankings' : 'Scouted Robot Leaderboard'}
                  </h3>
                  {hasRankings && (
                    <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg">TBA Ranking Points</span>
                  )}
                </div>
                <div className="space-y-3">
                  {sorted.map((ps: any, idx: number) => {
                    const ranking = tbaRankings.get(ps.teamNumber);
                    const teamMatches = matchScoutsData.filter((m: any) => m.teamNumber === ps.teamNumber);
                    const avgAutoFuel = teamMatches.length > 0
                      ? (teamMatches.reduce((s: number, m: any) => s + (m.autoFuelTotal || 0), 0) / teamMatches.length).toFixed(1)
                      : null;
                    const avgTeleopFuel = teamMatches.length > 0
                      ? (teamMatches.reduce((s: number, m: any) => s + (m.teleopFuelTotal || 0), 0) / teamMatches.length).toFixed(1)
                      : null;
                    const avgDriving = teamMatches.filter((m: any) => m.drivingSkillRating > 0).length > 0
                      ? (teamMatches.reduce((s: number, m: any) => s + (m.drivingSkillRating || 0), 0) / teamMatches.filter((m: any) => m.drivingSkillRating > 0).length).toFixed(1)
                      : null;
                    return (
                      <div key={ps.id} onClick={() => onSetSelectedRobot(ps)}
                        className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all">
                        <span className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg ${
                          idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' :
                          idx === 1 ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300' :
                          idx === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                          {ranking ? `#${ranking.rank}` : idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-base md:text-lg font-black text-slate-900 dark:text-white truncate">
                            Team {ps.teamNumber} {ps.teamName ? `— ${ps.teamName}` : ''}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">
                            {ranking ? `${ranking.record} • ${ranking.rp.toFixed(2)} RP` : `${ps.robotName || 'Unnamed'} • ${ps.drivetrain || '—'}`}
                          </p>
                        </div>
                        <div className="flex gap-2 md:gap-3 flex-shrink-0">
                          {avgDriving !== null && (
                            <div className="text-center">
                              <p className="text-sm font-black text-slate-900 dark:text-white">{'★'.repeat(Math.round(parseFloat(avgDriving)))}</p>
                              <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase">Drive</p>
                            </div>
                          )}
                          {avgAutoFuel !== null && (
                            <div className="px-2.5 py-1.5 bg-green-50 dark:bg-green-900/30 text-center rounded-lg">
                              <p className="text-sm font-black text-green-700">{avgAutoFuel}</p>
                              <p className="text-[8px] font-black text-green-400 uppercase">Auto</p>
                            </div>
                          )}
                          {avgTeleopFuel !== null && (
                            <div className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-center rounded-lg">
                              <p className="text-sm font-black text-blue-700">{avgTeleopFuel}</p>
                              <p className="text-[8px] font-black text-blue-400 uppercase">Teleop</p>
                            </div>
                          )}
                          {avgAutoFuel === null && avgDriving === null && (
                            <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-lg text-[9px] font-black">No match data</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default PitDisplay;
