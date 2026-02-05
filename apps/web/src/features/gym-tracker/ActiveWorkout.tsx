import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { EXERCISES } from './constants';
import { Plus, Check, ChevronDown, X, Timer, Trash2, Save } from 'lucide-react';
import type { ExerciseLog, SetLog, WorkoutEvent, WorkoutSession, WorkoutTemplate } from '@relay/shared';
import { saveWorkoutDraft, clearWorkoutDraft, loadLastWorkoutDraft } from './workoutDraft';
import { FinishWorkoutModal } from './FinishWorkoutModal';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';

import { useAuth } from '../../context/AuthContext';
import { apiPushGymComplete } from '../../data/apiClient';
import { enqueuePending } from '../../data/sync/pendingQueue';
import { upsertWorkouts } from '../../data/workoutCache';
import { syncNow } from '../../data/sync/syncManager';



const REST_STORAGE_KEY = 'relay:gym:restByExerciseId:v1';

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

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

const ActiveWorkout: React.FC = () => {
  const { currentWorkout, setCurrentWorkout, setWorkoutHistory, workoutHistory } = useApp();
  const navigate = useNavigate();

  const { user, token } = useAuth();

  const [timer, setTimer] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // In-memory events
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

  // Rest countdown state
  const [restRemaining, setRestRemaining] = useState<number>(0);
  const [restTotal, setRestTotal] = useState<number>(0);
  const [restRunning, setRestRunning] = useState<boolean>(false);
  const restIntervalRef = useRef<number | null>(null);
  const restStartedAtRef = useRef<number | null>(null);

  // Per-exercise rest config persisted
  const DEFAULT_REST = 120;
  const [restByExerciseId, setRestByExerciseId] = useState<Record<string, number>>({});
  const [restConfigForExerciseId, setRestConfigForExerciseId] = useState<string | null>(null);

  // Swipe tracking per set.id
  const swipeRef = useRef<Record<string, SwipeState>>({});

  // Finish modal
  const [showFinish, setShowFinish] = useState(false);
  const [incompletePolicy, setIncompletePolicy] = useState<IncompletePolicy>('delete');
  const [rpeOverall, setRpeOverall] = useState<number>(8);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [updateTemplate, setUpdateTemplate] = useState(false);
  const [finishing, setFinishing] = useState(false);

  // Restore draft ONCE if someone lands here without memory state
  useEffect(() => {
    if (currentWorkout) return;

    const draft = loadLastWorkoutDraft();
    if (draft?.workout?.status === 'active') {
      setCurrentWorkout(draft.workout);
      setEvents(draft.events ?? []);
      setRestByExerciseId(draft.restByExerciseId ?? {});
      return;
    }

    // no workout at all → back
    navigate('/activities/gym', { replace: true });
  }, [currentWorkout, setCurrentWorkout, navigate]);

  // Load persisted rest config
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') setRestByExerciseId(parsed);
    } catch {
      // ignore
    }
  }, []);

  // Persist rest config
  useEffect(() => {
    try {
      localStorage.setItem(REST_STORAGE_KEY, JSON.stringify(restByExerciseId));
    } catch {
      // ignore
    }
  }, [restByExerciseId]);

  // Workout timer
  useEffect(() => {
    if (!currentWorkout) return;
    const tick = () => setTimer(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [currentWorkout]);

  // Rest countdown
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

  const stopRest = () => {
    setRestRunning(false);
    setRestRemaining(0);
    setRestTotal(0);

    if (restIntervalRef.current) window.clearInterval(restIntervalRef.current);
    restIntervalRef.current = null;

    const started = restStartedAtRef.current;
    if (started) {
      const actualSec = Math.max(0, Math.round((Date.now() - started) / 1000));
      appendEvent('rest_stopped', { actualSec });
    }
    restStartedAtRef.current = null;
  };

  // --- Ghost lookup from latest completed workout per exerciseId ---
  const lastLogByExerciseId = useMemo(() => {
    const completed = workoutHistory.filter((w) => w.status === 'completed');
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

  // Rest helper
  const getRestForExercise = (exerciseId: string) => restByExerciseId[exerciseId] ?? DEFAULT_REST;

  const ensureRestEntry = (exerciseId: string) => {
    setRestByExerciseId((prev) => (prev[exerciseId] ? prev : { ...prev, [exerciseId]: DEFAULT_REST }));
  };

  const updateSet = (exerciseIndex: number, setIndex: number, data: Partial<SetLog>) => {
    if (!currentWorkout) return;

    const newLogs = [...currentWorkout.logs];
    const current = newLogs[exerciseIndex].sets[setIndex];

    const now = Date.now();
    const startedEditingAt =
      (data.weight != null || data.reps != null) && !current.startedEditingAt ? now : current.startedEditingAt;

    newLogs[exerciseIndex].sets[setIndex] = { ...current, ...data, startedEditingAt };

    setCurrentWorkout({ ...currentWorkout, logs: newLogs });

    appendEvent('set_value_changed', {
      exerciseId: newLogs[exerciseIndex].exerciseId,
      setId: current.id,
      patch: data,
    });
  };

  const addExercise = (exerciseId: string) => {
    if (!currentWorkout) return;
    const exercise = EXERCISES.find((e) => e.id === exerciseId);
    if (!exercise) return;

    ensureRestEntry(exercise.id);

    const planned = getRestForExercise(exercise.id);

    const newLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      restSecDefault: planned,
      sets: [
        {
          id: uid(),
          reps: 0,
          weight: 0,
          isCompleted: false,
          restPlannedSec: planned,
        },
      ],
    };

    setCurrentWorkout({ ...currentWorkout, logs: [...currentWorkout.logs, newLog] });
    appendEvent('exercise_added', { exerciseId: exercise.id, name: exercise.name });
    setShowExercisePicker(false);
  };

  const deleteExercise = (exerciseIndex: number) => {
    if (!currentWorkout) return;
    const log = currentWorkout.logs[exerciseIndex];
    if (!confirm(`Delete ${log.exerciseName}?`)) return;

    const newLogs = currentWorkout.logs.filter((_, i) => i !== exerciseIndex);
    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
    appendEvent('exercise_deleted', { exerciseId: log.exerciseId, name: log.exerciseName });
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

  const deleteSet = (exerciseIndex: number, setIndex: number) => {
    if (!currentWorkout) return;
    const ex = currentWorkout.logs[exerciseIndex];
    const set = ex.sets[setIndex];

    const newLogs = [...currentWorkout.logs];
    newLogs[exerciseIndex].sets = newLogs[exerciseIndex].sets.filter((_, i) => i !== setIndex);

    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
    appendEvent('set_deleted', { exerciseId: ex.exerciseId, setId: set.id });
  };

  const toggleComplete = (exerciseIndex: number, setIndex: number) => {
    if (!currentWorkout) return;

    const log = currentWorkout.logs[exerciseIndex];
    const set = log.sets[setIndex];
    const next = !set.isCompleted;

    // ghost fill if completing and fields empty
    const ghost = getGhost(log.exerciseId, setIndex);

    let nextWeight = set.weight;
    let nextReps = set.reps;

    if (next) {
      if ((nextWeight === 0 || Number.isNaN(nextWeight)) && ghost.weight != null) nextWeight = ghost.weight;
      if ((nextReps === 0 || Number.isNaN(nextReps)) && ghost.reps != null) nextReps = ghost.reps;
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

    if (next) startRest(getRestForExercise(log.exerciseId));
    else stopRest();
  };

  const incompleteCount = useMemo(() => {
    if (!currentWorkout) return 0;
    let n = 0;
    for (const log of currentWorkout.logs) for (const s of log.sets) if (!s.isCompleted) n++;
    return n;
  }, [currentWorkout]);

  const openFinish = () => {
    if (!currentWorkout) return;
    stopRest();
    setShowFinish(true);

    // nice defaults:
    setSaveAsTemplate(false);
    setUpdateTemplate(false);
    setTemplateName('');
    setRpeOverall(8);
    setIncompletePolicy(incompleteCount > 0 ? 'delete' : 'keep');
  };

  const applyIncompletePolicy = (w: WorkoutSession, policy: IncompletePolicy): WorkoutSession => {
    if (policy === 'keep') return w;

    const now = Date.now();

    const logs = w.logs
      .map((log) => {
        if (policy === 'delete') {
          const kept = log.sets.filter((s) => s.isCompleted);
          return { ...log, sets: kept };
        }

        // complete: mark incomplete sets as complete (use ghost if missing)
        const sets = log.sets.map((s, idx) => {
          if (s.isCompleted) return s;

          const g = getGhost(log.exerciseId, idx);
          const weight = (s.weight === 0 && g.weight != null) ? g.weight : s.weight;
          const reps = (s.reps === 0 && g.reps != null) ? g.reps : s.reps;

          return {
            ...s,
            weight,
            reps,
            isCompleted: true,
            completedAt: now,
          };
        }); 
        return { ...log, sets };
      })
      .filter((log) => log.sets.length > 0);

    return { ...w, logs };
  };


  const createOrUpdateTemplate = async (finished: WorkoutSession) => {
    const token = localStorage.getItem('relay-token');

    // Save new template
    if (saveAsTemplate) {
      const name = templateName.trim() || `Template ${new Date(finished.startTime).toLocaleDateString('en-US')}`;

      const payload: WorkoutTemplate = {
        dataVersion: 1,
        id: uid(),
        module: 'GYM',
        name,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: {
          exercises: finished.logs.map((l) => ({
            exerciseId: l.exerciseId,
            exerciseName: l.exerciseName,
            targetSets: l.sets.length,
            restSec: l.restSecDefault ?? 120,
            sets: l.sets.map((s) => ({
                reps: s.reps ?? 0,
                weight: s.weight ?? 0,
              })),
          })),
        },
      };

      await fetch('/api/templates/gym', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      return;
    }

    // Update used template
    if (updateTemplate && finished.templateIdUsed) {
      const payload = {
        name: null,
        dataVersion: 1,
        data: {
          exercises: finished.logs.map((l) => ({
            exerciseId: l.exerciseId,
            exerciseName: l.exerciseName,
            targetSets: l.sets.length,
            restSec: l.restSecDefault ?? 120,
            sets: l.sets.map((s) => ({
                reps: s.reps ?? 0,
                weight: s.weight ?? 0,
              })),
          })),
        },
      };

      await fetch(`/api/templates/gym/${finished.templateIdUsed}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    }
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
      status: 'completed',
      durationSec: Math.round((now - currentWorkout.startTime) / 1000),
      rpeOverall: opts.rpeOverall,
    };

    const finished = applyIncompletePolicy(baseFinished, opts.policy);

    const totalVolume = computeWorkoutVolume(finished);
    const finished2: WorkoutSession = { ...finished, totalVolume };

    appendEvent('workout_finished', { totalVolume, rpeOverall: opts.rpeOverall, incompletePolicy: opts.policy });

    const completePayload = { workout: finished2, events, restByExerciseId };

    // Always store locally for offline history
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

    // Templates: queue offline if needed
    try {
      if (opts.saveAsTemplate && user?.id) {
        const name = (opts.templateName?.trim() || `Template ${new Date(finished2.startTime).toLocaleDateString('en-US')}`);

        const body = {
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
              sets: l.sets.map((s) => ({
              reps: s.reps ?? 0,
              weight: s.weight ?? 0,
              })),
            })),
          },
        };

        const payload = {
          method: 'POST',
          endpoint: '/api/templates/gym',
          body,
        };

        if (pushed && token) {
          // best-effort immediately
          await fetch(payload.endpoint, {
            method: payload.method,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload.body),
          }).catch(() => {
            // queue if fails
            // eslint-disable-next-line @typescript-eslint/no-var-requires
          });
        } else {
          // queue offline
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
              sets: l.sets.map((s) => ({
                reps: s.reps ?? 0,
                weight: s.weight ?? 0,
              })),
            })),
          },
        };

        const payload = {
          method: 'PUT',
          endpoint: `/api/templates/gym/${finished2.templateIdUsed}`,
          body,
        };

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

    // Draft is done; don’t resurrect
    clearWorkoutDraft(finished2.id);

    setWorkoutHistory([finished2, ...workoutHistory]);
    setCurrentWorkout(null);
    setShowFinish(false);
    setFinishing(false);

    // optional: after successful push, refresh cache from server
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



  const cancelWorkout = () => {
    if (!currentWorkout) return;
    stopRest();

    if (confirm('Cancel workout? Data will be lost.')) {
      appendEvent('workout_cancelled', {});
      clearWorkoutDraft(currentWorkout.id);
      setCurrentWorkout(null);
      navigate('/activities/gym', { replace: true });
    }
  };

  // Draft persistence during workout
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

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] animate-in slide-in-from-right duration-300">
      {/* SUB-HEADER */}
      <div className="fixed top-16 left-0 right-0 z-[90] bg-[var(--primary)] text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <button
          type="button"
          onClick={cancelWorkout}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
          aria-label="Cancel workout"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">Duration</span>
            <span className="text-lg font-black italic leading-none">{formatTime(timer)}</span>
          </div>

          <div className="w-px h-8 bg-white/20" />

          <div className="flex flex-col items-start">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] opacity-80">Status</span>
            <span className="text-sm font-black italic leading-none uppercase">Live Session</span>
          </div>
        </div>

        <button
          type="button"
          onClick={openFinish}
          className="bg-white text-[var(--primary)] px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:bg-white/90 active:scale-95 transition-all"
        >
          Finish
        </button>
      </div>

      {/* CONTENT */}
      <div className="p-6 pt-20 space-y-6 pb-40">
        <div className="space-y-6">
          {currentWorkout.logs.map((log, exIndex) => {
            const restForThis = getRestForExercise(log.exerciseId);

            return (
              <div
                key={`${log.exerciseId}-${exIndex}`}
                className="bg-[var(--glass)] backdrop-blur-xl border border-[var(--border)] rounded-3xl p-5 shadow-[0_12px_32px_rgba(0,0,0,0.10)]"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4 gap-4">
                  <div className="min-w-0">
                    <h3 className="font-black italic text-lg truncate">{log.exerciseName}</h3>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRestConfigForExerciseId(log.exerciseId)}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--primary)] hover:border-[var(--primary)] transition-colors"
                      >
                        <Timer size={14} />
                        Rest {formatMMSS(restForThis)}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteExercise(exIndex)}
                        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)] hover:text-red-500 hover:border-red-500 transition-colors"
                        aria-label="Delete exercise"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>

                  <button type="button" className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors mt-1">
                    <ChevronDown size={20} />
                  </button>
                </div>

                {/* Table */}
                <div className="space-y-2">
                  <div className="grid grid-cols-6 gap-2 px-2 text-[10px] font-black uppercase text-[var(--text-muted)]">
                    <span>Set</span>
                    <span className="col-span-2">Prev</span>
                    <span>Weight</span>
                    <span>Reps</span>
                    <span className="text-center">Done</span>
                  </div>

                  {log.sets.map((set, setIndex) => {
                    const completed = !!set.isCompleted;
                    const ghostLabel = formatGhost(log.exerciseId, setIndex);
                    const g = getGhost(log.exerciseId, setIndex);

                    const key = set.id;

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
                        deleteSet(exIndex, setIndex);
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
                          "grid grid-cols-6 gap-2 items-center p-2 rounded-xl transition-colors",
                          completed ? "bg-[var(--primary-soft)]" : "bg-transparent",
                        ].join(" ")}
                      >
                        <span className="font-black text-sm">{setIndex + 1}</span>

                        <span className="col-span-2 text-[10px] font-black uppercase tracking-wider text-[var(--text-muted)] truncate">
                          {ghostLabel || '—'}
                        </span>

                        {/* Weight */}
                        <input
                          inputMode="decimal"
                          value={set.weight === 0 ? '' : String(set.weight)}
                          placeholder={g.weight != null ? String(g.weight) : '0'}
                          onChange={(e) => {
                            const raw = e.target.value.replace(',', '.');
                            const cleaned = raw.replace(/[^0-9.]/g, '');
                            const num = cleaned === '' ? 0 : Number(cleaned);
                            updateSet(exIndex, setIndex, { weight: Number.isFinite(num) ? num : 0 });
                          }}
                          className="rounded-lg p-2 text-xs font-bold text-center w-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                        />

                        {/* Reps */}
                        <input
                          inputMode="numeric"
                          value={set.reps === 0 ? '' : String(set.reps)}
                          placeholder={g.reps != null ? String(g.reps) : '0'}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/[^0-9]/g, '');
                            const num = cleaned === '' ? 0 : parseInt(cleaned, 10);
                            updateSet(exIndex, setIndex, { reps: Number.isFinite(num) ? num : 0 });
                          }}
                          className="rounded-lg p-2 text-xs font-bold text-center w-full bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
                        />

                        {/* INLINE ✅ */}
                        <button
                          type="button"
                          onClick={() => toggleComplete(exIndex, setIndex)}
                          className={[
                            "flex justify-center items-center h-10 w-10 mx-auto rounded-xl transition-all border",
                            completed
                              ? "bg-[var(--primary)] text-white border-white/10"
                              : "bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border)] hover:text-[var(--primary)] hover:border-[var(--primary)]",
                          ].join(" ")}
                          aria-label="Toggle set completed"
                        >
                          <Check size={18} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => addSet(exIndex)}
                  className="w-full mt-4 border-2 border-dashed border-[var(--border)] p-3 rounded-xl text-[var(--text-muted)] font-black text-xs uppercase tracking-widest hover:border-[var(--primary)] hover:text-[var(--primary)] transition-all"
                >
                  + ADD SET
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => setShowExercisePicker(true)}
            className="w-full bg-[var(--primary-soft)] text-[var(--primary)] p-6 rounded-[24px] font-black flex items-center justify-center gap-2 border border-[var(--border)] hover:bg-[var(--primary-soft)]/80 transition-colors"
          >
            <Plus size={20} strokeWidth={3} />
            ADD EXERCISE
          </button>
        </div>
      </div>

      {/* Rest countdown bar */}
      {restRunning && (
        <div className="fixed bottom-[84px] left-4 right-4 z-[95] max-w-xl mx-auto">
          <button
            type="button"
            onClick={stopRest}
            className="w-full rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] shadow-[0_12px_32px_rgba(0,0,0,0.16)] overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--text-muted)]">Resting</span>
              <span className="text-lg font-black italic text-[var(--primary)]">{formatMMSS(restRemaining)}</span>
            </div>
            <div
              className="h-2 bg-[var(--primary)]"
              style={{ width: `${restTotal > 0 ? (restRemaining / restTotal) * 100 : 0}%` }}
            />
          </button>
        </div>
      )}

      {/* Exercise Picker Modal */}
      <ExerciseLibraryModal
        open={showExercisePicker}
        title="ADD EXERCISES"
        exercises={EXERCISES}
        mode="single"
        onPick={(id) => addExercise(id)}   // <- deine bestehende Funktion
        onClose={() => setShowExercisePicker(false)}
      />
      {/* Rest config modal */}
      {restConfigForExerciseId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex flex-col justify-end p-4">
          <div className="bg-[var(--bg)] text-[var(--text)] rounded-[40px] p-6 w-full max-w-md mx-auto border border-[var(--border)] animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-black italic">REST PER EXERCISE</h3>
              <button onClick={() => setRestConfigForExerciseId(null)} className="p-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-full">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[45, 60, 90, 120, 150, 180, 210, 240].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setRestByExerciseId((prev) => ({ ...prev, [restConfigForExerciseId]: s }));
                    setRestConfigForExerciseId(null);
                  }}
                  className={[
                    "rounded-2xl p-4 border font-black uppercase tracking-widest text-[10px] transition-colors",
                    (restByExerciseId[restConfigForExerciseId] ?? DEFAULT_REST) === s
                      ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]"
                      : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text)] hover:bg-[var(--glass-strong)]",
                  ].join(" ")}
                >
                  {formatMMSS(s)}
                </button>
              ))}
            </div>

            <button
              onClick={() => setRestConfigForExerciseId(null)}
              className="w-full mt-5 p-4 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] font-black text-[10px] uppercase tracking-widest text-[var(--text-muted)]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Finish Modal */}
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
};

const RadioRow: React.FC<{ active: boolean; onClick: () => void; title: string }> = ({ active, onClick, title }) => (
  <button
    onClick={onClick}
    className={[
      "w-full text-left rounded-2xl border px-4 py-3 transition-colors",
      active ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]" : "bg-[var(--bg)] border-[var(--border)] text-[var(--text)]",
    ].join(' ')}
  >
    <div className="text-[11px] font-[900] uppercase tracking-widest">{title}</div>
  </button>
);

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

export default ActiveWorkout;
