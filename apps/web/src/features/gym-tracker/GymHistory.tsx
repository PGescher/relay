import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Clock, Award, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import SyncButton from '../../components/ui/SyncButton';
import { WorkoutStatus } from '@relay/shared';

const GymHistory: React.FC = () => {
  // ✅ Extract both workoutHistory AND setWorkoutHistory
  const { workoutHistory, setWorkoutHistory } = useApp();

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const getDuration = (start: number, end?: number) => {
    if (!end) return 'Active';
    const mins = Math.floor((end - start) / 60000);
    return `${mins}m`;
  };

  const handleDelete = async (e: React.MouseEvent, workoutId: string) => {
    // ✅ Stop the <Link> from navigating when we click delete
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm("Are you sure you want to delete this workout?")) return;

    try {
      const token = localStorage.getItem('relay-token');
      const res = await fetch(`/api/workouts/${workoutId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        // ✅ Remove from local state
        setWorkoutHistory(workoutHistory.filter(w => w.id !== workoutId));
      } else {
        alert("Server failed to delete.");
      }
    } catch (err) {
      console.error(err);
      alert("Delete failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-[900] italic text-[var(--text)]">
          HISTORY<span className="text-[var(--primary)]">.</span>
        </h2>
        <SyncButton module="GYM" onDone={() => window.location.reload()} />
        <div className="bg-[var(--bg-card)] border border-[var(--border)] px-4 py-2 rounded-full text-xs font-[900] uppercase tracking-widest text-[var(--text-muted)]">
          {workoutHistory.length} Sessions
        </div>
      </div>

      {workoutHistory.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-20 h-20 bg-[var(--bg-card)] border border-[var(--border)] rounded-full flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <Calendar size={36} />
          </div>
          <p className="font-[900] text-[var(--text-muted)] uppercase tracking-widest text-xs">
            No workout DNA found yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workoutHistory
            .filter((w) => w.status === WorkoutStatus.completed)
            .map((workout) => (
              <Link
                key={workout.id}
                to={`/activities/gym/history/${workout.id}`}
                className="block bg-[var(--glass)] backdrop-blur-xl border border-[var(--border)] rounded-3xl p-5
                           hover:border-[var(--primary)] transition-colors cursor-pointer group relative"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-[10px] font-[900] uppercase tracking-widest text-[var(--primary)] mb-1">
                      {formatDate(workout.startTime)}
                    </p>
                    <h3 className="text-xl font-[900] italic group-hover:text-[var(--primary)] transition-colors text-[var(--text)] uppercase">
                      {workout.name || "Gym Session"}
                    </h3>
                  </div>
                  
                  {/* ✅ Delete Button inside the card */}
                  <button 
                    onClick={(e) => handleDelete(e, workout.id)}
                    className="z-20 p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
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
                      className="text-[9px] font-[900] bg-[var(--bg-card)] border border-[var(--border)]
                                 px-3 py-1 rounded-full uppercase truncate text-[var(--text)]"
                    >
                      {log.exerciseName}
                    </span>
                  ))}
                  {workout.logs.length > 3 && (
                    <span className="text-[9px] font-[900] bg-[var(--bg-card)] border border-[var(--border)] px-3 py-1 rounded-full uppercase text-[var(--text)]">
                      +{workout.logs.length - 3}
                    </span>
                  )}
                </div>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
};

export default GymHistory;