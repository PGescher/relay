import type { WorkoutEvent, WorkoutSession } from '@relay/shared';

export type WorkoutDraft = {
  workout: WorkoutSession;
  events: WorkoutEvent[];
  restByExerciseId: Record<string, number>;
  updatedAt: number;
};

const draftKey = (workoutId: string) => `relay:gym:draft:${workoutId}`;

export function saveWorkoutDraft(draft: WorkoutDraft) {
  try {
    localStorage.setItem(draftKey(draft.workout.id), JSON.stringify(draft));
  } catch {
    // ignore
  }
}

export function loadWorkoutDraft(workoutId: string): WorkoutDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(workoutId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.workout?.id) return null;
    return parsed as WorkoutDraft;
  } catch {
    return null;
  }
}

export function clearWorkoutDraft(workoutId: string) {
  try {
    localStorage.removeItem(draftKey(workoutId));
  } catch {
    // ignore
  }
}
