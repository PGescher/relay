import React, { useEffect, useState } from 'react';
import { Plus, Play, Trash2 } from 'lucide-react';
import type { WorkoutSession } from '@relay/shared';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';

type ApiTemplateRow = {
  id: string;
  name: string;
  data: any;
};

export function TemplatesPanel() {
  const [templates, setTemplates] = useState<ApiTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);

  const { setCurrentWorkout } = useApp();
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('relay-token');
      const res = await fetch('/api/templates/gym', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => null);
      setTemplates(json?.templates ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createTemplate = async () => {
    const name = prompt('Template name?');
    if (!name) return;

    const token = localStorage.getItem('relay-token');
    await fetch('/api/templates/gym', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({
        module: 'GYM',
        name,
        logs: [],
      }),
    });

    await load();
  };

  const startTemplate = (t: ApiTemplateRow) => {
    const data = t.data;
    const logs = (data?.logs ?? []) as Array<any>;

    const w: WorkoutSession = {
      id: (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      module: 'GYM',
      status: 'active',
      startTime: Date.now(),
      templateIdUsed: t.id,
      dataVersion: 1,
      logs: logs.map((l) => ({
        exerciseId: l.exerciseId,
        exerciseName: l.exerciseName,
        restSecDefault: l.restSecDefault,
        sets: Array.from({ length: Math.max(1, l.targetSets ?? 1) }).map(() => ({
          id: (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          reps: 0,
          weight: 0,
          isCompleted: false,
          restPlannedSec: l.restSecDefault,
        })),
      })),
    };

    setCurrentWorkout(w);
    navigate('/activities/gym/active');
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete template?')) return;
    const token = localStorage.getItem('relay-token');
    await fetch(`/api/templates/gym/${id}`, {
      method: 'DELETE',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    await load();
  };

  if (loading) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-white/60">
        <p className="text-[10px] font-[900] uppercase tracking-[0.45em]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={createTemplate}
        className="w-full rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-5 hover:bg-white/10 transition-colors flex items-center justify-center gap-2 text-[10px] font-[900] uppercase tracking-widest text-white/80"
      >
        <Plus size={16} />
        Create Template
      </button>

      {templates.map((t) => (
        <div
          key={t.id}
          className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-5 flex items-center justify-between gap-4"
        >
          <div>
            <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-white/35">Template</p>
            <h3 className="mt-2 text-lg font-[900] italic uppercase tracking-tight text-white">{t.name}</h3>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => startTemplate(t)}
              className="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Start template"
            >
              <Play size={16} className="text-white" />
            </button>

            <button
              onClick={() => deleteTemplate(t.id)}
              className="p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
              aria-label="Delete template"
            >
              <Trash2 size={16} className="text-white/70" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
