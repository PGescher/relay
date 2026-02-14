import { storage, getStringArray, setStringArray, setJSON, getJSON } from '../storage';

export function enqueuePending(userId: string, workoutId: string, payload: any) {
  const q = getStringArray(storage.pendingKey(userId));
  if (!q.includes(workoutId)) q.push(workoutId);
  setStringArray(storage.pendingKey(userId), q);
  setJSON(storage.pendingPayloadKey(userId, workoutId), payload);
}

export function dequeuePending(userId: string, workoutId: string) {
  const q = getStringArray(storage.pendingKey(userId)).filter((id) => id !== workoutId);
  setStringArray(storage.pendingKey(userId), q);
  localStorage.removeItem(storage.pendingPayloadKey(userId, workoutId));
}

export function listPending(userId: string) {
  return getStringArray(storage.pendingKey(userId));
}

export function getPendingPayload(userId: string, workoutId: string): any | null {
  return getJSON<any>(storage.pendingPayloadKey(userId, workoutId));
}