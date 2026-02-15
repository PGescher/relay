import React, { useMemo, useState } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from 'recharts';
import { 
  Trophy, Activity, Beaker, Book, Zap, ChevronLeft, ChevronRight, Scale, ShieldCheck, Flame
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { 
  calculate1RM, 
  getMuscleGroupSplits, 
  getVolume, 
  getScientificInsights, // <-- Check this name
  getLoreFacts 
} from '../analyticsUtils';

import { WorkoutStatus, WorkoutSession } from '@relay/shared';

const GymAnalytics: React.FC<{ workoutHistory: WorkoutSession[] }> = ({ workoutHistory }) => {
  // everything else stays the same
  //const { workoutHistory } = useApp();
  const [mode, setMode] = useState<'science' | 'lore'>('science');
  const [exerciseId, setExerciseId] = useState('all');

  const sci = useMemo(() => getScientificInsights(workoutHistory), [workoutHistory]);
  const lore = useMemo(() => getLoreFacts(workoutHistory), [workoutHistory]);
  const muscleSplits = useMemo(() => getMuscleGroupSplits(workoutHistory), [workoutHistory]);

  const exerciseOptions = useMemo(() => {
    const map = new Map<string, string>();
    workoutHistory.forEach(w => w.logs.forEach(l => map.set(l.exerciseId, l.exerciseName)));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [workoutHistory]);

  const currentIndex = exerciseOptions.findIndex(e => e.id === exerciseId);
  const cycleExercise = (dir: 'next' | 'prev') => {
    if (exerciseOptions.length === 0) return;
    let nextIdx = dir === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIdx >= exerciseOptions.length) nextIdx = -1;
    if (nextIdx < -1) nextIdx = exerciseOptions.length - 1;
    setExerciseId(nextIdx === -1 ? 'all' : exerciseOptions[nextIdx].id);
  };

  const chartData = useMemo(() => {
    return workoutHistory
      .filter(w => w.status === "completed")
      .sort((a, b) => a.startTime - b.startTime)
      .map(w => {
        const date = new Date(w.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (exerciseId === 'all') return { date, value: getVolume(w), name: w.name };
        const log = w.logs.find(l => l.exerciseId === exerciseId);
        const max1RM = log ? Math.max(...log.sets.map(s => calculate1RM(s.weight, s.reps))) : 0;
        return { date, value: Math.round(max1RM), name: w.name };
      });
  }, [workoutHistory, exerciseId]);

  return (
    <div className="space-y-6 pb-32 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* MODE TOGGLE */}
      <div className="flex p-1 bg-[var(--glass)] border border-[var(--border)] rounded-2xl">
        <button
          onClick={() => setMode('science')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
            ${mode === 'science' ? 'bg-[var(--primary)] text-white shadow-lg' : 'text-slate-500'}`}
        >
          <Beaker size={14} /> Science
        </button>
        <button
          onClick={() => setMode('lore')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
            ${mode === 'lore' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500'}`}
        >
          <Book size={14} /> Lore
        </button>
      </div>

      {mode === 'science' ? (
        <div className="space-y-6 animate-in zoom-in-95 duration-300">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Intensity Index" value={`${sci.intensity} RPE`} sub="Avg. Session Strain" icon={<Activity size={16} className="text-blue-400" />} />
            <StatCard label="Readiness" value={sci.readiness} sub="Recovery State" icon={<Scale size={16} className="text-emerald-400" />} />
          </div>

          <section className="bg-[var(--glass)] border border-[var(--border)] rounded-[32px] p-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-center opacity-50 text-[var(--text-muted)]">DNA Distribution</h3>
            <div className="h-64">
              <ResponsiveContainer>
                <RadarChart data={muscleSplits}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 900 }} />
                  <Radar dataKey="value" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="bg-[var(--glass)] border border-[var(--border)] rounded-[32px] p-6">
             <div className="flex justify-between items-center mb-6">
                <button onClick={() => cycleExercise('prev')} className="p-2 bg-white/5 rounded-lg"><ChevronLeft size={16}/></button>
                <div className="text-center">
                  <h3 className="text-xs font-black uppercase italic">{exerciseId === 'all' ? 'Volume Load' : exerciseOptions[currentIndex]?.name}</h3>
                </div>
                <button onClick={() => cycleExercise('next')} className="p-2 bg-white/5 rounded-lg"><ChevronRight size={16}/></button>
             </div>
             <div className="h-48 w-full">
               <ResponsiveContainer>
                 <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fill="url(#colorVal)" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <div className="grid grid-cols-2 gap-3">
            {lore.map((fact, i) => (
              <div key={i} className="bg-gradient-to-br from-orange-500/10 to-transparent border border-orange-500/10 p-5 rounded-[28px] relative overflow-hidden group">
                <div className="relative z-10">
                  <p className="text-[8px] font-black uppercase text-orange-500/60 tracking-widest">{fact.label}</p>
                  <p className="text-2xl font-black italic uppercase my-1 group-hover:scale-105 transition-transform">{fact.value}</p>
                  <p className="text-[9px] font-bold text-slate-500 uppercase">{fact.desc}</p>
                </div>
                <Flame size={60} className="absolute -right-4 -bottom-4 text-orange-500/5 rotate-12" />
              </div>
            ))}
          </div>

          <div className="bg-[var(--glass)] border border-[var(--border)] rounded-[32px] p-6 space-y-4">
             <h3 className="text-[10px] font-black uppercase tracking-widest opacity-50 text-orange-500">Global Mastery</h3>
             {muscleSplits.slice(0, 5).map((m, i) => (
               <div key={i} className="space-y-1">
                 <div className="flex justify-between text-[10px] font-black uppercase">
                   <span>{m.name}</span>
                   <span className="text-orange-500">{m.percentage}%</span>
                 </div>
                 <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                   <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" style={{ width: `${m.percentage}%` }} />
                 </div>
               </div>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, sub, icon }: any) => (
  <div className="bg-[var(--glass)] border border-[var(--border)] p-5 rounded-[28px]">
    <div className="flex justify-between items-center mb-3">
      <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      {icon}
    </div>
    <div className="text-xl font-black italic uppercase leading-none">{value}</div>
    <div className="text-[9px] font-bold text-[var(--primary)] mt-1 opacity-60 uppercase">{sub}</div>
  </div>
);

const ChartTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/80 backdrop-blur-md border border-white/10 p-3 rounded-xl shadow-2xl">
        <p className="text-[10px] font-black text-slate-400 uppercase">{payload[0].payload.date}</p>
        <p className="text-lg font-black italic text-white">{payload[0].value} <span className="text-[8px]">KG</span></p>
      </div>
    );
  }
  return null;
};

export default GymAnalytics;