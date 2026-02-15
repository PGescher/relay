import bcrypt from 'bcrypt';
import { prisma } from '../src/prisma.js';
import { UserRole, ExerciseType, BodyRegion, Equipment, WorkoutStatus } from '@prisma/client';

const ROUNDS = 12;

async function hash(pw: string) {
  return bcrypt.hash(pw, ROUNDS);
}

async function main() {
  // Users
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      displayName: 'Admin',
      role: UserRole.ADMIN,
      features: ['all_features', 'dev_api_toggle'],
      passwordHash: await hash('admin123'),
    },
  });

  const dev = await prisma.user.upsert({
    where: { username: 'dev' },
    update: {},
    create: {
      username: 'dev',
      displayName: 'Developer',
      role: UserRole.DEVELOPER,
      features: ['dev_api_toggle', 'gym_advanced_analytics', 'exports'],
      passwordHash: await hash('dev123'),
    },
  });

  const tester = await prisma.user.upsert({
    where: { username: 'tester' },
    update: {},
    create: {
      username: 'tester',
      displayName: 'Tester',
      role: UserRole.TESTER,
      features: ['dev_api_toggle'],
      passwordHash: await hash('tester123'),
    },
  });

  const defaultuser = await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: {
      username: 'user',
      displayName: 'User',
      role: UserRole.USER,
      features: [],
      passwordHash: await hash('user123'),
    },
  });

  // Built-in Exercises
  await prisma.exercise.createMany({
    data: [
      {
        id: 'ex_builtin_bench_press',
        userId: null,
        name: 'Bench Press',
        description: 'Klassische Langhantel-Drückübung.',
        type: ExerciseType.strength,
        muscleGroup: 'Chest',
        bodyRegion: BodyRegion.upper,
        equipment: [Equipment.barbell],
        primaryMuscles: ['Chest'],
        secondaryMuscles: ['Triceps', 'FrontDelts'],
        isCustom: false,
      },
      {
        id: 'ex_builtin_squat',
        userId: null,
        name: 'Back Squat',
        description: 'Grundübung für Unterkörperkraft.',
        type: ExerciseType.strength,
        muscleGroup: 'Legs',
        bodyRegion: BodyRegion.lower,
        equipment: [Equipment.barbell],
        primaryMuscles: ['Quads', 'Glutes'],
        secondaryMuscles: ['Hamstrings', 'LowerBack'],
        isCustom: false,
      },
    ],
    skipDuplicates: true,
  });

  // Example workout (module string works even if enum export is finicky)
  await prisma.workout.create({
    data: {
      userId: dev.id,
      module: 'GYM' as any,
      status: "completed",
      startTime: new Date(Date.now() - 60 * 60 * 1000),
      endTime: new Date(),
      data: { seed: true },
    },
  });

  console.log('Seed complete:', {
    admin: admin.username,
    dev: dev.username,
    tester: tester.username,
    user: defaultuser.username,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
