// packages/shared/src/session/SessionModuleAdapter.ts

import type { SessionModuleKey } from './SessionTypes';
import type { ActiveSessionMeta } from './activeSession'; // wherever it lives

export type SessionViewApi<TState = unknown> = {
  setState: (nextState: TState) => void;
  minimize: () => void;
  expand: () => void;
  finish: () => Promise<void>;
  cancel: () => void;
};

export type SessionKernelContext = {
  userId?: string | null;
  token?: string | null;
};

export type SessionFinishArgs<S> = {
  sessionId: string;
  module: SessionModuleKey;          // ✅ add
  state: S;
  meta?: ActiveSessionMeta;
  ctx: SessionKernelContext;         // ✅ add (kommt gleich)
};


/**
 * A UI component provided by a module.
 * Framework (React) lives in app layer; this type stays serializable/framework-agnostic.
 *
 * React components are compatible because `(props) => JSX.Element` is assignable to `(props) => unknown`.
 */
export type SessionViewComponent<Props = any> = (props: Props) => unknown;

export interface SessionModuleAdapter<State = unknown, StartPayload = unknown> {
  module: SessionModuleKey;

  createInitialState(payload?: StartPayload): State;

  ExpandedView: SessionViewComponent<{
    sessionId: string;
    state: State;
    api: SessionViewApi<State>;
  }>;

  MinimizedView: SessionViewComponent<{
    sessionId: string;
    state: State;
    api: SessionViewApi<State>;
  }>;

  onFinish(args: {
    sessionId: string;
    module: SessionModuleKey;
    state: State;
    meta?: ActiveSessionMeta;
    ctx: SessionKernelContext;
  }): Promise<void> | void;

  onCancel?(args: {
    sessionId: string;
    module: SessionModuleKey;
    state: State;
    meta?: ActiveSessionMeta;
    ctx: SessionKernelContext;
  }): Promise<void> | void;

  serialize?(state: State): unknown;
  deserialize?(raw: unknown): State;
}

