// Re-export everything from the main backend module, with extended interface
// This file allows useActor.ts to import backendInterface with _initializeAccessControlWithSecret
export * from "../backend";
import type { backendInterface as _BackendInterface } from "../backend";

export interface backendInterface extends _BackendInterface {
  _initializeAccessControlWithSecret(userSecret: string): Promise<void>;
}
