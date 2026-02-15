// apps/web/src/features/gym-tracker/gymSessionAdapter.tsx

import React, { forwardRef } from 'react';
import type { SessionModuleAdapter, WorkoutSession, WorkoutEvent } from '@relay/shared';
import type { WorkoutTemplate } from '@relay/shared';

import { saveWorkoutDraft, clearWorkoutDraft, loadLastWorkoutDraft } from './workoutDraft';
import { apiPushGymComplete } from '../../data/apiClient';
import { enqueuePending } from '../../data/sync/pendingQueue';
import { enqueuePendingTemplate } from '../../data/sync/pendingTemplates';
import { upsertWorkouts } from '../../data/workoutCache';
import { syncNow } from '../../data/sync/syncManager';

import { ActiveWorkoutOverlay, type ActiveWorkoutOverlayHandle } from './GymExpandedSessionView';

import { registerModule } from '../../session/moduleRegistry';

const MINIMIZE_EVENT = 'relay:overlay:minimize';

function requestOverlayMinimize() {
  window.dispatchEvent(new CustomEvent(MINIMIZE_EVENT));
}

// Minimal placeholder (you can implement later)
function GymMinimizedPill(_props: { sessionId: string; state: any }) {
  return null;
}

const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export type GymSessionState = {
  workout: WorkoutSession;
  events: WorkoutEvent[];
  restByExerciseId: Record<string, number>;
  order?: string[];
  // Finish-bridge (damit Adapter weiß, was zu tun ist)
  finishRequest?: {
    workout: WorkoutSession; // final finished version
    opts: {
      policy: 'delete' | 'complete';
      rpeOverall?: number;
      saveAsTemplate: boolean;
      templateName?: string;
      updateUsedTemplate: boolean;
    };
  };
};

function normalizeWorkout(input?: WorkoutSession): WorkoutSession {
  const now = Date.now();
  const base: WorkoutSession = input ?? {
    dataVersion: 1,
    id: uid(),
    startTime: now,
    updatedAt: now,
    status: 'active',
    module: 'GYM',
    logs: [],
  };

  return {
    ...base,
    status: base.status ?? 'active',
    module: 'GYM',
    logs: (base.logs ?? []).map((l: any) => ({
      logId: l.logId ?? uid(),
      exerciseId: l.exerciseId,
      exerciseName: l.exerciseName,
      restSecDefault: l.restSecDefault ?? l.restSec ?? 120,
      sets: (l.sets ?? []).map((s: any) => ({
        id: s.id ?? uid(),
        reps: s.reps ?? 0,
        weight: s.weight ?? 0,
        isCompleted: !!s.isCompleted,
        restPlannedSec: s.restPlannedSec ?? l.restSecDefault ?? l.restSec ?? 120,
      })),
    })),
  };
}

//Template Helper
const TEMPLATE_CACHE_KEY = (key: string) => `relay:templates:${key}:v1`;

function loadTemplates(key: string): WorkoutTemplate[] {
  try {
    const raw = localStorage.getItem(TEMPLATE_CACHE_KEY(key));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as WorkoutTemplate[]) : [];
  } catch {
    return [];
  }
}

function upsertTemplates(key: string, incoming: WorkoutTemplate[]) {
  try {
    const existing = loadTemplates(key);
    const map = new Map(existing.map((t: any) => [t.id, t]));
    for (const t of incoming) map.set((t as any).id, t as any);
    localStorage.setItem(TEMPLATE_CACHE_KEY(key), JSON.stringify(Array.from(map.values())));
  } catch {
    // ignore
  }
}

function clampInt(n: any, min: number, max: number, fallback: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  const i = Math.round(v);
  return Math.min(max, Math.max(min, i));
}

function templateFromWorkout(workout: WorkoutSession, name: string, templateId?: string): WorkoutTemplate {
  const id = templateId ?? (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const now = Date.now();

  return {
    dataVersion: 1,
    id,
    module: 'GYM' as any,
    name,
    createdAt: (workout as any).templateCreatedAt ?? now,
    updatedAt: now,
    data: {
      exercises: workout.logs.map((l: any) => {
        const setsArr = Array.isArray(l.sets) ? l.sets : [];
        const targetSets = clampInt(setsArr.length || 1, 1, 20, 1);
        const restSec = clampInt(l.restSecDefault ?? l.restSec ?? 120, 0, 600, 120);

        return {
          exerciseId: String(l.exerciseId),
          exerciseName: String(l.exerciseName ?? ''),
          targetSets,
          restSec,
          sets: setsArr.map((s: any) => ({
            reps: clampInt(s?.reps ?? 0, 0, 999, 0),
            weight: Number.isFinite(Number(s?.weight)) ? Number(s.weight) : 0,
          })),
        };
      }),
    },
  } as any;
}

/**
 * Server best-effort. Falls deine API andere Pfade nutzt, kannst du hier zentral anpassen.
 * - create: POST /api/workout-templates
 * - update: PUT  /api/workout-templates/:id
 */
async function apiCreateTemplate(token: string, template: WorkoutTemplate) {
  const res = await fetch('/api/templates/gym', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(template),
  });
  if (!res.ok) throw new Error(`Create template failed: ${res.status}`);
  return res.json().catch(() => null);
}

async function apiUpdateTemplate(token: string, id: string, template: WorkoutTemplate, nameOverride?: string) {
  const body: any = { dataVersion: 1, data: template.data };
  if (nameOverride && nameOverride.trim()) body.name = nameOverride.trim();

  const res = await fetch(`/api/templates/gym/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Update template failed: ${res.status}`);
}


// helper: find existing template name
function getExistingTemplateName(templateKey: string, templateId: string): string | undefined {
  try {
    const existing = loadTemplates(templateKey);
    return existing.find((t: any) => t?.id === templateId)?.name;
  } catch {
    return undefined;
  }
}

/**
 * v0.0.1 adapter for Gym session.
 * State is kernel-owned (ActiveSession.state), treated as opaque by AppShell/kernel.
 */
export const gymSessionAdapter: SessionModuleAdapter<GymSessionState, any> = {
  module: 'GYM',

  createInitialState(payload) {
    const workout = normalizeWorkout(payload as WorkoutSession | undefined);
    return {
      workout,
      events: [],
      restByExerciseId: {},
      order: workout.logs.map((l: any) => l.logId),
    } satisfies GymSessionState;
  },


  // Important: forwardRef so ActiveSessionOverlay can keep scrollTop (optional)
  ExpandedView: forwardRef<ActiveWorkoutOverlayHandle, { sessionId: string; state: GymSessionState; api: any }>(
    function GymExpanded(props, ref) {
      return (
        <ActiveWorkoutOverlay
          ref={ref}
          mode="expanded"
          onRequestMinimize={requestOverlayMinimize}
          sessionId={props.sessionId}
          state={props.state}
          api={props.api}
        />
      );
    }
  ),

  MinimizedView: GymMinimizedPill,

  async onFinish({ state, ctx }) {

    console.log('[GYM onFinish] req?', !!state.finishRequest, state.finishRequest);

    const req = state.finishRequest;
    if (!req) return;

    const finished2 = req.workout;
    const { events, restByExerciseId } = state;
    const completePayload = { workout: finished2, events, restByExerciseId };

    const userId = ctx.userId;
    const token = ctx.token;

    // ---- 1) workout cache + push/sync (dein bestehendes verhalten) ----
    if (userId) {
      upsertWorkouts(userId, [{ id: finished2.id, module: finished2.module, data: finished2 }]);
    }

    let pushed = false;
    try {
      if (!token || !userId) throw new Error('No auth');
      await apiPushGymComplete({ token, payload: completePayload });
      pushed = true;
    } catch {
      if (userId) enqueuePending(userId, finished2.id, completePayload);
    }

    if (pushed && userId && token) {
      syncNow({ userId, token, module: 'GYM' }).catch(() => {});
    }

    // ---- 2) notify UI (History/Analytics) immediately (optional, aber hilft) ----
    try {
      window.dispatchEvent(new CustomEvent('relay:gym:workoutFinished', { detail: finished2 }));
    } catch {}

    // ---- 3) templates handling (NEU) ----
    const opts = req.opts;

    //if (!userId) return; // ohne userId macht cache keinen Sinn; server auch nicht (auth fehlt meist)

    const templateKey = userId ?? 'anon'; // ✅ fallback
    // 3a) update used template
    if (opts.updateUsedTemplate && (finished2 as any).templateIdUsed) {
      const templateId = (finished2 as any).templateIdUsed as string;

      const existingName = getExistingTemplateName(templateKey, templateId);
      const providedName = opts.templateName?.trim();

      const name = (providedName && providedName.length > 0)
      ? providedName
      : (existingName ?? 'Updated Template'); // last fallback only if we truly don't know
      const updatedTemplate = templateFromWorkout(finished2, name, templateId);

      // optimistic local update
      upsertTemplates(templateKey, [updatedTemplate]);
      try {
        window.dispatchEvent(new CustomEvent('relay:gym:templateUpserted', { detail: updatedTemplate }));
      } catch {}

      // server best-effort
      if (token) {
        try {
          await apiUpdateTemplate(token, templateId, updatedTemplate);
        } catch (e) {
          enqueuePendingTemplate(templateKey, updatedTemplate.id, {
            endpoint: '/api/templates/gym/${templateId}',
            method: 'PUT',
            body: updatedTemplate,
          });
          console.warn('Template update failed (queued + kept local)', e);
        }
      } else {
        enqueuePendingTemplate(templateKey, updatedTemplate.id, {
          endpoint: '/api/templates/gym/${templateId}',
          method: 'PUT',
          body: updatedTemplate,
        });
      }
    }

    // 3b) save as new template
    if (opts.saveAsTemplate) {
      const name = (opts.templateName?.trim() || 'My Template');
      const newTemplate = templateFromWorkout(finished2, name);

      // optimistic local update
      upsertTemplates(templateKey, [newTemplate]);
      try {
        window.dispatchEvent(new CustomEvent('relay:gym:templateUpserted', { detail: newTemplate }));
      } catch {}

      // server best-effort (falls backend existiert)
      if (token) {
        try {
          await apiCreateTemplate(token, newTemplate);
        } catch (e) {
          enqueuePendingTemplate(templateKey, newTemplate.id, {
            endpoint: '/api/templates/gym',
            method: 'POST',
            body: newTemplate,
          });
          console.warn('Template create failed (queued + kept local)', e);
        }
      } else {
        enqueuePendingTemplate(templateKey, newTemplate.id, {
          endpoint: '/api/templates/gym',
          method: 'POST',
          body: newTemplate,
        });
      }
    }
  },


  async onCancel({ state, ctx }) {
    const s = state as GymSessionState;
    clearWorkoutDraft(s.workout.id);
  },
};

registerModule(gymSessionAdapter);