import { z } from 'zod';

// 1. Signup Validation (What we need from the user)
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

// 3. User Persistence (What we store/return)
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

// Workout Schema
export const WorkoutSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string(),
  module: ActivityModuleSchema,
  startTime: z.date().or(z.string()),
  endTime: z.date().or(z.string()).optional(),
  status: z.enum(['ACTIVE', 'COMPLETED', 'CANCELLED']),
});

export type Workout = z.infer<typeof WorkoutSchema>;

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  instructions?: string;
}

export interface SetLog {
  id: string;
  reps: number;
  weight: number;
  isCompleted: boolean;
}

export interface ExerciseLog {
  exerciseId: string;
  exerciseName: string;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  startTime: number;
  endTime?: number; // Add this line (the '?' means it's optional)
  logs: Array<{
    exerciseName: string;
    sets: any[];
  }>; // I also updated logs so TypeScript knows what's inside
  status: 'active' | 'completed';
  module: ActivityModule;
}

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
