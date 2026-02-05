export const storage = {
  lastSyncKey: (userId: string) => `relay:lastSyncAt:${userId}`,
  pendingKey: (userId: string) => `relay:pendingWorkouts:${userId}`,
  pendingPayloadKey: (userId: string, workoutId: string) => `relay:pendingPayload:${userId}:${workoutId}`,
  cacheKey: (userId: string) => `relay:workoutsCache:${userId}`,
};

export function getNumber(key: string, fallback = 0) {
  const v = localStorage.getItem(key);
  const n = v ? Number(v) : fallback;
  return Number.isFinite(n) ? n : fallback;
}
export function setNumber(key: string, value: number) {
  localStorage.setItem(key, String(value));
}

export function getJSON<T>(key: string): T | null {
  const v = localStorage.getItem(key);
  if (!v) return null;
  try {
    return JSON.parse(v) as T;
  } catch {
    return null;
  }
}
export function setJSON(key: string, value: any) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getStringArray(key: string): string[] {
  const v = localStorage.getItem(key);
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}
export function setStringArray(key: string, value: string[]) {
  localStorage.setItem(key, JSON.stringify(value));
}
