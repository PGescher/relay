import { storage, getJSON, setJSON } from './storage';

export type CachedWorkout = {
  id: string;
  module: string;
  data: any; // WorkoutSession
  serverUpdatedAt?: number;
};

export function loadWorkouts(userId: string): CachedWorkout[] {
  return getJSON<CachedWorkout[]>(storage.cacheKey(userId)) ?? [];
}

export function upsertWorkouts(userId: string, incoming: CachedWorkout[]) {
  const existing = loadWorkouts(userId);
  const map = new Map(existing.map((w) => [w.id, w]));

  for (const w of incoming) {
    const prev = map.get(w.id);
    if (!prev) map.set(w.id, w);
    else {
      const prevU = prev.serverUpdatedAt ?? 0;
      const nextU = w.serverUpdatedAt ?? 0;
      map.set(w.id, nextU >= prevU ? w : prev);
    }
  }

  setJSON(storage.cacheKey(userId), Array.from(map.values()));
}

export function deleteWorkouts(userId: string, ids: string[]) {
  const existing = loadWorkouts(userId);
  setJSON(storage.cacheKey(userId), existing.filter((w) => !ids.includes(w.id)));
}
