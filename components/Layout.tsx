import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Kanban, Users, LogOut, Home as HomeIcon, Cloud, CloudOff, Menu, X, Clock, TrendingUp, Activity, AlertTriangle, Flag } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  notificationsCount: number;
  onLogout: () => void;
  isSynced?: boolean;
  stats?: {
    weeklyEffort: number;
    activeCount: number;
    blockedCount: number;
    projectCount: number;
  };
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

const Layout: React.FC<LayoutProps> = ({ children, user, notificationsCount, onLogout, isSynced = false, stats }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <div 
        className={`md:hidden fixed inset-0 bg-black/60 z-40 transition-opacity ${
          mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        ${collapsed ? 'w-20' : 'w-64 md:w-56 lg:w-64 xl:w-72'}
        bg-slate-950 text-white flex flex-col shadow-2xl
        transform transition-all duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className={`p-4 ${collapsed ? 'md:p-4' : 'md:p-6 xl:p-8'} flex items-center justify-between border-b border-white/10`}>
          <div className={`flex items-center gap-3 xl:gap-4 overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
            <div className="text-red-600 shadow-lg shadow-red-900/20 flex-shrink-0">
              <TeamLogo className="w-8 h-8 xl:w-10 xl:h-10" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-black text-base xl:text-xl leading-tight tracking-tighter uppercase truncate">PIO-BYTES</h1>
              <p className="text-[9px] xl:text-[10px] text-red-500 font-bold tracking-widest uppercase">Team 10991</p>
            </div>
          </div>
          
          <button 
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <Menu size={20} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
          </button>

          <button 
            className="md:hidden p-2 text-slate-400 hover:text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4 md:p-4 xl:p-6'} space-y-2 xl:space-y-3 overflow-y-auto overflow-x-hidden`}>
          <NavItem to="/" icon={<HomeIcon size={18} />} label="HOME" collapsed={collapsed} onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/war-room" icon={<LayoutDashboard size={18} />} label="WAR ROOM" collapsed={collapsed} onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/boards" icon={<Kanban size={18} />} label="BOARDS" collapsed={collapsed} onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/time" icon={<Clock size={18} />} label="TIME" collapsed={collapsed} onClick={() => setMobileMenuOpen(false)} />
          <NavItem to="/team" icon={<Users size={18} />} label="TEAM" collapsed={collapsed} onClick={() => setMobileMenuOpen(false)} />
        </nav>

        <div className={`${collapsed ? 'p-2' : 'p-4 xl:p-6'} border-t border-white/10 bg-black/40`}>
          <div className={`flex items-center gap-3 xl:gap-4 ${collapsed ? 'mb-2' : 'mb-4 xl:mb-6'} transition-all duration-300`}>
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 xl:w-12 xl:h-12 rounded-xl bg-red-600 flex items-center justify-center font-black text-sm xl:text-lg border border-red-400/30 shadow-inner">
                {user?.name?.[0] || 'U'}
              </div>
              {notificationsCount > 0 && !collapsed && (
                <div className="absolute -top-1 -right-1 w-4 h-4 xl:w-5 xl:h-5 bg-white text-red-600 rounded-full flex items-center justify-center text-[8px] xl:text-[10px] font-black shadow-lg">
                  {notificationsCount}
                </div>
              )}
            </div>
            <div className={`flex-1 overflow-hidden min-w-0 transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-full opacity-100'}`}>
              <p className="text-xs xl:text-sm font-bold truncate">{user?.name}</p>
              <p className="text-[9px] xl:text-[10px] text-red-500 font-black uppercase tracking-wider truncate">{user?.roles?.[0]}</p>
            </div>
          </div>
          <button 
            onClick={() => { onLogout(); setMobileMenuOpen(false); }}
            className={`w-full flex items-center justify-center gap-2 ${collapsed ? 'px-2 py-2' : 'px-3 xl:px-4 py-2 xl:py-3'} text-[10px] xl:text-xs font-bold text-slate-400 hover:text-white hover:bg-red-600 transition-all border border-white/10 rounded-xl`}
            title={collapsed ? "SIGN OUT" : ""}
          >
            <LogOut size={14} />
            {!collapsed && "SIGN OUT"}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-white">
        <header className="h-14 md:h-16 xl:h-20 bg-white border-b border-slate-200 flex items-center px-4 md:px-8 xl:px-12 justify-between gap-3">
          <div className="flex items-center gap-3">
            <button 
              className="md:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div className="flex items-center gap-2">
              <div className="md:hidden text-red-600">
                <TeamLogo className="w-7 h-7" />
              </div>
              <h2 className="text-sm md:text-lg xl:text-2xl font-black text-slate-900 tracking-tight uppercase">
                <span className="hidden sm:inline">PIO-BYTES </span>HUB
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {stats && (
              <div className="hidden md:flex items-center gap-2 text-[10px]">
                <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg border border-red-100">
                  <TrendingUp size={12} className="text-red-600" />
                  <span className="font-black text-red-600">{stats.weeklyEffort}</span>
                  <span className="text-red-400 font-bold">pts</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                  <Activity size={12} className="text-slate-600" />
                  <span className="font-black text-slate-800">{stats.activeCount}</span>
                  <span className="text-slate-400 font-bold">active</span>
                </div>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${stats.blockedCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                  <AlertTriangle size={12} className={stats.blockedCount > 0 ? 'text-amber-600' : 'text-slate-400'} />
                  <span className={`font-black ${stats.blockedCount > 0 ? 'text-amber-700' : 'text-slate-800'}`}>{stats.blockedCount}</span>
                  <span className={`font-bold ${stats.blockedCount > 0 ? 'text-amber-500' : 'text-slate-400'}`}>blocked</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
                  <Flag size={12} className="text-slate-600" />
                  <span className="font-black text-slate-800">{stats.projectCount}</span>
                  <span className="text-slate-400 font-bold">projects</span>
                </div>
              </div>
            )}
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100">
              <div className={`w-2 h-2 rounded-full ${isSynced ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-red-500'}`} />
              {isSynced ? <Cloud size={12} className="text-slate-300" /> : <CloudOff size={12} className="text-red-300" />}
            </div>
          </div>
        </header>
        <div className="flex-1 overflow-auto bg-slate-50/50">
          <div className="w-full h-full p-2 md:p-4 lg:p-6 xl:p-8 transition-all duration-300">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ to: string; icon: React.ReactNode; label: string; collapsed?: boolean; onClick?: () => void }> = ({ to, icon, label, collapsed, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    title={collapsed ? label : ""}
    className={({ isActive }) =>
      `flex items-center ${collapsed ? 'justify-center' : 'gap-3 xl:gap-4 px-3 xl:px-5'} py-3 xl:py-4 rounded-xl transition-all font-black text-[10px] xl:text-xs tracking-widest ${
        isActive 
          ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' 
          : 'text-slate-500 hover:text-white hover:bg-white/5'
      }`
    }
  >
    <div className="flex-shrink-0">{icon}</div>
    {!collapsed && <span>{label}</span>}
  </NavLink>
);

export default Layout;
