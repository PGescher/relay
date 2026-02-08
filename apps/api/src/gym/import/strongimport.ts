import { Router } from 'express';
import { prisma } from '../../prisma.js'; // Adjust path to your prisma client
import { StrongCSVRowSchema } from '@relay/shared'; 
import { randomUUID } from 'node:crypto'; // Use this for ID generation

import { requireAuth, type AuthedRequest } from '../../authMiddleware.js'; // Adjust paths

const router = Router();

const parseNum = (val: any) => {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const s = String(val).trim();
  if (!s) return null;
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

function parseStrongDurationToSeconds(input: unknown): number | null {
  if (!input) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;

  // "51min" | "1h 1min" | "2h 3min" | "42h 47min"
  const m = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?$/i);
  if (!m) return null;

  const hours = m[1] ? Number(m[1]) : 0;
  const mins = m[2] ? Number(m[2]) : 0;

  const total = hours * 3600 + mins * 60;
  return Number.isFinite(total) && total > 0 ? total : null;
}


// Strong's Datum has no timezone. Node will interpret it as server-local time.
// If you want it treated as Europe/Berlin explicitly, do it with luxon/date-fns-tz.
// For now keep your behavior consistent:
function parseStrongDate(input: unknown): Date {
  return new Date(String(input));
}

// TODO: NEEDS UPDATE!!!
// IMPORT: POST /api/import/strong
router.post('/strong', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!; // Set by requireAuth
  const { workouts, rows } = req.body;
  try {
    // 1. Group rows by Workout (Date + Name)
    const workoutsMap = new Map<string, any>();

    for (const row of rows) {
      const data = StrongCSVRowSchema.parse(row);
      const key = `${data.Datum}_${data["Workout-Name"]}`;

      if (!workoutsMap.has(key)) {
        workoutsMap.set(key, {
          name: data["Workout-Name"],
          startTime: new Date(data.Datum),
          notes: data["Workout-Notizen"],
          exercises: new Map<string, any[]>(),
        });
      }

      const workout = workoutsMap.get(key);
      const exName = data["Name der Übung"];
      if (!workout.exercises.has(exName)) workout.exercises.set(exName, []);
      workout.exercises.get(exName).push(data);
    }

    // 2. Transactional Database Insert
    await prisma.$transaction(async (tx) => {
        for (const [_, wData] of workoutsMap) {
        const workout = await tx.workout.create({
        data: {
            userId,
            name: wData.name,
            startTime: wData.startTime,
            module: "GYM",
            status: "completed",
            gym: { 
            create: { 
                notes: wData.notes 
            } 
            },
        },
        // This include is vital so 'workout.gym' is available below
        include: { 
            gym: true 
        }
        });

        // Use a type guard or non-null assertion safely
        if (!workout.gym) throw new Error("Failed to create Gym module");
        const gymId = workout.gym.id;

        let exOrder = 0;
        for (const [exName, sets] of wData.exercises) {
        const exercise = await tx.exercise.upsert({
            where: { userId_name: { userId, name: exName } },
            update: {},
            create: {
            id: randomUUID(), // Fix: use randomUUID
            userId,
            name: exName,
            type: "strength",
            }
        });

        const gymEx = await tx.workoutGymExercise.create({
            data: {
            workoutGymId: gymId,
            exerciseId: exercise.id,
            order: exOrder++,
            }
        });

        await tx.workoutGymSet.createMany({
            data: sets.map((s: any, idx: number) => ({
            workoutGymExerciseId: gymEx.id,
            reps: s["Wiederh."],
            weight: s.Gewicht,
            rpe: s.RPE,
            notes: s.Notizen,
            order: idx,
            isCompleted: true,
            completedAt: wData.startTime,
            }))
        });
        }
      }
    });

    res.json({ success: true, message: "Import complete" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Failed to parse or save data" });
  }
});

router.post('/strong-batch', requireAuth, async (req: AuthedRequest, res) => {
  const userId = req.userId!; // Set by requireAuth
  const { workouts } = req.body;

  try {
    await prisma.$transaction(async (tx) => {
      for (const w of workouts) {
        if (!w.rows || w.rows.length === 0) continue;
        
        const firstRow = w.rows[0];
        const startTime = new Date(firstRow.Datum);

        const durSec = parseStrongDurationToSeconds(firstRow.Dauer);
        const endTime = durSec ? new Date(startTime.getTime() + durSec * 1000) : startTime;


        // ✅ REDUNDANCY CHECK: Check if this workout already exists
        const existingWorkout = await tx.workout.findFirst({
            where: {
                userId,
                module: "GYM",
                deletedAt: null,
                startTime,
                name: w.name || firstRow["Workout-Name"] || "Strong Import",
            }
        });


        if (existingWorkout) {
        console.log(`Skipping duplicate workout: ${firstRow.Datum}`);
        continue; // Skip this workout and move to the next one in the loop
        }

        const workoutId = randomUUID();
        
        // group rows by exercise, preserving the original order and attaching rest rows
        type ImportedSet = {
        reps: number | null;
        weight: number | null;
        rpe: number | null;
        notes: string | null;
        durationSec: number | null;
        distanceM: number | null;
        restActualSec: number | null;
        completedAt: Date;
        };

        const exerciseGroups = new Map<string, ImportedSet[]>();

        for (const row of w.rows) {
        const exName = row["Name der Übung"];
        if (!exName) continue;

        if (!exerciseGroups.has(exName)) exerciseGroups.set(exName, []);
        const sets = exerciseGroups.get(exName)!;

        const isRest = row["Reihenfolge festlegen"] === "Ruhezeit";

        if (isRest) {
            // attach rest to previous set if possible
            const restSec = parseNum(row.Sekunden);
            if (sets.length > 0 && restSec !== null) {
            sets[sets.length - 1].restActualSec = Math.round(restSec);
            }
            continue;
        }

        const reps = parseNum(row["Wiederh."]);
        const weight = parseNum(row.Gewicht);
        const rpe = parseNum(row.RPE);
        const seconds = parseNum(row.Sekunden);
        const distance = parseNum(row.Entfernung);

        // Strong distance looks like km -> store meters
        const distanceM = distance !== null ? Math.round(distance * 1000) : null;

        sets.push({
            reps: reps !== null ? Math.round(reps) : null,
            weight: weight !== null ? weight : null,
            rpe: rpe !== null ? rpe : null,
            notes: row.Notizen ? String(row.Notizen) : null,
            durationSec: seconds !== null ? Math.round(seconds) : null,
            distanceM,
            restActualSec: null,
            completedAt: new Date(row.Datum),
        });
        }


        // 2. Prepare the JSON "data" snapshot (to match your existing workout schema)
        const logs = Array.from(exerciseGroups.entries()).map(([exName, sets]) => ({
            exerciseId: `imported_${exName.toLowerCase().replace(/\s+/g, '_')}`,
            exerciseName: exName,
            sets: sets.map((s) => ({
                id: randomUUID(),
                reps: s.reps ?? 0,
                weight: s.weight ?? 0,
                rpe: s.rpe ?? undefined,
                isCompleted: true,
                completedAt: s.completedAt.getTime(),
                // optional extras if your app reads them:
                durationSec: s.durationSec ?? undefined,
                distanceM: s.distanceM ?? undefined,
                restActualSec: s.restActualSec ?? undefined,
                notes: s.notes ?? undefined,
            })),
        }));


        // 3. Create the base Workout with the JSON data field
        const workout = await tx.workout.create({
            data: {
                id: workoutId,
                userId,
                name: w.name || firstRow["Workout-Name"] || "Strong Import",
                module: "GYM",
                status: "completed", // ✅ enum now
                startTime,
                endTime,
                data: {
                dataVersion: 1,
                id: workoutId,
                module: "GYM",
                status: "completed",
                startTime: startTime.getTime(),
                endTime: endTime.getTime(),
                durationSec: durSec ?? undefined,
                notes: firstRow["Workout-Notizen"] || "",
                logs,
                },
                gym: { create: { notes: firstRow["Workout-Notizen"] || "" } },
            },
            include: { gym: true },
            });



        // 4. Populate Structured Gym Tables (WorkoutGymExercise & Sets)
        const gymId = workout.gym!.id;
        let exOrder = 0;

        for (const [exName, sets] of exerciseGroups) {
            const exerciseId = `imported_${exName.toLowerCase().replace(/\s+/g, '_')}`;

            await tx.exercise.upsert({
                where: { id: exerciseId },
                update: {},
                create: {
                id: exerciseId,
                name: exName,
                userId: null,
                isCustom: false,
                },
            });

            const gymEx = await tx.workoutGymExercise.create({
                data: {
                workoutGymId: workout.gym!.id,
                exerciseId,
                order: exOrder++,
                },
            });

            await tx.workoutGymSet.createMany({
                data: sets.map((s, idx) => ({
                workoutGymExerciseId: gymEx.id,
                reps: s.reps,
                weight: s.weight,
                rpe: s.rpe,
                notes: s.notes || "",
                order: idx,
                isCompleted: true,
                completedAt: s.completedAt,

                // ✅ new:
                durationSec: s.durationSec,
                distanceM: s.distanceM,
                restActualSec: s.restActualSec,
                })),
            });
            }

      }
    });

    res.json({ success: true });
  } catch (err: any) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router

