-- DropIndex
DROP INDEX "Workout_userId_module_startTime_idx";

-- DropIndex
DROP INDEX "WorkoutEvent_workoutId_at_idx";

-- DropIndex
DROP INDEX "WorkoutTemplate_userId_module_updatedAt_idx";

-- CreateIndex
CREATE INDEX "WorkoutEvent_at_idx" ON "WorkoutEvent"("at");

-- CreateIndex
CREATE INDEX "WorkoutTemplate_module_idx" ON "WorkoutTemplate"("module");
