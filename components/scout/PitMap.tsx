import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin } from 'lucide-react';

const OUR_TEAM = 10991;
const ACCENT_COLOR = '#dc2626';

interface PitMapProps {
  mapData: any;
  loading: boolean;
  error: string | null;
  eventKey: string | null;
  onRefresh: () => void;
}

const PitMap: React.FC<PitMapProps> = ({ mapData, loading, error, eventKey, onRefresh }) => {
  const [searchTeam, setSearchTeam] = useState('');
  const [highlightedTeam, setHighlightedTeam] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSearch = (val: string) => {
    setSearchTeam(val);
    const trimmed = val.trim();
    setHighlightedTeam(trimmed.length > 0 ? trimmed : null);
  };

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

  if (error === 'NO_MAP' || (!loading && !mapData && !error)) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTeam}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Find a team's pit..."
            type="number"
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
          Team {highlightedTeam} not found on map — they may not have an assigned pit.
        </div>
      )}

      {highlightedTeam && searchedAddress && (
        <div className="text-xs text-slate-600 dark:text-slate-300 font-bold px-1">
          Team {highlightedTeam} is in pit <span className="text-red-600 font-black">{searchedAddress}</span>
        </div>
      )}

      <div className="flex gap-3 text-[10px] font-bold text-slate-500 flex-wrap">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: ACCENT_COLOR }} />
          Team {OUR_TEAM}
        </span>
        {highlightedTeam && highlightedTeam !== ourTeamStr && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm bg-orange-400" />
            Team {highlightedTeam}
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
        className="w-full overflow-auto rounded-2xl border-2 border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800"
        style={{ maxHeight: '70vh' }}
      >
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

      <p className="text-[10px] text-slate-400 font-bold text-right">
        {pitEntries.length} pits · powered by FRC Nexus
      </p>
    </div>
  );
};

export default PitMap;
