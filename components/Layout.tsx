
import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Kanban, Users, LogOut, Home as HomeIcon, Cloud, CloudOff } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  notificationsCount: number;
  onLogout: () => void;
  isSynced?: boolean;
}

const TeamLogo = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="100" rx="10" fill="currentColor" />
    <circle cx="12" cy="12" r="5" fill="white" />
    <circle cx="12" cy="88" r="5" fill="white" />
    <circle cx="88" cy="88" r="5" fill="white" />
    <rect x="25" y="8" width="55" height="30" rx="4" fill="white" fillOpacity="0.1" />
    <rect x="58" y="8" width="14" height="24" fill="white" />
    <circle cx="50" cy="48" r="16" fill="white" />
    <circle cx="50" cy="48" r="6" fill="black" />
    <circle cx="56" cy="48" r="2" fill="black" />
    <text x="50" y="82" fontFamily="monospace" fontWeight="900" fontSize="19" fill="white" textAnchor="middle" letterSpacing="-1">10991</text>
  </svg>
);

const Layout: React.FC<LayoutProps> = ({ children, user, notificationsCount, onLogout, isSynced = false }) => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Solid Black */}
      <aside className="w-72 bg-slate-950 text-white flex flex-col shadow-2xl z-10">
        <div className="p-8 flex items-center gap-4 border-b border-white/10">
          <div className="text-red-600 shadow-lg shadow-red-900/20">
            <TeamLogo className="w-10 h-10" />
          </div>
          <div>
            <h1 className="font-black text-xl leading-tight tracking-tighter uppercase">PIO-BYTES</h1>
            <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase">Team 10991</p>
          </div>
        </div>

        <nav className="flex-1 p-6 space-y-3">
          <NavItem to="/" icon={<HomeIcon size={22} />} label="HOME" />
          <NavItem 
            to="/war-room" 
            icon={<LayoutDashboard size={22} />} 
            label="WAR ROOM" 
          />
          <NavItem to="/boards" icon={<Kanban size={22} />} label="KANBAN BOARDS" />
          <NavItem to="/team" icon={<Users size={22} />} label="TEAM" />
        </nav>

        <div className="p-6 border-t border-white/10 bg-black/40">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center font-black text-lg border border-red-400/30 shadow-inner">
                {user?.name?.[0] || 'U'}
              </div>
              {notificationsCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-white text-red-600 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                  {notificationsCount}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold truncate">{user?.name}</p>
              <p className="text-[10px] text-red-500 font-black uppercase tracking-wider truncate">{user?.roles?.[0]}</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-red-600 transition-all border border-white/10 rounded-xl"
          >
            <LogOut size={16} />
            SIGN OUT
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center px-12 justify-between">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">PIO-BYTES HUB</h2>
            </div>
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
                  <div className={`w-2 h-2 rounded-full ${isSynced ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`} />
                  <div className="text-left">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Sync Status</p>
                    <p className="text-[10px] font-black text-slate-900 uppercase tracking-tighter leading-none">
                      {isSynced ? 'Cloud Online' : 'Cloud Offline'}
                    </p>
                  </div>
                  {isSynced ? <Cloud size={14} className="text-slate-300" /> : <CloudOff size={14} className="text-red-300" />}
                </div>
                <div className="h-10 w-[1px] bg-slate-200"></div>
                <div className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-[10px] font-black rounded-lg uppercase tracking-tighter shadow-sm">
                  Build 2025
                </div>
            </div>
        </header>
        <div className="flex-1 overflow-auto bg-slate-50/50">
          <div className="w-full h-full p-12">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string }> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex items-center gap-4 px-5 py-4 rounded-xl transition-all font-black text-xs tracking-widest ${
        isActive 
          ? 'bg-red-600 text-white shadow-lg shadow-red-900/20 scale-[1.02]' 
          : 'text-slate-500 hover:text-white hover:bg-white/5'
      }`
    }
  >
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default Layout;
