import React from 'react';
import { Play, History, Trophy, TrendingUp, ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { WorkoutSession } from '@relay/shared';

import ActiveWorkout from './ActiveWorkout'; // 1. Import your ActiveWorkout component

const GymDashboard: React.FC = () => {
  const { currentWorkout, setCurrentWorkout, setActiveTab, workoutHistory } = useApp();

  // 2. If there is an active workout, show the ActiveWorkout screen instead of the Dashboard
  if (currentWorkout) {
    return <ActiveWorkout />;
  }
  
  const startWorkout = () => {
    const newWorkout: WorkoutSession = {
      id: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      logs: [],
      status: 'active', // Note: Check if 'active' is allowed in WorkoutSession status
      module: 'GYM'
    };
    setCurrentWorkout(newWorkout);
    // Navigate to the active workout screen
    setActiveTab('gym-active'); // Or however you route to ActiveWorkout.tsx
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 px-6 py-8">
      <div className="text-center py-4">
        <h2 className="text-4xl font-black italic tracking-tighter">GYM TRACKER<span className="text-blue-600">.</span></h2>
        <p className="text-[var(--text-muted)] font-medium">Precision tracking for peak performance.</p>
      </div>

      <button 
        onClick={startWorkout}
        className="w-full bg-black text-white p-8 rounded-[32px] flex flex-col items-center justify-center gap-4 hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-500/10"
      >
        <div className="bg-white/10 p-4 rounded-full">
            <Play fill="white" size={32} />
        </div>
        <span className="font-black text-xl tracking-tight">START NEW WORKOUT</span>
      </button>

      <div className="grid grid-cols-1 gap-3">
        <DashboardAction 
            icon={<History size={20} className="text-blue-500" />} 
            title="Recent History" 
            meta={`${workoutHistory.length} sessions`}
            onClick={() => setActiveTab('history')}
        />
        <DashboardAction 
            icon={<Trophy size={20} className="text-yellow-500" />} 
            title="Personal Records" 
            meta="Coming Soon"
            onClick={() => {}}
        />
        <DashboardAction 
            icon={<TrendingUp size={20} className="text-green-500" />} 
            title="Progress Analytics" 
            meta="Coming Soon"
            onClick={() => {}}
        />
      </div>

      <div className="bg-[var(--bg-card)] rounded-3xl p-6 border border-[var(--border)]">
        <h3 className="font-black text-sm uppercase tracking-widest text-gray-400 mb-4">Recommended for you - Coming Soon</h3>
        <div className="space-y-4">
            <WorkoutCard title="Hypertrophy A" tags={['Push', 'Chest', 'Triceps']} />
            <WorkoutCard title="Powerlifting S" tags={['Legs', 'Deadlift', 'Squat']} />
        </div>
      </div>
    </div>
  );
};

const DashboardAction: React.FC<{ icon: React.ReactNode, title: string, meta: string, onClick: () => void }> = ({ icon, title, meta, onClick }) => (
  <button 
    onClick={onClick}
    className="flex justify-between items-center p-6 bg-[var(--bg-card)] rounded-3xl border border-[var(--border)] hover:bg-gray-50 transition-colors"
  >
    <div className="flex items-center gap-4">
      <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        {icon}
      </div>
      <div className="text-left">
        <span className="font-black text-sm block">{title}</span>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-tighter">{meta}</span>
      </div>
    </div>
    <ChevronRight size={18} className="text-gray-300" />
  </button>
);

const WorkoutCard: React.FC<{ title: string, tags: string[] }> = ({ title, tags }) => (
    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-gray-100">
        <div>
            <h4 className="font-black italic">{title}</h4>
            <div className="flex gap-2 mt-1">
                {tags.map(t => (
                    <span key={t} className="text-[8px] font-black bg-gray-100 px-2 py-0.5 rounded-full uppercase tracking-widest">{t}</span>
                ))}
            </div>
        </div>
        <button className="bg-black text-white p-2 rounded-xl">
            <Plus size={16} />
        </button>
    </div>
);

const Plus: React.FC<{ size?: number }> = ({ size = 24 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
    </svg>
);

export default GymDashboard;
