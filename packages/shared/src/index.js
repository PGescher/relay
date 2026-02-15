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
// Activity Types
export const ActivityModuleSchema = z.enum(['gym', 'running', 'cycling']);
// Workout Schema
export const WorkoutSchema = z.object({
    id: z.string().uuid().optional(),
    userId: z.string(),
    module: ActivityModuleSchema,
    startTime: z.date().or(z.string()),
    endTime: z.date().or(z.string()).optional(),
    status: z.enum(['active', 'completed', 'cancelled']),
});
