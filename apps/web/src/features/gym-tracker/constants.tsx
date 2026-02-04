import { Exercise } from '@relay/shared';

export const EXERCISES: Exercise[] = [
  {
  id: '1',
  name: 'Bench Press',
  muscleGroup: 'Chest',

  description: 'Klassische Langhantel-Drückübung für Brust, Trizeps und Schultern.',
  type: 'strength',
  equipment: ['barbell'],
  bodyRegion: 'upper',
  primaryMuscles: ['Chest'],
  secondaryMuscles: ['Arms', 'Shoulders'],
  isCustom: false,
  },

  {
  id: '2',
  name: 'Squats',
  muscleGroup: 'Legs',

  description: 'Grundübung für Unterkörperkraft und Ganzkörperstabilität.',
  type: 'strength',
  equipment: ['barbell'],
  bodyRegion: 'lower',
  primaryMuscles: ['Quads', 'Glutes'],
  secondaryMuscles: ['Hamstrings', 'LowerBack'],
  isCustom: false,
  },
  
  { id: '3', name: 'Deadlift', muscleGroup: 'Back' },
  { id: '4', name: 'Overhead Press', muscleGroup: 'Shoulders' },
  { id: '5', name: 'Pull Ups', muscleGroup: 'Back' },
  { id: '6', name: 'Bicep Curls', muscleGroup: 'Arms' },
  { id: '7', name: 'Tricep Extensions', muscleGroup: 'Arms' },
  { id: '8', name: 'Leg Press', muscleGroup: 'Legs' },
];
