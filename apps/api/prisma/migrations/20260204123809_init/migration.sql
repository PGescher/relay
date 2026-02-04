-- CreateEnum
CREATE TYPE "WorkoutModule" AS ENUM ('GYM', 'RUN', 'BIKE', 'SWIM', 'TENNIS', 'PADEL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'DEVELOPER', 'TESTER', 'USER');

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('strength', 'cardio', 'mobility', 'stretch', 'skill');

-- CreateEnum
CREATE TYPE "BodyRegion" AS ENUM ('upper', 'lower', 'full', 'core');

-- CreateEnum
CREATE TYPE "Equipment" AS ENUM ('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'cardio_machine', 'other');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "WorkoutModule" NOT NULL,
    "status" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutEvent" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "payload" JSONB,

    CONSTRAINT "WorkoutEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" "WorkoutModule" NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ExerciseType" NOT NULL DEFAULT 'strength',
    "muscleGroup" TEXT NOT NULL DEFAULT 'Unknown',
    "bodyRegion" "BodyRegion" NOT NULL DEFAULT 'upper',
    "equipment" "Equipment"[] DEFAULT ARRAY[]::"Equipment"[],
    "primaryMuscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secondaryMuscles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutGym" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "WorkoutGym_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutGymExercise" (
    "id" TEXT NOT NULL,
    "workoutGymId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "WorkoutGymExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutGymSet" (
    "id" TEXT NOT NULL,
    "workoutGymExerciseId" TEXT NOT NULL,
    "reps" INTEGER,
    "weight" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "distanceM" INTEGER,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "restPlannedSec" INTEGER,
    "restActualSec" INTEGER,

    CONSTRAINT "WorkoutGymSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutRun" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "distanceM" INTEGER,
    "durationSec" INTEGER,
    "elevationGainM" INTEGER,
    "avgHr" INTEGER,
    "avgPaceSecPerKm" INTEGER,
    "notes" TEXT,

    CONSTRAINT "WorkoutRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Workout_userId_startTime_idx" ON "Workout"("userId", "startTime");

-- CreateIndex
CREATE INDEX "Workout_module_startTime_idx" ON "Workout"("module", "startTime");

-- CreateIndex
CREATE INDEX "Workout_deletedAt_idx" ON "Workout"("deletedAt");

-- CreateIndex
CREATE INDEX "WorkoutEvent_workoutId_idx" ON "WorkoutEvent"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutEvent_at_idx" ON "WorkoutEvent"("at");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_userId_module_idx" ON "WorkoutTemplate"("userId", "module");

-- CreateIndex
CREATE INDEX "Exercise_userId_idx" ON "Exercise"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_userId_name_key" ON "Exercise"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutGym_workoutId_key" ON "WorkoutGym"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutGymExercise_workoutGymId_idx" ON "WorkoutGymExercise"("workoutGymId");

-- CreateIndex
CREATE INDEX "WorkoutGymExercise_exerciseId_idx" ON "WorkoutGymExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutGymSet_workoutGymExerciseId_idx" ON "WorkoutGymSet"("workoutGymExerciseId");

-- CreateIndex
CREATE INDEX "WorkoutGymSet_completedAt_idx" ON "WorkoutGymSet"("completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutRun_workoutId_key" ON "WorkoutRun"("workoutId");

-- AddForeignKey
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutEvent" ADD CONSTRAINT "WorkoutEvent_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTemplate" ADD CONSTRAINT "WorkoutTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutGym" ADD CONSTRAINT "WorkoutGym_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutGymExercise" ADD CONSTRAINT "WorkoutGymExercise_workoutGymId_fkey" FOREIGN KEY ("workoutGymId") REFERENCES "WorkoutGym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutGymExercise" ADD CONSTRAINT "WorkoutGymExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutGymSet" ADD CONSTRAINT "WorkoutGymSet_workoutGymExerciseId_fkey" FOREIGN KEY ("workoutGymExerciseId") REFERENCES "WorkoutGymExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutRun" ADD CONSTRAINT "WorkoutRun_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
