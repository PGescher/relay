import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Maximize2, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

import { useApp } from '../../context/AppContext';

// ✅ Registry
import { getModuleAdapter } from '../../session/moduleRegistry';

const FAST = { type: 'spring', stiffness: 900, damping: 52, mass: 0.6 } as const;
const MINIMIZE_EVENT = 'relay:overlay:minimize';

export const ActiveSessionOverlay: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const app = useApp() as any;

  const {
    activeSession,
    setActiveSessionState,
    minimizeSession,
    expandSession,
    finishSession,
    cancelSession,
    handMode,
    setActiveOverlay,
    overlayExpandReq,
  } = app;

  const savedScrollTopRef = useRef<number>(0);
  const sessionViewRef = useRef<any>(null);

  const hasSession = !!activeSession;
  const overlayMode = activeSession?.ui?.overlay === 'MINIMIZED' ? 'minimized' : 'expanded';

  // keep AppShell in sync
  useEffect(() => {
    if (!activeSession) {
      setActiveOverlay?.({ mode: 'hidden' });
      return;
    }
    if (overlayMode === 'expanded') setActiveOverlay?.({ mode: 'expanded' });
    else setActiveOverlay?.({ mode: 'minimized', dock: handMode === 'left' ? 'left' : 'right' });
  }, [activeSession?.id, overlayMode, handMode, setActiveOverlay]);

  useEffect(() => {
    if (!activeSession) return;
    expandSession?.();
  }, [overlayExpandReq]); // intentionally not depending on activeSession.id

  const minimize = useCallback(() => {
    savedScrollTopRef.current = sessionViewRef.current?.getScrollTop?.() ?? 0;
    minimizeSession?.();
  }, [minimizeSession]);

  const expand = useCallback(() => {
    expandSession?.();
    requestAnimationFrame(() => {
      sessionViewRef.current?.setScrollTop?.(savedScrollTopRef.current);
    });
  }, [expandSession]);

  // MINIMIZE ONLY WHEN APPSHELL ASKS FOR IT
  useEffect(() => {
    const handler = () => {
      if (!activeSession) return;
      if (overlayMode !== 'expanded') return;
      minimize();
    };

    window.addEventListener('relay:overlay:minimize', handler as EventListener);
    return () => window.removeEventListener('relay:overlay:minimize', handler as EventListener);
  }, [activeSession?.id, overlayMode, minimize]);

  // ✅ Build adapter/view only when session exists (but do it safely)
  const adapter = useMemo(() => {
    if (!activeSession) return null;
    return getModuleAdapter(activeSession.module);
  }, [activeSession?.module]);

  const View: any = useMemo(() => {
    if (!adapter) return null;
    return overlayMode === 'expanded' ? adapter.ExpandedView : adapter.MinimizedView;
  }, [adapter, overlayMode]);

  const viewApi = useMemo(
    () => ({
      setState: setActiveSessionState,
      minimize,
      expand,
      finish: finishSession,
      cancel: cancelSession,
    }),
    [setActiveSessionState, minimize, expand, finishSession, cancelSession]
  );

  if (!hasSession || !adapter || !View) return null;

  const dockSide = activeSession!.ui.dockSide === 'LEFT' ? 'left' : 'right';

  // ...rest of your JSX (unchanged)


  


  return (
    <>
      {/* Expanded overlay */}
      <AnimatePresence>
        {overlayMode === 'expanded' && (
          <motion.div
            key="overlay-expanded"
            className="fixed inset-0 z-[220]"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.12 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/18 backdrop-blur-[2px]" />

            {/* full-screen session */}
            <div className="absolute inset-0">
              <div className="h-full w-full bg-[var(--bg)]">
                <View ref={sessionViewRef} sessionId={activeSession.id} state={activeSession.state} api={viewApi} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Minimized pill */}
      <AnimatePresence>
        {overlayMode === 'minimized' && (
          <motion.button
            key="overlay-pill"
            type="button"
            onClick={expand}
            className={[
              'fixed z-[235] top-[calc(env(safe-area-inset-top)+92px)]',
              'px-3 py-2 rounded-2xl',
              'border border-[var(--border)]',
              'bg-[var(--bg)]/84 backdrop-blur-xl',
              'shadow-[0_18px_60px_rgba(0,0,0,0.45)]',
              'flex items-center gap-2',
              'text-[var(--text)]',
              'active:scale-[0.98] transition-transform',
              dockSide === 'left' ? 'left-3' : 'right-3',
            ].join(' ')}
            initial={reduceMotion ? false : { opacity: 0, x: dockSide === 'left' ? -14 : 14, scale: 0.98 }}
            animate={reduceMotion ? undefined : { opacity: 1, x: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, x: dockSide === 'left' ? -14 : 14, scale: 0.98 }}
            transition={FAST}
            aria-label="Reopen active session"
            title="Reopen active session"
          >
            {dockSide === 'left' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            <span className="text-[10px] font-black uppercase tracking-widest opacity-85">Active</span>
            <Maximize2 size={16} className="opacity-80" />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
};
