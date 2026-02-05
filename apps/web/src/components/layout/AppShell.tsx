import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, animate } from 'framer-motion';
import {
  ArrowLeft,
  Home,
  Rss,
  Activity,
  User,
  LogOut,
  Sparkles,
  LucideIcon,
  X,
  Settings,
  Hand,
  Dumbbell,
  History,
  Play,
  LayoutGrid,
  FolderKanban,
  BarChart3,
  UploadCloud,
  Footprints,
  TimerReset,
} from 'lucide-react';

import ThemeToggle from '../ui/ThemeToggle';
import { DevDataSourceToggle } from '../ui/DevDataToggle';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

interface AppShellProps {
  onLogout: () => void;
}

type HandMode = 'right' | 'left';

const TABS = ['/feed', '/home', '/activities'] as const;
type TabPath = (typeof TABS)[number];

function formatShortTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function isOnTab(pathname: string, tab: TabPath) {
  return pathname === tab || pathname.startsWith(`${tab}/`);
}

function getCurrentTabIndex(pathname: string) {
  return TABS.findIndex((t) => isOnTab(pathname, t));
}

function getCurrentTabRoot(pathname: string): TabPath | null {
  const idx = getCurrentTabIndex(pathname);
  return idx === -1 ? null : TABS[idx];
}

function isHorizontalScrollArea(el: Element | null) {
  let cur: Element | null = el;
  while (cur) {
    if ((cur as HTMLElement).dataset?.swipe === 'none') return true;

    const style = window.getComputedStyle(cur);
    const overflowX = style.overflowX;
    const canScrollX = overflowX === 'auto' || overflowX === 'scroll';
    const hasScrollableContent = (cur as HTMLElement).scrollWidth > (cur as HTMLElement).clientWidth + 2;

    if (canScrollX && hasScrollableContent) return true;
    cur = cur.parentElement;
  }
  return false;
}

function isInteractiveElement(el: Element | null) {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (['button', 'a', 'input', 'textarea', 'select', 'option', 'label'].includes(tag)) return true;
  if ((el as HTMLElement).getAttribute('role') === 'button') return true;
  if ((el as HTMLElement).closest?.('button,a,input,textarea,select,[role="button"]')) return true;
  return false;
}

function loadHandMode(): HandMode {
  try {
    const v = localStorage.getItem('relay.handMode');
    return v === 'left' || v === 'right' ? v : 'right';
  } catch {
    return 'right';
  }
}

function saveHandMode(v: HandMode) {
  try {
    localStorage.setItem('relay.handMode', v);
  } catch {
    // ignore
  }
}

/** ---- FLOWER TYPES ---- */

type FlowerLevel = 'modules' | 'gym';

type Petal = {
  key: string;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'default' | 'live' | 'soon';
};

type FlowerState =
  | { open: false }
  | {
      open: true;
      anchorRect: DOMRect;
      level: FlowerLevel;
      lastModuleTapKey: string | null;
      lastTapAt: number;
    };

const DOUBLE_TAP_WINDOW_MS = 650;

/** Fast + smooth motion defaults for this UI */
const FAST_SPRING = { type: 'spring', stiffness: 900, damping: 48, mass: 0.55 } as const;
const FAST_SPRING_SOFT = { type: 'spring', stiffness: 820, damping: 46, mass: 0.6 } as const;

const AppShell: React.FC<AppShellProps> = ({ onLogout }) => {
  const { currentWorkout } = useApp();
  const { user } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const [elapsed, setElapsed] = useState(0);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [handMode, setHandMode] = useState<HandMode>(() => loadHandMode());
  const [flower, setFlower] = useState<FlowerState>({ open: false });

  const sideRef = useRef<HTMLDivElement | null>(null);
  const openMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  const isHome = location.pathname === '/home';
  const isLiveRoute = location.pathname === '/activities/gym/active';
  const hasLive = !!currentWorkout && !isLiveRoute;

  const showLivePill = hasLive;
  const showLiveBadge = hasLive;

  const currentIndex = useMemo(() => getCurrentTabIndex(location.pathname), [location.pathname]);
  const swipeEnabled = currentIndex !== -1 && !showSideMenu && !flower.open;

  const x = useMotionValue(0);
  const allowSwipeRef = useRef(true);

  useEffect(() => {
    if (!currentWorkout) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [currentWorkout]);

  useEffect(() => {
    if (showSideMenu) setShowSideMenu(false);
    if (flower.open) setFlower({ open: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!showSideMenu) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSideMenu(false);
        openMenuBtnRef.current?.focus();
      }
    };

    const onMouseDown = (e: MouseEvent) => {
      const el = sideRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setShowSideMenu(false);
        openMenuBtnRef.current?.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [showSideMenu]);

  useEffect(() => {
    if (!flower.open) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFlower({ open: false });
    };
    const onMouseDown = () => setFlower({ open: false });

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('mousedown', onMouseDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, [flower.open]);

  const activeFeed = isOnTab(location.pathname, '/feed');
  const activeHome = isOnTab(location.pathname, '/home');
  const activeActivities = isOnTab(location.pathname, '/activities');

  // Smart back: tab-root first, then home (prevents loops)
  const goBackSmart = () => {
    const tabRoot = getCurrentTabRoot(location.pathname);

    if (tabRoot && location.pathname !== tabRoot) {
      navigate(tabRoot, { replace: true });
      return;
    }

    if (tabRoot && tabRoot !== '/home') {
      navigate('/home', { replace: true });
      return;
    }

    // Fallback: try history, but never trap; if history is tiny, go home
    if (window.history.length > 2) {
      navigate(-1);
      return;
    }

    navigate('/home', { replace: true });
  };

  const handleDragStart = (_: any, info: any) => {
    const target = info?.point ? (document.elementFromPoint(info.point.x, info.point.y) as Element | null) : null;
    allowSwipeRef.current = !(isInteractiveElement(target) || isHorizontalScrollArea(target));
  };

  const handleSwipeEnd = (_: any, info: any) => {
    if (!reduceMotion) animate(x, 0, FAST_SPRING);
    else x.set(0);

    if (!swipeEnabled) return;
    if (!allowSwipeRef.current) return;

    const absX = Math.abs(info.offset.x);
    const absY = Math.abs(info.offset.y);
    if (absY > absX) return;

    const offsetThreshold = 70;
    const velocityThreshold = 550;

    const leftSwipe = info.offset.x < -offsetThreshold || info.velocity.x < -velocityThreshold;
    const rightSwipe = info.offset.x > offsetThreshold || info.velocity.x > velocityThreshold;

    if (leftSwipe && currentIndex < TABS.length - 1) navigate(TABS[currentIndex + 1]);
    if (rightSwipe && currentIndex > 0) navigate(TABS[currentIndex - 1]);
  };

  const openMenu = () => setShowSideMenu(true);
  const closeMenu = () => {
    setShowSideMenu(false);
    openMenuBtnRef.current?.focus();
  };

  const toggleHandMode = () => {
    const next: HandMode = handMode === 'right' ? 'left' : 'right';
    setHandMode(next);
    saveHandMode(next);
  };

  const menuPanelSide = handMode === 'left' ? 'left-0 border-r' : 'right-0 border-l';
  const menuPanelExitX = handMode === 'left' ? -340 : 340;

  // Header: settings on chosen side, logo opposite
  const settingsOnLeft = handMode === 'left';
  const logoOnLeft = !settingsOnLeft;

  const openFlowerFrom = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setFlower({
      open: true,
      anchorRect: rect,
      level: 'modules',
      lastModuleTapKey: null,
      lastTapAt: 0,
    });
  };

  const flowerSetLevel = (level: FlowerLevel) => {
    if (!flower.open) return;
    setFlower({ ...flower, level });
  };

  const flowerNavigate = (to: string) => {
    setFlower({ open: false });
    navigate(to);
  };

  const handleModulePetalTap = (moduleKey: 'gym' | 'running') => {
    if (!flower.open) return;

    const now = Date.now();
    const isDouble = flower.lastModuleTapKey === moduleKey && now - flower.lastTapAt <= DOUBLE_TAP_WINDOW_MS;

    setFlower((prev) => {
      if (!prev.open) return prev;
      return { ...prev, lastModuleTapKey: moduleKey, lastTapAt: now };
    });

    if (moduleKey === 'gym') {
      if (flower.level === 'modules') {
        flowerSetLevel('gym');
        return;
      }
      // double-tap (or tap again while in gym level) goes to overview
      if (isDouble || flower.level === 'gym') {
        flowerNavigate('/activities/gym');
      }
      return;
    }

    // running dummy for now
    if (moduleKey === 'running') {
      return;
    }
  };

  /**
   * Petal slots are fixed for muscle memory:
   * 0 top, 1 top-left, 2 top-right, 3 left, 4 right, 5 bottom
   */
  const petals: Petal[] | null = useMemo(() => {
    if (!flower.open) return null;

    if (flower.level === 'modules') {
      return [
        // top
        { key: 'gym', label: 'Gym', icon: Dumbbell, onClick: () => handleModulePetalTap('gym') },
        // top-left
        { key: 'soon1', label: 'Soon', icon: TimerReset, onClick: () => {}, disabled: true, tone: 'soon' },
        // top-right
        { key: 'running', label: 'Running', icon: Footprints, onClick: () => handleModulePetalTap('running'), disabled: true, tone: 'soon' },
        // left
        { key: 'soon2', label: 'Soon', icon: FolderKanban, onClick: () => {}, disabled: true, tone: 'soon' },
        // right
        { key: 'soon3', label: 'Soon', icon: BarChart3, onClick: () => {}, disabled: true, tone: 'soon' },
        // bottom (quick close/resume)
        {
          key: 'close',
          label: hasLive ? 'Resume' : 'Close',
          icon: hasLive ? Play : X,
          onClick: () => {
            if (hasLive) flowerNavigate('/activities/gym/active');
            else setFlower({ open: false });
          },
          tone: hasLive ? 'live' : 'default',
        },
      ];
    }

    // ✅ GYM SUBMENU: ONLY the 4 sub-modules + (Gym overview) + (Back to modules)
    return [
      // top (Gym overview / double tap)
      { key: 'gym', label: 'Gym', icon: Dumbbell, onClick: () => handleModulePetalTap('gym') },

      // top-left
      { key: 'history', label: 'History', icon: History, onClick: () => flowerNavigate('/activities/gym/history') },

      // top-right
      { key: 'analytics', label: 'Analytics', icon: BarChart3, onClick: () => flowerNavigate('/activities/gym/analytics') },

      // left
      { key: 'templates', label: 'Templates', icon: FolderKanban, onClick: () => flowerNavigate('/activities/gym/templates') },

      // right
      { key: 'importexport', label: 'Import', icon: UploadCloud, onClick: () => flowerNavigate('/activities/gym/importexport') },

      // bottom: back to module selection (not start)
      { key: 'back', label: 'Modules', icon: LayoutGrid, onClick: () => flowerSetLevel('modules') },
    ];
  }, [flower, hasLive]);

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors overflow-x-hidden">
      {/* TOP BAR */}
      <header className="fixed top-0 left-0 right-0 z-[120] bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 sm:px-6 h-16">
        <div className="relative h-full max-w-xl mx-auto flex items-center">
          {/* LEFT SLOT */}
          <div className="flex items-center gap-2 min-w-[10rem]">
            {logoOnLeft && (
              <Link to="/home" className="w-10 flex items-center justify-center" aria-label="Home" title="Home">
                <div className="w-9 h-9 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
              </Link>
            )}

            {settingsOnLeft && (
              <button
                ref={openMenuBtnRef}
                type="button"
                onClick={openMenu}
                className="p-2 -ml-2 hover:bg-[var(--bg-card)] rounded-xl transition-colors"
                aria-haspopup="dialog"
                aria-expanded={showSideMenu}
                aria-label="Open menu"
              >
                <Settings size={20} />
              </button>
            )}

            {!isHome && (
              <button
                type="button"
                onClick={goBackSmart}
                className="p-2 hover:bg-[var(--bg-card)] rounded-xl transition-colors"
                aria-label="Back"
              >
                <ArrowLeft size={20} />
              </button>
            )}
          </div>

          {/* CENTER SLOT (LIVE PILL) */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <AnimatePresence>
              {showLivePill && (
                <motion.div
                  initial={reduceMotion ? false : { y: -6, opacity: 0 }}
                  animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
                  exit={reduceMotion ? undefined : { y: -6, opacity: 0 }}
                  transition={FAST_SPRING_SOFT}
                  className="pointer-events-none"
                >
                  <div className="pointer-events-auto max-w-[min(58vw,320px)]">
                    <Link
                      to="/activities/gym/active"
                      className="inline-flex items-center gap-2 bg-blue-600 px-3 py-1.5 rounded-full shadow-lg shadow-blue-500/20 border border-white/10 whitespace-nowrap"
                      aria-label="Go to live session"
                      title="Go to live session"
                    >
                      <motion.div
                        className="w-1.5 h-1.5 bg-white rounded-full"
                        animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter overflow-hidden text-ellipsis">
                        LIVE {formatShortTime(elapsed)}
                      </span>
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* RIGHT SLOT */}
          <div className="ml-auto flex items-center justify-end gap-2 min-w-[10rem]">
            {!logoOnLeft && (
              <Link to="/home" className="w-10 flex items-center justify-center" aria-label="Home" title="Home">
                <div className="w-9 h-9 bg-[var(--primary)] rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
                  <Sparkles className="text-white w-5 h-5" />
                </div>
              </Link>
            )}

            {!settingsOnLeft && (
              <button
                ref={openMenuBtnRef}
                type="button"
                onClick={openMenu}
                className="p-2 -mr-2 hover:bg-[var(--bg-card)] rounded-xl transition-colors"
                aria-haspopup="dialog"
                aria-expanded={showSideMenu}
                aria-label="Open menu"
              >
                <Settings size={20} />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* MAIN */}
      <motion.main
        key={location.pathname}
        drag={swipeEnabled ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragMomentum={false}
        style={{ x }}
        onDragStart={handleDragStart}
        onDragEnd={handleSwipeEnd}
        className="flex-1 w-full max-w-xl mx-auto touch-pan-y pt-16 pb-[calc(9.2rem+env(safe-area-inset-bottom))]"
      >
        <Outlet />
      </motion.main>

      {/* FLOWER (HIERARCHICAL) */}
      <AnimatePresence>
        {flower.open && petals && (
          <motion.div
            className="fixed inset-0 z-[240] select-none"
            style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
          >
            {/* blur should be instant; only opacity animates */}
            <motion.div
              className="absolute inset-0 bg-black/25 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
            />

            <RadialMenuHierarchical
              anchorRect={flower.anchorRect}
              level={flower.level}
              hasLive={hasLive}
              liveLabel={hasLive ? `Resume (${formatShortTime(elapsed)})` : undefined}
              onHubClick={() => {
                // If a module is selected: hub is BACK to module select
                if (flower.level !== 'modules') {
                  setFlower((prev) => (prev.open ? { ...prev, level: 'modules' } : prev));
                  return;
                }

                // No module selected: hub is quick resume if live, else close
                if (hasLive) {
                  setFlower({ open: false });
                  navigate('/activities/gym/active');
                  return;
                }

                setFlower({ open: false });
              }}

              petals={petals}
              onClose={() => setFlower({ open: false })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-[60]">
        <div className="max-w-xl mx-auto px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))]">
          <nav className="pointer-events-auto flex items-end justify-between gap-3" aria-label="Primary navigation">
            <NavButton label="Feed" sublabel="Coming soon" icon={Rss} active={activeFeed} disabled onPress={() => {}} />
            <HomeFab active={activeHome} onPress={() => navigate('/home')} />
            <NavButton
              label={showLiveBadge ? 'LIVE' : 'Activities'}
              icon={Activity}
              active={activeActivities}
              live={showLiveBadge}
              onPress={(el) => openFlowerFrom(el)}
            />
          </nav>
        </div>
      </div>

      {/* SIDE MENU */}
      <AnimatePresence>
        {showSideMenu && (
          <div className="fixed inset-0 z-[260]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
              className="absolute inset-0 bg-black/30 backdrop-blur-xl"
            />

            <motion.aside
              ref={sideRef}
              initial={reduceMotion ? false : { x: menuPanelExitX }}
              animate={reduceMotion ? undefined : { x: 0 }}
              exit={reduceMotion ? undefined : { x: menuPanelExitX }}
              transition={FAST_SPRING}
              className={`
                absolute top-0 h-full w-[320px] max-w-[88vw]
                bg-[var(--bg)]
                shadow-2xl
                p-5
                flex flex-col
                ${menuPanelSide}
                border-[var(--border)]
              `}
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 bg-[var(--primary)] rounded-2xl flex items-center justify-center shadow-lg shadow-black/10">
                      <Sparkles className="text-white w-5 h-5" />
                    </div>
                    <div className="mt-1 text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)]">Relay</div>
                  </div>

                  <div className="leading-tight pt-0.5">
                    <div className="text-sm font-black">Menu</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Settings & account</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeMenu}
                  className="p-2 rounded-xl hover:bg-[var(--bg-card)] transition-colors"
                  aria-label="Close menu"
                >
                  <X size={18} />
                </button>
              </div>

              <button
                type="button"
                className="mt-5 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/50 backdrop-blur-md p-4 flex items-center justify-between hover:bg-[var(--bg-card)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--bg)] border border-[var(--border)] flex items-center justify-center">
                    <User size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black">Profile</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Coming soon</div>
                  </div>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">→</span>
              </button>

              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]/40 backdrop-blur-md p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black">Theme</div>
                    <div className="text-[11px] text-[var(--text-muted)]">Light / Dark</div>
                  </div>
                  <ThemeToggle />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-black">Data Source</div>
                    <div className="text-[11px] text-[var(--text-muted)]">API / Local (dev)</div>
                  </div>
                  <DevDataSourceToggle user={user} />
                </div>

                <button
                  type="button"
                  onClick={toggleHandMode}
                  className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 hover:bg-[var(--bg)] transition-colors p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Hand size={18} />
                    <div className="text-left">
                      <div className="text-sm font-black">One-hand mode</div>
                      <div className="text-[11px] text-[var(--text-muted)]">Menu on {handMode === 'left' ? 'left' : 'right'} side</div>
                    </div>
                  </div>
                  <div className="text-[11px] font-black text-[var(--text-muted)]">{handMode.toUpperCase()}</div>
                </button>
              </div>

              <div className="flex-1" />

              <button
                type="button"
                onClick={onLogout}
                className="w-full py-4 bg-red-500 text-white rounded-2xl font-black flex items-center justify-center gap-3"
              >
                <LogOut size={20} /> LOG OUT
              </button>

              <button
                type="button"
                onClick={closeMenu}
                className="w-full mt-3 py-3 font-bold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Cancel
              </button>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

function RadialMenuHierarchical({
  anchorRect,
  level,
  hasLive,
  liveLabel,
  onHubClick,
  petals,
  onClose,
}: {
  anchorRect: DOMRect;
  level: FlowerLevel;
  hasLive: boolean;
  liveLabel?: string;
  onHubClick: () => void;
  petals: Petal[];
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const centerX = anchorRect.left + anchorRect.width / 2;
  const centerY = anchorRect.top + anchorRect.height / 2;

  const fx = Math.max(64, Math.min(vw - 64, centerX - 25));
  const fy = Math.max(100, Math.min(vh, centerY - 125));

  //Radial Pedals
  const slots = [
    { dx: -100, dy:   0 },   // left
  { dx:  -92, dy: -38 },   // 22.5°
  { dx:  -71, dy: -71 },   // 45°
  { dx:  -38, dy: -92 },   // 67.5°
  { dx:    0, dy: -100 },  // top
  ];

  /*
  //6 Slots
  const slots = [
    { dx: -100, dy:   0 },   // 0°
    { dx:  -95, dy: -31 },   // 18°
    { dx:  -81, dy: -59 },   // 36°
    { dx:  -59, dy: -81 },   // 54°
    { dx:  -31, dy: -95 },   // 72°
    { dx:    0, dy: -100 },  // 90°
  ];

  */

  const hubIsBack = level !== 'modules'; // if module selected, hub is back
  const hubIcon = hubIsBack ? LayoutGrid : hasLive ? Play : X;
  const hubLabel = hubIsBack ? 'Back' : hasLive ? (liveLabel ?? 'Resume') : 'Close';


  return (
    <div
      className="absolute inset-0"
      onMouseDown={onClose}
      onTouchStart={onClose}
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
    >
      <motion.div
        className="absolute will-change-transform"
        style={{ left: fx, top: fy }}
        initial={reduceMotion ? false : { scale: 0.96, opacity: 0 }}
        animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
        exit={reduceMotion ? undefined : { scale: 0.96, opacity: 0 }}
        transition={FAST_SPRING_SOFT}
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {/* HUB */}
        <motion.button
          type="button"
          onClick={onHubClick}
          className="absolute -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-[24px] border border-[var(--border)] bg-[var(--bg)]/84 backdrop-blur-2xl shadow-2xl flex items-center justify-center will-change-transform"
          aria-label={hubLabel}
          title={hubLabel}
          style={{ left: 0, top: 0 }}
          initial={reduceMotion ? false : { scale: 0.9, opacity: 0 }}
          animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
          exit={reduceMotion ? undefined : { scale: 0.9, opacity: 0 }}
          transition={FAST_SPRING}
        >
          {hasLive && !reduceMotion && (
            <motion.div
              className="absolute -inset-1 rounded-[24px] border border-blue-400/45"
              animate={{ opacity: [0.25, 0.7, 0.25], scale: [1, 1.045, 1] }}
              transition={{ duration: 1.15, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
          {React.createElement(hubIcon, {
            size: 22,
            className: hasLive ? 'text-blue-200 drop-shadow-[0_0_14px_rgba(59,130,246,0.7)]' : 'text-[var(--text)]',
          })}
        </motion.button>

        {/* PETALS */}
        {slots.map((pos, idx) => {
          const it = petals[idx];
          if (!it) return null;

          const disabled = !!it.disabled;
          const isLiveTone = it.tone === 'live';
          const isSoonTone = it.tone === 'soon';

          return (
            <motion.button
              key={it.key}
              type="button"
              aria-label={it.label}
              title={it.label}
              className={`
                absolute -translate-x-1/2 -translate-y-1/2
                h-14 w-14 rounded-[22px]
                border border-[var(--border)]
                bg-[var(--bg)]/86 backdrop-blur-2xl
                shadow-[0_18px_55px_rgba(0,0,0,0.38)]
                transition-colors
                will-change-transform
                ${disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-[var(--bg-card)]'}
              `}
              style={{ left: pos.dx, top: pos.dy }}
              initial={reduceMotion ? false : { x: pos.dx * 0.55, y: pos.dy * 0.55, opacity: 0, scale: 0.75 }}
              animate={reduceMotion ? undefined : { x: pos.dx, y: pos.dy, opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      stiffness: 980,
                      damping: 50,
                      mass: 0.5,
                      delay: idx * 0.015,
                    }
              }
              onClick={() => {
                if (disabled) return;
                it.onClick();
              }}
            >
              {isLiveTone && !reduceMotion && (
                <motion.div
                  className="absolute -inset-1 rounded-[22px] border border-blue-400/40"
                  animate={{ opacity: [0.2, 0.65, 0.2], scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}

              <div className="relative h-full w-full flex flex-col items-center justify-center leading-none">
                <it.icon
                  size={20}
                  className={
                    isLiveTone
                      ? 'text-blue-200 drop-shadow-[0_0_14px_rgba(59,130,246,0.7)]'
                      : isSoonTone
                        ? 'text-[var(--text-muted)]'
                        : 'text-[var(--text)]'
                  }
                />
                <div className="mt-1 text-[8px] font-black uppercase tracking-tighter text-[var(--text-muted)]">
                  {it.label}
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}

/** Home FAB */
const HomeFab: React.FC<{ active: boolean; onPress: () => void }> = ({ active, onPress }) => {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label="Home"
      className="relative -translate-y-3 pointer-events-auto select-none"
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
    >
      <div className={`absolute inset-0 rounded-[30px] blur-2xl bg-[var(--primary)] ${active ? 'opacity-45' : 'opacity-25'}`} />
      <div
        className={`
          relative h-[76px] w-[76px]
          rounded-[30px]
          border border-[var(--border)]
          shadow-[0_22px_60px_rgba(0,0,0,0.45)]
          backdrop-blur-2xl
          transition-all
          ${active ? 'bg-[var(--primary)] text-white scale-[1.06]' : 'bg-[var(--bg)]/70 text-[var(--text-muted)]'}
        `}
      >
        <div className="h-full w-full flex items-center justify-center">
          <Home size={30} strokeWidth={3} />
        </div>

        {!reduceMotion && active && (
          <motion.div
            className="absolute inset-0 rounded-[30px] border border-white/10"
            animate={{ opacity: [0.3, 0.7, 0.3] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}
      </div>
    </button>
  );
};

/** Standard nav button */
const NavButton: React.FC<{
  label: string;
  sublabel?: string;
  icon: LucideIcon;
  active: boolean;
  disabled?: boolean;
  live?: boolean;
  onPress: (el: HTMLElement) => void;
}> = ({ label, sublabel, icon: Icon, active, disabled, live, onPress }) => {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled && ref.current) onPress(ref.current);
      }}
      className="relative flex-1 flex justify-center -translate-y-1 pointer-events-auto disabled:opacity-70 disabled:cursor-not-allowed select-none"
      aria-label={label}
      title={disabled ? `${label} (coming soon)` : label}
      style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
    >
      <div className="relative">
        {live && !reduceMotion && (
          <motion.div
            className="absolute -inset-2 rounded-[30px] border border-blue-400/35"
            initial={false}
            animate={{ opacity: [0.22, 0.7, 0.22], scale: [1, 1.06, 1] }}
            transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
          />
        )}

        <div
          className={`
            relative
            h-[66px] min-w-[116px] px-4
            rounded-[28px]
            border border-[var(--border)]
            backdrop-blur-2xl
            shadow-[0_18px_55px_rgba(0,0,0,0.32)]
            transition-all
            overflow-hidden
            ${active ? '-translate-y-1 scale-[1.05] bg-[var(--bg)]/88' : 'bg-[var(--bg)]/62'}
          `}
        >
          {active && <div className="absolute -inset-10 bg-[var(--primary)] opacity-20 blur-3xl" />}

          {live && !reduceMotion && (
            <motion.div
              className="absolute -left-14 top-0 h-full w-28 bg-blue-500/18 blur-xl rotate-12"
              animate={{ x: [0, 260] }}
              transition={{ duration: 1.45, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}

          <div className="relative h-full flex flex-col items-center justify-center leading-none">
            <div className="relative">
              <Icon
                size={24}
                strokeWidth={active ? 3 : 2}
                className={
                  live
                    ? 'text-blue-200 drop-shadow-[0_0_14px_rgba(59,130,246,0.6)]'
                    : active
                      ? 'text-[var(--primary)]'
                      : 'text-[var(--text-muted)]'
                }
              />
              {live && <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.85)]" />}
            </div>

            <div className="mt-1 text-[10px] font-black uppercase tracking-tighter whitespace-nowrap">
              <span className={live ? 'text-blue-100' : active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}>
                {label}
              </span>
            </div>

            {sublabel && (
              <div className="mt-1 text-[9px] font-black uppercase tracking-tighter text-[var(--text-muted)] opacity-80">
                {sublabel}
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default AppShell;
