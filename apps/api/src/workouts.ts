import express from 'express';
import { z } from 'zod';
import { prisma } from './index.js';
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
    const saved = await prisma.workout.upsert({
      where: { id: workout.id },
      update: {
        userId: req.userId,
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
      create: {
        id: workout.id,
        userId: req.userId,
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

    // If you have WorkoutEvent model:
    await prisma.workoutEvent.createMany({
      data: events.map((e) => ({
        id: e.id,
        workoutId: workout.id,
        at: new Date(e.at),
        type: e.type,
        payload: e.payload ?? undefined,
      })),
      skipDuplicates: true,
    });

    return res.json({ ok: true, workoutId: saved.id });
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
