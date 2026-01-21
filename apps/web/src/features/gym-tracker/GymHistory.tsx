
import React from 'react';
import { useApp } from '../../context/AppContext';
import { Calendar, ChevronRight, Clock, Award } from 'lucide-react';

const GymHistory: React.FC = () => {
  const { workoutHistory } = useApp();

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDuration = (start: number, end?: number) => {
    if (!end) return 'Active';
    const mins = Math.floor((end - start) / 60000);
    return `${mins}m`;
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-3xl font-black italic">HISTORY<span className="text-blue-600">.</span></h2>
        <div className="bg-gray-100 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">
            {workoutHistory.length} Sessions
        </div>
      </div>

      {workoutHistory.length === 0 ? (
        <div className="py-20 text-center space-y-4">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
                <Calendar size={40} />
            </div>
            <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">No workout DNA found yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workoutHistory.map((workout) => (
            <div key={workout.id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-5 hover:border-blue-200 transition-colors cursor-pointer group">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">{formatDate(workout.startTime)}</p>
                        <h3 className="text-xl font-black italic group-hover:text-blue-600 transition-colors">Session: Gym Tracker</h3>
                    </div>
                    <ChevronRight size={20} className="text-gray-300" />
                </div>

                <div className="flex gap-4 mb-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <Clock size={14} />
                        {getDuration(workout.startTime, workout.endTime)}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                        <Award size={14} />
                        {workout.logs.length} Exercises
                    </div>
                </div>

                <div className="flex gap-2 overflow-hidden">
                    {workout.logs.slice(0, 3).map((log, i) => (
                        <span key={i} className="text-[9px] font-black bg-white border border-gray-100 px-3 py-1 rounded-full uppercase truncate">
                            {log.exerciseName}
                        </span>
                    ))}
                    {workout.logs.length > 3 && (
                        <span className="text-[9px] font-black bg-gray-100 px-3 py-1 rounded-full uppercase">+{workout.logs.length - 3}</span>
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
