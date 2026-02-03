import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Play, Pencil, X } from 'lucide-react';
import type { WorkoutSession, WorkoutTemplate } from '@relay/shared';
import { EXERCISES } from './constants';

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

type Props = {
  onStartTemplate: (workout: WorkoutSession) => void;
};

const GymTemplates: React.FC<Props> = ({ onStartTemplate }) => {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [defaultRest, setDefaultRest] = useState(120);

  const token = useMemo(() => localStorage.getItem('relay-token'), []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates/gym', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = (await res.json().catch(() => null)) as { templates?: WorkoutTemplate[] } | null;
      setTemplates(data?.templates ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startFromTemplate = (t: WorkoutTemplate) => {
    const ex = t.data.exercises;

    const workout: WorkoutSession = {
      dataVersion: 1,
      id: uid(),
      startTime: Date.now(),
      status: 'active',
      module: 'GYM',
      templateIdUsed: t.id,
      logs: ex.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        restSecDefault: e.restSec,
        sets: Array.from({ length: e.targetSets }).map(() => ({
          id: uid(),
          reps: 0,
          weight: 0,
          isCompleted: false,
          restPlannedSec: e.restSec,
        })),
      })),
    };

    onStartTemplate(workout);
  };

  const createTemplate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const exercises = selectedExerciseIds
      .map((id) => EXERCISES.find((e) => e.id === id))
      .filter(Boolean)
      .map((e) => ({
        exerciseId: e!.id,
        exerciseName: e!.name,
        targetSets: 3,
        restSec: defaultRest,
      }));

    const payload: WorkoutTemplate = {
      dataVersion: 1,
      id: uid(),
      module: 'GYM',
      name: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: { exercises },
    };

    await fetch('/api/templates/gym', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    setShowCreate(false);
    setName('');
    setSelectedExerciseIds([]);
    setDefaultRest(120);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-[900] italic text-[var(--text)]">
          TEMPLATES<span className="text-[var(--primary)]">.</span>
        </h2>

        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-4 py-3"
        >
          <Plus size={16} />
          <span className="text-[10px] font-[900] uppercase tracking-widest">New</span>
        </button>
      </div>

      {loading ? (
        <div className="text-[var(--text-muted)] font-bold">Loading…</div>
      ) : templates.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-[var(--text-muted)]">
          No templates yet. Create your first one.
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-[900] italic text-[var(--text)] truncate">{t.name}</div>
                <div className="mt-1 text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">
                  {t.data.exercises.length} exercises
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => startFromTemplate(t)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-4 py-3"
                >
                  <Play size={16} />
                  <span className="text-[10px] font-[900] uppercase tracking-widest">Start</span>
                </button>

                <button
                  disabled
                  className="inline-flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text-muted)]"
                  title="Edit coming soon"
                >
                  <Pencil size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
          <div className="w-full max-w-md rounded-[40px] border border-[var(--border)] bg-[var(--bg)] p-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-5">
              <div className="text-xl font-[900] italic text-[var(--text)]">NEW TEMPLATE</div>
              <button
                onClick={() => setShowCreate(false)}
                className="p-2 rounded-full bg-[var(--bg-card)] border border-[var(--border)]"
              >
                <X size={18} />
              </button>
            </div>

            <label className="block text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-2">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Push Day A"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 text-[var(--text)] placeholder:text-[var(--text-muted)]"
            />

            <div className="mt-5">
              <label className="block text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Default Rest (seconds)
              </label>
              <input
                inputMode="numeric"
                value={String(defaultRest)}
                onChange={(e) => setDefaultRest(parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)}
                className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 text-[var(--text)]"
              />
            </div>

            <div className="mt-5">
              <div className="text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-2">
                Exercises
              </div>
              <div className="max-h-56 overflow-y-auto space-y-2">
                {EXERCISES.map((e) => {
                  const active = selectedExerciseIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        setSelectedExerciseIds((prev) =>
                          prev.includes(e.id) ? prev.filter((x) => x !== e.id) : [...prev, e.id]
                        );
                      }}
                      className={[
                        "w-full text-left rounded-2xl p-4 border transition-colors",
                        active
                          ? "bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]"
                          : "bg-[var(--bg-card)] border-[var(--border)] text-[var(--text)]",
                      ].join(' ')}
                    >
                      <div className="font-[900]">{e.name}</div>
                      <div className="text-[10px] font-[900] uppercase tracking-widest opacity-60">{e.muscleGroup}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={createTemplate}
              className="mt-6 w-full rounded-2xl bg-[var(--primary)] text-white py-4 font-[900] uppercase tracking-widest text-[10px]"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GymTemplates;
