import React, { useEffect, useMemo, useState } from 'react';
import type { WorkoutSession } from '@relay/shared';

type ApiWorkoutRow = { data: any };

function toSeries(workouts: WorkoutSession[], pick: (w: WorkoutSession) => number) {
  return workouts
    .slice()
    .sort((a, b) => a.startTime - b.startTime)
    .map((w) => ({ x: w.startTime, y: pick(w) }));
}

function LineChart(props: { title: string; series: Array<{ x: number; y: number }>; height?: number }) {
  const h = props.height ?? 120;
  const w = 360;

  const ys = props.series.map((p) => p.y);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);

  const points = props.series.map((p, i) => {
    const x = props.series.length === 1 ? w / 2 : (i / (props.series.length - 1)) * w;
    const y = h - ((p.y - minY) / (maxY - minY || 1)) * h;
    return `${x},${y}`;
  });

  return (
    <div className="rounded-[28px] border border-white/10 bg-white/5 backdrop-blur-xl p-5">
      <p className="text-[10px] font-[900] uppercase tracking-[0.45em] text-white/35">{props.title}</p>
      <div className="mt-4 overflow-hidden">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[120px]">
          <polyline fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" points={points.join(' ')} />
        </svg>
      </div>
    </div>
  );
}

export function AnalyticsPanel() {
  const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('relay-token');
        const res = await fetch('/api/workouts/gym', {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        const json = await res.json().catch(() => null);
        const rows: ApiWorkoutRow[] = json?.workouts ?? [];
        setWorkouts(rows.map((r: any) => r.data).filter(Boolean));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const volumeSeries = useMemo(() => toSeries(workouts, (w) => w.totalVolume ?? 0), [workouts]);
  const durationSeries = useMemo
