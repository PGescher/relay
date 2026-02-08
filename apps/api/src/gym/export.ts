import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, type AuthedRequest } from '../authMiddleware.js';

const router = Router();

// EXPORT: GET /api/export (authed user)
router.get('/', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!;

  const workouts = await prisma.workout.findMany({
    where: { userId, module: 'GYM', deletedAt: null },
    orderBy: { startTime: 'asc' },
    include: {
      gym: {
        include: {
          exercises: {
            orderBy: { order: 'asc' },
            include: {
              exercise: true,
              sets: { orderBy: { order: 'asc' } },
            },
          },
        },
      },
    },
  });

  const exportRows = workouts.flatMap((w) => {
    const start = w.startTime;
    const end = w.endTime ?? w.startTime;

    const durationSec = Math.max(0, Math.round((end.getTime() - start.getTime()) / 1000));
    const durationMin = Math.round(durationSec / 60);

    return (
      w.gym?.exercises.flatMap((ge) =>
        ge.sets.map((s) => ({
          StartTime: start.toISOString(),
          EndTime: end.toISOString(),
          DurationMin: durationMin,

          Workout: w.name || 'Unnamed Workout',
          Exercise: ge.exercise.name,

          Weight: s.weight ?? 0,
          Reps: s.reps ?? 0,
          RPE: s.rpe ?? '',

          // ✅ from your schema (will be null/0 unless importer writes them)
          SetDurationSec: s.durationSec ?? '',
          DistanceM: s.distanceM ?? '',
          RestActualSec: s.restActualSec ?? '',
          Notes: s.notes ?? '',
        }))
      ) ?? []
    );
  });

  res.json(exportRows);
});

export default router;
