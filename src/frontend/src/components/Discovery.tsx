import type { LootCache, Result_1, Result_3 } from "@/backend";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BOOSTER_CATALOG,
  CRYSTAL_CATALOG,
  PLANNED_MODIFIER_CATALOG,
} from "@/data/modifierCatalog";
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

function getModifierAssetUrl(modifierName: string): string {
  const normalized = modifierName
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  const found = PLANNED_MODIFIER_CATALOG.find(
    (m) => m.name.toLowerCase() === normalized.toLowerCase(),
  );
  return found?.asset_url ?? PLANNED_MODIFIER_CATALOG[0]?.asset_url ?? "";
}

function rollRandomLoot(cacheTier: number): {
  itemType: "modifier" | "booster" | "crystal";
  itemId: string;
  displayName: string;
  rarityTier: number;
  multiplierValue: number;
  assetUrl: string;
} {
  const roll = Math.random();

  if (roll < 0.5) {
    // Modifier weighted by tier
    const tierPool: Record<number, [number, number]> = {
      1: [0, 14],
      2: [15, 29],
      3: [30, 47],
    };
    const [min, max] = tierPool[cacheTier] ?? [0, 47];
    const pick = Math.floor(Math.random() * (max - min + 1)) + min;
    const mod = PLANNED_MODIFIER_CATALOG[pick] ?? PLANNED_MODIFIER_CATALOG[0];
    return {
      itemType: "modifier",
      itemId: mod.name,
      displayName: mod.name,
      rarityTier: mod.rarity_tier,
      multiplierValue: 1 + mod.rarity_tier * 0.15,
      assetUrl: mod.asset_url,
    };
  }
  if (roll < 0.8) {
    // Booster
    const boosterPool =
      cacheTier === 1
        ? [BOOSTER_CATALOG[0], BOOSTER_CATALOG[0], BOOSTER_CATALOG[1]]
        : cacheTier === 2
          ? [
              BOOSTER_CATALOG[0],
              BOOSTER_CATALOG[1],
              BOOSTER_CATALOG[1],
              BOOSTER_CATALOG[2],
            ]
          : [BOOSTER_CATALOG[1], BOOSTER_CATALOG[2], BOOSTER_CATALOG[2]];
    const booster = boosterPool[Math.floor(Math.random() * boosterPool.length)];
    return {
      itemType: "booster",
      itemId: booster.id,
      displayName: booster.name,
      rarityTier:
        booster.rarity === "common" ? 1 : booster.rarity === "rare" ? 2 : 3,
      multiplierValue: 0,
      assetUrl: booster.asset_url,
    };
  }
  // Crystal
  const crystalPool =
    cacheTier === 1
      ? [CRYSTAL_CATALOG[0], CRYSTAL_CATALOG[0], CRYSTAL_CATALOG[1]]
      : cacheTier === 2
        ? [CRYSTAL_CATALOG[0], CRYSTAL_CATALOG[1], CRYSTAL_CATALOG[2]]
        : [CRYSTAL_CATALOG[1], CRYSTAL_CATALOG[2], CRYSTAL_CATALOG[2]];
  const crystal = crystalPool[Math.floor(Math.random() * crystalPool.length)];
  return {
    itemType: "crystal",
    itemId: crystal.id,
    displayName: crystal.name,
    rarityTier:
      crystal.rarity === "rare" ? 2 : crystal.rarity === "legendary" ? 3 : 4,
    multiplierValue: 0,
    assetUrl: crystal.asset_url,
  };
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

  useEffect(() => {
    fakeCbr.migrateLootLog();
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
      const existing = await actor.getAllModifiers();
      if (existing.length === 0) {
        await actor.adminSetAllModifiers(
          PLANNED_MODIFIER_CATALOG.slice(0, 7).map((m, i) => ({
            mod_id: BigInt(i),
            rarity_tier: BigInt(m.rarity_tier),
            name: m.name,
            multiplier_value: 1 + m.rarity_tier * 0.15,
            asset_url: "",
          })),
        );
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
      const openedIds = fakeCbr.getOpenedCacheIds();
      setCaches(
        result.filter(
          (c) => !c.is_opened && !openedIds.includes(c.cache_id.toString()),
        ),
      );
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
      const result: Result_3 = await actor.discoverLootCache(BigInt(tier));
      if ("ok" in result) {
        toast.success(`Кэш уровня ${tier} обнаружен!`);
        await loadCaches();
        await new Promise((resolve) => setTimeout(resolve, 500));
        queryClient.invalidateQueries({ queryKey: ["landData"] });
        queryClient.invalidateQueries({ queryKey: ["tokenBalance"] });
      } else {
        toast.error(
          `Ошибка обнаружения кэша: ${(result as { err: string }).err}`,
        );
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
    const cache = caches.find((c) => c.cache_id === cacheId);
    const cacheTier = cache ? Number(cache.tier) : 1;

    try {
      try {
        const result: Result_1 = await actor.processCache(cacheId);
        console.log("Backend processCache result:", result);
      } catch (backendError: any) {
        console.warn(
          "Backend processCache error (ignored):",
          backendError?.message,
        );
      }

      const loot = rollRandomLoot(cacheTier);

      if (loot.itemType === "booster") {
        fakeCbr.addBooster(loot.itemId);
      } else if (loot.itemType === "crystal") {
        fakeCbr.addCrystal(loot.itemId);
      } else if (loot.itemType === "modifier") {
        fakeCbr.addLocalModifier({
          modifierType: loot.itemId,
          displayName: loot.displayName,
          rarityTier: loot.rarityTier,
          assetUrl: loot.assetUrl,
        });
      }

      // Mark as opened to prevent re-opening after page refresh
      fakeCbr.markCacheOpened(cacheId.toString());
      setCaches((prev) => prev.filter((c) => c.cache_id !== cacheId));

      fakeCbr.addLootDrop({
        cacheId: cacheId.toString(),
        cacheTier,
        itemType: loot.itemType,
        itemId: loot.itemId,
        displayName: loot.displayName,
        rarityTier: loot.rarityTier,
        multiplierValue: loot.multiplierValue,
        openedAt: Date.now(),
      });
      setLootLog(fakeCbr.getLootLog());

      const typeLabel =
        loot.itemType === "booster"
          ? "Бустер"
          : loot.itemType === "crystal"
            ? "Кристалл"
            : "Модификатор";
      toast.success(`${typeLabel}: ${loot.displayName}!`);

      if (loot.itemType === "modifier") {
        queryClient.invalidateQueries({ queryKey: ["modifierInventory"] });
      }
      queryClient.invalidateQueries({ queryKey: ["boosters"] });
      queryClient.invalidateQueries({ queryKey: ["crystals"] });
    } catch (error: any) {
      console.error("Process cache fatal error:", error);
      toast.error(
        `Ошибка обработки кэша: ${error.message || "Неизвестная ошибка"}`,
      );
    } finally {
      setProcessingCacheId(null);
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

  const getLootItemColor = (entry: LootDropEntry) => {
    if (entry.itemType === "booster") {
      if (entry.rarityTier >= 3)
        return "text-yellow-400 border-yellow-400/30 bg-yellow-400/5";
      if (entry.rarityTier === 2)
        return "text-purple-400 border-purple-400/30 bg-purple-400/5";
      return "text-blue-400 border-blue-400/30 bg-blue-400/5";
    }
    if (entry.itemType === "crystal") {
      if (entry.rarityTier >= 4)
        return "text-yellow-400 border-yellow-400/30 bg-yellow-400/5";
      if (entry.rarityTier === 3)
        return "text-purple-400 border-purple-400/30 bg-purple-400/5";
      return "text-emerald-400 border-emerald-400/30 bg-emerald-400/5";
    }
    const tierColors: Record<number, string> = {
      1: "text-gray-400 border-gray-400/30 bg-gray-400/5",
      2: "text-blue-400 border-blue-400/30 bg-blue-400/5",
      3: "text-purple-400 border-purple-400/30 bg-purple-400/5",
      4: "text-yellow-400 border-yellow-400/30 bg-yellow-400/5",
    };
    return (
      tierColors[entry.rarityTier] ?? "text-white border-white/20 bg-white/5"
    );
  };

  const getLootAssetUrl = (entry: LootDropEntry): string => {
    if (entry.itemType === "booster") {
      return (
        BOOSTER_CATALOG.find((b) => b.id === entry.itemId)?.asset_url ?? ""
      );
    }
    if (entry.itemType === "crystal") {
      return (
        CRYSTAL_CATALOG.find((c) => c.id === entry.itemId)?.asset_url ?? ""
      );
    }
    return getModifierAssetUrl(
      entry.itemId || (entry as { modifierType?: string }).modifierType || "",
    );
  };

  const getLootTypeLabel = (entry: LootDropEntry) => {
    if (entry.itemType === "booster") return "Бустер";
    if (entry.itemType === "crystal") return "Кристалл";
    return "Модификатор";
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
                onClick={() => debugBalanceMutation.mutateAsync()}
                disabled={debugBalanceMutation.isPending}
                size="sm"
                variant="outline"
                className="border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41]/10"
              >
                Обновить баланс
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-3xl font-bold text-white">
                {formatTokenBalance(tokenBalance || BigInt(0))} CBR
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => debugBalanceMutation.mutateAsync()}
                  disabled={debugBalanceMutation.isPending}
                  size="sm"
                  variant="ghost"
                  className="text-[#00d4ff] hover:text-[#00d4ff] hover:bg-[#00d4ff]/10"
                >
                  Обновить баланс
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
                    "Получить 100 CBR"
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
              Откройте кэш, чтобы увидеть выпавшие предметы
            </p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {lootLog.map((entry) => {
                const colorClass = getLootItemColor(entry);
                const assetUrl = getLootAssetUrl(entry);
                const typeLabel = getLootTypeLabel(entry);
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
                            alt={entry.displayName || entry.itemId}
                            className="w-9 h-9 object-contain"
                          />
                        ) : (
                          <span className="text-xl">
                            {entry.itemType === "crystal"
                              ? "💎"
                              : entry.itemType === "booster"
                                ? "⚡"
                                : "🔵"}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-white font-medium font-jetbrains text-sm">
                          {entry.displayName || entry.itemId}
                        </p>
                        <p className="text-white/50 text-xs font-jetbrains">
                          {typeLabel}
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
