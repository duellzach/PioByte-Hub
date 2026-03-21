import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../services/api';
import { Plus, ArrowLeft, Search, X, ChevronLeft, ChevronRight, QrCode, Camera, Download, Upload, Bot, Swords, Trophy, Hash, Users, MapPin, Calendar, Trash2, Flame, Monitor, WifiOff, Wifi, ArrowUpDown, Grid3X3, List, ImageIcon, Brain, Video, UserCheck, AlertCircle, Copy, Check, Settings, Zap } from 'lucide-react';
import pako from 'pako';
import { QRCodeSVG } from 'qrcode.react';
import { getOfflineQueue, addToOfflineQueue, syncOfflineQueue, type OfflineMatchEntry } from '../services/offlineQueue';
import { ROLE_COLORS } from '../constants';
import { Counter, StarRating, RatingSlider, TagInput } from './scout/shared';
import RobotDashboard from './scout/RobotDashboard';
import PitScoutForm from './scout/PitScoutForm';
import MatchScoutForm from './scout/MatchScoutForm';
import ScoutQR from './scout/ScoutQR';
import PitDisplay from './scout/PitDisplay';
import PitMap from './scout/PitMap';
import ScoutEventList from './scout/ScoutEventList';

interface ScoutProps {
  currentUser: any;
}

const Scout: React.FC<ScoutProps> = ({ currentUser }) => {
  const [events, setEvents] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'robots' | 'matches' | 'info' | 'schedule' | 'qr' | 'display' | 'map'>('robots');
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
  const [pitSubTab, setPitSubTab] = useState<'live' | 'rankings'>('live');

  const [pitForm, setPitForm] = useState({
    teamNumber: 0, teamName: '', robotName: '', drivetrain: '', weight: 0, speed: 0, height: 0,
    fuelCapacity: 0, traversalAbility: '', shooterType: '',
    capabilities: [] as string[], deficiencies: [] as string[],
    autonomousRoutine: 'None', autoOptions: [] as string[],
    notes: '', offenseRating: 5, defenseRating: 5, overallRating: 5, coreValuesRating: 3, photoUrl: ''
  });

  const [matchForm, setMatchForm] = useState({
    matchNumber: 1, matchType: 'qualification', teamNumber: 0, alliance: 'Red',
    penalties: 0, autoClimb: false, endClimbLevel: 0, coralScored: 0, algaeScored: 0,
    autoFuelTotal: 0, teleopFuelTotal: 0,
    defenseRating: 3, drivingSkillRating: 3,
    autoUsed: '', notes: ''
  });

  const [matchClaims, setMatchClaims] = useState<Record<string, { userId: number; userName: string }>>(() => {
    try { return JSON.parse(localStorage.getItem(`piobyte_claims`) || '{}'); } catch { return {}; }
  });
  const [teamClaims, setTeamClaims] = useState<Record<string, { userId: number; userName: string }>>({});
  const activeTeamClaimRef = useRef<{ matchKey: string; teamNumber: number } | null>(null);
  const teamClaimsPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const [pitMapData, setPitMapData] = useState<any | null>(null);
  const [pitMapLoading, setPitMapLoading] = useState(false);
  const [pitMapError, setPitMapError] = useState<string | null>(null);
  const [nexusCountdown, setNexusCountdown] = useState<string>('');
  const nexusPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nexusCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [showEventSettings, setShowEventSettings] = useState(false);
  const [eventSettingsForm, setEventSettingsForm] = useState({ tbaEventKey: '', nexusEventKey: '' });
  const [nexusTestStatus, setNexusTestStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [nexusTestMsg, setNexusTestMsg] = useState('');
  const [nexusToast, setNexusToast] = useState<{ type: 'ok' | 'error'; msg: string } | null>(null);
  const nexusToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dismissedBreaks, setDismissedBreaks] = useState<Set<string>>(new Set());
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<Set<string>>(new Set());
  const [dismissedParts, setDismissedParts] = useState<Set<string>>(new Set());

  const [pitDisplayAlerts, setPitDisplayAlerts] = useState<any[]>([]);
  const [dismissedPitAlertIds, setDismissedPitAlertIds] = useState<Set<number>>(() => {
    try {
      const s = sessionStorage.getItem('piobyte_dismissed_pit_alerts');
      return s ? new Set(JSON.parse(s)) : new Set<number>();
    } catch { return new Set<number>(); }
  });

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [eventInfoData, setEventInfoData] = useState<any | null>(null);
  const [editingEventInfo, setEditingEventInfo] = useState(false);
  const [eventInfoForm, setEventInfoForm] = useState({ venueInfo: '', wifiNetwork: '', wifiPassword: '', parkingInfo: '', schedule: '', resources: '', notes: '' });
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [showAssignmentForm, setShowAssignmentForm] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<any | null>(null);
  const [assignmentForm, setAssignmentForm] = useState({ userId: 0, fromMatch: 1, toMatch: 10, role: 'Scout - Stands', notes: '' });

  const ASSIGNMENT_ROLES = ['Scout - Stands', 'Pit Crew', 'Networking', 'Media', 'Free Time', 'Driver/Coach Support'];
  const ROLE_CHIP_COLORS: Record<string, string> = {
    'Scout - Stands': 'bg-red-500 text-white',
    'Pit Crew': 'bg-orange-500 text-white',
    'Networking': 'bg-blue-500 text-white',
    'Media': 'bg-violet-500 text-white',
    'Free Time': 'bg-green-500 text-white',
    'Driver/Coach Support': 'bg-indigo-500 text-white',
  };

  const fetchEventInfoData = useCallback(async (eventId: number) => {
    try {
      const data = await api.eventInfo.get(eventId);
      setEventInfoData(data || null);
    } catch (err) {
      console.error('Failed to fetch event info:', err);
    }
  }, []);

  const fetchAssignments = useCallback(async (eventId: number) => {
    setAssignmentsLoading(true);
    try {
      const data = await api.competitionAssignments.list(eventId);
      setAssignments(data);
    } catch (err) {
      console.error('Failed to fetch assignments:', err);
    }
    setAssignmentsLoading(false);
  }, []);

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

  const fetchPitMap = useCallback(async (eventKey: string) => {
    if (!eventKey) return;
    setPitMapLoading(true);
    setPitMapError(null);
    try {
      const data = await api.nexus.getPitMap(eventKey);
      setPitMapData(data);
    } catch (err: any) {
      const status: number = err?.status ?? 0;
      if (status === 404) {
        setPitMapData(null);
        setPitMapError('NO_MAP');
      } else if (status === 503) {
        setPitMapData(null);
        setPitMapError('NOT_CONFIGURED');
      } else {
        setPitMapError(err?.message || 'Failed to load pit map');
        setPitMapData(null);
      }
    } finally {
      setPitMapLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'map') return;
    const key = activeEvent?.nexusEventKey;
    if (!key) return;
    if (!pitMapData && !pitMapLoading) {
      fetchPitMap(key);
    }
  }, [activeTab, activeEvent, pitMapData, pitMapLoading, fetchPitMap]);

  useEffect(() => {
    setPitMapData(null);
    setPitMapError(null);
  }, [activeEvent?.id]);

  useEffect(() => {
    if (nexusPollRef.current) clearInterval(nexusPollRef.current);
    if (nexusCountdownRef.current) clearInterval(nexusCountdownRef.current);
    setNexusData(null);
    setNexusError(null);
    setNexusCountdown('');
    setDismissedBreaks(new Set());
    setDismissedAnnouncements(new Set());
    setDismissedParts(new Set());

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
    if (activeTab !== 'display') return;
    const fetchPitAlerts = async () => {
      try {
        const alerts = await api.fullscreenAlerts.list(true);
        setPitDisplayAlerts(alerts.filter((a: any) => a.targetPitDisplay && a.active));
      } catch {}
    };
    fetchPitAlerts();
    const interval = setInterval(fetchPitAlerts, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const dismissPitAlert = (id: number) => {
    setDismissedPitAlertIds(prev => {
      const next = new Set(prev);
      next.add(id);
      try { sessionStorage.setItem('piobyte_dismissed_pit_alerts', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

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

  useEffect(() => {
    api.users.getAll().then(setAllUsers).catch(() => {});
  }, []);

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
    setEventInfoData(null);
    setAssignments([]);
    setEditingEventInfo(false);
    fetchEventData(event.id);
    fetchEventInfoData(event.id);
    fetchAssignments(event.id);
    if (event.tbaEventKey) fetchTbaData(event.tbaEventKey);
  };

  useEffect(() => {
    if (!activeEvent) return;
    fetchTeamClaims();
    if (teamClaimsPollRef.current) clearInterval(teamClaimsPollRef.current);
    teamClaimsPollRef.current = setInterval(fetchTeamClaims, 30000);
    return () => {
      if (teamClaimsPollRef.current) clearInterval(teamClaimsPollRef.current);
    };
  }, [activeEvent?.id]);

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
    const tba = activeEvent?.tbaEventKey || '';
    const nexus = activeEvent?.nexusEventKey || '';
    setEventSettingsForm({
      tbaEventKey: tba,
      nexusEventKey: nexus || tba,
    });
    setNexusTestStatus('idle');
    setNexusTestMsg('');
    setShowEventSettings(true);
  };

  const handleSaveEventSettings = async () => {
    if (!activeEvent) return;
    try {
      const updated = await api.scout.updateEvent(activeEvent.id, eventSettingsForm);
      const merged = updated || { ...activeEvent, ...eventSettingsForm };
      setActiveEvent(merged);
      setShowEventSettings(false);
      if (merged.tbaEventKey) fetchTbaData(merged.tbaEventKey);
      if (merged.nexusEventKey) fetchNexusData(merged.nexusEventKey);
    } catch (err) {
      console.error('Failed to update event settings:', err);
    }
  };

  const showNexusToast = (type: 'ok' | 'error', msg: string) => {
    if (nexusToastTimerRef.current) clearTimeout(nexusToastTimerRef.current);
    setNexusToast({ type, msg });
    nexusToastTimerRef.current = setTimeout(() => setNexusToast(null), 4000);
  };

  const handleTestNexus = async () => {
    const key = eventSettingsForm.nexusEventKey.trim();
    if (!key) {
      setNexusTestStatus('error');
      setNexusTestMsg('Enter a Nexus event key first');
      showNexusToast('error', 'Enter a Nexus event key first');
      return;
    }
    setNexusTestStatus('testing');
    setNexusTestMsg('');
    try {
      await api.nexus.getEvent(key);
      setNexusTestStatus('ok');
      setNexusTestMsg('Connected successfully!');
      showNexusToast('ok', `Nexus connected for event "${key}"`);
    } catch (err: any) {
      const msg = err?.message || 'Connection failed';
      setNexusTestStatus('error');
      setNexusTestMsg(msg);
      showNexusToast('error', `Nexus error: ${msg}`);
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
        if (activeTeamClaimRef.current) {
          unclaimTeam(activeTeamClaimRef.current.matchKey, activeTeamClaimRef.current.teamNumber);
        }
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
      if (activeTeamClaimRef.current) {
        unclaimTeam(activeTeamClaimRef.current.matchKey, activeTeamClaimRef.current.teamNumber);
      }
      setShowMatchForm(false);
      resetMatchForm();
      fetchEventData(activeEvent.id);
    } catch (err) {
      addToOfflineQueue({ eventId: activeEvent.id, data });
      setOfflineQueue(getOfflineQueue());
      setSyncMessage('Saved offline — will sync when connected');
      setTimeout(() => setSyncMessage(null), 4000);
      if (activeTeamClaimRef.current) {
        unclaimTeam(activeTeamClaimRef.current.matchKey, activeTeamClaimRef.current.teamNumber);
      }
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
      notes: '', offenseRating: 5, defenseRating: 5, overallRating: 5, coreValuesRating: 3, photoUrl: ''
    });
  };

  const resetMatchForm = () => {
    setMatchForm({
      matchNumber: 0, matchType: 'qualification', teamNumber: 0, alliance: 'Red',
      penalties: 0, autoClimb: false, endClimbLevel: 0, coralScored: 3, algaeScored: 0,
      autoFuelTotal: 0, teleopFuelTotal: 0,
      defenseRating: 3, drivingSkillRating: 3,
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
      coreValuesRating: pit.coreValuesRating ?? 3,
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

  const fetchTeamClaims = async () => {
    if (!activeEvent) return;
    try {
      const claims = await api.scout.getTeamClaims(activeEvent.id);
      const map: Record<string, { userId: number; userName: string }> = {};
      for (const c of claims) {
        map[`${c.matchKey}:${c.teamNumber}`] = { userId: c.userId, userName: c.userName };
      }
      setTeamClaims(map);
    } catch {}
  };

  const claimTeam = async (matchKey: string, teamNumber: number) => {
    if (!activeEvent || !currentUser) return;
    const key = `${matchKey}:${teamNumber}`;
    const entry = { userId: parseInt(currentUser.id), userName: currentUser.name || currentUser.username };
    setTeamClaims(prev => ({ ...prev, [key]: entry }));
    activeTeamClaimRef.current = { matchKey, teamNumber };
    try {
      await api.scout.upsertTeamClaim(activeEvent.id, { matchKey, teamNumber, userId: parseInt(currentUser.id), userName: entry.userName });
    } catch {}
  };

  const unclaimTeam = async (matchKey: string, teamNumber: number) => {
    if (!activeEvent || !currentUser) return;
    const key = `${matchKey}:${teamNumber}`;
    setTeamClaims(prev => { const next = { ...prev }; delete next[key]; return next; });
    activeTeamClaimRef.current = null;
    try {
      await api.scout.deleteTeamClaim(activeEvent.id, matchKey, teamNumber, parseInt(currentUser.id));
    } catch {}
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
        report += `Driving Skill: ${avg('drivingSkillRating')}/5${pit?.coreValuesRating ? `, FIRST Core Values: ${pit.coreValuesRating}/5` : ''}\n`;
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
    report += `Ratings: Offense ${r.offenseRating}/10, Defense ${r.defenseRating}/10, Overall ${r.overallRating}/10${r.coreValuesRating ? `, FIRST Core Values: ${r.coreValuesRating}/5` : ''}\n`;
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
        block += `Driving Skill: ${avg('drivingSkillRating')}/5${r.coreValuesRating ? `, FIRST Core Values: ${r.coreValuesRating}/5` : ''}, Avg Penalties: ${avg('penalties')}\n`;
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
    const grouped = new Map<string, any[]>();
    for (const m of raw) {
      const key = `${m.matchType || 'qualification'}:${m.matchNumber}`;
      const arr = grouped.get(key) || [];
      arr.push(m);
      grouped.set(key, arr);
    }
    return Array.from(grouped.entries()).map(([_key, entries]) => {
      if (entries.length === 1) return entries[0];
      const avg = (field: string) => {
        const sum = entries.reduce((s, e) => s + (e[field] || 0), 0);
        return Math.round(sum / entries.length);
      };
      return {
        ...entries[0],
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
      <RobotDashboard
        selectedRobot={selectedRobot}
        activeEvent={activeEvent}
        robotMatches={robotMatches}
        crossEventMatches={crossEventMatches}
        tbaYearEvents={tbaYearEvents}
        tbaYearStatuses={tbaYearStatuses}
        tbaYearLoading={tbaYearLoading}
        geminiModal={geminiModal}
        copiedGemini={copiedGemini}
        onBack={() => setSelectedRobot(null)}
        onEditPit={openEditPit}
        onDeletePit={handleDeletePitScout}
        onGenerateAIReport={generateRobotAIReport}
        onSetGeminiModal={setGeminiModal}
        onSetCopiedGemini={setCopiedGemini}
      />
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

        <div className="overflow-x-auto -mx-2 px-2">
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl border border-slate-200 shadow-inner min-w-max">
            {(['robots', 'matches', 'info', 'schedule', 'qr', 'display', 'map'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTab === tab ? 'bg-white dark:bg-slate-800 text-slate-900 shadow-sm dark:text-white' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {tab === 'robots' ? 'Robots' : tab === 'matches' ? 'Matches' : tab === 'info' ? 'Info' : tab === 'schedule' ? 'Schedule' : tab === 'qr' ? 'QR' : tab === 'display' ? 'Pit Display' : 'Map'}
              </button>
            ))}
          </div>
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
            {(() => {
              const myId = parseInt(currentUser?.id);
              const myAssignments = assignments.filter(a => a.userId === myId);
              if (myAssignments.length === 0) return null;
              const sortedTbaQuals = tbaMatches
                .filter((m: any) => m.comp_level === 'qm')
                .sort((a: any, b: any) => (a.match_number || 0) - (b.match_number || 0));
              const nextUnplayed = sortedTbaQuals.find((m: any) => m.alliances?.red?.score === null || m.alliances?.red?.score === undefined || m.alliances?.red?.score === -1);
              const refMatchNum = nextUnplayed?.match_number ?? sortedTbaQuals[sortedTbaQuals.length - 1]?.match_number ?? 1;
              const myAssignment = myAssignments.find(a => a.fromMatch <= refMatchNum && a.toMatch >= refMatchNum) || myAssignments[0];
              if (!myAssignment) return null;
              const teammates = assignments.filter(a => a.userId !== myId && a.role === myAssignment.role && a.fromMatch <= myAssignment.toMatch && a.toMatch >= myAssignment.fromMatch);
              const badge = ROLE_COLORS[myAssignment.role] || 'bg-slate-100 text-slate-600';
              return (
                <div className={`rounded-2xl border-2 p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${myAssignment.role === 'Scout - Stands' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Your Role</span>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${badge}`}>{myAssignment.role}</span>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Matches {myAssignment.fromMatch}–{myAssignment.toMatch}</span>
                    </div>
                    {myAssignment.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">{myAssignment.notes}</p>}
                    {teammates.length > 0 && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-bold">
                        With: {teammates.map(t => t.userName).join(', ')}
                      </p>
                    )}
                  </div>
                  {myAssignment.role === 'Scout - Stands' && tbaMatches.length > 0 && (
                    <div className="text-[9px] font-black text-red-600 dark:text-red-400 uppercase tracking-widest bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-xl">
                      Scouting: M{myAssignment.fromMatch}–M{myAssignment.toMatch}
                    </div>
                  )}
                </div>
              );
            })()}
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
              const isUnplayed = (m: any) => {
                const score = m.alliances?.red?.score;
                return score === null || score === undefined || score === -1;
              };
              const upcoming = tbaMatches
                .filter((m: any) => {
                  if (!isUnplayed(m)) return false;
                  const t = m.predicted_time || m.time;
                  if (t) return t > now - 3600;
                  return !m.actual_time;
                })
                .sort((a: any, b: any) => {
                  const ta = a.predicted_time || a.time || 0;
                  const tb = b.predicted_time || b.time || 0;
                  if (ta !== tb) return ta - tb;
                  return (a.match_number || 0) - (b.match_number || 0);
                });

              const renderNextMatchCard = (m: any, isOnDeck: boolean) => {
                if (!m) return null;
                const isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                const compositeNum = isElim && m.set_number > 0 ? m.set_number * 10 + (m.match_number || 1) : (m.match_number || 1);
                const matchType = m.comp_level === 'pr' ? 'practice' : m.comp_level === 'qm' ? 'qualification' : 'elimination';
                const redKeys: string[] = m.alliances?.red?.team_keys || [];
                const blueKeys: string[] = m.alliances?.blue?.team_keys || [];
                const renderTeamBtn = (teamKey: string, alliance: 'Red' | 'Blue') => {
                  const teamNum = parseInt(teamKey.replace('frc', ''));
                  const isOurTeam = teamNum === 10991;
                  const alreadyScouted = matchScoutsData.some((ms: any) => ms.matchNumber === compositeNum && ms.matchType === matchType && ms.teamNumber === teamNum);
                  const claimKey = `${m.key}:${teamNum}`;
                  const claim = teamClaims[claimKey];
                  const isMe = claim?.userId === parseInt(currentUser?.id);
                  const isMineOpen = claim && isMe;
                  const isOthersClaim = claim && !isMe;

                  let btnClass = '';
                  let label: React.ReactNode = <span className="font-black text-sm">{teamNum}</span>;

                  if (alreadyScouted) {
                    btnClass = 'bg-green-100 dark:bg-green-900/40 border-2 border-green-400 text-green-700 dark:text-green-300 cursor-default opacity-80';
                    label = (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-sm">{teamNum}</span>
                        <span className="text-[8px] font-black uppercase tracking-widest">✓ Done</span>
                      </div>
                    );
                  } else if (isOthersClaim) {
                    btnClass = 'bg-amber-50 dark:bg-amber-900/30 border-2 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 cursor-default opacity-75';
                    label = (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-sm">{teamNum}</span>
                        <span className="text-[8px] font-bold truncate max-w-[60px]">📋 {claim.userName.split(' ')[0]}</span>
                      </div>
                    );
                  } else if (isMineOpen) {
                    btnClass = 'bg-amber-100 dark:bg-amber-900/40 border-2 border-amber-400 text-amber-800 dark:text-amber-200';
                    label = (
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="font-black text-sm">{teamNum}</span>
                        <span className="text-[8px] font-black uppercase">📋 You</span>
                      </div>
                    );
                  } else if (isOurTeam) {
                    btnClass = alliance === 'Red'
                      ? 'bg-red-600 border-2 border-white text-white ring-2 ring-white/50 hover:bg-red-700'
                      : 'bg-blue-600 border-2 border-white text-white ring-2 ring-white/50 hover:bg-blue-700';
                  } else {
                    btnClass = alliance === 'Red'
                      ? 'bg-red-600 hover:bg-red-700 border-2 border-red-700 text-white hover:scale-105 active:scale-95'
                      : 'bg-blue-600 hover:bg-blue-700 border-2 border-blue-700 text-white hover:scale-105 active:scale-95';
                  }

                  const canScout = !alreadyScouted && !isOthersClaim;
                  const ourTeamRing = isOurTeam ? ' ring-2 ring-white ring-offset-1 ring-offset-transparent' : '';
                  return (
                    <button
                      key={teamKey}
                      disabled={!canScout}
                      onClick={() => {
                        if (!canScout) return;
                        claimTeam(m.key, teamNum);
                        resetMatchForm();
                        setMatchForm((f: any) => ({ ...f, teamNumber: teamNum, matchNumber: compositeNum, matchType, alliance }));
                        setEditingMatch(null);
                        setShowMatchForm(true);
                      }}
                      className={`px-3 py-2 rounded-xl text-center transition-all min-w-[64px] ${btnClass}${ourTeamRing}`}
                    >
                      {label}
                    </button>
                  );
                };

                return (
                  <div key={m.key} className={`rounded-2xl border-2 p-4 ${isOnDeck ? 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/60 opacity-80' : 'border-red-200 dark:border-red-700 bg-white dark:bg-slate-800 shadow-sm'}`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase text-white ${isOnDeck ? 'bg-slate-500' : 'bg-red-600'}`}>
                          {isOnDeck ? 'On Deck' : 'Up Next'}
                        </span>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{getMatchLabel(m)}</span>
                        {isElim && <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-purple-100 text-purple-700">Elim</span>}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black text-red-600 uppercase tracking-widest w-8">Red</span>
                        {redKeys.map(k => renderTeamBtn(k, 'Red'))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest w-8">Blue</span>
                        {blueKeys.map(k => renderTeamBtn(k, 'Blue'))}
                      </div>
                    </div>
                  </div>
                );
              };

              const nextMatch = upcoming[0] || null;
              const onDeckMatch = upcoming[1] || null;

              const unscoutedMatches = tbaMatches.filter((m: any) => {
                const allTeamNums = [
                  ...(m.alliances?.red?.team_keys || []),
                  ...(m.alliances?.blue?.team_keys || []),
                ].map((k: string) => parseInt(k.replace('frc', '')));
                if (allTeamNums.length === 0) return false;
                const isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                const compositeNum = isElim && m.set_number > 0
                  ? m.set_number * 10 + (m.match_number || 1)
                  : (m.match_number || 1);
                const matchType = m.comp_level === 'pr' ? 'practice' : m.comp_level === 'qm' ? 'qualification' : 'elimination';
                const scoutedTeamNums = new Set(
                  matchScoutsData
                    .filter((ms: any) => ms.matchNumber === compositeNum && ms.matchType === matchType)
                    .map((ms: any) => ms.teamNumber)
                );
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
                  {(nextMatch || onDeckMatch) && (
                    <div className="space-y-2">
                      {nextMatch && renderNextMatchCard(nextMatch, false)}
                      {onDeckMatch && renderNextMatchCard(onDeckMatch, true)}
                    </div>
                  )}
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
                              const _isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                              const _compositeNum = _isElim && m.set_number > 0 ? m.set_number * 10 + (m.match_number || 1) : (m.match_number || 1);
                              const _matchType = m.comp_level === 'pr' ? 'practice' : m.comp_level === 'qm' ? 'qualification' : 'elimination';
                              const scoutedNums = new Set(matchScoutsData.filter((ms: any) => ms.matchNumber === _compositeNum && ms.matchType === _matchType).map((ms: any) => ms.teamNumber));
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

                  {(() => {
                    const myId = parseInt(currentUser?.id);
                    const standAssignments = assignments.filter(a =>
                      a.userId === myId && a.role === 'Scout - Stands'
                    );
                    if (standAssignments.length === 0) return null;
                    const inAnyRange = (mn: number) => standAssignments.some(a => mn >= a.fromMatch && mn <= a.toMatch);
                    const rangeLabel = standAssignments.map(a => `M${a.fromMatch}–M${a.toMatch}`).join(', ');
                    const pitScoutedNums = new Set(pitScouts.map((ps: any) => ps.teamNumber));
                    const suggestedMatches = tbaMatches
                      .filter((m: any) => {
                        const isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                        const isPractice = m.comp_level === 'pr';
                        if (isPractice) return false;
                        const mn = isElim ? 0 : m.match_number;
                        const inRange = isElim ? true : inAnyRange(mn);
                        const unplayed = m.alliances?.red?.score === null || m.alliances?.red?.score === undefined || m.alliances?.red?.score === -1;
                        const hasTeams = (m.alliances?.red?.team_keys?.length || 0) + (m.alliances?.blue?.team_keys?.length || 0) > 0;
                        return inRange && unplayed && hasTeams;
                      })
                      .sort((a: any, b: any) => {
                        const aElim = a.comp_level !== 'qm' ? 1 : 0;
                        const bElim = b.comp_level !== 'qm' ? 1 : 0;
                        if (aElim !== bElim) return aElim - bElim;
                        return (a.match_number || 0) - (b.match_number || 0);
                      });
                    const suggestedRobots = suggestedMatches.flatMap((m: any) => {
                      const redKeys: string[] = m.alliances?.red?.team_keys || [];
                      const blueKeys: string[] = m.alliances?.blue?.team_keys || [];
                      const ourAlliance = redKeys.includes('frc10991') ? 'red' : blueKeys.includes('frc10991') ? 'blue' : null;
                      const opponentKeys = ourAlliance === 'red' ? blueKeys : ourAlliance === 'blue' ? redKeys : [...redKeys, ...blueKeys];
                      const matchClaim = matchClaims[m.key];
                      const isClaimed = !!matchClaim;
                      const isElim = m.comp_level && m.comp_level !== 'qm' && m.comp_level !== 'pr';
                      const compositeNum = isElim && m.set_number > 0
                        ? m.set_number * 10 + (m.match_number || 1)
                        : (m.match_number || 1);
                      const matchType = m.comp_level === 'qm' ? 'qualification' : 'elimination';
                      return opponentKeys
                        .map((k: string) => parseInt(k.replace('frc', '')))
                        .filter(n => n !== 10991)
                        .filter(n => !pitScoutedNums.has(n))
                        .filter(n => !matchScoutsData.some((ms: any) => ms.matchNumber === compositeNum && ms.matchType === matchType && ms.teamNumber === n))
                        .map(n => ({
                          teamNumber: n,
                          matchNumber: compositeNum,
                          matchLabel: getMatchLabel(m),
                          matchKey: m.key,
                          isClaimed,
                          claimedBy: isClaimed ? matchClaim.userName : null,
                          alliance: redKeys.includes(`frc${n}`) ? 'Red' : 'Blue',
                          isElim,
                        }));
                    });
                    if (suggestedRobots.length === 0) return null;
                    return (
                      <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-2xl p-5">
                        <h4 className="text-xs font-black text-red-700 dark:text-red-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Swords size={14} className="text-red-600" />
                          Your Scouting Targets ({rangeLabel})
                        </h4>
                        <div className="space-y-2">
                          {suggestedRobots.slice(0, 8).map((s, idx) => {
                            const robot = pitScouts.find((ps: any) => ps.teamNumber === s.teamNumber);
                            return (
                              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-red-200 dark:border-red-700">
                                <div className="flex items-center gap-3">
                                  <span className={`px-2 py-1 rounded-lg text-[9px] font-black text-white ${s.alliance === 'Red' ? 'bg-red-600' : 'bg-blue-600'}`}>{s.alliance}</span>
                                  {s.isElim && (
                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-purple-100 text-purple-700">Elim</span>
                                  )}
                                  <div>
                                    <p className="text-xs font-black text-slate-900 dark:text-white">Team {s.teamNumber}{robot ? ` — ${robot.teamName}` : ''}</p>
                                    <p className="text-[9px] text-slate-400 font-bold">{s.matchLabel}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {s.isClaimed && (
                                    <span className="text-[9px] text-slate-400 font-bold hidden sm:block">Claimed by {s.claimedBy}</span>
                                  )}
                                  {!s.isClaimed && (
                                    <button
                                      onClick={() => claimMatch(s.matchKey)}
                                      className="px-3 py-1.5 bg-slate-800 dark:bg-slate-600 text-white rounded-lg text-[9px] font-black hover:bg-slate-700 transition-all"
                                    >Claim</button>
                                  )}
                                  <button
                                    onClick={() => {
                                      resetMatchForm();
                                      setMatchForm((f: any) => ({ ...f, teamNumber: s.teamNumber, matchNumber: s.matchNumber, matchType: s.isElim ? 'elimination' : 'qualification', alliance: s.alliance }));
                                      if (!s.isClaimed) claimMatch(s.matchKey);
                                      setEditingMatch(null);
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
                    );
                  })()}

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
          <ScoutQR
            matchScoutsData={matchScoutsData}
            pitScouts={pitScouts}
            selectedMatchIds={selectedMatchIds}
            setSelectedMatchIds={setSelectedMatchIds}
            selectedRobotIds={selectedRobotIds}
            setSelectedRobotIds={setSelectedRobotIds}
            qrData={qrData}
            qrChunkIndex={qrChunkIndex}
            setQrChunkIndex={setQrChunkIndex}
            onGenerateQR={generateQR}
            scanning={scanning}
            importPreview={importPreview}
            importResult={importResult}
            scannedChunks={scannedChunks}
            scannerContainerRef={scannerContainerRef}
            onStartScanner={startScanner}
            onStopScanner={stopScanner}
            onConfirmImport={confirmImport}
            setImportPreview={setImportPreview}
            setScannedChunks={setScannedChunks}
            setImportResult={setImportResult}
          />
        ) : activeTab === 'display' ? (
          <PitDisplay
            pitSubTab={pitSubTab}
            setPitSubTab={setPitSubTab}
            pitDisplayAlerts={pitDisplayAlerts}
            dismissedPitAlertIds={dismissedPitAlertIds}
            onDismissPitAlert={dismissPitAlert}
            nexusData={nexusData}
            nexusLoading={nexusLoading}
            nexusError={nexusError}
            nexusCountdown={nexusCountdown || null}
            onFetchNexusData={fetchNexusData}
            onFetchTbaData={fetchTbaData}
            tbaMatches={tbaMatches}
            tbaLoading={tbaLoading}
            tbaRecord={tbaRecord}
            tbaRankings={tbaRankings}
            pitScouts={pitScouts}
            matchScoutsData={matchScoutsData}
            activeEvent={activeEvent}
            isCoachOrCaptain={isCoachOrCaptain}
            dismissedBreaks={dismissedBreaks}
            setDismissedBreaks={setDismissedBreaks}
            dismissedAnnouncements={dismissedAnnouncements}
            setDismissedAnnouncements={setDismissedAnnouncements}
            dismissedParts={dismissedParts}
            setDismissedParts={setDismissedParts}
            onOpenRobotByNumber={openRobotByNumber}
            onSetSelectedRobot={setSelectedRobot}
            onGenerateGeminiReport={generateGeminiReport}
          />
        ) : activeTab === 'info' ? (
          <div className="space-y-6">
            {editingEventInfo ? (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8 space-y-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Edit Event Info</h3>
                  <button onClick={() => setEditingEventInfo(false)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"><X size={16} className="text-slate-500" /></button>
                </div>
                {[
                  { key: 'venueInfo', label: 'Venue Name & Address', placeholder: 'e.g. Salem Convention Center, 200 Commercial St NE' },
                  { key: 'wifiNetwork', label: 'Wi-Fi Network', placeholder: 'Network name' },
                  { key: 'wifiPassword', label: 'Wi-Fi Password', placeholder: 'Password' },
                  { key: 'parkingInfo', label: 'Parking Info', placeholder: 'Where to park, any fees, etc.' },
                  { key: 'schedule', label: 'Daily Schedule', placeholder: 'e.g. Day 1: 7am load-in, 9am practice...' },
                  { key: 'resources', label: 'Resources & Links', placeholder: 'Pit map URL, judging schedule, etc.' },
                  { key: 'notes', label: 'Notes', placeholder: 'Any other important info...' },
                ].map(field => (
                  <div key={field.key} className="space-y-2">
                    <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{field.label}</label>
                    <textarea
                      rows={field.key === 'schedule' || field.key === 'resources' || field.key === 'notes' ? 4 : 2}
                      value={(eventInfoForm as any)[field.key]}
                      onChange={e => setEventInfoForm({ ...eventInfoForm, [field.key]: e.target.value })}
                      placeholder={field.placeholder}
                      className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm resize-none dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>
                ))}
                <button
                  onClick={async () => {
                    if (!activeEvent) return;
                    try {
                      const saved = await api.eventInfo.update(activeEvent.id, { ...eventInfoForm, updatedBy: parseInt(currentUser.id) });
                      setEventInfoData(saved);
                      setEditingEventInfo(false);
                    } catch (err) {
                      console.error('Failed to save event info:', err);
                    }
                  }}
                  className="w-full py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase tracking-widest text-xs"
                >Save Event Info</button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                    <MapPin size={18} className="text-red-600" /> Event Info
                  </h3>
                  {isCoachOrCaptain && (
                    <button
                      onClick={() => {
                        setEventInfoForm({
                          venueInfo: eventInfoData?.venueInfo || '',
                          wifiNetwork: eventInfoData?.wifiNetwork || '',
                          wifiPassword: eventInfoData?.wifiPassword || '',
                          parkingInfo: eventInfoData?.parkingInfo || '',
                          schedule: eventInfoData?.schedule || '',
                          resources: eventInfoData?.resources || '',
                          notes: eventInfoData?.notes || '',
                        });
                        setEditingEventInfo(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    ><Settings size={13} /> Edit</button>
                  )}
                </div>
                {[
                  { key: 'venueInfo', label: 'Venue', icon: '📍' },
                  { key: 'wifiNetwork', label: 'Wi-Fi Network', icon: '📶' },
                  { key: 'wifiPassword', label: 'Wi-Fi Password', icon: '🔒' },
                  { key: 'parkingInfo', label: 'Parking', icon: '🅿️' },
                  { key: 'schedule', label: 'Daily Schedule', icon: '📅' },
                  { key: 'resources', label: 'Resources & Links', icon: '🔗' },
                  { key: 'notes', label: 'Notes', icon: '📝' },
                ].map(field => {
                  const val = eventInfoData?.[field.key];
                  if (!val && !isCoachOrCaptain) return null;
                  return (
                    <div key={field.key} className="mb-5 last:mb-0">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{field.icon} {field.label}</p>
                      {val ? (
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{val}</p>
                      ) : (
                        <p className="text-sm text-slate-300 dark:text-slate-600 italic">Not set</p>
                      )}
                    </div>
                  );
                })}
                {!eventInfoData?.venueInfo && !eventInfoData?.wifiNetwork && !eventInfoData?.schedule && !eventInfoData?.notes && (
                  <div className="py-10 text-center">
                    <MapPin size={40} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                    <p className="text-sm font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">No Event Info Yet</p>
                    {isCoachOrCaptain && <p className="text-xs text-slate-400 mt-1">Click Edit to add venue details, Wi-Fi, parking info, and more.</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'schedule' ? (
          <div className="space-y-6">
            {isCoachOrCaptain && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setAssignmentForm({ userId: 0, fromMatch: 1, toMatch: 10, role: 'Scout - Stands', notes: '' });
                    setEditingAssignment(null);
                    setShowAssignmentForm(true);
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase text-[10px] tracking-widest"
                ><Plus size={16} /> Add Assignment</button>
              </div>
            )}

            {assignmentsLoading ? (
              <div className="py-12 text-center text-slate-400 font-bold uppercase tracking-widest text-sm">Loading...</div>
            ) : assignments.length === 0 ? (
              <div className="py-16 text-center">
                <Calendar size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-lg font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">No Assignments Yet</p>
                {isCoachOrCaptain && <p className="text-slate-400 text-sm mt-1">Add assignments to tell team members their roles during the competition.</p>}
              </div>
            ) : (
              <>
                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[32px] border-2 border-slate-100 dark:border-slate-700 p-6 md:p-8">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-5 flex items-center gap-2">
                    <Grid3X3 size={15} className="text-red-600" /> Schedule Overview
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left py-2 pr-4 font-black text-[9px] text-slate-400 uppercase tracking-widest min-w-[120px]">Member</th>
                          {assignments
                            .reduce((acc: any[], a) => {
                              const key = `${a.fromMatch}-${a.toMatch}`;
                              if (!acc.find(x => x.key === key)) acc.push({ key, fromMatch: a.fromMatch, toMatch: a.toMatch });
                              return acc;
                            }, [])
                            .sort((a, b) => a.fromMatch - b.fromMatch)
                            .map(range => (
                              <th key={range.key} className="py-2 px-2 font-black text-[9px] text-slate-400 uppercase tracking-widest text-center whitespace-nowrap">M{range.fromMatch}–M{range.toMatch}</th>
                            ))
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const ranges = assignments
                            .reduce((acc: any[], a) => {
                              const key = `${a.fromMatch}-${a.toMatch}`;
                              if (!acc.find((x: any) => x.key === key)) acc.push({ key, fromMatch: a.fromMatch, toMatch: a.toMatch });
                              return acc;
                            }, [])
                            .sort((a: any, b: any) => a.fromMatch - b.fromMatch);
                          const byUser = new Map<number, { name: string; assignments: any[] }>();
                          for (const a of assignments) {
                            if (!byUser.has(a.userId)) byUser.set(a.userId, { name: a.userName || `User ${a.userId}`, assignments: [] });
                            byUser.get(a.userId)!.assignments.push(a);
                          }
                          return Array.from(byUser.entries()).map(([userId, { name, assignments: userAssigns }]) => {
                            const isMe = userId === parseInt(currentUser?.id);
                            return (
                              <tr key={userId} className={isMe ? 'bg-red-50 dark:bg-red-900/10' : ''}>
                                <td className="py-2 pr-4 font-bold text-slate-700 dark:text-slate-300 text-xs whitespace-nowrap">
                                  {name}{isMe ? ' (you)' : ''}
                                </td>
                                {ranges.map((range: any) => {
                                  const a = userAssigns.find((ua: any) => ua.fromMatch === range.fromMatch && ua.toMatch === range.toMatch);
                                  if (!a) return <td key={range.key} className="py-2 px-2 text-center"><span className="text-slate-200 dark:text-slate-700">—</span></td>;
                                  const color = ROLE_CHIP_COLORS[a.role] || 'bg-slate-500 text-white';
                                  return (
                                    <td key={range.key} className="py-2 px-2 text-center">
                                      <span
                                        title={a.notes || a.role}
                                        className={`inline-block px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer ${color}`}
                                        onClick={isCoachOrCaptain ? () => {
                                          setEditingAssignment(a);
                                          setAssignmentForm({ userId: a.userId, fromMatch: a.fromMatch, toMatch: a.toMatch, role: a.role, notes: a.notes || '' });
                                          setShowAssignmentForm(true);
                                        } : undefined}
                                      >{a.role.replace('Scout - Stands', 'Scout').replace('Driver/Coach Support', 'Driver/Coach')}</span>
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">All Assignments</h3>
                  {assignments.map(a => {
                    const badge = ROLE_COLORS[a.role] || 'bg-slate-100 text-slate-600';
                    const isMe = a.userId === parseInt(currentUser?.id);
                    return (
                      <div key={a.id} className={`bg-white dark:bg-slate-800 rounded-2xl border-2 ${isMe ? 'border-red-200 dark:border-red-800' : 'border-slate-100 dark:border-slate-700'} p-5 flex items-center gap-4`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-black text-slate-900 dark:text-white">{a.userName}{isMe ? ' (you)' : ''}</p>
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${badge}`}>{a.role}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold">Matches {a.fromMatch}–{a.toMatch}</p>
                          {a.notes && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{a.notes}</p>}
                        </div>
                        {isCoachOrCaptain && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditingAssignment(a);
                                setAssignmentForm({ userId: a.userId, fromMatch: a.fromMatch, toMatch: a.toMatch, role: a.role, notes: a.notes || '' });
                                setShowAssignmentForm(true);
                              }}
                              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 transition-all"
                            ><Settings size={14} className="text-slate-500" /></button>
                            <button
                              onClick={async () => {
                                if (!confirm('Delete this assignment?')) return;
                                try {
                                  await api.competitionAssignments.delete(activeEvent.id, a.id, parseInt(currentUser.id));
                                  fetchAssignments(activeEvent.id);
                                } catch (err) { console.error('Failed to delete assignment:', err); }
                              }}
                              className="p-2 rounded-xl bg-red-50 dark:bg-red-900/30 hover:bg-red-100 transition-all"
                            ><Trash2 size={14} className="text-red-500" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {showAssignmentForm && (
              <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="bg-white dark:bg-slate-800 rounded-2xl md:rounded-[40px] w-full max-w-md max-h-[90vh] overflow-auto p-6 md:p-10 shadow-2xl border-t-8 border-red-600">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">{editingAssignment ? 'Edit Assignment' : 'Add Assignment'}</h2>
                    <button onClick={() => { setShowAssignmentForm(false); setEditingAssignment(null); }} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700"><X size={18} className="text-slate-500" /></button>
                  </div>
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Team Member</label>
                      <select
                        value={assignmentForm.userId}
                        onChange={e => setAssignmentForm({ ...assignmentForm, userId: parseInt(e.target.value) })}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm dark:text-white"
                      >
                        <option value={0}>Select member...</option>
                        {allUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.name || u.username}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">From Match #</label>
                        <input type="number" min={1} value={assignmentForm.fromMatch}
                          onChange={e => setAssignmentForm({ ...assignmentForm, fromMatch: parseInt(e.target.value) || 1 })}
                          className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm dark:text-white" />
                      </div>
                      <div className="space-y-2">
                        <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">To Match #</label>
                        <input type="number" min={1} value={assignmentForm.toMatch}
                          onChange={e => setAssignmentForm({ ...assignmentForm, toMatch: parseInt(e.target.value) || 1 })}
                          className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm dark:text-white" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Role</label>
                      <select
                        value={assignmentForm.role}
                        onChange={e => setAssignmentForm({ ...assignmentForm, role: e.target.value })}
                        className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm dark:text-white"
                      >
                        {ASSIGNMENT_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest">Notes (optional)</label>
                      <textarea rows={2} value={assignmentForm.notes}
                        onChange={e => setAssignmentForm({ ...assignmentForm, notes: e.target.value })}
                        placeholder="Any specific instructions..."
                        className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-red-600 transition-all font-bold text-sm resize-none dark:text-white dark:placeholder:text-slate-500" />
                    </div>
                    <button
                      disabled={!assignmentForm.userId || assignmentForm.fromMatch < 1 || assignmentForm.toMatch < assignmentForm.fromMatch}
                      onClick={async () => {
                        if (!activeEvent || !assignmentForm.userId) return;
                        try {
                          const payload = { ...assignmentForm, createdBy: parseInt(currentUser.id) };
                          if (editingAssignment) {
                            await api.competitionAssignments.update(activeEvent.id, editingAssignment.id, payload);
                          } else {
                            await api.competitionAssignments.create(activeEvent.id, payload);
                          }
                          setShowAssignmentForm(false);
                          setEditingAssignment(null);
                          fetchAssignments(activeEvent.id);
                        } catch (err) { console.error('Failed to save assignment:', err); }
                      }}
                      className="w-full py-4 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                    >{editingAssignment ? 'Update Assignment' : 'Create Assignment'}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'map' ? (
          <div className="space-y-4">
            <PitMap
              mapData={pitMapData}
              loading={pitMapLoading}
              error={pitMapError}
              eventKey={activeEvent?.nexusEventKey || null}
              onRefresh={() => activeEvent?.nexusEventKey && fetchPitMap(activeEvent.nexusEventKey)}
            />
          </div>
        ) : null}

        <PitScoutForm
          show={showPitForm}
          editingPit={editingPit}
          pitForm={pitForm}
          setPitForm={setPitForm}
          onClose={() => { setShowPitForm(false); setEditingPit(null); }}
          onSave={handleSavePitScout}
          compressImage={compressImage}
        />


        <MatchScoutForm
          show={showMatchForm}
          editingMatch={editingMatch}
          matchForm={matchForm}
          setMatchForm={setMatchForm}
          onClose={() => { setShowMatchForm(false); setEditingMatch(null); }}
          onSave={handleSaveMatchScout}
          pitScouts={pitScouts}
          activeTeamClaimRef={activeTeamClaimRef}
          onUnclaim={unclaimTeam}
        />


      </div>
    );
  }

  return (
    <ScoutEventList
      events={events}
      isCoachOrCaptain={isCoachOrCaptain}
      eventCounts={eventCounts}
      showEventForm={showEventForm}
      showEventSettings={showEventSettings}
      activeEvent={activeEvent}
      eventForm={eventForm}
      setEventForm={setEventForm}
      eventSettingsForm={eventSettingsForm}
      setEventSettingsForm={setEventSettingsForm}
      nexusTestStatus={nexusTestStatus}
      nexusTestMsg={nexusTestMsg}
      nexusToast={nexusToast}
      geminiModal={geminiModal}
      copiedGemini={copiedGemini}
      onCreateEvent={() => setShowEventForm(true)}
      onEnterEvent={enterEvent}
      onDeleteEvent={handleDeleteEvent}
      onTestNexus={handleTestNexus}
      onSaveEventSettings={handleSaveEventSettings}
      onCloseEventSettings={() => setShowEventSettings(false)}
      onCreateEventSubmit={handleCreateEvent}
      onCloseEventForm={() => setShowEventForm(false)}
      onDismissNexusToast={() => setNexusToast(null)}
      onSetGeminiModal={setGeminiModal}
      onSetCopiedGemini={setCopiedGemini}
    />
  );

};

export default Scout;
