import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { SignupSchema, LoginSchema } from '@relay/shared';
import { prisma } from './prisma.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-123';

const router = express.Router();

function isEmail(s: unknown): s is string {
  return typeof s === 'string' && s.includes('@');
}

router.post('/signup', async (req, res) => {
  try {
    const validation = SignupSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: validation.error.format() });

    const { username, displayName, email, password } = validation.data as any;
    if (!username || !displayName || !password) {
      return res.status(400).json({ error: 'Invalid payload (missing username/displayName/password)' });
    }

    // Uniqueness checks
    const existingByUsername = await prisma.user.findUnique({ where: { username } });
    if (existingByUsername) return res.status(400).json({ error: 'Username already exists' });

    if (email) {
      const existingByEmail = await prisma.user.findUnique({ where: { email } });
      if (existingByEmail) return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        displayName,
        email: email ?? null,
        passwordHash,
        // role defaults to USER by schema
        // features defaults to [] by schema
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        features: true,
      },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const validation = LoginSchema.safeParse(req.body);
    if (!validation.success) return res.status(400).json({ error: 'Invalid input' });

    const { identifier, password } = validation.data;

    const user = await prisma.user.findUnique({
      where: isEmail(identifier) ? { email: identifier } : { username: identifier },
    });

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        features: user.features,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        role: true,
        features: true,
      },
    });

    if (!user) return res.status(401).json({ error: 'Invalid token' });
    return res.json(user);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
