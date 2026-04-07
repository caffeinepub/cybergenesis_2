import { useEffect, useRef, useState } from "react";
import type { backendInterface } from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

export interface UseActorReturn {
  actor: backendInterface | null;
  isFetching: boolean;
  isInitialized: boolean;
  isInitializing: boolean;
  error: Error | null;
}

const INITIALIZATION_TIMEOUT = 120000;
const MAX_POLL_RETRIES = 25;
const POLL_DELAYS = [
  1000, 1000, 2000, 2000, 3000, 3000, 5000, 5000, 7000, 7000, 10000, 10000,
  15000, 15000, 20000, 20000, 25000, 25000, 30000, 30000, 35000, 35000, 40000,
  40000, 45000,
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyActor = Record<string, (...args: unknown[]) => Promise<unknown>>;

export function useActorWithInit(): UseActorReturn {
  const { actor, isFetching } = useActor();
  const { identity } = useInternetIdentity();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const initializationAttempted = useRef(false);
  const currentIdentityRef = useRef<string | null>(null);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);

  const pollInitializationData = async (
    actorArg: backendInterface,
    attemptNumber: number,
  ): Promise<boolean> => {
    try {
      console.log(
        `[Data Poller] Attempt ${attemptNumber + 1}/${MAX_POLL_RETRIES} - Validating network connectivity...`,
      );

      const a = actorArg as unknown as AnyActor;
      const results = { userRole: false, adminStatus: false, landData: false };

      try {
        if (typeof a.getCallerUserRole === "function") {
          const userRole = await a.getCallerUserRole();
          console.log("[Data Poller] ✓ User role:", userRole);
          results.userRole = true;
        }
      } catch (err) {
        console.warn("[Data Poller] User role query failed:", err);
      }

      try {
        if (typeof a.isCallerAdmin === "function") {
          const isAdmin = await a.isCallerAdmin();
          console.log("[Data Poller] ✓ Admin status:", isAdmin);
          results.adminStatus = true;
        }
      } catch (err) {
        console.warn("[Data Poller] Admin status query failed:", err);
      }

      try {
        if (typeof a.getLandData === "function") {
          const landData = (await a.getLandData()) as unknown[];
          console.log(
            "[Data Poller] ✓ Land data fetched, count:",
            landData.length,
          );
          results.landData = true;
        }
      } catch (err) {
        console.warn("[Data Poller] Land data query failed:", err);
      }

      const successCount = Object.values(results).filter(Boolean).length;
      const isSuccessful = successCount >= 1;

      if (isSuccessful) {
        console.log(
          `[Data Poller] ✓ Connectivity validated (${successCount}/3 checks passed)`,
        );
      } else {
        console.warn(
          `[Data Poller] Insufficient connectivity (${successCount}/3 checks passed)`,
        );
      }

      return isSuccessful;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `[Data Poller] Attempt ${attemptNumber + 1} failed:`,
        errorMessage,
      );
      return false;
    }
  };

  useEffect(() => {
    if (!isFetching && !actor && identity) {
      console.error("[useActorWithInit] Actor creation failed");
      setError(
        new Error("Failed to create backend actor. Please reload the page."),
      );
      setIsInitialized(true);
    }
  }, [isFetching, actor, identity]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  useEffect(() => {
    const initializeActor = async () => {
      const currentIdentityStr = identity?.getPrincipal().toString() || null;
      if (currentIdentityRef.current !== currentIdentityStr) {
        console.log(
          "[useActorWithInit] Identity changed, resetting initialization state",
        );
        currentIdentityRef.current = currentIdentityStr;
        initializationAttempted.current = false;
        pollCountRef.current = 0;
        setIsInitialized(false);
        setIsInitializing(false);
        setError(null);
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
          initializationTimeoutRef.current = null;
        }
      }

      if (!actor || !identity) {
        setIsInitialized(false);
        setIsInitializing(false);
        return;
      }

      if (isInitialized || isInitializing || initializationAttempted.current) {
        return;
      }

      console.log("🚀 [useActorWithInit] Starting initialization");
      setIsInitializing(true);
      initializationAttempted.current = true;

      initializationTimeoutRef.current = setTimeout(() => {
        if (isInitializing) {
          console.error(
            "[useActorWithInit] ⏰ Initialization timeout exceeded",
          );
          setError(new Error("Initialization timeout (120s). Please reload."));
          setIsInitialized(true);
          setIsInitializing(false);
        }
      }, INITIALIZATION_TIMEOUT);

      const attemptInitialization = async (
        attemptNumber: number,
      ): Promise<void> => {
        try {
          console.log(
            `[useActorWithInit] Polling attempt ${attemptNumber + 1}/${MAX_POLL_RETRIES}`,
          );
          const pollingSuccess = await pollInitializationData(
            actor,
            attemptNumber,
          );
          if (!pollingSuccess)
            throw new Error("Network connectivity validation failed");

          if (initializationTimeoutRef.current) {
            clearTimeout(initializationTimeoutRef.current);
            initializationTimeoutRef.current = null;
          }

          console.log(
            "✅ [useActorWithInit] Initialization completed successfully",
          );
          setIsInitialized(true);
          setError(null);
          pollCountRef.current = 0;
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown initialization error";
          console.error(
            `[useActorWithInit] Polling attempt ${attemptNumber + 1} failed:`,
            errorMessage,
          );

          if (attemptNumber < MAX_POLL_RETRIES - 1) {
            const delay = POLL_DELAYS[attemptNumber] || 45000;
            console.log(`[useActorWithInit] Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            pollCountRef.current = attemptNumber + 1;
            await attemptInitialization(attemptNumber + 1);
          } else {
            if (initializationTimeoutRef.current) {
              clearTimeout(initializationTimeoutRef.current);
              initializationTimeoutRef.current = null;
            }
            setError(
              new Error(
                `Failed to initialize after ${MAX_POLL_RETRIES} attempts. Last error: ${errorMessage}`,
              ),
            );
            setIsInitialized(true);
          }
        }
      };

      try {
        await attemptInitialization(0);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Unexpected error";
        console.error("[useActorWithInit] Unexpected error:", errorMessage);
        if (initializationTimeoutRef.current) {
          clearTimeout(initializationTimeoutRef.current);
          initializationTimeoutRef.current = null;
        }
        setError(
          new Error(`Initialization failed unexpectedly: ${errorMessage}`),
        );
        setIsInitialized(true);
      } finally {
        setIsInitializing(false);
      }
    };

    void initializeActor();

    return () => {
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
    };
  }, [actor, identity, isInitialized, isInitializing]);

  useEffect(() => {
    if (!identity) {
      console.log("[useActorWithInit] Identity cleared, resetting state");
      setIsInitialized(false);
      setIsInitializing(false);
      setError(null);
      initializationAttempted.current = false;
      currentIdentityRef.current = null;
      pollCountRef.current = 0;
      if (initializationTimeoutRef.current) {
        clearTimeout(initializationTimeoutRef.current);
        initializationTimeoutRef.current = null;
      }
    }
  }, [identity]);

  return {
    actor,
    isFetching,
    isInitialized: !!actor && isInitialized,
    isInitializing: isFetching || isInitializing,
    error,
  };
}
