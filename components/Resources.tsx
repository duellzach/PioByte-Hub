import React, { useState } from 'react';
import { ExternalLink, Search, BookOpen, Zap, Code2, Trophy, Cpu, Video, FileText, Globe, Youtube, ChevronRight } from 'lucide-react';

interface Resource {
  id: string;
  title: string;
  description: string;
  url: string;
  category: string;
  tags?: string[];
  pinned?: boolean;
}

const RESOURCES: Resource[] = [
  { id: 'r1', title: 'The Blue Alliance', description: 'Official FRC match results, team info, event data, and historical records.', url: 'https://www.thebluealliance.com', category: 'FRC Official', tags: ['scouting', 'matches', 'events'], pinned: true },
  { id: 'r2', title: 'FRC Nexus', description: 'Live event queuing, announcements, and pit display coordination tool.', url: 'https://frc.nexus', category: 'FRC Official', tags: ['events', 'live'], pinned: true },
  { id: 'r3', title: 'FIRST Robotics Competition', description: 'Official FIRST website — game manuals, season information, and registration.', url: 'https://www.firstinspires.org/robotics/frc', category: 'FRC Official', tags: ['official', 'rules', 'season'] },
  { id: 'r4', title: 'FRC Game Manual', description: 'Current season game manual with all official rules and scoring criteria.', url: 'https://www.firstinspires.org/resource-library/frc/competition-manual-qa-system', category: 'FRC Official', tags: ['rules', 'game'] },
  { id: 'r5', title: 'REV Robotics', description: 'Control system components, SPARK MAX motor controllers, and documentation.', url: 'https://docs.revrobotics.com', category: 'Technical', tags: ['hardware', 'motors', 'control'] },
  { id: 'r6', title: 'CTRE Phoenix Documentation', description: 'Talon SRX, Falcon 500, and Phoenix 6 documentation and API reference.', url: 'https://pro.docs.ctr-electronics.com', category: 'Technical', tags: ['hardware', 'motors'] },
  { id: 'r7', title: 'WPILib Documentation', description: 'Official WPILib docs — the primary Java/C++ library for FRC robot programming.', url: 'https://docs.wpilib.org', category: 'Programming', tags: ['programming', 'java', 'cpp'], pinned: true },
  { id: 'r8', title: 'Chief Delphi', description: 'The primary FRC community forum for strategy, technical discussion, and build threads.', url: 'https://www.chiefdelphi.com', category: 'Community', tags: ['community', 'strategy', 'forums'] },
  { id: 'r9', title: 'Spectrum 3847 Scouting Resources', description: 'Strategy and scouting guides from one of FRC\'s most respected teams.', url: 'https://spectrum3847.org', category: 'Strategy', tags: ['scouting', 'strategy'] },
  { id: 'r10', title: 'FRC 6328 Mechanical Advantage', description: 'Open-source code, technical documentation, and build resources.', url: 'https://github.com/Mechanical-Advantage', category: 'Programming', tags: ['programming', 'open-source'] },
  { id: 'r11', title: 'Limelight Vision', description: 'FRC-targeted vision tracking system with detailed setup documentation.', url: 'https://docs.limelightvision.io', category: 'Technical', tags: ['vision', 'programming'] },
  { id: 'r12', title: 'PathPlanner', description: 'Advanced autonomous path planning for FRC robots.', url: 'https://pathplanner.dev', category: 'Programming', tags: ['autonomous', 'programming'] },
  { id: 'r13', title: 'FRC Design Sourcebook', description: 'Open-source design guide covering mechanisms, systems, and fabrication.', url: 'https://www.frcdesign.org', category: 'Design', tags: ['design', 'mechanisms', 'cad'] },
  { id: 'r14', title: 'Onshape FRC Library', description: 'Community-maintained parts library for FRC design in Onshape.', url: 'https://cad.onshape.com/documents/7bfda6b4d5f79b44e17bbc9f', category: 'Design', tags: ['cad', 'design'] },
  { id: 'r15', title: 'FRC YouTube Channel', description: 'Official FIRST YouTube channel with event streams, reveals, and highlights.', url: 'https://www.youtube.com/@FIRSTRoboticsCompetition', category: 'Media', tags: ['video', 'streams'] },
  { id: 'r16', title: 'FRC Statbotics', description: 'Advanced FRC analytics, EPA ratings, and team performance statistics.', url: 'https://www.statbotics.io', category: 'Strategy', tags: ['analytics', 'scouting', 'statistics'] },
  { id: 'r17', title: 'Playing With Fusion', description: 'Time-of-flight distance sensors and other FRC-legal sensors.', url: 'https://www.playingwithfusion.com', category: 'Technical', tags: ['hardware', 'sensors'] },
  { id: 'r18', title: 'FRC Driver Station Setup', description: 'NI FRC driver station installation and configuration guide.', url: 'https://docs.wpilib.org/en/stable/docs/zero-to-robot/step-2/frc-game-tools.html', category: 'Technical', tags: ['driver-station', 'setup'] },
];

const CATEGORIES: Record<string, { icon: React.ReactNode; color: string }> = {
  'FRC Official': { icon: <Trophy size={14} />, color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800' },
  'Programming': { icon: <Code2 size={14} />, color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' },
  'Technical': { icon: <Cpu size={14} />, color: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20 border-purple-100 dark:border-purple-800' },
  'Strategy': { icon: <Zap size={14} />, color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800' },
  'Design': { icon: <FileText size={14} />, color: 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' },
  'Community': { icon: <Globe size={14} />, color: 'text-slate-600 bg-slate-50 dark:bg-slate-700/50 border-slate-200 dark:border-slate-600' },
  'Media': { icon: <Youtube size={14} />, color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800' },
};

const Resources: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');

  const filtered = RESOURCES.filter(r => {
    const matchesSearch = !search.trim() ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase()) ||
      (r.tags || []).some(t => t.includes(search.toLowerCase()));
    const matchesCat = activeCategory === 'All' || r.category === activeCategory;
    return matchesSearch && matchesCat;
  });

  const pinned = filtered.filter(r => r.pinned);
  const rest = filtered.filter(r => !r.pinned);
  const categories = ['All', ...Object.keys(CATEGORIES)];

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-300 overflow-auto pb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Resources</h1>
        <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-0.5">Team Links & External Information Hub</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources, tags..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium outline-none focus:border-red-600 transition-colors dark:text-white dark:placeholder-slate-400"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wide transition-all ${
              activeCategory === cat
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
          >
            {cat === 'All' ? 'All Resources' : cat}
          </button>
        ))}
      </div>

      {pinned.length > 0 && (
        <div>
          <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <Zap size={10} className="text-red-600" fill="currentColor" /> Pinned
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {pinned.map(r => <ResourceCard key={r.id} resource={r} />)}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          {pinned.length > 0 && (
            <h2 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">All Resources</h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {rest.map(r => <ResourceCard key={r.id} resource={r} />)}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <BookOpen size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500 font-bold uppercase text-sm">No resources found</p>
          </div>
        </div>
      )}
    </div>
  );
};

const ResourceCard: React.FC<{ resource: Resource }> = ({ resource }) => {
  const cat = CATEGORIES[resource.category];
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:border-red-600/40 hover:shadow-lg hover:shadow-red-600/5 hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${cat?.color || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
          {cat?.icon}
          {resource.category}
        </div>
        <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-red-600 flex-shrink-0 transition-colors mt-0.5" />
      </div>
      <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1 group-hover:text-red-600 transition-colors flex items-center gap-1.5">
        {resource.title}
        {resource.pinned && <Zap size={9} className="text-red-600 flex-shrink-0" fill="currentColor" />}
      </h3>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-2 line-clamp-2">{resource.description}</p>
      {resource.tags && resource.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {resource.tags.map(tag => (
            <span key={tag} className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
};

export default Resources;
