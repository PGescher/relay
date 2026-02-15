// apps/web/src/session/moduleRegistry.ts
//
// Feature modules register their adapters when they are loaded (e.g. in the
// module's dashboard / route entry). AppShell and the session kernel only
// depend on this registry — never on feature imports.

import type { SessionModuleAdapter, SessionModuleKey } from '@relay/shared';

const adapters = new Map<SessionModuleKey, SessionModuleAdapter<any, any>>();

export function registerModule(adapter: SessionModuleAdapter<any, any>) {
  adapters.set(adapter.module, adapter);
}

export function getModuleAdapter(module: SessionModuleKey): SessionModuleAdapter<any, any> {
  const adapter = adapters.get(module);
  if (!adapter) {
    throw new Error(
      `No session module adapter registered for module "${String(module)}". ` +
        `Make sure the feature bundle calls registerModule(adapter) before starting/restoring sessions.`
    );
  }
  return adapter;
}
