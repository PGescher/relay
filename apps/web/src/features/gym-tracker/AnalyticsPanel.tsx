// apps/web/src/modules/gym/AnalyticsPanel.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { WorkoutSession } from '@relay/shared';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

type Metric = 'volume' | 'durationMin' | 'rpe';
type RangeKey = '4w' | '12w' | '6m' | '1y' | 'all';

type ApiWorkoutsResponse = {
  workouts: WorkoutSession[];
};

function computeVolume(w: WorkoutSession): number {
  let total = 0;
  for (const log of w.logs) {
    for (const s of log.sets) {
      if (!s.isCompleted) continue;
      total += (s.weight || 0) * (s.reps || 0);
    }
  }
  return total;
}

function computeDurationMin(w: WorkoutSession): number {
  if (!w.endTime) return 0;
  return Math.max(1, Math.round((w.endTime - w.startTime) / 60000));
}

function formatLabel(ts: number): string {
  // short mobile-friendly label
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function rangeToStart(range: RangeKey): number | null {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  switch (range) {
    case '4w':
      return now - 28 * day;
    case '12w':
      return now - 84 * day;
    case '6m':
      return now - 183 * day;
    case '1y':
      return now - 365 * day;
    case 'all':
    default:
      return null;
  }
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

const pillBase =
  'rounded-full border px-3 py-2 text-[10px] font-[900] uppercase tracking-[0.45em] transition-colors';
const pillActive =
  'bg-[var(--primary-soft)] border-[var(--primary)] text-[var(--primary)]';
const pillIdle =
  'bg-[var(--bg-card)] border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]';

const AnalyticsPanel: React.FC = () => {
  const { workoutHistory } = useApp();

  const [source, setSource] = useState<'local' | 'api'>('local');
  const [apiWorkouts, setApiWorkouts] = useState<WorkoutSession[] | null>(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [metric, setMetric] = useState<Metric>('volume');
  const [range, setRange] = useState<RangeKey>('12w');

  // optional per-exercise selection
  const [exerciseId, setExerciseId] = useState<string>('all'); // 'all' or a real id

  // Fetch workouts (optional)
  useEffect(() => {
    let alive = true;

    async function run() {
      if (source !== 'api') return;

      setApiLoading(true);
      setApiError(null);

      try {
        const token = localStorage.getItem('relay-token');
        const res = await fetch('/api/workouts', {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = (await res.json()) as ApiWorkoutsResponse;
        if (!alive) return;
        setApiWorkouts(Array.isArray(json.workouts) ? json.workouts : []);
      } catch (e: any) {
        if (!alive) return;
        setApiError(e?.message ?? 'Failed to fetch workouts');
        setApiWorkouts([]);
      } finally {
        if (!alive) return;
        setApiLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [source]);

  const baseWorkouts = useMemo(() => {
    const src = source === 'api' ? apiWorkouts : workoutHistory;
    if (!src) return [];
    return src.filter((w) => w.status === 'completed').slice().sort((a, b) => a.startTime - b.startTime);
  }, [source, apiWorkouts, workoutHistory]);

  // Build exercise list for dropdown
  const exerciseOptions = useMemo(() => {
    const items: { id: string; name: string }[] = [];
    for (const w of baseWorkouts) {
      for (const log of w.logs) {
        // needs ExerciseLog.exerciseId + exerciseName in your shared types + stored data
        if (!log.exerciseId) continue;
        items.push({ id: log.exerciseId, name: log.exerciseName ?? log.exerciseId });
      }
    }

    const byId = new Map<string, string>();
    for (const it of items) if (!byId.has(it.id)) byId.set(it.id, it.name);

    const list = Array.from(byId.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [baseWorkouts]);

  // Filter by range + per-exercise
  const filtered = useMemo(() => {
    const start = rangeToStart(range);
    return baseWorkouts.filter((w) => {
      if (start != null && w.startTime < start) return false;
      if (exerciseId === 'all') return true;
      return w.logs.some((l) => l.exerciseId === exerciseId);
    });
  }, [baseWorkouts, range, exerciseId]);

  // Build chart points
  const points = useMemo(() => {
    // If per-exercise, compute volume/duration on that exercise only.
    return filtered.map((w) => {
      const exLogs = exerciseId === 'all' ? w.logs : w.logs.filter((l) => l.exerciseId === exerciseId);

      const vol = (() => {
        let total = 0;
        for (const log of exLogs) {
          for (const s of log.sets) {
            if (!s.isCompleted) continue;
            total += (s.weight || 0) * (s.reps || 0);
          }
        }
        return total;
      })();

      const durMin = computeDurationMin(w);

      const rpe = typeof w.rpeOverall === 'number' ? w.rpeOverall : null;

      return {
        id: w.id,
        ts: w.startTime,
        label: formatLabel(w.startTime),
        volume: vol,
        durationMin: durMin,
        rpe: rpe,
      };
    });
  }, [filtered, exerciseId]);

  const metricMeta = useMemo(() => {
    if (metric === 'volume')
      return { title: 'Total Volume', key: 'volume' as const, suffix: '', allowNull: false };
    if (metric === 'durationMin')
      return { title: 'Duration (min)', key: 'durationMin' as const, suffix: 'm', allowNull: false };
    return { title: 'RPE (overall)', key: 'rpe' as const, suffix: '', allowNull: true };
  }, [metric]);

  const chartData = useMemo(() => {
    // Recharts likes numbers; if allowNull, keep nulls; otherwise force 0.
    return points.map((p) => ({
      ...p,
      value:
        metricMeta.key === 'rpe'
          ? p.rpe
          : (p[metricMeta.key] as number),
    }));
  }, [points, metricMeta]);

  const hasEnough = chartData.filter((d) => d.value != null).length >= 2;

  const titleExercise = useMemo(() => {
    if (exerciseId === 'all') return 'All exercises';
    const found = exerciseOptions.find((e) => e.id === exerciseId);
    return found?.name ?? exerciseId;
  }, [exerciseId, exerciseOptions]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-[900] italic text-[var(--text)]">
          ANALYTICS<span className="text-[var(--primary)]">.</span>
        </h2>

        {/* Source toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={[pillBase, source === 'local' ? pillActive : pillIdle].join(' ')}
            onClick={() => setSource('local')}
          >
            Local
          </button>
          <button
            type="button"
            className={[pillBase, source === 'api' ? pillActive : pillIdle].join(' ')}
            onClick={() => setSource('api')}
          >
            API
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5 space-y-4">
        {/* Metric */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={[pillBase, metric === 'volume' ? pillActive : pillIdle].join(' ')}
            onClick={() => setMetric('volume')}
          >
            Volume
          </button>
          <button
            type="button"
            className={[pillBase, metric === 'durationMin' ? pillActive : pillIdle].join(' ')}
            onClick={() => setMetric('durationMin')}
          >
            Duration
          </button>
          <button
            type="button"
            className={[pillBase, metric === 'rpe' ? pillActive : pillIdle].join(' ')}
            onClick={() => setMetric('rpe')}
          >
            RPE
          </button>
        </div>

        {/* Range */}
        <div className="flex flex-wrap gap-2">
          {(['4w', '12w', '6m', '1y', 'all'] as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              className={[pillBase, range === k ? pillActive : pillIdle].join(' ')}
              onClick={() => setRange(k)}
            >
              {k.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Exercise select (optional) */}
        <div className="space-y-2">
          <div className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
            Per exercise
          </div>
          <select
            value={exerciseId}
            onChange={(e) => setExerciseId(e.target.value)}
            className="w-full rounded-2xl px-4 py-3 bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text)] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--primary-soft)]"
          >
            <option value="all">All exercises</option>
            {exerciseOptions.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Status / errors */}
      {source === 'api' && (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-[var(--text-muted)] text-sm">
          {apiLoading ? 'Loading workouts from API…' : apiError ? `API error: ${apiError}` : 'Loaded workouts from API.'}
        </div>
      )}

      {/* Chart */}
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5">
        <div className="flex items-end justify-between gap-3 mb-4">
          <div>
            <div className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
              {metricMeta.title}
            </div>
            <div className="mt-1 text-sm font-black text-[var(--text)]">
              {titleExercise} • {chartData.length} workouts
            </div>
          </div>

          <div className="text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
            {range.toUpperCase()}
          </div>
        </div>

        {!hasEnough ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-[var(--text-muted)]">
            Do at least 2 workouts (with values) to see trends.
          </div>
        ) : (
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.035)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 16,
                    color: 'var(--text)',
                    fontWeight: 800,
                  }}
                  labelStyle={{ color: 'var(--text-muted)', fontWeight: 900, letterSpacing: '0.2em' }}
                  formatter={(value: any) => {
                    if (value == null) return ['—', metricMeta.title];
                    const v = typeof value === 'number' ? value : Number(value);
                    const suffix = metricMeta.suffix;
                    return [`${Number.isFinite(v) ? v : value}${suffix}`, metricMeta.title];
                  }}
                />
                <Line
                  type="natural"
                  dataKey="value"
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="mt-4 text-[10px] font-[900] uppercase tracking-[0.45em] text-[var(--text-muted)]">
          Tip: switch to “Per exercise” to track bench / squat volume separately.
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
