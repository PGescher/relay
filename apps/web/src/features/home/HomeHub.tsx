import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Zap, TrendingUp, ArrowRight, Flame, Shield, Activity } from 'lucide-react';
import { getVolume, getStreakData, getScientificInsights } from '../gym-tracker/analyticsUtils';
import { useApp } from '../../context/AppContext';

const HomeHub: React.FC<{ user: any }> = ({ user }) => {
  const { workoutHistory } = useApp();
  const navigate = useNavigate();

  const streak = useMemo(() => getStreakData(workoutHistory), [workoutHistory]);
  const sci = useMemo(() => getScientificInsights(workoutHistory), [workoutHistory]);
  
  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    const thisMonth = workoutHistory.filter(w => w.startTime > monthStart.getTime());
    return {
      monthVolume: thisMonth.reduce((acc, w) => acc + getVolume(w), 0),
      count: thisMonth.length
    };
  }, [workoutHistory]);

  return (
    <div className="px-4 py-6 space-y-6 pb-24">
      
      {/* HERO STREAK CARD */}
      <div className="relative rounded-[40px] bg-gradient-to-br from-[#0f172a] to-[#1e293b] p-8 text-white shadow-2xl overflow-hidden border border-white/5">
        <div className="relative z-10 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className={`p-2 rounded-xl ${streak.isActiveToday ? 'bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'bg-slate-700'}`}>
                <Flame size={18} fill={streak.isActiveToday ? "white" : "none"} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Activity Streak</span>
            </div>
            
            <div className="flex items-end gap-3">
              <h2 className="text-7xl font-[1000] italic leading-none tracking-tighter">{streak.currentStreak}</h2>
              <p className="text-sm font-black uppercase text-orange-500 pb-2 tracking-widest">Days</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
             <div className="text-right">
                <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Readiness</p>
                <p className="text-xs font-black text-emerald-400 uppercase italic">{sci.readiness}</p>
             </div>
             <div className="flex gap-1 h-8 items-end">
                {streak.weekHistory.map((day, i) => (
                  <div key={i} className={`w-1.5 rounded-full ${day.active ? 'bg-orange-500 h-full' : 'bg-slate-800 h-1/2'}`} />
                ))}
             </div>
          </div>
        </div>
        <Flame size={180} className="absolute -right-12 -bottom-12 text-white/5 rotate-12 pointer-events-none" />
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 gap-4 px-2">
        <div className="bg-[var(--glass)] border border-[var(--border)] rounded-3xl p-5 relative overflow-hidden">
          <p className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest mb-1">Monthly Load</p>
          <p className="text-2xl font-black italic">{(stats.monthVolume / 1000).toFixed(1)}k <span className="text-xs text-[var(--primary)]">kg</span></p>
          <Activity size={40} className="absolute -right-4 -bottom-4 opacity-5" />
        </div>
        <div className="bg-[var(--glass)] border border-[var(--border)] rounded-3xl p-5 relative overflow-hidden">
          <p className="text-[9px] font-black uppercase text-[var(--text-muted)] tracking-widest mb-1">Intensity</p>
          <p className="text-2xl font-black italic">{sci.intensity} <span className="text-xs text-orange-500">RPE</span></p>
          <Shield size={40} className="absolute -right-4 -bottom-4 opacity-5" />
        </div>
      </div>

      {/* NAVIGATION PANELS */}
      <div className="grid grid-cols-1 gap-3">
        <HubPanel
          title="Protocol"
          subtitle="Gym, Run, Cycle"
          icon={<Zap className="w-6 h-6 text-orange-500" />}
          onClick={() => navigate('/activities')}
        />
        <HubPanel
          title="Intelligence"
          subtitle="DNA & Evolution"
          icon={<TrendingUp className="w-6 h-6 text-[var(--primary)]" />}
          onClick={() => navigate('/analytics')}
        />
        <HubPanel
          title="Social"
          subtitle="Tribe Deployments"
          icon={<Users className="w-6 h-6 text-purple-500" />}
          onClick={() => navigate('/feed')}
        />
      </div>
    </div>
  );
};

const HubPanel: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; onClick: () => void; }> = ({ title, subtitle, icon, onClick }) => (
  <button
    onClick={onClick}
    className="group w-full flex items-center gap-5 p-6 rounded-[32px] border border-[var(--border)] bg-[var(--glass)] transition-all active:scale-[0.98]"
  >
    <div className="w-12 h-12 rounded-2xl border border-[var(--border)] bg-black/20 flex items-center justify-center">
      {icon}
    </div>
    <div className="flex-1 text-left">
      <h3 className="text-lg font-black italic uppercase tracking-tight">{title}</h3>
      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-[var(--text-muted)]">{subtitle}</p>
    </div>
    <ArrowRight size={18} className="text-slate-600 group-hover:translate-x-1 transition-transform" />
  </button>
);

export default HomeHub;