import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, History, LayoutTemplate, TrendingUp, UploadCloud } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkoutStatus, type WorkoutSession } from '@relay/shared';
import ActiveWorkout from './GymExpandedSessionView';
import GymHistory from './GymHistory';
import GymTemplates from './GymTemplates';
import GymImportExport from './GymImportExport';
import { useWorkoutDraftRestore } from './useWorkoutDraftRestore';

import { registerModule } from '../../session/moduleRegistry';
import { gymSessionAdapter } from './gymSessionAdapter';


const TABS = ['history', 'templates', 'import'] as const;
type Tab = (typeof TABS)[number];

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

const GymDashboard: React.FC = () => {
  const { activeSession, startSession, workoutHistory, setWorkoutHistory, requestOverlayExpand, expandSession } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('history');

  // Restore draft once when entering gym
  useWorkoutDraftRestore();

  // If user is currently in an active workout route, we show ActiveWorkout there,
  // BUT also: if state has workout AND we navigated here, allow resume.
  const hasActive =
    !!activeSession &&
    activeSession.module === 'GYM' &&
    activeSession.lifecycle === 'ACTIVE' &&
    (activeSession.state as any)?.status === "active";


  // Pull completed workouts from DB (optional but nice)
  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('relay-token');
      try {
        const res = await fetch('/api/workouts?module=GYM&status=completed', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) return;

        const data = (await res.json().catch(() => null)) as { workouts?: WorkoutSession[] } | null;
        if (data?.workouts?.length) {
          // Merge with local without duplicates (keep newest)
          const map = new Map<string, WorkoutSession>();
          for (const w of data.workouts) map.set(w.id, w);
          for (const w of workoutHistory) map.set(w.id, w);
          const merged = Array.from(map.values()).sort((a, b) => b.startTime - a.startTime);
          setWorkoutHistory(merged);
        }
      } catch {
        // ignore offline
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    const startWorkout = () => {
    const now = Date.now();

    const newWorkout: WorkoutSession = {
      dataVersion: 1,
      id: uid(),
      module: 'GYM',
      status: "active",

      startTime: now,
      updatedAt: now,

      logs: [],
      templateIdUsed: null,
    };

   startSession('GYM', newWorkout);
   //navigate('/activities/gym/active');
  };


  const resumeWorkout = () => {
    //requestOverlayExpand?.();
    expandSession?.();
    //navigate('/activities/gym/active');
  };

  const tabs = useMemo(
    () => [
      { id: 'history' as const, label: 'History', icon: History },
      { id: 'templates' as const, label: 'Templates', icon: LayoutTemplate },
      { id: 'import' as const, label: 'Import/Export', icon: UploadCloud },
    ],
    []
  );

  // If route is /activities/gym/active, you’ll render ActiveWorkout via routing.
  // But if someone ends up here with isViewingActiveWorkout logic: keep compatible.
  if (hasActive && window.location.pathname.endsWith('/active')) {
    return <ActiveWorkout />;
  }

  return (
    <div className="px-6 py-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center py-2">
        <h2 className="text-4xl font-[900] italic tracking-tighter text-[var(--text)]">
          GYM TRACKER<span className="text-[var(--primary)]">.</span>
        </h2>
        <p className="text-[var(--text-muted)] font-medium">Precision tracking for peak performance.</p>
      </div>

      {/* Start / Resume */}
      {hasActive ? (
        <button
          onClick={resumeWorkout}
          className="w-full rounded-[32px] p-8 border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl
                     shadow-[0_18px_60px_rgba(0,0,0,0.14)]
                     hover:bg-[var(--glass-strong)] transition-colors flex flex-col items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-center">
            <Play size={26} className="text-[var(--primary)]" />
          </div>
          <span className="font-[900] italic uppercase tracking-tight text-[var(--text)]">Resume Session</span>
          <span className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
            Draft restored automatically
          </span>
        </button>
      ) : (
        <button
          onClick={startWorkout}
          className="w-full bg-[var(--text)] text-[var(--bg)] p-2 rounded-[32px]
                     flex flex-col items-center justify-center gap-1
                     hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10"
        >
          <div className="bg-white/10 p-2 rounded-full">
            <Play fill="currentColor" size={30} />
          </div>
          <span className="font-[900] italic uppercase tracking-tight">START NEW WORKOUT</span>
        </button>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={[
                "rounded-2xl px-1 py-3 border text-center transition-colors",
                active
                  ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]"
                  : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]",
              ].join(' ')}
            >
              <div className="flex items-center justify-center gap-0">
                <Icon size={16} />
                <span className="text-[8px] font-[900] uppercase tracking-widest">{label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === 'history' && <GymHistory />}
      {tab === 'templates' && <GymTemplates onStartTemplate={(workout) => {
        startSession('GYM', workout);
        //navigate('/activities/gym/active');
      }} />}
      {tab === 'import' && <GymImportExport />}
    </div>
  );
};

export default GymDashboard;
