// apps/web/src/modules/gym/GymTemplates.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Play, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WorkoutSession, WorkoutTemplate, WorkoutStatus } from '@relay/shared';

import { useApp } from '../../context/AppContext';
import SyncButton from '../../components/ui/SyncButton';

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type Props = {
  onStartTemplate?: (workout: WorkoutSession) => void;
};

const GymTemplates: React.FC<Props> = ({ onStartTemplate }) => {
  const { startSession, requestOverlayExpand } = useApp();


  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [deleteArmedId, setDeleteArmedId] = useState<string | null>(null);

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

  const deleteTemplate = async (id: string) => {
    const res = await fetch(`/api/templates/gym/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to delete template');
    setTemplates((prev) => prev.filter((x) => x.id !== id));
  };

  const startFromTemplate = (t: WorkoutTemplate) => {
    const ex = t.data.exercises;

    const workout: WorkoutSession = {
      dataVersion: 1,
      id: uid(),
      startTime: Date.now(),
      updatedAt: Date.now(),
      status: 'active',       
      module: 'GYM',
      templateIdUsed: t.id,
      logs: ex.map((e) => ({
        exerciseId: e.exerciseId,
        exerciseName: e.exerciseName,
        restSecDefault: e.restSec,
        sets: (e.sets && e.sets.length > 0 
          ? e.sets 
          : Array.from({ length: e.targetSets || 1 }).map(() => ({ reps: 0, weight: 0 }))
        ).map((s) => ({
          id: uid(),
          reps: s.reps ?? 0,
          weight: s.weight ?? 0,
          isCompleted: false,
        })),
      })),
    };

    if (onStartTemplate) {
      onStartTemplate(workout);
      return;
    }

    startSession('GYM', workout);      // ✅ statt setCurrentWorkout
    requestOverlayExpand();            // ✅ optional: overlay direkt auf
    navigate('/activities/gym');       // ✅ oder wohin auch immer dein Dashboard ist
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

        <div className="flex items-center gap-2">
          <SyncButton module="GYM" onDone={() => load()} />
          <button
            onClick={() => navigate('/activities/gym/templates/new')}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-4 py-3"
          >
            <Plus size={16} />
            <span className="text-[10px] font-[900] uppercase tracking-widest">New</span>
          </button>
        </div>
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
            <div key={t.id}>
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-[900] italic text-[var(--text)] truncate">{t.name}</div>
                    <div className="mt-1 text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">
                      {t.data.exercises.length} exercises
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startFromTemplate(t);
                      }}
                      className="inline-flex items-center gap-2 rounded-2xl bg-[var(--primary)] text-white px-4 py-3"
                      aria-label="Start template"
                      title="Start"
                    >
                      <Play size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/activities/gym/templates/${t.id}/edit`);
                      }}
                      className="inline-flex items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-3 text-[var(--text)]"
                      aria-label="Edit template"
                      title="Edit"
                    >
                      <Pencil size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (deleteArmedId !== t.id) {
                          setDeleteArmedId(t.id);
                          window.setTimeout(() => setDeleteArmedId(null), 4000);
                          return;
                        }
                        try {
                          await deleteTemplate(t.id);
                          setDeleteArmedId(null);
                        } catch (err: any) {
                          alert(err?.message ?? 'Delete failed');
                        }
                      }}
                      className={[
                        'inline-flex items-center justify-center rounded-2xl border px-4 py-3 transition-colors',
                        deleteArmedId === t.id
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-[var(--bg-card)] text-[var(--text)] border-[var(--border)]',
                      ].join(' ')}
                      aria-label="Delete template"
                      title={deleteArmedId === t.id ? 'Confirm delete' : 'Delete'}
                    >
                      <Trash2 size={16} />
                      <span className="ml-2 text-[10px] font-[900] uppercase tracking-widest">
                        {deleteArmedId === t.id ? 'Confirm' : 'Delete'}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GymTemplates;
