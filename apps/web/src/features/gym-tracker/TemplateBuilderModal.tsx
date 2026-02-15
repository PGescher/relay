import React, { useMemo, useState } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import type { Exercise, WorkoutTemplate } from '@relay/shared';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

type TemplateExercise = {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  restSec: number;
  sets?: Array<{ reps?: number; weight?: number }>;
};

type Props = {
  open: boolean;
  onClose: () => void;

  exercises: Exercise[];
  onCreate: (tpl: WorkoutTemplate) => Promise<void>;
  module?: 'GYM';
};

export function TemplateBuilderModal({ open, onClose, exercises, onCreate, module = 'GYM' }: Props) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateExercise[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);

  const selectedIds = useMemo(() => items.map((i) => i.exerciseId), [items]);

  if (!open) return null;

  function addExerciseById(exerciseId: string) {
    const ex = exercises.find((e) => e.id === exerciseId);
    if (!ex) return;

    setItems((prev) => {
      // allow duplicates? usually no
      if (prev.some((p) => p.exerciseId === exerciseId)) return prev;
      return [
        ...prev,
        {
          exerciseId: ex.id,
          exerciseName: ex.name,
          targetSets: 3,
          restSec: 120,
          sets: Array.from({ length: 3 }).map(() => ({ reps: 8, weight: 0 })),
        },
      ];
    });
  }

  function removeItem(exerciseId: string) {
    setItems((prev) => prev.filter((p) => p.exerciseId !== exerciseId));
  }

  function move(exerciseId: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.exerciseId === exerciseId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [it] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, it);
      return copy;
    });
  }

  function setTargetSets(exerciseId: string, n: number) {
    setItems((prev) =>
      prev.map((p) => {
        if (p.exerciseId !== exerciseId) return p;
        const targetSets = Math.max(1, Math.min(20, n || 1));

        const old = p.sets ?? [];
        const nextSets =
          old.length === targetSets
            ? old
            : old.length < targetSets
              ? [...old, ...Array.from({ length: targetSets - old.length }).map(() => ({ reps: 8, weight: 0 }))]
              : old.slice(0, targetSets);

        return { ...p, targetSets, sets: nextSets };
      })
    );
  }

  function patchSet(exerciseId: string, setIdx: number, patch: { reps?: number; weight?: number }) {
    setItems((prev) =>
      prev.map((p) => {
        if (p.exerciseId !== exerciseId) return p;
        const sets = (p.sets ?? []).map((s, i) => (i === setIdx ? { ...s, ...patch } : s));
        return { ...p, sets };
      })
    );
  }

  async function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!items.length) return;

    const now = Date.now();

    const tpl: WorkoutTemplate = {
      dataVersion: 1,
      id: uid(),
      module,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      data: {
        exercises: items.map((i) => ({
          exerciseId: i.exerciseId,
          exerciseName: i.exerciseName,
          targetSets: i.targetSets,
          restSec: i.restSec,
          sets: i.sets?.map((s) => ({
            reps: s.reps,
            weight: s.weight,
          })),
        })),
      },
    };

    await onCreate(tpl);

    // reset
    setName('');
    setItems([]);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4">
      <div className="w-full max-w-md rounded-[40px] border border-[var(--border)] bg-[var(--bg)] p-6 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-5">
          <div className="text-xl font-[900] italic text-[var(--text)]">NEW TEMPLATE</div>
          <button
            onClick={onClose}
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

        <div className="mt-5 flex items-center justify-between">
          <div className="text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">
            Exercises ({items.length})
          </div>
          <button
            onClick={() => setShowLibrary(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-4 py-3"
          >
            <Plus size={16} />
            <span className="text-[10px] font-[900] uppercase tracking-widest">Add</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-5 text-[var(--text-muted)]">
            Add exercises to build your template.
          </div>
        ) : (
          <div className="mt-4 space-y-3 max-h-[45vh] overflow-y-auto pr-1">
            {items.map((it, idx) => (
              <div
                key={it.exerciseId}
                className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-[900] italic truncate">{it.exerciseName}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => move(it.exerciseId, -1)}
                        disabled={idx === 0}
                        className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-40"
                        aria-label="Move up"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => move(it.exerciseId, 1)}
                        disabled={idx === items.length - 1}
                        className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-40"
                        aria-label="Move down"
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        onClick={() => removeItem(it.exerciseId)}
                        className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:border-red-500 hover:text-red-500 transition-colors"
                        aria-label="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="w-28">
                    <label className="block text-[9px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      Sets
                    </label>
                    <input
                      inputMode="numeric"
                      value={String(it.targetSets)}
                      onChange={(e) => setTargetSets(it.exerciseId, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10))}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 font-black text-sm"
                    />
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      Rest (sec)
                    </label>
                    <input
                      inputMode="numeric"
                      value={String(it.restSec)}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((p) =>
                            p.exerciseId === it.exerciseId
                              ? { ...p, restSec: parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0 }
                              : p
                          )
                        )
                      }
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 font-black text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      Prefill
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // quick preset: reps 8, weight 0 for all sets
                        setItems((prev) =>
                          prev.map((p) =>
                            p.exerciseId === it.exerciseId
                              ? {
                                  ...p,
                                  sets: Array.from({ length: p.targetSets }).map(() => ({ reps: 8, weight: 0 })),
                                }
                              : p
                          )
                        );
                      }}
                      className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[10px] font-[900] uppercase tracking-widest hover:bg-[var(--glass-strong)]"
                    >
                      Reset 8×0
                    </button>
                  </div>
                </div>

                {/* per-set defaults */}
                <div className="mt-4 space-y-2">
                  {(it.sets ?? Array.from({ length: it.targetSets }).map(() => ({ reps: 8, weight: 0 }))).map((s, i) => (
                    <div key={i} className="grid grid-cols-6 gap-2 items-center">
                      <div className="col-span-1 text-[10px] font-black uppercase text-[var(--text-muted)]">
                        {i + 1}
                      </div>

                      <input
                        inputMode="decimal"
                        value={s.weight ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value.replace(',', '.').replace(/[^0-9.]/g, '');
                          const num = raw === '' ? 0 : Number(raw);
                          patchSet(it.exerciseId, i, { weight: Number.isFinite(num) ? num : 0 });
                        }}
                        className="col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 font-black text-sm"
                        placeholder="Weight"
                      />

                      <input
                        inputMode="numeric"
                        value={s.reps ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value.replace(/[^0-9]/g, '');
                          const num = raw === '' ? 0 : parseInt(raw, 10);
                          patchSet(it.exerciseId, i, { reps: Number.isFinite(num) ? num : 0 });
                        }}
                        className="col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 font-black text-sm"
                        placeholder="Reps"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={create}
          disabled={!name.trim() || items.length === 0}
          className="mt-6 w-full rounded-2xl bg-[var(--primary)] text-white py-4 font-[900] uppercase tracking-widest text-[10px] disabled:opacity-60"
        >
          Create
        </button>

        <ExerciseLibraryModal
          open={showLibrary}
          title="ADD EXERCISES"
          exercises={exercises}
          mode="multi"
          onConfirm={(ids) => {
            // ✅ duplicates allowed: einfach jedes id “append”en
            ids.forEach((id) => addExerciseById(id));
          }}
          onClose={() => setShowLibrary(false)}
        />
      </div>
    </div>
  );
}
