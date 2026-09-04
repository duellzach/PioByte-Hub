import React, { useState, useEffect, useMemo } from 'react';
import { ShieldCheck, Plus, X, ChevronRight, Check, AlertTriangle, Clock, User, Users, Edit3, Trash2, Lock, Unlock, ClipboardList, Search, ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { User as UserType, Role } from '../types';
import { api } from '../services/api';
import { useTeamTime } from '../utils/timeFormat';
import { useTeamSettings } from '../contexts/TeamSettingsContext';
import { LEVELS, levelBadgeLabel, certificationTracks } from '../shared/certifications';
import { LINK_TYPES, linkIcon, normalizeUrl, ProjectLinkChip } from './ProjectLinks';

interface CertificationsProps {
  currentUser: UserType | null;
}

type Tab = 'certs' | 'mine' | 'queue';

const Certifications: React.FC<CertificationsProps> = ({ currentUser }) => {
  const { fmtDate } = useTeamTime();
  const { settings } = useTeamSettings();
  const [progress, setProgress] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('certs');
  const [certifications, setCertifications] = useState<any[]>([]);
  const [selectedCert, setSelectedCert] = useState<any | null>(null);
  const [certifiedUsers, setCertifiedUsers] = useState<any[]>([]);
  const [certTrainers, setCertTrainers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [myCerts, setMyCerts] = useState<any[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [queueRequests, setQueueRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCert, setEditingCert] = useState<any | null>(null);
  const [certForm, setCertForm] = useState({
    name: '',
    description: '',
    equipment: '',
    safetyGuide: '',
    checklistItems: [] as string[],
    newChecklistItem: '',
    department: '' as string,          // '' = the General category
    level: 1,
    links: [] as { id: string; label: string; url: string; type: string }[],
    newLinkLabel: '',
    newLinkUrl: '',
    newLinkType: 'doc',
  });

  const [grantUserId, setGrantUserId] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);
  const [grantError, setGrantError] = useState('');

  const [requestDetail, setRequestDetail] = useState<any | null>(null);
  const [checklistProgress, setChecklistProgress] = useState<any[]>([]);
  const [trainerNotes, setTrainerNotes] = useState('');
  const [requestActionLoading, setRequestActionLoading] = useState(false);

  const [certSearch, setCertSearch] = useState('');

  const isCoach = currentUser?.roles.includes(Role.Coach);
  const isCaptain = currentUser?.roles.includes(Role.TeamCaptain);
  const isTrainer = currentUser?.roles.includes(Role.Trainer);
  const isCoachOrCaptain = isCoach || isCaptain;
  const canManageCerts = isCoachOrCaptain;
  const canSeeQueue = isCoach || isCaptain || isTrainer;

  const loadCertifications = async () => {
    setLoading(true);
    setError('');
    try {
      const [certs, users, prog] = await Promise.all([
        api.certifications.getAll(),
        api.users.getAll(),
        api.certifications.getProgress().catch(() => null),
      ]);
      setCertifications(certs);
      setAllUsers(users);
      setProgress(prog);
    } catch (e: any) {
      setError('Failed to load certifications.');
    } finally {
      setLoading(false);
    }
  };

  const loadMyCerts = async () => {
    if (!currentUser) return;
    try {
      const [myCertsData, myRequestsData, prog] = await Promise.all([
        api.certifications.getForUser(parseInt(currentUser.id)),
        api.certRequests.getAll({ requesterId: parseInt(currentUser.id) }),
        api.certifications.getProgress().catch(() => null),
      ]);
      setMyCerts(myCertsData);
      setMyRequests(myRequestsData);
      // Granting or completing may have unlocked a level or earned a badge.
      if (prog) setProgress(prog);
    } catch {}
  };

  const loadQueue = async () => {
    if (!canSeeQueue) return;
    try {
      const requests = await api.certRequests.getAll({ statuses: ['pending', 'in_progress'] });
      setQueueRequests(requests);
    } catch {}
  };

  useEffect(() => {
    loadCertifications();
    loadMyCerts();
    loadQueue();
  }, []);

  useEffect(() => {
    if (activeTab === 'mine') loadMyCerts();
    if (activeTab === 'queue') loadQueue();
  }, [activeTab]);

  const loadCertDetail = async (cert: any) => {
    setSelectedCert(cert);
    setDetailLoading(true);
    setGrantError('');
    setGrantUserId('');
    try {
      const [certified, trainers] = await Promise.all([
        api.certifications.getCertifiedUsers(cert.id),
        api.certifications.getTrainers(cert.id),
      ]);
      setCertifiedUsers(certified);
      setCertTrainers(trainers);
    } catch {}
    setDetailLoading(false);
  };

  const handleCreateCert = async () => {
    if (!certForm.name.trim()) return;
    try {
      await api.certifications.create({
        name: certForm.name.trim(),
        description: certForm.description.trim(),
        equipment: certForm.equipment.trim(),
        safetyGuide: certForm.safetyGuide.trim(),
        checklistItems: certForm.checklistItems.filter(i => i.trim()),
        department: certForm.department || null,
        level: certForm.level,
        links: certForm.links,
        createdBy: parseInt(currentUser!.id),
      });
      setShowCreateModal(false);
      resetCertForm();
      await loadCertifications();
    } catch (e: any) {
      setError('Failed to create certification.');
    }
  };

  const handleEditCert = async () => {
    if (!editingCert || !certForm.name.trim()) return;
    try {
      await api.certifications.update(editingCert.id, parseInt(currentUser!.id), {
        name: certForm.name.trim(),
        description: certForm.description.trim(),
        equipment: certForm.equipment.trim(),
        safetyGuide: certForm.safetyGuide.trim(),
        checklistItems: certForm.checklistItems.filter(i => i.trim()),
        department: certForm.department || null,
        level: certForm.level,
        links: certForm.links,
      });
      setShowEditModal(false);
      setEditingCert(null);
      resetCertForm();
      await loadCertifications();
      if (selectedCert?.id === editingCert.id) {
        const refreshed = (await api.certifications.getAll()).find((c: any) => c.id === editingCert.id);
        if (refreshed) setSelectedCert(refreshed);
      }
    } catch {
      setError('Failed to update certification.');
    }
  };

  const handleDeleteCert = async (certId: number) => {
    if (!confirm('Delete this certification? This cannot be undone.')) return;
    try {
      await api.certifications.delete(certId, parseInt(currentUser!.id));
      setSelectedCert(null);
      await loadCertifications();
    } catch {
      alert('Failed to delete certification.');
    }
  };

  const handleGrantUser = async () => {
    if (!selectedCert || !grantUserId) return;
    setGrantLoading(true);
    setGrantError('');
    try {
      await api.certifications.grantUser(parseInt(grantUserId), selectedCert.id, parseInt(currentUser!.id));
      setGrantUserId('');
      await loadCertDetail(selectedCert);
      await loadCertifications();
      await loadMyCerts();
    } catch (e: any) {
      setGrantError(e.message?.includes('already') ? 'User already certified.' : 'Failed to grant certification.');
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevokeUser = async (userId: number) => {
    if (!selectedCert || !confirm('Revoke this certification from the user?')) return;
    try {
      await api.certifications.revokeUser(userId, selectedCert.id, parseInt(currentUser!.id));
      await loadCertDetail(selectedCert);
    } catch {
      alert('Failed to revoke certification.');
    }
  };

  const handleRequestCert = async (certId: number) => {
    if (!currentUser) return;
    try {
      await api.certRequests.create(parseInt(currentUser.id), certId);
      await loadMyCerts();
    } catch (e: any) {
      // The server returns the specific reason (already held, active request,
      // or the level gate) — show it rather than a generic failure.
      alert(e.message || 'Failed to submit request.');
    }
  };

  const handleClaimRequest = async (requestId: number) => {
    if (!currentUser) return;
    try {
      await api.certRequests.claim(requestId, parseInt(currentUser.id));
      await loadQueue();
    } catch {
      alert('Failed to claim request.');
    }
  };

  const openRequestDetail = (req: any) => {
    setRequestDetail(req);
    const items = req.certification?.checklistItems || [];
    const progress = req.checklistProgress || [];
    setChecklistProgress(items.map((item: string, idx: number) => ({
      item,
      completed: progress[idx]?.completed || false,
    })));
    setTrainerNotes(req.notes || '');
  };

  const handleSaveProgress = async () => {
    if (!requestDetail) return;
    setRequestActionLoading(true);
    try {
      await api.certRequests.updateProgress(requestDetail.id, checklistProgress, trainerNotes);
      await loadQueue();
      const updated = queueRequests.find(r => r.id === requestDetail.id);
      if (updated) setRequestDetail({ ...requestDetail, checklistProgress, notes: trainerNotes });
    } catch {}
    setRequestActionLoading(false);
  };

  const handleCompleteRequest = async () => {
    if (!requestDetail || !currentUser) return;
    if (checklistProgress.length > 0 && !checklistProgress.every(p => p.completed)) {
      alert('All checklist items must be completed before awarding the certification.');
      return;
    }
    setRequestActionLoading(true);
    try {
      await api.certRequests.complete(requestDetail.id, parseInt(currentUser.id));
      setRequestDetail(null);
      await loadQueue();
      await loadCertifications();
      await loadMyCerts();
    } catch {
      alert('Failed to complete request.');
    }
    setRequestActionLoading(false);
  };

  const handleRejectRequest = async () => {
    if (!requestDetail || !currentUser) return;
    if (!trainerNotes.trim()) {
      alert('Please add trainer notes explaining the rejection before proceeding.');
      return;
    }
    if (!confirm('Reject this certification request?')) return;
    setRequestActionLoading(true);
    try {
      await api.certRequests.reject(requestDetail.id, parseInt(currentUser.id), trainerNotes);
      setRequestDetail(null);
      await loadQueue();
    } catch {
      alert('Failed to reject request.');
    }
    setRequestActionLoading(false);
  };

  const resetCertForm = () => {
    setCertForm({
      name: '', description: '', equipment: '', safetyGuide: '',
      checklistItems: [], newChecklistItem: '',
      department: '', level: 1, links: [], newLinkLabel: '', newLinkUrl: '', newLinkType: 'doc',
    });
  };

  const openEditModal = (cert: any) => {
    setEditingCert(cert);
    setCertForm({
      name: cert.name || '',
      description: cert.description || '',
      equipment: cert.equipment || '',
      safetyGuide: cert.safetyGuide || '',
      checklistItems: cert.checklistItems || [],
      newChecklistItem: '',
      department: cert.department || '',
      level: cert.level || 1,
      links: cert.links || [],
      newLinkLabel: '', newLinkUrl: '', newLinkType: 'doc',
    });
    setShowEditModal(true);
  };

  const filteredCerts = useMemo(() => {
    if (!certSearch.trim()) return certifications;
    const s = certSearch.toLowerCase();
    return certifications.filter(c =>
      c.name?.toLowerCase().includes(s) || c.equipment?.toLowerCase().includes(s)
    );
  }, [certifications, certSearch]);

  const getUserName = (userId: number) => allUsers.find(u => u.id === userId)?.name || `User #${userId}`;

  /** Lock state for a (department, level) set, from the server-computed progress. */
  const levelInfo = (department: string | null, level: number) =>
    progress?.levels?.find((l: any) => (l.department ?? null) === department && l.level === level);

  const isUnlocked = (department: string | null, level: number) => {
    const info = levelInfo(department, level);
    return info ? info.unlocked : true; // no progress loaded yet: don't render as locked
  };

  const heldCertIds = useMemo(() => new Set<number>(progress?.held ?? []), [progress]);

  const deptColor = (department: string | null) =>
    (department ? settings.departments.find(d => d.name === department)?.color : null) || '#475569';

  /** Certifications grouped into tracks, then levels — the page's main layout. */
  const groupedCerts = useMemo(() => {
    const tracks = certificationTracks(filteredCerts as any[]);
    return tracks.map(department => ({
      department,
      color: deptColor(department),
      levels: LEVELS.map(level => ({
        level,
        unlocked: isUnlocked(department, level),
        info: levelInfo(department, level),
        certs: filteredCerts.filter(
          (c: any) => (c.department ?? null) === department && c.level === level,
        ),
      })).filter(l => l.certs.length > 0),
    }));
  }, [filteredCerts, progress, settings.departments]);

  const renderInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let k = 0;
    while (remaining) {
      const bold = remaining.match(/^(.*?)\*\*(.*?)\*\*(.*)/s);
      if (bold) {
        if (bold[1]) parts.push(<span key={k++}>{bold[1]}</span>);
        parts.push(<strong key={k++} className="font-black">{bold[2]}</strong>);
        remaining = bold[3]; continue;
      }
      const italic = remaining.match(/^(.*?)_(.*?)_(.*)/s);
      if (italic) {
        if (italic[1]) parts.push(<span key={k++}>{italic[1]}</span>);
        parts.push(<em key={k++}>{italic[2]}</em>);
        remaining = italic[3]; continue;
      }
      parts.push(<span key={k++}>{remaining}</span>);
      break;
    }
    return parts;
  };

  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('# '))  return <p key={i} className="font-black text-base text-amber-900 dark:text-amber-200 mt-2 mb-0.5">{line.slice(2)}</p>;
      if (line.startsWith('## ')) return <p key={i} className="font-black text-sm text-amber-900 dark:text-amber-200 mt-1.5 mb-0.5">{line.slice(3)}</p>;
      if (line.startsWith('- ') || line.startsWith('• ')) {
        return <div key={i} className="flex gap-1.5 ml-2"><span className="text-amber-600 font-black flex-shrink-0">•</span><span>{renderInline(line.slice(2))}</span></div>;
      }
      if (!line.trim()) return <div key={i} className="h-1.5" />;
      return <p key={i}>{renderInline(line)}</p>;
    });
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[9px] font-black rounded-full uppercase">Pending</span>;
      case 'in_progress': return <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[9px] font-black rounded-full uppercase">In Progress</span>;
      case 'completed': return <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-[9px] font-black rounded-full uppercase">Completed</span>;
      case 'rejected': return <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 text-[9px] font-black rounded-full uppercase">Rejected</span>;
      default: return null;
    }
  };

  const renderCertFormFields = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Certification Name *</label>
        <input
          value={certForm.name}
          onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
          placeholder="e.g. Drill Press Operation"
          className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor font-black uppercase tracking-tight dark:text-white transition-all"
        />
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Equipment / Tool</label>
        <input
          value={certForm.equipment}
          onChange={(e) => setCertForm({ ...certForm, equipment: e.target.value })}
          placeholder="e.g. Drill Press, CNC Router"
          className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor font-medium dark:text-white transition-all"
        />
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Description</label>
        <textarea
          value={certForm.description}
          onChange={(e) => setCertForm({ ...certForm, description: e.target.value })}
          placeholder="What does this certification cover?"
          rows={3}
          className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor font-medium dark:text-white resize-none transition-all"
        />
      </div>
      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Safety Guide / Instructions</label>
        <textarea
          value={certForm.safetyGuide}
          onChange={(e) => setCertForm({ ...certForm, safetyGuide: e.target.value })}
          placeholder="Safety procedures, rules, and guidelines..."
          rows={4}
          className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor font-medium dark:text-white resize-none transition-all"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Department</label>
          <select
            value={certForm.department}
            onChange={(e) => setCertForm({ ...certForm, department: e.target.value })}
            className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor font-bold dark:text-white transition-all"
          >
            <option value="">General</option>
            {settings.departments.map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Level</label>
          <select
            value={certForm.level}
            onChange={(e) => setCertForm({ ...certForm, level: parseInt(e.target.value) })}
            className="w-full p-4 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-teamColor font-bold dark:text-white transition-all"
          >
            {LEVELS.map(l => <option key={l} value={l}>Level {l}</option>)}
          </select>
        </div>
        <p className="col-span-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium -mt-2">
          Students must finish every certification in {certForm.department || 'General'} Level {Math.max(1, certForm.level - 1)} before they can start Level {certForm.level}.
        </p>
      </div>

      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Links</label>
        <div className="space-y-2 mb-3">
          {certForm.links.map((link, idx) => (
            <div key={link.id} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl">
              <span className="text-slate-400 flex-shrink-0">{linkIcon(link.type, 13)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{link.label || link.url}</span>
                <span className="block text-[10px] text-slate-400 truncate">{link.url}</span>
              </span>
              <button
                onClick={() => setCertForm({ ...certForm, links: certForm.links.filter((_, i) => i !== idx) })}
                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={certForm.newLinkLabel}
            onChange={(e) => setCertForm({ ...certForm, newLinkLabel: e.target.value })}
            placeholder="Label"
            className="w-32 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-medium dark:text-white transition-all"
          />
          <input
            value={certForm.newLinkUrl}
            onChange={(e) => setCertForm({ ...certForm, newLinkUrl: e.target.value })}
            placeholder="https://..."
            className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-medium dark:text-white transition-all"
          />
          <select
            value={certForm.newLinkType}
            onChange={(e) => setCertForm({ ...certForm, newLinkType: e.target.value })}
            className="p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-bold dark:text-white transition-all"
          >
            {LINK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <button
            onClick={() => {
              if (!certForm.newLinkUrl.trim()) return;
              setCertForm({
                ...certForm,
                links: [...certForm.links, {
                  id: `${Date.now()}-${certForm.links.length}`,
                  label: certForm.newLinkLabel.trim(),
                  url: normalizeUrl(certForm.newLinkUrl),
                  type: certForm.newLinkType,
                }],
                newLinkLabel: '', newLinkUrl: '', newLinkType: 'doc',
              });
            }}
            className="p-3 bg-slate-900 dark:bg-slate-600 text-white rounded-xl hover:bg-red-600 transition-all"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <div>
        <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Checklist Items</label>
        <div className="space-y-2 mb-3">
          {certForm.checklistItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700 border border-slate-100 dark:border-slate-600 rounded-xl">
              <div className="flex flex-col gap-0.5 flex-shrink-0">
                <button
                  onClick={() => {
                    if (idx === 0) return;
                    const next = [...certForm.checklistItems];
                    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                    setCertForm({ ...certForm, checklistItems: next });
                  }}
                  disabled={idx === 0}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronUp size={11} />
                </button>
                <button
                  onClick={() => {
                    if (idx === certForm.checklistItems.length - 1) return;
                    const next = [...certForm.checklistItems];
                    [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
                    setCertForm({ ...certForm, checklistItems: next });
                  }}
                  disabled={idx === certForm.checklistItems.length - 1}
                  className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                >
                  <ChevronDown size={11} />
                </button>
              </div>
              <Check size={12} className="text-green-500 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{item}</span>
              <button
                onClick={() => setCertForm({ ...certForm, checklistItems: certForm.checklistItems.filter((_, i) => i !== idx) })}
                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={certForm.newChecklistItem}
            onChange={(e) => setCertForm({ ...certForm, newChecklistItem: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && certForm.newChecklistItem.trim()) {
                setCertForm({ ...certForm, checklistItems: [...certForm.checklistItems, certForm.newChecklistItem.trim()], newChecklistItem: '' });
              }
            }}
            placeholder="Add checklist item (press Enter)"
            className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-teamColor text-sm font-medium dark:text-white transition-all"
          />
          <button
            onClick={() => {
              if (certForm.newChecklistItem.trim()) {
                setCertForm({ ...certForm, checklistItems: [...certForm.checklistItems, certForm.newChecklistItem.trim()], newChecklistItem: '' });
              }
            }}
            className="p-3 bg-slate-900 dark:bg-slate-600 text-white rounded-xl hover:bg-red-600 transition-all"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col gap-4 md:gap-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-xl border border-slate-200 dark:border-slate-600">
          <button
            onClick={() => setActiveTab('certs')}
            className={`px-4 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'certs' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
          >
            Certifications
          </button>
          <button
            onClick={() => setActiveTab('mine')}
            className={`px-4 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'mine' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
          >
            My Status
          </button>
          {canSeeQueue && (
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-4 py-2 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${activeTab === 'queue' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-400 hover:text-amber-600 dark:text-slate-500 dark:hover:text-amber-400'}`}
            >
              Trainer Queue
              {queueRequests.filter(r => r.status === 'pending').length > 0 && (
                <span className="bg-white text-amber-600 px-1.5 rounded-full text-[8px]">
                  {queueRequests.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
          )}
        </div>
        {canManageCerts && activeTab === 'certs' && (
          <button
            onClick={() => { resetCertForm(); setShowCreateModal(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-teamColor text-white font-black rounded-xl hover:opacity-90 shadow-lg shadow-teamColor/20 transition-all uppercase text-[10px] tracking-wider"
          >
            <Plus size={15} /> New Certification
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl text-red-600 dark:text-red-400 text-sm font-bold">
          {error}
        </div>
      )}

      {activeTab === 'certs' && (
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0 overflow-hidden">
          <div className={`${selectedCert ? 'lg:w-80 xl:w-96' : 'w-full'} flex flex-col min-h-0`}>
            <div className="relative mb-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={certSearch}
                onChange={(e) => setCertSearch(e.target.value)}
                placeholder="Search certifications..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-red-600 transition-all dark:text-white"
              />
            </div>
            <div className="flex-1 overflow-auto space-y-2 pr-1">
              {loading ? (
                <div className="py-12 text-center text-slate-400 text-sm font-bold uppercase">Loading...</div>
              ) : filteredCerts.length === 0 ? (
                <div className="py-12 text-center">
                  <ShieldCheck size={40} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                  <p className="text-slate-400 dark:text-slate-500 font-black text-sm uppercase">No certifications yet</p>
                  {canManageCerts && <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">Create one to get started</p>}
                </div>
              ) : (
                groupedCerts.map(track => (
                  <div key={track.department ?? '__general'} className="mb-5">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: track.color }} />
                      <h3 className="text-[10px] font-black uppercase tracking-widest" style={{ color: track.color }}>
                        {track.department ?? 'General'}
                      </h3>
                    </div>
                    {track.levels.map(({ level, unlocked, info, certs }) => (
                      <div key={level} className="mb-3">
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          {unlocked
                            ? <Unlock size={10} className="text-slate-400 flex-shrink-0" />
                            : <Lock size={10} className="text-amber-500 flex-shrink-0" />}
                          <span className={`text-[9px] font-black uppercase tracking-widest ${unlocked ? 'text-slate-400 dark:text-slate-500' : 'text-amber-600 dark:text-amber-400'}`}>
                            Level {level}
                          </span>
                          {info && (
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500">
                              {info.heldCount}/{info.total}
                            </span>
                          )}
                          {info?.earned && (
                            <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase"
                              style={{ backgroundColor: track.color + '18', color: track.color }}>
                              Badge earned
                            </span>
                          )}
                          {!unlocked && (
                            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              Finish Level {level - 1} first
                            </span>
                          )}
                          <div className="flex-1 h-px bg-slate-100 dark:bg-slate-700" />
                        </div>
                        <div className="space-y-2">
                          {certs.map((cert: any) => {
                            const held = heldCertIds.has(cert.id);
                            return (
                              <button
                                key={cert.id}
                                onClick={() => loadCertDetail(cert)}
                                className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${
                                  selectedCert?.id === cert.id
                                    ? 'bg-teamColor/5 border-teamColor/40'
                                    : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-teamColor/30'
                                } ${!unlocked && !held ? 'opacity-60' : ''}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                      held ? 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'
                                           : selectedCert?.id === cert.id ? 'bg-teamColor text-white'
                                           : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                                    }`}>
                                      {held ? <Check size={16} /> : !unlocked ? <Lock size={14} /> : <ShieldCheck size={16} />}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight truncate">{cert.name}</p>
                                      {cert.equipment && (
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate">{cert.equipment}</p>
                                      )}
                                      <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                                          <Users size={9} /> {cert.certifiedCount ?? 0} certified
                                        </span>
                                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                                          <User size={9} /> {cert.trainerCount ?? 0} trainers
                                        </span>
                                        {cert.links?.length > 0 && (
                                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                                            <Link2 size={9} /> {cert.links.length}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 flex-shrink-0 mt-1" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {selectedCert && (
            <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700 overflow-auto p-6 space-y-6 min-h-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center flex-shrink-0">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">{selectedCert.name}</h2>
                    {selectedCert.equipment && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">{selectedCert.equipment}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-tighter border"
                        style={{
                          backgroundColor: deptColor(selectedCert.department ?? null) + '18',
                          color: deptColor(selectedCert.department ?? null),
                          borderColor: deptColor(selectedCert.department ?? null) + '50',
                        }}>
                        {selectedCert.department ?? 'General'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-tighter">
                        Level {selectedCert.level ?? 1}
                      </span>
                      {!isUnlocked(selectedCert.department ?? null, selectedCert.level ?? 1) && (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-tighter flex items-center gap-1">
                          <Lock size={9} /> Locked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {canManageCerts && (
                    <>
                      <button
                        onClick={() => openEditModal(selectedCert)}
                        className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        title="Edit"
                      >
                        <Edit3 size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteCert(selectedCert.id)}
                        className="p-2 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                  <button onClick={() => setSelectedCert(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-all dark:text-slate-400">
                    <X size={15} />
                  </button>
                </div>
              </div>

              {selectedCert.description && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Description</p>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{selectedCert.description}</p>
                </div>
              )}

              {selectedCert.safetyGuide && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
                  <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> Safety Guide
                  </p>
                  <div className="text-sm text-amber-900 dark:text-amber-200 font-medium leading-relaxed space-y-0.5">{renderMarkdown(selectedCert.safetyGuide)}</div>
                </div>
              )}

              {selectedCert.links?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Link2 size={10} /> Links
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedCert.links.map((link: any) => (
                      <ProjectLinkChip key={link.id} link={link} />
                    ))}
                  </div>
                </div>
              )}

              {selectedCert.checklistItems?.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Checklist Items</p>
                  <div className="space-y-2">
                    {selectedCert.checklistItems.map((item: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-100 dark:border-slate-600">
                        <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center flex-shrink-0">
                          <span className="text-[8px] font-black text-slate-400">{idx + 1}</span>
                        </div>
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {detailLoading ? (
                <div className="text-center py-6 text-slate-400 text-sm font-bold">Loading...</div>
              ) : (
                <>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Users size={10} /> Certified Members ({certifiedUsers.length})
                    </p>
                    {certifiedUsers.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">No certified members yet.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {certifiedUsers.map((u: any) => (
                          <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
                            <div className="w-6 h-6 rounded-lg bg-green-600 text-white flex items-center justify-center text-[9px] font-black">{u.name?.[0]}</div>
                            <span className="text-[10px] font-bold text-green-800 dark:text-green-300 uppercase">{u.name}</span>
                            {(isCoachOrCaptain || (isTrainer && certTrainers.some(t => t.id === parseInt(currentUser?.id || '0')))) && (
                              <button
                                onClick={() => handleRevokeUser(u.id)}
                                className="p-0.5 text-green-400 hover:text-red-600 transition-colors"
                                title="Revoke"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <ShieldCheck size={10} /> Trainers ({certTrainers.length})
                    </p>
                    {certTrainers.length === 0 ? (
                      <p className="text-sm text-slate-400 dark:text-slate-500 font-medium">No assigned trainers.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {certTrainers.map((u: any) => (
                          <div key={u.id} className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
                            <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center text-[9px] font-black">{u.name?.[0]}</div>
                            <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase">{u.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(() => {
                    const alreadyCertified = certifiedUsers.some(u => u.id === parseInt(currentUser?.id || '0'));
                    const hasActiveRequest = myRequests.some(r => r.certificationId === selectedCert.id && ['pending', 'in_progress'].includes(r.status));
                    const levelOpen = isUnlocked(selectedCert.department ?? null, selectedCert.level ?? 1);
                    if (!alreadyCertified && !hasActiveRequest && !levelOpen) {
                      return (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-2xl">
                            <Lock size={14} className="text-amber-600 flex-shrink-0" />
                            <span className="text-sm font-black text-slate-600 dark:text-slate-300 uppercase">
                              Finish every {selectedCert.department ?? 'General'} Level {(selectedCert.level ?? 1) - 1} certification first
                            </span>
                          </div>
                        </div>
                      );
                    }
                    if (!alreadyCertified && !hasActiveRequest) {
                      return (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                          <button
                            onClick={async () => { await handleRequestCert(selectedCert.id); await loadCertDetail(selectedCert); }}
                            className="w-full py-3 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 shadow-lg shadow-teamColor/20 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                          >
                            <ClipboardList size={14} /> Request Training Certification
                          </button>
                        </div>
                      );
                    }
                    if (alreadyCertified) {
                      return (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-2xl">
                            <Check size={14} className="text-green-600" />
                            <span className="text-sm font-black text-green-700 dark:text-green-300 uppercase">You are certified for this</span>
                          </div>
                        </div>
                      );
                    }
                    if (hasActiveRequest) {
                      return (
                        <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-2xl">
                            <Clock size={14} className="text-amber-600" />
                            <span className="text-sm font-black text-amber-700 dark:text-amber-300 uppercase">Training request pending</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {(isCoachOrCaptain || isTrainer) && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Grant Certification</p>
                      {grantError && <p className="text-red-600 text-xs font-bold mb-2">{grantError}</p>}
                      <div className="flex gap-2">
                        <select
                          value={grantUserId}
                          onChange={(e) => setGrantUserId(e.target.value)}
                          className="flex-1 p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl text-sm font-medium outline-none focus:border-teamColor transition-all dark:text-white"
                        >
                          <option value="">Select user...</option>
                          {allUsers
                            .filter(u => !certifiedUsers.some(cu => cu.id === u.id))
                            .map(u => <option key={u.id} value={u.id}>{u.name} (@{u.username})</option>)
                          }
                        </select>
                        <button
                          onClick={handleGrantUser}
                          disabled={!grantUserId || grantLoading}
                          className="px-4 py-3 bg-green-600 text-white font-black text-xs rounded-xl hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-1.5 uppercase"
                        >
                          <Check size={14} /> Grant
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'mine' && (
        <div className="flex-1 overflow-auto space-y-6">
          <div>
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <ShieldCheck size={12} className="text-green-500" /> My Certifications
            </h3>
            {myCerts.length === 0 ? (
              <div className="py-8 text-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <Lock size={32} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-slate-400 dark:text-slate-500 font-black text-sm uppercase">No certifications yet</p>
                <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">Request training from a Trainer</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {myCerts.map((cert: any) => (
                  <div key={cert.id} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-green-200 dark:border-green-700">
                    <div className="w-10 h-10 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-xl flex items-center justify-center flex-shrink-0">
                      <ShieldCheck size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight truncate">{cert.name}</p>
                      {cert.equipment && <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{cert.equipment}</p>}
                      <p className="text-[9px] text-green-600 dark:text-green-400 font-bold mt-0.5 flex items-center gap-1">
                        <Check size={9} /> Certified
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock size={12} className="text-amber-500" /> Pending Requests
            </h3>
            {myRequests.filter(r => ['pending', 'in_progress'].includes(r.status)).length === 0 ? (
              <div className="py-6 text-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                <p className="text-slate-400 dark:text-slate-500 font-bold text-sm">No active requests.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRequests.filter(r => ['pending', 'in_progress'].includes(r.status)).map((req: any) => (
                  <div key={req.id} className="flex items-center justify-between gap-4 p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ClipboardList size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-xs text-slate-900 dark:text-white uppercase tracking-tight truncate">{req.certification?.name}</p>
                        {req.trainerId && (
                          <p className="text-[9px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            Trainer: {getUserName(req.trainerId)}
                          </p>
                        )}
                      </div>
                    </div>
                    {statusBadge(req.status)}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6">
              <h4 className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Available to Request</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {certifications
                  .filter(cert =>
                    !myCerts.some((mc: any) => mc.id === cert.id) &&
                    !myRequests.some((r: any) => r.certificationId === cert.id && ['pending', 'in_progress'].includes(r.status))
                  )
                  .map(cert => (
                    <div key={cert.id} className="flex items-center justify-between gap-3 p-4 bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl flex items-center justify-center flex-shrink-0">
                          <Lock size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-[10px] text-slate-900 dark:text-white uppercase tracking-tight truncate">{cert.name}</p>
                          {cert.equipment && <p className="text-[9px] text-slate-500 dark:text-slate-400 truncate">{cert.equipment}</p>}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRequestCert(cert.id)}
                        className="flex-shrink-0 px-3 py-1.5 bg-red-600 text-white font-black text-[9px] rounded-xl hover:bg-red-700 transition-all uppercase tracking-wider"
                      >
                        Request
                      </button>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">Request History</h3>
            <div className="space-y-2">
              {myRequests.filter(r => ['completed', 'rejected'].includes(r.status)).map((req: any) => (
                <div key={req.id} className="flex items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <div className="min-w-0">
                    <p className="font-black text-[10px] text-slate-700 dark:text-slate-300 uppercase tracking-tight truncate">{req.certification?.name}</p>
                    {req.notes && <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{req.notes}</p>}
                  </div>
                  {statusBadge(req.status)}
                </div>
              ))}
              {myRequests.filter(r => ['completed', 'rejected'].includes(r.status)).length === 0 && (
                <p className="text-center text-slate-400 dark:text-slate-500 text-sm font-medium py-4">No history yet.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queue' && canSeeQueue && (
        <div className="flex-1 overflow-auto space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-full uppercase">
                {queueRequests.filter(r => r.status === 'pending').length} Pending
              </span>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px] font-black rounded-full uppercase">
                {queueRequests.filter(r => r.status === 'in_progress').length} In Progress
              </span>
            </div>
            <button onClick={loadQueue} className="ml-auto px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase hover:bg-slate-200 dark:hover:bg-slate-600 transition-all">
              Refresh
            </button>
          </div>

          {queueRequests.length === 0 ? (
            <div className="py-16 text-center bg-white dark:bg-slate-800 rounded-2xl border-2 border-slate-100 dark:border-slate-700">
              <Check size={40} className="text-slate-200 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500 font-black text-sm uppercase">Queue is clear</p>
              <p className="text-slate-400 dark:text-slate-600 text-xs mt-1">No pending certification requests.</p>
            </div>
          ) : (
            <>
              {(() => {
                const pendingReqs = queueRequests.filter(r => r.status === 'pending');
                const inProgressReqs = queueRequests.filter(r => r.status === 'in_progress');
                const renderCard = (req: any) => {
                  const claimedByOther = req.status === 'in_progress' &&
                    req.trainerId &&
                    req.trainerId !== parseInt(currentUser?.id || '0') &&
                    !isCoachOrCaptain;
                  return (
                  <div key={req.id} className={`rounded-2xl border-2 p-5 transition-all ${claimedByOther ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50 opacity-60' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${req.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
                          <ClipboardList size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-sm text-slate-900 dark:text-white uppercase tracking-tight">{req.certification?.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border"
                              style={{
                                backgroundColor: deptColor(req.certification?.department ?? null) + '18',
                                color: deptColor(req.certification?.department ?? null),
                                borderColor: deptColor(req.certification?.department ?? null) + '50',
                              }}>
                              {req.certification?.department ?? 'General'}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[8px] font-black uppercase tracking-tighter">
                              Lvl {req.certification?.level ?? 1}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                            Requester: {getUserName(req.userId)} • {fmtDate(req.requestedAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {req.trainerId && (
                            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                              Claimed by: {getUserName(req.trainerId)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {statusBadge(req.status)}
                        {req.status === 'pending' && (
                          <button
                            onClick={() => handleClaimRequest(req.id)}
                            className="px-3 py-1.5 bg-blue-600 text-white font-black text-[9px] rounded-xl hover:bg-blue-700 transition-all uppercase tracking-wider"
                          >
                            Claim
                          </button>
                        )}
                        {req.status === 'in_progress' && (req.trainerId === parseInt(currentUser?.id || '0') || isCoachOrCaptain) && (
                          <button
                            onClick={() => openRequestDetail(req)}
                            className="px-3 py-1.5 bg-slate-900 dark:bg-slate-600 text-white font-black text-[9px] rounded-xl hover:bg-red-600 transition-all uppercase tracking-wider"
                          >
                            Process
                          </button>
                        )}
                      </div>
                    </div>
                    {req.certification?.checklistItems?.length > 0 && req.status === 'in_progress' && (
                      <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                        <div className="flex gap-1.5 flex-wrap">
                          {(req.checklistProgress || []).map((p: any, idx: number) => (
                            <div key={idx} className={`px-2 py-0.5 rounded-lg text-[8px] font-black ${p.completed ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                              {idx + 1}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                };
                return (
                  <>
                    {pendingReqs.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                          <Clock size={12} /> Pending Requests ({pendingReqs.length})
                        </h4>
                        {pendingReqs.map(renderCard)}
                      </div>
                    )}
                    {inProgressReqs.length > 0 && (
                      <div className="space-y-3 mt-4">
                        <h4 className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                          <ClipboardList size={12} /> In Progress ({inProgressReqs.length})
                        </h4>
                        {inProgressReqs.map(renderCard)}
                      </div>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      )}

      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl border-t-8 border-teamColor max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {showCreateModal ? 'New Certification' : 'Edit Certification'}
                </h2>
                <p className="text-[10px] text-teamColor font-bold uppercase tracking-widest mt-0.5">Safety training configuration</p>
              </div>
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); setEditingCert(null); resetCertForm(); }}
                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-all dark:text-slate-400"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {renderCertFormFields()}
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 flex gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); setEditingCert(null); resetCertForm(); }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all uppercase tracking-widest text-xs"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateCert : handleEditCert}
                disabled={!certForm.name.trim()}
                className="flex-1 py-3 bg-teamColor text-white font-black rounded-2xl hover:opacity-90 shadow-lg shadow-teamColor/20 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
              >
                {showCreateModal ? 'Create Certification' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {requestDetail && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-xl shadow-2xl border-t-8 border-amber-500 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">{requestDetail.certification?.name}</h2>
                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-widest mt-0.5">
                  Requester: {getUserName(requestDetail.userId)}
                </p>
              </div>
              <button onClick={() => setRequestDetail(null)} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:text-red-600 transition-all dark:text-slate-400">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {requestDetail.certification?.safetyGuide && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl">
                  <p className="text-[9px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <AlertTriangle size={11} /> Safety Guide
                  </p>
                  <div className="text-sm text-amber-900 dark:text-amber-200 font-medium leading-relaxed space-y-0.5">{renderMarkdown(requestDetail.certification.safetyGuide)}</div>
                </div>
              )}

              {checklistProgress.length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">Checklist Progress</p>
                  <div className="space-y-2">
                    {checklistProgress.map((item, idx) => (
                      <button
                        key={idx}
                        onClick={() => setChecklistProgress(prev => prev.map((p, i) => i === idx ? { ...p, completed: !p.completed } : p))}
                        className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${item.completed ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700' : 'bg-slate-50 dark:bg-slate-700 border-slate-100 dark:border-slate-600 hover:border-green-300 dark:hover:border-green-600'}`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${item.completed ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-500'}`}>
                          {item.completed && <Check size={11} className="text-white" />}
                        </div>
                        <span className={`text-sm font-medium ${item.completed ? 'text-green-700 dark:text-green-300 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{item.item}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Trainer Notes</label>
                <textarea
                  value={trainerNotes}
                  onChange={(e) => setTrainerNotes(e.target.value)}
                  placeholder="Add notes about the training session..."
                  rows={3}
                  className="w-full p-3 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-xl outline-none focus:border-amber-500 font-medium dark:text-white resize-none transition-all"
                />
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <button
                onClick={handleSaveProgress}
                disabled={requestActionLoading}
                className="w-full py-2.5 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
              >
                Save Progress
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleRejectRequest}
                  disabled={requestActionLoading || !trainerNotes.trim()}
                  title={!trainerNotes.trim() ? 'Add trainer notes before rejecting' : ''}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-700 text-red-600 dark:text-red-400 font-black rounded-2xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-all uppercase tracking-widest text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reject
                </button>
                <button
                  onClick={handleCompleteRequest}
                  disabled={requestActionLoading || (checklistProgress.length > 0 && !checklistProgress.every(p => p.completed))}
                  title={(checklistProgress.length > 0 && !checklistProgress.every(p => p.completed)) ? 'Complete all checklist items first' : ''}
                  className="flex-1 py-2.5 bg-green-600 text-white font-black rounded-2xl hover:bg-green-700 transition-all uppercase tracking-widest text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Check size={13} /> Award Certification
                </button>
              </div>
              {!trainerNotes.trim() && <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold text-center">Notes required to reject</p>}
              {checklistProgress.length > 0 && !checklistProgress.every(p => p.completed) && (
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold text-center">
                  {checklistProgress.filter(p => p.completed).length}/{checklistProgress.length} checklist items done
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Certifications;
