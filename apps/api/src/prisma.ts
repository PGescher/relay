import pkgPg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pkgPg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
