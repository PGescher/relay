
import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { EXERCISES } from './constants.tsx';
import { Plus, Check, Trash2, ChevronDown, Clock, X } from 'lucide-react';
import { SetLog, ExerciseLog, WorkoutSession } from '@relay/shared';

const ActiveWorkout: React.FC = () => {
  const { currentWorkout, setCurrentWorkout, setWorkoutHistory, workoutHistory, setActiveTab } = useApp();
  const [timer, setTimer] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimer(Math.floor((Date.now() - (currentWorkout?.startTime || Date.now())) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [currentWorkout]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addExercise = (exerciseId: string) => {
    if (!currentWorkout) return;
    const exercise = EXERCISES.find(e => e.id === exerciseId);
    if (!exercise) return;

    const newLog: ExerciseLog = {
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      sets: [{ id: Math.random().toString(), reps: 0, weight: 0, isCompleted: false }]
    };

    setCurrentWorkout({
      ...currentWorkout,
      logs: [...currentWorkout.logs, newLog]
    });
    setShowExercisePicker(false);
  };

  const addSet = (exerciseIndex: number) => {
    if (!currentWorkout) return;
    const newLogs = [...currentWorkout.logs];
    newLogs[exerciseIndex].sets.push({
      id: Math.random().toString(),
      reps: 0,
      weight: 0,
      isCompleted: false
    });
    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
  };

  const updateSet = (exerciseIndex: number, setIndex: number, data: Partial<SetLog>) => {
    if (!currentWorkout) return;
    const newLogs = [...currentWorkout.logs];
    newLogs[exerciseIndex].sets[setIndex] = {
      ...newLogs[exerciseIndex].sets[setIndex],
      ...data
    };
    setCurrentWorkout({ ...currentWorkout, logs: newLogs });
  };

  const finishWorkout = () => {
    if (!currentWorkout) return;
    const finished: WorkoutSession = {
      ...currentWorkout,
      endTime: Date.now(),
      status: 'completed'
    };
    setWorkoutHistory([finished, ...workoutHistory]);
    setCurrentWorkout(null);
    setActiveTab('history');
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] p-6 animate-in slide-in-from-right duration-300 pb-32">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black italic">ACTIVE<span className="text-blue-600">.</span></h2>
          <div className="flex items-center gap-2 text-blue-600 font-black">
            <Clock size={16} />
            <span>{formatTime(timer)}</span>
          </div>
        </div>
        <button 
            onClick={() => { if(confirm('Cancel workout?')) setCurrentWorkout(null); }}
            className="p-3 bg-red-50 text-red-500 rounded-2xl"
        >
          <X size={20} />
        </button>
      </div>

      {/* Exercise Logs */}
      <div className="space-y-6">
        {currentWorkout?.logs.map((log, exIndex) => (
          <div key={exIndex} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-3xl p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black italic text-lg">{log.exerciseName}</h3>
              <button className="text-gray-300"><ChevronDown size={20} /></button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 px-2 text-[10px] font-black uppercase text-gray-400">
                <span>Set</span>
                <span>Lbs</span>
                <span>Reps</span>
                <span className="text-center">Done</span>
              </div>

              {log.sets.map((set, setIndex) => (
                <div key={set.id} className={`grid grid-cols-4 gap-2 items-center p-2 rounded-xl transition-colors ${set.isCompleted ? 'bg-green-50' : ''}`}>
                  <span className="font-black text-sm">{setIndex + 1}</span>
                  <input 
                    type="number" 
                    value={set.weight || ''} 
                    onChange={(e) => updateSet(exIndex, setIndex, { weight: parseFloat(e.target.value) })}
                    placeholder="0"
                    className="bg-white border border-gray-100 rounded-lg p-2 text-xs font-bold text-center w-full"
                  />
                  <input 
                    type="number" 
                    value={set.reps || ''} 
                    onChange={(e) => updateSet(exIndex, setIndex, { reps: parseInt(e.target.value) })}
                    placeholder="0"
                    className="bg-white border border-gray-100 rounded-lg p-2 text-xs font-bold text-center w-full"
                  />
                  <button 
                    onClick={() => updateSet(exIndex, setIndex, { isCompleted: !set.isCompleted })}
                    className={`flex justify-center items-center h-8 w-8 mx-auto rounded-lg transition-all ${set.isCompleted ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                  >
                    <Check size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button 
              onClick={() => addSet(exIndex)}
              className="w-full mt-4 border-2 border-dashed border-gray-200 p-3 rounded-xl text-gray-400 font-bold text-xs hover:border-blue-200 hover:text-blue-400 transition-all"
            >
              + ADD SET
            </button>
          </div>
        ))}

        <button 
          onClick={() => setShowExercisePicker(true)}
          className="w-full bg-blue-50 text-blue-600 p-6 rounded-[24px] font-black flex items-center justify-center gap-2 hover:bg-blue-100 transition-all"
        >
          <Plus size={20} strokeWidth={3} />
          ADD EXERCISE
        </button>
      </div>

      {/* Floating Action Button for Finish */}
      <div className="fixed bottom-8 left-6 right-6 max-w-md mx-auto z-30">
        <button 
          onClick={finishWorkout}
          className="w-full bg-black text-white p-6 rounded-[32px] font-black text-lg shadow-2xl shadow-black/20 hover:scale-105 active:scale-95 transition-all"
        >
          FINISH WORKOUT
        </button>
      </div>

      {/* Exercise Picker Modal */}
      {showExercisePicker && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex flex-col justify-end p-4">
            <div className="bg-white rounded-[40px] p-6 max-h-[80vh] overflow-y-auto w-full max-w-md mx-auto animate-in slide-in-from-bottom duration-300">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-2xl font-black italic">LIBRARY</h3>
                    <button onClick={() => setShowExercisePicker(false)} className="p-2 bg-gray-100 rounded-full"><X size={20} /></button>
                </div>
                <div className="space-y-3">
                    {EXERCISES.map(ex => (
                        <button 
                            key={ex.id} 
                            onClick={() => addExercise(ex.id)}
                            className="w-full p-5 bg-gray-50 rounded-2xl flex justify-between items-center hover:bg-gray-100"
                        >
                            <div className="text-left">
                                <p className="font-black">{ex.name}</p>
                                <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest">{ex.muscleGroup}</p>
                            </div>
                            <Plus size={20} className="text-blue-600" />
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ActiveWorkout;
