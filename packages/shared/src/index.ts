import { z } from 'zod';

// 1. Signup Validation
export const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

// 2. Login Validation
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// 3. User Persistence
export type User = {
  id: string;
  email: string;
  name: string;
  theme: 'light' | 'dark';
};

export type SignupInput = z.infer<typeof SignupSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// 4. Theme
export type Theme = 'light' | 'dark';

// Activity Types
export const ActivityModuleSchema = z.enum(['GYM', 'RUNNING', 'CYCLING']);
export type ActivityModule = z.infer<typeof ActivityModuleSchema>;

// DB-oriented Workout Schema (optional usage)
export const WorkoutSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string(),
  module: ActivityModuleSchema,
  startTime: z.date().or(z.string()),
  endTime: z.date().or(z.string()).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
});

export type Workout = z.infer<typeof WorkoutSchema>;

// Exercises
export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  instructions?: string;
}

// --- Logging / Tracking Types (Module State + Snapshot) ---

export interface SetLog {
  id: string;
  setNumber?: number; // optional helper for ordering (UI can compute)
  reps: number;
  weight: number;
  isCompleted: boolean;

  // Tracking additions (optional, safe for future)
  completedAt?: number;         // epoch ms when set was checked
  startedEditingAt?: number;    // epoch ms when user first entered something
  restPlannedSec?: number;      // planned rest duration (per exercise default)
  restActualSec?: number;       // actual rest duration (if you track stop)
  rpe?: number;                 // rating of perceived exertion (0-10)
  durationSec?: number;         // optional (if you track time-under-tension etc)
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];

  // per-exercise options (optional)
  restSecDefault?: number;      // planned default rest for this exercise
  notes?: string;
}

// Event log (append-only) for analytics + debugging
export type WorkoutEventType =
  | 'workout_started'
  | 'exercise_added'
  | 'exercise_deleted'
  | 'set_added'
  | 'set_deleted'
  | 'set_value_changed'
  | 'set_completed'
  | 'set_uncompleted'
  | 'rest_started'
  | 'rest_stopped'
  | 'workout_finished'
  | 'workout_cancelled';

export interface WorkoutEvent {
  id: string;
  workoutId: string;
  at: number; // epoch ms
  type: WorkoutEventType;
  payload?: Record<string, any>;
}

// Session object used by UI (your AppContext)
export interface WorkoutSession {
  id: string;
  startTime: number;
  endTime?: number;

  module: ActivityModule;

  status: 'active' | 'completed';

  // ✅ upgraded: use ExerciseLog[]
  logs: ExerciseLog[];

  // optional metadata
  templateIdUsed?: string | null;
  notes?: string;

  // optional computed/cached metrics
  totalVolume?: number;
  durationSec?: number;
}

// Feed Post type (unchanged)
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
