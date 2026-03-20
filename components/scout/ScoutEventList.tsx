import React from 'react';
import { Plus, X, Trophy, MapPin, Calendar, Check, AlertCircle, Zap, Brain, Copy, Download } from 'lucide-react';

interface ScoutEventListProps {
  events: any[];
  isCoachOrCaptain: boolean;
  eventCounts: Record<number, { pits: number; matches: number }>;
  nexusToast: { type: 'ok' | 'error'; msg: string } | null;
  onDismissNexusToast: () => void;
  onCreateEvent: () => void;
  onEnterEvent: (evt: any) => void;
  onDeleteEvent: (id: number) => void;
  showEventSettings: boolean;
  showEventForm: boolean;
  activeEvent: any;
  eventSettingsForm: { tbaEventKey: string; nexusEventKey: string };
  setEventSettingsForm: React.Dispatch<React.SetStateAction<{ tbaEventKey: string; nexusEventKey: string }>>;
  eventForm: any;
  setEventForm: React.Dispatch<React.SetStateAction<any>>;
  nexusTestStatus: 'idle' | 'testing' | 'ok' | 'error';
  nexusTestMsg: string;
  onTestNexus: () => void;
  onSaveEventSettings: () => void;
  onCloseEventSettings: () => void;
  onCreateEventSubmit: () => void;
  onCloseEventForm: () => void;
  geminiModal: { open: boolean; text: string; matchLabel: string };
  copiedGemini: boolean;
  onSetGeminiModal: (m: { open: boolean; text: string; matchLabel: string }) => void;
  onSetCopiedGemini: (v: boolean) => void;
}

const ScoutEventList: React.FC<ScoutEventListProps> = ({
  events, isCoachOrCaptain, eventCounts, nexusToast, onDismissNexusToast,
  onCreateEvent, onEnterEvent, onDeleteEvent, showEventSettings, showEventForm,
  activeEvent, eventSettingsForm, setEventSettingsForm, eventForm, setEventForm,
  nexusTestStatus, nexusTestMsg, onTestNexus, onSaveEventSettings, onCloseEventSettings,
  onCreateEventSubmit, onCloseEventForm, geminiModal, copiedGemini,
  onSetGeminiModal, onSetCopiedGemini,
}) => {
  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Scout</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Tournament event scouting</p>
        </div>
        {isCoachOrCaptain && (
          <button onClick={onCreateEvent}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] tracking-widest">
            <Plus size={16} /> Create Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {events.map(evt => (
          <div key={evt.id} onClick={() => onEnterEvent(evt)}
            className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 hover:border-red-600/30 transition-all cursor-pointer group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
                <Trophy size={22} />
              </div>
              {isCoachOrCaptain && (
                <button onClick={(e) => { e.stopPropagation(); onDeleteEvent(evt.id); }}
                  className="p-2 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100">
                  <span className="text-base font-black">✕</span>
                </button>
              )}
            </div>
            <h3 className="text-base md:text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">{evt.name}</h3>
            {evt.location && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-1">
                <MapPin size={12} /> {evt.location}
              </div>
            )}
            {evt.startDate && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold mb-3">
                <Calendar size={12} /> {evt.startDate}{evt.endDate && ` — ${evt.endDate}`}
              </div>
            )}
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black border border-slate-100 dark:border-slate-700">
                {eventCounts[evt.id]?.pits || 0} robots
              </span>
              <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black border border-slate-100 dark:border-slate-700">
                {eventCounts[evt.id]?.matches || 0} matches
              </span>
            </div>
          </div>
        ))}
      </div>

      {events.length === 0 && (
        <div className="py-20 text-center">
          <Trophy size={56} className="text-slate-200 mx-auto mb-4" />
          <p className="text-xl font-black text-slate-300 uppercase tracking-tight">No Events Yet</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
            {isCoachOrCaptain ? 'Create your first tournament event to start scouting' : 'Ask a Coach or Captain to create an event'}
          </p>
        </div>
      )}

      {nexusToast && (
        <div className={`fixed top-6 right-6 z-[400] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
          nexusToast.type === 'ok' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {nexusToast.type === 'ok' ? <Check size={16} /> : <AlertCircle size={16} />}
          <span className="font-black text-sm">{nexusToast.msg}</span>
          <button onClick={onDismissNexusToast} className="ml-2 opacity-70 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {showEventSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-10 shadow-2xl border-t-8 border-violet-600">
            <div className="flex justify-between items-start mb-6 md:mb-8">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Event Settings</h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">{activeEvent?.name}</p>
              </div>
              <button onClick={onCloseEventSettings} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">TBA Event Key</label>
                <input value={eventSettingsForm.tbaEventKey} onChange={(e) => setEventSettingsForm({ ...eventSettingsForm, tbaEventKey: e.target.value })}
                  placeholder="e.g. 2026azgl"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm" />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Find your event key on thebluealliance.com</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">FRC Nexus Event Key</label>
                  {eventSettingsForm.tbaEventKey && eventSettingsForm.nexusEventKey !== eventSettingsForm.tbaEventKey && (
                    <button onClick={() => { setEventSettingsForm({ ...eventSettingsForm, nexusEventKey: eventSettingsForm.tbaEventKey }); }}
                      className="text-[9px] font-black text-violet-500 hover:text-violet-700 uppercase tracking-widest transition-colors">← Same as TBA key</button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input value={eventSettingsForm.nexusEventKey}
                    onChange={(e) => setEventSettingsForm({ ...eventSettingsForm, nexusEventKey: e.target.value })}
                    placeholder="e.g. 2026azgl"
                    className="flex-1 p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-violet-500 transition-all font-bold text-sm" />
                  <button onClick={onTestNexus} disabled={nexusTestStatus === 'testing'}
                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                      nexusTestStatus === 'ok' ? 'bg-green-600 text-white' :
                      nexusTestStatus === 'error' ? 'bg-red-600 text-white' :
                      nexusTestStatus === 'testing' ? 'bg-slate-200 text-slate-500' :
                      'bg-violet-600 text-white hover:bg-violet-700'
                    }`}>
                    <Zap size={13} />
                    {nexusTestStatus === 'testing' ? 'Testing...' : nexusTestStatus === 'ok' ? 'Connected!' : nexusTestStatus === 'error' ? 'Failed' : 'Test'}
                  </button>
                </div>
                {nexusTestMsg && (
                  <p className={`text-[9px] font-bold ml-1 ${nexusTestStatus === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{nexusTestMsg}</p>
                )}
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Enables live queue countdown & match schedule from frc.nexus</p>
              </div>
              <button onClick={onSaveEventSettings}
                className="w-full py-4 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 shadow-lg transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
                <Check size={16} /> Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {showEventForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-12 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-6 md:mb-10">
              <div>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">New Event</h2>
                <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Create a tournament event</p>
              </div>
              <button onClick={onCloseEventForm} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Event Name *</label>
                <input autoFocus value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="e.g. Arizona North Regional"
                  className="w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-black text-base md:text-lg uppercase tracking-tight" />
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Location</label>
                <input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="e.g. Phoenix, AZ"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Start Date</label>
                  <input type="date" value={eventForm.startDate} onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">End Date</label>
                  <input type="date" value={eventForm.endDate} onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Event Key (TBA & Nexus)</label>
                <input value={eventForm.tbaEventKey} onChange={(e) => setEventForm({ ...eventForm, tbaEventKey: e.target.value, nexusEventKey: e.target.value })}
                  placeholder="e.g. 2026azgl"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm" />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium ml-2">Used for both TBA and Nexus live data — find it on thebluealliance.com (optional)</p>
              </div>
              <button onClick={onCreateEventSubmit} disabled={!eventForm.name.trim()}
                className="w-full py-4 md:py-6 bg-red-600 text-white font-black rounded-xl md:rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50">
                <Trophy size={16} /> Create Event
              </button>
            </div>
          </div>
        </div>
      )}

      {geminiModal.open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-blue-600 rounded-xl flex items-center justify-center">
                  <Brain size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-black text-slate-900 dark:text-white text-sm">{geminiModal.matchLabel.startsWith('Team') ? 'Team Scouting Report' : 'AI Match Analysis'}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{geminiModal.matchLabel}</p>
                </div>
              </div>
              <button onClick={() => onSetGeminiModal({ open: false, text: '', matchLabel: '' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 rounded-xl transition-all">
                <X size={20} className="text-slate-400 dark:text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-4">
                <pre className="text-xs text-slate-700 dark:text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">{geminiModal.text}</pre>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-center">Copy this prompt and paste it into Google Gemini or ChatGPT for analysis</p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(geminiModal.text).then(() => {
                      onSetCopiedGemini(true);
                      setTimeout(() => onSetCopiedGemini(false), 2000);
                    });
                  }}
                  className={`flex-1 py-3 font-black rounded-xl uppercase tracking-widest text-xs flex items-center justify-center gap-2 transition-all ${
                    copiedGemini ? 'bg-green-600 text-white' : 'bg-violet-600 text-white hover:bg-violet-700'
                  }`}
                >
                  {copiedGemini ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy to Clipboard</>}
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([geminiModal.text], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${geminiModal.matchLabel.replace(/\s+/g, '_')}_scout_report.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="px-4 py-3 bg-slate-100 text-slate-700 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 transition-all"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoutEventList;
