import express from 'express';
import { prisma } from './prisma.js';
import { requireAuth, type AuthedRequest } from './authMiddleware.js';

const router = express.Router();

// GET /api/sync/workouts?since=1700000000000&module=GYM
router.get('/workouts', requireAuth, async (req: AuthedRequest, res) => {
  const since = Number(req.query.since || 0);
  const module = String(req.query.module || '');

  if (!Number.isFinite(since) || since < 0) {
    return res.status(400).json({ error: 'Invalid since' });
  }

  try {
    const rows = await prisma.workout.findMany({
      where: {
        userId: req.userId!,
        ...(module ? { module: module as any } : {}),
        OR: [
          { updatedAt: { gt: new Date(since) } },
          { deletedAt: { gt: new Date(since) } },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: 200,
      select: {
        id: true,
        updatedAt: true,
        deletedAt: true,
        data: true,
      },
    });

    const workouts = rows
      .filter((r) => !r.deletedAt)
      .map((r) => ({
        workout: r.data,
        serverUpdatedAt: r.updatedAt.getTime(),
        deletedAt: null,
      }))
      .filter((x) => x.workout);

    const deleted = rows
      .filter((r) => r.deletedAt)
      .map((r) => ({ id: r.id, deletedAt: r.deletedAt!.getTime() }));

    return res.json({
      serverTime: Date.now(),
      workouts,
      deleted,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to sync' });
  }
});

export default router;
