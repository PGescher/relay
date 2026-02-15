// packages/shared/src/session/activeSession.ts

import type {
  SessionModuleKey,
  SessionLifecycle,
  OverlayMode,
  DockSide,
  RestorePolicy,
} from './SessionTypes';

export const ACTIVE_SESSION_VERSION = 1 as const;

export type ActiveSessionMeta = {
  version: number;
  startedAt: number;
  lastActiveAt: number;
  persistenceKey: string;
  restorePolicy: RestorePolicy;
};

export type ActiveSessionUI = {
  overlay: OverlayMode;
  dockSide: DockSide;
};

export type ActiveSession = {
  id: string;
  module: SessionModuleKey;
  lifecycle: SessionLifecycle;
  ui: ActiveSessionUI;
  /** module-owned opaque JSON-serializable state */
  state: unknown;
  meta: ActiveSessionMeta;
};
