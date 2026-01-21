import React, { createContext, useContext, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutSession } from '@relay/shared'; 


interface AppContextType {
  // Use the shared type instead of the local 'Workout' interface
  currentWorkout: WorkoutSession | null;
  setCurrentWorkout: (workout: WorkoutSession | null) => void;
  workoutHistory: WorkoutSession[];
  setWorkoutHistory: React.Dispatch<React.SetStateAction<WorkoutSession[]>>;
  setActiveTab: (tab: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentWorkout, setCurrentWorkout] = useState<WorkoutSession | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const navigate = useNavigate();

  const setActiveTab = (tab: string) => {
    if (tab === 'history') navigate('/activities');
    if (tab === 'home') navigate('/home');
    if (tab === 'gym') navigate('/activities/gym');
  };

  return (
    <AppContext.Provider value={{ 
      currentWorkout, 
      setCurrentWorkout, 
      workoutHistory, 
      setWorkoutHistory,
      setActiveTab 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};