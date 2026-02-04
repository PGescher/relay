import express from 'express';
import cors from 'cors';

import { prisma } from './prisma.js';

import authRoutes from './auth.js';
import workoutRoutes from './workouts.js';
import templateRoutes from './templates.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/templates', templateRoutes);

app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

app.listen(3000, '0.0.0.0', () => {
  console.log('🚀 API Ready at http://localhost:3000');
});
