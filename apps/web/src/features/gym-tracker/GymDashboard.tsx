import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, History, Trophy, TrendingUp, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkoutSession } from '@relay/shared';

const GymDashboard: React.FC = () => {
  const { currentWorkout, setCurrentWorkout, setActiveTab, workoutHistory } = useApp();
  const navigate = useNavigate();

  const startWorkout = () => {
    const newWorkout: WorkoutSession = {
      id: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      logs: [],
      status: 'active',
      module: 'GYM',
    };
    setCurrentWorkout(newWorkout);
    navigate('/activities/gym/active');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 px-6 py-8 text-[var(--text)]">
      <div className="text-center py-4">
        <h2 className="text-4xl font-black italic tracking-tighter">
          GYM TRACKER<span className="text-[var(--gym)]">.</span>
        </h2>
        <p className="text-[var(--text-muted)] font-medium">Precision tracking for peak performance.</p>
      </div>

      {currentWorkout ? (
        <button
          type="button"
          onClick={() => navigate('/activities/gym/active')}
          className={[
            "w-full p-8 rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all",
            "bg-[var(--gym)] text-white",
            "hover:brightness-110 active:scale-95",
            "shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
          ].join(" ")}
        >
          <div className="bg-white/15 p-4 rounded-full">
            <Play fill="white" size={32} />
          </div>
          <span className="font-black text-xl tracking-tight uppercase">Resume Session</span>
          <span className="text-[10px] font-black uppercase tracking-widest opacity-80">
            {workoutHistory.length} sessions stored
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={startWorkout}
          className={[
            "w-full p-8 rounded-[32px] flex flex-col items-center justify-center gap-4 transition-all",
            "bg-[var(--glass)] backdrop-blur-xl border border-[var(--border)]",
            "hover:bg-[var(--glass-strong)] hover:-translate-y-[1px] active:scale-95",
            "shadow-[0_20px_60px_rgba(0,0,0,0.14)]",
          ].join(" ")}
        >
          <div className="bg-[var(--gym-soft)] p-4 rounded-full border border-[var(--border)]">
            <Play className="text-[var(--gym)]" fill="currentColor" size={32} />
          </div>
          <span className="font-black text-xl tracking-tight uppercase">START NEW WORKOUT</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-3">
        <DashboardAction
          icon={<History size={20} className="text-[var(--gym)]" />}
          title="Recent History"
          meta={`${workoutHistory.length} sessions`}
          onClick={() => setActiveTab('history')}
        />
        <DashboardAction
          icon={<Trophy size={20} className="text-[var(--text-muted)]" />}
          title="Personal Records"
          meta="Coming Soon"
          onClick={() => {}}
        />
        <DashboardAction
          icon={<TrendingUp size={20} className="text-[var(--text-muted)]" />}
          title="Progress Analytics"
          meta="Coming Soon"
          onClick={() => {}}
        />
      </div>

      <div className="bg-[var(--glass)] backdrop-blur-xl rounded-3xl p-6 border border-[var(--border)] shadow-[0_12px_32px_rgba(0,0,0,0.10)]">
        <h3 className="font-black text-sm uppercase tracking-widest text-[var(--text-muted)] mb-4">
          Recommended for you — Coming Soon
        </h3>
        <div className="space-y-4">
          <WorkoutCard title="Hypertrophy A" tags={['Push', 'Chest', 'Triceps']} />
          <WorkoutCard title="Powerlifting S" tags={['Legs', 'Deadlift', 'Squat']} />
        </div>
      </div>
    </div>
  );
};

const DashboardAction: React.FC<{
  icon: React.ReactNode;
  title: string;
  meta: string;
  onClick: () => void;
}> = ({ icon, title, meta, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "flex justify-between items-center p-6 rounded-3xl transition-colors",
      "bg-[var(--glass)] backdrop-blur-xl border border-[var(--border)]",
      "hover:bg-[var(--glass-strong)]",
    ].join(" ")}
  >
    <div className="flex items-center gap-4">
      <div className="bg-[var(--bg-card)] p-3 rounded-2xl border border-[var(--border)] shadow-sm">
        {icon}
      </div>
      <div className="text-left">
        <span className="font-black text-sm block text-[var(--text)]">{title}</span>
        <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-tighter">{meta}</span>
      </div>
    </div>
    <ChevronRight size={18} className="text-[var(--text-muted)]" />
  </button>
);

const WorkoutCard: React.FC<{ title: string; tags: string[] }> = ({ title, tags }) => (
  <div className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-2xl border border-[var(--border)]">
    <div>
      <h4 className="font-black italic text-[var(--text)]">{title}</h4>
      <div className="flex gap-2 mt-1">
        {tags.map((t) => (
          <span
            key={t}
            className="text-[8px] font-black bg-[var(--glass)] border border-[var(--border)] px-2 py-0.5 rounded-full uppercase tracking-widest text-[var(--text-muted)]"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
    <button type="button" className="bg-[var(--gym)] text-white p-2 rounded-xl hover:bg-[var(--gym-hover)] transition-colors">
      <Plus size={16} />
    </button>
  </div>
);

const Plus: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);

export default GymDashboard;
