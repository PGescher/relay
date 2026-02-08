import { WorkoutSession, WorkoutStatus } from '@relay/shared';

/**
 * Helper to map exercise names to Muscle Groups since muscleGroup isn't in ExerciseLog
 */
export const getMuscleGroup = (name: string): string => {
  const n = name.toLowerCase();
  if (n.includes("bench") || n.includes("chest") || n.includes("fly") || n.includes("dip") || n.includes("brust")) return "Chest";
  if (n.includes("row") || n.includes("pull") || n.includes("lat") || n.includes("deadlift") || n.includes("rücken") || n.includes("back")) return "Back";
  if (n.includes("squat") || n.includes("leg") || n.includes("calf") || n.includes("quad") || n.includes("bein") || n.includes("glute")) return "Legs";
  if (n.includes("press") || n.includes("lateral") || n.includes("shoulder") || n.includes("schulter") || n.includes("front")) return "Shoulders";
  if (n.includes("curl") || n.includes("tricep") || n.includes("bicep") || n.includes("arm")) return "Arms";
  if (n.includes("crunch") || n.includes("plank") || n.includes("v up") || n.includes("twist") || n.includes("bauch") || n.includes("core")) return "Core";
  if (n.includes("cycling") || n.includes("running") || n.includes("walking") || n.includes("treadmill") || n.includes("bike")) return "Cardio";
  return "Other";
};

export const calculate1RM = (weight: number, reps: number): number => {
  if (reps === 0 || weight === 0) return 0;
  if (reps === 1) return weight;
  return weight * (36 / (37 - reps));
};

export const getVolume = (workout: WorkoutSession): number => {
  return workout.logs.reduce((total, log) => {
    return total + log.sets.reduce((sTotal, s) => s.isCompleted ? sTotal + (s.weight * s.reps) : sTotal, 0);
  }, 0);
};

export const getMuscleGroupSplits = (workouts: WorkoutSession[]) => {
  const groups: Record<string, number> = {};
  let totalSets = 0;

  workouts.forEach(w => {
    w.logs.forEach(log => {
      const g = getMuscleGroup(log.exerciseName);
      const completedSets = log.sets.filter(s => s.isCompleted).length;
      groups[g] = (groups[g] || 0) + completedSets;
      totalSets += completedSets;
    });
  });

  return Object.entries(groups)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalSets > 0 ? Math.round((value / totalSets) * 100) : 0
    }))
    .sort((a, b) => b.value - a.value);
};

export const getLoreFacts = (workouts: WorkoutSession[]) => {
  const totalVolume = workouts.reduce((acc, w) => acc + (w.totalVolume || 0), 0);
  const allSets = workouts.flatMap(w => w.logs.flatMap(l => l.sets.filter(s => s.isCompleted)));
  const totalSeconds = workouts.reduce((acc, w) => acc + (w.durationSec || 0), 0);
  
  const rpeSets = allSets.filter(s => (s as any).rpe && (s as any).rpe > 0);
  const avgRpe = rpeSets.length > 0 
    ? rpeSets.reduce((acc, s) => acc + ((s as any).rpe || 0), 0) / rpeSets.length 
    : 0;

  return [
    { label: 'Tonnage', value: `${(totalVolume / 1000).toFixed(1)}T`, desc: 'Lifetime Load' },
    { label: 'Intensity', value: `${avgRpe.toFixed(1)}`, desc: 'Average RPE' },
    { label: 'Iron Time', value: `${Math.round(totalSeconds / 3600)}H`, desc: 'Total Training' },
    { label: 'Reps', value: allSets.reduce((acc, s) => acc + s.reps, 0).toLocaleString(), desc: 'Completed Reps' }
  ];
};

export const getStreakData = (history: WorkoutSession[]) => {
  const weekHistory = [...Array(7)].map((_, i) => ({ active: false }));
  if (history.length === 0) return { currentStreak: 0, isActiveToday: false, weekHistory };
  
  const dates = history.map(w => new Date(w.startTime).toDateString());
  const uniqueDates = new Set(dates);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  let currentStreak = 0;
  if (uniqueDates.has(today) || uniqueDates.has(yesterday)) {
    const checkDate = new Date(uniqueDates.has(today) ? today : yesterday);
    while (uniqueDates.has(checkDate.toDateString())) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }
  }

  const generatedWeekHistory = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - (6 - i));
    return { active: uniqueDates.has(d.toDateString()) };
  });

  return { 
    currentStreak, 
    isActiveToday: uniqueDates.has(today), 
    weekHistory: generatedWeekHistory 
  };
};

export const getAdvancedInsights = (workouts: WorkoutSession[]) => {
  const exStats: Record<string, { sessions: number; sets: number; totalVolume: number; max1RM: number }> = {};

  workouts.forEach(w => {
    w.logs.forEach(log => {
      if (!exStats[log.exerciseName]) {
        exStats[log.exerciseName] = { sessions: 1, sets: 0, totalVolume: 0, max1RM: 0 };
      } else {
        exStats[log.exerciseName].sessions += 1;
      }

      log.sets.forEach(s => {
        if (!s.isCompleted) return;
        const vol = (s.weight || 0) * (s.reps || 0);
        const oneRM = calculate1RM(s.weight || 0, s.reps || 0);
        exStats[log.exerciseName].sets += 1;
        exStats[log.exerciseName].totalVolume += vol;
        if (oneRM > exStats[log.exerciseName].max1RM) exStats[log.exerciseName].max1RM = oneRM;
      });
    });
  });

  const sorted = Object.entries(exStats).sort((a, b) => b[1].sessions - a[1].sessions);
  const strongest = Object.entries(exStats).sort((a, b) => b[1].max1RM - a[1].max1RM);

  return {
    favorite: sorted[0] ? { name: sorted[0][0], count: sorted[0][1].sessions } : null,
    strongest: strongest[0] ? { name: strongest[0][0], oneRM: strongest[0][1].max1RM } : null,
    allStats: exStats
  };
};

export const getScientificInsights = (workouts: WorkoutSession[]) => {
  const completed = workouts.filter(w => w.status === WorkoutStatus.completed);
  const allSets = completed.flatMap(w => w.logs.flatMap(l => l.sets.filter(s => s.isCompleted)));
  
  // Use 'as any' for rpe/rir because they are optional/missing in some Zod definitions
  const rpeSets = allSets.filter(s => (s as any).rpe && (s as any).rpe > 0);
  const avgRpe = rpeSets.length > 0 ? rpeSets.reduce((acc, s) => acc + ((s as any).rpe || 0), 0) / rpeSets.length : 0;

  // Handling RIR safely even if it doesn't exist on the interface yet
  const rirSets = allSets.filter(s => (s as any).rir !== undefined);
  const avgRir = rirSets.length > 0 ? rirSets.reduce((acc, s) => acc + ((s as any).rir || 0), 0) / rirSets.length : 0;

  const regions = workouts.flatMap(w => w.logs.map(l => getMuscleGroup(l.exerciseName)));
  const uniqueRegions = new Set(regions).size;

  return {
    intensity: avgRpe.toFixed(1),
    readiness: avgRpe > 8.5 ? 'Fatigued' : avgRpe > 7 ? 'Optimal' : 'Recovered',
    recoveryDemand: avgRpe > 8 ? 'High' : 'Low',
    proximityToFailure: avgRir > 0 ? avgRir.toFixed(1) : 'N/A',
    diversityScore: uniqueRegions
  };
};