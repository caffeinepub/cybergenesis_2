import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useActor } from "@/hooks/useActor";
import { useAssetActor } from "@/hooks/useAssetActor";
import { useInternetIdentity } from "@/hooks/useInternetIdentity";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface ReinitStep {
  name: string;
  status: "pending" | "running" | "success" | "failed";
  message?: string;
}

export default function AssetCanisterReinitializer() {
  const { actor: assetActor, isFetching: assetFetching } = useAssetActor();
  const { actor: landActor } = useActor();
  const { identity } = useInternetIdentity();
  const [isReinitializing, setIsReinitializing] = useState(false);
  const [steps, setSteps] = useState<ReinitStep[]>([]);
  const [preCheckStatus, setPreCheckStatus] = useState<
    "idle" | "checking" | "ready" | "failed"
  >("idle");
  const [postCheckStatus, setPostCheckStatus] = useState<
    "idle" | "checking" | "healthy" | "degraded"
  >("idle");
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState<boolean | null>(
    null,
  );
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check if current user is the authorized admin
  useEffect(() => {
    const checkAuthorization = async () => {
      if (!assetActor || !identity) {
        setIsAuthorizedAdmin(false);
        setCheckingAuth(false);
        return;
      }

      try {
        const currentPrincipal = identity.getPrincipal();
        const isAuthorized =
          await assetActor.isAuthorizedAdmin(currentPrincipal);
        setIsAuthorizedAdmin(isAuthorized);
        console.log("[AssetCanisterReinitializer] Authorization check:", {
          principal: currentPrincipal.toString(),
          isAuthorized,
        });
      } catch (error: any) {
        console.error(
          "[AssetCanisterReinitializer] Authorization check failed:",
          error,
        );
        setIsAuthorizedAdmin(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuthorization();
  }, [assetActor, identity]);

  const updateStep = (
    name: string,
    status: ReinitStep["status"],
    message?: string,
  ) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.name === name ? { ...step, status, message } : step,
      ),
    );
  };

  const runPreChecks = async () => {
    setPreCheckStatus("checking");
    toast.info("Выполнение предварительных проверок...");

    try {
      // Check Asset Canister connectivity
      if (!assetActor) {
        toast.error("Asset Canister недоступен");
        setPreCheckStatus("failed");
        return false;
      }

      // Check Land Canister connectivity
      if (!landActor) {
        toast.error("Land Canister недоступен");
        setPreCheckStatus("failed");
        return false;
      }

      // Verify Land Canister is operational
      try {
        await landActor.isCallerAdmin();
        console.log("[PreCheck] ✓ Land Canister operational");
      } catch (_error) {
        toast.error("Land Canister не отвечает");
        setPreCheckStatus("failed");
        return false;
      }

      // Check Asset Canister current status
      try {
        await assetActor.listAssets();
        console.log("[PreCheck] ✓ Asset Canister responding to queries");
      } catch (error: any) {
        console.log(
          "[PreCheck] Asset Canister query failed (expected if stuck):",
          error.message,
        );
      }

      setPreCheckStatus("ready");
      toast.success("Предварительные проверки пройдены");
      return true;
    } catch (error: any) {
      console.error("[PreCheck] Failed:", error);
      toast.error(`Предварительные проверки не пройдены: ${error.message}`);
      setPreCheckStatus("failed");
      return false;
    }
  };

  const runPostChecks = async () => {
    setPostCheckStatus("checking");
    toast.info("Проверка состояния после реинициализации...");

    try {
      if (!assetActor || !landActor) {
        throw new Error("Actors not available");
      }

      // Verify Asset Canister health
      const healthChecks = [
        { name: "List Assets", fn: () => assetActor.listAssets() },
        { name: "Check Admin Status", fn: () => assetActor.isCallerAdmin() },
        { name: "Get User Role", fn: () => assetActor.getCallerUserRole() },
        { name: "List GLB Models", fn: () => assetActor.listGLBModels() },
      ];

      let allPassed = true;
      for (const check of healthChecks) {
        try {
          await check.fn();
          console.log(`[PostCheck] ✓ ${check.name} passed`);
        } catch (error: any) {
          console.error(`[PostCheck] ✗ ${check.name} failed:`, error.message);
          allPassed = false;
        }
      }

      // Verify Land Canister still operational
      try {
        await landActor.isCallerAdmin();
        console.log("[PostCheck] ✓ Land Canister still operational");
      } catch (_error) {
        console.error("[PostCheck] ✗ Land Canister check failed");
        allPassed = false;
      }

      if (allPassed) {
        setPostCheckStatus("healthy");
        toast.success("Asset Canister восстановлен и работает нормально", {
          description: "Все проверки работоспособности пройдены",
          duration: 5000,
        });
      } else {
        setPostCheckStatus("degraded");
        toast.warning("Asset Canister частично восстановлен", {
          description: "Некоторые проверки не прошли",
          duration: 5000,
        });
      }

      return allPassed;
    } catch (error: any) {
      console.error("[PostCheck] Failed:", error);
      setPostCheckStatus("degraded");
      toast.error(
        `Проверка после реинициализации не удалась: ${error.message}`,
      );
      return false;
    }
  };

  const reinitializeAssetCanister = async () => {
    // Run pre-checks first
    const preChecksPassed = await runPreChecks();
    if (!preChecksPassed) {
      toast.error(
        "Предварительные проверки не пройдены. Реинициализация отменена.",
      );
      return;
    }

    setIsReinitializing(true);
    setPostCheckStatus("idle");

    const reinitSteps: ReinitStep[] = [
      { name: "Проверка подключения к Asset Canister", status: "pending" },
      { name: "Вызов initializeAccessControl()", status: "pending" },
      { name: "Проверка состояния доступа", status: "pending" },
      { name: "Проверка работоспособности Land Canister", status: "pending" },
    ];

    setSteps(reinitSteps);

    try {
      console.log(
        "═══════════════════════════════════════════════════════════════════════════",
      );
      console.log(
        "🔄 [Asset Canister Reinitialization] Starting targeted reinitialization",
      );
      console.log(
        "═══════════════════════════════════════════════════════════════════════════",
      );

      // Step 1: Verify Asset Canister connection
      updateStep("Проверка подключения к Asset Canister", "running");
      if (!assetActor) {
        throw new Error("Asset Canister actor not available");
      }
      console.log("[Step 1/4] ✓ Asset Canister actor available");
      updateStep(
        "Проверка подключения к Asset Canister",
        "success",
        "Actor доступен",
      );

      // Step 2: Call initializeAccessControl
      updateStep("Вызов initializeAccessControl()", "running");
      console.log(
        "[Step 2/4] Calling Asset Canister initializeAccessControl()...",
      );

      try {
        await assetActor.initializeAccessControl();
        console.log(
          "[Step 2/4] ✓ initializeAccessControl() completed successfully",
        );
        updateStep(
          "Вызов initializeAccessControl()",
          "success",
          "Контроль доступа реинициализирован",
        );
        toast.success("Asset Canister реинициализирован", {
          description: "Контроль доступа успешно восстановлен",
          duration: 3000,
        });
      } catch (error: any) {
        // Check if error is "already initialized" - this is actually OK
        if (error.message?.includes("already initialized")) {
          console.log(
            "[Step 2/4] ⚠ Access control already initialized (this is OK)",
          );
          updateStep(
            "Вызов initializeAccessControl()",
            "success",
            "Уже инициализирован",
          );
          toast.info("Asset Canister уже инициализирован", {
            description: "Контроль доступа уже настроен",
            duration: 3000,
          });
        } else {
          throw error;
        }
      }

      // Step 3: Verify access control state
      updateStep("Проверка состояния доступа", "running");
      console.log("[Step 3/4] Verifying access control state...");

      try {
        const role = await assetActor.getCallerUserRole();
        console.log("[Step 3/4] ✓ User role retrieved:", role);
        updateStep("Проверка состояния доступа", "success", `Роль: ${role}`);
      } catch (error: any) {
        console.error(
          "[Step 3/4] ✗ Failed to verify access control:",
          error.message,
        );
        updateStep("Проверка состояния доступа", "failed", error.message);
        throw error;
      }

      // Step 4: Verify Land Canister is still operational
      updateStep("Проверка работоспособности Land Canister", "running");
      console.log("[Step 4/4] Verifying Land Canister operational status...");

      if (!landActor) {
        throw new Error("Land Canister actor not available");
      }

      try {
        await landActor.isCallerAdmin();
        console.log("[Step 4/4] ✓ Land Canister fully operational");
        updateStep(
          "Проверка работоспособности Land Canister",
          "success",
          "Полностью работоспособен",
        );
      } catch (error: any) {
        console.error(
          "[Step 4/4] ✗ Land Canister check failed:",
          error.message,
        );
        updateStep(
          "Проверка работоспособности Land Canister",
          "failed",
          error.message,
        );
        throw error;
      }

      console.log(
        "═══════════════════════════════════════════════════════════════════════════",
      );
      console.log(
        "✅ [Asset Canister Reinitialization] Completed successfully",
      );
      console.log(
        "═══════════════════════════════════════════════════════════════════════════",
      );

      // Run post-checks
      await runPostChecks();

      toast.success("Реинициализация завершена успешно", {
        description: "Asset Canister восстановлен, Land Canister не затронут",
        duration: 5000,
      });
    } catch (error: any) {
      console.error("[Asset Canister Reinitialization] Failed:", error);
      toast.error("Реинициализация не удалась", {
        description: error.message,
        duration: 8000,
      });
    } finally {
      setIsReinitializing(false);
    }
  };

  const getStepIcon = (status: ReinitStep["status"]) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      case "running":
        return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case "pending":
        return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (
    status: typeof preCheckStatus | typeof postCheckStatus,
  ) => {
    switch (status) {
      case "idle":
        return null;
      case "checking":
        return (
          <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/50">
            Проверка...
          </Badge>
        );
      case "ready":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            Готов
          </Badge>
        );
      case "healthy":
        return (
          <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
            Работает
          </Badge>
        );
      case "degraded":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/50">
            Частично
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/50">
            Ошибка
          </Badge>
        );
    }
  };

  // Show loading state while checking authorization
  if (checkingAuth) {
    return (
      <Card className="bg-black/40 border-purple-500/30 backdrop-blur-sm">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
            <span className="text-gray-300">Проверка авторизации...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show unauthorized message if user is not the authorized admin
  if (isAuthorizedAdmin === false) {
    return (
      <Card className="bg-black/40 border-red-500/30 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Реинициализация Asset Canister
          </CardTitle>
          <CardDescription className="text-gray-400 mt-1">
            Доступ ограничен
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
            <div className="flex items-start gap-3">
              <Lock className="w-5 h-5 text-red-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-red-400 mb-2">
                  Недостаточно прав доступа
                </div>
                <div className="text-xs text-gray-300 space-y-1">
                  <p>
                    Реинициализация Asset Canister доступна только
                    авторизованному администратору.
                  </p>
                  <p className="mt-2 text-gray-400">
                    Текущий Principal:{" "}
                    <code className="text-xs bg-black/30 px-1 py-0.5 rounded">
                      {identity?.getPrincipal().toString()}
                    </code>
                  </p>
                  <p className="mt-2 text-gray-400">
                    Требуется Principal:{" "}
                    <code className="text-xs bg-black/30 px-1 py-0.5 rounded">
                      whd5e-pbxhk-pp65k-hxqqx-edtrx-5b7xd-itunf-pz5f5-bzjut-dxkhy-4ae
                    </code>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-black/40 border-purple-500/30 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-purple-400 flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Реинициализация Asset Canister
            </CardTitle>
            <CardDescription className="text-gray-400 mt-1">
              Целевая реинициализация контроля доступа Asset Canister
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {isAuthorizedAdmin && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/50">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Авторизован
              </Badge>
            )}
            {getStatusBadge(preCheckStatus)}
            {getStatusBadge(postCheckStatus)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Warning Banner */}
        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-purple-400 mt-0.5" />
            <div className="flex-1">
              <div className="text-sm font-medium text-purple-400 mb-1">
                Важная информация
              </div>
              <ul className="text-xs text-gray-300 space-y-1">
                <li>
                  • Будет реинициализирован только{" "}
                  <strong>Asset Canister</strong>
                </li>
                <li>
                  • <strong>Land Canister</strong> останется нетронутым и
                  полностью работоспособным
                </li>
                <li>• Процедура восстановит контроль доступа Asset Canister</li>
                <li>
                  • После завершения будет выполнена проверка работоспособности
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Pre-Check Button */}
        {preCheckStatus === "idle" && (
          <Button
            onClick={runPreChecks}
            disabled={assetFetching || !assetActor || !landActor}
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
          >
            <Zap className="w-4 h-4 mr-2" />
            Выполнить предварительные проверки
          </Button>
        )}

        {/* Reinitialize Button */}
        {preCheckStatus === "ready" && (
          <Button
            onClick={reinitializeAssetCanister}
            disabled={isReinitializing || assetFetching || !assetActor}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isReinitializing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Реинициализация...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Реинициализировать Asset Canister
              </>
            )}
          </Button>
        )}

        {/* Steps Display */}
        {steps.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-300 mb-3">
              Шаги реинициализации:
            </div>
            {steps.map((step, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg bg-black/30 border border-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  {getStepIcon(step.status)}
                  <div>
                    <div className="text-sm font-medium text-gray-200">
                      {step.name}
                    </div>
                    {step.message && (
                      <div className="text-xs text-gray-400 mt-1">
                        {step.message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Post-Check Results */}
        {postCheckStatus === "healthy" && (
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-green-400 mb-1">
                  ✅ Asset Canister: Работает нормально
                </div>
                <div className="text-xs text-gray-300">
                  Все проверки работоспособности пройдены успешно. Asset
                  Canister полностью восстановлен.
                </div>
              </div>
            </div>
          </div>
        )}

        {postCheckStatus === "degraded" && (
          <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-yellow-400 mb-1">
                  ⚠️ Asset Canister: Частично восстановлен
                </div>
                <div className="text-xs text-gray-300">
                  Некоторые проверки не прошли. Проверьте логи диагностики для
                  деталей.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Land Canister Status Confirmation */}
        {steps.length > 0 && steps[steps.length - 1].status === "success" && (
          <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-blue-400 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-blue-400 mb-1">
                  ✅ Land Canister: Полностью работоспособен
                </div>
                <div className="text-xs text-gray-300">
                  Land Canister не был затронут и продолжает работать нормально.
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
