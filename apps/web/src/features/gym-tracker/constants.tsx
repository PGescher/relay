// src/features/gym-tracker/constants.ts
import type { Exercise } from '@relay/shared';

export const EXERCISES: Exercise[] = [
  // Chest
  { id: 'bench_press', name: 'Bench Press', muscleGroup: 'Chest', type: 'strength', equipment: ['barbell'], bodyRegion: 'upper', primaryMuscles: ['Chest'], secondaryMuscles: ['Arms', 'Shoulders'], description: 'Klassische Langhantel-Drückübung für Brust, Trizeps und Schultern.' },
  { id: 'incline_db_press', name: 'Incline Dumbbell Press', muscleGroup: 'Chest', type: 'strength', equipment: ['dumbbell'], bodyRegion: 'upper', primaryMuscles: ['Chest'], secondaryMuscles: ['Shoulders', 'Arms'] },
  { id: 'chest_fly_machine', name: 'Chest Fly (Machine)', muscleGroup: 'Chest', type: 'strength', equipment: ['machine'], bodyRegion: 'upper', primaryMuscles: ['Chest'] },
  { id: 'push_ups', name: 'Push Ups', muscleGroup: 'Chest', type: 'strength', equipment: ['bodyweight'], bodyRegion: 'upper', primaryMuscles: ['Chest'], secondaryMuscles: ['Arms', 'Shoulders'] },

  // Back
  { id: 'deadlift', name: 'Deadlift', muscleGroup: 'Back', type: 'strength', equipment: ['barbell'], bodyRegion: 'full', primaryMuscles: ['Back', 'Glutes'], secondaryMuscles: ['Hamstrings', 'LowerBack'] as any },
  { id: 'pull_ups', name: 'Pull Ups', muscleGroup: 'Back', type: 'strength', equipment: ['bodyweight'], bodyRegion: 'upper', primaryMuscles: ['Back'], secondaryMuscles: ['Arms'] },
  { id: 'lat_pulldown', name: 'Lat Pulldown', muscleGroup: 'Back', type: 'strength', equipment: ['cable', 'machine'], bodyRegion: 'upper', primaryMuscles: ['Back'], secondaryMuscles: ['Arms'] },
  { id: 'seated_row', name: 'Seated Cable Row', muscleGroup: 'Back', type: 'strength', equipment: ['cable'], bodyRegion: 'upper', primaryMuscles: ['Back'], secondaryMuscles: ['Arms'] },
  { id: 'one_arm_db_row', name: 'One-Arm Dumbbell Row', muscleGroup: 'Back', type: 'strength', equipment: ['dumbbell'], bodyRegion: 'upper', primaryMuscles: ['Back'], secondaryMuscles: ['Arms'] },
  { id: 'face_pulls', name: 'Face Pulls', muscleGroup: 'Shoulders', type: 'strength', equipment: ['cable'], bodyRegion: 'upper', primaryMuscles: ['Shoulders'], secondaryMuscles: ['Back'] },

  // Shoulders
  { id: 'overhead_press', name: 'Overhead Press', muscleGroup: 'Shoulders', type: 'strength', equipment: ['barbell'], bodyRegion: 'upper', primaryMuscles: ['Shoulders'], secondaryMuscles: ['Arms'] },
  { id: 'db_shoulder_press', name: 'Dumbbell Shoulder Press', muscleGroup: 'Shoulders', type: 'strength', equipment: ['dumbbell'], bodyRegion: 'upper', primaryMuscles: ['Shoulders'], secondaryMuscles: ['Arms'] },
  { id: 'lateral_raises', name: 'Lateral Raises', muscleGroup: 'Shoulders', type: 'strength', equipment: ['dumbbell'], bodyRegion: 'upper', primaryMuscles: ['Shoulders'] },
  { id: 'rear_delt_fly', name: 'Rear Delt Fly', muscleGroup: 'Shoulders', type: 'strength', equipment: ['dumbbell', 'machine'], bodyRegion: 'upper', primaryMuscles: ['Shoulders'], secondaryMuscles: ['Back'] },

  // Legs
  { id: 'squat', name: 'Squat', muscleGroup: 'Legs', type: 'strength', equipment: ['barbell'], bodyRegion: 'lower', primaryMuscles: ['Quads', 'Glutes'], secondaryMuscles: ['Hamstrings', 'LowerBack'] },
  { id: 'front_squat', name: 'Front Squat', muscleGroup: 'Legs', type: 'strength', equipment: ['barbell'], bodyRegion: 'lower', primaryMuscles: ['Quads'], secondaryMuscles: ['Glutes', 'LowerBack'] },
  { id: 'leg_press', name: 'Leg Press', muscleGroup: 'Legs', type: 'strength', equipment: ['machine'], bodyRegion: 'lower', primaryMuscles: ['Quads'], secondaryMuscles: ['Glutes', 'Hamstrings'] },
  { id: 'romanian_deadlift', name: 'Romanian Deadlift', muscleGroup: 'Legs', type: 'strength', equipment: ['barbell', 'dumbbell'], bodyRegion: 'lower', primaryMuscles: ['Hamstrings', 'Glutes'], secondaryMuscles: ['LowerBack'] },
  { id: 'leg_extension', name: 'Leg Extension', muscleGroup: 'Legs', type: 'strength', equipment: ['machine'], bodyRegion: 'lower', primaryMuscles: ['Quads'] },
  { id: 'leg_curl', name: 'Leg Curl', muscleGroup: 'Legs', type: 'strength', equipment: ['machine'], bodyRegion: 'lower', primaryMuscles: ['Hamstrings'] },
  { id: 'calf_raises', name: 'Calf Raises', muscleGroup: 'Legs', type: 'strength', equipment: ['machine', 'bodyweight'], bodyRegion: 'lower', primaryMuscles: ['Calves'] },

  // Arms
  { id: 'bicep_curls', name: 'Bicep Curls', muscleGroup: 'Arms', type: 'strength', equipment: ['dumbbell', 'barbell'], bodyRegion: 'upper', primaryMuscles: ['Arms'] },
  { id: 'hammer_curls', name: 'Hammer Curls', muscleGroup: 'Arms', type: 'strength', equipment: ['dumbbell'], bodyRegion: 'upper', primaryMuscles: ['Arms'] },
  { id: 'tricep_pushdown', name: 'Tricep Pushdown', muscleGroup: 'Arms', type: 'strength', equipment: ['cable'], bodyRegion: 'upper', primaryMuscles: ['Arms'] },
  { id: 'tricep_overhead_ext', name: 'Overhead Tricep Extension', muscleGroup: 'Arms', type: 'strength', equipment: ['dumbbell', 'cable'], bodyRegion: 'upper', primaryMuscles: ['Arms'] },

  // Core
  { id: 'plank', name: 'Plank', muscleGroup: 'Abs', type: 'strength', equipment: ['bodyweight'], bodyRegion: 'core', primaryMuscles: ['Abs'] },
  { id: 'hanging_knee_raise', name: 'Hanging Knee Raise', muscleGroup: 'Abs', type: 'strength', equipment: ['bodyweight'], bodyRegion: 'core', primaryMuscles: ['Abs'] },
  { id: 'cable_crunch', name: 'Cable Crunch', muscleGroup: 'Abs', type: 'strength', equipment: ['cable'], bodyRegion: 'core', primaryMuscles: ['Abs'] },
];
