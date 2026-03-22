import type { LandData } from "@/backend";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BOOSTER_CATALOG, CRYSTAL_CATALOG } from "@/data/modifierCatalog";
import {
  useClaimRewards,
  useDebugTokenBalance,
  useGetLandData,
  useGetTokenBalance,
  useMintFakeCbr,
  useUpgradePlot,
} from "@/hooks/useQueries";
import * as fakeCbr from "@/lib/fakeCbr";
import type { LocalModifier } from "@/lib/fakeCbr";
import { formatTokenBalance } from "@/lib/tokenUtils";
import {
  BatteryCharging,
  ExternalLink,
  Gem,
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
  const claimRewardsMutation = useClaimRewards();
  const upgradePlotMutation = useUpgradePlot();
  const debugBalanceMutation = useDebugTokenBalance();
  const mintFakeCbrMutation = useMintFakeCbr();

  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(
    null,
  );
  const [isCooldownActive, setIsCooldownActive] = useState(false);
  const [simulatedCharge, setSimulatedCharge] = useState<number | null>(null);

  const [boosterStacks, setBoosterStacks] = useState(() =>
    fakeCbr.getBoosters(),
  );
  const [crystalStacks, setCrystalStacks] = useState(() =>
    fakeCbr.getCrystals(),
  );
  const [localModifiers, setLocalModifiers] = useState<LocalModifier[]>(() =>
    fakeCbr.getLocalModifiers(),
  );

  const refreshInventory = () => {
    setBoosterStacks(fakeCbr.getBoosters());
    setCrystalStacks(fakeCbr.getCrystals());
    setLocalModifiers(fakeCbr.getLocalModifiers());
  };

  // Periodically refresh inventory to pick up new items from cache openings
  useEffect(() => {
    const interval = setInterval(() => {
      setBoosterStacks(fakeCbr.getBoosters());
      setCrystalStacks(fakeCbr.getCrystals());
      setLocalModifiers(fakeCbr.getLocalModifiers());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const selectedLand: LandData | undefined = lands?.[selectedLandIndex];

  const landIdForCharge = selectedLand?.landId;
  const chargeCapForEffect = selectedLand
    ? Number(selectedLand.chargeCap)
    : 1000;
  const backendChargeForEffect = selectedLand
    ? Number(selectedLand.cycleCharge)
    : 0;

  // biome-ignore lint/correctness/useExhaustiveDependencies: backendChargeForEffect intentionally excluded
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

  useEffect(() => {
    if (landIdForCharge === undefined) return;
    fakeCbr.syncCharge(
      landIdForCharge.toString(),
      backendChargeForEffect,
      chargeCapForEffect,
    );
    setSimulatedCharge(backendChargeForEffect);
  }, [backendChargeForEffect, landIdForCharge, chargeCapForEffect]);

  useEffect(() => {
    if (!selectedLand) return;
    const updateCooldown = () => {
      const currentTime = Date.now() * 1_000_000;
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
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const handleClaimRewards = async () => {
    if (!selectedLand) return;
    try {
      const result = await claimRewardsMutation.mutateAsync(
        selectedLand.landId,
      );
      if (result.__kind__ === "success") {
        toast.success(
          `Claimed ${formatTokenBalance(result.success.tokensClaimed)} CBR tokens!`,
        );
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
      toast.error(`Claim error: ${error.message || "Unknown error"}`);
    }
  };

  const handleApplyModifier = (instanceId: number) => {
    const land = selectedLand;
    if (!land) {
      toast.error("Выберите участок");
      return;
    }
    fakeCbr.markModifierApplied(instanceId, land.landId.toString());
    setLocalModifiers(fakeCbr.getLocalModifiers());
    toast.success("Модификатор установлен!");
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
      toast.error(`Upgrade error: ${error.message || "Unknown error"}`);
    }
  };

  const handleOpenMap = () => {
    if (!selectedLand) return;
    const { lat, lon } = selectedLand.coordinates;
    window.open(
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`,
      "_blank",
    );
  };

  const handleUseBooster = (boosterId: string) => {
    const booster = BOOSTER_CATALOG.find((b) => b.id === boosterId);
    if (!booster) return;
    const used = fakeCbr.consumeBooster(boosterId);
    if (!used) {
      toast.error("Нет доступных бустеров этого типа");
      return;
    }
    if (landIdForCharge !== undefined) {
      const current = simulatedCharge ?? backendChargeForEffect;
      const newCharge = Math.min(
        current + booster.energyAmount,
        chargeCapForEffect,
      );
      fakeCbr.syncCharge(
        landIdForCharge.toString(),
        newCharge,
        chargeCapForEffect,
      );
      setSimulatedCharge(newCharge);
    }
    toast.success(`${booster.name}: +${booster.energyAmount} энергии!`);
    refreshInventory();
  };

  if (landsLoading || balanceLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ffff] drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
      </div>
    );
  }

  if (!selectedLand) {
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
                onClick={() => debugBalanceMutation.mutateAsync()}
                disabled={debugBalanceMutation.isPending}
                className="px-4 py-2 rounded-lg btn-gradient-green text-black font-orbitron disabled:opacity-50"
              >
                Refresh Balance
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
                  onClick={() => debugBalanceMutation.mutateAsync()}
                  disabled={debugBalanceMutation.isPending}
                  className="px-3 py-1 rounded glassmorphism text-[#00ffff] hover:bg-[#00ffff]/10 transition-all duration-300 text-sm font-jetbrains border border-[#00ffff]/30"
                >
                  Refresh Balance
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
                    "Mint 1000 CBR"
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
                            Tier {mod.rarity_tier.toString()}
                          </p>
                        </div>
                        <p className="text-[#00ff41] text-sm font-jetbrains">
                          ID: {mod.modifierInstanceId.toString()}
                        </p>
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
          {localModifiers.length === 0 ? (
            <p className="text-white/50 text-center py-4 font-jetbrains">
              Нет доступных модификаторов. Открывайте кэши!
            </p>
          ) : (
            <div className="space-y-3">
              {localModifiers.map((modifier: LocalModifier) => {
                const rarityTier = modifier.rarityTier;
                const rarityName =
                  rarityTier === 4
                    ? "Mythic"
                    : rarityTier === 3
                      ? "Legendary"
                      : rarityTier === 2
                        ? "Rare"
                        : "Common";
                const rarityColor =
                  rarityTier === 4
                    ? "text-yellow-400"
                    : rarityTier === 3
                      ? "text-purple-400"
                      : rarityTier === 2
                        ? "text-blue-400"
                        : "text-gray-400";
                const countOfThisType = localModifiers.filter(
                  (m) => m.modifierType === modifier.modifierType,
                ).length;
                const isInstalled = !!modifier.appliedToLand;
                return (
                  <div
                    key={modifier.instanceId}
                    className="glassmorphism rounded-lg p-3 border border-[#9933ff]/30 hover:border-[#9933ff]/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {modifier.assetUrl ? (
                        <img
                          src={modifier.assetUrl}
                          alt={modifier.displayName}
                          className="w-10 h-10 rounded-lg object-contain flex-shrink-0"
                          style={{
                            filter: `drop-shadow(0 0 6px ${
                              rarityTier === 4
                                ? "rgba(250,204,21,0.6)"
                                : rarityTier === 3
                                  ? "rgba(168,85,247,0.5)"
                                  : rarityTier === 2
                                    ? "rgba(96,165,250,0.4)"
                                    : "rgba(156,163,175,0.3)"
                            })`,
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#9933ff]/20 border border-[#9933ff]/40 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="w-5 h-5 text-[#9933ff]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium font-jetbrains text-sm truncate">
                            {modifier.displayName}
                          </p>
                          {countOfThisType >= 2 && (
                            <span className="text-[10px] font-jetbrains text-[#9933ff]/70 bg-[#9933ff]/10 px-1 rounded flex-shrink-0">
                              x{countOfThisType}
                            </span>
                          )}
                        </div>
                        <p className={`text-xs font-jetbrains ${rarityColor}`}>
                          {rarityName}
                        </p>
                        <p className="text-[#9933ff]/60 text-[10px] font-jetbrains">
                          ID: {modifier.instanceId}
                        </p>
                      </div>
                      {isInstalled ? (
                        <button
                          type="button"
                          onClick={() => {
                            /* remove logic */
                          }}
                          className="px-2 py-2 rounded-lg bg-[#ff3344]/20 border border-[#ff3344]/50 text-[#ff3344] text-xs font-orbitron hover:bg-[#ff3344]/30 transition-all disabled:opacity-50 min-w-[60px]"
                        >
                          REMOVE
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            handleApplyModifier(modifier.instanceId)
                          }
                          className="px-2 py-2 rounded-lg bg-[#00ff41]/20 border border-[#00ff41]/50 text-[#00ff41] text-xs font-orbitron hover:bg-[#00ff41]/30 transition-all disabled:opacity-50 min-w-[60px]"
                        >
                          INSTALL
                        </button>
                      )}
                    </div>
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

      {/* Boosters & Crystals */}
      <Card className="glassmorphism neon-border box-glow-cyan">
        <CardHeader>
          <CardTitle className="text-[#00ffff] flex items-center gap-2 font-orbitron text-glow-cyan">
            <Zap className="w-5 h-5" />
            БУСТЕРЫ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Boosters */}
          <div>
            <p className="text-[#00ffff]/50 text-xs font-jetbrains uppercase tracking-widest mb-3">
              Бустеры энергии
            </p>
            {boosterStacks.length === 0 ? (
              <p className="text-white/30 text-sm font-jetbrains">
                Нет бустеров. Открывайте кэши!
              </p>
            ) : (
              <div className="space-y-2">
                {boosterStacks.map((stack) => {
                  const booster = BOOSTER_CATALOG.find(
                    (b) => b.id === stack.boosterId,
                  );
                  if (!booster) return null;
                  const rarityBorder =
                    booster.rarity === "legendary"
                      ? "border-yellow-400/40 bg-yellow-400/5"
                      : booster.rarity === "rare"
                        ? "border-[#9933ff]/40 bg-[#9933ff]/5"
                        : "border-[#00ffff]/30 bg-[#00ffff]/5";
                  return (
                    <div
                      key={stack.boosterId}
                      className={`glassmorphism rounded-lg p-3 border ${rarityBorder} flex items-center gap-3`}
                    >
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                        <img
                          src={booster.asset_url}
                          alt={booster.name}
                          className="w-9 h-9 object-contain"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium font-jetbrains text-sm">
                          {booster.name}
                        </p>
                        <p className="text-white/50 text-xs font-jetbrains">
                          {booster.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {stack.count > 1 && (
                          <span className="text-[#00ffff]/60 text-xs font-jetbrains bg-[#00ffff]/10 border border-[#00ffff]/20 px-2 py-0.5 rounded">
                            x{stack.count}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleUseBooster(stack.boosterId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold font-orbitron btn-gradient-cyan text-black hover:opacity-90 transition-all duration-200"
                        >
                          USE
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Crystals */}
      <Card className="glassmorphism neon-border box-glow-purple">
        <CardHeader>
          <CardTitle className="text-[#9933ff] flex items-center gap-2 font-orbitron text-glow-purple">
            <Gem className="w-5 h-5" />
            КРИСТАЛЛЫ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {crystalStacks.length === 0 ? (
            <p className="text-white/30 text-sm font-jetbrains">
              Нет кристаллов. Открывайте кэши!
            </p>
          ) : (
            <div className="space-y-2">
              {crystalStacks.map((stack) => {
                const crystal = CRYSTAL_CATALOG.find(
                  (c) => c.id === stack.crystalId,
                );
                if (!crystal) return null;
                const rarityBorder =
                  crystal.rarity === "mythic"
                    ? "border-yellow-400/40 bg-yellow-400/5"
                    : crystal.rarity === "legendary"
                      ? "border-[#9933ff]/40 bg-[#9933ff]/5"
                      : "border-emerald-400/40 bg-emerald-400/5";
                return (
                  <div
                    key={stack.crystalId}
                    className={`glassmorphism rounded-lg p-3 border ${rarityBorder} flex items-center gap-3`}
                  >
                    <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                      <img
                        src={crystal.asset_url}
                        alt={crystal.name}
                        className="w-9 h-9 object-contain"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium font-jetbrains text-sm">
                        {crystal.name}
                      </p>
                      <p className="text-white/50 text-xs font-jetbrains">
                        {crystal.description}
                      </p>
                    </div>
                    {stack.count > 1 && (
                      <span className="text-[#9933ff]/70 text-xs font-jetbrains bg-[#9933ff]/10 border border-[#9933ff]/20 px-2 py-0.5 rounded flex-shrink-0">
                        x{stack.count}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
