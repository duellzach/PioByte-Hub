import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Settings, Save, RotateCcw, Loader2, Check, X, Plus, Trash2, Image, AlertTriangle, KeyRound, Copy, RefreshCw, Upload } from 'lucide-react';
import { useTeamSettings, TeamSettingsData, DEFAULT_TEAM_SETTINGS, DepartmentSetting, RoleSetting } from '../contexts/TeamSettingsContext';
import { api } from '../services/api';
import RequirementsSettings from './RequirementsSettings';

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

// Common IANA zones covering the US + a few international spots teams travel
// to for competitions. `Intl.supportedValuesOf('timeZone')` would give the
// full list, but a curated set keeps the dropdown scannable.
const COMMON_TIMEZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
  { value: 'America/Denver', label: 'Mountain Time (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain Time — no DST (Phoenix)' },
  { value: 'America/Chicago', label: 'Central Time (Chicago)' },
  { value: 'America/New_York', label: 'Eastern Time (New York)' },
  { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic Time (Puerto Rico)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Europe/London', label: 'UK Time (London)' },
];

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
  const [logoUploading, setLogoUploading] = useState(false);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [apiStatus, setApiStatus] = useState<{ tba: boolean; toa: boolean; nexus: boolean } | null>(null);

  const [apiKeyForm, setApiKeyForm] = useState({ tba: '', toa: '', nexus: '' });
  const [apiKeySaving, setApiKeySaving] = useState<Record<string, boolean>>({});
  const [apiKeySaved, setApiKeySaved] = useState<Record<string, boolean>>({});
  const [apiKeyError, setApiKeyError] = useState<Record<string, string>>({});
  const [apiKeyVisible, setApiKeyVisible] = useState<Record<string, boolean>>({});

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

  useEffect(() => {
    api.settings.getApiStatus().then(setApiStatus).catch(() => {});
  }, []);

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
        teamProgram: form.teamProgram,
        timezone: form.timezone,
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

  const fetchToaLogo = async () => {
    setLogoLoading(true);
    setLogoMsg(null);
    try {
      const result = await api.settings.fetchToaLogo(form.teamNumber);
      if (result.logoUrl) {
        setForm(f => ({ ...f, logoUrl: result.logoUrl }));
        setLogoMsg('Photo found from TOA! Save to apply.');
      } else {
        setLogoMsg('No photo found for this team on TOA.');
      }
    } catch {
      setLogoMsg('Failed to fetch from TOA.');
    } finally {
      setLogoLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setLogoMsg(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h / w) * maxDim); w = maxDim; }
          else { w = Math.round((w / h) * maxDim); h = maxDim; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        setForm(f => ({ ...f, logoUrl: canvas.toDataURL('image/png') }));
        setLogoMsg('Image uploaded! Save to apply.');
        setLogoUploading(false);
      };
      img.onerror = () => { setLogoMsg('Could not read image.'); setLogoUploading(false); };
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => { setLogoMsg('Could not read file.'); setLogoUploading(false); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSaveApiKey = async (field: 'tba' | 'toa' | 'nexus') => {
    const value = apiKeyForm[field].trim();
    setApiKeySaving(s => ({ ...s, [field]: true }));
    setApiKeyError(s => ({ ...s, [field]: '' }));
    try {
      await api.settings.saveApiKeys({
        requesterId: currentUserId ? parseInt(currentUserId) : 0,
        ...(field === 'tba'   ? { tbaApiKey:   value || null } : {}),
        ...(field === 'toa'   ? { toaApiKey:   value || null } : {}),
        ...(field === 'nexus' ? { nexusApiKey: value || null } : {}),
      });
      setApiKeySaved(s => ({ ...s, [field]: true }));
      setApiKeyForm(f => ({ ...f, [field]: '' }));
      const fresh = await api.settings.getApiStatus();
      setApiStatus(fresh);
      setTimeout(() => setApiKeySaved(s => ({ ...s, [field]: false })), 2500);
    } catch (err: any) {
      setApiKeyError(s => ({ ...s, [field]: err?.message || 'Save failed' }));
    } finally {
      setApiKeySaving(s => ({ ...s, [field]: false }));
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
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Team Program</label>
            <div className="flex gap-2">
              {(['FRC', 'FTC'] as const).map(prog => (
                <button
                  key={prog}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, teamProgram: prog }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${
                    (form.teamProgram || 'FRC') === prog
                      ? 'border-transparent text-white'
                      : 'border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700 hover:border-slate-300'
                  }`}
                  style={(form.teamProgram || 'FRC') === prog ? { backgroundColor: form.themeColor } : {}}
                >
                  {prog === 'FRC' ? 'FRC — FIRST Robotics Competition' : 'FTC — FIRST Tech Challenge'}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1.5">
              {(form.teamProgram || 'FRC') === 'FTC'
                ? 'FTC mode enables The Orange Alliance (TOA) API integration for match data and calendar imports.'
                : 'FRC mode uses The Blue Alliance (TBA) API for match data and calendar imports.'}
            </p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                <span className={`w-1.5 h-1.5 rounded-full ${apiStatus?.tba ? 'bg-green-500' : 'bg-red-400'}`} />
                <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">TBA Key</span>
                <span className={`text-[9px] font-bold ${apiStatus?.tba ? 'text-green-600' : 'text-red-500'}`}>
                  {apiStatus == null ? '…' : apiStatus.tba ? 'Active' : 'Missing'}
                </span>
              </div>
              {(form.teamProgram || 'FRC') === 'FTC' && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600">
                  <span className={`w-1.5 h-1.5 rounded-full ${apiStatus?.toa ? 'bg-green-500' : 'bg-orange-400'}`} />
                  <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest">TOA Key</span>
                  <span className={`text-[9px] font-bold ${apiStatus?.toa ? 'text-green-600' : 'text-orange-500'}`}>
                    {apiStatus == null ? '…' : apiStatus.toa ? 'Active' : 'Add in Secrets'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5">Home Timezone</label>
            <select
              value={form.timezone || 'America/Los_Angeles'}
              onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}
              className="w-full px-3 py-2 text-sm font-bold border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2"
            >
              {COMMON_TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mt-1.5">
              Used for the calendar subscription feed and for bucketing hours by day. Everyone still sees their own device time for timestamps, with the home time shown alongside when they differ.
            </p>
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
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <div className="flex flex-wrap gap-2">
                  {(form.teamProgram || 'FRC') === 'FRC' ? (
                    <button
                      onClick={fetchTbaLogo}
                      disabled={logoLoading || logoUploading || !form.teamNumber}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-slate-700 dark:text-slate-300"
                    >
                      {logoLoading ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />}
                      Fetch from TBA
                    </button>
                  ) : (
                    <button
                      onClick={fetchToaLogo}
                      disabled={logoLoading || logoUploading || !form.teamNumber}
                      className="flex items-center gap-2 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-slate-700 dark:text-slate-300"
                    >
                      {logoLoading ? <Loader2 size={13} className="animate-spin" /> : <Image size={13} />}
                      Fetch from TOA
                    </button>
                  )}
                  <button
                    onClick={() => logoFileRef.current?.click()}
                    disabled={logoLoading || logoUploading}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold border border-slate-200 dark:border-slate-600 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-slate-700 dark:text-slate-300"
                  >
                    {logoUploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Upload Image
                  </button>
                </div>
                {logoMsg && (
                  <p className={`text-xs font-bold ${logoMsg.includes('found') || logoMsg.startsWith('Image uploaded') ? 'text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400'}`}>{logoMsg}</p>
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

      <SectionCard title="Requirements" subtitle="Fundraising goal and per-category hour requirements shown on each student's home dashboard.">
        <RequirementsSettings currentUserId={currentUserId} />
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

      <SectionCard title="API Integrations" subtitle="Store your API keys here so the app can pull live match data, rankings, and schedules.">
        <div className="space-y-5">
          {([
            {
              field: 'tba' as const,
              label: 'The Blue Alliance',
              badge: 'FRC',
              badgeColor: '#2563eb',
              description: 'Match schedules, rankings, and team data for FRC events.',
              link: 'https://www.thebluealliance.com/account',
              linkLabel: 'Get key at thebluealliance.com →',
              placeholder: 'Paste your TBA Read API Key…',
              active: apiStatus?.tba,
            },
            {
              field: 'toa' as const,
              label: 'The Orange Alliance',
              badge: 'FTC',
              badgeColor: '#f97316',
              description: 'Match schedules and rankings for FTC events.',
              link: 'https://theorangealliance.org/account',
              linkLabel: 'Get key at theorangealliance.org →',
              placeholder: 'Paste your TOA API Key…',
              active: apiStatus?.toa,
            },
            {
              field: 'nexus' as const,
              label: 'FRC Nexus',
              badge: 'FRC',
              badgeColor: '#7c3aed',
              description: 'Live queue status, pit locations, and field maps during events.',
              link: 'https://frc.nexus',
              linkLabel: 'Get key at frc.nexus →',
              placeholder: 'Paste your Nexus API Key…',
              active: apiStatus?.nexus,
            },
          ]).map(({ field, label, badge, badgeColor, description, link, linkLabel, placeholder, active }) => (
            <div key={field} className="rounded-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-700/40 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-2.5">
                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black text-white uppercase tracking-widest" style={{ backgroundColor: badgeColor }}>{badge}</span>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100">{label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                  <span className={`text-[10px] font-black uppercase tracking-widest ${active ? 'text-green-600 dark:text-green-400' : 'text-slate-400 dark:text-slate-500'}`}>
                    {active ? 'Active' : 'Not set'}
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{description}</p>
                <a href={link} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-black text-teamColor hover:opacity-75 transition-opacity">
                  {linkLabel}
                </a>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={apiKeyVisible[field] ? 'text' : 'password'}
                      value={apiKeyForm[field]}
                      onChange={e => setApiKeyForm(f => ({ ...f, [field]: e.target.value }))}
                      placeholder={active ? '●●●●●●●● (saved — paste new key to replace)' : placeholder}
                      className="w-full px-3 py-2 pr-9 text-xs font-mono border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                      style={{ '--tw-ring-color': form.themeColor } as React.CSSProperties & Record<string, string>}
                      onKeyDown={e => e.key === 'Enter' && apiKeyForm[field].trim() && handleSaveApiKey(field)}
                    />
                    <button
                      type="button"
                      onClick={() => setApiKeyVisible(v => ({ ...v, [field]: !v[field] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                      tabIndex={-1}
                    >
                      <KeyRound size={13} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSaveApiKey(field)}
                    disabled={!apiKeyForm[field].trim() || apiKeySaving[field]}
                    className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black text-white rounded-xl transition-all disabled:opacity-40 shrink-0"
                    style={{ backgroundColor: form.themeColor }}
                  >
                    {apiKeySaving[field] ? <Loader2 size={11} className="animate-spin" /> : apiKeySaved[field] ? <Check size={11} /> : <Save size={11} />}
                    {apiKeySaved[field] ? 'Saved!' : 'Save'}
                  </button>
                </div>
                {apiKeyError[field] && (
                  <p className="text-[10px] font-bold text-red-500 flex items-center gap-1"><AlertTriangle size={10} />{apiKeyError[field]}</p>
                )}
                {active && (
                  <button
                    onClick={() => {
                      setApiKeyForm(f => ({ ...f, [field]: ' ' }));
                      setTimeout(() => handleSaveApiKey(field), 0);
                    }}
                    className="text-[10px] font-bold text-red-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                  >
                    <X size={10} /> Remove key
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
            Keys are stored securely server-side and never exposed to the browser. Environment secrets (if set) are used as a fallback when no key is saved here.
          </p>
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
