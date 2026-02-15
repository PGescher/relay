// apps/web/src/session/registerModules.ts

import { registerModule } from './moduleRegistry';

// import adapters here (centralized)
import { gymSessionAdapter } from '../features/gym-tracker/gymSessionAdapter';

export function registerAllModules() {
  registerModule(gymSessionAdapter);

  // Later:
  // registerModule(runSessionAdapter)
  // registerModule(recoverySessionAdapter)
}
