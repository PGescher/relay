// packages/shared/src/session/SessionTypes.ts

////Keine Enums → bessere Serialisierbarkeit
//Explizite Strings → Debugging & Storage-friendly
//Keine UI-Details außerhalb Overlay
import { ActivityModule } from "..";
/**
 * SessionModuleKey
 * - reuse existing ActivityModule for real activities
 * - extend for future modules not in ActivityModule enum
 */
export type SessionModuleKey = ActivityModule | 'RECOVERY' | 'NUTRITION' | 'CUSTOM';

export type SessionLifecycle = 'ACTIVE' | 'FINISHED' | 'CANCELLED' | 'FINISHING';

export type OverlayMode = 'EXPANDED' | 'MINIMIZED';

export type DockSide = 'LEFT' | 'RIGHT';

export type RestorePolicy = 'never' | 'ifNotFinished' | 'always';
