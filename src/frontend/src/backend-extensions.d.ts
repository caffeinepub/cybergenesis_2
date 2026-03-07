// Module augmentation to add _initializeAccessControlWithSecret
// to backendInterface. Used by hooks/useActor.ts for admin initialization.
import "./backend";

declare module "./backend" {
  interface backendInterface {
    _initializeAccessControlWithSecret(userSecret: string): Promise<void>;
  }

  interface Backend {
    _initializeAccessControlWithSecret(userSecret: string): Promise<void>;
  }
}
