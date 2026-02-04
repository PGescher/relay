import express from 'express';
import { z } from 'zod';
import { prisma } from './prisma.js';

import { requireAuth, type AuthedRequest } from './authMiddleware.js';

const router = express.Router();

const TemplateSchema = z.object({
  dataVersion: z.literal(1),
  id: z.string(),
  module: z.literal('GYM'),
  name: z.string().min(1),
  createdAt: z.number(),
  updatedAt: z.number(),
  data: z.object({
    exercises: z.array(
      z.object({
        exerciseId: z.string(),
        exerciseName: z.string(),
        targetSets: z.number().int().min(1).max(20),
        restSec: z.number().int().min(0).max(600),
      })
    ),
  }),
});

router.get('/gym', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const rows = await prisma.workoutTemplate.findMany({
      where: { userId: req.userId!, module: 'GYM' },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const templates = rows.map((t) => ({
      dataVersion: 1,
      id: t.id,
      module: 'GYM',
      name: t.name,
      createdAt: t.createdAt.getTime(),
      updatedAt: t.updatedAt.getTime(),
      data: t.data as any,
    }));

    return res.json({ templates });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to list templates' });
  }
});

router.post('/gym', requireAuth, async (req: AuthedRequest, res) => {
  const parsed = TemplateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

  try {
    const t = parsed.data;
    await prisma.workoutTemplate.create({
      data: {
        id: t.id,
        userId: req.userId!,
        module: 'GYM',
        name: t.name,
        data: t.data,
      },
    });

    return res.json({ ok: true, templateId: t.id });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to create template' });
  }
});

router.put('/gym/:id', requireAuth, async (req: AuthedRequest, res) => {
  const Body = z.object({
    name: z.string().nullable().optional(),
    dataVersion: z.literal(1),
    data: z.any(),
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });

  try {
    const existing = await prisma.workoutTemplate.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) return res.status(404).json({ error: 'Not found' });

    await prisma.workoutTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        data: parsed.data.data,
      },
    });

    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to update template' });
  }
});

export default router;
