import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Counter, StarRating } from './shared';
import { useTeamSettings } from '../../contexts/TeamSettingsContext';

interface MatchScoutFormProps {
  show: boolean;
  editingMatch: any | null;
  matchForm: any;
  setMatchForm: (f: any) => void;
  onClose: () => void;
  onSave: () => void;
  pitScouts: any[];
  activeTeamClaimRef: React.MutableRefObject<{ matchKey: string; teamNumber: number } | null>;
  onUnclaim: (matchKey: string, teamNumber: number) => void;
}

const MatchScoutForm: React.FC<MatchScoutFormProps> = ({
  show, editingMatch, matchForm, setMatchForm, onClose, onSave,
  pitScouts, activeTeamClaimRef, onUnclaim,
}) => {
  const { settings } = useTeamSettings();
  const [customAutoInput, setCustomAutoInput] = useState('');

  const scoutedTeam = pitScouts.find((p: any) => p.teamNumber === matchForm.teamNumber);
  const pitAutoOptions: string[] = Array.from(new Set([
    ...(scoutedTeam?.autoOptions || []),
    ...(scoutedTeam?.autonomousRoutine && scoutedTeam.autonomousRoutine !== 'None'
      ? [scoutedTeam.autonomousRoutine]
      : []),
  ])).filter(Boolean);

  const isCustomSelected = matchForm.autoUsed === '__custom__' ||
    (matchForm.autoUsed && !pitAutoOptions.includes(matchForm.autoUsed) && matchForm.autoUsed !== '');

  useEffect(() => {
    if (isCustomSelected && matchForm.autoUsed !== '__custom__') {
      setCustomAutoInput(matchForm.autoUsed);
    }
  }, [matchForm.teamNumber, show]);

  const handleAutoSelect = (val: string) => {
    if (val === '__custom__') {
      setMatchForm({ ...matchForm, autoUsed: '__custom__' });
      setCustomAutoInput('');
    } else {
      setMatchForm({ ...matchForm, autoUsed: val });
    }
  };

  const handleCustomInput = (val: string) => {
    setCustomAutoInput(val);
    setMatchForm({ ...matchForm, autoUsed: val });
  };

  if (!show) return null;

  const handleClose = () => {
    if (activeTeamClaimRef.current) {
      onUnclaim(activeTeamClaimRef.current.matchKey, activeTeamClaimRef.current.teamNumber);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-teamColor">
        <div className="flex justify-between items-start mb-6 md:mb-8">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
              {editingMatch ? 'Edit Match' : 'Record Match'}
            </h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Match scouting form</p>
          </div>
          <button onClick={handleClose} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5">
          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Match Type</span>
            <div className="flex gap-2">
              {(['practice', 'qualification', 'elimination'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setMatchForm({ ...matchForm, matchType: t })}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    matchForm.matchType === t ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Match Number</span>
              <input type="number" value={matchForm.matchNumber || ''} onChange={(e) => setMatchForm({ ...matchForm, matchNumber: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-black text-lg"
                placeholder="1" min={1} />
            </div>
            <div className="space-y-1">
              <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Number</span>
              <input type="number" value={matchForm.teamNumber || ''} onChange={(e) => setMatchForm({ ...matchForm, teamNumber: parseInt(e.target.value) || 0 })}
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-black text-lg"
                placeholder={String(settings.teamNumber)} />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alliance</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setMatchForm({ ...matchForm, alliance: 'Red' })}
                className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
                  matchForm.alliance === 'Red' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-red-100 text-red-400'
                }`}>Red</button>
              <button type="button" onClick={() => setMatchForm({ ...matchForm, alliance: 'Blue' })}
                className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
                  matchForm.alliance === 'Blue' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-blue-100 text-blue-400'
                }`}>Blue</button>
            </div>
          </div>

          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Auto Routine Used</span>
            <select
              value={isCustomSelected ? '__custom__' : (matchForm.autoUsed || '')}
              onChange={(e) => handleAutoSelect(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-bold text-sm"
            >
              <option value="">— None / Not recorded —</option>
              {pitAutoOptions.length > 0 && (
                <optgroup label="From robot scouting">
                  {pitAutoOptions.map((a: string) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </optgroup>
              )}
              <option value="__custom__">Other / Custom…</option>
            </select>
            {isCustomSelected && (
              <input
                type="text"
                value={customAutoInput}
                onChange={(e) => handleCustomInput(e.target.value)}
                placeholder="Describe the auto routine…"
                className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-teamColor/30 dark:border-teamColor/20 rounded-[24px] outline-none focus:border-teamColor transition-all font-bold text-sm"
                autoFocus
              />
            )}
            {pitAutoOptions.length === 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold px-1">
                No routines on file — add them in the robot scouting report for team {matchForm.teamNumber || '…'}.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="border-2 border-green-100 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 rounded-xl p-4">
              <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-3">Auto Period Fuel</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMatchForm({ ...matchForm, autoFuelTotal: Math.max(0, matchForm.autoFuelTotal - 1) })}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg bg-green-100 text-green-700 hover:bg-green-200 transition-all active:scale-95">−</button>
                <input type="number" value={matchForm.autoFuelTotal || ''} onChange={(e) => setMatchForm({ ...matchForm, autoFuelTotal: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-16 text-center font-black text-xl text-slate-900 dark:text-white bg-white dark:bg-slate-700 border-2 border-green-200 dark:border-green-700 rounded-xl py-2 outline-none focus:border-green-500 transition-all"
                  placeholder="0" min={0} />
                <button type="button" onClick={() => setMatchForm({ ...matchForm, autoFuelTotal: matchForm.autoFuelTotal + 1 })}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg bg-green-100 text-green-700 hover:bg-green-200 transition-all active:scale-95">+</button>
                <button type="button" onClick={() => setMatchForm({ ...matchForm, autoFuelTotal: matchForm.autoFuelTotal + 5 })}
                  className="px-3 h-10 flex items-center justify-center rounded-xl font-black text-xs bg-green-200 text-green-800 hover:bg-green-300 transition-all active:scale-95">+5</button>
                <button type="button" onClick={() => setMatchForm({ ...matchForm, autoFuelTotal: matchForm.autoFuelTotal + 10 })}
                  className="px-3 h-10 flex items-center justify-center rounded-xl font-black text-xs bg-green-200 text-green-800 hover:bg-green-300 transition-all active:scale-95">+10</button>
              </div>
            </div>

            <div className="border-2 border-blue-100 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20 rounded-xl p-4">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-3">Tele-Op Period Fuel</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setMatchForm({ ...matchForm, teleopFuelTotal: Math.max(0, matchForm.teleopFuelTotal - 1) })}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all active:scale-95">−</button>
                <input type="number" value={matchForm.teleopFuelTotal || ''} onChange={(e) => setMatchForm({ ...matchForm, teleopFuelTotal: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-16 text-center font-black text-xl text-slate-900 dark:text-white bg-white dark:bg-slate-700 border-2 border-blue-200 dark:border-blue-700 rounded-xl py-2 outline-none focus:border-blue-500 transition-all"
                  placeholder="0" min={0} />
                <button type="button" onClick={() => setMatchForm({ ...matchForm, teleopFuelTotal: matchForm.teleopFuelTotal + 1 })}
                  className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all active:scale-95">+</button>
                <button type="button" onClick={() => setMatchForm({ ...matchForm, teleopFuelTotal: matchForm.teleopFuelTotal + 5 })}
                  className="px-3 h-10 flex items-center justify-center rounded-xl font-black text-xs bg-blue-200 text-blue-800 hover:bg-blue-300 transition-all active:scale-95">+5</button>
                <button type="button" onClick={() => setMatchForm({ ...matchForm, teleopFuelTotal: matchForm.teleopFuelTotal + 10 })}
                  className="px-3 h-10 flex items-center justify-center rounded-xl font-black text-xs bg-blue-200 text-blue-800 hover:bg-blue-300 transition-all active:scale-95">+10</button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <StarRating value={matchForm.coralScored} onChange={(v) => setMatchForm({ ...matchForm, coralScored: v })} max={5}
              label="Fuel Accuracy  (1 = always misses → 5 = always hits)" />
          </div>

          <Counter label="Climb Level (0 = no climb)" value={matchForm.endClimbLevel} onChange={(v) => setMatchForm({ ...matchForm, endClimbLevel: v })} min={0} max={3} />
          <Counter label="Penalties" value={matchForm.penalties} onChange={(v) => setMatchForm({ ...matchForm, penalties: v })} />

          <StarRating value={matchForm.drivingSkillRating} onChange={(v) => setMatchForm({ ...matchForm, drivingSkillRating: v })} max={5} label="Driving Skill Rating" />

          <div className="space-y-1">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notes</span>
            <textarea value={matchForm.notes} onChange={(e) => setMatchForm({ ...matchForm, notes: e.target.value })}
              className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-teamColor transition-all font-medium text-sm resize-none"
              placeholder="Match observations..." />
          </div>

          <button onClick={onSave} disabled={!matchForm.teamNumber}
            className="w-full py-4 bg-teamColor text-white font-black rounded-xl uppercase tracking-widest text-xs hover:opacity-90 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {editingMatch ? 'Update Match' : 'Save Match'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MatchScoutForm;
