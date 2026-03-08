import type { LootCache, Result_1, Result_3 } from "@/backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLANNED_MODIFIER_CATALOG } from "@/data/modifierCatalog";
import { useActor } from "@/hooks/useActor";
import {
  useDebugTokenBalance,
  useGetLandData,
  useGetTokenBalance,
  useMintFakeCbr,
} from "@/hooks/useQueries";
import * as fakeCbr from "@/lib/fakeCbr";
import type { LootDropEntry } from "@/lib/fakeCbr";
import { formatTokenBalance } from "@/lib/tokenUtils";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Gift, Loader2, Package, Sparkles, Zap } from "lucide-react";
import React, { useState, useEffect } from "react";
import { toast } from "sonner";

// Normalize modifier type name to match catalog (e.g. "ENERGY_BOOST" -> "Energy Boost")
function getModifierAssetUrl(modifierType: string): string {
  const normalized = modifierType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const found = PLANNED_MODIFIER_CATALOG.find(
    (m) => m.name.toLowerCase() === normalized.toLowerCase(),
  );
  return found?.asset_url ?? PLANNED_MODIFIER_CATALOG[0]?.asset_url ?? "";
}

export default function Discovery() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const { data: lands, isLoading: landsLoading } = useGetLandData();
  const {
    data: tokenBalance,
    isLoading: balanceLoading,
    error: balanceError,
  } = useGetTokenBalance();
  const debugBalanceMutation = useDebugTokenBalance();
  const mintFakeCbrMutation = useMintFakeCbr();

  const [caches, setCaches] = useState<LootCache[]>([]);
  const [cachesLoading, setCachesLoading] = useState(false);
  const [discoveringTier, setDiscoveringTier] = useState<number | null>(null);
  const [processingCacheId, setProcessingCacheId] = useState<bigint | null>(
    null,
  );
  const [lootLog, setLootLog] = useState<LootDropEntry[]>([]);

  // Load loot log from localStorage on mount
  useEffect(() => {
    setLootLog(fakeCbr.getLootLog());
  }, []);

  const selectedLand = lands?.[0];

  React.useEffect(() => {
    if (actor) {
      initModifiersAndLoadCaches();
    }
  }, [actor]);

  const initModifiersAndLoadCaches = async () => {
    if (!actor) return;
    try {
      // Check if modifiers are initialized
      const existing = await actor.getAllModifiers();
      if (existing.length === 0) {
        // Seed test modifiers
        await actor.adminSetAllModifiers([
          {
            mod_id: BigInt(0),
            rarity_tier: BigInt(1),
            name: "ENERGY_BOOST",
            multiplier_value: 1.1,
            asset_url: "",
          },
          {
            mod_id: BigInt(1),
            rarity_tier: BigInt(1),
            name: "YIELD_BOOST",
            multiplier_value: 1.15,
            asset_url: "",
          },
          {
            mod_id: BigInt(2),
            rarity_tier: BigInt(2),
            name: "CHARGE_AMPLIFIER",
            multiplier_value: 1.25,
            asset_url: "",
          },
          {
            mod_id: BigInt(3),
            rarity_tier: BigInt(2),
            name: "POWER_SURGE",
            multiplier_value: 1.3,
            asset_url: "",
          },
          {
            mod_id: BigInt(4),
            rarity_tier: BigInt(3),
            name: "QUANTUM_FIELD",
            multiplier_value: 1.5,
            asset_url: "",
          },
          {
            mod_id: BigInt(5),
            rarity_tier: BigInt(3),
            name: "VOID_CRYSTAL",
            multiplier_value: 1.75,
            asset_url: "",
          },
          {
            mod_id: BigInt(6),
            rarity_tier: BigInt(4),
            name: "MYTHIC_CORE",
            multiplier_value: 2.0,
            asset_url: "",
          },
        ]);
        console.log("Test modifiers initialized");
      }
    } catch (error) {
      console.error("Error initializing modifiers:", error);
    }
    await loadCaches();
  };

  const loadCaches = async () => {
    if (!actor) return;
    setCachesLoading(true);
    try {
      const result = await actor.getMyLootCaches();
      // Only show unopened caches
      setCaches(result.filter((c) => !c.is_opened));
    } catch (error) {
      console.error("Error loading caches:", error);
    } finally {
      setCachesLoading(false);
    }
  };

  const handleDiscoverCache = async (tier: number) => {
    if (!actor || !selectedLand) {
      toast.error("Актор или земля недоступны");
      return;
    }

    const tierCosts = {
      1: { cbr: BigInt(10000000000), charge: 200 },
      2: { cbr: BigInt(25000000000), charge: 500 },
      3: { cbr: BigInt(50000000000), charge: 1000 },
    };

    const cost = tierCosts[tier as keyof typeof tierCosts];

    if (!tokenBalance || tokenBalance < cost.cbr) {
      toast.error(
        `Недостаточно CBR. Требуется: ${formatTokenBalance(cost.cbr)} CBR`,
      );
      return;
    }

    if (selectedLand.cycleCharge < cost.charge) {
      toast.error(
        `Недостаточно заряда. Требуется: ${cost.charge}, доступно: ${selectedLand.cycleCharge}`,
      );
      return;
    }

    setDiscoveringTier(tier);

    try {
      console.log("Discovering cache tier:", tier);
      const result: Result_3 = await actor.discoverLootCache(BigInt(tier));
      console.log("Discovery result:", result);

      if (result.__kind__ === "ok") {
        toast.success(`Кэш уровня ${tier} обнаружен!`);
        await loadCaches();
        await new Promise((resolve) => setTimeout(resolve, 500));
        queryClient.invalidateQueries({ queryKey: ["landData"] });
        queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      } else {
        toast.error(`Ошибка обнаружения кэша: ${result.err}`);
      }
    } catch (error: any) {
      console.error("Discovery error:", error);
      toast.error(
        `Ошибка обнаружения кэша: ${error.message || "Неизвестная ошибка"}`,
      );
    } finally {
      setDiscoveringTier(null);
    }
  };

  const handleProcessCache = async (cacheId: bigint) => {
    if (!actor) {
      toast.error("Актор недоступен");
      return;
    }

    setProcessingCacheId(cacheId);

    try {
      console.log("Processing cache:", cacheId);
      const result: Result_1 = await actor.processCache(cacheId);
      console.log("Process result:", result);

      if (result.__kind__ === "ok") {
        const mod = result.ok;
        const cacheTier = caches.find((c) => c.cache_id === cacheId)
          ? Number(caches.find((c) => c.cache_id === cacheId)!.tier)
          : 0;
        toast.success(
          `Получен модификатор: ${mod.modifierType} (Tier ${mod.rarity_tier})`,
        );
        // Save drop to loot log
        fakeCbr.addLootDrop({
          cacheId: cacheId.toString(),
          cacheTier,
          modifierType: mod.modifierType,
          rarityTier: Number(mod.rarity_tier),
          multiplierValue: Number(mod.multiplier_value),
          openedAt: Date.now(),
        });
        setLootLog(fakeCbr.getLootLog());
        // Remove opened cache from list immediately
        setCaches((prev) => prev.filter((c) => c.cache_id !== cacheId));
      } else {
        toast.error(`Ошибка открытия кэша: ${result.err}`);
        await loadCaches();
      }
      queryClient.invalidateQueries({ queryKey: ["modifierInventory"] });
    } catch (error: any) {
      console.error("Process cache error:", error);
      toast.error(
        `Ошибка обработки кэша: ${error.message || "Неизвестная ошибка"}`,
      );
    } finally {
      setProcessingCacheId(null);
    }
  };

  const handleDebugBalance = async () => {
    try {
      await debugBalanceMutation.mutateAsync();
    } catch (error) {
      console.error("Debug balance error:", error);
    }
  };

  const getTierColor = (tier: number) => {
    switch (tier) {
      case 1:
        return "text-gray-400 border-gray-400/30";
      case 2:
        return "text-blue-400 border-blue-400/30";
      case 3:
        return "text-purple-400 border-purple-400/30";
      default:
        return "text-white border-white/30";
    }
  };

  const getTierName = (tier: number) => {
    switch (tier) {
      case 1:
        return "Обычный";
      case 2:
        return "Редкий";
      case 3:
        return "Легендарный";
      default:
        return "Неизвестный";
    }
  };

  const getTimeRemaining = (cache: LootCache) => {
    const fourHoursNs = BigInt(4 * 60 * 60) * BigInt(1_000_000_000);
    const nowNs = BigInt(Date.now()) * BigInt(1_000_000);
    const elapsed = nowNs - cache.discovered_at;
    const remaining = fourHoursNs - elapsed;

    if (remaining <= BigInt(0)) return null;

    const totalSec = Number(remaining / BigInt(1_000_000_000));
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);

    return `${hours}ч ${minutes}м`;
  };

  if (landsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ff41]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CBR Balance Card */}
      <Card className="bg-black/40 backdrop-blur-md border-[#00ff41]/30 shadow-[0_0_15px_rgba(0,255,65,0.3)]">
        <CardHeader>
          <CardTitle className="text-[#00ff41] flex items-center gap-2">
            <Zap className="w-5 h-5" />
            БАЛАНС CBR
          </CardTitle>
        </CardHeader>
        <CardContent>
          {balanceLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#00ff41]" />
              <span className="text-white/70">Загрузка баланса...</span>
            </div>
          ) : balanceError ? (
            <div className="space-y-2">
              <p className="text-red-400">Баланс недоступен</p>
              <Button
                onClick={handleDebugBalance}
                disabled={debugBalanceMutation.isPending}
                size="sm"
                variant="outline"
                className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10"
              >
                {debugBalanceMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Обновление...
                  </>
                ) : (
                  "Обновить баланс"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-3xl font-bold text-white">
                {formatTokenBalance(tokenBalance || BigInt(0))} CBR
              </p>
              <p className="text-sm text-white/50">
                Raw: {(tokenBalance || BigInt(0)).toString()} e8s
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleDebugBalance}
                  disabled={debugBalanceMutation.isPending}
                  size="sm"
                  variant="ghost"
                  className="text-[#00d4ff] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10"
                >
                  {debugBalanceMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Обновление...
                    </>
                  ) : (
                    "Обновить баланс"
                  )}
                </Button>
                <Button
                  data-ocid="discovery.mint_cbr.primary_button"
                  onClick={() =>
                    mintFakeCbrMutation.mutate(BigInt(100_000_000_000))
                  }
                  disabled={mintFakeCbrMutation.isPending}
                  size="sm"
                  className="bg-[#00ff41]/20 hover:bg-[#00ff41]/30 text-[#00ff41] border border-[#00ff41]/40 font-bold"
                >
                  {mintFakeCbrMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Минтинг...
                    </>
                  ) : (
                    "🪙 Получить 100 CBR"
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discovery Tiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((tier) => (
          <Card
            key={tier}
            className={`bg-black/40 backdrop-blur-md border ${getTierColor(tier)} shadow-[0_0_15px_rgba(0,255,65,0.2)]`}
          >
            <CardHeader>
              <CardTitle className={getTierColor(tier).split(" ")[0]}>
                {getTierName(tier)} Кэш
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-white/70 text-sm">
                  Стоимость:{" "}
                  <span className="text-[#00ff41] font-bold">
                    {tier === 1 ? "100" : tier === 2 ? "250" : "500"} CBR
                  </span>
                </p>
                <p className="text-white/70 text-sm">
                  Заряд:{" "}
                  <span className="text-[#00d4ff] font-bold">
                    {tier === 1 ? "200" : tier === 2 ? "500" : "1000"}
                  </span>
                </p>
                <p className="text-white/70 text-sm">
                  Шанс LandToken:{" "}
                  <span className="text-purple-400 font-bold">
                    {tier === 1 ? "0.05%" : tier === 2 ? "0.2%" : "0.5%"}
                  </span>
                </p>
              </div>
              <Button
                onClick={() => handleDiscoverCache(tier)}
                disabled={discoveringTier !== null || !selectedLand}
                className={`w-full ${
                  tier === 1
                    ? "bg-gray-600 hover:bg-gray-700"
                    : tier === 2
                      ? "bg-blue-600 hover:bg-blue-700"
                      : "bg-purple-600 hover:bg-purple-700"
                } text-white font-bold`}
              >
                {discoveringTier === tier ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Обнаружение...
                  </>
                ) : (
                  "ОБНАРУЖИТЬ КЭШ"
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Loot Drop Log */}
      <Card className="bg-black/40 backdrop-blur-md border-[#9933ff]/30 shadow-[0_0_15px_rgba(153,51,255,0.3)]">
        <CardHeader>
          <CardTitle className="text-[#9933ff] flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            ПОЛУЧЕННЫЙ ЛУТ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lootLog.length === 0 ? (
            <p className="text-white/50 text-center py-4 font-jetbrains">
              Откройте кэш, чтобы увидеть выпавшие модификаторы
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {lootLog.map((entry) => {
                const tierColors: Record<number, string> = {
                  1: "text-gray-400 border-gray-400/30 bg-gray-400/5",
                  2: "text-blue-400 border-blue-400/30 bg-blue-400/5",
                  3: "text-purple-400 border-purple-400/30 bg-purple-400/5",
                  4: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
                };
                const tierNames: Record<number, string> = {
                  1: "Обычный",
                  2: "Редкий",
                  3: "Легендарный",
                  4: "Мифический",
                };
                const colorClass =
                  tierColors[entry.rarityTier] ??
                  "text-white border-white/20 bg-white/5";
                const assetUrl = getModifierAssetUrl(entry.modifierType);
                return (
                  <div
                    key={entry.id}
                    className={`rounded-lg p-3 border ${colorClass} flex items-center justify-between`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 flex-shrink-0 rounded-lg overflow-hidden bg-black/30 flex items-center justify-center">
                        {assetUrl ? (
                          <img
                            src={assetUrl}
                            alt={entry.modifierType}
                            className="w-9 h-9 object-contain"
                          />
                        ) : (
                          <span className="text-xl">
                            {entry.rarityTier === 4
                              ? "🌟"
                              : entry.rarityTier === 3
                                ? "💎"
                                : entry.rarityTier === 2
                                  ? "🔵"
                                  : "⚪"}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium font-jetbrains text-sm">
                          {entry.modifierType}
                        </p>
                        <p className="text-white/50 text-xs font-jetbrains">
                          {tierNames[entry.rarityTier] ?? "Неизвестный"} • +
                          {(entry.multiplierValue * 100 - 100).toFixed(0)}% •
                          Кэш #{entry.cacheId} (Tier {entry.cacheTier})
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs font-jetbrains">
                        {new Date(entry.openedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* My Caches */}
      <Card className="bg-black/40 backdrop-blur-md border-[#00d4ff]/30 shadow-[0_0_15px_rgba(0,212,255,0.3)]">
        <CardHeader>
          <CardTitle className="text-[#00d4ff] flex items-center gap-2">
            <Package className="w-5 h-5" />
            МОИ КЭШИ
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cachesLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#00d4ff]" />
              <span className="text-white/70">Загрузка кэшей...</span>
            </div>
          ) : caches.length === 0 ? (
            <p className="text-white/50 text-center py-4">
              Нет обнаруженных кэшей
            </p>
          ) : (
            <div className="space-y-3">
              {caches.map((cache) => (
                <div
                  key={cache.cache_id.toString()}
                  className={`bg-white/5 rounded-lg p-4 border ${getTierColor(Number(cache.tier))}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-white font-medium">
                        {getTierName(Number(cache.tier))} Кэш #
                        {cache.cache_id.toString()}
                      </p>
                      {!cache.is_opened &&
                        (() => {
                          const remaining = getTimeRemaining(cache);
                          return remaining ? (
                            <p className="text-white/50 text-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {remaining} (−10 заряда за раннее открытие)
                            </p>
                          ) : (
                            <p className="text-green-400 text-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Готов к бесплатному открытию
                            </p>
                          );
                        })()}
                    </div>
                    <div>
                      {cache.is_opened ? (
                        <span className="text-green-400 text-sm">✓ Открыт</span>
                      ) : (
                        <Button
                          onClick={() => handleProcessCache(cache.cache_id)}
                          disabled={processingCacheId !== null}
                          size="sm"
                          className="bg-[#00ff41] hover:bg-[#00ff41]/80 text-black font-bold"
                        >
                          {processingCacheId === cache.cache_id ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              Открытие...
                            </>
                          ) : (
                            <>
                              <Gift className="w-4 h-4 mr-2" />
                              ОТКРЫТЬ
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
