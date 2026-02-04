import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    seed: "pnpm exec tsx prisma/seed.ts",
  },
  //earlyAccess: true,
  datasource: {
    // For the 'generate' command in Docker, any valid-looking string works.
    // In production/runtime, it will use the real DATABASE_URL.
    url: process.env.DATABASE_URL || "postgresql://postgres:pass@localhost:5432/postgres",
  },
});