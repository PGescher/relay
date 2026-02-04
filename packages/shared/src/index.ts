import { z } from 'zod';

// Auth schemas
export const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export type Theme = 'light' | 'dark';

export type User = {
  id: string;
  email: string;
  name: string;
  theme: Theme;
};

// Activity
export const ActivityModuleSchema = z.enum(['GYM', 'RUNNING', 'CYCLING']);
export type ActivityModule = z.infer<typeof ActivityModuleSchema>;

// Exercise library type
export type ExerciseType =
  | 'strength'
  | 'cardio'
  | 'mobility'
  | 'stretch'
  | 'skill';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'cardio_machine'
  | 'other';

export type BodyRegion =
  | 'upper'
  | 'lower'
  | 'full'
  | 'core';

export type Muscle =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Arms'
  | 'Legs'
  | 'Abs'
  | 'Glutes'
  | 'Quads'
  | 'Hamstrings'
  | 'Calves'
  | 'LowerBack';

export interface Exercise {
  id: string;
  name: string;

  // ✅ ALT (bleibt)
  muscleGroup: string;

  // 🆕 NEU (optional!)
  description?: string;

  type?: ExerciseType;
  equipment?: Equipment[];

  bodyRegion?: BodyRegion;

  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];

  isCustom?: boolean;
}

// Logging types
export interface SetLog {
  id: string;

  reps: number;
  weight: number;

  isCompleted: boolean;

  // timestamps (ms)
  completedAt?: number;
  startedEditingAt?: number;

  // rest planning/tracking
  restPlannedSec?: number;
  restActualSec?: number;

  // optional future
  rpe?: number;          // per set (optional)
  durationSec?: number;  // set duration (optional)
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;

  restSecDefault?: number;
  notes?: string;

  sets: SetLog[];
}

export type WorkoutStatus = 'active' | 'completed' | 'cancelled';

export interface WorkoutSession {
  dataVersion: 1;

  id: string;
  module: ActivityModule;

  status: WorkoutStatus;

  updatedAt: number; // ms, whenever workout changes locally (finish sets it too)

  startTime: number;
  endTime?: number;

  durationSec?: number;

  // template linkage
  templateIdUsed?: string | null;

  // summary metrics
  totalVolume?: number;

  // post-workout rating
  rpeOverall?: number;

  notes?: string;

  logs: ExerciseLog[];
}

// Event stream for audit/debug/analytics
export type WorkoutEvent = {
  id: string;
  workoutId: string;
  at: number; // ms
  type:
    | 'exercise_added'
    | 'exercise_deleted'
    | 'set_added'
    | 'set_deleted'
    | 'set_value_changed'
    | 'set_completed'
    | 'set_uncompleted'
    | 'rest_started'
    | 'rest_stopped'
    | 'workout_finish_opened'
    | 'workout_finished'
    | 'workout_cancelled';
  payload?: Record<string, any>;
};

// Templates
export type WorkoutTemplate = {
  dataVersion: 1;

  id: string;
  module: ActivityModule;

  name: string;

  createdAt: number;
  updatedAt: number;

  data: {
    exercises: Array<{
      exerciseId: string;
      exerciseName: string;
      targetSets: number;
      restSec: number;
    }>;
  };
};

// Social feed placeholder
export interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  likes: number;
  timestamp: string;
  workoutPreview?: {
    name: string;
    stats: string;
  };
}
