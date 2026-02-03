import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { loadLastWorkoutDraft } from './workoutDraft';

export function useWorkoutDraftRestore() {
  const { currentWorkout, setCurrentWorkout } = useApp();
  const navigate = useNavigate();
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    if (currentWorkout) return;

    const draft = loadLastWorkoutDraft();
    if (!draft?.workout) return;

    if (draft.workout.status !== 'active') return;

    setCurrentWorkout(draft.workout);
    navigate('/activities/gym/active', { replace: true });
  }, [currentWorkout, setCurrentWorkout, navigate]);
}
