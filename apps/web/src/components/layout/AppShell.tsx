
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, MessageSquare, Zap, User, LogOut, Sparkles, LucideIcon, Activity } from 'lucide-react';
import ThemeToggle from '../ui/ThemeToggle';
import { useApp } from '../../context/AppContext'; //Activity Status

interface AppShellProps {
  children: React.ReactNode;
  onLogout: () => void;
}

interface NavLinkProps {
  to: string;
  icon: LucideIcon; // Pass the component reference, not the <Element />
  active: boolean;
  label: string;
}

// Define the order of our main tabs for index tracking
const TABS = ['/feed', '/home', '/activities'];

const AppShell: React.FC<AppShellProps> = ({ children, onLogout }) => {
  const { currentWorkout } = useApp(); //get Current Workout
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  //Simple timer logic for the Nav Bar
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

  // Swipe Logic
  const currentIndex = TABS.indexOf(location.pathname);

  const handleSwipe = (_: any, info: any) => {
    const threshold = 50; // pixels
    if (info.offset.x < -threshold && currentIndex < TABS.length - 1) {
      // Swipe Left -> Go Right (Activities)
      navigate(TABS[currentIndex + 1]);
    } else if (info.offset.x > threshold && currentIndex > 0) {
      // Swipe Right -> Go Left (Feed)
      navigate(TABS[currentIndex - 1]);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors overflow-x-hidden">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)] px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[var(--primary)] rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <span className="text-lg font-black tracking-tighter uppercase">Relay</span>
        </div>

        {/*ACTIVE STATUS INDICATOR */}
        {currentWorkout && (
          <Link 
            to="/activities/gym" 
            className="flex items-center gap-2 bg-blue-50 border border-blue-100 px-3 py-1.5 rounded-full animate-pulse shadow-sm shadow-blue-200"
          >
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-tighter">
              LIVE: {formatShortTime(elapsed)}
            </span>
          </Link>
        )}

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="p-2 hover:bg-[var(--bg-card)] rounded-xl transition-colors"
          >
            <User size={20} />
          </button>
        </div>
      </header>

      {/* Main Content with Swipe Gestures */}
      <motion.main 
        key={location.pathname}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={handleSwipe}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -10 }}
        className="flex-1 w-full max-w-xl mx-auto p-6 touch-pan-y"
      >
        {children}
      </motion.main>

      {/* Bottom Nav: Feed | Home (Middle) | Activities */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--bg)]/80 backdrop-blur-md border-t border-[var(--border)] h-20 pb-4 z-50 grid grid-cols-3 items-center">
        
        {/* Left Side */}
        <div className="flex justify-center">
          <NavLink 
            to="/feed" 
            icon={MessageSquare} 
            active={location.pathname === '/feed'} 
            label="Feed"
          />
        </div>
        
        {/* Middle Home Button */}
        <div className="flex justify-center">
          <Link to="/home" className="relative -top-4">
            <div className={`p-4 rounded-[24px] shadow-lg transition-all ${
              location.pathname === '/home' 
              ? 'bg-[var(--primary)] text-white scale-110' 
              : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
            }`}>
              <Home size={28} strokeWidth={3} />
            </div>
          </Link>
        </div>

        {/* Right Side */}
        <div className="flex justify-center">
          <NavLink 
            to="/activities" 
            icon={Zap} 
            active={location.pathname.startsWith('/activities')} 
            label="Activities Overview"
          />
        </div>
      </nav>

      {/* Logout Overlay (Simplified) */}
      {showProfileMenu && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-6 bg-black/20 backdrop-blur-sm">
           <div className="w-full max-w-sm bg-[var(--bg)] rounded-[32px] p-8 shadow-2xl animate-in slide-in-from-bottom-full">
              <h3 className="text-xl font-black mb-6 text-center">Account</h3>
              <button 
                onClick={onLogout}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3"
              >
                <LogOut size={20} /> LOG OUT
              </button>
              <button 
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
    {/* Render it as a component directly */}
    <Icon 
      size={24} 
      strokeWidth={active ? 3 : 2} 
      className="transition-all"
    />
    <span className="text-[10px] font-black uppercase tracking-tighter">{label}</span>
  </Link>
);

export default AppShell;