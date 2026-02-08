import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Check, X, Timer, Trash2, ListOrdered, ChevronUp, ChevronDown, MinusSquare } from 'lucide-react';
import { AnimatePresence, Reorder, motion, useReducedMotion } from 'framer-motion';

import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';

import { EXERCISES } from './constants';
import {
  WorkoutStatus,
  type ExerciseLog,
  type SetLog,
  type WorkoutEvent,
  type WorkoutSession,
  type WorkoutTemplate,
} from '@relay/shared';

import { saveWorkoutDraft, clearWorkoutDraft, loadLastWorkoutDraft } from './workoutDraft';
import { FinishWorkoutModal } from './FinishWorkoutModal';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';

import { apiPushGymComplete } from '../../data/apiClient';
import { enqueuePending } from '../../data/sync/pendingQueue';
import { upsertWorkouts } from '../../data/workoutCache';
import { syncNow } from '../../data/sync/syncManager';

const REST_STORAGE_KEY = 'relay:gym:restByExerciseId:v1';
const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

const formatMMSS = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatTime = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

type SwipeState = {
  startX: number;
  startY: number;
  swiping: boolean;
  triggered: boolean;
};

const SWIPE_DELETE_PX = 70;
type IncompletePolicy = 'delete' | 'complete' | 'keep';

type ExerciseLogWithId = ExerciseLog & { logId: string };

function ensureLogIds(logs: ExerciseLog[]): ExerciseLogWithId[] {
  return logs.map((l, idx) => {
    const anyL = l as any;
    const logId = typeof anyL.logId === 'string' && anyL.logId.length ? anyL.logId : `${l.exerciseId}-${idx}-${uid()}`;
    return { ...(l as any), logId } as ExerciseLogWithId;
  });
}

type OverlayMode = 'expanded' | 'minimized';

export type ActiveWorkoutOverlayHandle = {
  cancelWorkout: () => void;
  openFinish: () => void;

  // scroll preservation
  getScrollTop: () => number;
  setScrollTop: (top: number) => void;
};


export const ActiveWorkoutOverlay = forwardRef<
  ActiveWorkoutOverlayHandle,
  { mode: OverlayMode; onRequestMinimize: () => void }
>(function ActiveWorkoutOverlay({ mode, onRequestMinimize }, ref) {
  const reduceMotion = useReducedMotion();

  const app = useApp() as any;
  const { currentWorkout, setCurrentWorkout, setWorkoutHistory, workoutHistory } = app;
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const handMode =
    (app?.handMode as 'left' | 'right' | undefined) ?? ((localStorage.getItem('relay:handMode') as any) || 'right');

  const [timer, setTimer] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  const [showReorderTab, setShowReorderTab] = useState(false);
  const reorderScrollRef = useRef<HTMLDivElement | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [events, setEvents] = useState<WorkoutEvent[]>([]);
  const appendEvent = (type: WorkoutEvent['type'], payload?: WorkoutEvent['payload']) => {
    if (!currentWorkout) return;
    const ev: WorkoutEvent = {
      id: uid(),
      workoutId: currentWorkout.id,
      at: Date.now(),
      type,
      payload,
    };
    setEvents((prev) => [ev, ...prev]);
  };

  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [restTotal, setRestTotal] = useState<number>(0);
  const [restRunning, setRestRunning] = useState<boolean>(false);
  const restIntervalRef = useRef<number | null>(null);
  const restStartedAtRef = useRef<number | null>(null);
  const [restAnchor, setRestAnchor] = useState<{ logId: string; setId: string } | null>(null);

  const DEFAULT_REST = 120;
  const [restByExerciseId, setRestByExerciseId] = useState<Record<string, number>>({});
  const [restConfigForExerciseId, setRestConfigForExerciseId] = useState<string | null>(null);

  const swipeRef = useRef<Record<string, SwipeState>>({});

  const [showFinish, setShowFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [incompleteCount, setIncompleteCount] = useState(0);

  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    if (currentWorkout) return;

    const draft = loadLastWorkoutDraft();
    if (draft?.workout?.status === WorkoutStatus.active) {
      setCurrentWorkout(draft.workout);
      setEvents(draft.events ?? []);
      setRestByExerciseId(draft.restByExerciseId ?? {});
      return;
    }

    navigate('/activities/gym', { replace: true });
  }, [currentWorkout, setCurrentWorkout, navigate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setRestByExerciseId(parsed);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(REST_STORAGE_KEY, JSON.stringify(restByExerciseId));
    } catch {}
  }, [restByExerciseId]);

  useEffect(() => {
    if (!currentWorkout) return;

    const withIds = ensureLogIds(currentWorkout.logs);
    const changed = withIds.some((l, i) => (currentWorkout.logs[i] as any)?.logId !== l.logId);

    if (changed) {
      setCurrentWorkout({ ...currentWorkout, logs: withIds });
      return;
    }

    const ids = withIds.map((l) => l.logId);
    setOrder((prev) => {
      if (!prev.length) return ids;
      const prevSet = new Set(prev);
      const kept = prev.filter((id) => ids.includes(id));
      const merged = [...kept];
      for (const id of ids) if (!prevSet.has(id)) merged.push(id);
      return merged;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkout?.id, currentWorkout?.logs?.length]);

  useEffect(() => {
    if (!currentWorkout) return;
    const tick = () => setTimer(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [currentWorkout]);

  useEffect(() => {
    if (!restRunning) return;

    if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);

    restIntervalRef.current = window.setInterval(() => {
      setRestRemaining((prev) => {
        if (prev <= 1) {
          setRestRunning(false);
          if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);
          restIntervalRef.current = null;

          const started = restStartedAtRef.current;
          if (started) {
            const actualSec = Math.max(0, Math.round((Date.now() - started) / 1000));
            appendEvent('rest_stopped', { actualSec });
          }
          restStartedAtRef.current = null;
          setRestAnchor(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restRunning]);

  const startRest = (seconds: number) => {
    setRestTotal(seconds);
    setRestRemaining(seconds);
    setRestRunning(true);
    restStartedAtRef.current = Date.now();
    appendEvent('rest_started', { plannedSec: seconds });
  };

  const stopRest = useCallback(() => {
    setRestRunning(false);
    setRestRemaining(0);
    setRestTotal(0);
    setRestAnchor(null);

    if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;

    const started = restStartedAtRef.current;
    if (started) {
      const actualSec = Math.max(0, Math.round((Date.now() - started) / 1000));
      appendEvent('rest_stopped', { actualSec });
    }
    restStartedAtRef.current = null;
  }, []);

  const addRest = (delta: number) => {
    if (!restRunning) return;
    setRestRemaining((r) => Math.max(0, r + delta));
    setRestTotal((t) => Math.max(0, t + delta));
  };

  useEffect(() => {
    if (!showReorderTab) return;
    requestAnimationFrame(() => {
      reorderScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' as any });
    });
  }, [showReorderTab]);

  const lastLogByExerciseId = useMemo(() => {
    const completed = workoutHistory.filter((w: WorkoutSession) => w.status === WorkoutStatus.completed);
    const map = new Map<string, ExerciseLog>();
    for (const w of completed) {
      for (const log of w.logs) {
        if (!map.has(log.exerciseId)) map.set(log.exerciseId, log);
      }
    }
    return map;
  }, [workoutHistory]);

  const getGhost = (exerciseId: string, setIndex: number): { weight?: number; reps?: number } => {
    const last = lastLogByExerciseId.get(exerciseId);
    if (!last) return {};
    const prevSet = last.sets?.[setIndex];
    if (!prevSet) return {};
    return { weight: prevSet.weight, reps: prevSet.reps };
  };

  const formatGhost = (exerciseId: string, setIndex: number) => {
    const g = getGhost(exerciseId, setIndex);
    if (g.weight == null && g.reps == null) return '';
    const w = g.weight != null ? `${g.weight}` : '–';
    const r = g.reps != null ? `${g.reps}` : '–';
    return `${w} × ${r}`;
  };

  const getRestForExercise = (exerciseId: string) => restByExerciseId[exerciseId] ?? DEFAULT_REST;

  const ensureRestEntry = (exerciseId: string) => {
    setRestByExerciseId((prev) => (prev[exerciseId] ? prev : { ...prev, [exerciseId]: DEFAULT_REST }));
  };

  const applyOrderToWorkout = (nextOrder: string[]) => {
    if (!currentWorkout) return;

    const logsWithIds = ensureLogIds(currentWorkout.logs);
    const byId = new Map<string, ExerciseLogWithId>();
    for (const l of logsWithIds) byId.set(l.logId, l);

    const nextLogs: ExerciseLogWithId[] = [];
    for (const id of nextOrder) {
      const log = byId.get(id);
      if (log) nextLogs.push(log);
    }
    for (const l of logsWithIds) if (!nextOrder.includes(l.logId)) nextLogs.push(l);

    setOrder(nextOrder);
    setCurrentWorkout({ ...currentWorkout, logs: nextLogs, updatedAt: Date.now() });
  };

  const updateSet = (exerciseIndex: number, setIndex: number, data: Partial<SetLog>) => {
    if (!currentWorkout) return;

    const newLogs = [...currentWorkout.logs];
    const current = newLogs[exerciseIndex].sets[setIndex];

    const now = Date.now();
    const startedEditingAt =
      (data.weight != null || data.reps != null) && !(current as any).startedEditingAt ? now : (current as any).startedEditingAt;

    newLogs[exerciseIndex].sets[setIndex] = { ...(current as any), ...data, startedEditingAt } as any;
    setCurrentWorkout({ ...currentWorkout, logs: newLogs });

    appendEvent('set_value_changed', {
      exerciseId: newLogs[exerciseIndex].exerciseId,
      setId: current.id,
      patch: data,
    });
  };

  const getLastCompletedSetsForExercise = (exerciseId: string): Array<{ reps: number; weight: number }> | null => {
    if (!workoutHistory?.length) return null;

    const ts = (w: any) =>
      (typeof w?.endTime === 'number' && w.endTime) ||
      (typeof w?.updatedAt === 'number' && w.updatedAt) ||
      (typeof w?.startTime === 'number' && w.startTime) ||
      0;

    const sorted = [...workoutHistory].sort((a: any, b: any) => ts(b) - ts(a));

    for (const w of sorted) {
      const status = String((w as any)?.status ?? '').toLowerCase();
      const isFinished = status === 'finished' || status === 'completed' || Boolean((w as any)?.endTime);
      if (!isFinished) continue;

      const logs = (w as any)?.logs;
      if (!Array.isArray(logs)) continue;

      const log = logs.find((l: any) => l?.exerciseId === exerciseId);
      if (!log) continue;

      const sets = Array.isArray(log?.sets) ? log.sets : [];
      if (!sets.length) continue;

      const completed = sets.filter((s: any) => s?.isCompleted);
      const source = completed.length ? completed : sets;

      const mapped = source.map((s: any) => ({
        reps: typeof s?.reps === 'number' ? s.reps : 0,
        weight: typeof s?.weight === 'number' ? s.weight : 0,
      }));

      const hasSignal = completed.length > 0 || mapped.some((s: any) => (s.reps ?? 0) !== 0 || (s.weight ?? 0) !== 0);
      if (hasSignal) return mapped;
    }

    return null;
  };

  const buildPrefilledSetLogs = (exerciseId: string, plannedRestSec: number): SetLog[] => {
    const last = getLastCompletedSetsForExercise(exerciseId);
    const base = last?.length ? last : [{ reps: 0, weight: 0 }];

    return base.map((s) => ({
      id: uid(),
      reps: s.reps ?? 0,
      weight: s.weight ?? 0,
      isCompleted: false,
      restPlannedSec: plannedRestSec,
    }));
  };

  const addExercise = (exerciseId: string) => {
    if (!currentWorkout) return;
    const exercise = EXERCISES.find((e) => e.id === exerciseId);
    if (!exercise) return;

    ensureRestEntry(exercise.id);
    const planned = getRestForExercise(exercise.id);

    const newLog: ExerciseLogWithId = {
      logId: uid(),
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      restSecDefault: planned,
      sets: buildPrefilledSetLogs(exercise.id, planned),
    };

    setCurrentWorkout({ ...currentWorkout, logs: [...currentWorkout.logs, newLog] });
    setOrder((prev) => [...prev, newLog.logId]);

    appendEvent('exercise_added', { exerciseId: exercise.id, name: exercise.name });
    setShowExercisePicker(false);
  };

  const deleteExercise = (exerciseIndex: number) => {
    if (!currentWorkout) return;
    const log = currentWorkout.logs[exerciseIndex] as any;
    if (!confirm(`Delete ${log.exerciseName}?`)) return;

    const id = (log?.logId as string) ?? `${log.exerciseId}-${exerciseIndex}`;

    const newLogs = currentWorkout.logs.filter((_: any, i: number) => i !== exerciseIndex);
    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
    setOrder((prev) => prev.filter((x) => x !== id));

    appendEvent('exercise_deleted', { exerciseId: log.exerciseId, name: log.exerciseName });
  };

  const moveExercisePos = (fromPos: number, toPos: number) => {
    if (!currentWorkout) return;
    if (toPos < 0 || toPos >= order.length) return;

    setOrder((prev) => {
      const next = arrayMove(prev, fromPos, toPos);
      applyOrderToWorkout(next);
      return next;
    });
  };

  const addSet = (exerciseIndex: number) => {
    if (!currentWorkout) return;

    const ex = currentWorkout.logs[exerciseIndex];
    const planned = getRestForExercise(ex.exerciseId);

    const newSet: SetLog = {
      id: uid(),
      reps: 0,
      weight: 0,
      isCompleted: false,
      restPlannedSec: planned,
    };

    const newLogs = [...currentWorkout.logs];
    newLogs[exerciseIndex].sets = [...newLogs[exerciseIndex].sets, newSet];

    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
    appendEvent('set_added', { exerciseId: ex.exerciseId, setId: newSet.id });
  };

  const deleteSetConfirmed = (exerciseIndex: number, setIndex: number) => {
    if (!currentWorkout) return;

    const ex = currentWorkout.logs[exerciseIndex];
    const set = ex.sets[setIndex];

    const newLogs = [...currentWorkout.logs];
    newLogs[exerciseIndex].sets = newLogs[exerciseIndex].sets.filter((_: any, i: number) => i !== setIndex);

    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
    appendEvent('set_deleted', { exerciseId: ex.exerciseId, setId: set.id });

    if (restAnchor?.setId === set.id) stopRest();
  };

  const toggleComplete = (exerciseIndex: number, setIndex: number) => {
    if (!currentWorkout) return;

    const log = currentWorkout.logs[exerciseIndex] as any as ExerciseLogWithId;
    const set = log.sets[setIndex];
    const next = !set.isCompleted;

    const ghostVals = getGhost(log.exerciseId, setIndex);

    let nextWeight = set.weight;
    let nextReps = set.reps;

    if (next) {
      if ((nextWeight === 0 || Number.isNaN(nextWeight)) && ghostVals.weight != null) nextWeight = ghostVals.weight;
      if ((nextReps === 0 || Number.isNaN(nextReps)) && ghostVals.reps != null) nextReps = ghostVals.reps;
    }

    const patch: Partial<SetLog> = {
      weight: nextWeight,
      reps: nextReps,
      isCompleted: next,
      completedAt: next ? Date.now() : undefined,
      restPlannedSec: getRestForExercise(log.exerciseId),
    };

    const newLogs = [...currentWorkout.logs];
    newLogs[exerciseIndex].sets[setIndex] = { ...newLogs[exerciseIndex].sets[setIndex], ...patch };
    setCurrentWorkout({ ...currentWorkout, logs: newLogs });

    appendEvent(next ? 'set_completed' : 'set_uncompleted', {
      exerciseId: log.exerciseId,
      setId: set.id,
      weight: nextWeight,
      reps: nextReps,
    });

    if (next) {
      setRestAnchor({ logId: log.logId, setId: set.id });
      startRest(getRestForExercise(log.exerciseId));
    } else {
      stopRest();
    }
  };

  const openFinish = useCallback(() => {
    if (!currentWorkout) return;
    stopRest();
    setShowFinish(true);

    let n = 0;
    for (const log of currentWorkout.logs) for (const s of log.sets) if (!s.isCompleted) n++;
    setIncompleteCount(n);
  }, [currentWorkout, stopRest]);

  const cancelWorkout = useCallback(() => {
    if (!currentWorkout) return;
    stopRest();

    if (confirm('Cancel workout? Data will be lost.')) {
      appendEvent('workout_cancelled', {});
      clearWorkoutDraft(currentWorkout.id);
      setCurrentWorkout(null);
      navigate('/activities/gym', { replace: true });
    }
  }, [currentWorkout, stopRest, navigate]);

  useImperativeHandle(
    ref,
    () => ({
      cancelWorkout,
      openFinish,
      getScrollTop: () => scrollRef.current?.scrollTop ?? 0,
      setScrollTop: (top: number) => {
        if (!scrollRef.current) return;
        scrollRef.current.scrollTop = top;
      },
    }),
    [cancelWorkout, openFinish]
  );

  useEffect(() => {
    if (!currentWorkout) return;

    const t = window.setTimeout(() => {
      saveWorkoutDraft({
        workout: currentWorkout,
        events,
        restByExerciseId,
        updatedAt: Date.now(),
      });
    }, 150);

    return () => window.clearTimeout(t);
  }, [currentWorkout, events, restByExerciseId]);

  if (!currentWorkout) return null;

  const bottomNavPx = 84;
  const floatingBottom = 'calc(env(safe-area-inset-bottom, 0px) + 96px)';
  const reorderSideClass = handMode === 'right' ? 'right-4' : 'left-4';

  // ---------- finish handling (unchanged core) ----------
  const applyIncompletePolicy = (w: WorkoutSession, policy: IncompletePolicy): WorkoutSession => {
    if (policy === 'keep') return w;

    const now = Date.now();

    const logs = w.logs
      .map((log) => {
        if (policy === 'delete') {
          const kept = log.sets.filter((s) => s.isCompleted);
          return { ...log, sets: kept };
        }

        const sets = log.sets.map((s, idx) => {
          if (s.isCompleted) return s;

          const g = getGhost(log.exerciseId, idx);
          const weight = s.weight === 0 && g.weight != null ? g.weight : s.weight;
          const reps = s.reps === 0 && g.reps != null ? g.reps : s.reps;

          return { ...s, weight, reps, isCompleted: true, completedAt: now };
        });
        return { ...log, sets };
      })
      .filter((log) => log.sets.length > 0);

    return { ...w, logs };
  };

  const finishWorkoutWithOptions = async (opts: {
    policy: IncompletePolicy;
    rpeOverall?: number;
    saveAsTemplate: boolean;
    templateName?: string;
    updateUsedTemplate: boolean;
  }) => {
    if (!currentWorkout) return;
    if (finishing) return;

    setFinishing(true);
    appendEvent('workout_finish_opened', { incompleteCount });

    const now = Date.now();

    const baseFinished: WorkoutSession = {
      ...currentWorkout,
      dataVersion: 1,
      endTime: now,
      status: WorkoutStatus.completed,
      durationSec: Math.round((now - currentWorkout.startTime) / 1000),
      rpeOverall: opts.rpeOverall,
    };

    const finished = applyIncompletePolicy(baseFinished, opts.policy);
    const totalVolume = computeWorkoutVolume(finished);
    const finished2: WorkoutSession = { ...finished, totalVolume };

    appendEvent('workout_finished', { totalVolume, rpeOverall: opts.rpeOverall, incompletePolicy: opts.policy });

    const completePayload = { workout: finished2, events, restByExerciseId };

    if (user?.id) {
      upsertWorkouts(user.id, [{ id: finished2.id, module: finished2.module, data: finished2 }]);
    }

    let pushed = false;

    try {
      if (!token || !user?.id) throw new Error('No auth');
      await apiPushGymComplete({ token, payload: completePayload });
      pushed = true;
    } catch (e) {
      console.warn('Workout push failed. Queueing pending sync.', e);
      if (user?.id) enqueuePending(user.id, finished2.id, completePayload);
    }

    try {
      if (opts.saveAsTemplate && user?.id) {
        const name = opts.templateName?.trim() || `Template ${new Date(finished2.startTime).toLocaleDateString('en-US')}`;

        const body: WorkoutTemplate = {
          dataVersion: 1,
          id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          module: 'GYM',
          name,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          data: {
            exercises: finished2.logs.map((l) => ({
              exerciseId: l.exerciseId,
              exerciseName: l.exerciseName,
              targetSets: l.sets.length,
              restSec: l.restSecDefault ?? 120,
              sets: l.sets.map((s) => ({ reps: s.reps ?? 0, weight: s.weight ?? 0 })),
            })),
          },
        };

        const payload = { method: 'POST' as const, endpoint: '/api/templates/gym', body };

        if (pushed && token) {
          await fetch(payload.endpoint, {
            method: payload.method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload.body),
          }).catch(() => {});
        } else {
          const { enqueuePendingTemplate } = await import('../../data/sync/pendingTemplates');
          enqueuePendingTemplate(user.id, body.id, payload);
        }
      }

      if (opts.updateUsedTemplate && finished2.templateIdUsed && user?.id) {
        const body = {
          name: null,
          dataVersion: 1,
          data: {
            exercises: finished2.logs.map((l) => ({
              exerciseId: l.exerciseId,
              exerciseName: l.exerciseName,
              targetSets: l.sets.length,
              restSec: l.restSecDefault ?? 120,
              sets: l.sets.map((s) => ({ reps: s.reps ?? 0, weight: s.weight ?? 0 })),
            })),
          },
        };

        const payload = { method: 'PUT' as const, endpoint: `/api/templates/gym/${finished2.templateIdUsed}`, body };

        if (pushed && token) {
          await fetch(payload.endpoint, {
            method: payload.method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload.body),
          }).catch(async () => {
            const { enqueuePendingTemplate } = await import('../../data/sync/pendingTemplates');
            enqueuePendingTemplate(user.id, `upd-${finished2.templateIdUsed}`, payload);
          });
        } else {
          const { enqueuePendingTemplate } = await import('../../data/sync/pendingTemplates');
          enqueuePendingTemplate(user.id, `upd-${finished2.templateIdUsed}`, payload);
        }
      }
    } catch (e) {
      console.warn('Template queue/save failed', e);
    }

    clearWorkoutDraft(finished2.id);

    setWorkoutHistory([finished2, ...workoutHistory]);
    setCurrentWorkout(null);
    setShowFinish(false);
    setFinishing(false);

    if (pushed && user?.id && token) {
      syncNow({ userId: user.id, token, module: 'GYM' }).catch(() => {});
    }

    navigate('/activities/gym', { replace: true });
  };

  const onConfirmFinishFromModal = async (opts: {
    incompleteAction: 'delete' | 'markComplete';
    rpeOverall?: number;
    saveAsTemplate: boolean;
    templateName?: string;
    updateUsedTemplate: boolean;
  }) => {
    const policy: IncompletePolicy = opts.incompleteAction === 'delete' ? 'delete' : 'complete';
    await finishWorkoutWithOptions({
      policy,
      rpeOverall: opts.rpeOverall,
      saveAsTemplate: opts.saveAsTemplate,
      templateName: opts.templateName,
      updateUsedTemplate: opts.updateUsedTemplate,
    });
  };

  // ---------- UI ----------
  return (
    <div className="h-full w-full flex flex-col">
      {/* OVERLAY HEADER (Cancel / Time / Finish / Minimize) */}
      <div
        className="
          shrink-0
          px-3 py-2
          border-b border-[var(--border)]
          bg-[var(--bg)]/70
          backdrop-blur-xl
        "
      >
        <div className="relative w-full flex items-center justify-center">
          <div className="absolute left-0 flex items-center gap-2">
            <button
              type="button"
              onClick={cancelWorkout}
              className="h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] transition-colors flex items-center justify-center"
              aria-label="Cancel workout"
              title="Cancel workout"
            >
              <X size={16} />
            </button>
          </div>

          <div
            className="
              inline-flex items-center gap-3
              rounded-full
              border border-[var(--border)]
              bg-[var(--bg-card)]/45
              backdrop-blur-xl
              px-4 py-1.5
              shadow-sm
            "
          >
            <div className="flex flex-col items-center leading-none">
              <span className="text-[8px] font-black uppercase tracking-[0.22em] opacity-70">Duration</span>
              <span className="text-[13px] font-black italic tabular-nums">{formatTime(timer)}</span>
            </div>

            <div className="w-px h-7 bg-white/10" />

            <button
              type="button"
              onClick={openFinish}
              className="
                px-3 py-1.5
                rounded-full
                bg-white text-[var(--primary)]
                text-[9px] font-black uppercase tracking-widest
                active:scale-95 transition-transform
              "
            >
              Finish
            </button>
          </div>

          <div className="absolute right-0 flex items-center gap-2">
            <button
              type="button"
              onClick={onRequestMinimize}
              className="h-9 w-9 rounded-xl border border-[var(--border)] bg-[var(--bg-card)]/50 hover:bg-[var(--bg-card)] transition-colors flex items-center justify-center"
              aria-label="Minimize"
              title="Minimize"
            >
              <MinusSquare size={16} />
            </button>
          </div>
        </div>
      </div>

     {/* CONTENT AREA (positioning root for reorder) */}
      <div className="relative flex-1 overflow-hidden">
        {/* SCROLLING CONTENT */}
        <div
          ref={scrollRef}
          className={[
            'h-full overflow-y-auto',
            mode === 'expanded' ? 'px-4 py-4 space-y-4' : 'px-3 py-3 space-y-3',
          ].join(' ')}
          style={{ WebkitOverflowScrolling: 'touch' as any }}
        >
        <AnimatePresence initial={false}>
          {order.map((id) => {
            const idx = (currentWorkout.logs as any[]).findIndex((l) => l?.logId === id);
            const log = (idx >= 0 ? currentWorkout.logs[idx] : null) as any as ExerciseLogWithId | null;
            if (!log) return null;

            return (
              <ExerciseCard
                key={id}
                log={log}
                exIndex={idx}
                deleteExercise={deleteExercise}
                addSet={addSet}
                deleteSetConfirmed={deleteSetConfirmed}
                updateSet={updateSet}
                toggleComplete={toggleComplete}
                getRestForExercise={getRestForExercise}
                setRestConfigForExerciseId={setRestConfigForExerciseId}
                formatGhost={formatGhost}
                getGhost={getGhost}
                swipeRef={swipeRef}
                restRunning={restRunning}
                restRemaining={restRemaining}
                restTotal={restTotal}
                restAnchor={restAnchor}
                stopRest={stopRest}
                addRest={addRest}
              />
            );
          })}
        </AnimatePresence>

        {/* Bottom CTA: slim */}
        <div className="pt-2 space-y-2" style={{ paddingBottom: `${bottomNavPx + 18}px` }}>
          <button
            type="button"
            onClick={() => setShowExercisePicker(true)}
            className="
              w-full
              rounded-2xl
              border border-[var(--border)]
              bg-[var(--bg-card)]/50
              backdrop-blur-md
              px-4 py-3
              font-black
              text-[11px] uppercase tracking-widest
              flex items-center justify-center gap-2
              text-[var(--text)]
              hover:bg-[var(--bg-card)]/70
              transition-colors
            "
          >
            <Plus size={18} strokeWidth={3} />
            Add exercise
          </button>

          <button
            type="button"
            onClick={openFinish}
            className="
              w-full
              rounded-2xl
              border border-white/10
              bg-[var(--primary)]
              px-4 py-3
              font-black
              text-[11px] uppercase tracking-widest
              flex items-center justify-center gap-2
              text-white
              hover:opacity-95
              transition-opacity
            "
          >
            Finish workout
          </button>
        </div>

        {/* REORDER OVERLAY unchanged */}
        {showReorderTab && (
          <div className="absolute inset-x-0 top-0 z-[60]" style={{ bottom: `${bottomNavPx}px` }}>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />

            <div className="absolute inset-0 bg-[var(--bg)] text-[var(--text)]">
              <div className="sticky top-0 z-[2] px-4 py-3 bg-[var(--bg)]/85 backdrop-blur-xl border-b border-[var(--border)]">
                <h3 className="text-center text-[10px] font-black uppercase tracking-[0.25em] text-[var(--text-muted)]">
                  Reorder Exercises
                </h3>
              </div>

              <div
                ref={reorderScrollRef}
                className="px-4 pt-3 pb-40 overflow-y-auto"
                style={{ WebkitOverflowScrolling: 'touch' as any }}
              >
                <Reorder.Group axis="y" values={order} onReorder={applyOrderToWorkout} className="space-y-2" style={{ touchAction: 'none' }}>
                  <AnimatePresence initial={false}>
                    {order.map((id, pos) => {
                      const logIndex = (currentWorkout.logs as any[]).findIndex((l) => l?.logId === id);
                      const log = (logIndex >= 0 ? currentWorkout.logs[logIndex] : null) as any as ExerciseLogWithId | null;
                      if (!log) return null;

                      return (
                        <OverviewRow
                          key={id}
                          id={id}
                          log={log}
                          pos={pos}
                          count={order.length}
                          logIndex={logIndex}
                          onDeleteAtLogIndex={deleteExercise}
                          onMovePos={moveExercisePos}
                        />
                      );
                    })}
                  </AnimatePresence>
                </Reorder.Group>

                <button
                  type="button"
                  onClick={() => {
                    setShowExercisePicker(true);
                    setShowReorderTab(false);
                  }}
                  className="
                    w-full mt-3
                    rounded-2xl
                    border border-[var(--border)]
                    bg-[var(--bg-card)]/50
                    px-4 py-3
                    font-black
                    text-[11px] uppercase tracking-widest
                    flex items-center justify-center gap-2
                    hover:bg-[var(--bg-card)]/70
                    transition-colors
                  "
                >
                  <Plus size={18} strokeWidth={3} />
                  Add exercise
                </button>
              </div>
            </div>
          </div>
        )}

        </div>
      </div>

      {/* Floating Reorder Toggle */}
      <button
        type="button"
        onClick={() => setShowReorderTab((v) => !v)}
        className={[
          'fixed z-[97] rounded-2xl border shadow-[0_12px_30px_rgba(0,0,0,0.22)] px-4 h-12 flex items-center gap-2 font-black uppercase tracking-widest text-[10px]',
          'will-change-transform translate-z-0 transition-colors',
          reorderSideClass,
          showReorderTab ? 'bg-red-500 text-white border-red-600' : 'bg-[var(--bg-card)] text-[var(--text)] border-[var(--border)]',
        ].join(' ')}
        style={{ bottom: floatingBottom }}
        aria-pressed={showReorderTab}
        aria-label={showReorderTab ? 'Exit reorder mode' : 'Enter reorder mode'}
      >
        <ListOrdered size={16} />
        {showReorderTab ? 'Done' : 'Reorder'}
      </button>

      <ExerciseLibraryModal
        open={showExercisePicker}
        title="ADD EXERCISES"
        exercises={EXERCISES}
        mode="single"
        onPick={(id) => addExercise(id)}
        onClose={() => setShowExercisePicker(false)}
      />

      {restConfigForExerciseId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[260] flex flex-col justify-end p-4">
          <div className="bg-[var(--bg)] text-[var(--text)] rounded-[32px] p-5 w-full max-w-md mx-auto border border-[var(--border)]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black italic">REST PER EXERCISE</h3>
              <button
                onClick={() => setRestConfigForExerciseId(null)}
                className="p-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-full"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[45, 60, 90, 120, 150, 180, 210, 240].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setRestByExerciseId((prev) => ({ ...prev, [restConfigForExerciseId]: s }));
                    setRestConfigForExerciseId(null);
                  }}
                  className={[
                    'rounded-2xl p-4 border font-black uppercase tracking-widest text-[10px] transition-colors',
                    (restByExerciseId[restConfigForExerciseId] ?? DEFAULT_REST) === s
                      ? 'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]'
                      : 'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--glass-strong)]',
                  ].join(' ')}
                >
                  {formatMMSS(s)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setRestConfigForExerciseId(null)}
              className="w-full mt-3 p-3 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] font-black text-[10px] uppercase tracking-widest text-[var(--text-muted)]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showFinish && currentWorkout && (
        <FinishWorkoutModal
          open={showFinish}
          onClose={() => setShowFinish(false)}
          workout={currentWorkout}
          templateIdUsed={currentWorkout.templateIdUsed ?? null}
          onConfirmFinish={onConfirmFinishFromModal}
        />
      )}
    </div>
  );
});

// ---------------------------
// ExerciseCard (slim + wide)
// ---------------------------
type ExerciseCardProps = {
  log: ExerciseLogWithId;
  exIndex: number;

  deleteExercise: (exerciseIndex: number) => void;

  addSet: (exerciseIndex: number) => void;
  deleteSetConfirmed: (exerciseIndex: number, setIndex: number) => void;

  updateSet: (exerciseIndex: number, setIndex: number, data: Partial<SetLog>) => void;
  toggleComplete: (exerciseIndex: number, setIndex: number) => void;

  getRestForExercise: (exerciseId: string) => number;
  setRestConfigForExerciseId: React.Dispatch<React.SetStateAction<string | null>>;

  formatGhost: (exerciseId: string, setIndex: number) => string;
  getGhost: (exerciseId: string, setIndex: number) => { weight?: number; reps?: number };

  swipeRef: React.MutableRefObject<Record<string, SwipeState>>;

  restRunning: boolean;
  restRemaining: number;
  restTotal: number;
  restAnchor: { logId: string; setId: string } | null;

  stopRest: () => void;
  addRest: (delta: number) => void;
};

const ExerciseCard: React.FC<ExerciseCardProps> = (props) => {
  const {
    log,
    exIndex,
    deleteExercise,
    addSet,
    deleteSetConfirmed,
    updateSet,
    toggleComplete,
    getRestForExercise,
    setRestConfigForExerciseId,
    formatGhost,
    getGhost,
    swipeRef,
    restRunning,
    restRemaining,
    restTotal,
    restAnchor,
    stopRest,
    addRest,
  } = props;

  const restForThis = getRestForExercise(log.exerciseId);
  const [armedDeleteKey, setArmedDeleteKey] = useState<string | null>(null);
  const armTimerRef = useRef<number | null>(null);

  const disarm = () => {
    setArmedDeleteKey(null);
    if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = null;
  };

  useEffect(() => {
    return () => {
      if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
    };
  }, []);

  const armDelete = (key: string) => {
    setArmedDeleteKey(key);
    if (armTimerRef.current) window.clearTimeout(armTimerRef.current);
    armTimerRef.current = window.setTimeout(() => {
      setArmedDeleteKey((cur) => (cur === key ? null : cur));
      armTimerRef.current = null;
    }, 1200);
  };

  const isAnchoredExercise = restRunning && restAnchor?.logId === log.logId;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="
        w-full
        rounded-2xl
        border border-[var(--border)]
        bg-[var(--bg-card)]/35
        backdrop-blur-md
        px-3 py-3
        overflow-hidden
      "
      onPointerDown={() => {
        if (armedDeleteKey) disarm();
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <h3 className="flex-1 min-w-0 font-black italic text-[15px] truncate">{log.exerciseName}</h3>

        <button
          type="button"
          data-no-drag
          onClick={(e) => {
            e.stopPropagation();
            setRestConfigForExerciseId(log.exerciseId);
          }}
          className="
            flex items-center gap-1
            h-8 px-2
            rounded-xl
            border border-[var(--border)]
            bg-[var(--bg)]/55
            text-[var(--text-muted)]
            hover:text-[var(--primary)]
            hover:border-[var(--primary)]
            transition-colors
            shrink-0
          "
          aria-label="Rest"
          title="Rest"
        >
          <Timer size={15} />
          <span className="text-[11px] font-black tabular-nums">{formatMMSS(restForThis)}</span>
        </button>

        <button
          type="button"
          data-no-drag
          onClick={(e) => {
            e.stopPropagation();
            deleteExercise(exIndex);
          }}
          className="
            h-8 w-8
            rounded-xl
            border border-[var(--border)]
            bg-[var(--bg)]/55
            flex items-center justify-center
            text-[var(--text-muted)]
            hover:text-red-500 hover:border-red-500
            transition-colors
            shrink-0
          "
          aria-label="Delete exercise"
          title="Delete exercise"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 px-1 pb-1 text-[9px] font-black uppercase text-[var(--text-muted)] opacity-80">
        <span>Set</span>
        <span className="col-span-2">Prev</span>
        <span className="text-center">Kg</span>
        <span className="text-center">Reps</span>
        <span className="text-center">✓</span>
        <span className="text-center">Del</span>
      </div>

      <div className="space-y-1.5">
        {log.sets.map((set, setIndex) => {
          const completed = !!set.isCompleted;
          const ghostLabel = formatGhost(log.exerciseId, setIndex);
          const g = getGhost(log.exerciseId, setIndex);
          const key = set.id;

          const isAnchoredSet = restRunning && restAnchor?.logId === log.logId && restAnchor?.setId === set.id;
          const isArmed = armedDeleteKey === key;

          const onTouchStart: React.TouchEventHandler<HTMLDivElement> = (e) => {
            const t = e.touches[0];
            swipeRef.current[key] = { startX: t.clientX, startY: t.clientY, swiping: false, triggered: false };
          };

          const onTouchMove: React.TouchEventHandler<HTMLDivElement> = (e) => {
            const st = swipeRef.current[key];
            if (!st) return;
            const t = e.touches[0];
            const dx = t.clientX - st.startX;
            const dy = t.clientY - st.startY;

            if (!st.swiping) {
              if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) st.swiping = true;
            }
            if (st.swiping && !st.triggered && dx < -SWIPE_DELETE_PX) {
              st.triggered = true;
              deleteSetConfirmed(exIndex, setIndex);
              disarm();
            }
          };

          const onTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
            delete swipeRef.current[key];
          };

          return (
            <div
              key={set.id}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className={[
                'grid grid-cols-7 gap-2 items-center px-1 py-1.5 rounded-xl transition-colors',
                completed ? 'bg-[var(--primary-soft)]/70' : 'bg-transparent',
              ].join(' ')}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="font-black text-[12px]">{setIndex + 1}</span>

              <span className="col-span-2 text-[9px] font-black uppercase tracking-wider text-[var(--text-muted)] truncate opacity-80">
                {ghostLabel || '—'}
              </span>

              <input
                data-no-drag
                inputMode="decimal"
                value={set.weight === 0 ? '' : String(set.weight)}
                placeholder={g.weight != null ? String(g.weight) : '0'}
                onChange={(e) => {
                  const raw = e.target.value.replace(',', '.');
                  const cleaned = raw.replace(/[^0-9.]/g, '');
                  const num = cleaned === '' ? 0 : Number(cleaned);
                  updateSet(exIndex, setIndex, { weight: Number.isFinite(num) ? num : 0 });
                }}
                className="
                  rounded-lg
                  px-2 py-1.5
                  text-[12px] font-black text-center
                  w-full
                  bg-[var(--bg)]/55
                  border border-[var(--border)]
                  text-[var(--text)]
                  placeholder:text-[var(--text-muted)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]
                "
              />

              <input
                data-no-drag
                inputMode="numeric"
                value={set.reps === 0 ? '' : String(set.reps)}
                placeholder={g.reps != null ? String(g.reps) : '0'}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/[^0-9]/g, '');
                  const num = cleaned === '' ? 0 : parseInt(cleaned, 10);
                  updateSet(exIndex, setIndex, { reps: Number.isFinite(num) ? num : 0 });
                }}
                className="
                  rounded-lg
                  px-2 py-1.5
                  text-[12px] font-black text-center
                  w-full
                  bg-[var(--bg)]/55
                  border border-[var(--border)]
                  text-[var(--text)]
                  placeholder:text-[var(--text-muted)]
                  focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]
                "
              />

              <div className="relative flex justify-center">
                <button
                  data-no-drag
                  type="button"
                  onClick={() => toggleComplete(exIndex, setIndex)}
                  className={[
                    'relative flex justify-center items-center h-9 w-9 rounded-xl transition-all border',
                    completed
                      ? 'bg-[var(--primary)] text-white border-white/10'
                      : 'bg-[var(--bg)]/55 text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--primary)] hover:border-[var(--primary)]',
                  ].join(' ')}
                  aria-label="Toggle set completed"
                >
                  <Check size={16} />
                  {isAnchoredSet && (
                    <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[var(--primary)] text-white text-[10px] font-black shadow tabular-nums">
                      {formatMMSS(restRemaining)}
                    </span>
                  )}
                </button>
              </div>

              <button
                data-no-drag
                type="button"
                onClick={() => {
                  if (isArmed) {
                    deleteSetConfirmed(exIndex, setIndex);
                    disarm();
                    return;
                  }
                  armDelete(key);
                }}
                className={[
                  'flex justify-center items-center h-9 w-9 mx-auto rounded-xl transition-all border',
                  isArmed
                    ? 'bg-red-500/15 text-red-500 border-red-500'
                    : 'bg-[var(--bg)]/55 text-[var(--text-muted)] border-[var(--border)] hover:text-red-500 hover:border-red-500',
                ].join(' ')}
                aria-label={isArmed ? 'Tap again to confirm delete' : 'Delete set'}
                title={isArmed ? 'Tap again to confirm' : 'Delete'}
              >
                <Trash2 size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {isAnchoredExercise && (
        <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--bg)]/55 overflow-hidden">
          <div className="px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Timer size={15} className="text-[var(--primary)]" />
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)]">Rest</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                data-no-drag
                type="button"
                onClick={() => addRest(-30)}
                className="px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
              >
                -30
              </button>

              <span className="text-lg font-black italic text-[var(--primary)] tabular-nums min-w-[58px] text-center">
                {formatMMSS(restRemaining)}
              </span>

              <button
                data-no-drag
                type="button"
                onClick={() => addRest(+30)}
                className="px-2 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[9px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
              >
                +30
              </button>

              <button
                data-no-drag
                type="button"
                onClick={stopRest}
                className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:border-red-500 transition-colors"
                aria-label="Cancel rest"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="h-1.5 bg-[var(--bg)] border-t border-[var(--border)]">
            <div className="h-full bg-[var(--primary)]" style={{ width: `${restTotal > 0 ? (restRemaining / restTotal) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <button
        data-no-drag
        type="button"
        onClick={() => addSet(exIndex)}
        className="
          w-full mt-2
          border border-dashed border-[var(--border)]
          px-3 py-2
          rounded-xl
          text-[var(--text-muted)]
          font-black text-[10px] uppercase tracking-widest
          hover:border-[var(--primary)]
          hover:text-[var(--primary)]
          transition-colors
        "
      >
        + Add set
      </button>
    </motion.div>
  );
};

// ---------------------------
// Reorder Overview Row
// ---------------------------
type OverviewRowProps = {
  id: string;
  log: ExerciseLogWithId;
  pos: number;
  count: number;

  onDeleteAtLogIndex: (logIndex: number) => void;
  logIndex: number;

  onMovePos: (fromPos: number, toPos: number) => void;
};

const OverviewRow: React.FC<OverviewRowProps> = ({ id, log, pos, count, onDeleteAtLogIndex, logIndex, onMovePos }) => {
  const done = log.sets.filter((s) => s.isCompleted).length;
  const total = log.sets.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Reorder.Item
      value={id}
      whileDrag={{ scale: 1.01, zIndex: 999, boxShadow: '0 22px 60px rgba(0,0,0,0.35)' }}
      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden touch-none"
      style={{ touchAction: 'none' }}
    >
      <div className="flex items-center gap-3 px-3 h-14">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">
              {pos + 1}/{count}
            </span>
            <h3 className="font-black italic text-xs truncate">{log.exerciseName}</h3>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="text-[10px] font-black text-[var(--text-muted)]">
              {done}/{total}
            </span>
            <div className="h-1.5 flex-1 bg-[var(--bg)] rounded-full overflow-hidden border border-[var(--border)]">
              <div className="h-full bg-[var(--primary)]" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <button
          type="button"
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onMovePos(pos, pos - 1)}
          disabled={pos === 0}
          className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] disabled:opacity-40 hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
          aria-label="Move up"
        >
          <ChevronUp size={16} />
        </button>

        <button
          type="button"
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onMovePos(pos, pos + 1)}
          disabled={pos === count - 1}
          className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] disabled:opacity-40 hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
          aria-label="Move down"
        >
          <ChevronDown size={16} />
        </button>

        <button
          type="button"
          data-no-drag
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onDeleteAtLogIndex(logIndex)}
          className="w-9 h-9 rounded-xl border border-[var(--border)] bg-[var(--bg)] flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:border-red-500 transition-colors"
          aria-label="Delete exercise"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </Reorder.Item>
  );
};

function computeWorkoutVolume(w: WorkoutSession): number {
  let total = 0;
  for (const log of w.logs) {
    for (const s of log.sets) {
      if (!s.isCompleted) continue;
      total += (s.weight || 0) * (s.reps || 0);
    }
  }
  return total;
}

// Route component stays empty (overlay is used inside AppShell)
const ActiveWorkoutRoute: React.FC = () => null;
export default ActiveWorkoutRoute;
