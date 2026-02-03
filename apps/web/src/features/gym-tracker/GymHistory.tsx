import React from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar, ChevronRight, Clock, Award } from 'lucide-react';

const GymHistory: React.FC = () => {
  const { workoutHistory } = useApp();

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getDuration = (start: number, end?: number) => {
    if (!end) return 'Active';
    const mins = Math.floor((end - start) / 60000);
    return `${mins}m`;
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500 text-[var(--text)]">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-black italic">
          HISTORY<span className="text-[var(--gym)]">.</span>
        </h2>
        <div className="bg-[var(--bg-card)] border border-[var(--border)] px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">
          {workoutHistory.length} Sessions
        </div>
      </div>

      {workoutHistory.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-full flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <Calendar size={40} />
          </div>
          <p className="font-bold text-[var(--text-muted)] uppercase tracking-widest text-xs">
            No workout DNA found yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workoutHistory.map((workout) => (
            <div
              key={workout.id}
              className="bg-[var(--glass)] backdrop-blur-xl border border-[var(--border)] rounded-3xl p-5 hover:bg-[var(--glass-strong)] transition-colors cursor-pointer group shadow-[0_12px_32px_rgba(0,0,0,0.10)]"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[var(--gym)] mb-1">
                    {formatDate(workout.startTime)}
                  </p>
                  <h3 className="text-xl font-black italic group-hover:text-[var(--gym)] transition-colors">
                    Session: Gym Tracker
                  </h3>
                </div>
                <ChevronRight size={20} className="text-[var(--text-muted)]" />
              </div>

              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                  <Clock size={14} />
                  {getDuration(workout.startTime, workout.endTime)}
                </div>
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)]">
                  <Award size={14} />
                  {workout.logs.length} Exercises
                </div>
              </div>

              <div className="flex gap-2 overflow-hidden">
                {workout.logs.slice(0, 3).map((log, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-black bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded-full uppercase truncate text-[var(--text-muted)]"
                  >
                    {log.exerciseName}
                  </span>
                ))}
                {workout.logs.length > 3 && (
                  <span className="text-[9px] font-black bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded-full uppercase text-[var(--text-muted)]">
                    +{workout.logs.length - 3}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GymHistory;
