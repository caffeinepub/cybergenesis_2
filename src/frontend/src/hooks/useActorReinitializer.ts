import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

interface ReinitializationState {
  isReinitializing: boolean;
  attempt: number;
  currentGateway: string;
  error: string | null;
}

const MAX_REINIT_ATTEMPTS = 3;
const REINIT_DELAY = 2000; // 2 seconds between attempts

// Gateway rotation order
const GATEWAYS = [
  "https://ic0.app",
  "https://boundary.ic0.app",
  "https://icp-api.io",
] as const;

export function useActorReinitializer() {
  const [state, setState] = useState<ReinitializationState>({
    isReinitializing: false,
    attempt: 0,
    currentGateway: GATEWAYS[0],
    error: null,
  });

  const reinitAttemptRef = useRef(0);
  const isReinitializingRef = useRef(false);

  const rotateGateway = useCallback((currentAttempt: number): string => {
    const gatewayIndex = currentAttempt % GATEWAYS.length;
    return GATEWAYS[gatewayIndex];
  }, []);

  const startReinitialization = useCallback(
    async (
      actorCreationFn: (gateway: string) => Promise<void>,
      onSuccess?: () => void,
      onFailure?: (error: string) => void,
    ) => {
      if (isReinitializingRef.current) {
        console.log("[Reinitializer] Already reinitializing, skipping...");
        return;
      }

      isReinitializingRef.current = true;
      reinitAttemptRef.current = 0;

      console.log(
        "═══════════════════════════════════════════════════════════════════════════",
      );
      console.log(
        "🔄 [Actor Reinitializer] Starting automatic reinitialization cycle",
      );
      console.log(
        "═══════════════════════════════════════════════════════════════════════════",
      );

      toast.info("Переподключение...", {
        description: "Автоматическая реинициализация соединения",
        duration: 3000,
      });

      for (let attempt = 0; attempt < MAX_REINIT_ATTEMPTS; attempt++) {
        reinitAttemptRef.current = attempt + 1;
        const gateway = rotateGateway(attempt);

        setState({
          isReinitializing: true,
          attempt: attempt + 1,
          currentGateway: gateway,
          error: null,
        });

        console.log(
          `[Reinitializer] Attempt ${attempt + 1}/${MAX_REINIT_ATTEMPTS} using gateway: ${gateway}`,
        );

        try {
          // Wait 2 seconds before retry (except first attempt)
          if (attempt > 0) {
            console.log(
              `[Reinitializer] Waiting ${REINIT_DELAY}ms before retry...`,
            );
            await new Promise((resolve) => setTimeout(resolve, REINIT_DELAY));
          }

          // Attempt to create actor with the selected gateway
          await actorCreationFn(gateway);

          // Success!
          console.log(
            "═══════════════════════════════════════════════════════════════════════════",
          );
          console.log(
            `✅ [Reinitializer] Reinitialization successful on attempt ${attempt + 1}`,
          );
          console.log(`   Gateway: ${gateway}`);
          console.log(
            "═══════════════════════════════════════════════════════════════════════════",
          );

          setState({
            isReinitializing: false,
            attempt: 0,
            currentGateway: gateway,
            error: null,
          });

          isReinitializingRef.current = false;

          toast.success("Соединение восстановлено", {
            description: `Подключено через ${gateway}`,
            duration: 3000,
          });

          if (onSuccess) {
            onSuccess();
          }

          return;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Reinitializer] Attempt ${attempt + 1} failed:`,
            errorMessage,
          );

          if (attempt === MAX_REINIT_ATTEMPTS - 1) {
            // All attempts exhausted
            console.error(
              "═══════════════════════════════════════════════════════════════════════════",
            );
            console.error(
              "❌ [Reinitializer] All reinitialization attempts failed",
            );
            console.error(
              "═══════════════════════════════════════════════════════════════════════════",
            );

            const finalError = `Не удалось переподключиться после ${MAX_REINIT_ATTEMPTS} попыток. Последняя ошибка: ${errorMessage}`;

            setState({
              isReinitializing: false,
              attempt: 0,
              currentGateway: gateway,
              error: finalError,
            });

            isReinitializingRef.current = false;

            toast.error("Ошибка переподключения", {
              description: finalError,
              duration: 8000,
            });

            if (onFailure) {
              onFailure(finalError);
            }
          }
        }
      }
    },
    [rotateGateway],
  );

  const reset = useCallback(() => {
    setState({
      isReinitializing: false,
      attempt: 0,
      currentGateway: GATEWAYS[0],
      error: null,
    });
    reinitAttemptRef.current = 0;
    isReinitializingRef.current = false;
  }, []);

  return {
    ...state,
    startReinitialization,
    reset,
  };
}
