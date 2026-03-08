import type { LandData, ModifierInstance } from "@/backend";
import PlotCustomization from "@/components/PlotCustomization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANNED_MODIFIER_CATALOG } from "@/data/modifierCatalog";
import {
  useApplyModifier,
  useClaimRewards,
  useDebugCanisterBalance,
  useDebugTokenBalance,
  useGetCanisterTokenBalance,
  useGetLandData,
  useGetModifierInventory,
  useGetTokenBalance,
  useMintFakeCbr,
  useUpgradePlot,
} from "@/hooks/useQueries";
import * as fakeCbr from "@/lib/fakeCbr";
import { formatTokenBalance } from "@/lib/tokenUtils";
import {
  BatteryCharging,
  ExternalLink,
  Loader2,
  MapPin,
  TrendingUp,
  Zap,
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

interface LandDashboardProps {
  selectedLandIndex: number;
}

export default function LandDashboard({
  selectedLandIndex,
}: LandDashboardProps) {
  const { data: lands, isLoading: landsLoading } = useGetLandData();
  const {
    data: tokenBalance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useGetTokenBalance();
  const { data: modifierInventory, isLoading: inventoryLoading } =
    useGetModifierInventory();
  const claimRewardsMutation = useClaimRewards();
  const upgradePlotMutation = useUpgradePlot();
  const debugBalanceMutation = useDebugTokenBalance();
  const applyModifierMutation = useApplyModifier();
  const mintFakeCbrMutation = useMintFakeCbr();

  // Admin-only canister balance
  const { data: canisterBalance } = useGetCanisterTokenBalance();
  const debugCanisterBalanceMutation = useDebugCanisterBalance();

  const [showAdminDebug, setShowAdminDebug] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(
    null,
  );
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [simulatedCharge, setSimulatedCharge] = useState<number | null>(null);

  const selectedLand: LandData | undefined = lands?.[selectedLandIndex];

  // Simulate charge accumulation: 100 charge per minute (test rate)
  const landIdForCharge = selectedLand?.landId;
  const chargeCapForEffect = selectedLand
    ? Number(selectedLand.chargeCap)
    : 1000;
  const backendChargeForEffect = selectedLand
    ? Number(selectedLand.cycleCharge)
    : 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: backendChargeForEffect intentionally excluded — including it would reset the interval on every tick
  useEffect(() => {
    if (landIdForCharge === undefined) return;
    const landId = landIdForCharge.toString();
    const cap = chargeCapForEffect;
    const initial = fakeCbr.getSimulatedCharge(
      landId,
      backendChargeForEffect,
      cap,
    );
    setSimulatedCharge(initial);
    const chargeInterval = setInterval(() => {
      const updated = fakeCbr.getSimulatedCharge(
        landId,
        backendChargeForEffect,
        cap,
      );
      setSimulatedCharge(updated);
    }, 1000);
    return () => clearInterval(chargeInterval);
  }, [landIdForCharge, chargeCapForEffect]);

  // Sync simulated charge when backend cycleCharge changes (after spending charge)
  useEffect(() => {
    if (landIdForCharge === undefined) return;
    fakeCbr.syncCharge(
      landIdForCharge.toString(),
      backendChargeForEffect,
      chargeCapForEffect,
    );
    setSimulatedCharge(backendChargeForEffect);
  }, [backendChargeForEffect, landIdForCharge, chargeCapForEffect]);

  // Calculate cooldown timer
  useEffect(() => {
    if (!selectedLand) return;

    const updateCooldown = () => {
      const currentTime = Date.now() * 1_000_000; // Convert to nanoseconds
      const lastClaimTime = Number(selectedLand.lastClaimTime);
      const dayInNanos = 86_400_000_000_000;
      const nextClaimTime = lastClaimTime + dayInNanos;
      const remaining = nextClaimTime - currentTime;

      if (remaining > 0) {
        setCooldownRemaining(remaining);
        setIsCooldownActive(true);
      } else {
        setCooldownRemaining(null);
        setIsCooldownActive(false);
      }
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    return () => clearInterval(interval);
  }, [selectedLand]);

  const formatCooldownTime = (nanoseconds: number): string => {
    const totalSeconds = Math.floor(nanoseconds / 1_000_000_000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  const handleClaimRewards = async () => {
    if (!selectedLand) return;

    try {
      const result = await claimRewardsMutation.mutateAsync(
        selectedLand.landId,
      );

      if (result.__kind__ === "success") {
        const formattedAmount = formatTokenBalance(
          result.success.tokensClaimed,
        );
        toast.success(`Claimed ${formattedAmount} CBR tokens!`);
      } else if (result.__kind__ === "cooldown") {
        const hours = Math.floor(
          Number(result.cooldown.remainingTime) / 3600000000000,
        );
        const minutes = Math.floor(
          (Number(result.cooldown.remainingTime) % 3600000000000) / 60000000000,
        );
        toast.error(`Please wait ${hours}h ${minutes}m more`);
      } else if (result.__kind__ === "insufficientCharge") {
        toast.error(
          `Insufficient charge. Required: ${result.insufficientCharge.required}, available: ${result.insufficientCharge.current}`,
        );
      } else if (result.__kind__ === "mintFailed") {
        toast.error(`Minting error: ${result.mintFailed}`);
      }
    } catch (error: any) {
      console.error("Claim error:", error);
      toast.error(`Claim error: ${error.message || "Unknown error"}`);
    }
  };

  const handleUpgradePlot = async () => {
    if (!selectedLand) return;

    const cost = BigInt(1000);

    if (!tokenBalance || tokenBalance < cost) {
      toast.error(
        `Insufficient tokens. Required: ${formatTokenBalance(cost)} CBR`,
      );
      return;
    }

    try {
      const result = await upgradePlotMutation.mutateAsync({
        landId: selectedLand.landId,
        cost,
      });

      if (result.__kind__ === "success") {
        toast.success(`Plot upgraded to level ${result.success.newLevel}!`);
      } else if (result.__kind__ === "maxLevelReached") {
        toast.error("Maximum level reached");
      } else if (result.__kind__ === "insufficientTokens") {
        toast.error(
          `Insufficient tokens. Required: ${formatTokenBalance(result.insufficientTokens.required)} CBR`,
        );
      }
    } catch (error: any) {
      console.error("Upgrade error:", error);
      toast.error(`Upgrade error: ${error.message || "Unknown error"}`);
    }
  };

  const handleDebugBalance = async () => {
    try {
      await debugBalanceMutation.mutateAsync();
    } catch (error) {
      console.error("Debug balance error:", error);
    }
  };

  const handleDebugCanisterBalance = async () => {
    try {
      await debugCanisterBalanceMutation.mutateAsync();
    } catch (error) {
      console.error("Debug canister balance error:", error);
    }
  };

  const handleApplyModifier = async (modifierInstanceId: bigint) => {
    if (!selectedLand) return;

    try {
      await applyModifierMutation.mutateAsync({
        modifierInstanceId,
        landId: selectedLand.landId,
      });
    } catch (error: any) {
      console.error("Apply modifier error:", error);
    }
  };

  const handleOpenMap = () => {
    if (!selectedLand) return;
    const { lat, lon } = selectedLand.coordinates;
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    window.open(url, "_blank");
  };

  if (landsLoading || balanceLoading || inventoryLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ffff] drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
      </div>
    );
  }

  if (!selectedLand) {
    // lands loaded but this index doesn't exist yet -- keep showing loader briefly
    if (!lands || lands.length === 0) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-[#00ffff] drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
        </div>
      );
    }
    return (
      <div className="text-center py-12">
        <p className="text-white/70 font-jetbrains">Land not found</p>
      </div>
    );
  }

  const biomeNames: Record<string, string> = {
    FOREST_VALLEY: "Forest Valley",
    ISLAND_ARCHIPELAGO: "Island Archipelago",
    SNOW_PEAK: "Snow Peak",
    DESERT_DUNE: "Desert Dune",
    VOLCANIC_CRAG: "Volcanic Crag",
    MYTHIC_VOID: "Mythic Void",
    MYTHIC_AETHER: "Mythic Aether",
  };

  return (
    <div className="space-y-6">
      {/* CBR Balance Card */}
      <Card className="glassmorphism neon-border box-glow-green">
        <CardHeader>
          <CardTitle className="text-[#00ff41] flex items-center gap-2 font-orbitron text-glow-green">
            <Zap className="w-5 h-5" />
            CBR BALANCE
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#00ff41]" />
              <span className="text-white/70 font-jetbrains">
                Loading balance...
              </span>
            </div>
          ) : balanceError ? (
            <div className="space-y-2">
              <p className="text-red-400 font-jetbrains">Balance unavailable</p>
              <button
                type="button"
                onClick={handleDebugBalance}
                disabled={debugBalanceMutation.isPending}
                className="px-4 py-2 rounded-lg btn-gradient-green text-black font-orbitron disabled:opacity-50"
              >
                {debugBalanceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                    Refreshing...
                  </>
                ) : (
                  "Refresh Balance"
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-3xl font-bold text-white font-orbitron">
                {formatTokenBalance(tokenBalance || BigInt(0))} CBR
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDebugBalance}
                  disabled={debugBalanceMutation.isPending}
                  className="px-3 py-1 rounded glassmorphism text-[#00ffff] hover:text-[#00ffff] hover:bg-[#00ffff]/10 transition-all duration-300 text-sm font-jetbrains border border-[#00ffff]/30"
                >
                  {debugBalanceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                      Refreshing...
                    </>
                  ) : (
                    "Refresh Balance"
                  )}
                </button>
                <button
                  data-ocid="dashboard.mint_cbr.primary_button"
                  type="button"
                  onClick={() =>
                    mintFakeCbrMutation.mutate(BigInt(1_000_000_000_000))
                  }
                  disabled={mintFakeCbrMutation.isPending}
                  className="px-3 py-1 rounded glassmorphism text-[#00ff41] hover:bg-[#00ff41]/10 transition-all duration-300 text-sm font-jetbrains border border-[#00ff41]/40 disabled:opacity-50"
                >
                  {mintFakeCbrMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                      Minting...
                    </>
                  ) : (
                    "🧪 Mint 1000 CBR"
                  )}
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Land Information Card */}
      <Card className="glassmorphism neon-border box-glow-cyan">
        <CardHeader>
          <CardTitle className="text-[#00ffff] flex items-center gap-2 font-orbitron text-glow-cyan">
            <MapPin className="w-5 h-5" />
            LAND INFORMATION
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-white/50 text-sm font-jetbrains">LandID</p>
              <p className="text-white font-medium font-jetbrains">
                {selectedLand.landId.toString()}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Biome</p>
              <p className="text-white font-medium font-jetbrains">
                {biomeNames[selectedLand.biome] || selectedLand.biome}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">
                Coordinates
              </p>
              <p className="text-white font-medium font-jetbrains">
                {selectedLand.coordinates.lat.toFixed(2)},{" "}
                {selectedLand.coordinates.lon.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Level</p>
              <p className="text-white font-medium font-jetbrains">
                {selectedLand.upgradeLevel.toString()}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Multiplier</p>
              <p className="text-white font-medium font-jetbrains">
                {selectedLand.baseTokenMultiplier}x
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains flex items-center gap-1">
                <BatteryCharging className="w-3 h-3 text-[#00ff41]" />
                Charge{" "}
                <span className="text-[#00ff41]/60 text-[10px]">
                  (+100/мин)
                </span>
              </p>
              <p className="text-[#00ff41] font-medium font-jetbrains font-bold">
                {simulatedCharge !== null
                  ? simulatedCharge
                  : selectedLand.cycleCharge.toString()}{" "}
                / {selectedLand.chargeCap.toString()}
              </p>
              <div className="mt-1 w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-[#00ff41] to-[#00ffff] transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, ((simulatedCharge ?? Number(selectedLand.cycleCharge)) / Number(selectedLand.chargeCap)) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Attached Modifiers */}
          {selectedLand.attachedModifications &&
            selectedLand.attachedModifications.length > 0 && (
              <div className="pt-4 border-t border-white/10">
                <p className="text-white/70 text-sm mb-2 font-jetbrains">
                  Attached modifiers:
                </p>
                <div className="space-y-2">
                  {selectedLand.attachedModifications.map((mod) => (
                    <div
                      key={mod.modifierInstanceId.toString()}
                      className="glassmorphism rounded-lg p-3 border border-[#9933ff]/30"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-medium font-jetbrains">
                            {mod.modifierType}
                          </p>
                          <p className="text-white/50 text-sm font-jetbrains">
                            Tier {mod.rarity_tier.toString()} • +
                            {(mod.multiplier_value * 100 - 100).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[#00ff41] text-sm font-jetbrains">
                            ID: {mod.modifierInstanceId.toString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClaimRewards}
              disabled={claimRewardsMutation.isPending || isCooldownActive}
              className="flex-1 px-6 py-3 rounded-lg btn-gradient-green text-black font-bold font-orbitron disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimRewardsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                  Claiming...
                </>
              ) : isCooldownActive && cooldownRemaining ? (
                <>GET 100 CBR ({formatCooldownTime(cooldownRemaining)})</>
              ) : (
                "GET 100 CBR"
              )}
            </button>
            <button
              type="button"
              onClick={handleOpenMap}
              className="px-4 py-3 rounded-lg glassmorphism border border-[#00ffff]/30 text-[#00ffff] hover:bg-[#00ffff]/10 transition-all duration-300 box-glow-cyan"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Modifier Inventory Card */}
      <Card className="glassmorphism neon-border box-glow-purple">
        <CardHeader>
          <CardTitle className="text-[#9933ff] flex items-center gap-2 font-orbitron text-glow-purple">
            <TrendingUp className="w-5 h-5" />
            MODIFIER INVENTORY
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inventoryLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#9933ff]" />
              <span className="text-white/70 font-jetbrains">
                Loading inventory...
              </span>
            </div>
          ) : !modifierInventory || modifierInventory.length === 0 ? (
            <p className="text-white/50 text-center py-4 font-jetbrains">
              No available modifiers
            </p>
          ) : (
            <div className="space-y-3">
              {modifierInventory.map((modifier) => {
                const normalized = modifier.modifierType
                  .toLowerCase()
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase());
                const catalogEntry = PLANNED_MODIFIER_CATALOG.find(
                  (m) => m.name.toLowerCase() === normalized.toLowerCase(),
                );
                const assetUrl =
                  catalogEntry?.asset_url ??
                  PLANNED_MODIFIER_CATALOG[0]?.asset_url ??
                  "";
                return (
                  <div
                    key={modifier.modifierInstanceId.toString()}
                    className="glassmorphism rounded-lg p-4 border border-[#9933ff]/30 hover:border-[#9933ff]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                        {assetUrl ? (
                          <img
                            src={assetUrl}
                            alt={modifier.modifierType}
                            className="w-9 h-9 object-contain"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium font-jetbrains">
                          {modifier.modifierType}
                        </p>
                        <p className="text-white/50 text-sm font-jetbrains">
                          Tier {modifier.rarity_tier.toString()} • Multiplier:{" "}
                          {modifier.multiplier_value}x
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[#9933ff] text-xs font-jetbrains">
                          ID: {modifier.modifierInstanceId.toString()}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleApplyModifier(modifier.modifierInstanceId)
                      }
                      disabled={
                        applyModifierMutation.isPending || !selectedLand
                      }
                      className="w-full px-4 py-2 rounded-lg btn-gradient-purple text-white font-bold font-orbitron disabled:opacity-50"
                    >
                      {applyModifierMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                          Applying...
                        </>
                      ) : (
                        "APPLY TO LAND"
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade Card */}
      <Card className="glassmorphism neon-border box-glow-green">
        <CardHeader>
          <CardTitle className="text-[#00ff41] flex items-center gap-2 font-orbitron text-glow-green">
            <TrendingUp className="w-5 h-5" />
            UPGRADE PLOT
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-white/70 text-sm mb-2 font-jetbrains">
                Current level:{" "}
                <span className="text-white font-bold">
                  {selectedLand.upgradeLevel.toString()}
                </span>
              </p>
              <p className="text-white/70 text-sm font-jetbrains">
                Upgrade cost:{" "}
                <span className="text-[#00ff41] font-bold">1000 CBR</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleUpgradePlot}
              disabled={
                upgradePlotMutation.isPending ||
                Number(selectedLand.upgradeLevel) >= 5
              }
              className="w-full px-6 py-3 rounded-lg btn-gradient-green text-black font-bold font-orbitron disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {upgradePlotMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                  Upgrading...
                </>
              ) : Number(selectedLand.upgradeLevel) >= 5 ? (
                "MAXIMUM LEVEL"
              ) : (
                "UPGRADE PLOT"
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Plot Customization */}
      <PlotCustomization selectedLandIndex={selectedLandIndex} />

      {/* Admin Debug Panel */}
      <Card className="glassmorphism border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <CardHeader>
          <CardTitle
            className="text-red-400 cursor-pointer flex items-center justify-between font-orbitron"
            onClick={() => setShowAdminDebug(!showAdminDebug)}
          >
            <span>DEBUG PANEL (ADMIN)</span>
            <span className="text-sm">{showAdminDebug ? "▼" : "▶"}</span>
          </CardTitle>
        </CardHeader>
        {showAdminDebug && (
          <CardContent className="space-y-4">
            <div>
              <p className="text-white/70 text-sm mb-2 font-jetbrains">
                Canister balance:
              </p>
              <p className="text-white font-mono font-jetbrains">
                {canisterBalance ? formatTokenBalance(canisterBalance) : "---"}{" "}
                CBR
              </p>
              <p className="text-white/50 text-xs font-jetbrains">
                Raw: {canisterBalance ? canisterBalance.toString() : "---"} e8s
              </p>
            </div>
            <button
              type="button"
              onClick={handleDebugCanisterBalance}
              disabled={debugCanisterBalanceMutation.isPending}
              className="w-full px-4 py-2 rounded-lg glassmorphism border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all duration-300 font-orbitron disabled:opacity-50"
            >
              {debugCanisterBalanceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                  Checking...
                </>
              ) : (
                "CHECK CANISTER BALANCE"
              )}
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
