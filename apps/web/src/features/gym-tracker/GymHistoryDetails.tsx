import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Repeat, Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { WorkoutSession, WorkoutTemplate } from '@relay/shared';

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function volume(w: WorkoutSession): number {
  let total = 0;
  for (const log of w.logs) for (const s of log.sets) if (s.isCompleted) total += (s.weight || 0) * (s.reps || 0);
  return total;
}

const GymHistoryDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { workoutHistory, startSession, requestOverlayExpand } = useApp();

  const fromState = useMemo(() => workoutHistory.find((w) => w.id === id), [workoutHistory, id]);
  const [workout, setWorkout] = useState<WorkoutSession | null>(fromState ?? null);
  const [loading, setLoading] = useState(!fromState);
  const [saving, setSaving] = useState(false);

  // ✅ Fallback: load from API if not in memory (direct URL / refresh)
  useEffect(() => {
    if (fromState) {
      setWorkout(fromState);
      setLoading(false);
      return;
    }
    if (!id) return;

    (async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('relay-token');
        const res = await fetch(`/api/workouts/${id}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error(`Failed to load workout (${res.status})`);
        const data = (await res.json()) as { workout?: WorkoutSession };
        setWorkout(data.workout ?? null);
      } catch (e) {
        console.error(e);
        setWorkout(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, fromState]);

  if (loading) {
    return (
      <div className="p-6 text-[var(--text-muted)] font-bold">
        Loading…
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="p-6">
        <button
          onClick={() => navigate('/activities/gym/history')}
          className="inline-flex items-center gap-2 text-[var(--text)]"
        >
          <ArrowLeft size={18} /> Back
        </button>
        <p className="mt-6 text-[var(--text-muted)] font-bold">Workout not found.</p>
      </div>
    );
  }

  const repeatWorkout = () => {
    const now = Date.now();

    const next: WorkoutSession = {
      dataVersion: 1,
      id: uid(),
      startTime: now,
      updatedAt: now,
      status: 'active',
      module: 'GYM',
      templateIdUsed: null,
      name: workout.name,

      logs: workout.logs.map((l) => ({
        exerciseId: l.exerciseId,
        exerciseName: l.exerciseName,
        restSecDefault: l.restSecDefault,
        notes: l.notes,
        sets: l.sets.map((_s, idx) => ({
          id: uid(),
          reps: 0,
          weight: 0,
          isCompleted: false,
          restPlannedSec: l.sets[idx]?.restPlannedSec ?? l.restSecDefault,
        })),
      })),
    };

    // ✅ Kernel way
    startSession('GYM', next);
    requestOverlayExpand();
    navigate('/activities/gym');
  };

  const saveAsTemplate = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('relay-token');

      const payload: WorkoutTemplate = {
        dataVersion: 1,
        id: uid(),
        module: 'GYM',
        name: workout.name || `Template ${new Date(workout.startTime).toLocaleDateString('en-US')}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        data: {
          exercises: workout.logs.map((l) => ({
            exerciseId: l.exerciseId,
            exerciseName: l.exerciseName,
            targetSets: l.sets.length,
            restSec: l.restSecDefault ?? 120,
            // optional: keep last-set targets as defaults (nice UX)
            sets: l.sets.map((s) => ({ reps: s.reps ?? 0, weight: s.weight ?? 0 })),
          })),
        },
      };

      const res = await fetch('/api/templates/gym', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || `Failed to save template (${res.status})`);
      }

      // ✅ go to templates (or just toast)
      navigate('/activities/gym/templates');
    } catch (e: any) {
      alert(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const durationMin =
    workout.endTime ? Math.max(1, Math.round((workout.endTime - workout.startTime) / 60000)) : undefined;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/activities/gym/history')}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)]"
        >
          <ArrowLeft size={18} />
          <span className="text-[10px] font-[900] uppercase tracking-widest">Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={repeatWorkout}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--primary)] text-white px-3 py-2"
          >
            <Repeat size={16} />
            <span className="text-[10px] font-[900] uppercase tracking-widest">Repeat</span>
          </button>

          <button
            disabled={saving}
            onClick={saveAsTemplate}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[var(--text)] disabled:opacity-60"
          >
            <Save size={16} />
            <span className="text-[10px] font-[900] uppercase tracking-widest">
              {saving ? 'Saving…' : 'Save Template'}
            </span>
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5">
        <h2 className="text-2xl font-[900] italic text-[var(--text)]">
          WORKOUT<span className="text-[var(--primary)]">.</span>
        </h2>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <Stat label="Duration" value={durationMin ? `${durationMin}m` : '—'} />
          <Stat label="Exercises" value={`${workout.logs.length}`} />
          <Stat label="Volume" value={`${volume(workout)}`} />
        </div>

        {workout.rpeOverall != null && (
          <div className="mt-3 text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">
            RPE: <span className="text-[var(--text)]">{workout.rpeOverall}</span>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {workout.logs.map((log) => (
          <div key={log.exerciseId} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="font-[900] italic text-[var(--text)]">{log.exerciseName}</div>
            <div className="mt-3 space-y-2">
              {log.sets.map((s, idx) => (
                <div
                  key={s.id}
                  className="grid grid-cols-4 gap-2 text-[12px] border border-[var(--border)] rounded-2xl p-3"
                >
                  <div className="font-[900]">{idx + 1}</div>
                  <div className="text-[var(--text-muted)]">{s.weight} kg</div>
                  <div className="text-[var(--text-muted)]">{s.reps} reps</div>
                  <div className={s.isCompleted ? 'text-[var(--primary)] font-[900]' : 'text-[var(--text-muted)]'}>
                    {s.isCompleted ? 'DONE' : 'SKIP'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
    <div className="text-[9px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">{label}</div>
    <div className="mt-1 text-lg font-[900] italic text-[var(--text)]">{value}</div>
  </div>
);

export default GymHistoryDetail;
