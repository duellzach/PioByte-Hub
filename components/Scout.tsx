import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { Plus, ArrowLeft, Search, X, Star, ChevronLeft, ChevronRight, QrCode, Camera, Download, Upload, Bot, Swords, Trophy, Hash, Users, MapPin, Calendar, Trash2, Flame, Monitor, WifiOff, Wifi, ArrowUpDown, Grid3X3, List, ImageIcon, Brain, Video, UserCheck, AlertCircle, Copy, Check, Settings, Zap } from 'lucide-react';
import pako from 'pako';
import { QRCodeSVG } from 'qrcode.react';
import { getOfflineQueue, addToOfflineQueue, syncOfflineQueue, type OfflineMatchEntry } from '../services/offlineQueue';

interface ScoutProps {
  currentUser: any;
}

const Counter: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; color?: string }> = ({ label, value, onChange, min = 0, max = 999, color = 'slate' }) => (
  <div className="flex flex-col items-center gap-2">
    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">{label}</span>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl font-black text-lg bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300 hover:bg-${color}-200 transition-all active:scale-95`}
      >−</button>
      <span className="w-10 md:w-12 text-center font-black text-lg text-slate-900 dark:text-white">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl font-black text-lg bg-${color}-100 dark:bg-${color}-900/30 text-${color}-700 dark:text-${color}-300 hover:bg-${color}-200 transition-all active:scale-95`}
      >+</button>
    </div>
  </div>
);

const StarRating: React.FC<{ value: number; onChange: (v: number) => void; max?: number; label: string }> = ({ value, onChange, max = 5, label }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="p-0.5 transition-all active:scale-90"
        >
          <Star size={20} className={i < value ? 'text-yellow-500 fill-yellow-500' : 'text-slate-200 dark:text-slate-700'} />
        </button>
      ))}
    </div>
  </div>
);

const RatingSlider: React.FC<{ value: number; onChange: (v: number) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
      <span className="text-sm font-black text-red-600">{value}/10</span>
    </div>
    <input
      type="range"
      min={1}
      max={10}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full accent-red-600"
    />
  </div>
);

const TagInput: React.FC<{ tags: string[]; onChange: (tags: string[]) => void; label: string; placeholder?: string }> = ({ tags, onChange, label, placeholder }) => {
  const [input, setInput] = useState('');
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput('');
    }
  };
  return (
    <div className="space-y-2">
      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full text-xs font-bold">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-red-900 dark:hover:text-red-100">
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || 'Type and press Enter'}
        className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm dark:text-white dark:placeholder:text-slate-400 dark:text-slate-500"
      />
    </div>
  );
};

const Scout: React.FC<ScoutProps> = ({ currentUser }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'robots' | 'matches' | 'qr' | 'display'>('robots');
  const [pitScouts, setPitScouts] = useState<any[]>([]);
  const [matchScoutsData, setMatchScoutsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPitForm, setShowPitForm] = useState(false);
  const [showMatchForm, setShowMatchForm] = useState(false);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingPit, setEditingPit] = useState<any | null>(null);
  const [editingMatch, setEditingMatch] = useState<any | null>(null);
  const [selectedRobot, setSelectedRobot] = useState<any | null>(null);
  const [eventCounts, setEventCounts] = useState<Record<number, { pits: number; matches: number }>>({});

  const [eventForm, setEventForm] = useState({ name: '', location: '', startDate: '', endDate: '', tbaEventKey: '', nexusEventKey: '' });
  const [tbaMatches, setTbaMatches] = useState<any[]>([]);
  const [tbaRecord, setTbaRecord] = useState<{ wins: number; losses: number; ties: number } | null>(null);
  const [tbaLoading, setTbaLoading] = useState(false);
  const [tbaImporting, setTbaImporting] = useState(false);
  const [tbaRankings, setTbaRankings] = useState<Map<number, { rank: number; rp: number; record: string }>>(new Map());

  const [pitForm, setPitForm] = useState({
    teamNumber: 0, teamName: '', robotName: '', drivetrain: '', weight: 0, speed: 0, height: 0,
    fuelCapacity: 0, traversalAbility: '', shooterType: '',
    capabilities: [] as string[], deficiencies: [] as string[],
    autonomousRoutine: 'None', autoOptions: [] as string[],
    notes: '', offenseRating: 5, defenseRating: 5, overallRating: 5, photoUrl: ''
  });

  const [matchForm, setMatchForm] = useState({
    matchNumber: 1, matchType: 'qualification', teamNumber: 0, alliance: 'Red',
    penalties: 0, autoClimb: false, endClimbLevel: 0, coralScored: 0, algaeScored: 0,
    autoFuelTotal: 0, teleopFuelTotal: 0,
    defenseRating: 3, drivingSkillRating: 3, coreValuesRating: 3,
    autoUsed: '', notes: ''
  });

  const [matchClaims, setMatchClaims] = useState<Record<string, { userId: number; userName: string }>>(() => {
    try { return JSON.parse(localStorage.getItem(`piobyte_claims`) || '{}'); } catch { return {}; }
  });
  const [geminiModal, setGeminiModal] = useState<{ open: boolean; text: string; matchLabel: string }>({ open: false, text: '', matchLabel: '' });
  const [copiedGemini, setCopiedGemini] = useState(false);

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());
  const [selectedRobotIds, setSelectedRobotIds] = useState<Set<number>>(new Set());
  const [robotSort, setRobotSort] = useState<'number' | 'name'>('number');
  const [matchViewMode, setMatchViewMode] = useState<'list' | 'roster'>('list');

  const [tbaYearEvents, setTbaYearEvents] = useState<any[]>([]);
  const [tbaYearStatuses, setTbaYearStatuses] = useState<Record<string, any>>({});
  const [tbaYearLoading, setTbaYearLoading] = useState(false);
  const [crossEventMatches, setCrossEventMatches] = useState<any[]>([]);

  const [qrData, setQrData] = useState<string[]>([]);
  const [qrChunkIndex, setQrChunkIndex] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<Map<string, string>>(new Map());
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

  const [offlineQueue, setOfflineQueue] = useState<OfflineMatchEntry[]>(getOfflineQueue());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const [nexusData, setNexusData] = useState<any | null>(null);
  const [nexusLoading, setNexusLoading] = useState(false);
  const [nexusError, setNexusError] = useState<string | null>(null);
  const [nexusCountdown, setNexusCountdown] = useState<string>('');
  const nexusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nexusCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showEventSettings, setShowEventSettings] = useState(false);
  const [eventSettingsForm, setEventSettingsForm] = useState({ tbaEventKey: '', nexusEventKey: '' });
  const [nexusTestStatus, setNexusTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [nexusTestMsg, setNexusTestMsg] = useState('');

  const [dismissedBreaks, setDismissedBreaks] = useState<Set<string>>(new Set());
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [dismissedParts, setDismissedParts] = useState<Set<string>>(new Set());

  const fetchNexusData = useCallback(async (eventKey: string) => {
    if (!eventKey) return;
    setNexusLoading(true);
    setNexusError(null);
    try {
      const data = await api.nexus.getEvent(eventKey);
      setNexusData(data);
    } catch (err: any) {
      setNexusError(err?.message || 'Failed to load Nexus data');
      setNexusData(null);
    } finally {
      setNexusLoading(false);
    }
  }, []);

  useEffect(() => {
    if (nexusPollRef.current) clearInterval(nexusPollRef.current);
    if (nexusCountdownRef.current) clearInterval(nexusCountdownRef.current);
    setNexusData(null);
    setNexusError(null);
    setNexusCountdown('');

    const key = activeEvent?.nexusEventKey;
    if (!key || activeTab !== 'display') return;

    fetchNexusData(key);
    nexusPollRef.current = setInterval(() => fetchNexusData(key), 30000);

    return () => {
      if (nexusPollRef.current) clearInterval(nexusPollRef.current);
    };
  }, [activeEvent, activeTab, fetchNexusData]);

  useEffect(() => {
    if (nexusCountdownRef.current) clearInterval(nexusCountdownRef.current);
    if (!nexusData?.matches) return;

    const isOurMatch = (m: any) =>
      (m.redTeams || []).includes(10991) || (m.blueTeams || []).includes(10991);

    const getNextQueueTime = () => {
      const ourActive = nexusData.matches.find(
        (m: any) => isOurMatch(m) && m.times?.estimatedQueueTime && (
          m.status === 'Queuing soon' || m.status === 'Now queuing' || m.status === 'On deck' || m.status === 'On field'
        )
      );
      return ourActive?.times?.estimatedQueueTime ?? null;
    };

    const tick = () => {
      const t = getNextQueueTime();
      if (!t) { setNexusCountdown(''); return; }
      const diff = Math.max(0, Math.floor((new Date(t).getTime() - Date.now()) / 1000));
      if (diff === 0) { setNexusCountdown('Queue now!'); return; }
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setNexusCountdown(`${m}:${s.toString().padStart(2, '0')}`);
    };
    tick();
    nexusCountdownRef.current = setInterval(tick, 1000);
    return () => { if (nexusCountdownRef.current) clearInterval(nexusCountdownRef.current); };
  }, [nexusData]);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      handleSync();
    };
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleSync = async () => {
    const queue = getOfflineQueue();
    if (queue.length === 0) return;
    try {
      const result = await syncOfflineQueue(async (eventId, data) => {
        await api.scout.createMatchScout(eventId, data);
      });
      setOfflineQueue(getOfflineQueue());
      if (result.synced > 0) {
        setSyncMessage(`Synced ${result.synced} offline match${result.synced !== 1 ? 'es' : ''}`);
        setTimeout(() => setSyncMessage(null), 4000);
        if (activeEvent) fetchEventData(activeEvent.id);
      }
    } catch {}
  };

  const isCoachOrCaptain = currentUser?.roles?.some((r: string) =>
    r === 'Coach' || r === 'Team Captain'
  );

  const fetchEvents = useCallback(async () => {
    try {
      const data = await api.scout.getEvents();
      setEvents(data);
      const counts: Record<number, { pits: number; matches: number }> = {};
      for (const evt of data) {
        try {
          const [pits, matches] = await Promise.all([
            api.scout.getPitScouts(evt.id),
            api.scout.getMatchScouts(evt.id),
          ]);
          counts[evt.id] = { pits: pits.length, matches: matches.length };
        } catch {
          counts[evt.id] = { pits: 0, matches: 0 };
        }
      }
      setEventCounts(counts);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const fetchEventData = useCallback(async (eventId: number) => {
    setLoading(true);
    try {
      const [pits, matches] = await Promise.all([
        api.scout.getPitScouts(eventId),
        api.scout.getMatchScouts(eventId),
      ]);
      setPitScouts(pits);
      setMatchScoutsData(matches);
    } catch (err) {
      console.error('Failed to fetch event data:', err);
    }
    setLoading(false);
  }, []);

  const fetchTbaData = useCallback(async (tbaEventKey: string) => {
    if (!tbaEventKey) return;
    setTbaLoading(true);
    try {
      const [allMatches, teamMatches, rankingsData] = await Promise.all([
        api.tba.getEventMatches(tbaEventKey),
        api.tba.getTeamMatches('frc10991', tbaEventKey),
        api.tba.getEventRankings(tbaEventKey).catch(() => null),
      ]);
      setTbaMatches(allMatches || []);
      if (rankingsData?.rankings) {
        const map = new Map<number, { rank: number; rp: number; record: string }>();
        for (const r of rankingsData.rankings) {
          const teamNum = parseInt(r.team_key?.replace('frc', '') || '0');
          if (teamNum) {
            map.set(teamNum, {
              rank: r.rank,
              rp: r.sort_orders?.[0] || 0,
              record: `${r.record?.wins || 0}-${r.record?.losses || 0}-${r.record?.ties || 0}`,
            });
          }
        }
        setTbaRankings(map);
      }
      if (teamMatches && teamMatches.length > 0) {
        let wins = 0, losses = 0, ties = 0;
        for (const m of teamMatches) {
          if (m.winning_alliance === undefined || m.winning_alliance === null) continue;
          if (m.alliances?.red?.score === -1 && m.alliances?.blue?.score === -1) continue;
          const isRed = m.alliances?.red?.team_keys?.includes('frc10991');
          const isBlue = m.alliances?.blue?.team_keys?.includes('frc10991');
          const ourAlliance = isRed ? 'red' : isBlue ? 'blue' : null;
          if (!ourAlliance) continue;
          if (m.winning_alliance === '') { ties++; }
          else if (m.winning_alliance === ourAlliance) { wins++; }
          else { losses++; }
        }
        setTbaRecord({ wins, losses, ties });
      } else {
        setTbaRecord(null);
      }
    } catch (err) {
      console.error('Failed to fetch TBA data:', err);
      setTbaMatches([]);
      setTbaRecord(null);
    }
    setTbaLoading(false);
  }, []);

  const importTeamsFromTba = async () => {
    if (!activeEvent?.tbaEventKey) return;
    setTbaImporting(true);
    try {
      const teams = await api.tba.getEventTeams(activeEvent.tbaEventKey);
      if (!teams || teams.length === 0) {
        alert('No teams found for this event on The Blue Alliance.');
        setTbaImporting(false);
        return;
      }
      const existingNumbers = new Set(pitScouts.map((ps: any) => ps.teamNumber));
      const newTeams = teams.filter((t: any) => !existingNumbers.has(t.team_number));
      if (newTeams.length === 0) {
        alert(`All ${teams.length} teams from this event are already in your scouting list.`);
        setTbaImporting(false);
        return;
      }
      let imported = 0;
      for (const team of newTeams) {
        try {
          await api.scout.createPitScout(activeEvent.id, {
            teamNumber: team.team_number,
            teamName: team.nickname || team.name || `Team ${team.team_number}`,
            robotName: '',
            drivetrain: '',
            weight: 0,
            speed: 0,
            height: 0,
            capabilities: [],
            deficiencies: [],
            autonomousRoutine: 'None',
            notes: team.city && team.state_prov ? `From ${team.city}, ${team.state_prov}` : '',
            offenseRating: 5,
            defenseRating: 5,
            overallRating: 5,
            scoutedBy: parseInt(currentUser.id),
          });
          imported++;
        } catch (err) {
          console.error(`Failed to import team ${team.team_number}:`, err);
        }
      }
      const failed = newTeams.length - imported;
      let msg = `Imported ${imported} new teams!`;
      if (existingNumbers.size > 0) msg += ` (${existingNumbers.size} already existed)`;
      if (failed > 0) msg += ` (${failed} failed to import)`;
      msg += ' You can now edit their robot details.';
      alert(msg);
      fetchEventData(activeEvent.id);
    } catch (err) {
      console.error('TBA team import failed:', err);
      alert('Failed to import teams from The Blue Alliance. Check the event key and try again.');
    }
    setTbaImporting(false);
  };

  const openRobotByNumber = (teamNumber: number) => {
    const robot = pitScouts.find((ps: any) => ps.teamNumber === teamNumber);
    if (robot) {
      setSelectedRobot(robot);
    }
  };

  const enterEvent = (event: any) => {
    setActiveEvent(event);
    setActiveTab('robots');
    fetchEventData(event.id);
    if (event.tbaEventKey) fetchTbaData(event.tbaEventKey);
  };

  const handleCreateEvent = async () => {
    if (!eventForm.name.trim()) return;
    try {
      await api.scout.createEvent({
        ...eventForm,
        createdBy: parseInt(currentUser.id),
      });
      setShowEventForm(false);
      setEventForm({ name: '', location: '', startDate: '', endDate: '', tbaEventKey: '', nexusEventKey: '' });
      fetchEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  const openEventSettings = () => {
    setEventSettingsForm({
      tbaEventKey: activeEvent?.tbaEventKey || '',
      nexusEventKey: activeEvent?.nexusEventKey || '',
    });
    setNexusTestStatus('idle');
    setNexusTestMsg('');
    setShowEventSettings(true);
  };

  const handleSaveEventSettings = async () => {
    if (!activeEvent) return;
    try {
      const updated = await api.scout.updateEvent(activeEvent.id, eventSettingsForm);
      setActiveEvent({ ...activeEvent, ...eventSettingsForm });
      setShowEventSettings(false);
      if (updated?.tbaEventKey) fetchTbaData(updated.tbaEventKey);
    } catch (err) {
      console.error('Failed to update event settings:', err);
    }
  };

  const handleTestNexus = async () => {
    const key = eventSettingsForm.nexusEventKey.trim();
    if (!key) { setNexusTestStatus('error'); setNexusTestMsg('Enter a Nexus event key first'); return; }
    setNexusTestStatus('testing');
    setNexusTestMsg('');
    try {
      await api.nexus.getEvent(key);
      setNexusTestStatus('ok');
      setNexusTestMsg('Connected successfully!');
    } catch (err: any) {
      setNexusTestStatus('error');
      setNexusTestMsg(err?.message || 'Connection failed');
    }
  };

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('Delete this event and all its scouting data?')) return;
    try {
      await api.scout.deleteEvent(id);
      fetchEvents();
    } catch (err) {
      console.error('Failed to delete event:', err);
    }
  };

  const handleSavePitScout = async () => {
    if (!pitForm.teamNumber || !activeEvent) return;
    try {
      const data = { ...pitForm, scoutedBy: parseInt(currentUser.id) };
      if (editingPit) {
        await api.scout.updatePitScout(editingPit.id, data);
      } else {
        await api.scout.createPitScout(activeEvent.id, data);
      }
      setShowPitForm(false);
      setEditingPit(null);
      resetPitForm();
      fetchEventData(activeEvent.id);
    } catch (err) {
      console.error('Failed to save pit scout:', err);
    }
  };

  const handleDeletePitScout = async (id: number) => {
    if (!confirm('Delete this robot scouting data?')) return;
    try {
      await api.scout.deletePitScout(id);
      setSelectedRobot(null);
      if (activeEvent) fetchEventData(activeEvent.id);
    } catch (err) {
      console.error('Failed to delete pit scout:', err);
    }
  };

  const handleSaveMatchScout = async () => {
    if (!matchForm.teamNumber || !activeEvent) return;
    const data = { ...matchForm, scoutedBy: parseInt(currentUser.id) };
    if (editingMatch) {
      try {
        await api.scout.updateMatchScout(editingMatch.id, data);
        setShowMatchForm(false);
        setEditingMatch(null);
        resetMatchForm();
        fetchEventData(activeEvent.id);
      } catch (err) {
        console.error('Failed to update match scout:', err);
      }
      return;
    }
    try {
      await api.scout.createMatchScout(activeEvent.id, data);
      setShowMatchForm(false);
      resetMatchForm();
      fetchEventData(activeEvent.id);
    } catch (err) {
      addToOfflineQueue({ eventId: activeEvent.id, data });
      setOfflineQueue(getOfflineQueue());
      setSyncMessage('Saved offline — will sync when connected');
      setTimeout(() => setSyncMessage(null), 4000);
      setShowMatchForm(false);
      resetMatchForm();
    }
  };

  const handleDeleteMatchScout = async (id: number) => {
    if (!confirm('Delete this match record?')) return;
    try {
      await api.scout.deleteMatchScout(id);
      if (activeEvent) fetchEventData(activeEvent.id);
    } catch (err) {
      console.error('Failed to delete match scout:', err);
    }
  };

  const resetPitForm = () => {
    setPitForm({
      teamNumber: 0, teamName: '', robotName: '', drivetrain: '', weight: 0, speed: 0, height: 0,
      fuelCapacity: 0, traversalAbility: '', shooterType: '',
      capabilities: [], deficiencies: [], autonomousRoutine: 'None', autoOptions: [],
      notes: '', offenseRating: 5, defenseRating: 5, overallRating: 5, photoUrl: ''
    });
  };

  const resetMatchForm = () => {
    setMatchForm({
      matchNumber: 0, matchType: 'qualification', teamNumber: 0, alliance: 'Red',
      penalties: 0, autoClimb: false, endClimbLevel: 0, coralScored: 3, algaeScored: 0,
      autoFuelTotal: 0, teleopFuelTotal: 0,
      defenseRating: 3, drivingSkillRating: 3, coreValuesRating: 3,
      autoUsed: '', notes: ''
    });
  };

  const openEditPit = (pit: any) => {
    setSelectedRobot(null);
    setEditingPit(pit);
    setPitForm({
      teamNumber: pit.teamNumber, teamName: pit.teamName, robotName: pit.robotName,
      drivetrain: pit.drivetrain, weight: pit.weight || 0, speed: pit.speed || 0, height: pit.height || 0,
      fuelCapacity: pit.fuelCapacity || 0, traversalAbility: pit.traversalAbility || '',
      shooterType: pit.shooterType || '',
      capabilities: pit.capabilities || [], deficiencies: pit.deficiencies || [],
      autonomousRoutine: pit.autonomousRoutine || 'None', autoOptions: pit.autoOptions || [],
      notes: pit.notes || '',
      offenseRating: pit.offenseRating, defenseRating: pit.defenseRating, overallRating: pit.overallRating,
      photoUrl: pit.photoUrl || ''
    });
    setShowPitForm(true);
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let w = img.width, h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = (h / w) * maxDim; w = maxDim; }
            else { w = (w / h) * maxDim; h = maxDim; }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const openEditMatch = (match: any) => {
    setEditingMatch(match);
    setMatchForm({
      matchNumber: match.matchNumber, matchType: match.matchType || 'qualification',
      teamNumber: match.teamNumber, alliance: match.alliance,
      penalties: match.penalties, autoClimb: match.autoClimb, endClimbLevel: match.endClimbLevel,
      coralScored: match.coralScored, algaeScored: match.algaeScored,
      autoFuelTotal: match.autoFuelTotal || 0, teleopFuelTotal: match.teleopFuelTotal || 0,
      defenseRating: match.defenseRating || 3, drivingSkillRating: match.drivingSkillRating || 3,
      coreValuesRating: match.coreValuesRating || 3,
      autoUsed: match.autoUsed || '', notes: match.notes
    });
    setShowMatchForm(true);
  };

  const claimMatch = (matchKey: string) => {
    const updated = { ...matchClaims, [matchKey]: { userId: parseInt(currentUser.id), userName: currentUser.name || currentUser.username } };
    setMatchClaims(updated);
    localStorage.setItem('piobyte_claims', JSON.stringify(updated));
  };

  const unclaimMatch = (matchKey: string) => {
    const updated = { ...matchClaims };
    delete updated[matchKey];
    setMatchClaims(updated);
    localStorage.setItem('piobyte_claims', JSON.stringify(updated));
  };

  const generateGeminiReport = (tbaMatch: any) => {
    const getLabel = (m: any) => {
      const c = m.comp_level || 'qm', n = m.match_number || 0, s = m.set_number || 0;
      if (c === 'qm') return `Qualification ${n}`;
      if (c === 'qf') return `Quarterfinal ${s}-${n}`;
      if (c === 'sf') return `Semifinal ${s}-${n}`;
      if (c === 'f') return `Final ${n}`;
      return `Match ${n}`;
    };
    const label = getLabel(tbaMatch);
    const allTeamKeys = [...(tbaMatch.alliances?.red?.team_keys || []), ...(tbaMatch.alliances?.blue?.team_keys || [])];
    let report = `# FRC Match Analysis Request: ${label}\nEvent: ${activeEvent?.name}\n\n`;
    report += `**Red Alliance:** ${(tbaMatch.alliances?.red?.team_keys || []).map((k: string) => k.replace('frc', '')).join(', ')}\n`;
    report += `**Blue Alliance:** ${(tbaMatch.alliances?.blue?.team_keys || []).map((k: string) => k.replace('frc', '')).join(', ')}\n\n`;
    report += `## Scouted Team Data\n\n`;
    for (const teamKey of allTeamKeys) {
      const teamNum = parseInt(teamKey.replace('frc', ''));
      const isRed = tbaMatch.alliances?.red?.team_keys?.includes(teamKey);
      const pit = pitScouts.find((p: any) => p.teamNumber === teamNum);
      const teamMatches = matchScoutsData.filter((m: any) => m.teamNumber === teamNum);
      report += `### Team ${teamNum}${pit ? ` — ${pit.teamName}` : ''} (${isRed ? 'RED' : 'BLUE'})\n`;
      if (pit) {
        report += `Robot: ${pit.robotName || '—'} | Drivetrain: ${pit.drivetrain || '—'} | Shooter: ${pit.shooterType || '—'} | Fuel Capacity: ${pit.fuelCapacity || '—'} | Traversal: ${pit.traversalAbility || '—'}\n`;
        report += `Auto Options: ${pit.autoOptions?.length > 0 ? pit.autoOptions.join(', ') : 'None'}\n`;
        report += `Ratings: Offense ${pit.offenseRating}/10, Defense ${pit.defenseRating}/10, Overall ${pit.overallRating}/10\n`;
        if (pit.capabilities?.length > 0) report += `Capabilities: ${pit.capabilities.join(', ')}\n`;
        if (pit.deficiencies?.length > 0) report += `Weaknesses: ${pit.deficiencies.join(', ')}\n`;
        if (pit.notes) report += `Notes: ${pit.notes}\n`;
      } else { report += `No pit scout data.\n`; }
      if (teamMatches.length > 0) {
        const avg = (field: string) => (teamMatches.reduce((s: number, m: any) => s + (m[field] || 0), 0) / teamMatches.length).toFixed(1);
        report += `Match Performance (${teamMatches.length} matches): Avg Auto Fuel: ${avg('autoFuelTotal')}, Avg Teleop Fuel: ${avg('teleopFuelTotal')}, Avg Accuracy: ${avg('coralScored')}/5, Climb Rate: ${((teamMatches.filter((m: any) => m.endClimbLevel > 0).length / teamMatches.length) * 100).toFixed(0)}%\n`;
        report += `Driving Skill: ${avg('drivingSkillRating')}/5, FIRST Core Values: ${avg('coreValuesRating')}/5\n`;
        for (const m of teamMatches.slice(-3).sort((a: any, b: any) => a.matchNumber - b.matchNumber)) {
          report += `  M${m.matchNumber} (${m.alliance}): Auto: ${m.autoFuelTotal || 0}, Teleop: ${m.teleopFuelTotal || 0}, Accuracy: ${m.coralScored || '?'}/5, Climb L${m.endClimbLevel}${m.notes ? `, "${m.notes}"` : ''}\n`;
        }
      } else { report += `No match data.\n`; }
      const r = tbaRankings.get(teamNum);
      if (r) report += `TBA Rank: #${r.rank} | Record: ${r.record} | RP: ${r.rp.toFixed(2)}\n`;
      report += '\n';
    }
    report += `---\nPlease analyze this match data and provide strategic recommendations for match strategy and alliance performance.`;
    setGeminiModal({ open: true, text: report, matchLabel: label });
  };

  const generateRobotAIReport = () => {
    if (!selectedRobot) return;
    const r = selectedRobot;
    let report = `# Team ${r.teamNumber} — ${r.teamName || 'Unknown Team'}\n`;
    report += `Robot: ${r.robotName || '—'}\n\n`;

    report += `## Pit Scout Data\n`;
    report += `Drivetrain: ${r.drivetrain || '—'}\n`;
    report += `Weight: ${r.weight ? `${r.weight} lbs` : '—'} | Speed: ${r.speed ? `${r.speed} ft/s` : '—'} | Height: ${r.height ? `${r.height}"` : '—'}\n`;
    report += `Shooter Type: ${r.shooterType || '—'}\n`;
    report += `Fuel Capacity: ${r.fuelCapacity > 0 ? `${r.fuelCapacity} cells` : '—'}\n`;
    report += `Field Traversal: ${r.traversalAbility || '—'}\n`;
    report += `Auto Routines: ${r.autoOptions?.length > 0 ? r.autoOptions.join(', ') : 'None'}\n`;
    report += `Ratings: Offense ${r.offenseRating}/10, Defense ${r.defenseRating}/10, Overall ${r.overallRating}/10\n`;
    report += `Capabilities: ${r.capabilities?.length > 0 ? r.capabilities.join(', ') : 'None'}\n`;
    report += `Weaknesses: ${r.deficiencies?.length > 0 ? r.deficiencies.join(', ') : 'None'}\n`;
    report += `Notes: ${r.notes || '—'}\n`;
    report += '\n';

    const currentEventName = activeEvent?.name || 'Current Event';
    const currentMatches = robotMatches;
    const otherEventMatches = crossEventMatches.filter((m: any) => m.eventId !== activeEvent?.id);
    const otherGrouped = new Map<string, any[]>();
    for (const m of otherEventMatches) {
      const key = m.eventName || `Event ${m.eventId}`;
      if (!otherGrouped.has(key)) otherGrouped.set(key, []);
      otherGrouped.get(key)!.push(m);
    }

    const formatMatchBlock = (matches: any[], eventLabel: string) => {
      let block = `## Match History — ${eventLabel} (${matches.length} matches)\n`;
      if (matches.length > 0) {
        const avg = (field: string) => (matches.reduce((s: number, m: any) => s + (m[field] || 0), 0) / matches.length).toFixed(1);
        block += `Averages: Auto Fuel: ${avg('autoFuelTotal')}, Teleop Fuel: ${avg('teleopFuelTotal')}, Accuracy: ${avg('coralScored')}/5, Climb Rate: ${((matches.filter((m: any) => m.endClimbLevel > 0).length / matches.length) * 100).toFixed(0)}%\n`;
        block += `Driving Skill: ${avg('drivingSkillRating')}/5, FIRST Core Values: ${avg('coreValuesRating')}/5, Avg Penalties: ${avg('penalties')}\n`;
        for (const m of [...matches].sort((a: any, b: any) => a.matchNumber - b.matchNumber)) {
          block += `  M${m.matchNumber} [${m.matchType || 'qualification'}] (${m.alliance}): Auto: ${m.autoFuelTotal || 0}, Teleop: ${m.teleopFuelTotal || 0}, Accuracy: ${m.coralScored || '?'}/5, Climb L${m.endClimbLevel || 0}, Drive: ${m.drivingSkillRating || '?'}/5${m.autoUsed ? `, Auto Used: "${m.autoUsed}"` : ''}${m.notes ? `, Notes: "${m.notes}"` : ''}\n`;
        }
      }
      return block + '\n';
    };

    report += formatMatchBlock(currentMatches, currentEventName);

    for (const [eventName, matches] of otherGrouped) {
      report += formatMatchBlock(matches, eventName);
    }

    if (tbaYearEvents.length > 0) {
      report += `## TBA Season Events (${new Date().getFullYear()})\n`;
      for (const evt of tbaYearEvents.filter((e: any) => e.event_type_string !== 'Offseason').sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))) {
        const status = tbaYearStatuses[`frc${r.teamNumber}`] || tbaYearStatuses[evt.key];
        const rank = status?.qual?.ranking?.rank;
        const record = status?.qual?.ranking?.record;
        report += `  ${evt.name} (${evt.start_date || '?'})`;
        if (rank) report += ` — Rank #${rank}`;
        if (record) report += `, ${record.wins}-${record.losses}-${record.ties}`;
        report += '\n';
      }
      report += '\n';
    }

    report += `---\nPlease analyze this team's scouting data and provide strategic insights: strengths, weaknesses, ideal match roles, and how to best compete against or alongside them.`;
    setGeminiModal({ open: true, text: report, matchLabel: `Team ${r.teamNumber} Scouting Report` });
  };

  const generateQR = async () => {
    if (!activeEvent) return;
    try {
      const allMatches = matchScoutsData;
      const filteredMatches = selectedMatchIds.size > 0
        ? allMatches.filter((m: any) => selectedMatchIds.has(m.id))
        : allMatches;
      const slimMatches = filteredMatches.map((m: any) => ({
        mn: m.matchNumber,
        tn: m.teamNumber,
        al: m.alliance === 'Red' ? 'R' : 'B',
        as: m.autoScore,
        ts: m.teleopScore,
        es: m.endgameScore,
        p: m.penalties,
        ac: m.autoClimb ? 1 : 0,
        ec: m.endClimbLevel,
        cs: m.coralScored,
        ag: m.algaeScored,
        hp: m.humanPlayerScore,
        dr: m.defenseRating,
        n: m.notes || '',
      }));
      const filteredRobots = selectedRobotIds.size > 0
        ? pitScouts.filter((r: any) => selectedRobotIds.has(r.id))
        : [];
      const slimRobots = filteredRobots.map((r: any) => ({
        tn: r.teamNumber,
        tna: r.teamName || '',
        rn: r.robotName || '',
        dt: r.drivetrain || '',
        w: r.weight || 0,
        sp: r.speed || 0,
        h: r.height || 0,
        cap: r.capabilities || [],
        def: r.deficiencies || [],
        ar: r.autonomousRoutine || '',
        n: r.notes || '',
        or: r.offenseRating || 5,
        dr: r.defenseRating || 5,
        ovr: r.overallRating || 5,
      }));
      const payload: any = { v: 3, m: slimMatches };
      if (slimRobots.length > 0) payload.r = slimRobots;
      const jsonStr = JSON.stringify(payload);
      const compressed = pako.deflate(new TextEncoder().encode(jsonStr));
      const base64 = btoa(String.fromCharCode(...compressed));
      const maxChunkSize = 2000;
      if (base64.length <= maxChunkSize) {
        setQrData([`1/1|${base64}`]);
      } else {
        const totalChunks = Math.ceil(base64.length / maxChunkSize);
        const chunks: string[] = [];
        for (let i = 0; i < totalChunks; i++) {
          const chunk = base64.slice(i * maxChunkSize, (i + 1) * maxChunkSize);
          chunks.push(`${i + 1}/${totalChunks}|${chunk}`);
        }
        setQrData(chunks);
      }
      setQrChunkIndex(0);
    } catch (err) {
      console.error('Failed to generate QR:', err);
    }
  };

  const startScanner = async () => {
    setScanning(true);
    setScannedChunks(new Map());
    setImportPreview(null);
    setTimeout(async () => {
      const container = document.getElementById('qr-scanner-container');
      if (container) {
        try {
          const { Html5Qrcode } = await import('html5-qrcode');
          if (scannerRef.current) {
            try { await scannerRef.current.stop(); } catch {}
            scannerRef.current = null;
          }
          const scanner = new Html5Qrcode("qr-scanner-container");
          scannerRef.current = scanner;
          await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            (decodedText: string) => {
              handleQRScanned(decodedText);
            },
            () => {}
          );
        } catch (err: any) {
          console.error('Scanner error:', err);
          if (err?.toString?.().includes('NotAllowedError') || err?.toString?.().includes('NotFoundError')) {
            alert('Camera access denied or no camera found. Please allow camera permissions and try again.');
          }
          setScanning(false);
        }
      }
    }, 300);
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const expandSlimMatch = (m: any) => ({
    matchNumber: m.mn,
    teamNumber: m.tn,
    alliance: m.al === 'R' ? 'Red' : 'Blue',
    autoScore: m.as || 0,
    teleopScore: m.ts || 0,
    endgameScore: m.es || 0,
    penalties: m.p || 0,
    autoClimb: !!m.ac,
    endClimbLevel: m.ec || 0,
    coralScored: m.cs || 0,
    algaeScored: m.ag || 0,
    humanPlayerScore: m.hp || 0,
    defenseRating: m.dr || 3,
    notes: m.n || '',
  });

  const expandSlimRobot = (r: any) => ({
    teamNumber: r.tn,
    teamName: r.tna || '',
    robotName: r.rn || '',
    drivetrain: r.dt || '',
    weight: r.w || 0,
    speed: r.sp || 0,
    height: r.h || 0,
    capabilities: r.cap || [],
    deficiencies: r.def || [],
    autonomousRoutine: r.ar || '',
    notes: r.n || '',
    offenseRating: r.or || 5,
    defenseRating: r.dr || 5,
    overallRating: r.ovr || 5,
  });

  const handleQRScanned = (text: string) => {
    const pipeIndex = text.indexOf('|');
    if (pipeIndex === -1) return;
    const header = text.substring(0, pipeIndex);
    const data = text.substring(pipeIndex + 1);
    setScannedChunks(prev => {
      const next = new Map(prev);
      next.set(header, data);
      const [, total] = header.split('/');
      const totalNum = parseInt(total);
      if (next.size === totalNum) {
        const sorted: string[] = [];
        for (let i = 1; i <= totalNum; i++) {
          sorted.push((next.get(`${i}/${totalNum}`) as string) || '');
        }
        const fullBase64 = sorted.join('');
        try {
          const binary = atob(fullBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const decompressed = pako.inflate(bytes);
          const jsonStr = new TextDecoder().decode(decompressed);
          const parsed = JSON.parse(jsonStr);
          let matchScouts: any[];
          let pitScoutsImport: any[] = [];
          if ((parsed.v === 2 || parsed.v === 3) && Array.isArray(parsed.m)) {
            matchScouts = parsed.m.map(expandSlimMatch);
            if (parsed.v === 3 && Array.isArray(parsed.r)) {
              pitScoutsImport = parsed.r.map(expandSlimRobot);
            }
          } else if (Array.isArray(parsed)) {
            matchScouts = parsed.map(expandSlimMatch);
          } else if (parsed.matchScouts) {
            matchScouts = parsed.matchScouts;
          } else {
            matchScouts = [];
          }
          setImportPreview({ matchScouts, pitScouts: pitScoutsImport });
          stopScanner();
        } catch (err) {
          console.error('Failed to decode QR data:', err);
        }
      }
      return next;
    });
  };

  const [importResult, setImportResult] = useState<{ imported: number; skipped: number; robotsImported?: number; robotsSkipped?: number } | null>(null);

  const confirmImport = async () => {
    if (!importPreview || !activeEvent) return;
    try {
      const matchesWithScout = (importPreview.matchScouts || []).map((m: any) => ({
        ...m,
        scoutedBy: m.scoutedBy || parseInt(currentUser.id),
      }));
      const robotsData = (importPreview.pitScouts || []).map((r: any) => ({
        ...r,
        scoutedBy: parseInt(currentUser.id),
      }));
      const result = await api.scout.importEvent(activeEvent.id, { matchScouts: matchesWithScout, pitScouts: robotsData });
      setImportResult({
        imported: result.imported || 0,
        skipped: result.skipped || 0,
        robotsImported: result.robotsImported || 0,
        robotsSkipped: result.robotsSkipped || 0,
      });
      setImportPreview(null);
      setScannedChunks(new Map());
      fetchEventData(activeEvent.id);
    } catch (err) {
      console.error('Import failed:', err);
    }
  };

  const filteredPitScouts = pitScouts.filter(ps =>
    !searchTerm ||
    ps.teamNumber.toString().includes(searchTerm) ||
    ps.teamName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ps.robotName?.toLowerCase().includes(searchTerm.toLowerCase())
  ).sort((a, b) => {
    if (robotSort === 'name') {
      return (a.teamName || '').localeCompare(b.teamName || '');
    }
    return a.teamNumber - b.teamNumber;
  });

  const sortedMatches = [...matchScoutsData].sort((a, b) => a.matchNumber - b.matchNumber);

  const matchRosters = useMemo(() => {
    const grouped = new Map<number, any[]>();
    for (const m of matchScoutsData) {
      const arr = grouped.get(m.matchNumber) || [];
      arr.push(m);
      grouped.set(m.matchNumber, arr);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([matchNumber, entries]) => ({
        matchNumber,
        red: entries.filter(e => e.alliance === 'Red'),
        blue: entries.filter(e => e.alliance === 'Blue'),
      }));
  }, [matchScoutsData]);

  const robotMatches = useMemo(() => {
    if (!selectedRobot) return [];
    const raw = matchScoutsData.filter(m => m.teamNumber === selectedRobot.teamNumber);
    const grouped = new Map<number, any[]>();
    for (const m of raw) {
      const arr = grouped.get(m.matchNumber) || [];
      arr.push(m);
      grouped.set(m.matchNumber, arr);
    }
    return Array.from(grouped.entries()).map(([matchNumber, entries]) => {
      if (entries.length === 1) return entries[0];
      const avg = (field: string) => {
        const sum = entries.reduce((s, e) => s + (e[field] || 0), 0);
        return Math.round(sum / entries.length);
      };
      return {
        ...entries[0],
        matchNumber,
        coralScored: avg('coralScored'),
        algaeScored: avg('algaeScored'),
        penalties: avg('penalties'),
        endClimbLevel: avg('endClimbLevel'),
        defenseRating: avg('defenseRating'),
        autoClimb: entries.some(e => e.autoClimb),
        humanPlayerScore: avg('humanPlayerScore'),
        _scoutCount: entries.length,
      };
    });
  }, [selectedRobot, matchScoutsData]);

  useEffect(() => {
    if (!selectedRobot) { setTbaYearEvents([]); setTbaYearStatuses({}); setCrossEventMatches([]); return; }
    const year = new Date().getFullYear();
    const teamKey = `frc${selectedRobot.teamNumber}`;
    setTbaYearLoading(true);
    Promise.all([
      api.tba.getTeamYearEvents(teamKey, year).catch(() => []),
      api.tba.getTeamYearStatuses(teamKey, year).catch(() => ({})),
      api.scout.getTeamAllMatches(selectedRobot.teamNumber).catch(() => []),
    ]).then(([evts, statuses, allMatches]) => {
      setTbaYearEvents(evts || []);
      setTbaYearStatuses(statuses || {});
      setCrossEventMatches(allMatches || []);
      setTbaYearLoading(false);
    });
  }, [selectedRobot]);

  if (selectedRobot && activeEvent) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedRobot(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
            <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          <div className="flex-1">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Team {selectedRobot.teamNumber}</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">{selectedRobot.teamName || 'Unknown Team'} • {selectedRobot.robotName || 'Unnamed Robot'}</p>
          </div>
          <button
            onClick={generateRobotAIReport}
            className="px-4 py-2.5 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 shadow-lg shadow-purple-600/20 transition-all flex items-center gap-2 flex-shrink-0"
          >
            <Copy size={14} /> Copy for AI
          </button>
          {selectedRobot.photoUrl && (
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex-shrink-0">
              <img src={selectedRobot.photoUrl} alt={`Team ${selectedRobot.teamNumber}`} className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-6">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Robot Specs</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Drivetrain</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.drivetrain || '—'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Weight</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.weight ? `${selectedRobot.weight} lbs` : '—'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Speed</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.speed ? `${selectedRobot.speed} ft/s` : '—'}</p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Height</p>
                <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.height ? `${selectedRobot.height}"` : '—'}</p>
              </div>
              {selectedRobot.shooterType && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Shooter</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.shooterType}</p>
                </div>
              )}
              {selectedRobot.fuelCapacity > 0 && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fuel Capacity</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.fuelCapacity} cells</p>
                </div>
              )}
              {selectedRobot.traversalAbility && (
                <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4 col-span-2">
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Field Traversal</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{selectedRobot.traversalAbility}</p>
                </div>
              )}
            </div>
            {selectedRobot.autoOptions?.length > 0 && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl p-4">
                <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-2">Auto Routines Available</p>
                <div className="flex flex-wrap gap-2">
                  {selectedRobot.autoOptions.map((a: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-xs font-bold">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-6">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Ratings</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Offense</span>
                <span className="text-lg font-black text-red-600">{selectedRobot.offenseRating}/10</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Defense</span>
                <span className="text-lg font-black text-blue-600">{selectedRobot.defenseRating}/10</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Overall</span>
                <span className="text-lg font-black text-green-600">{selectedRobot.overallRating}/10</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEditPit(selectedRobot)} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-700 transition-all">
                Edit
              </button>
              <button onClick={() => handleDeletePitScout(selectedRobot.id)} className="px-4 py-3 bg-slate-100 dark:bg-slate-700 text-red-600 font-black rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {(selectedRobot.capabilities?.length > 0 || selectedRobot.deficiencies?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {selectedRobot.capabilities?.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Capabilities</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRobot.capabilities.map((c: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedRobot.deficiencies?.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Deficiencies</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRobot.deficiencies.map((d: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 rounded-full text-xs font-bold">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedRobot.notes && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Notes</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{selectedRobot.notes}</p>
          </div>
        )}

        {tbaYearLoading ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 p-6 flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500">Loading TBA season data...</p>
          </div>
        ) : tbaYearEvents.length > 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Trophy size={12} className="text-yellow-500" />
              {new Date().getFullYear()} Season Events (via TBA)
            </h3>
            <div className="space-y-3">
              {tbaYearEvents
                .filter((e: any) => e.event_type_string !== 'Offseason')
                .sort((a: any, b: any) => (a.start_date || '').localeCompare(b.start_date || ''))
                .map((event: any) => {
                  const status = tbaYearStatuses[`frc${selectedRobot.teamNumber}`] || tbaYearStatuses[event.key];
                  const overallStatus = status?.overall_status_str?.replace(/<[^>]*>/g, '') || null;
                  const rank = status?.qual?.ranking?.rank;
                  const numTeams = status?.qual?.num_teams;
                  const record = status?.qual?.ranking?.record;
                  const isCurrentEvent = activeEvent?.tbaEventKey === event.key;
                  return (
                    <div key={event.key} className={`p-4 rounded-xl border-2 ${isCurrentEvent ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-700/30'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 dark:text-white leading-tight">{event.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">
                            {event.city && `${event.city}, ${event.state_prov} • `}
                            {event.start_date && new Date(event.start_date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            {event.end_date !== event.start_date && ` – ${new Date(event.end_date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}`}
                          </p>
                          {overallStatus && (
                            <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mt-1">{overallStatus}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {isCurrentEvent && <span className="px-2 py-0.5 bg-red-600 text-white text-[8px] font-black uppercase rounded-full">Current</span>}
                          {rank && <span className="text-xs font-black text-slate-700 dark:text-slate-300">#{rank}{numTeams ? ` / ${numTeams}` : ''}</span>}
                          {record && <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{record.wins}-{record.losses}-{record.ties}</span>}
                        </div>
                      </div>
                      <a href={`https://www.thebluealliance.com/team/${selectedRobot.teamNumber}/${event.key}`} target="_blank" rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-widest">
                        View on TBA →
                      </a>
                    </div>
                  );
                })}
            </div>
          </div>
        ) : null}

        {robotMatches.length > 0 && (() => {
          const totalAutoFuel = robotMatches.reduce((s, m) => s + (m.autoFuelTotal || 0), 0);
          const totalTeleopFuel = robotMatches.reduce((s, m) => s + (m.teleopFuelTotal || 0), 0);
          const avgAutoFuel = (totalAutoFuel / robotMatches.length).toFixed(1);
          const avgTeleopFuel = (totalTeleopFuel / robotMatches.length).toFixed(1);
          const avgTotalFuel = ((totalAutoFuel + totalTeleopFuel) / robotMatches.length).toFixed(1);
          const avgAccuracy = robotMatches.filter(m => m.coralScored > 0).length > 0
            ? (robotMatches.reduce((s, m) => s + Math.min(m.coralScored || 0, 5), 0) / robotMatches.filter(m => m.coralScored > 0).length).toFixed(1)
            : '—';
          const climbMatches = robotMatches.filter(m => m.endClimbLevel > 0).length;
          const climbRate = ((climbMatches / robotMatches.length) * 100).toFixed(0);
          const maxClimbLevel = Math.max(...robotMatches.map(m => m.endClimbLevel || 0));
          const avgDriving = robotMatches.filter(m => m.drivingSkillRating > 0).length > 0
            ? (robotMatches.reduce((s, m) => s + (m.drivingSkillRating || 0), 0) / robotMatches.filter(m => m.drivingSkillRating > 0).length).toFixed(1)
            : '—';
          const avgCV = robotMatches.filter(m => m.coreValuesRating > 0).length > 0
            ? (robotMatches.reduce((s, m) => s + (m.coreValuesRating || 0), 0) / robotMatches.filter(m => m.coreValuesRating > 0).length).toFixed(1)
            : '—';
          const totalPenalties = robotMatches.reduce((s, m) => s + (m.penalties || 0), 0);
          const avgPenalties = (totalPenalties / robotMatches.length).toFixed(1);
          const bestMatch = robotMatches.reduce((best, m) => {
            const mTotal = (m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0);
            const bTotal = (best.autoFuelTotal || 0) + (best.teleopFuelTotal || 0);
            return mTotal > bTotal ? m : best;
          }, robotMatches[0]);

          return (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-6">Performance Analysis ({robotMatches.length} matches)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-green-600">{avgAutoFuel}</p>
                    <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mt-1">Avg Auto Fuel</p>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-blue-600">{avgTeleopFuel}</p>
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-1">Avg Teleop Fuel</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-red-600">{avgTotalFuel}</p>
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-1">Avg Total Fuel</p>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-orange-600">{avgAccuracy}<span className="text-sm">/5</span></p>
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mt-1">Avg Accuracy</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4">
                  <div className="bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-purple-600">{climbRate}%</p>
                    <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mt-1">Climb Rate</p>
                  </div>
                  <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-indigo-600">L{maxClimbLevel}</p>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">Max Climb</p>
                  </div>
                  <div className="bg-teal-50 dark:bg-teal-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-teal-600">{avgDriving}<span className="text-sm">/5</span></p>
                    <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest mt-1">Avg Driving</p>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-900/30 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-amber-600">{avgPenalties}</p>
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">Avg Penalties</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Best Match</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">Match {bestMatch.matchNumber} — {(bestMatch.autoFuelTotal || 0) + (bestMatch.teleopFuelTotal || 0)} total fuel</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">FIRST Core Values</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{avgCV}/5 avg rating</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Fuel (All Matches)</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{totalAutoFuel + totalTeleopFuel} ({totalAutoFuel} auto + {totalTeleopFuel} teleop)</p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Match History</h3>
                <div className="space-y-3">
                  {robotMatches.sort((a, b) => a.matchNumber - b.matchNumber).map(m => (
                    <div key={m.id} className={`p-4 rounded-xl border-2 ${m.alliance === 'Red' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                            Match {m.matchNumber}
                          </span>
                          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            {(m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0)} fuel
                            {m.coralScored > 0 && <span className="text-yellow-500 ml-1">{'★'.repeat(Math.min(m.coralScored || 0, 5))}</span>}
                          </span>
                          {m._scoutCount > 1 && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-500 rounded-lg text-[8px] font-black">
                              AVG of {m._scoutCount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {m.endClimbLevel > 0 && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[9px] font-black">
                              Climb L{m.endClimbLevel}
                            </span>
                          )}
                          <span className="text-base font-black text-slate-900 dark:text-white">{(m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        {(() => {
          const otherMatches = crossEventMatches.filter((m: any) => m.eventId !== activeEvent?.id);
          if (otherMatches.length === 0) return null;
          const grouped = new Map<string, any[]>();
          for (const m of otherMatches) {
            const key = m.eventName || `Event ${m.eventId}`;
            if (!grouped.has(key)) grouped.set(key, []);
            grouped.get(key)!.push(m);
          }
          return (
            <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-indigo-100 p-6 md:p-8">
              <h3 className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Calendar size={14} />
                Previous Event Data ({otherMatches.length} matches from {grouped.size} event{grouped.size !== 1 ? 's' : ''})
              </h3>
              <div className="space-y-5">
                {Array.from(grouped.entries()).map(([eventName, matches]) => {
                  const avg = (field: string) => (matches.reduce((s: number, m: any) => s + (m[field] || 0), 0) / matches.length).toFixed(1);
                  return (
                    <div key={eventName} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-black text-slate-800">{eventName}</p>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500">{matches.length} matches • Avg Fuel: {avg('autoFuelTotal')} auto / {avg('teleopFuelTotal')} teleop</p>
                      </div>
                      <div className="space-y-1.5">
                        {matches.sort((a: any, b: any) => a.matchNumber - b.matchNumber).map((m: any) => (
                          <div key={m.id} className={`flex items-center justify-between p-3 rounded-xl border ${m.alliance === 'Red' ? 'border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-900/10' : 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10'}`}>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>M{m.matchNumber}</span>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Auto: {m.autoFuelTotal || 0} | Teleop: {m.teleopFuelTotal || 0}</span>
                              {m.drivingSkillRating > 0 && <span className="text-yellow-500 text-xs">{'★'.repeat(m.drivingSkillRating)}</span>}
                            </div>
                            <span className="text-sm font-black text-slate-900 dark:text-white">{(m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
                <button onClick={() => setGeminiModal({ open: false, text: '', matchLabel: '' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 rounded-xl transition-all">
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
                        setCopiedGemini(true);
                        setTimeout(() => setCopiedGemini(false), 2000);
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
  }

  if (activeEvent) {
    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => { setActiveEvent(null); fetchEvents(); }} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 transition-all">
              <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{activeEvent.name}</h2>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">
                {activeEvent.location && `${activeEvent.location} • `}
                {activeEvent.startDate && activeEvent.startDate}
                {activeEvent.endDate && ` — ${activeEvent.endDate}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 text-[10px]">
            {isCoachOrCaptain && (
              <button
                onClick={openEventSettings}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-xl border border-violet-200 dark:border-violet-700 font-black uppercase tracking-widest hover:bg-violet-100 transition-all"
              >
                <Settings size={13} /> Settings
              </button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-700">
              <Bot size={14} className="text-red-600" />
              <span className="font-black text-slate-800">{pitScouts.length}</span>
              <span className="text-slate-400 dark:text-slate-500 font-bold">robots</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-700">
              <Swords size={14} className="text-red-600" />
              <span className="font-black text-slate-800">{matchScoutsData.length}</span>
              <span className="text-slate-400 dark:text-slate-500 font-bold">matches</span>
            </div>
            {offlineQueue.length > 0 && (
              <button
                onClick={handleSync}
                className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl border border-amber-200 dark:border-amber-700 hover:bg-amber-100 transition-all"
              >
                <WifiOff size={14} className="text-amber-600" />
                <span className="font-black text-amber-700">{offlineQueue.length}</span>
                <span className="text-amber-500 font-bold">pending</span>
              </button>
            )}
            <div className={`flex items-center gap-1.5 px-2 py-2 rounded-xl ${isOnline ? 'text-green-600' : 'text-red-500'}`}>
              {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            </div>
          </div>
        </div>

        {syncMessage && (
          <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-3 flex items-center gap-3 animate-in fade-in duration-300">
            <Wifi size={16} className="text-green-600 shrink-0" />
            <p className="text-xs font-black text-green-700 uppercase tracking-widest">{syncMessage}</p>
          </div>
        )}

        <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 shadow-inner">
          {(['robots', 'matches', 'qr', 'display'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-white dark:bg-slate-800 text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab === 'robots' ? 'Robots' : tab === 'matches' ? 'Matches' : tab === 'qr' ? 'QR Share' : 'Pit Display'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">Loading...</div>
        ) : activeTab === 'robots' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search teams..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
              </div>
              <button
                onClick={() => setRobotSort(robotSort === 'number' ? 'name' : 'number')}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl hover:bg-slate-200 transition-all uppercase text-[10px] tracking-widest"
                title={`Sort by ${robotSort === 'number' ? 'name' : 'number'}`}
              >
                <ArrowUpDown size={14} /> {robotSort === 'number' ? '#' : 'A-Z'}
              </button>
              {activeEvent?.tbaEventKey && (
                <button
                  onClick={importTeamsFromTba}
                  disabled={tbaImporting}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all uppercase text-[10px] tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Download size={16} /> {tbaImporting ? 'Importing...' : 'Import from TBA'}
                </button>
              )}
              <button
                onClick={() => { resetPitForm(); setEditingPit(null); setShowPitForm(true); }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] tracking-widest"
              >
                <Plus size={16} /> Scout Robot
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {filteredPitScouts.map(ps => (
                <div
                  key={ps.id}
                  onClick={() => setSelectedRobot(ps)}
                  className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-5 md:p-6 hover:border-red-600/30 transition-all cursor-pointer"
                >
                  {ps.photoUrl && (
                    <div className="w-full h-32 rounded-xl overflow-hidden mb-3 bg-slate-100 dark:bg-slate-700">
                      <img src={ps.photoUrl} alt={`Team ${ps.teamNumber}`} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-black text-sm">
                        {ps.teamNumber}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 dark:text-white truncate">{ps.teamName || `Team ${ps.teamNumber}`}</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">{ps.robotName || 'Unnamed'} • {ps.drivetrain || '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-lg text-[9px] font-black">OFF {ps.offenseRating}</span>
                    <span className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 rounded-lg text-[9px] font-black">DEF {ps.defenseRating}</span>
                    <span className="px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-300 rounded-lg text-[9px] font-black">OVR {ps.overallRating}</span>
                  </div>
                </div>
              ))}
            </div>

            {filteredPitScouts.length === 0 && (
              <div className="py-16 text-center">
                <Bot size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-300 uppercase tracking-tight">No Robots Scouted</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Start scouting to add robots</p>
              </div>
            )}
          </div>
        ) : activeTab === 'matches' ? (
          <div className="space-y-4">
            <div className="flex justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setMatchViewMode('list')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${matchViewMode === 'list' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}
                >
                  <List size={14} /> List
                </button>
                <button
                  onClick={() => setMatchViewMode('roster')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${matchViewMode === 'roster' ? 'bg-slate-900 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}
                >
                  <Grid3X3 size={14} /> Roster
                </button>
              </div>
              <button
                onClick={() => { resetMatchForm(); setEditingMatch(null); setShowMatchForm(true); }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] tracking-widest"
              >
                <Plus size={16} /> Record Match
              </button>
            </div>

            {activeEvent?.tbaEventKey && tbaMatches.length > 0 && (() => {
              const now = Math.floor(Date.now() / 1000);
              const upcoming = tbaMatches
                .filter((m: any) => {
                  const t = m.predicted_time || m.time;
                  return t && t > now - 3600 && m.alliances?.red?.score === null;
                })
                .sort((a: any, b: any) => (a.predicted_time || a.time) - (b.predicted_time || b.time));

              const unscoutedMatches = tbaMatches.filter((m: any) => {
                const allTeamNums = [
                  ...(m.alliances?.red?.team_keys || []),
                  ...(m.alliances?.blue?.team_keys || []),
                ].map((k: string) => parseInt(k.replace('frc', '')));
                const scoutedTeamNums = new Set(matchScoutsData.filter((ms: any) => ms.matchNumber === m.match_number).map((ms: any) => ms.teamNumber));
                const unscoutedCount = allTeamNums.filter(n => !scoutedTeamNums.has(n)).length;
                return unscoutedCount > 0;
              }).sort((a: any, b: any) => (a.match_number || 0) - (b.match_number || 0));

              const allTBATeamNums = new Set(
                tbaMatches.flatMap((m: any) => [
                  ...(m.alliances?.red?.team_keys || []),
                  ...(m.alliances?.blue?.team_keys || []),
                ]).map((k: string) => parseInt(k.replace('frc', '')))
              );
              const pitScoutedNums = new Set(pitScouts.map((p: any) => p.teamNumber));
              const unscoutedRobots = [...allTBATeamNums].filter(n => !pitScoutedNums.has(n)).sort((a, b) => a - b);

              const getMatchLabel = (m: any) => {
                const c = m.comp_level || 'qm', n = m.match_number || 0, s = m.set_number || 0;
                if (c === 'qm') return `Qual ${n}`;
                if (c === 'qf') return `QF ${s}-${n}`;
                if (c === 'sf') return `SF ${s}-${n}`;
                if (c === 'f') return `Final ${n}`;
                return `M${n}`;
              };

              return (
                <div className="space-y-4">
                  {(unscoutedRobots.length > 0 || unscoutedMatches.length > 0) && (
                    <div className="space-y-4">
                      {unscoutedRobots.length > 0 && (
                        <div className="bg-rose-50 dark:bg-rose-900/30 rounded-2xl border-2 border-rose-200 dark:border-rose-700 p-5">
                          <h4 className="text-xs font-black text-rose-900 dark:text-rose-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <AlertCircle size={14} className="text-rose-600 dark:text-rose-400" />
                            Unscouted Robots ({unscoutedRobots.length})
                          </h4>
                          <p className="text-[10px] text-rose-700 dark:text-rose-300 font-medium mb-3">These teams are on the event schedule but have no pit scout data. Visit their pit before they compete.</p>
                          <div className="flex flex-wrap gap-2">
                            {unscoutedRobots.map(n => (
                              <div key={n} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 rounded-xl">
                                <span className="text-[10px] font-black text-rose-700">#{n}</span>
                                <a
                                  href={`https://www.thebluealliance.com/team/${n}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[8px] font-black text-blue-500 hover:text-blue-700 uppercase tracking-wide"
                                >TBA</a>
                                <button
                                  onClick={() => { setPitForm((f: any) => ({ ...f, teamNumber: n })); setShowPitForm(true); }}
                                  className="text-[8px] font-black text-rose-600 hover:text-rose-800 uppercase tracking-wide"
                                >+ Scout</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {unscoutedMatches.length > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-2xl border-2 border-amber-200 dark:border-amber-700 p-5">
                          <h4 className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <AlertCircle size={14} className="text-amber-600 dark:text-amber-400" />
                            Unscouted Matches ({unscoutedMatches.length})
                          </h4>
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium mb-3">Every match listed has at least one team with no match scout entry. TBA links open the match page where video replays are available.</p>
                          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                            {unscoutedMatches.map((m: any) => {
                              const allTeamNums = [...(m.alliances?.red?.team_keys || []), ...(m.alliances?.blue?.team_keys || [])].map((k: string) => parseInt(k.replace('frc', '')));
                              const scoutedNums = new Set(matchScoutsData.filter((ms: any) => ms.matchNumber === m.match_number).map((ms: any) => ms.teamNumber));
                              const unscoutedTeams = allTeamNums.filter(n => !scoutedNums.has(n));
                              const tbaMatchUrl = `https://www.thebluealliance.com/match/${m.key}`;
                              const youtubeLink = m.videos?.find((v: any) => v.type === 'youtube');
                              const isPast = (m.actual_time || m.time) && (m.actual_time || m.time) < Math.floor(Date.now() / 1000);
                              return (
                                <div key={m.key} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                                      <span className="px-2 py-1 bg-amber-600 text-white rounded-lg text-[9px] font-black uppercase">{getMatchLabel(m)}</span>
                                      {isPast && <span className="text-[7px] font-black text-slate-400 dark:text-slate-500 uppercase">Played</span>}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-bold text-slate-700 truncate">Missing: <span className="text-amber-700 font-black">{unscoutedTeams.join(', ')}</span></p>
                                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium hidden sm:block">
                                        🔴 {(m.alliances?.red?.team_keys || []).map((k: string) => k.replace('frc', '')).join(' ')} vs 🔵 {(m.alliances?.blue?.team_keys || []).map((k: string) => k.replace('frc', '')).join(' ')}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {youtubeLink && (
                                      <a href={`https://www.youtube.com/watch?v=${youtubeLink.key}`} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1 px-2 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black hover:bg-red-700 transition-all">
                                        <Video size={10} /> Watch
                                      </a>
                                    )}
                                    <a href={tbaMatchUrl} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 px-2 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black hover:bg-blue-700 transition-all">
                                      TBA {isPast && '▶'}
                                    </a>
                                    <button
                                      onClick={() => {
                                        resetMatchForm();
                                        const isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                                        const matchNum = isElim && m.set_number > 0
                                          ? m.set_number * 10 + (m.match_number || 1)
                                          : (m.match_number || 1);
                                        const matchType = m.comp_level === 'pr' ? 'practice' : m.comp_level === 'qm' ? 'qualification' : 'elimination';
                                        setMatchForm(f => ({ ...f, matchNumber: matchNum, matchType }));
                                        setShowMatchForm(true);
                                      }}
                                      className="px-2 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black hover:bg-slate-800 transition-all"
                                    >Record</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {upcoming.length > 0 && (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 p-5">
                      <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest mb-3 flex items-center gap-2">
                        <UserCheck size={14} className="text-green-600" />
                        Claim a Match to Scout
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-3">Tap a match to claim it for scouting so teammates know who's covering what.</p>
                      <div className="space-y-2">
                        {upcoming.slice(0, 8).map((m: any) => {
                          const claim = matchClaims[m.key];
                          const isMine = claim?.userId === parseInt(currentUser.id);
                          const allTeams = [...(m.alliances?.red?.team_keys || []), ...(m.alliances?.blue?.team_keys || [])].map((k: string) => parseInt(k.replace('frc', '')));
                          const time = m.predicted_time || m.time;
                          return (
                            <div key={m.key} className={`flex items-center justify-between p-3 rounded-xl border-2 ${isMine ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/30' : claim ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700' : 'border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-red-200 hover:bg-red-50/30 dark:hover:border-red-700 dark:hover:bg-red-900/20'} transition-all`}>
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="px-2 py-1 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase flex-shrink-0">{getMatchLabel(m)}</span>
                                <div className="min-w-0">
                                  <p className="text-[10px] font-bold text-slate-600 truncate">
                                    🔴 {(m.alliances?.red?.team_keys || []).map((k: string) => k.replace('frc', '')).join(', ')} vs 🔵 {(m.alliances?.blue?.team_keys || []).map((k: string) => k.replace('frc', '')).join(', ')}
                                  </p>
                                  {claim && (
                                    <p className={`text-[9px] font-black ${isMine ? 'text-green-600' : 'text-slate-400'}`}>
                                      {isMine ? '✓ Claimed by you' : `Claimed by ${claim.userName}`}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {time && (
                                  <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold hidden sm:block">
                                    {new Date(time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
                                  </span>
                                )}
                                {isMine ? (
                                  <button onClick={() => unclaimMatch(m.key)}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[9px] font-black hover:bg-green-700 transition-all">Unclaim</button>
                                ) : !claim ? (
                                  <button onClick={() => claimMatch(m.key)}
                                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[9px] font-black hover:bg-slate-800 transition-all">Claim</button>
                                ) : (
                                  <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 rounded-lg text-[9px] font-black">Taken</span>
                                )}
                                <button
                                  onClick={() => {
                                    resetMatchForm();
                                    const isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                                    const matchNum = isElim && m.set_number > 0
                                      ? m.set_number * 10 + (m.match_number || 1)
                                      : (m.match_number || 1);
                                    const matchType = m.comp_level === 'pr' ? 'practice' : m.comp_level === 'qm' ? 'qualification' : 'elimination';
                                    setMatchForm(f => ({ ...f, matchNumber: matchNum, matchType }));
                                    setShowMatchForm(true);
                                  }}
                                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black hover:bg-red-700 transition-all"
                                >Scout</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {matchViewMode === 'list' ? (
              <div className="space-y-3">
                {sortedMatches.map(m => (
                  <div
                    key={m.id}
                    className={`bg-white dark:bg-slate-800 rounded-2xl border-2 p-4 md:p-5 ${m.alliance === 'Red' ? 'border-red-200' : 'border-blue-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                            m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                          }`}>
                            M{m.matchNumber}
                          </span>
                          {m.matchType && m.matchType !== 'qualification' && (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              m.matchType === 'practice' ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : 'bg-purple-100 text-purple-700'
                            }`}>{m.matchType}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 dark:text-white">Team {m.teamNumber}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                            Auto: {m.autoFuelTotal || 0} | Teleop: {m.teleopFuelTotal || 0} | Accuracy: {'★'.repeat(Math.min(m.coralScored || 0, 5))} | Pen: -{m.penalties}
                          </p>
                          {m.autoUsed && <p className="text-[9px] text-blue-500 font-bold">Auto: {m.autoUsed}</p>}
                          {(currentUser.role === 'Coach' || currentUser.role === 'TeamCaptain') && m.scoutedByName && (
                            <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold mt-0.5">Scouted by <span className="text-slate-600 dark:text-slate-400">{m.scoutedByName}</span></p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                          {m.drivingSkillRating > 0 && <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Drive: {'★'.repeat(Math.min(m.drivingSkillRating || 0, 5))}</p>}
                          {m.coreValuesRating > 0 && <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">CV: {'★'.repeat(Math.min(m.coreValuesRating || 0, 5))}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">Fuel</p>
                          <p className="text-base font-black text-slate-900 dark:text-white">{(m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0)}</p>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => openEditMatch(m)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 transition-all text-slate-500 dark:text-slate-400 text-[10px] font-black">Edit</button>
                          <button onClick={() => handleDeleteMatchScout(m.id)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-red-50 transition-all text-red-500">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                    {m.notes && <p className="text-[10px] text-slate-500 mt-2 pl-12 font-medium">{m.notes}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {matchRosters.map(roster => (
                  <div key={roster.matchNumber} className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 p-4 md:p-6">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-4 flex items-center gap-2">
                      <Swords size={16} className="text-red-600" />
                      Match {roster.matchNumber}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest">Red Alliance</span>
                        {roster.red.length > 0 ? roster.red.map(m => (
                          <div
                            key={m.id}
                            onClick={() => openRobotByNumber(m.teamNumber)}
                            className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/50 transition-all"
                          >
                            <p className="text-sm font-black text-slate-900 dark:text-white">Team {m.teamNumber}</p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">{(m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0)} fuel {m.coralScored > 0 ? '★'.repeat(Math.min(m.coralScored || 0, 5)) : ''}</p>
                          </div>
                        )) : (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold p-3">No robots scouted</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Blue Alliance</span>
                        {roster.blue.length > 0 ? roster.blue.map(m => (
                          <div
                            key={m.id}
                            onClick={() => openRobotByNumber(m.teamNumber)}
                            className="p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl cursor-pointer hover:bg-blue-100 transition-all"
                          >
                            <p className="text-sm font-black text-slate-900 dark:text-white">Team {m.teamNumber}</p>
                            <p className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">{(m.autoFuelTotal || 0) + (m.teleopFuelTotal || 0)} fuel {m.coralScored > 0 ? '★'.repeat(Math.min(m.coralScored || 0, 5)) : ''}</p>
                          </div>
                        )) : (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold p-3">No robots scouted</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {sortedMatches.length === 0 && (
              <div className="py-8 text-center">
                <Swords size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-300 uppercase tracking-tight">No Matches Recorded</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Record match data to track performance</p>
              </div>
            )}

          </div>
        ) : activeTab === 'qr' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Export Data</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Share via QR code</p>
                </div>
              </div>

              {matchScoutsData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Select Matches to Export</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMatchIds(new Set(matchScoutsData.map((m: any) => m.id)))}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all"
                      >Select All</button>
                      <button
                        type="button"
                        onClick={() => setSelectedMatchIds(new Set())}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all"
                      >Deselect All</button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-slate-100 dark:border-slate-700 rounded-xl p-2">
                    {[...matchScoutsData].sort((a, b) => a.matchNumber - b.matchNumber).map((m: any) => (
                      <label key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={selectedMatchIds.has(m.id)}
                          onChange={(e) => {
                            const next = new Set(selectedMatchIds);
                            if (e.target.checked) next.add(m.id); else next.delete(m.id);
                            setSelectedMatchIds(next);
                          }}
                          className="w-4 h-4 accent-red-600"
                        />
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">M{m.matchNumber}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Team {m.teamNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                          {m.alliance}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                    {selectedMatchIds.size === 0 ? 'All matches will be exported' : `${selectedMatchIds.size} match${selectedMatchIds.size !== 1 ? 'es' : ''} selected`}
                  </p>
                </div>
              )}

              {pitScouts.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Select Robots to Export</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedRobotIds(new Set(pitScouts.map((r: any) => r.id)))}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all"
                      >Select All</button>
                      <button
                        type="button"
                        onClick={() => setSelectedRobotIds(new Set())}
                        className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all"
                      >Deselect All</button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-slate-100 dark:border-slate-700 rounded-xl p-2">
                    {[...pitScouts].sort((a, b) => a.teamNumber - b.teamNumber).map((r: any) => (
                      <label key={r.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={selectedRobotIds.has(r.id)}
                          onChange={(e) => {
                            const next = new Set(selectedRobotIds);
                            if (e.target.checked) next.add(r.id); else next.delete(r.id);
                            setSelectedRobotIds(next);
                          }}
                          className="w-4 h-4 accent-red-600"
                        />
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">{r.teamNumber}</span>
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{r.teamName || 'Unknown'}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold">
                    {selectedRobotIds.size === 0 ? 'No robots selected for export' : `${selectedRobotIds.size} robot${selectedRobotIds.size !== 1 ? 's' : ''} selected`}
                  </p>
                </div>
              )}

              <button
                onClick={generateQR}
                className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-700 shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <QrCode size={16} /> Generate QR Code
              </button>

              {qrData.length > 0 && (
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border-2 border-slate-100 dark:border-slate-700">
                    <QRCodeSVG value={qrData[qrChunkIndex]} size={240} />
                  </div>
                  {qrData.length > 1 && (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setQrChunkIndex(Math.max(0, qrChunkIndex - 1))}
                        disabled={qrChunkIndex === 0}
                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-sm font-black text-slate-600 dark:text-slate-400">
                        {qrChunkIndex + 1} / {qrData.length}
                      </span>
                      <button
                        onClick={() => setQrChunkIndex(Math.min(qrData.length - 1, qrChunkIndex + 1))}
                        disabled={qrChunkIndex === qrData.length - 1}
                        className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-center">
                    {selectedMatchIds.size > 0 ? `${selectedMatchIds.size} of ${matchScoutsData.length}` : matchScoutsData.length} match records
                    {selectedRobotIds.size > 0 ? ` + ${selectedRobotIds.size} robots` : ''} encoded
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Import Data</h3>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Scan QR code to import</p>
                </div>
              </div>

              {!scanning && !importPreview && (
                <button
                  onClick={startScanner}
                  className="w-full py-4 bg-blue-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-blue-700 shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Camera size={16} /> Start Scanner
                </button>
              )}

              {scanning && (
                <div className="space-y-4">
                  <div id="qr-scanner-container" ref={scannerContainerRef} className="rounded-xl overflow-hidden" />
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold text-center uppercase">
                    Scanned {scannedChunks.size} chunk{scannedChunks.size !== 1 ? 's' : ''}...
                  </p>
                  <button
                    onClick={stopScanner}
                    className="w-full py-3 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-slate-300 transition-all"
                  >
                    Cancel Scanning
                  </button>
                </div>
              )}

              {importPreview && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-4">
                    <p className="text-sm font-black text-green-800 mb-2">Data Ready to Import</p>
                    <p className="text-xs text-green-700 font-bold">
                      {importPreview.matchScouts?.length || 0} match records found
                    </p>
                    {importPreview.pitScouts?.length > 0 && (
                      <p className="text-xs text-green-700 font-bold mt-1">
                        {importPreview.pitScouts.length} robot records found
                      </p>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setImportPreview(null); setScannedChunks(new Map()); }}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={confirmImport}
                      className="flex-1 py-3 bg-green-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-green-700 shadow-lg transition-all"
                    >
                      Confirm Import
                    </button>
                  </div>
                </div>
              )}

              {importResult && (
                <div className="space-y-4">
                  <div className="bg-green-50 dark:bg-green-900/30 border-2 border-green-200 dark:border-green-700 rounded-xl p-4">
                    <p className="text-sm font-black text-green-800 mb-2">Import Complete</p>
                    <p className="text-xs text-green-700 font-bold">
                      {importResult.imported} match{importResult.imported !== 1 ? 'es' : ''} imported
                    </p>
                    {(importResult.robotsImported || 0) > 0 && (
                      <p className="text-xs text-green-700 font-bold mt-1">
                        {importResult.robotsImported} robot{importResult.robotsImported !== 1 ? 's' : ''} imported
                      </p>
                    )}
                    {importResult.skipped > 0 && (
                      <p className="text-xs text-amber-600 font-bold mt-1">
                        {importResult.skipped} match duplicate{importResult.skipped !== 1 ? 's' : ''} skipped
                      </p>
                    )}
                    {(importResult.robotsSkipped || 0) > 0 && (
                      <p className="text-xs text-amber-600 font-bold mt-1">
                        {importResult.robotsSkipped} robot duplicate{importResult.robotsSkipped !== 1 ? 's' : ''} skipped
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setImportResult(null)}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'display' ? (
          <div className="space-y-6 md:space-y-8">

            {nexusData && (() => {
              const firstPendingAnnouncement = nexusData.announcements?.find(
                (a: any) => !dismissedAnnouncements.has(String(a.id ?? a.message ?? a))
              );
              const firstPendingPart = nexusData.partsRequests?.find(
                (r: any) => !dismissedParts.has(String(r.id ?? r.message ?? r))
              );
              const activeMatchIdx = nexusData.matches?.findIndex(
                (m: any) => m.status === 'Now queuing' || m.status === 'On deck' || m.status === 'On field'
              ) ?? -1;
              const breakMatch = activeMatchIdx >= 0 ? nexusData.matches?.[activeMatchIdx] : null;
              const breakId = breakMatch?.label ?? '';
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
                      {pendingBreak.times?.estimatedStartTime && (
                        <p className="text-sm text-orange-600 font-black mt-3">
                          Resumes at {new Date(pendingBreak.times.estimatedStartTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })} PT
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
                      <p className="text-base text-slate-700 dark:text-slate-300 font-medium">{firstPendingAnnouncement.message ?? firstPendingAnnouncement}</p>
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
                      <p className="text-base text-slate-700 dark:text-slate-300 font-medium">{firstPendingPart.message ?? firstPendingPart}</p>
                    </div>
                  </div>
                );
              }

              return null;
            })()}

            {activeEvent?.nexusEventKey ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-violet-600/10 to-blue-600/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">FRC Nexus Live</span>
                    {nexusData?.nowQueuing && (
                      <span className="px-2.5 py-1 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase tracking-widest animate-pulse">
                        {nexusData.nowQueuing}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {nexusLoading && (
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Refreshing...</span>
                    )}
                    <button
                      onClick={() => fetchNexusData(activeEvent.nexusEventKey)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-lg text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
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
                      const activeMatch = nexusData.matches?.find((m: any) =>
                        m.status === 'Now queuing' || m.status === 'On deck' || m.status === 'On field'
                      );
                      const nextMatch = nexusData.matches?.find((m: any) =>
                        m.status === 'Queuing soon'
                      );

                      const statusColor = (status: string) => {
                        if (status === 'Now queuing') return 'bg-red-600 text-white';
                        if (status === 'On deck') return 'bg-orange-500 text-white';
                        if (status === 'On field') return 'bg-green-600 text-white';
                        if (status === 'Queuing soon') return 'bg-blue-600 text-white';
                        return 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300';
                      };

                      const teamBadge = (num: number, alliance: 'red' | 'blue') => (
                        <span
                          key={num}
                          className={`px-2 py-1 rounded-lg text-[11px] font-black ${
                            num === 10991
                              ? 'ring-2 ring-red-500 bg-red-50 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-black'
                              : alliance === 'red'
                              ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                              : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          }`}
                        >
                          {num === 10991 ? '★ ' : ''}{num}
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
                                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase ${statusColor(activeMatch.status)}`}>
                                        {activeMatch.status}
                                      </span>
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
                                <p key={i} className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">{a.message || a}</p>
                              ))}
                            </div>
                          )}

                          {nexusData.matches?.length > 0 && (
                            <div>
                              <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Match Queue</p>
                              <div className="space-y-2">
                                {nexusData.matches.map((m: any, i: number) => {
                                  const isOurs = [...(m.redTeams || []), ...(m.blueTeams || [])].includes(10991);
                                  const queueTime = m.times?.estimatedQueueTime;
                                  const startTime = m.times?.estimatedStartTime;
                                  const timeStr = (t: string) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' });
                                  return (
                                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                      isOurs
                                        ? 'border-red-500 dark:border-red-600 bg-red-50 dark:bg-red-900/20'
                                        : 'border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/40'
                                    }`}>
                                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase flex-shrink-0 ${statusColor(m.status)}`}>
                                        {m.status === 'Queuing soon' ? 'Soon' :
                                         m.status === 'Now queuing' ? 'Queue' :
                                         m.status === 'On deck' ? 'Deck' :
                                         m.status === 'On field' ? 'Field' : '—'}
                                      </span>
                                      <span className={`text-sm font-black flex-shrink-0 ${isOurs ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-white'}`}>
                                        {m.label}
                                        {isOurs && ' ★'}
                                      </span>
                                      <div className="flex gap-2 flex-1 min-w-0 flex-wrap">
                                        {(m.redTeams || []).map((t: number) => teamBadge(t, 'red'))}
                                        <span className="text-slate-300 dark:text-slate-600 text-xs">vs</span>
                                        {(m.blueTeams || []).map((t: number) => teamBadge(t, 'blue'))}
                                      </div>
                                      <div className="text-right flex-shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                        {queueTime && <p>Q {timeStr(queueTime)}</p>}
                                        {startTime && <p>▶ {timeStr(startTime)}</p>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {nexusData.partsRequests?.length > 0 && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-xl p-4">
                              <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-2">Parts Requests</p>
                              {nexusData.partsRequests.map((r: any, i: number) => (
                                <p key={i} className="text-sm text-red-800 dark:text-red-200 font-medium">{typeof r === 'string' ? r : r.message || JSON.stringify(r)}</p>
                              ))}
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
                  <p className="text-xs text-violet-500 dark:text-violet-400 mt-1">Edit this event and add an FRC Nexus event key to enable live queue data</p>
                </div>
              )
            )}

            {tbaRecord && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-4 md:p-6">
                <div className="flex items-center justify-center gap-6">
                  <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team 10991 Record</span>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-black text-green-600">{tbaRecord.wins}W</span>
                    <span className="text-lg font-black text-slate-300">–</span>
                    <span className="text-lg font-black text-red-600">{tbaRecord.losses}L</span>
                    {tbaRecord.ties > 0 && (
                      <>
                        <span className="text-lg font-black text-slate-300">–</span>
                        <span className="text-lg font-black text-yellow-600">{tbaRecord.ties}T</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeEvent?.tbaEventKey && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Event Schedule</h3>
                  <button onClick={() => fetchTbaData(activeEvent.tbaEventKey)} className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Refresh
                  </button>
                </div>

                {tbaLoading ? (
                  <div className="py-12 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">Loading schedule...</div>
                ) : (() => {
                  const teamMatches = tbaMatches
                    .filter((m: any) =>
                      m.alliances?.red?.team_keys?.includes('frc10991') ||
                      m.alliances?.blue?.team_keys?.includes('frc10991')
                    )
                    .sort((a: any, b: any) => {
                      if (a.predicted_time && b.predicted_time) return a.predicted_time - b.predicted_time;
                      if (a.time && b.time) return a.time - b.time;
                      return (a.match_number || 0) - (b.match_number || 0);
                    });

                  const now = Date.now() / 1000;
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
                    if (m.alliances?.red?.team_keys?.includes('frc10991')) return 'red';
                    return 'blue';
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
                            {upcomingMatches.slice(0, 5).map((m: any) => {
                              const ourAlliance = getOurAlliance(m);
                              const partnerKeys = (m.alliances?.[ourAlliance]?.team_keys || []).filter((t: string) => t !== 'frc10991');
                              const opponentKeys = (m.alliances?.[ourAlliance === 'red' ? 'blue' : 'red']?.team_keys || []);
                              const time = m.predicted_time || m.time;
                              const renderTeamLink = (teamKey: string) => {
                                const num = parseInt(teamKey.replace('frc', ''));
                                const hasScouted = pitScouts.some((ps: any) => ps.teamNumber === num);
                                return (
                                  <span
                                    key={teamKey}
                                    onClick={(e) => { e.stopPropagation(); if (hasScouted) openRobotByNumber(num); }}
                                    className={`${hasScouted ? 'text-red-600 underline cursor-pointer hover:text-red-800' : 'text-slate-700 dark:text-slate-300'} font-black`}
                                  >
                                    {num}
                                  </span>
                                );
                              };
                              return (
                                <div key={m.key} className={`p-4 rounded-xl border-2 ${ourAlliance === 'red' ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20' : 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                                        ourAlliance === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                                      }`}>
                                        {getMatchLabel(m)}
                                      </span>
                                      <div>
                                        <p className="text-sm text-slate-900 dark:text-white flex items-center gap-1">
                                          <span className="text-slate-400 dark:text-slate-500 text-xs">w/</span> {partnerKeys.length > 0 ? partnerKeys.map((t: string, i: number) => (
                                            <span key={t}>{i > 0 && <span className="text-slate-300">, </span>}{renderTeamLink(t)}</span>
                                          )) : '—'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                          <span className="text-slate-400 dark:text-slate-500">vs</span> {opponentKeys.length > 0 ? opponentKeys.map((t: string, i: number) => (
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
                                      <button
                                        onClick={() => generateGeminiReport(m)}
                                        title="Generate AI match analysis"
                                        className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg text-[9px] font-black hover:from-violet-700 hover:to-blue-700 transition-all active:scale-95"
                                      >
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
                                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                                        ourAlliance === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                                      }`}>
                                        {getMatchLabel(m)}
                                      </span>
                                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                        didWin ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' : didTie ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                                      }`}>
                                        {didWin ? 'WIN' : didTie ? 'TIE' : 'LOSS'}
                                      </span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900 dark:text-white">
                                      {ourScore} – {theirScore}
                                    </span>
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
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 dark:bg-blue-900/30 px-3 py-1.5 rounded-lg">
                        TBA Ranking Points
                      </span>
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
                        <div
                          key={ps.id}
                          onClick={() => setSelectedRobot(ps)}
                          className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all"
                        >
                          <span className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg ${
                            idx === 0 ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' : idx === 1 ? 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300' : idx === 2 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : 'bg-slate-100 text-slate-400'
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
        ) : null}

        {showPitForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
              <div className="flex justify-between items-start mb-6 md:mb-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
                    {editingPit ? 'Edit Robot' : 'Scout Robot'}
                  </h2>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Pit scouting form</p>
                </div>
                <button onClick={() => { setShowPitForm(false); setEditingPit(null); }} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Number *</span>
                    <input
                      type="number"
                      value={pitForm.teamNumber || ''}
                      onChange={(e) => setPitForm({ ...pitForm, teamNumber: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                      placeholder="10991"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Name</span>
                    <input
                      value={pitForm.teamName}
                      onChange={(e) => setPitForm({ ...pitForm, teamName: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                      placeholder="Team Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Robot Name</span>
                    <input
                      value={pitForm.robotName}
                      onChange={(e) => setPitForm({ ...pitForm, robotName: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                      placeholder="Robot Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Drivetrain</span>
                    <select
                      value={pitForm.drivetrain}
                      onChange={(e) => setPitForm({ ...pitForm, drivetrain: e.target.value })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    >
                      <option value="">Select...</option>
                      <option value="Swerve">Swerve</option>
                      <option value="Tank">Tank</option>
                      <option value="Mecanum">Mecanum</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Weight (lbs)</span>
                    <input
                      type="number"
                      value={pitForm.weight || ''}
                      onChange={(e) => setPitForm({ ...pitForm, weight: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Speed (ft/s)</span>
                    <input
                      type="number"
                      value={pitForm.speed || ''}
                      onChange={(e) => setPitForm({ ...pitForm, speed: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Height (in)</span>
                    <input
                      type="number"
                      value={pitForm.height || ''}
                      onChange={(e) => setPitForm({ ...pitForm, height: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Fuel Capacity</span>
                    <input
                      type="number"
                      value={pitForm.fuelCapacity || ''}
                      onChange={(e) => setPitForm({ ...pitForm, fuelCapacity: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                      placeholder="0"
                      min={0}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Shooter Type</span>
                    <div className="flex gap-2">
                      {['Turret', 'Launcher', 'None'].map(t => (
                        <button key={t} type="button"
                          onClick={() => setPitForm({ ...pitForm, shooterType: pitForm.shooterType === t ? '' : t })}
                          className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                            pitForm.shooterType === t ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                          }`}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Field Traversal</span>
                  <div className="grid grid-cols-4 gap-2">
                    {['Over Bump', 'Under Trench', 'Both', 'Neither'].map(t => (
                      <button key={t} type="button"
                        onClick={() => setPitForm({ ...pitForm, traversalAbility: pitForm.traversalAbility === t ? '' : t })}
                        className={`py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          pitForm.traversalAbility === t ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200'
                        }`}
                      >{t}</button>
                    ))}
                  </div>
                </div>

                <TagInput
                  tags={pitForm.autoOptions}
                  onChange={(tags) => setPitForm({ ...pitForm, autoOptions: tags })}
                  label="Auto Options (list all autonomous routines available)"
                  placeholder="e.g. 2-piece, center, far side... press Enter"
                />

                <TagInput
                  tags={pitForm.capabilities}
                  onChange={(tags) => setPitForm({ ...pitForm, capabilities: tags })}
                  label="Capabilities"
                  placeholder="e.g. Shooter, Climber, Intake..."
                />

                <TagInput
                  tags={pitForm.deficiencies}
                  onChange={(tags) => setPitForm({ ...pitForm, deficiencies: tags })}
                  label="Deficiencies"
                  placeholder="e.g. Slow, Tipping..."
                />

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notes</span>
                  <textarea
                    value={pitForm.notes}
                    onChange={(e) => setPitForm({ ...pitForm, notes: e.target.value })}
                    className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-medium text-sm resize-none"
                    placeholder="Additional observations..."
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Robot Photo</span>
                  {pitForm.photoUrl && (
                    <div className="relative w-full h-48 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 mb-2">
                      <img src={pitForm.photoUrl} alt="Robot" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setPitForm({ ...pitForm, photoUrl: '' })}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <label className="flex items-center justify-center gap-2 w-full py-3 bg-slate-50 border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-xl cursor-pointer hover:border-red-600 hover:bg-red-50/30 dark:bg-slate-700 transition-all">
                    <Camera size={16} className="text-slate-400 dark:text-slate-500" />
                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      {pitForm.photoUrl ? 'Change Photo' : 'Take / Upload Photo'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const dataUrl = await compressImage(file);
                            setPitForm({ ...pitForm, photoUrl: dataUrl });
                          } catch (err) {
                            console.error('Failed to process image:', err);
                          }
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <RatingSlider value={pitForm.offenseRating} onChange={(v) => setPitForm({ ...pitForm, offenseRating: v })} label="Offense Rating" />
                  <RatingSlider value={pitForm.defenseRating} onChange={(v) => setPitForm({ ...pitForm, defenseRating: v })} label="Defense Rating" />
                  <RatingSlider value={pitForm.overallRating} onChange={(v) => setPitForm({ ...pitForm, overallRating: v })} label="Overall Rating" />
                </div>

                <button
                  onClick={handleSavePitScout}
                  disabled={!pitForm.teamNumber}
                  className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingPit ? 'Update Robot' : 'Save Robot'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showMatchForm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
              <div className="flex justify-between items-start mb-6 md:mb-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">
                    {editingMatch ? 'Edit Match' : 'Record Match'}
                  </h2>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">Match scouting form</p>
                </div>
                <button onClick={() => { setShowMatchForm(false); setEditingMatch(null); }} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
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
                    <input
                      type="number"
                      value={matchForm.matchNumber || ''}
                      onChange={(e) => setMatchForm({ ...matchForm, matchNumber: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                      placeholder="1"
                      min={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Team Number</span>
                    <input
                      type="number"
                      value={matchForm.teamNumber || ''}
                      onChange={(e) => setMatchForm({ ...matchForm, teamNumber: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                      placeholder="10991"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Alliance</span>
                  <div className="flex gap-2">
                    <button type="button"
                      onClick={() => setMatchForm({ ...matchForm, alliance: 'Red' })}
                      className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
                        matchForm.alliance === 'Red' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-red-100 text-red-400'
                      }`}
                    >Red</button>
                    <button type="button"
                      onClick={() => setMatchForm({ ...matchForm, alliance: 'Blue' })}
                      className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
                        matchForm.alliance === 'Blue' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-blue-100 text-blue-400'
                      }`}
                    >Blue</button>
                  </div>
                </div>

                {(() => {
                  const scoutedTeam = pitScouts.find((p: any) => p.teamNumber === matchForm.teamNumber);
                  const autoOpts = scoutedTeam?.autoOptions || [];
                  return autoOpts.length > 0 ? (
                    <div className="space-y-1">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Auto Used</span>
                      <select
                        value={matchForm.autoUsed}
                        onChange={(e) => setMatchForm({ ...matchForm, autoUsed: e.target.value })}
                        className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                      >
                        <option value="">Select auto routine...</option>
                        {autoOpts.map((a: string) => <option key={a} value={a}>{a}</option>)}
                        <option value="Other">Other / Custom</option>
                      </select>
                    </div>
                  ) : null;
                })()}

                <div className="space-y-3">
                  <div className="border-2 border-green-100 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20 rounded-xl p-4">
                    <p className="text-[9px] font-black text-green-600 uppercase tracking-widest mb-3">Auto Period Fuel</p>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setMatchForm({ ...matchForm, autoFuelTotal: Math.max(0, matchForm.autoFuelTotal - 1) })}
                        className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl font-black text-lg bg-green-100 text-green-700 hover:bg-green-200 transition-all active:scale-95">−</button>
                      <input
                        type="number"
                        value={matchForm.autoFuelTotal || ''}
                        onChange={(e) => setMatchForm({ ...matchForm, autoFuelTotal: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-16 text-center font-black text-xl text-slate-900 dark:text-white bg-white dark:bg-slate-700 border-2 border-green-200 dark:border-green-700 rounded-xl py-2 outline-none focus:border-green-500 transition-all"
                        placeholder="0"
                        min={0}
                      />
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
                      <input
                        type="number"
                        value={matchForm.teleopFuelTotal || ''}
                        onChange={(e) => setMatchForm({ ...matchForm, teleopFuelTotal: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-16 text-center font-black text-xl text-slate-900 dark:text-white bg-white dark:bg-slate-700 border-2 border-blue-200 dark:border-blue-700 rounded-xl py-2 outline-none focus:border-blue-500 transition-all"
                        placeholder="0"
                        min={0}
                      />
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
                  <StarRating
                    value={matchForm.coralScored}
                    onChange={(v) => setMatchForm({ ...matchForm, coralScored: v })}
                    max={5}
                    label="Fuel Accuracy  (1 = always misses → 5 = always hits)"
                  />
                </div>

                <Counter label="Climb Level (0 = no climb)" value={matchForm.endClimbLevel} onChange={(v) => setMatchForm({ ...matchForm, endClimbLevel: v })} min={0} max={3} />

                <Counter label="Penalties" value={matchForm.penalties} onChange={(v) => setMatchForm({ ...matchForm, penalties: v })} />

                <StarRating value={matchForm.drivingSkillRating} onChange={(v) => setMatchForm({ ...matchForm, drivingSkillRating: v })} max={5} label="Driving Skill Rating" />
                <StarRating value={matchForm.coreValuesRating} onChange={(v) => setMatchForm({ ...matchForm, coreValuesRating: v })} max={5} label="FIRST Core Values Rating" />

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notes</span>
                  <textarea
                    value={matchForm.notes}
                    onChange={(e) => setMatchForm({ ...matchForm, notes: e.target.value })}
                    className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-[24px] outline-none focus:border-red-600 transition-all font-medium text-sm resize-none"
                    placeholder="Match observations..."
                  />
                </div>

                <button
                  onClick={handleSaveMatchScout}
                  disabled={!matchForm.teamNumber}
                  className="w-full py-4 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-700 shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editingMatch ? 'Update Match' : 'Save Match'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Scout</h2>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Tournament event scouting</p>
        </div>
        {isCoachOrCaptain && (
          <button
            onClick={() => setShowEventForm(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] tracking-widest"
          >
            <Plus size={16} /> Create Event
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {events.map(evt => (
          <div
            key={evt.id}
            onClick={() => enterEvent(evt)}
            className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 hover:border-red-600/30 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all">
                <Trophy size={22} />
              </div>
              {isCoachOrCaptain && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleDeleteEvent(evt.id); }}
                  className="p-2 text-slate-300 hover:text-red-600 transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
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

      {showEventSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-10 shadow-2xl border-t-8 border-violet-600">
            <div className="flex justify-between items-start mb-6 md:mb-8">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Event Settings</h2>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">{activeEvent?.name}</p>
              </div>
              <button onClick={() => setShowEventSettings(false)} className="p-2 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">TBA Event Key</label>
                <input
                  value={eventSettingsForm.tbaEventKey}
                  onChange={(e) => setEventSettingsForm({ ...eventSettingsForm, tbaEventKey: e.target.value })}
                  placeholder="e.g. 2026azgl"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Find your event key on thebluealliance.com</p>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">FRC Nexus Event Key</label>
                <div className="flex gap-2">
                  <input
                    value={eventSettingsForm.nexusEventKey}
                    onChange={(e) => { setEventSettingsForm({ ...eventSettingsForm, nexusEventKey: e.target.value }); setNexusTestStatus('idle'); }}
                    placeholder="e.g. 2026azgl"
                    className="flex-1 p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-violet-500 transition-all font-bold text-sm"
                  />
                  <button
                    onClick={handleTestNexus}
                    disabled={nexusTestStatus === 'testing'}
                    className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-1.5 ${
                      nexusTestStatus === 'ok' ? 'bg-green-600 text-white' :
                      nexusTestStatus === 'error' ? 'bg-red-600 text-white' :
                      nexusTestStatus === 'testing' ? 'bg-slate-200 text-slate-500' :
                      'bg-violet-600 text-white hover:bg-violet-700'
                    }`}
                  >
                    <Zap size={13} />
                    {nexusTestStatus === 'testing' ? 'Testing...' :
                     nexusTestStatus === 'ok' ? 'Connected!' :
                     nexusTestStatus === 'error' ? 'Failed' : 'Test'}
                  </button>
                </div>
                {nexusTestMsg && (
                  <p className={`text-[9px] font-bold ml-1 ${nexusTestStatus === 'ok' ? 'text-green-600' : 'text-red-500'}`}>{nexusTestMsg}</p>
                )}
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium">Enables live queue countdown & match schedule from frc.nexus</p>
              </div>

              <button
                onClick={handleSaveEventSettings}
                className="w-full py-4 bg-violet-600 text-white font-black rounded-xl hover:bg-violet-700 shadow-lg transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
              >
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
              <button onClick={() => setShowEventForm(false)} className="p-2 md:p-3 bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-600 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Event Name *</label>
                <input
                  autoFocus
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="e.g. Arizona North Regional"
                  className="w-full p-4 md:p-6 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-black text-base md:text-lg uppercase tracking-tight"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Location</label>
                <input
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="e.g. Phoenix, AZ"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">Start Date</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">End Date</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">TBA Event Key</label>
                <input
                  value={eventForm.tbaEventKey}
                  onChange={(e) => setEventForm({ ...eventForm, tbaEventKey: e.target.value })}
                  placeholder="e.g. 2026azgl"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium ml-2">Find your event key on thebluealliance.com (optional)</p>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-2">FRC Nexus Event Key</label>
                <input
                  value={eventForm.nexusEventKey}
                  onChange={(e) => setEventForm({ ...eventForm, nexusEventKey: e.target.value })}
                  placeholder="e.g. 2026azgl"
                  className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl md:rounded-[28px] outline-none focus:border-violet-500 transition-all font-bold text-sm"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium ml-2">Enables live queue countdown & match schedule from frc.nexus (optional)</p>
              </div>

              <button
                onClick={handleCreateEvent}
                disabled={!eventForm.name.trim()}
                className="w-full py-4 md:py-6 bg-red-600 text-white font-black rounded-xl md:rounded-[32px] hover:bg-red-700 shadow-2xl shadow-red-600/20 transition-all uppercase tracking-widest text-xs md:text-sm flex items-center justify-center gap-2 md:gap-3 disabled:opacity-50"
              >
                <Trophy size={16} />
                Create Event
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
              <button onClick={() => setGeminiModal({ open: false, text: '', matchLabel: '' })} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 dark:bg-slate-700 rounded-xl transition-all">
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
                      setCopiedGemini(true);
                      setTimeout(() => setCopiedGemini(false), 2000);
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

export default Scout;
