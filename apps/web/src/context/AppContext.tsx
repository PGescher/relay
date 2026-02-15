// apps/web/src/context/AppContext.tsx
import React, { createContext, useContext, useMemo, useState, ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '@relay/shared';

import type { ActiveSession, SessionModuleKey } from '@relay/shared';
import { ACTIVE_SESSION_VERSION } from '@relay/shared';

import { getModuleAdapter } from '../session/moduleRegistry';

import { loadWorkouts, deleteWorkouts } from '../data/workoutCache';

import { useAuth } from './AuthContext';

const ACTIVE_SESSION_STORAGE_KEY = 'relay:activeSession:v1';

export type HandMode = 'right' | 'left';
export type NavDock = 'left' | 'center' | 'right';

export type ActiveOverlayState =
  | { mode: 'hidden' }
  | { mode: 'expanded' }
  | { mode: 'minimized'; dock: 'left' | 'right' };

interface AppContextType {
  activeSession: ActiveSession | null;
  setActiveSessionState: (nextState: unknown) => void;

  /** Starts (or replaces) the single active session. */
  startSession: (module: SessionModuleKey, payload?: unknown) => void;
  minimizeSession: () => void;
  expandSession: () => void;
  finishSession: () => Promise<void>;
  cancelSession: () => void;

  workoutHistory: WorkoutSession[];
  setWorkoutHistory: React.Dispatch<React.SetStateAction<WorkoutSession[]>>;

  setActiveTab: (tab: string) => void;

  isViewingActiveWorkout: boolean;
  setIsViewingActiveWorkout: (val: boolean) => void;

  // ✅ UX state
  handMode: HandMode;
  setHandMode: (v: HandMode) => void;
  toggleHandMode: () => void;

  /**
   * Dock preference for the single hub button.
   * If navDock !== 'center', it will mirror handMode (see derivedNavDock).
   */
  navDock: NavDock;
  setNavDock: (v: NavDock) => void;

  // derived: final dock side used by UI (mirrors handMode if navDock is left/right)
  derivedNavDock: NavDock;

  // Active session overlay UI state (to control AppShell interaction + header)
  activeOverlay: ActiveOverlayState;
  setActiveOverlay: (v: ActiveOverlayState) => void;

  // one-way trigger: request the session overlay to expand (e.g. from GymDashboard "Resume")
  overlayExpandReq: number;
  requestOverlayExpand: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

/** ---- persistence helpers ---- */
const loadHandMode = (): HandMode => {
  try {
    const v = localStorage.getItem('relay.handMode');
    return v === 'left' || v === 'right' ? v : 'right';
  } catch {
    return 'right';
  }
};

const saveHandMode = (v: HandMode) => {
  try {
    localStorage.setItem('relay.handMode', v);
  } catch {
    // ignore
  }
};

const loadNavDock = (): NavDock => {
  try {
    const v = localStorage.getItem('relay.navDock');
    return v === 'left' || v === 'center' || v === 'right' ? v : 'right';
  } catch {
    return 'right';
  }
};

const saveNavDock = (v: NavDock) => {
  try {
    localStorage.setItem('relay.navDock', v);
  } catch {
    // ignore
  }
};

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

  const { user, token } = useAuth();

  const ctx = { userId: user?.id ?? null, token: token ?? null };

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);

  const activeSessionRef = React.useRef<ActiveSession | null>(null);

  useEffect(() => {
    activeSessionRef.current = activeSession;
  }, [activeSession]);

  const setActiveSessionState = (next: unknown) => {
    setActiveSession((prev) => {
      if (!prev) return prev;

      const nextState =
        typeof next === 'function'
          ? (next as (p: unknown) => unknown)(prev.state)
          : next;

      return {
        ...prev,
        state: nextState,
        meta: { ...prev.meta, lastActiveAt: Date.now() },
      };
    });
  };


  const [isSessionMutating, setIsSessionMutating] = useState(false);

  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [isViewingActiveWorkout, setIsViewingActiveWorkout] = useState(false);

  // ✅ Global UX state
  const [handMode, setHandModeState] = useState<HandMode>(() => loadHandMode());
  const [navDock, setNavDockState] = useState<NavDock>(() => loadNavDock());

  // Active overlay state is driven by ActiveSessionOverlay
  const [activeOverlay, setActiveOverlay] = useState<ActiveOverlayState>({ mode: 'hidden' });

  // increment-only trigger
  const [overlayExpandReq, setOverlayExpandReq] = useState(0);
  const requestOverlayExpand = () => setOverlayExpandReq((x) => x + 1);

  const navigate = useNavigate();

  const setActiveTab = (tab: string) => {
    if (tab === 'history') navigate('/activities/gym/history');
    if (tab === 'home') navigate('/home');
    if (tab === 'gym') navigate('/activities/gym');
  };

  const setHandMode = (v: HandMode) => {
    setHandModeState(v);
    saveHandMode(v);
  };

  const toggleHandMode = () => setHandMode(handMode === 'right' ? 'left' : 'right');

  const setNavDock = (v: NavDock) => {
    setNavDockState(v);
    saveNavDock(v);
  };
  

  // ✅ Derived behavior:
  // - center stays center
  // - left/right mirror with handMode (so “side dock” follows your one-hand toggle)
  const derivedNavDock = useMemo<NavDock>(() => {
    if (navDock === 'center') return 'center';
    return handMode === 'left' ? 'left' : 'right';
  }, [navDock, handMode]);

  // keep localStorage synced if state changes elsewhere
  useEffect(() => saveHandMode(handMode), [handMode]);
  useEffect(() => saveNavDock(navDock), [navDock]);

  useEffect(() => {
    if (!ctx.userId) {
      setWorkoutHistory([]);
      return;
    }

    const cached = loadWorkouts(ctx.userId)
      .filter((w) => w.module === 'GYM')
      .map((w) => w.data as WorkoutSession)
      .filter(Boolean);

    const ts = (w: WorkoutSession) => w.endTime ?? w.updatedAt ?? w.startTime ?? 0;
    cached.sort((a, b) => ts(b) - ts(a));

    setWorkoutHistory(cached);
  }, [ctx.userId]);


  useEffect(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as ActiveSession;
      if (!parsed) return;

      // Version gate (future migrations)
      if ((parsed.meta?.version ?? 0) !== ACTIVE_SESSION_VERSION) return;

      // Only restore unfinished sessions
      if (parsed.lifecycle === 'ACTIVE') {
        const adapter = getModuleAdapter(parsed.module);
        const restored: ActiveSession = adapter.deserialize
          ? { ...parsed, state: adapter.deserialize(parsed.state) }
          : parsed;

        setActiveSession(restored);
      }
    } catch (e) {
      console.warn('Failed to restore active session', e);
    }
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<WorkoutSession>;
      const w = ev.detail;
      if (!w) return;

      setWorkoutHistory((prev) => {
        const next = [w, ...prev.filter((x) => x.id !== w.id)];
        return next;
      });
    };

    window.addEventListener('relay:gym:workoutFinished', handler as EventListener);
    return () => window.removeEventListener('relay:gym:workoutFinished', handler as EventListener);
  }, []);



  useEffect(() => {
    if (!activeSession) {
      localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
      return;
    }

    try {
      const adapter = getModuleAdapter(activeSession.module);
      const persisted: ActiveSession = adapter.serialize
        ? { ...activeSession, state: adapter.serialize(activeSession.state) }
        : activeSession;

      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(persisted));
    } catch (e) {
      console.warn('Failed to persist active session', e);
    }
  }, [activeSession]);

  const startSession = (module: SessionModuleKey, payload?: unknown) => {
    const id = crypto.randomUUID?.() ?? `${Date.now()}`;

    const adapter = getModuleAdapter(module);
    const initialState = adapter.createInitialState(payload);

    const session: ActiveSession = {
      id,
      module,
      lifecycle: 'ACTIVE',
      ui: {
        overlay: 'EXPANDED',
        dockSide: 'RIGHT',
      },
      state: initialState,
      meta: {
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        version: ACTIVE_SESSION_VERSION,
        persistenceKey: `session:${module}:${id}`,
        restorePolicy: 'ifNotFinished',
      },
    };

    setActiveSession(session);
  };

  const minimizeSession = () => {
    setActiveSession((prev) =>
      prev
        ? {
            ...prev,
            ui: { ...prev.ui, overlay: 'MINIMIZED' },
            meta: { ...prev.meta, lastActiveAt: Date.now() },
          }
        : prev
    );
  };

  const expandSession = () => {
    setActiveSession((prev) =>
      prev
        ? {
            ...prev,
            ui: { ...prev.ui, overlay: 'EXPANDED' },
            meta: { ...prev.meta, lastActiveAt: Date.now() },
          }
        : prev
    );
  };

  const finishSession = async () => {
    const cur = activeSessionRef.current;
    if (!cur || isSessionMutating) return;
    setIsSessionMutating(true);

    const snapshot = cur; // ✅ always latest

    setActiveSession((prev) =>
      prev
        ? { ...prev, lifecycle: 'FINISHING' as any, meta: { ...prev.meta, lastActiveAt: Date.now() } }
        : prev
    );

    try {
      const adapter = getModuleAdapter(snapshot.module);

      await adapter.onFinish({
        sessionId: snapshot.id,
        module: snapshot.module,
        state: snapshot.state,
        meta: snapshot.meta,
        ctx,
      });

      setActiveSession(null);
    } catch (e) {
      console.warn('Session finish hook failed', e);
      setActiveSession((prev) =>
        prev ? { ...prev, lifecycle: 'ACTIVE', meta: { ...prev.meta, lastActiveAt: Date.now() } } : prev
      );
      setIsSessionMutating(false);
      return;
    }

    setIsSessionMutating(false);
  };


  const cancelSession = () => {
    if (!activeSession || isSessionMutating) return;
    setIsSessionMutating(true);

    const snapshot = activeSession;

    try {
      const adapter = getModuleAdapter(snapshot.module);
        adapter.onCancel?.({
        sessionId: snapshot.id,
        module: snapshot.module,
        state: snapshot.state,
        meta: snapshot.meta,
        ctx,
      });

      setActiveSession(null);
    } catch (e) {
      console.warn('Session cancel hook failed', e);
    }

    setIsSessionMutating(false);
  };


  return (
    <AppContext.Provider
      value={{
        setActiveSessionState,
        activeSession,
        startSession,
        minimizeSession,
        expandSession,
        finishSession,
        cancelSession,
        workoutHistory,
        setWorkoutHistory,
        setActiveTab,
        isViewingActiveWorkout,
        setIsViewingActiveWorkout,

        handMode,
        setHandMode,
        toggleHandMode,

        navDock,
        setNavDock,
        derivedNavDock,

        activeOverlay,
        setActiveOverlay,

        overlayExpandReq,
        requestOverlayExpand,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
