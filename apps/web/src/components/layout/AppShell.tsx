import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Home, MessageSquare, Zap, User, LogOut, Sparkles, LucideIcon } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import { DevDataSourceToggle } from '../ui/DevDataToggle';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface AppShellProps {
  onLogout: () => void;
}

interface NavLinkProps {
  to: string;
  icon: LucideIcon;
  active: boolean;
  label: string;
}

const TABS = ['/feed', '/home', '/activities'];

const AppShell: React.FC<AppShellProps> = ({ onLogout }) => {
  const { currentWorkout } = useApp();
  const { user } = useAuth(); // ✅ hook inside component

  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const isRootPath = ['/home'].includes(location.pathname);
  const showLivePill = currentWorkout && location.pathname !== '/activities/gym/active';

  useEffect(() => {
    let interval: any;
    if (currentWorkout) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentWorkout]);

  const formatShortTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentIndex = TABS.indexOf(location.pathname);

  const handleSwipe = (_: any, info: any) => {
    const threshold = 50;
    if (info.offset.x < -threshold && currentIndex < TABS.length - 1) {
      navigate(TABS[currentIndex + 1]);
    } else if (info.offset.x > threshold && currentIndex > 0) {
      navigate(TABS[currentIndex - 1]);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/home', { replace: true });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors overflow-x-hidden">
      {/* MAIN TOP BAR */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)] px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isRootPath ? (
            <button
              type="button"
              onClick={goBack}
              className="p-2 -ml-2 hover:bg-[var(--bg-card)] rounded-xl transition-colors"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center">
              <Sparkles className="text-white w-5 h-5" />
            </div>
          )}

          <span className="text-lg font-black tracking-tighter uppercase">Relay</span>
        </div>

        {showLivePill && (
          <Link
            to="/activities/gym/active"
            className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-blue-600 px-3 py-1 rounded-full animate-pulse shadow-lg shadow-blue-500/20"
          >
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
            <span className="text-[10px] font-black text-white uppercase tracking-tighter">
              LIVE SESSION {formatShortTime(elapsed)}
            </span>
          </Link>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <DevDataSourceToggle user={user} />
          <button
            type="button"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="p-2 hover:bg-[var(--bg-card)] rounded-xl transition-colors"
            aria-label="Profile"
          >
            <User size={20} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <motion.main
        key={location.pathname}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleSwipe}
        className="flex-1 w-full max-w-xl mx-auto touch-pan-y pt-16"
      >
        <Outlet /> {/* ✅ replaces children */}
      </motion.main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg)]/80 backdrop-blur-md border-t border-[var(--border)] h-20 pb-4 z-50 grid grid-cols-3 items-center">
        <div className="flex justify-center">
          <NavLink to="/feed" icon={MessageSquare} active={location.pathname === '/feed'} label="Feed" />
        </div>

        <div className="flex justify-center">
          <Link to="/home" className="relative -top-4">
            <div
              className={`p-4 rounded-[24px] shadow-lg transition-all ${
                location.pathname === '/home'
                  ? 'bg-[var(--primary)] text-white scale-110'
                  : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
              }`}
            >
              <Home size={28} strokeWidth={3} />
            </div>
          </Link>
        </div>

        <div className="flex justify-center">
          <NavLink
            to="/activities"
            icon={Zap}
            active={location.pathname.startsWith('/activities')}
            label="Activities Overview"
          />
        </div>
      </nav>

      {/* Logout Overlay */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-6 bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[var(--bg)] rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-full">
            <h3 className="text-xl font-black mb-6 text-center">Account</h3>
            <button
              type="button"
              onClick={onLogout}
              className="w-full py-4 bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3"
            >
              <LogOut size={20} /> LOG OUT
            </button>
            <button
              type="button"
              onClick={() => setShowProfileMenu(false)}
              className="w-full mt-4 py-4 font-bold text-[var(--text-muted)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const NavLink: React.FC<NavLinkProps> = ({ to, icon: Icon, active, label }) => (
  <Link
    to={to}
    className={`flex flex-col items-center gap-1 transition-all whitespace-nowrap ${
      active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'
    }`}
  >
    <Icon size={24} strokeWidth={active ? 3 : 2} className="transition-all" />
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Link>
);

export default AppShell;
