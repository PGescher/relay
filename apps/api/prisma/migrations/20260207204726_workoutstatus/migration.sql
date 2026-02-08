/*
  Warnings:

  - The `status` column on the `Workout` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('planned', 'active', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "Workout" DROP COLUMN "status",
ADD COLUMN     "status" "WorkoutStatus" NOT NULL DEFAULT 'planned';
