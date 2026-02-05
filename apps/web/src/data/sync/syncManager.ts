import { apiPullWorkouts, apiPushGymComplete } from '../apiClient';
import { storage, getNumber, setNumber } from '../storage';
import { upsertWorkouts, deleteWorkouts } from '../workoutCache';
import { listPending, getPendingPayload, dequeuePending } from './pendingQueue';
import { listPendingTemplates, getPendingTemplatePayload, dequeuePendingTemplate } from './pendingTemplates';

async function apiPushTemplate(token: string, payload: any) {
  // create vs update anhand payload.endpoint
  const res = await fetch(payload.endpoint, {
    method: payload.method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload.body),
  });
  if (!res.ok) throw new Error(`template push failed: ${res.status}`);
}

export async function syncNow(params: { userId: string; token: string; module?: string }) {
  const { userId, token, module } = params;

  // 1) Pending push (best-effort)
  const pending = listPending(userId);
  for (const workoutId of pending) {
    const payload = getPendingPayload(userId, workoutId);
    if (!payload) {
      dequeuePending(userId, workoutId);
      continue;
    }

    try {
      await apiPushGymComplete({ token, payload });
      dequeuePending(userId, workoutId);
    } catch {
      // likely offline or server down -> stop and retry later
      break;
    }
  }

  // 1b) Pending templates
  const pendingT = listPendingTemplates(userId);
  for (const tid of pendingT) {
    const payload = getPendingTemplatePayload(userId, tid);
    if (!payload) {
      dequeuePendingTemplate(userId, tid);
      continue;
    }
    try {
      await apiPushTemplate(token, payload);
      dequeuePendingTemplate(userId, tid);
    } catch {
      break;
    }
  }

  // 2) Pull
  const since = getNumber(storage.lastSyncKey(userId), 0);
  const pulled = await apiPullWorkouts({ token, since, module });

  // 3) Apply
  const incoming = pulled.workouts
    .filter((w) => w.workout)
    .map((w) => ({
      id: w.workout.id,
      module: w.workout.module,
      data: w.workout,
      serverUpdatedAt: w.serverUpdatedAt,
    }));

  upsertWorkouts(userId, incoming);
  deleteWorkouts(userId, pulled.deleted.map((d) => d.id));

  // 4) Advance lastSyncAt
  const maxUpdated = pulled.workouts.reduce((m, w) => Math.max(m, w.serverUpdatedAt), since);
  const maxDeleted = pulled.deleted.reduce((m, d) => Math.max(m, d.deletedAt), since);
  const nextSince = Math.max(maxUpdated, maxDeleted, pulled.serverTime);

  setNumber(storage.lastSyncKey(userId), nextSince);

  return { ok: true, pulled: incoming.length, deleted: pulled.deleted.length, nextSince };
}
