import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Repeat, Save } from 'lucide-react';
import type { WorkoutSession } from '@relay/shared';
import { useApp } from '../../context/AppContext';

export default function WorkoutDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { setCurrentWorkout } = useApp();

  const [workout, setWorkout] = useState<WorkoutSession | null>(null);

  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('relay-token');
      const res = await fetch(`/api/workouts/gym/${id}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const json = await res.json().catch(() => null);
      const data = json?.workout?.data as WorkoutSession | undefined;
      if (data) setWorkout(data);
    })();
  }, [id]);

  const totalVolume = workout?.totalVolume ?? 0;

  const repeatWorkout = async () => {
    if (!workout) return;

    // create new active session based on structure
    const draft: WorkoutSession = {
      id: (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
      module: 'GYM',
      status: 'active',
      startTime: Date.now(),
      logs: workout.logs.map((l) => ({
        exerciseId: l.exerciseId,
        exerciseName: l.exerciseName,
        restSecDefault: l.restSecDefault,
        sets: l.sets.map((s) => ({
          id: (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`),
          reps: 0,
          weight: 0,
          isCompleted: false,
          restPlannedSec: s.restPlannedSec,
        })),
      })),
      templateIdUsed: workout.templateIdUsed ?? null,
      dataVersion: 1,
    };

    setCurrentWorkout(draft);
    navigate('/activities/gym/active');
  };

  const saveAsTemplate = async () => {
    if (!workout) return;
    const name = prompt('Template name?');
    if (!name) return;

    const token = localStorage.getItem('relay-token');
    const payload = {
      module: 'GYM',
      name,
      logs: workout.logs.map((l) => ({
        exerciseId: l.exerciseId,
        exerciseName: l.exerciseName,
        targetSets: Math.max(1, l.sets.length),
        restSecDefault: l.restPlannedSec ?? l.restSecDefault,
      })),
    };

    await fetch('/api/templates/gym', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
    });

    alert('Saved as template.');
  };

  if (!workout) {
    return (
      <div className="px-6 py-8 text-white/60">
        <p className="text-[10px] font-[900] uppercase tracking-[0.45em]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 space-y-6 text-white">
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex gap-2">
          <button
            onClick={repeatWorkout}
            className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-[10px] font-[900] uppercase tracking-widest"
          >
            <Repeat size={14} /> Repeat
          </button>

          <button
            onClick={saveAsTemplate}
            className="px-4 py-2 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors flex items-center gap-2 text-[10px] font-[900] uppercase tracking-widest"
          >
            <Save size={14} /> Template
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-white/10 bg-white/5 backdrop-blur-xl p-6">
        <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-white/40">
          Summary
        </p>
        <div className="mt-3 text-2xl font-[900] italic uppercase tracking-tight">
          Total Volume: <span className="text-white/80">{Math.round(totalVolume)}</span>
        </div>
        {workout.rpeOverall != null && (
          <p className="mt-2 text-[10px] font-[900] uppercase tracking-[0.45em] text-white/40">
            RPE {workout.rpeOverall}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {workout.logs.map((log) => (
          <div key={log.exerciseId} className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-5">
            <h3 className="text-lg font-[900] italic uppercase tracking-tight">{log.exerciseName}</h3>
            <div className="mt-3 space-y-2">
              {log.sets.map((s, idx) => (
                <div key={s.id} className="flex justify-between text-white/70 text-sm font-bold">
                  <span>Set {idx + 1}</span>
                  <span>{s.weight} × {s.reps}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
