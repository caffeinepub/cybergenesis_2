/**
 * Patches the Backend class to add _initializeAccessControlWithSecret method.
 * This method is required by useActor.ts but missing from the generated Backend class.
 * It delegates to initializeAccessControl() which is the actual method in the canister.
 */
import { Backend } from "../backend";

type BackendProto = Record<string, unknown>;

const proto = Backend.prototype as unknown as BackendProto;

// Monkey-patch _initializeAccessControlWithSecret onto Backend prototype
// useActor.ts calls this method with an admin secret token after login
if (!proto._initializeAccessControlWithSecret) {
  proto._initializeAccessControlWithSecret = async function (
    _userSecret: string,
  ): Promise<void> {
    // Delegate to initializeAccessControl - the real method in the canister
    // The secret is handled server-side via CAFFEINE_ADMIN_TOKEN env variable
    return (this as unknown as Backend).initializeAccessControl();
  };
}
