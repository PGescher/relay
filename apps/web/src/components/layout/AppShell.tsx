import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AnimatePresence, motion, useMotionValue, useReducedMotion, animate } from 'framer-motion';
import {
  ArrowLeft,
  Activity,
  Home,
  Rss,
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
import type { NavDock } from '../../context/AppContext';

import { ActiveSessionOverlay } from '../layout/ActiveSessionOverlay';

interface AppShellProps {
  onLogout: () => void;
}

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

type MainButton = {
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

const FAST_SPRING = { type: 'spring', stiffness: 900, damping: 48, mass: 0.55 } as const;
const FAST_SPRING_SOFT = { type: 'spring', stiffness: 820, damping: 46, mass: 0.6 } as const;

const MINIMIZE_EVENT = 'relay:overlay:minimize';

function requestOverlayMinimize() {
  window.dispatchEvent(new CustomEvent(MINIMIZE_EVENT));
}


const AppShell: React.FC<AppShellProps> = ({ onLogout }) => {
  const {
    activeSession,
    activeOverlay,
    handMode,
    toggleHandMode,
    navDock,
    setNavDock,
    derivedNavDock,
    requestOverlayExpand, // <-- ADD (muss es im Context geben)
  } = useApp() as any;

  const { user } = useAuth();

  const location = useLocation();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const navigateWithOverlayMinimize = (to: any, opts?: any) => {
    requestOverlayMinimize();
    navigate(to, opts);
  };


  const [elapsed, setElapsed] = useState(0);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [flower, setFlower] = useState<FlowerState>({ open: false });

  const sideRef = useRef<HTMLDivElement | null>(null);
  const openMenuBtnRef = useRef<HTMLButtonElement | null>(null);

  const isHome = location.pathname === '/home';
  // Keep this route check permissive & module-agnostic.
  const isLiveRoute = location.pathname.endsWith('/active');
  const hasLive = !!activeSession && activeSession.lifecycle === 'ACTIVE' && !isLiveRoute;

  const showLivePill = hasLive;
  const showLiveBadge = hasLive;

  const currentIndex = useMemo(() => getCurrentTabIndex(location.pathname), [location.pathname]);

  // overlay state from AppContext session is handled inside ActiveSessionOverlay,
  // but we can infer "expanded overlay" to disable swipe gestures and fade base.
  const overlayExpanded = activeOverlay?.mode === 'expanded';

  const swipeEnabled = currentIndex !== -1 && !showSideMenu && !flower.open && !overlayExpanded;

  const x = useMotionValue(0);
  const allowSwipeRef = useRef(true);

  // workout timer (for live pill)
  useEffect(() => {
    if (!activeSession || activeSession.lifecycle !== 'ACTIVE') {
      setElapsed(0);
      return;
    }
    const startedAt = activeSession.meta?.startedAt ?? Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [activeSession?.id, activeSession?.lifecycle, activeSession?.meta?.startedAt]);


  // close overlays on route change
  useEffect(() => {
    if (showSideMenu) setShowSideMenu(false);
    if (flower.open) setFlower({ open: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // side menu escape / outside click + body lock
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

  // flower escape / outside click
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

  // Smart back: tab-root first, then home (prevents loops)
  const goBackSmart = () => {
    const tabRoot = getCurrentTabRoot(location.pathname);

    if (tabRoot && location.pathname !== tabRoot) {
      navigateWithOverlayMinimize(tabRoot, { replace: true });

      return;
    }

    if (tabRoot && tabRoot !== '/home') {
     navigateWithOverlayMinimize('/home', { replace: true });
      return;
    }

    if (window.history.length > 2) {
      navigateWithOverlayMinimize(-1);
      return;
    }

    navigateWithOverlayMinimize('/home', { replace: true });
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

    if (leftSwipe && currentIndex < TABS.length - 1) navigateWithOverlayMinimize(TABS[currentIndex + 1]);
    if (rightSwipe && currentIndex > 0) navigateWithOverlayMinimize(TABS[currentIndex - 1]);

  };

  const openMenu = () => setShowSideMenu(true);
  const closeMenu = () => {
    setShowSideMenu(false);
    openMenuBtnRef.current?.focus();
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

  const flowerNavigate = (to: string) => {
    setFlower({ open: false });
    navigateWithOverlayMinimize(to);
  };

  const resumeWorkoutOverlay = () => {
    // Flower schließen und Overlay maximieren
    setFlower({ open: false });
    requestOverlayExpand?.();
  };


  const handleModulePetalTap = (moduleKey: 'gym' | 'running') => {
    setFlower((prev) => {
      if (!prev.open) return prev;

      const now = Date.now();
      const isDouble = prev.lastModuleTapKey === moduleKey && now - prev.lastTapAt <= DOUBLE_TAP_WINDOW_MS;

      const next = { ...prev, lastModuleTapKey: moduleKey, lastTapAt: now };

      if (moduleKey === 'gym') {
        if (prev.level === 'modules') return { ...next, level: 'gym' };

        if (isDouble || prev.level === 'gym') {
          queueMicrotask(() => {
            setFlower({ open: false });
            navigateWithOverlayMinimize('/activities/gym');
          });
        }
        return next;
      }

      return next;
    });
  };

  const petals: Petal[] | null = useMemo(() => {
    if (!flower.open) return null;

    if (flower.level === 'modules') {
      return [
        { key: 'gym', label: 'Gym', icon: Dumbbell, onClick: () => handleModulePetalTap('gym') },
        { key: 'soon1', label: 'Soon', icon: TimerReset, onClick: () => {}, disabled: true, tone: 'soon' },
        {
          key: 'close',
          label: hasLive ? 'Resume' : 'Close',
          icon: hasLive ? Play : X,
          onClick: () => {
            if (!hasLive) {
              setFlower({ open: false });
              return;
            }
            resumeWorkoutOverlay();
          },
          tone: hasLive ? 'live' : 'default',
        },
        {
          key: 'running',
          label: 'Running',
          icon: Footprints,
          onClick: () => handleModulePetalTap('running'),
          disabled: true,
          tone: 'soon',
        },
        { key: 'soon2', label: 'Soon', icon: FolderKanban, onClick: () => {}, disabled: true, tone: 'soon' },
      ];
    }

    return [
      { key: 'gym', label: 'Gym', icon: Dumbbell, onClick: () => handleModulePetalTap('gym') },
      { key: 'history', label: 'History', icon: History, onClick: () => flowerNavigate('/activities/gym/history') },
      { key: 'templates', label: 'Templates', icon: FolderKanban, onClick: () => flowerNavigate('/activities/gym/templates') },
      { key: 'analytics', label: 'Analytics', icon: BarChart3, onClick: () => flowerNavigate('/activities/gym/analytics') },
      { key: 'importexport', label: 'Import', icon: UploadCloud, onClick: () => flowerNavigate('/activities/gym/importexport') },
    ];
  }, [flower.open, (flower as any).level, hasLive]);

  const mainButtons: MainButton[] = useMemo(
    () => [
      { key: 'home', label: 'Home', icon: Home, onClick: () => flowerNavigate('/home') },
      { key: 'feed', label: 'Feed', icon: Rss, onClick: () => {}, disabled: true, tone: 'soon' },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <div className="flex flex-col min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors overflow-x-hidden">
      {/* TOP BAR */}
      <header
        className={["fixed top-0 left-0 right-0 z-[120] bg-[var(--bg)]/80 backdrop-blur-md border-b border-[var(--border)] px-4 sm:px-6 h-16 transition-opacity", overlayExpanded ? "opacity-0 pointer-events-none" : ""].join(" ")}
      >
        <div className="relative h-full max-w-xl mx-auto flex items-center">
          {/* LEFT SLOT */}
          <div className="flex items-center gap-2 min-w-[10rem]">
            {logoOnLeft && (
              <Link to="/home" onClick={requestOverlayMinimize} className="w-10 flex items-center justify-center" aria-label="Home" title="Home">
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
                    <button
                      type="button"
                      onClick={() => requestOverlayExpand?.()}
                      className="inline-flex items-center gap-2 bg-blue-600 px-3 py-1.5 rounded-full shadow-lg shadow-blue-500/20 border border-white/10 whitespace-nowrap"
                      aria-label="Resume live session"
                      title="Resume live session"
                    >
                      
                      <motion.div
                        className="w-1.5 h-1.5 bg-white rounded-full"
                        animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
                      />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter overflow-hidden text-ellipsis">
                        LIVE {formatShortTime(elapsed)}
                      </span>
                    </button>
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

      {/* MAIN (fades + disables interaction while overlay expanded) */}
      <motion.main
        key={location.pathname}
        drag={swipeEnabled ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragMomentum={false}
        style={{ x }}
        onDragStart={handleDragStart}
        onDragEnd={handleSwipeEnd}
        className={[
          'flex-1 w-full max-w-xl mx-auto touch-pan-y pt-16 pb-[calc(6.2rem+env(safe-area-inset-bottom))]',
          overlayExpanded ? 'opacity-35 pointer-events-none select-none' : '',
        ].join(' ')}
      >
        <Outlet />
      </motion.main>

      {/* ACTIVE SESSION OVERLAY (expanded/minimized + pill + swipe minimize) */}
      <ActiveSessionOverlay />

      {/* FLOWER (kept) */}
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
            <motion.div
              className="absolute inset-0 bg-black/25 backdrop-blur-xl"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.12, ease: 'easeOut' }}
            />

            <RadialMenuHierarchical
              anchorRect={flower.anchorRect}
              dock={derivedNavDock}
              level={flower.level}
              hasLive={hasLive}
              liveLabel={hasLive ? `Resume (${formatShortTime(elapsed)})` : undefined}
              onHubClick={() => {
                setFlower((prev) => {
                  if (!prev.open) return prev;
                  if (prev.level !== 'modules') return { ...prev, level: 'modules' };
                  if (hasLive) queueMicrotask(() => requestOverlayExpand?.());
                  return { open: false };

                });
              }}
              mainButtons={mainButtons}
              petals={petals}
              onClose={() => setFlower({ open: false })}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SINGLE HUB NAV */}
      <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-[260]">
        <div className="max-w-xl mx-auto px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] relative">
          <HubButton
            dock={derivedNavDock}
            live={showLiveBadge}
            hasLive={hasLive}
            onPress={(el) => openFlowerFrom(el)}
            onDoubleAction={() => {
              if (hasLive && activeSession) {
                const modulePath = String(activeSession.module).toLowerCase();
                navigateWithOverlayMinimize(`/activities/${modulePath}/active`);
              } else navigateWithOverlayMinimize('/home');
            }}
          />
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
                    <div className="mt-1 text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)]">
                      Relay
                    </div>
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
                      <div className="text-[11px] text-[var(--text-muted)]">
                        Menu on {handMode === 'left' ? 'left' : 'right'} side
                      </div>
                    </div>
                  </div>
                  <div className="text-[11px] font-black text-[var(--text-muted)]">{handMode.toUpperCase()}</div>
                </button>

                <div className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg)]/70 p-4">
                  <div className="flex items-center gap-3">
                    <Activity size={18} />
                    <div className="text-left">
                      <div className="text-sm font-black">Main nav dock</div>
                      <div className="text-[11px] text-[var(--text-muted)]">
                        {navDock === 'center'
                          ? 'Centered'
                          : `Side dock (mirrors: ${handMode === 'left' ? 'left' : 'right'})`}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNavDock('left');
                        if (handMode !== 'left') toggleHandMode();
                      }}
                      className={`
                        rounded-2xl border border-[var(--border)]
                        px-3 py-2 text-[11px] font-black uppercase tracking-tighter transition-colors
                        ${
                          navDock !== 'center' && handMode === 'left'
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--bg)] hover:bg-[var(--bg-card)]'
                        }
                      `}
                    >
                      Left
                    </button>

                    <button
                      type="button"
                      onClick={() => setNavDock('center')}
                      className={`
                        rounded-2xl border border-[var(--border)]
                        px-3 py-2 text-[11px] font-black uppercase tracking-tighter transition-colors
                        ${navDock === 'center' ? 'bg-[var(--primary)] text-white' : 'bg-[var(--bg)] hover:bg-[var(--bg-card)]'}
                      `}
                    >
                      Center
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNavDock('right');
                        if (handMode !== 'right') toggleHandMode();
                      }}
                      className={`
                        rounded-2xl border border-[var(--border)]
                        px-3 py-2 text-[11px] font-black uppercase tracking-tighter transition-colors
                        ${
                          navDock !== 'center' && handMode === 'right'
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--bg)] hover:bg-[var(--bg-card)]'
                        }
                      `}
                    >
                      Right
                    </button>
                  </div>

                  <div className="mt-2 text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)] opacity-80">
                    Tip: toggling One-hand mode mirrors dock when not centered.
                  </div>
                </div>
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

type Slot = { dx: number; dy: number };

const polar = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return {
    dx: Math.round(Math.cos(rad) * r),
    dy: Math.round(Math.sin(rad) * r),
  };
};

function makeSmallArcSlots(dock: NavDock): Slot[] {
  const r = 120;

  if (dock === 'left') {
    const r = 150;
    const angles = [-5, -30, -55, -80, -105];
    return angles.map((a) => polar(a, r));
  }

  if (dock === 'right') {
    const r = 150;
    const angles = [-200, -170, -140, -110, -80];
    return angles.map((a) => polar(a, r));
  }
  // center dock: force perfect symmetry around dx=0
  // (no rounding drift / avg-shift artifacts)
  const NUDGE_X = 3; // -2 oder -3 wenn du es minimal nach links willst
  const angles = [-160, -125, -90, -55, -20];
  return angles.map((a) => {
    const s = polar(a, r + 6);
    return { ...s, dx: s.dx + NUDGE_X };
  });
}

function makeMainSlots(dock: NavDock): Slot[] {
  const polar2 = (deg: number, r: number) => {
    const rad = (deg * Math.PI) / 180;
    return { dx: Math.round(Math.cos(rad) * r), dy: Math.round(Math.sin(rad) * r) };
  };

  if (dock === 'left') {
    const r = 50;
    const angles = [370, 320, -105];
    return angles.map((a) => polar2(a, r));
  }

  if (dock === 'right') {
    const r = 80;
    const angles = [-200, -140, -75];
    return angles.map((a) => polar2(a, r));
  }

  const r = 75;
  const angles = [-200, 20, -90];
  const NUDGE_X = 0; // -2 oder -3 wenn du es minimal nach links willst
  return angles.map((a) => {
    const s = polar(a, r + 6);
    return { ...s, dx: s.dx + NUDGE_X };
  });
}

function RadialMenuHierarchical({
  anchorRect,
  dock,
  level,
  hasLive,
  liveLabel,
  onHubClick,
  mainButtons,
  petals,
  onClose,
}: {
  anchorRect: DOMRect;
  dock: NavDock;
  level: FlowerLevel;
  hasLive: boolean;
  liveLabel?: string;
  onHubClick: () => void;
  mainButtons: MainButton[];
  petals: Petal[];
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  const anchorX = anchorRect.left + anchorRect.width / 2;
  const anchorY = anchorRect.top + anchorRect.height / 2;

  const SMALL_R = 92;
  const MAIN_R = 55;
  const HUB_HALF = 36;
  const BTN_HALF = 33;
  const PETAL_HALF = 28;

  const CLUSTER_R = Math.max(SMALL_R + PETAL_HALF, MAIN_R + BTN_HALF, HUB_HALF) + 12;

  const fx = Math.max(CLUSTER_R, Math.min(vw - CLUSTER_R, anchorX - BTN_HALF));
  const fy = Math.max(110, Math.min(vh - 120, anchorY - 125));

  const mainSlots = makeMainSlots(dock);
  const smallSlots = makeSmallArcSlots(dock);

  const hubIsBack = level !== 'modules';
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

        {/* MAIN */}
        {mainSlots.map((pos, idx) => {
          const it = mainButtons[idx];
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
                h-[66px] w-[66px] rounded-[26px]
                border border-[var(--border)]
                bg-[var(--bg)]/90 backdrop-blur-2xl
                shadow-[0_22px_65px_rgba(0,0,0,0.44)]
                transition-colors
                will-change-transform
                ${disabled ? 'opacity-45 cursor-not-allowed' : 'hover:bg-[var(--bg-card)]'}
              `}
              style={{ left: 0, top: 0 }}
              initial={reduceMotion ? false : { x: 0, y: 0, opacity: 0, scale: 0.78 }}
              animate={reduceMotion ? undefined : { x: pos.dx, y: pos.dy, opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 980, damping: 50, mass: 0.52, delay: 0.02 + idx * 0.02 }
              }
              onClick={() => {
                if (disabled) return;
                it.onClick();
              }}
            >
              {isLiveTone && !reduceMotion && (
                <motion.div
                  className="absolute -inset-1 rounded-[26px] border border-blue-400/40"
                  animate={{ opacity: [0.2, 0.65, 0.2], scale: [1, 1.04, 1] }}
                  transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
                />
              )}
              <div className="relative h-full w-full flex flex-col items-center justify-center leading-none">
                <it.icon
                  size={22}
                  className={
                    isLiveTone
                      ? 'text-blue-200 drop-shadow-[0_0_14px_rgba(59,130,246,0.7)]'
                      : isSoonTone
                        ? 'text-[var(--text-muted)]'
                        : 'text-[var(--text)]'
                  }
                />
                <div className="mt-1 text-[9px] font-black uppercase tracking-tighter text-[var(--text-muted)]">{it.label}</div>
              </div>
            </motion.button>
          );
        })}

        {/* SMALL */}
        {smallSlots.map((pos, idx) => {
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
              style={{ left: 0, top: 0 }}
              initial={reduceMotion ? false : { x: 0, y: 0, opacity: 0, scale: 0.75 }}
              animate={reduceMotion ? undefined : { x: pos.dx, y: pos.dy, opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 980, damping: 50, mass: 0.5, delay: 0.08 + idx * 0.015 }
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

const HubButton: React.FC<{
  dock: NavDock;
  live: boolean;
  hasLive: boolean;
  onPress: (el: HTMLElement) => void;
  onDoubleAction: () => void;
}> = ({ dock, live, hasLive, onPress, onDoubleAction }) => {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLButtonElement | null>(null);
  const hubVisualRef = useRef<HTMLDivElement | null>(null);

  const EDGE_INSET_PX = 20;
  const justifyClass = dock === 'left' ? 'justify-start' : dock === 'right' ? 'justify-end' : 'justify-center';

  return (
    <div
      className={`pointer-events-auto absolute bottom-0 left-0 right-0 flex ${justifyClass}`}
      style={{
        paddingLeft: `calc(env(safe-area-inset-left) + ${EDGE_INSET_PX}px)`,
        paddingRight: `calc(env(safe-area-inset-right) + ${EDGE_INSET_PX}px)`,
      }}
    >
      <button
        ref={ref}
        type="button"
        onClick={() => {
          const el = hubVisualRef.current ?? ref.current;
          if (el) onPress(el as any);
        }}
        onDoubleClick={onDoubleAction}
        className="relative select-none"
        style={{ WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
        aria-label="Open navigation"
        title={hasLive ? 'Open (double tap = resume)' : 'Open (double tap = home)'}
      >
        <div className={`absolute inset-0 rounded-[30px] blur-2xl bg-[var(--primary)] ${live ? 'opacity-35' : 'opacity-20'}`} />
        <div
          ref={hubVisualRef}
          className="
            relative h-[72px] w-[72px]
            rounded-[30px]
            border border-[var(--border)]
            bg-[var(--bg)]/72 backdrop-blur-2xl
            shadow-[0_22px_60px_rgba(0,0,0,0.45)]
            flex items-center justify-center
          "
        >
          <Activity size={30} strokeWidth={3} className={live ? 'text-blue-200' : 'text-[var(--text)]'} />
          {live && (
            <div className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-blue-400 shadow-[0_0_16px_rgba(59,130,246,0.85)]" />
          )}

          {live && !reduceMotion && (
            <motion.div
              className="absolute -inset-1 rounded-[30px] border border-blue-400/35"
              animate={{ opacity: [0.22, 0.7, 0.22], scale: [1, 1.05, 1] }}
              transition={{ duration: 1.25, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </div>

        <div className="mt-2 text-center text-[10px] font-black uppercase tracking-tighter text-[var(--text-muted)]">
          {live ? 'LIVE' : 'Menu'}
        </div>
      </button>
    </div>
  );
};

export default AppShell;
