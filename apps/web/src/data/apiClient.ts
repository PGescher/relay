export async function apiPullWorkouts(params: {
  token: string;
  since: number;
  module?: string;
}) {
  const url = new URL('/api/sync/workouts', window.location.origin);
  url.searchParams.set('since', String(params.since));
  if (params.module) url.searchParams.set('module', params.module);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${params.token}` },
  });

  if (!res.ok) throw new Error(`sync pull failed: ${res.status}`);
  return res.json() as Promise<{
    serverTime: number;
    workouts: { workout: any; serverUpdatedAt: number; deletedAt: null }[];
    deleted: { id: string; deletedAt: number }[];
  }>;
}

export async function apiPushGymComplete(params: { token: string; payload: any }) {
  const res = await fetch('/api/workouts/gym/complete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify(params.payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`push failed: ${res.status} ${txt}`);
  }
  return res.json() as Promise<{ ok: true; workoutId: string; serverUpdatedAt?: number }>;
}
