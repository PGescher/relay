// apps/web/src/features/gym-tracker/gymSessionAdapter.tsx

import React, { forwardRef } from 'react';
import type { SessionModuleAdapter, WorkoutSession, WorkoutEvent } from '@relay/shared';

import { saveWorkoutDraft, clearWorkoutDraft, loadLastWorkoutDraft } from './workoutDraft';
import { apiPushGymComplete } from '../../data/apiClient';
import { enqueuePending } from '../../data/sync/pendingQueue';
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

/**
 * v0.0.1 adapter for Gym session.
 * State is kernel-owned (ActiveSession.state), treated as opaque by AppShell/kernel.
 */
export const gymSessionAdapter: SessionModuleAdapter<GymSessionState, any> = {
  module: 'GYM',

  createInitialState(payload) {
    return {
      workout: (payload as WorkoutSession),
      events: [],
      restByExerciseId: {},
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
    const req = state.finishRequest;
    if (!req) return; // oder throw, je nachdem wie strict du sein willst

    const finished2 = req.workout;
    const { events, restByExerciseId } = state;
    const completePayload = { workout: finished2, events, restByExerciseId };

    const userId = ctx.userId;
    const token = ctx.token;

    if (userId) {
      upsertWorkouts(userId, [{ id: finished2.id, module: finished2.module, data: finished2 }]);
    }

    let pushed = false;

    try {
      if (!token || !userId) throw new Error('No auth');
      await apiPushGymComplete({ token, payload: completePayload });
      pushed = true;
    } catch (e) {
      if (userId) enqueuePending(userId, finished2.id, completePayload);
    }

    // templates handling (POST/PUT) ebenfalls hier rein (genau wie vorher),
    // aber mit userId/token aus ctx.

    if (pushed && userId && token) {
      syncNow({ userId, token, module: 'GYM' }).catch(() => {});
    }
  },

  async onCancel({ state, ctx }) {
    const s = state as GymSessionState;
    clearWorkoutDraft(s.workout.id);
  },
};

registerModule(gymSessionAdapter);