import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, MapPin, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useTeamSettings } from '../../contexts/TeamSettingsContext';
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 5;
const ZOOM_STEP = 0.25;

interface PitMapProps {
  mapData: any;
  loading: boolean;
  error: string | null;
  eventKey: string | null;
  onRefresh: () => void;
  teamNames?: Record<string, string>;
  scoutedTeams?: Set<string>;
}

const PitMap: React.FC<PitMapProps> = ({ mapData, loading, error, eventKey, onRefresh, teamNames, scoutedTeams }) => {
  const { settings } = useTeamSettings();
  const OUR_TEAM = settings.teamNumber;
  const ACCENT_COLOR = settings.themeColor;
  const [searchTeam, setSearchTeam] = useState('');
  const [highlightedTeam, setHighlightedTeam] = useState<string | null>(null);
  const [teamNicknames, setTeamNicknames] = useState<Record<string, string>>({});
  const [zoomState, setZoomState] = useState(1);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startCenterX: number;
    startCenterY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);

  const setZoom = useCallback((raw: number) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, raw));
    zoomRef.current = clamped;
    setZoomState(clamped);
  }, []);

  useEffect(() => {
    if (!eventKey) return;
    fetch(`/api/scout/tba/event/${eventKey}/teams`)
      .then((r) => r.json())
      .then((teams: any[]) => {
        if (!Array.isArray(teams)) return;
        const map: Record<string, string> = {};
        teams.forEach((t) => {
          if (t.team_number != null && t.nickname) {
            map[String(t.team_number)] = t.nickname;
          }
        });
        setTeamNicknames(map);
      })
      .catch(() => {});
  }, [eventKey]);

  const nicknames: Record<string, string> = { ...teamNicknames, ...(teamNames ?? {}) };

  const resolveSearchToTeamNumber = (val: string): string | null => {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const pits = mapData?.pits ?? {};
    const lower = trimmed.toLowerCase();
    const byNumber = Object.values(pits).find(
      (pit: any) => pit.team != null && String(pit.team).toLowerCase() === lower
    );
    if (byNumber) return String((byNumber as any).team);
    const byName = Object.values(pits).find((pit: any) => {
      if (pit.team == null) return false;
      const nickname = nicknames[String(pit.team)];
      return nickname && nickname.toLowerCase().includes(lower);
    });
    if (byName) return String((byName as any).team);
    return null;
  };

  const handleSearch = (val: string) => {
    setSearchTeam(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setHighlightedTeam(null);
      return;
    }
    const resolved = resolveSearchToTeamNumber(val);
    setHighlightedTeam(resolved !== null ? resolved : trimmed);
  };

  useEffect(() => {
    if (!searchTeam.trim() || !mapData) return;
    const resolved = resolveSearchToTeamNumber(searchTeam);
    setHighlightedTeam(resolved !== null ? resolved : searchTeam.trim());
  }, [teamNicknames, teamNames, mapData]);

  useEffect(() => {
    if (!highlightedTeam || !mapData || !containerRef.current || !svgRef.current) return;
    const pits = mapData.pits ?? {};
    const targetEntry = Object.entries(pits).find(
      ([, pit]: [string, any]) => (pit.team != null ? String(pit.team) : '').toLowerCase() === highlightedTeam.toLowerCase()
    ) as [string, any] | undefined;
    if (!targetEntry) return;
    const [, pit] = targetEntry;
    const cx = pit.position?.x ?? 0;
    const cy = pit.position?.y ?? 0;
    const mapW = mapData.size?.x ?? 840;
    const mapH = mapData.size?.y ?? 1400;
    const container = containerRef.current;
    const svgEl = svgRef.current;
    const svgRect = svgEl.getBoundingClientRect();
    const scaleX = svgRect.width / mapW;
    const scaleY = svgRect.height / mapH;
    const scale = Math.min(scaleX, scaleY);
    const scrollX = cx * scale - container.clientWidth / 2;
    const scrollY = cy * scale - container.clientHeight / 2;
    container.scrollTo({ left: Math.max(0, scrollX), top: Math.max(0, scrollY), behavior: 'smooth' });
  }, [highlightedTeam, mapData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !mapData) return;

    const getDist = (t1: Touch, t2: Touch) => {
      const dx = t1.clientX - t2.clientX;
      const dy = t1.clientY - t2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) { pinchRef.current = null; return; }
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const rect = container.getBoundingClientRect();
      pinchRef.current = {
        startDist: getDist(t1, t2),
        startZoom: zoomRef.current,
        startCenterX: (t1.clientX + t2.clientX) / 2 - rect.left,
        startCenterY: (t1.clientY + t2.clientY) / 2 - rect.top,
        startScrollLeft: container.scrollLeft,
        startScrollTop: container.scrollTop,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = getDist(t1, t2);
      const { startDist, startZoom, startCenterX, startCenterY, startScrollLeft, startScrollTop } = pinchRef.current;
      const rawZoom = startZoom * (currentDist / startDist);
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, rawZoom));
      zoomRef.current = newZoom;
      setZoomState(newZoom);
      const scale = newZoom / startZoom;
      const newScrollLeft = (startScrollLeft + startCenterX) * scale - startCenterX;
      const newScrollTop = (startScrollTop + startCenterY) * scale - startCenterY;
      container.scrollLeft = Math.max(0, newScrollLeft);
      container.scrollTop = Math.max(0, newScrollTop);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinchRef.current = null;
    };

    const onTouchCancel = () => { pinchRef.current = null; };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [mapData]);

  const clearSearch = () => {
    setSearchTeam('');
    setHighlightedTeam(null);
  };

  if (!eventKey) {
    return (
      <div className="py-20 text-center">
        <MapPin size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-lg font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">No Nexus Event Key</p>
        <p className="text-slate-400 text-sm mt-1">Configure a Nexus event key in event settings to view the pit map.</p>
      </div>
    );
  }

  if (loading && !mapData) {
    return (
      <div className="py-20 text-center text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-sm">
        Loading pit map...
      </div>
    );
  }

  if (error === 'NOT_CONFIGURED') {
    return (
      <div className="py-20 text-center">
        <MapPin size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-lg font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">Nexus Not Configured</p>
        <p className="text-slate-400 text-sm mt-1">Set the NEXUS_API_KEY environment variable to enable the pit map.</p>
      </div>
    );
  }

  if (error === 'NO_MAP') {
    return (
      <div className="py-20 text-center">
        <MapPin size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-lg font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">No Map Data</p>
        <p className="text-slate-400 text-sm mt-1 mb-4">This event does not have a pit map configured in Nexus.</p>
        <button
          onClick={onRefresh}
          className="px-5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!loading && !mapData && !error) {
    return (
      <div className="py-20 text-center">
        <MapPin size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-lg font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">No Map Data</p>
        <p className="text-slate-400 text-sm mt-1">This event does not have a pit map configured in Nexus.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-16 text-center">
        <MapPin size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-sm font-black text-red-500 uppercase tracking-tight mb-2">Failed to load pit map</p>
        <p className="text-xs text-slate-400 mb-4">{error}</p>
        <button
          onClick={onRefresh}
          className="px-5 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!mapData || (!mapData.pits && !mapData.areas && !mapData.labels)) {
    if (mapData) console.warn('PitMap: received data but no recognized keys:', mapData);
    return (
      <div className="py-20 text-center">
        <MapPin size={48} className="text-slate-200 dark:text-slate-700 mx-auto mb-4" />
        <p className="text-lg font-black text-slate-300 dark:text-slate-600 uppercase tracking-tight">No Map Data</p>
        <p className="text-slate-400 text-sm mt-1">This event does not have a pit map configured in Nexus.</p>
      </div>
    );
  }

  const { size, pits = {}, areas = {}, labels = {}, walls = {} } = mapData;
  const mapW = size?.x ?? 840;
  const mapH = size?.y ?? 1400;

  const pitEntries = Object.entries(pits) as [string, any][];
  const areaEntries = Object.entries(areas ?? {}) as [string, any][];
  const labelEntries = Object.entries(labels ?? {}) as [string, any][];
  const wallEntries = Object.entries(walls ?? {}) as [string, any][];

  const renderElement = (el: any, transform?: string) => {
    const cx = el.position?.x ?? 0;
    const cy = el.position?.y ?? 0;
    const w = el.size?.x ?? 10;
    const h = el.size?.y ?? 10;
    const angle = el.angle ?? 0;
    const rotateTransform = angle !== 0 ? `rotate(${angle} ${cx} ${cy})` : '';
    const combined = [transform, rotateTransform].filter(Boolean).join(' ');
    return { cx, cy, w, h, angle, transform: combined || undefined };
  };

  const searchedTeamStr = highlightedTeam?.toString().toLowerCase() ?? '';
  const ourTeamStr = OUR_TEAM.toString();

  const findSearchedPitAddress = () => {
    if (!highlightedTeam) return null;
    const entry = pitEntries.find(([, pit]) => (pit.team != null ? String(pit.team) : '').toLowerCase() === searchedTeamStr);
    return entry ? entry[0] : null;
  };

  const searchedAddress = findSearchedPitAddress();
  const searchedNickname = highlightedTeam ? nicknames[highlightedTeam] : undefined;

  const zoom = zoomState;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTeam}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by team # or name"
            type="text"
            className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-700 border-2 border-slate-100 dark:border-slate-600 rounded-2xl outline-none focus:border-red-600 transition-all font-bold text-sm"
          />
          {searchTeam && (
            <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {highlightedTeam && !searchedAddress && (
        <div className="text-xs text-slate-400 font-bold px-1">
          No team found matching "{searchTeam.trim()}" — they may not have an assigned pit.
        </div>
      )}

      {highlightedTeam && searchedAddress && (
        <div className="text-xs text-slate-600 dark:text-slate-300 font-bold px-1">
          Team {highlightedTeam}{searchedNickname ? ` (${searchedNickname})` : ''} is in pit <span className="text-red-600 font-black">{searchedAddress}</span>
        </div>
      )}

      <div className="flex gap-3 text-[10px] font-bold text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ACCENT_COLOR }} />
          Team {OUR_TEAM}{nicknames[ourTeamStr] ? ` (${nicknames[ourTeamStr]})` : ''}
        </span>
        {highlightedTeam && highlightedTeam !== ourTeamStr && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />
            Team {highlightedTeam}{nicknames[highlightedTeam] ? ` (${nicknames[highlightedTeam]})` : ''}
          </span>
        )}
        {scoutedTeams && scoutedTeams.size > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-green-600" />
            Scouted
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 dark:bg-slate-600" />
          Pit
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-100 dark:bg-blue-900/30" />
          Area
        </span>
      </div>

      <div
        ref={containerRef}
        className="w-full overflow-auto rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 relative"
        style={{ maxHeight: '70vh' }}
      >
        <div
          className="absolute top-3 right-3 z-10 flex flex-col gap-1.5"
          style={{ pointerEvents: 'auto' }}
        >
          <button
            onClick={() => setZoom(zoomRef.current + ZOOM_STEP)}
            disabled={zoom >= MAX_ZOOM}
            aria-label="Zoom in"
            style={{ minHeight: 44, minWidth: 44 }}
            className="flex items-center justify-center bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-600 rounded-xl shadow text-slate-700 dark:text-slate-200 font-black hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={() => setZoom(zoomRef.current - ZOOM_STEP)}
            disabled={zoom <= MIN_ZOOM}
            aria-label="Zoom out"
            style={{ minHeight: 44, minWidth: 44 }}
            className="flex items-center justify-center bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-600 rounded-xl shadow text-slate-700 dark:text-slate-200 font-black hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={() => setZoom(1)}
            disabled={Math.abs(zoom - 1) < 0.01}
            aria-label="Reset zoom"
            style={{ minHeight: 44, minWidth: 44 }}
            className="flex items-center justify-center bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-600 rounded-xl shadow text-slate-700 dark:text-slate-200 font-black hover:bg-white dark:hover:bg-slate-700 disabled:opacity-40 transition-all"
          >
            <RotateCcw size={16} />
          </button>
        </div>

        <div style={{ width: `${zoom * 100}%`, minWidth: `${280 * zoom}px` }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${mapW} ${mapH}`}
            style={{ width: '100%', minWidth: 280, display: 'block', touchAction: 'pan-x pan-y' }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect x={0} y={0} width={mapW} height={mapH} fill="transparent" />

            {wallEntries.map(([id, wall]) => {
              const { cx, cy, w, h, transform } = renderElement(wall);
              return (
                <rect
                  key={`wall-${id}`}
                  x={cx - w / 2}
                  y={cy - h / 2}
                  width={w}
                  height={h}
                  fill="#94a3b8"
                  opacity={0.4}
                  rx={2}
                  transform={transform}
                />
              );
            })}

            {areaEntries.map(([id, area]) => {
              const { cx, cy, w, h, transform } = renderElement(area);
              const label: string = area.label ?? '';
              return (
                <g key={`area-${id}`} transform={transform}>
                  <rect
                    x={cx - w / 2}
                    y={cy - h / 2}
                    width={w}
                    height={h}
                    fill="#dbeafe"
                    stroke="#93c5fd"
                    strokeWidth={1.5}
                    rx={4}
                  />
                  {label && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(w, h) * 0.18}
                      fontWeight="bold"
                      fill="#1d4ed8"
                    >
                      {label}
                    </text>
                  )}
                </g>
              );
            })}

            {labelEntries.map(([id, lbl]) => {
              const { cx, cy, w, h, transform } = renderElement(lbl);
              const text: string = lbl.label ?? '';
              return (
                <g key={`label-${id}`} transform={transform}>
                  <rect
                    x={cx - w / 2}
                    y={cy - h / 2}
                    width={w}
                    height={h}
                    fill="#f1f5f9"
                    stroke="none"
                    rx={4}
                    opacity={0.7}
                  />
                  {text && (
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(w, h) * 0.2}
                      fontWeight="600"
                      fill="#64748b"
                    >
                      {text}
                    </text>
                  )}
                </g>
              );
            })}

            {pitEntries.map(([address, pit]) => {
              const { cx, cy, w, h, transform } = renderElement(pit);
              const team: string | null = pit.team != null ? String(pit.team) : null;
              const isOurs = team === ourTeamStr;
              const isSearched = highlightedTeam !== null && team !== null && team.toLowerCase() === searchedTeamStr;
              const hasTeam = team !== null;
              const isScouted = team !== null && scoutedTeams != null && scoutedTeams.has(team);

              let fillColor = '#f1f5f9';
              let strokeColor = '#cbd5e1';
              let strokeWidth = 1;
              let textFill = '#475569';
              let bgOpacity = 1;

              if (isOurs) {
                fillColor = ACCENT_COLOR;
                strokeColor = '#991b1b';
                strokeWidth = 2;
                textFill = '#ffffff';
              } else if (isSearched) {
                fillColor = '#fb923c';
                strokeColor = '#ea580c';
                strokeWidth = 2;
                textFill = '#ffffff';
              } else if (isScouted) {
                fillColor = '#16a34a';
                strokeColor = '#15803d';
                strokeWidth = 2;
                textFill = '#ffffff';
              } else if (hasTeam) {
                fillColor = '#e2e8f0';
                strokeColor = '#94a3b8';
              }

              const fontSize = Math.min(w * 0.25, h * 0.25, 10);
              const addressFontSize = Math.min(w * 0.18, h * 0.18, 8);

              return (
                <g key={`pit-${address}`} transform={transform} opacity={bgOpacity}>
                  <rect
                    x={cx - w / 2}
                    y={cy - h / 2}
                    width={w}
                    height={h}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    rx={3}
                  />
                  <text
                    x={cx}
                    y={cy - (hasTeam ? fontSize * 0.3 : 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={addressFontSize}
                    fontWeight="700"
                    fill={textFill}
                    opacity={0.8}
                  >
                    {address}
                  </text>
                  {hasTeam && (
                    <text
                      x={cx}
                      y={cy + addressFontSize * 0.9}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fontSize}
                      fontWeight="900"
                      fill={textFill}
                    >
                      {team}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[10px] text-slate-400 font-bold">
          {pitEntries.length} pits · powered by FRC Nexus
        </p>
        {Math.abs(zoom - 1) > 0.01 && (
          <p className="text-[10px] text-slate-400 font-bold">
            {Math.round(zoom * 100)}% zoom
          </p>
        )}
      </div>
    </div>
  );
};

export default PitMap;
