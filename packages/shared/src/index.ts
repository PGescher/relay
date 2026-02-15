import { z } from 'zod';

export * from './session';


// =======================
// Auth schemas (NEW)
// =======================
export const SignupSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.]+$/, 'Only letters, numbers, _ and .'),
  displayName: z.string().min(2).max(64),
  email: z.string().email().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginSchema = z.object({
  identifier: z.string().min(3), // username OR email
  password: z.string(),
});

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export type Theme = 'light' | 'dark';

export type UserRole = 'ADMIN' | 'DEVELOPER' | 'TESTER' | 'USER';

export type User = {
  id: string;
  username: string;
  displayName: string;
  email?: string | null;

  role: UserRole;
  features: string[];

  theme: Theme;
};

// =======================
// Activity modules (align with Prisma enum)
// =======================
export const ActivityModuleSchema = z.enum(['GYM', 'RUN', 'BIKE', 'SWIM', 'TENNIS', 'PADEL']);
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

export const WorkoutStatusSchema = z.enum(['planned', 'active', 'completed', 'cancelled']);
export type WorkoutStatus = z.infer<typeof WorkoutStatusSchema>;



export interface WorkoutSession {
  dataVersion: 1;

  id: string;
  module: ActivityModule;
  name?: string;
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

      // how many sets this exercise should have
      targetSets: number;

      // default rest
      restSec: number;

      // ✅ NEW (optional): per-set defaults for templates
      // If present, ActiveWorkout can prefill weight/reps from here.
      sets?: Array<{
        reps?: number;
        weight?: number;
      }>;
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


// IMPORT SCHEMAS GYM MODULE

export const StrongCSVRowSchema = z.object({
  Datum: z.string(),
  "Workout-Name": z.string(),
  Dauer: z.string(),
  "Name der Übung": z.string(),
  "Reihenfolge festlegen": z.preprocess((val) => Number(val), z.number()),
  Gewicht: z.preprocess((val) => (typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val), z.number()),
  "Wiederh.": z.preprocess((val) => Number(val), z.number()),
  Entfernung: z.preprocess((val) => Number(val), z.number()),
  Sekunden: z.preprocess((val) => Number(val), z.number()),
  Notizen: z.string().optional(),
  "Workout-Notizen": z.string().optional(),
  RPE: z.preprocess((val) => (val && val !== "" ? parseFloat(String(val).replace(',', '.')) : null), z.number().nullable()),
});

export type StrongCSVRow = z.infer<typeof StrongCSVRowSchema>;