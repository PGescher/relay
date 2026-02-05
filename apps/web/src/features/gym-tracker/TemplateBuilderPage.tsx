import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save } from 'lucide-react';
import type { WorkoutTemplate, Exercise } from '@relay/shared';
import { ExerciseLibraryModal } from './ExerciseLibraryModal';
import { EXERCISES } from './constants';

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

type TemplateRow = {
  rowId: string; // ✅ allows duplicates of same exerciseId
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  restSec: number;
  sets: Array<{ reps?: number; weight?: number }>;
};

const clampInt = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const TemplateBuilderPage: React.FC = () => {
  const navigate = useNavigate();

  const exercises: Exercise[] = EXERCISES;
  const exerciseById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const [name, setName] = useState('');
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saving, setSaving] = useState(false);

  const token = useMemo(() => localStorage.getItem('relay-token'), []);

  const canSave = name.trim().length > 0 && items.length > 0 && !saving;

  const addExerciseRows = (exerciseIds: string[]) => {
    setItems((prev) => {
      const next = [...prev];

      for (const id of exerciseIds) {
        const ex = exerciseById.get(id);
        if (!ex) continue;

        // ✅ duplicates allowed: every add creates a new rowId
        const targetSets = 3;
        next.push({
          rowId: uid(),
          exerciseId: ex.id,
          exerciseName: ex.name,
          targetSets,
          restSec: 120,
          sets: Array.from({ length: targetSets }).map(() => ({ reps: 8, weight: 0 })),
        });
      }

      return next;
    });
  };

  const removeRow = (rowId: string) => {
    setItems((prev) => prev.filter((p) => p.rowId !== rowId));
  };

  const moveRow = (rowId: string, dir: -1 | 1) => {
    setItems((prev) => {
      const idx = prev.findIndex((p) => p.rowId === rowId);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;

      const copy = [...prev];
      const [it] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, it);
      return copy;
    });
  };

  const setTargetSets = (rowId: string, n: number) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.rowId !== rowId) return p;

        const targetSets = clampInt(Number.isFinite(n) ? n : 1, 1, 20);

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
  };

  const setRestSec = (rowId: string, n: number) => {
    setItems((prev) =>
      prev.map((p) =>
        p.rowId === rowId ? { ...p, restSec: clampInt(Number.isFinite(n) ? n : 0, 0, 600) } : p
      )
    );
  };

  const patchSet = (rowId: string, setIdx: number, patch: { reps?: number; weight?: number }) => {
    setItems((prev) =>
      prev.map((p) => {
        if (p.rowId !== rowId) return p;
        const sets = p.sets.map((s, i) => (i === setIdx ? { ...s, ...patch } : s));
        return { ...p, sets };
      })
    );
  };

  const resetPrefill = (rowId: string) => {
    setItems((prev) =>
      prev.map((p) =>
        p.rowId === rowId
          ? { ...p, sets: Array.from({ length: p.targetSets }).map(() => ({ reps: 8, weight: 0 })) }
          : p
      )
    );
  };

  const createTemplate = async () => {
    const trimmed = name.trim();
    if (!trimmed || items.length === 0) return;

    setSaving(true);
    try {
      const now = Date.now();

      const tpl: WorkoutTemplate = {
        dataVersion: 1,
        id: uid(),
        module: 'GYM',
        name: trimmed,
        createdAt: now,
        updatedAt: now,
        data: {
          exercises: items.map((i) => ({
            exerciseId: i.exerciseId,
            exerciseName: i.exerciseName,
            targetSets: i.targetSets,
            restSec: i.restSec,
            sets: i.sets.map((s) => ({
              reps: s.reps,
              weight: s.weight,
            })),
          })),
        },
      };

      const res = await fetch('/api/templates/gym', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(tpl),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(msg || `Failed to create template (${res.status})`);
      }

      // ✅ go back to templates tab (works even if you later change routes)
      navigate(-1);
    } catch (e: any) {
      alert(e?.message ?? 'Failed to create template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-6 py-8 space-y-6 animate-in fade-in duration-300">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center justify-center h-11 w-11 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--glass-strong)] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="min-w-0 text-center flex-1">
          <div className="text-2xl font-[900] italic text-[var(--text)] truncate">
            TEMPLATE BUILDER<span className="text-[var(--primary)]">.</span>
          </div>
          <div className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
            Full screen editor
          </div>
        </div>

        <button
          onClick={createTemplate}
          disabled={!canSave}
          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-4 py-3 disabled:opacity-60"
        >
          <Save size={16} />
          <span className="text-[10px] font-[900] uppercase tracking-widest">
            {saving ? 'Saving…' : 'Save'}
          </span>
        </button>
      </div>

      {/* Name */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5">
        <label className="block text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-2">
          Name
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Push Day A"
          className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-4 text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
        />
      </div>

      {/* Exercises header */}
      <div className="flex items-center justify-between">
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

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-[var(--text-muted)]">
          Add exercises to build your template.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((it, idx) => (
            <div
              key={it.rowId}
              className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-[900] italic truncate text-[var(--text)]">{it.exerciseName}</div>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => moveRow(it.rowId, -1)}
                      disabled={idx === 0}
                      className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-40"
                      aria-label="Move up"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => moveRow(it.rowId, 1)}
                      disabled={idx === items.length - 1}
                      className="p-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] disabled:opacity-40"
                      aria-label="Move down"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      onClick={() => removeRow(it.rowId)}
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
                    onChange={(e) =>
                      setTargetSets(it.rowId, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 1)
                    }
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 font-black text-sm"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-1">
                    Rest (sec)
                  </label>
                  <input
                    inputMode="numeric"
                    value={String(it.restSec)}
                    onChange={(e) =>
                      setRestSec(it.rowId, parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0)
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
                    onClick={() => resetPrefill(it.rowId)}
                    className="w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-[10px] font-[900] uppercase tracking-widest hover:bg-[var(--glass-strong)]"
                  >
                    Reset 8×0
                  </button>
                </div>
              </div>

              {/* per-set defaults */}
              <div className="mt-5 space-y-2">
                {it.sets.map((s, i) => (
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
                        patchSet(it.rowId, i, { weight: Number.isFinite(num) ? num : 0 });
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
                        patchSet(it.rowId, i, { reps: Number.isFinite(num) ? num : 0 });
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

      {/* Library */}
      <ExerciseLibraryModal
        open={showLibrary}
        title="ADD EXERCISES"
        exercises={exercises}
        mode="multi"
        onConfirm={(ids) => addExerciseRows(ids)}
        onClose={() => setShowLibrary(false)}
      />

      {/* Bottom hint */}
      {!canSave && (
        <div className="text-center text-[10px] font-[900] uppercase tracking-[0.35em] text-[var(--text-muted)] pt-2">
          Add at least 1 exercise and a name to save.
        </div>
      )}
    </div>
  );
};

export default TemplateBuilderPage;
