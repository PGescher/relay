import React, { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { WorkoutSession } from '@relay/shared';

function volume(w: WorkoutSession): number {
  let total = 0;
  for (const log of w.logs) for (const s of log.sets) if (s.isCompleted) total += (s.weight || 0) * (s.reps || 0);
  return total;
}

const GymAnalytics: React.FC = () => {
  const { workoutHistory } = useApp();

  const completed = useMemo(
    () => workoutHistory.filter((w) => w.status === 'completed').sort((a, b) => a.startTime - b.startTime),
    [workoutHistory]
  );

  const points = useMemo(() => {
    return completed.slice(-12).map((w) => {
      const dur = w.endTime ? Math.max(1, Math.round((w.endTime - w.startTime) / 60000)) : 0;
      return {
        id: w.id,
        date: new Date(w.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        volume: volume(w),
        durationMin: dur,
        rpe: w.rpeOverall ?? null,
      };
    });
  }, [completed]);

  const maxVol = Math.max(1, ...points.map((p) => p.volume));
  const maxDur = Math.max(1, ...points.map((p) => p.durationMin));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-[900] italic text-[var(--text)]">
        ANALYTICS<span className="text-[var(--primary)]">.</span>
      </h2>

      {points.length < 2 ? (
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-card)] p-6 text-[var(--text-muted)]">
          Do at least 2 workouts to see trends.
        </div>
      ) : (
        <div className="space-y-5">
          <ChartCard title="Total Volume (last 12)">
            <Bars
              labels={points.map((p) => p.date)}
              values={points.map((p) => Math.round((p.volume / maxVol) * 100))}
              valueText={points.map((p) => `${p.volume}`)}
            />
          </ChartCard>

          <ChartCard title="Duration (minutes)">
            <Bars
              labels={points.map((p) => p.date)}
              values={points.map((p) => Math.round((p.durationMin / maxDur) * 100))}
              valueText={points.map((p) => `${p.durationMin}m`)}
            />
          </ChartCard>

          <ChartCard title="RPE (overall)">
            <div className="grid grid-cols-12 gap-2 items-end">
              {points.map((p, idx) => {
                const v = p.rpe == null ? 0 : Math.round((p.rpe / 10) * 100);
                return (
                  <div key={idx} className="flex flex-col items-center gap-2">
                    <div
                      className={[
                        "w-4 rounded-full border border-[var(--border)]",
                        p.rpe == null ? "bg-[var(--bg-card)]" : "bg-[var(--primary)]",
                      ].join(' ')}
                      style={{ height: `${Math.max(8, v)}px` }}
                      title={p.rpe == null ? 'no rpe' : `RPE ${p.rpe}`}
                    />
                    <div className="text-[8px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">
                      {p.date}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">
              RPE starts showing once you submit it on finish.
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
};

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-3xl border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl p-5">
    <div className="text-[10px] font-[900] uppercase tracking-widest text-[var(--text-muted)] mb-4">{title}</div>
    {children}
  </div>
);

const Bars: React.FC<{ labels: string[]; values: number[]; valueText: string[] }> = ({ labels, values, valueText }) => {
  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      {values.map((v, idx) => (
        <div key={idx} className="flex flex-col items-center gap-2">
          <div
            className="w-4 bg-[var(--primary)] rounded-full"
            style={{ height: `${Math.max(8, v)}px` }}
            title={valueText[idx]}
          />
          <div className="text-[8px] font-[900] uppercase tracking-widest text-[var(--text-muted)]">{labels[idx]}</div>
        </div>
      ))}
    </div>
  );
};

export default GymAnalytics;
