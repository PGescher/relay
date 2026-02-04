import express from 'express';
import { z } from 'zod';
import { prisma } from './prisma.js';

import { requireAuth, type AuthedRequest } from './authMiddleware.js';

const router = express.Router();

const CompleteGymWorkoutSchema = z.object({
  workout: z.object({
    dataVersion: z.literal(1),
    id: z.string(),
    module: z.literal('GYM'),
    status: z.literal('completed'),
    startTime: z.number(),
    endTime: z.number(),
    durationSec: z.number().optional(),
    totalVolume: z.number().optional(),
    templateIdUsed: z.string().nullable().optional(),
    notes: z.string().optional(),
    rpeOverall: z.number().min(1).max(10).optional(),
    logs: z.array(
      z.object({
        exerciseId: z.string(),
        exerciseName: z.string(),
        restSecDefault: z.number().optional(),
        notes: z.string().optional(),
        sets: z.array(
          z.object({
            id: z.string(),
            reps: z.number(),
            weight: z.number(),
            isCompleted: z.boolean(),
            completedAt: z.number().optional(),
            startedEditingAt: z.number().optional(),
            restPlannedSec: z.number().optional(),
            restActualSec: z.number().optional(),
            rpe: z.number().optional(),
            durationSec: z.number().optional(),
          })
        ),
      })
    ),
  }),
  events: z.array(
    z.object({
      id: z.string(),
      workoutId: z.string(),
      at: z.number(),
      type: z.string(),
      payload: z.record(z.string(), z.any()).optional(),
    })
  ),
  restByExerciseId: z.record(z.string(), z.number()).optional(),
});

router.post('/gym/complete', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = CompleteGymWorkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

  const { workout, events, restByExerciseId } = parsed.data;
  if (!req.userId) return res.status(401).json({ error: 'No userId' });

  if (events.some((e) => e.workoutId !== workout.id)) {
    return res.status(400).json({ error: 'Event workoutId mismatch' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) Base workout upsert (keep JSON snapshot for backward compatibility)
      const savedWorkout = await tx.workout.upsert({
        where: { id: workout.id },
        update: {
          userId: req.userId!,
          module: workout.module,          // 'GYM' matches enum name
          status: 'COMPLETED',
          startTime: new Date(workout.startTime),
          endTime: new Date(workout.endTime),
          deletedAt: null,
          data: {
            ...workout,
            restByExerciseId: restByExerciseId ?? {},
            storedAt: Date.now(),
          },
        },
        create: {
          id: workout.id,
          userId: req.userId!,
          module: workout.module,
          status: 'COMPLETED',
          startTime: new Date(workout.startTime),
          endTime: new Date(workout.endTime),
          data: {
            ...workout,
            restByExerciseId: restByExerciseId ?? {},
            storedAt: Date.now(),
          },
        },
      });

      // 2) Ensure WorkoutGym (1:1)
      const gym = await tx.workoutGym.upsert({
        where: { workoutId: savedWorkout.id },
        update: { notes: workout.notes ?? null },
        create: { workoutId: savedWorkout.id, notes: workout.notes ?? null },
      });

      // 3) Create/ensure exercises exist (stubs if missing)
      // NOTE: if you want custom exercises per user, you can set userId/isCustom based on prefix ex_custom_
      for (const log of workout.logs) {
        await tx.exercise.upsert({
          where: { id: log.exerciseId },
          update: {
            // keep name in sync (optional)
            name: log.exerciseName,
          },
          create: {
            id: log.exerciseId,
            name: log.exerciseName,
            // optional: if id looks custom, attach to user
            userId: log.exerciseId.startsWith('ex_custom_') ? req.userId! : null,
            isCustom: log.exerciseId.startsWith('ex_custom_'),
            // the rest uses defaults from schema
          },
        });
      }

      // 4) Replace gym exercises+sets for this workout (idempotent save)
      // easiest: delete previous and recreate (since workout is "completed")
      await tx.workoutGymSet.deleteMany({
        where: { workoutGymExercise: { workoutGymId: gym.id } },
      });
      await tx.workoutGymExercise.deleteMany({
        where: { workoutGymId: gym.id },
      });

      // 5) Insert exercises + sets
      for (let i = 0; i < workout.logs.length; i++) {
        const log = workout.logs[i];

        const gymEx = await tx.workoutGymExercise.create({
          data: {
            workoutGymId: gym.id,
            exerciseId: log.exerciseId,
            order: i + 1,
            notes: log.notes ?? null,
          },
        });

        if (log.sets?.length) {
          await tx.workoutGymSet.createMany({
            data: log.sets.map((s) => ({
              workoutGymExerciseId: gymEx.id,
              reps: s.reps ?? null,
              weight: s.weight ?? null,
              durationSec: s.durationSec ?? null,
              isCompleted: s.isCompleted ?? false,
              completedAt: s.completedAt ? new Date(s.completedAt) : null,
              restPlannedSec: s.restPlannedSec ?? null,
              restActualSec: s.restActualSec ?? null,
            })),
          });
        }
      }

      // 6) Events (append-only, skip duplicates)
      await tx.workoutEvent.createMany({
        data: events.map((e) => ({
          id: e.id,
          workoutId: workout.id,
          at: new Date(e.at),
          type: e.type,
          payload: e.payload ?? undefined,
        })),
        skipDuplicates: true,
      });

      return savedWorkout;
    });

    return res.json({ ok: true, workoutId: result.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to store workout' });
  }
});


// list workouts (returns stored workout payloads from data)
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const module = String(req.query.module || '');
  const status = String(req.query.status || '');

  try {
    const rows = await prisma.workout.findMany({
      where: {
        userId: req.userId!,
        ...(module ? { module } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { startTime: 'desc' },
      take: 200,
    });

    const workouts = rows
      .map((r) => r.data)
      .filter(Boolean);

    return res.json({ workouts });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to list workouts' });
  }
});

router.get('/:id', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const row = await prisma.workout.findUnique({ where: { id: req.params.id } });
    if (!row || row.userId !== req.userId) return res.status(404).json({ error: 'Not found' });
    return res.json({ workout: row.data });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to fetch workout' });
  }
});

export default router;
