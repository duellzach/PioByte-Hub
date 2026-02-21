import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { Plus, ArrowLeft, Search, X, Star, ChevronLeft, ChevronRight, QrCode, Camera, Download, Upload, Bot, Swords, Trophy, Hash, Users, MapPin, Calendar, Trash2, Flame, Monitor } from 'lucide-react';
import pako from 'pako';
import { QRCodeSVG } from 'qrcode.react';

interface ScoutProps {
  currentUser: any;
}

const Counter: React.FC<{ label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; color?: string }> = ({ label, value, onChange, min = 0, max = 999, color = 'slate' }) => (
  <div className="flex flex-col items-center gap-2">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">{label}</span>
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl font-black text-lg bg-${color}-100 text-${color}-700 hover:bg-${color}-200 transition-all active:scale-95`}
      >−</button>
      <span className="w-10 md:w-12 text-center font-black text-lg text-slate-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-xl font-black text-lg bg-${color}-100 text-${color}-700 hover:bg-${color}-200 transition-all active:scale-95`}
      >+</button>
    </div>
  </div>
);

const StarRating: React.FC<{ value: number; onChange: (v: number) => void; max?: number; label: string }> = ({ value, onChange, max = 5, label }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
    <div className="flex gap-1">
      {Array.from({ length: max }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="p-0.5 transition-all active:scale-90"
        >
          <Star size={20} className={i < value ? 'text-yellow-500 fill-yellow-500' : 'text-slate-200'} />
        </button>
      ))}
    </div>
  </div>
);

const RatingSlider: React.FC<{ value: number; onChange: (v: number) => void; label: string }> = ({ value, onChange, label }) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
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
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold">
            {tag}
            <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="hover:text-red-900">
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
        className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
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

  const [eventForm, setEventForm] = useState({ name: '', location: '', startDate: '', endDate: '', tbaEventKey: '' });
  const [tbaMatches, setTbaMatches] = useState<any[]>([]);
  const [tbaRecord, setTbaRecord] = useState<{ wins: number; losses: number; ties: number } | null>(null);
  const [tbaLoading, setTbaLoading] = useState(false);
  const [tbaImporting, setTbaImporting] = useState(false);
  const [tbaRankings, setTbaRankings] = useState<Map<number, { rank: number; rp: number; record: string }>>(new Map());

  const [pitForm, setPitForm] = useState({
    teamNumber: 0, teamName: '', robotName: '', drivetrain: '', weight: 0, speed: 0, height: 0,
    capabilities: [] as string[], deficiencies: [] as string[], autonomousRoutine: 'None',
    notes: '', offenseRating: 5, defenseRating: 5, overallRating: 5
  });

  const [matchForm, setMatchForm] = useState({
    matchNumber: 1, teamNumber: 0, alliance: 'Red',
    penalties: 0, autoClimb: false, endClimbLevel: 0, coralScored: 0, algaeScored: 0,
    defenseRating: 3, notes: ''
  });

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<number>>(new Set());

  const [qrData, setQrData] = useState<string[]>([]);
  const [qrChunkIndex, setQrChunkIndex] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [scannedChunks, setScannedChunks] = useState<Map<string, string>>(new Map());
  const [importPreview, setImportPreview] = useState<any | null>(null);
  const scannerRef = useRef<any>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);

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
      setEventForm({ name: '', location: '', startDate: '', endDate: '', tbaEventKey: '' });
      fetchEvents();
    } catch (err) {
      console.error('Failed to create event:', err);
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
    try {
      const data = { ...matchForm, scoutedBy: parseInt(currentUser.id) };
      if (editingMatch) {
        await api.scout.updateMatchScout(editingMatch.id, data);
      } else {
        await api.scout.createMatchScout(activeEvent.id, data);
      }
      setShowMatchForm(false);
      setEditingMatch(null);
      resetMatchForm();
      fetchEventData(activeEvent.id);
    } catch (err) {
      console.error('Failed to save match scout:', err);
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
      capabilities: [], deficiencies: [], autonomousRoutine: 'None',
      notes: '', offenseRating: 5, defenseRating: 5, overallRating: 5
    });
  };

  const resetMatchForm = () => {
    setMatchForm({
      matchNumber: 1, teamNumber: 0, alliance: 'Red',
      penalties: 0, autoClimb: false, endClimbLevel: 0, coralScored: 0, algaeScored: 0,
      defenseRating: 3, notes: ''
    });
  };

  const openEditPit = (pit: any) => {
    setSelectedRobot(null);
    setEditingPit(pit);
    setPitForm({
      teamNumber: pit.teamNumber, teamName: pit.teamName, robotName: pit.robotName,
      drivetrain: pit.drivetrain, weight: pit.weight || 0, speed: pit.speed || 0, height: pit.height || 0,
      capabilities: pit.capabilities || [], deficiencies: pit.deficiencies || [],
      autonomousRoutine: pit.autonomousRoutine || 'None', notes: pit.notes || '',
      offenseRating: pit.offenseRating, defenseRating: pit.defenseRating, overallRating: pit.overallRating
    });
    setShowPitForm(true);
  };

  const openEditMatch = (match: any) => {
    setEditingMatch(match);
    setMatchForm({
      matchNumber: match.matchNumber, teamNumber: match.teamNumber, alliance: match.alliance,
      penalties: match.penalties, autoClimb: match.autoClimb, endClimbLevel: match.endClimbLevel,
      coralScored: match.coralScored, algaeScored: match.algaeScored,
      defenseRating: match.defenseRating, notes: match.notes
    });
    setShowMatchForm(true);
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
      const payload = { v: 2, m: slimMatches };
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
          if (parsed.v === 2 && Array.isArray(parsed.m)) {
            matchScouts = parsed.m.map(expandSlimMatch);
          } else if (Array.isArray(parsed)) {
            matchScouts = parsed.map(expandSlimMatch);
          } else if (parsed.matchScouts) {
            matchScouts = parsed.matchScouts;
          } else {
            matchScouts = [];
          }
          setImportPreview({ matchScouts });
          stopScanner();
        } catch (err) {
          console.error('Failed to decode QR data:', err);
        }
      }
      return next;
    });
  };

  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const confirmImport = async () => {
    if (!importPreview || !activeEvent) return;
    try {
      const matchesWithScout = (importPreview.matchScouts || []).map((m: any) => ({
        ...m,
        scoutedBy: m.scoutedBy || parseInt(currentUser.id),
      }));
      const result = await api.scout.importEvent(activeEvent.id, { matchScouts: matchesWithScout });
      setImportResult({ imported: result.imported || 0, skipped: result.skipped || 0 });
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
  );

  const sortedMatches = [...matchScoutsData].sort((a, b) => a.matchNumber - b.matchNumber);

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

  if (selectedRobot && activeEvent) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelectedRobot(null)} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Team {selectedRobot.teamNumber}</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{selectedRobot.teamName || 'Unknown Team'} • {selectedRobot.robotName || 'Unnamed Robot'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Robot Specs</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Drivetrain</p>
                <p className="text-sm font-black text-slate-900 mt-1">{selectedRobot.drivetrain || '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight</p>
                <p className="text-sm font-black text-slate-900 mt-1">{selectedRobot.weight ? `${selectedRobot.weight} lbs` : '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Speed</p>
                <p className="text-sm font-black text-slate-900 mt-1">{selectedRobot.speed ? `${selectedRobot.speed} ft/s` : '—'}</p>
              </div>
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Height</p>
                <p className="text-sm font-black text-slate-900 mt-1">{selectedRobot.height ? `${selectedRobot.height}"` : '—'}</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Autonomous</p>
              <p className="text-sm font-black text-slate-900 mt-1">{selectedRobot.autonomousRoutine || '—'}</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8 space-y-6">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Ratings</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4">
                <span className="text-sm font-bold text-slate-600">Offense</span>
                <span className="text-lg font-black text-red-600">{selectedRobot.offenseRating}/10</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4">
                <span className="text-sm font-bold text-slate-600">Defense</span>
                <span className="text-lg font-black text-blue-600">{selectedRobot.defenseRating}/10</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 rounded-xl p-4">
                <span className="text-sm font-bold text-slate-600">Overall</span>
                <span className="text-lg font-black text-green-600">{selectedRobot.overallRating}/10</span>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEditPit(selectedRobot)} className="flex-1 py-3 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-700 transition-all">
                Edit
              </button>
              <button onClick={() => handleDeletePitScout(selectedRobot.id)} className="px-4 py-3 bg-slate-100 text-red-600 font-black rounded-xl hover:bg-red-50 transition-all">
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {(selectedRobot.capabilities?.length > 0 || selectedRobot.deficiencies?.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {selectedRobot.capabilities?.length > 0 && (
              <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Capabilities</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRobot.capabilities.map((c: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {selectedRobot.deficiencies?.length > 0 && (
              <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Deficiencies</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedRobot.deficiencies.map((d: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-full text-xs font-bold">{d}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {selectedRobot.notes && (
          <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Notes</h3>
            <p className="text-sm text-slate-700 font-medium whitespace-pre-wrap">{selectedRobot.notes}</p>
          </div>
        )}

        {robotMatches.length > 0 && (() => {
          const totalFuelScored = robotMatches.reduce((s, m) => s + (m.coralScored || 0), 0);
          const totalFuelMissed = robotMatches.reduce((s, m) => s + (m.algaeScored || 0), 0);
          const totalFuelAttempted = totalFuelScored + totalFuelMissed;
          const fuelAccuracy = totalFuelAttempted > 0 ? ((totalFuelScored / totalFuelAttempted) * 100).toFixed(1) : '—';
          const avgFuelPerMatch = (totalFuelScored / robotMatches.length).toFixed(1);
          const avgFuelCapacity = ((totalFuelScored + totalFuelMissed) / robotMatches.length).toFixed(1);
          const climbMatches = robotMatches.filter(m => m.endClimbLevel > 0).length;
          const climbRate = ((climbMatches / robotMatches.length) * 100).toFixed(0);
          const maxClimbLevel = Math.max(...robotMatches.map(m => m.endClimbLevel || 0));
          const autoClimbCount = robotMatches.filter(m => m.autoClimb).length;
          const avgDefenseRating = (robotMatches.reduce((s, m) => s + (m.defenseRating || 0), 0) / robotMatches.length).toFixed(1);
          const totalPenalties = robotMatches.reduce((s, m) => s + (m.penalties || 0), 0);
          const avgPenalties = (totalPenalties / robotMatches.length).toFixed(1);
          const bestMatch = robotMatches.reduce((best, m) => (m.coralScored || 0) > (best.coralScored || 0) ? m : best, robotMatches[0]);
          const avgScore = ((totalFuelScored - totalPenalties) / robotMatches.length).toFixed(1);

          return (
            <>
              <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Performance Analysis ({robotMatches.length} matches)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                  <div className="bg-orange-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-orange-600">{fuelAccuracy}%</p>
                    <p className="text-[9px] font-black text-orange-400 uppercase tracking-widest mt-1">Fuel Accuracy</p>
                  </div>
                  <div className="bg-red-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-red-600">{avgFuelPerMatch}</p>
                    <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-1">Avg Fuel/Match</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-blue-600">{avgFuelCapacity}</p>
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-1">Avg Attempts</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-green-600">{avgScore}</p>
                    <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mt-1">Avg Net Score</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mt-4">
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-purple-600">{climbRate}%</p>
                    <p className="text-[9px] font-black text-purple-400 uppercase tracking-widest mt-1">Climb Rate</p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-indigo-600">L{maxClimbLevel}</p>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mt-1">Max Climb</p>
                  </div>
                  <div className="bg-teal-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-teal-600">{avgDefenseRating}</p>
                    <p className="text-[9px] font-black text-teal-400 uppercase tracking-widest mt-1">Avg Defense</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-black text-amber-600">{avgPenalties}</p>
                    <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mt-1">Avg Penalties</p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Best Match</p>
                    <p className="text-sm font-black text-slate-900 mt-1">Match {bestMatch.matchNumber} — {bestMatch.coralScored} fuel scored</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auto Climb</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{autoClimbCount}/{robotMatches.length} matches ({((autoClimbCount / robotMatches.length) * 100).toFixed(0)}%)</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Fuel Scored</p>
                    <p className="text-sm font-black text-slate-900 mt-1">{totalFuelScored} of {totalFuelAttempted} attempted</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Match History</h3>
                <div className="space-y-3">
                  {robotMatches.sort((a, b) => a.matchNumber - b.matchNumber).map(m => (
                    <div key={m.id} className={`p-4 rounded-xl border-2 ${m.alliance === 'Red' ? 'border-red-200 bg-red-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase ${m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                            Match {m.matchNumber}
                          </span>
                          <span className="text-sm font-bold text-slate-700">
                            Fuel: {m.coralScored} scored, {m.algaeScored} missed
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
                          <span className="text-lg font-black text-slate-900">{m.coralScored - m.penalties}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}
      </div>
    );
  }

  if (activeEvent) {
    return (
      <div className="space-y-4 md:space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 md:gap-4">
            <button onClick={() => { setActiveEvent(null); fetchEvents(); }} className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">{activeEvent.name}</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                {activeEvent.location && `${activeEvent.location} • `}
                {activeEvent.startDate && activeEvent.startDate}
                {activeEvent.endDate && ` — ${activeEvent.endDate}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 text-[10px]">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <Bot size={14} className="text-red-600" />
              <span className="font-black text-slate-800">{pitScouts.length}</span>
              <span className="text-slate-400 font-bold">robots</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <Swords size={14} className="text-red-600" />
              <span className="font-black text-slate-800">{matchScoutsData.length}</span>
              <span className="text-slate-400 font-bold">matches</span>
            </div>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-inner">
          {(['robots', 'matches', 'qr', 'display'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {tab === 'robots' ? 'Robots' : tab === 'matches' ? 'Matches' : tab === 'qr' ? 'QR Share' : 'Pit Display'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">Loading...</div>
        ) : activeTab === 'robots' ? (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search teams..."
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
              </div>
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
                  className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-5 md:p-6 hover:border-red-600/30 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center font-black text-sm">
                        {ps.teamNumber}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{ps.teamName || `Team ${ps.teamNumber}`}</p>
                        <p className="text-[10px] text-slate-400 font-bold truncate">{ps.robotName || 'Unnamed'} • {ps.drivetrain || '—'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[9px] font-black">OFF {ps.offenseRating}</span>
                    <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black">DEF {ps.defenseRating}</span>
                    <span className="px-2 py-1 bg-green-50 text-green-600 rounded-lg text-[9px] font-black">OVR {ps.overallRating}</span>
                  </div>
                </div>
              ))}
            </div>

            {filteredPitScouts.length === 0 && (
              <div className="py-16 text-center">
                <Bot size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-300 uppercase tracking-tight">No Robots Scouted</p>
                <p className="text-slate-400 text-sm mt-1">Start scouting to add robots</p>
              </div>
            )}
          </div>
        ) : activeTab === 'matches' ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={() => { resetMatchForm(); setEditingMatch(null); setShowMatchForm(true); }}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] tracking-widest"
              >
                <Plus size={16} /> Record Match
              </button>
            </div>

            <div className="space-y-3">
              {sortedMatches.map(m => (
                <div
                  key={m.id}
                  className={`bg-white rounded-2xl border-2 p-4 md:p-5 ${m.alliance === 'Red' ? 'border-red-200' : 'border-blue-200'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 md:gap-4">
                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                        m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                      }`}>
                        M{m.matchNumber}
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-900">Team {m.teamNumber}</p>
                        <p className="text-[10px] text-slate-400 font-bold">
                          Fuel: {m.coralScored} scored, {m.algaeScored} missed | Pen: -{m.penalties}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black text-slate-900">{m.coralScored - m.penalties}</span>
                      <div className="flex gap-1">
                        <button onClick={() => openEditMatch(m)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-all text-slate-500 text-[10px] font-black">Edit</button>
                        <button onClick={() => handleDeleteMatchScout(m.id)} className="p-2 bg-slate-100 rounded-lg hover:bg-red-50 transition-all text-red-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {m.notes && <p className="text-[10px] text-slate-500 mt-2 pl-12 font-medium">{m.notes}</p>}
                </div>
              ))}
            </div>

            {sortedMatches.length === 0 && (
              <div className="py-16 text-center">
                <Swords size={48} className="text-slate-200 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-300 uppercase tracking-tight">No Matches Recorded</p>
                <p className="text-slate-400 text-sm mt-1">Record match data to track performance</p>
              </div>
            )}
          </div>
        ) : activeTab === 'qr' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                  <Download size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Export Data</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Share via QR code</p>
                </div>
              </div>

              {matchScoutsData.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Select Matches to Export</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMatchIds(new Set(matchScoutsData.map((m: any) => m.id)))}
                        className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all"
                      >Select All</button>
                      <button
                        type="button"
                        onClick={() => setSelectedMatchIds(new Set())}
                        className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[9px] font-black hover:bg-slate-200 transition-all"
                      >Deselect All</button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 border-2 border-slate-100 rounded-xl p-2">
                    {[...matchScoutsData].sort((a, b) => a.matchNumber - b.matchNumber).map((m: any) => (
                      <label key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer transition-all">
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
                        <span className="text-xs font-black text-slate-700">M{m.matchNumber}</span>
                        <span className="text-xs font-bold text-slate-500">Team {m.teamNumber}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${m.alliance === 'Red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'}`}>
                          {m.alliance}
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold">
                    {selectedMatchIds.size === 0 ? 'All matches will be exported' : `${selectedMatchIds.size} match${selectedMatchIds.size !== 1 ? 'es' : ''} selected`}
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
                  <div className="bg-white p-4 rounded-xl border-2 border-slate-100">
                    <QRCodeSVG value={qrData[qrChunkIndex]} size={240} />
                  </div>
                  {qrData.length > 1 && (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setQrChunkIndex(Math.max(0, qrChunkIndex - 1))}
                        disabled={qrChunkIndex === 0}
                        className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={20} />
                      </button>
                      <span className="text-sm font-black text-slate-600">
                        {qrChunkIndex + 1} / {qrData.length}
                      </span>
                      <button
                        onClick={() => setQrChunkIndex(Math.min(qrData.length - 1, qrChunkIndex + 1))}
                        disabled={qrChunkIndex === qrData.length - 1}
                        className="p-2 bg-slate-100 rounded-xl hover:bg-slate-200 disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={20} />
                      </button>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-400 font-bold text-center">
                    {selectedMatchIds.size > 0 ? `${selectedMatchIds.size} of ${matchScoutsData.length}` : matchScoutsData.length} match records encoded
                  </p>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <Upload size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">Import Data</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Scan QR code to import</p>
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
                  <p className="text-[10px] text-slate-400 font-bold text-center uppercase">
                    Scanned {scannedChunks.size} chunk{scannedChunks.size !== 1 ? 's' : ''}...
                  </p>
                  <button
                    onClick={stopScanner}
                    className="w-full py-3 bg-slate-200 text-slate-600 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-slate-300 transition-all"
                  >
                    Cancel Scanning
                  </button>
                </div>
              )}

              {importPreview && (
                <div className="space-y-4">
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <p className="text-sm font-black text-green-800 mb-2">Data Ready to Import</p>
                    <p className="text-xs text-green-700 font-bold">
                      {importPreview.matchScouts?.length || 0} match records found
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => { setImportPreview(null); setScannedChunks(new Map()); }}
                      className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase tracking-widest text-xs"
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
                  <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                    <p className="text-sm font-black text-green-800 mb-2">Import Complete</p>
                    <p className="text-xs text-green-700 font-bold">
                      {importResult.imported} match{importResult.imported !== 1 ? 'es' : ''} imported
                    </p>
                    {importResult.skipped > 0 && (
                      <p className="text-xs text-amber-600 font-bold mt-1">
                        {importResult.skipped} duplicate{importResult.skipped !== 1 ? 's' : ''} skipped (already in database)
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setImportResult(null)}
                    className="w-full py-3 bg-slate-100 text-slate-600 font-black rounded-xl uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'display' ? (
          <div className="space-y-6 md:space-y-8">
            {tbaRecord && (
              <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-4 md:p-6">
                <div className="flex items-center justify-center gap-6">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Team 10991 Record</span>
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
              <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">Event Schedule</h3>
                  <button onClick={() => fetchTbaData(activeEvent.tbaEventKey)} className="px-4 py-2 bg-slate-100 text-slate-600 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Refresh
                  </button>
                </div>

                {tbaLoading ? (
                  <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">Loading schedule...</div>
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
                                    className={`${hasScouted ? 'text-red-600 underline cursor-pointer hover:text-red-800' : 'text-slate-700'} font-black`}
                                  >
                                    {num}
                                  </span>
                                );
                              };
                              return (
                                <div key={m.key} className={`p-4 rounded-xl border-2 ${ourAlliance === 'red' ? 'border-red-200 bg-red-50/50' : 'border-blue-200 bg-blue-50/50'}`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                                        ourAlliance === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                                      }`}>
                                        {getMatchLabel(m)}
                                      </span>
                                      <div>
                                        <p className="text-sm text-slate-900 flex items-center gap-1">
                                          <span className="text-slate-400 text-xs">w/</span> {partnerKeys.length > 0 ? partnerKeys.map((t: string, i: number) => (
                                            <span key={t}>{i > 0 && <span className="text-slate-300">, </span>}{renderTeamLink(t)}</span>
                                          )) : '—'}
                                        </p>
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                          <span className="text-slate-400">vs</span> {opponentKeys.length > 0 ? opponentKeys.map((t: string, i: number) => (
                                            <span key={t}>{i > 0 && <span className="text-slate-300">, </span>}{renderTeamLink(t)}</span>
                                          )) : '—'}
                                        </p>
                                      </div>
                                    </div>
                                    {time && (
                                      <span className="text-xs font-bold text-slate-500">
                                        {new Date(time * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles' })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {playedMatches.length > 0 && (
                        <div>
                          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Completed Matches</h4>
                          <div className="space-y-2">
                            {playedMatches.map((m: any) => {
                              const ourAlliance = getOurAlliance(m);
                              const didWin = m.winning_alliance === ourAlliance;
                              const didTie = m.winning_alliance === '';
                              const ourScore = m.alliances?.[ourAlliance]?.score ?? '—';
                              const theirScore = m.alliances?.[ourAlliance === 'red' ? 'blue' : 'red']?.score ?? '—';
                              return (
                                <div key={m.key} className={`p-4 rounded-xl border-2 ${
                                  didWin ? 'border-green-200 bg-green-50/50' : didTie ? 'border-yellow-200 bg-yellow-50/50' : 'border-slate-200 bg-slate-50/50'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <span className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase ${
                                        ourAlliance === 'red' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white'
                                      }`}>
                                        {getMatchLabel(m)}
                                      </span>
                                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                                        didWin ? 'bg-green-100 text-green-700' : didTie ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {didWin ? 'WIN' : didTie ? 'TIE' : 'LOSS'}
                                      </span>
                                    </div>
                                    <span className="text-lg font-black text-slate-900">
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
              <div className="bg-yellow-50 rounded-2xl md:rounded-[32px] border-2 border-yellow-200 p-6 md:p-8 text-center">
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
                <div className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">
                      {hasRankings ? 'Event Rankings' : 'Scouted Robot Leaderboard'}
                    </h3>
                    {hasRankings && (
                      <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg">
                        TBA Ranking Points
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    {sorted.map((ps: any, idx: number) => {
                      const ranking = tbaRankings.get(ps.teamNumber);
                      return (
                        <div
                          key={ps.id}
                          onClick={() => setSelectedRobot(ps)}
                          className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-all"
                        >
                          <span className={`w-10 h-10 flex items-center justify-center rounded-xl font-black text-lg ${
                            idx === 0 ? 'bg-yellow-100 text-yellow-700' : idx === 1 ? 'bg-slate-200 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {ranking ? `#${ranking.rank}` : idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-base md:text-lg font-black text-slate-900 truncate">
                              Team {ps.teamNumber} {ps.teamName ? `— ${ps.teamName}` : ''}
                            </p>
                            <p className="text-[10px] text-slate-400 font-bold truncate">
                              {ranking ? `${ranking.record} • ${ranking.rp.toFixed(2)} RP` : `${ps.robotName || 'Unnamed'} • ${ps.drivetrain || '—'}`}
                            </p>
                          </div>
                          <div className="flex gap-2 md:gap-3 flex-shrink-0">
                            <span className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-black">OFF {ps.offenseRating}</span>
                            <span className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-black">DEF {ps.defenseRating}</span>
                            <span className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-black">OVR {ps.overallRating}</span>
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
            <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
              <div className="flex justify-between items-start mb-6 md:mb-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase">
                    {editingPit ? 'Edit Robot' : 'Scout Robot'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Pit scouting form</p>
                </div>
                <button onClick={() => { setShowPitForm(false); setEditingPit(null); }} className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Number *</span>
                    <input
                      type="number"
                      value={pitForm.teamNumber || ''}
                      onChange={(e) => setPitForm({ ...pitForm, teamNumber: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                      placeholder="10991"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Name</span>
                    <input
                      value={pitForm.teamName}
                      onChange={(e) => setPitForm({ ...pitForm, teamName: e.target.value })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                      placeholder="Team Name"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Robot Name</span>
                    <input
                      value={pitForm.robotName}
                      onChange={(e) => setPitForm({ ...pitForm, robotName: e.target.value })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                      placeholder="Robot Name"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Drivetrain</span>
                    <select
                      value={pitForm.drivetrain}
                      onChange={(e) => setPitForm({ ...pitForm, drivetrain: e.target.value })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
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
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Weight (lbs)</span>
                    <input
                      type="number"
                      value={pitForm.weight || ''}
                      onChange={(e) => setPitForm({ ...pitForm, weight: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Speed (ft/s)</span>
                    <input
                      type="number"
                      value={pitForm.speed || ''}
                      onChange={(e) => setPitForm({ ...pitForm, speed: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Height (in)</span>
                    <input
                      type="number"
                      value={pitForm.height || ''}
                      onChange={(e) => setPitForm({ ...pitForm, height: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Autonomous Routine</span>
                  <select
                    value={pitForm.autonomousRoutine}
                    onChange={(e) => setPitForm({ ...pitForm, autonomousRoutine: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                  >
                    <option value="None">None</option>
                    <option value="Basic">Basic</option>
                    <option value="Motion Profiling">Motion Profiling</option>
                    <option value="Vision">Vision</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

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
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes</span>
                  <textarea
                    value={pitForm.notes}
                    onChange={(e) => setPitForm({ ...pitForm, notes: e.target.value })}
                    className="w-full h-24 p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-medium text-sm resize-none"
                    placeholder="Additional observations..."
                  />
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
            <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-2xl max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
              <div className="flex justify-between items-start mb-6 md:mb-8">
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter uppercase">
                    {editingMatch ? 'Edit Match' : 'Record Match'}
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Match scouting form</p>
                </div>
                <button onClick={() => { setShowMatchForm(false); setEditingMatch(null); }} className="p-2 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Match Number</span>
                    <input
                      type="number"
                      value={matchForm.matchNumber}
                      onChange={(e) => setMatchForm({ ...matchForm, matchNumber: parseInt(e.target.value) || 1 })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                      min={1}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Number</span>
                    <input
                      type="number"
                      value={matchForm.teamNumber || ''}
                      onChange={(e) => setMatchForm({ ...matchForm, teamNumber: parseInt(e.target.value) || 0 })}
                      className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-black text-lg"
                      placeholder="10991"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Alliance</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMatchForm({ ...matchForm, alliance: 'Red' })}
                      className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
                        matchForm.alliance === 'Red' ? 'bg-red-600 text-white shadow-lg shadow-red-600/30' : 'bg-red-100 text-red-400'
                      }`}
                    >Red</button>
                    <button
                      type="button"
                      onClick={() => setMatchForm({ ...matchForm, alliance: 'Blue' })}
                      className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest text-sm transition-all ${
                        matchForm.alliance === 'Blue' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-blue-100 text-blue-400'
                      }`}
                    >Blue</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <Counter label="Fuel Scored" value={matchForm.coralScored} onChange={(v) => setMatchForm({ ...matchForm, coralScored: v })} color="green" />
                  <Counter label="Fuel Missed" value={matchForm.algaeScored} onChange={(v) => setMatchForm({ ...matchForm, algaeScored: v })} color="orange" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auto Climb</span>
                    <button
                      type="button"
                      onClick={() => setMatchForm({ ...matchForm, autoClimb: !matchForm.autoClimb })}
                      className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
                        matchForm.autoClimb ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {matchForm.autoClimb ? 'Yes' : 'No'}
                    </button>
                  </div>
                  <Counter label="Climb Level" value={matchForm.endClimbLevel} onChange={(v) => setMatchForm({ ...matchForm, endClimbLevel: v })} min={0} max={3} />
                </div>

                <Counter label="Penalties" value={matchForm.penalties} onChange={(v) => setMatchForm({ ...matchForm, penalties: v })} />

                <StarRating value={matchForm.defenseRating} onChange={(v) => setMatchForm({ ...matchForm, defenseRating: v })} max={5} label="Defense Rating" />

                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes</span>
                  <textarea
                    value={matchForm.notes}
                    onChange={(e) => setMatchForm({ ...matchForm, notes: e.target.value })}
                    className="w-full h-20 p-3 bg-slate-50 border-2 border-slate-100 rounded-[24px] outline-none focus:border-red-600 transition-all font-medium text-sm resize-none"
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
          <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Scout</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Tournament event scouting</p>
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
            className="bg-white rounded-2xl md:rounded-[32px] border-2 border-slate-100 p-6 md:p-8 hover:border-red-600/30 transition-all cursor-pointer group"
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
            <h3 className="text-base md:text-lg font-black text-slate-900 uppercase tracking-tight mb-1">{evt.name}</h3>
            {evt.location && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mb-1">
                <MapPin size={12} /> {evt.location}
              </div>
            )}
            {evt.startDate && (
              <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold mb-3">
                <Calendar size={12} /> {evt.startDate}{evt.endDate && ` — ${evt.endDate}`}
              </div>
            )}
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black border border-slate-100">
                {eventCounts[evt.id]?.pits || 0} robots
              </span>
              <span className="px-2 py-1 bg-slate-50 text-slate-500 rounded-lg text-[9px] font-black border border-slate-100">
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
          <p className="text-slate-400 text-sm mt-1">
            {isCoachOrCaptain ? 'Create your first tournament event to start scouting' : 'Ask a Coach or Captain to create an event'}
          </p>
        </div>
      )}

      {showEventForm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl md:rounded-[40px] w-full max-w-xl p-6 md:p-12 shadow-2xl border-t-8 border-red-600">
            <div className="flex justify-between items-start mb-6 md:mb-10">
              <div>
                <h2 className="text-xl md:text-3xl font-black text-slate-900 tracking-tighter uppercase">New Event</h2>
                <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Create a tournament event</p>
              </div>
              <button onClick={() => setShowEventForm(false)} className="p-2 md:p-3 bg-slate-50 text-slate-400 hover:text-red-600 rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 md:space-y-6">
              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Event Name *</label>
                <input
                  autoFocus
                  value={eventForm.name}
                  onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })}
                  placeholder="e.g. Arizona North Regional"
                  className="w-full p-4 md:p-6 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-black text-base md:text-lg uppercase tracking-tight"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Location</label>
                <input
                  value={eventForm.location}
                  onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                  placeholder="e.g. Phoenix, AZ"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Start Date</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">End Date</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                    className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">TBA Event Key</label>
                <input
                  value={eventForm.tbaEventKey}
                  onChange={(e) => setEventForm({ ...eventForm, tbaEventKey: e.target.value })}
                  placeholder="e.g. 2026azgl"
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[28px] outline-none focus:border-red-600 transition-all font-bold text-sm"
                />
                <p className="text-[9px] text-slate-400 font-medium ml-2">Find your event key on thebluealliance.com (optional)</p>
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
    </div>
  );
};

export default Scout;
