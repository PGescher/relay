// GymTemplates.tsx (relevante Änderungen)
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Play, Pencil, X } from 'lucide-react';
import type { WorkoutSession, WorkoutTemplate } from '@relay/shared';
import { EXERCISES } from './constants';
import { TemplateBuilderModal } from './TemplateBuilderModal';
import { useNavigate } from 'react-router-dom';

const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

type Props = {
  onStartTemplate: (workout: WorkoutSession) => void;
};

const GymTemplates: React.FC<Props> = ({ onStartTemplate }) => {
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [showBuilder, setShowBuilder] = useState(false);

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
      updatedAt: Date.now(),      // ✅ wichtig bei dir
      status: 'active',
      module: 'GYM',
      templateIdUsed: t.id,
      logs: ex.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        restSecDefault: e.restSec,
        sets: (e.sets?.length ? e.sets : Array.from({ length: e.targetSets }).map(() => ({ reps: 0, weight: 0 }))).map((s) => ({
          id: uid(),
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          isCompleted: false,
          restPlannedSec: e.restSec,
        })),
      })),
    };

    onStartTemplate(workout);
  };

  const createTemplate = async (payload: WorkoutTemplate) => {
    await fetch('/api/templates/gym', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-[900] italic text-[var(--text)]">
          TEMPLATES<span className="text-[var(--primary)]">.</span>
        </h2>

        <button
          //onClick={() => setShowBuilder(true)}
          onClick={() => navigate('/activities/gym/templates/new')}
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
      {/* ✅ Builder*/}
      
      
    </div>
  );
};

export default GymTemplates;

/*

      <TemplateBuilderModal
        open={showBuilder}
        onClose={() => setShowBuilder(false)}
        exercises={EXERCISES}
        onCreate={createTemplate}
      />
*/