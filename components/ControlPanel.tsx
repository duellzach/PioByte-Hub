import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Settings, Save, RotateCcw, Loader2, Check, X, Plus, Trash2, Image, AlertTriangle, KeyRound, Copy, RefreshCw } from 'lucide-react';
import { useTeamSettings, TeamSettingsData, DEFAULT_TEAM_SETTINGS, DepartmentSetting, RoleSetting } from '../contexts/TeamSettingsContext';
import { api } from '../services/api';

interface ControlPanelProps {
  currentUserRoles: string[];
  currentUserId: string | null;
}

const THEME_PRESETS = [
  { label: 'Red', color: '#dc2626' },
  { label: 'Blue', color: '#2563eb' },
  { label: 'Green', color: '#16a34a' },
  { label: 'Orange', color: '#ea580c' },
  { label: 'Purple', color: '#9333ea' },
  { label: 'Teal', color: '#0d9488' },
  { label: 'Pink', color: '#db2777' },
  { label: 'Slate', color: '#475569' },
];

const DEPT_COLOR_OPTIONS = [
  '#f97316', '#3b82f6', '#8b5cf6', '#22c55e',
  '#eab308', '#14b8a6', '#ef4444', '#ec4899',
  '#06b6d4', '#a855f7', '#f59e0b', '#6366f1',
];

const PROTECTED_ROLES = ['Coach', 'Team Captain', 'Team Member'];

const SectionCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
      <h2 className="font-black text-sm uppercase tracking-widest text-slate-800 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const ControlPanel: React.FC<ControlPanelProps> = ({ currentUserRoles, currentUserId }) => {
  const { settings, setSettings } = useTeamSettings();

  const isCoachOrCaptain = currentUserRoles.some(r =>
    ['Coach', 'Team Captain'].includes(r)
  );

  const [form, setForm] = useState<TeamSettingsData>({ ...settings });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [logoLoading, setLogoLoading] = useState(false);
  const [logoMsg, setLogoMsg] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  const [scoutEvents, setScoutEvents] = useState<any[]>([]);
  const [eventPins, setEventPins] = useState<Record<number, any>>({});
  const [pinGenerating, setPinGenerating] = useState<number | null>(null);
  const [pinDeactivating, setPinDeactivating] = useState<number | null>(null);
  const [copiedPin, setCopiedPin] = useState<number | null>(null);

  useEffect(() => {
    if (!isCoachOrCaptain) return;
    api.scout.getEvents().then(async (evts: any[]) => {
      setScoutEvents(evts);
      const pins: Record<number, any> = {};
      for (const e of evts) {
        try {
          const token = await api.scout.getGuestPin(e.id, currentUserId ? parseInt(currentUserId) : 0);
          pins[e.id] = token;
        } catch {
          pins[e.id] = null;
        }
      }
      setEventPins(pins);
    }).catch(() => {});
  }, [isCoachOrCaptain]);

  const handleGeneratePin = async (eventId: number) => {
    setPinGenerating(eventId);
    try {
      const token = await api.scout.createGuestPin(eventId, 'Guest', currentUserId ? parseInt(currentUserId) : 0);
      setEventPins(p => ({ ...p, [eventId]: token }));
    } catch (err) {
      console.error('Failed to generate PIN:', err);
    } finally {
      setPinGenerating(null);
    }
  };

  const handleDeactivatePin = async (eventId: number) => {
    setPinDeactivating(eventId);
    try {
      await api.scout.deactivateGuestPin(eventId, currentUserId ? parseInt(currentUserId) : 0);
      setEventPins(p => ({ ...p, [eventId]: null }));
    } catch (err) {
      console.error('Failed to deactivate PIN:', err);
    } finally {
      setPinDeactivating(null);
    }
  };

  const handleCopyPin = (eventId: number, pin: string) => {
    navigator.clipboard.writeText(pin).then(() => {
      setCopiedPin(eventId);
      setTimeout(() => setCopiedPin(null), 2000);
    }).catch(() => {});
  };

  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  if (!isCoachOrCaptain) return <Navigate to="/" replace />;

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      const updated = await api.settings.update({
        requesterId: currentUserId ? parseInt(currentUserId) : 0,
        teamNumber: form.teamNumber,
        teamName: form.teamName,
        themeColor: form.themeColor,
        logoUrl: form.logoUrl,
        departments: form.departments,
        roles: form.roles,
      });
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveError('Save failed — please try again.');
      setTimeout(() => setSaveError(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!resetConfirm) { setResetConfirm(true); return; }
    setSaving(true);
    try {
      const updated = await api.settings.reset(currentUserId ? parseInt(currentUserId) : 0);
      setForm({ ...updated });
      setSettings(updated);
      setResetConfirm(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const fetchTbaLogo = async () => {
    setLogoLoading(true);
    setLogoMsg(null);
    try {
      const result = await api.settings.fetchTbaLogo(form.teamNumber);
      if (result.logoUrl) {
        setForm(f => ({ ...f, logoUrl: result.logoUrl }));
        setLogoMsg('Logo found! Save to apply.');
      } else {
        setLogoMsg('No avatar found for this team on TBA.');
      }
    } catch {
      setLogoMsg('Failed to fetch from TBA.');
    } finally {
      setLogoLoading(false);
    }
  };

  const addDept = () => {
    setForm(f => ({ ...f, departments: [...f.departments, { name: 'New Department', color: '#6366f1' }] }));
  };

  const updateDept = (idx: number, patch: Partial<DepartmentSetting>) => {
    setForm(f => {
      const deps = [...f.departments];
      deps[idx] = { ...deps[idx], ...patch };
      return { ...f, departments: deps };
    });
  };

  const removeDept = (idx: number) => {
    setForm(f => ({ ...f, departments: f.departments.filter((_, i) => i !== idx) }));
  };

  const addRole = () => {
    setForm(f => ({ ...f, roles: [...f.roles, { name: 'New Role', tier: 'member' }] }));
  };

  const updateRole = (idx: number, patch: Partial<RoleSetting>) => {
    setForm(f => {
      const roles = [...f.roles];
      roles[idx] = { ...roles[idx], ...patch };
      return { ...f, roles };
    });
  };

  const removeRole = (idx: number) => {
    const role = form.roles[idx];
    if (PROTECTED_ROLES.includes(role.name)) return;
    setForm(f => ({ ...f, roles: f.roles.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl" style={{ backgroundColor: form.themeColor + '20' }}>
            <Settings size={20} style={{ color: form.themeColor }} />
          </div>
          <div>
            <h1 className="font-black text-lg text-slate-900 dark:text-slate-100 uppercase tracking-tight">Control Panel</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Team configuration &amp; branding</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {saveError && (
            <span className="text-xs font-bold text-red-500 flex items-center gap-1">
              <AlertTriangle size={12} /> {saveError}
            </span>
          )}
          <button
            onClick={() => { setResetConfirm(false); handleReset(); }}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
          >
            {resetConfirm ? (
              <><AlertTriangle size={13} className="text-amber-500" /><span className="text-amber-600">Confirm Reset?</span></>
            ) : (
              <><RotateCcw size={13} /><span>Reset</span></>
            )}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
            style={{ backgroundColor: form.themeColor }}
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saveSuccess ? <Check size={13} /> : <Save size={13} />}
            {saveSuccess ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <SectionCard title="Team Identity" subtitle="How your team appears throughout the app">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Team Number</label>
              <input
                type="number"
                value={form.teamNumber}
                onChange={e => setForm(f => ({ ...f, teamNumber: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-1"
                style={{ '--tw-ring-color': form.themeColor } as React.CSSProperties & Record<string, string>}
                placeholder="10991"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Team Name</label>
              <input
                type="text"
                value={form.teamName}
                onChange={e => setForm(f => ({ ...f, teamName: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2"
                placeholder="piobyte"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Team Logo / Avatar</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-700 flex-shrink-0">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Team logo" className="w-full h-full object-contain" />
                ) : (
                  <Image size={22} className="text-slate-300 dark:text-slate-500" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <button
                  onClick={fetchTbaLogo}
                  disabled={logoLoading || !form.teamNumber}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-slate-700 dark:text-slate-300"
                >
                  {logoLoading ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />}
                  Fetch from TBA
                </button>
                {logoMsg && (
                  <p className={`text-xs font-bold ${logoMsg.startsWith('Logo found') ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>{logoMsg}</p>
                )}
                {form.logoUrl && (
                  <button
                    onClick={() => { setForm(f => ({ ...f, logoUrl: null })); setLogoMsg(null); }}
                    className="text-xs text-red-500 hover:text-red-600 font-bold flex items-center gap-1"
                  >
                    <X size={11} /> Remove logo
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Theme Color" subtitle="Primary accent color used throughout the app">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map(p => (
              <button
                key={p.color}
                onClick={() => setForm(f => ({ ...f, themeColor: p.color }))}
                title={p.label}
                className={`w-9 h-9 rounded-xl transition-all border-2 ${form.themeColor === p.color ? 'scale-110 border-slate-800 dark:border-white shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: p.color }}
              />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-600 flex-shrink-0" style={{ backgroundColor: form.themeColor }} />
            <div className="flex items-center gap-2 flex-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Custom</label>
              <input
                type="text"
                value={form.themeColor}
                onChange={e => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setForm(f => ({ ...f, themeColor: v }));
                }}
                className="flex-1 px-3 py-1.5 text-xs font-mono font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none"
                placeholder="#dc2626"
                maxLength={7}
              />
              <input
                type="color"
                value={form.themeColor}
                onChange={e => setForm(f => ({ ...f, themeColor: e.target.value }))}
                className="w-9 h-8 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-700"
                title="Color picker"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Departments" subtitle="Customize department names and colors. Renaming updates throughout the app.">
        <div className="space-y-2">
          {form.departments.map((dept, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <div className="relative group flex-shrink-0">
                <div
                  className="w-7 h-7 rounded-lg cursor-pointer border-2 border-white dark:border-slate-700 shadow-sm"
                  style={{ backgroundColor: dept.color }}
                  title="Pick color"
                />
                <div className="absolute top-8 left-0 z-10 hidden group-hover:flex flex-wrap gap-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-xl w-36">
                  {DEPT_COLOR_OPTIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => updateDept(idx, { color: c })}
                      className={`w-6 h-6 rounded-md border-2 transition-transform hover:scale-110 ${dept.color === c ? 'border-slate-800 dark:border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <input
                type="text"
                value={dept.name}
                onChange={e => updateDept(idx, { name: e.target.value })}
                className="flex-1 px-2 py-1 text-sm font-bold bg-transparent border-b border-slate-200 dark:border-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-400 text-slate-800 dark:text-slate-200"
              />
              <button
                onClick={() => removeDept(idx)}
                disabled={form.departments.length <= 1}
                className="p-1 text-slate-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            onClick={addDept}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Plus size={13} /> Add Department
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Roles" subtitle="Define roles and their permission tier. Tier controls what actions each role can perform.">
        <div className="space-y-2">
          {form.roles.map((role, idx) => {
            const isProtected = PROTECTED_ROLES.includes(role.name);
            return (
              <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <input
                  type="text"
                  value={role.name}
                  onChange={e => updateRole(idx, { name: e.target.value })}
                  disabled={isProtected}
                  className="flex-1 px-2 py-1 text-sm font-bold bg-transparent border-b border-slate-200 dark:border-slate-600 focus:outline-none focus:border-slate-400 dark:focus:border-slate-400 text-slate-800 dark:text-slate-200 disabled:opacity-60 disabled:cursor-not-allowed"
                />
                <select
                  value={role.tier}
                  onChange={e => updateRole(idx, { tier: e.target.value })}
                  className="px-2 py-1 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                >
                  <option value="leadership">Leadership</option>
                  <option value="lead">Lead</option>
                  <option value="member">Member</option>
                </select>
                {isProtected ? (
                  <span title="Required role" className="w-6 flex items-center justify-center text-slate-300 dark:text-slate-600">
                    <Settings size={13} />
                  </span>
                ) : (
                  <button
                    onClick={() => removeRole(idx)}
                    className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
          <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest px-1">
            Leadership = Coach/Captain access · Lead = Dept Head access · Member = Standard access
          </div>
          <button
            onClick={addRole}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Plus size={13} /> Add Role
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Guest Access"
        subtitle="Generate a 6-digit PIN so alliance partners can view scouting data in read-only mode"
      >
        {scoutEvents.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold">No scouting events created yet.</p>
        ) : (
          <div className="space-y-3">
            {scoutEvents.map(evt => {
              const token = eventPins[evt.id];
              return (
                <div key={evt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 dark:text-slate-100 truncate">{evt.name}</p>
                    {evt.location && <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">{evt.location}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {token ? (
                      <>
                        <span className="font-mono font-black text-xl text-teamColor tracking-[0.3em]">{token.pin}</span>
                        <button
                          onClick={() => handleCopyPin(evt.id, token.pin)}
                          className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition-all text-slate-500"
                          title="Copy PIN"
                        >
                          {copiedPin === evt.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                        <button
                          onClick={() => handleGeneratePin(evt.id)}
                          disabled={pinGenerating === evt.id}
                          className="p-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-50 transition-all text-slate-500"
                          title="Regenerate PIN"
                        >
                          <RefreshCw size={13} className={pinGenerating === evt.id ? 'animate-spin' : ''} />
                        </button>
                        <button
                          onClick={() => handleDeactivatePin(evt.id)}
                          disabled={pinDeactivating === evt.id}
                          className="p-1.5 bg-white dark:bg-slate-700 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 transition-all text-red-500"
                          title="Deactivate PIN"
                        >
                          {pinDeactivating === evt.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleGeneratePin(evt.id)}
                        disabled={pinGenerating === evt.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-teamColor text-white font-black rounded-lg text-[10px] uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {pinGenerating === evt.id ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                        Generate PIN
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold pt-1">
              Share the PIN + your hub URL with alliance partners so they can view your scouting data in read-only mode.
            </p>
          </div>
        )}
      </SectionCard>

      <div className="flex justify-end gap-2 pb-6">
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
        >
          {resetConfirm ? (
            <><AlertTriangle size={13} className="text-amber-500" /><span className="text-amber-600">Confirm Reset?</span></>
          ) : (
            <><RotateCcw size={13} />Reset to Defaults</>
          )}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 text-sm font-black text-white rounded-xl transition-all shadow-sm hover:opacity-90 disabled:opacity-60"
          style={{ backgroundColor: form.themeColor }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saveSuccess ? <Check size={14} /> : <Save size={14} />}
          {saveSuccess ? 'Saved!' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};

export default ControlPanel;
