import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGetLandData, useGetTokenBalance, useClaimRewards, useUpgradePlot, useDebugTokenBalance, useGetCanisterTokenBalance, useDebugCanisterBalance } from '@/hooks/useQueries';
import { formatTokenBalance } from '@/lib/tokenUtils';
import { Loader2, MapPin, Zap, TrendingUp, ExternalLink, Package } from 'lucide-react';
import { toast } from 'sonner';
import type { LandData } from '@/backend';
import { getAllLocalModifiers, type LocalModifier } from '@/lib/fakeCbr';
import { installMod, uninstallMod, getInstalledMods, type InstalledMod } from '@/lib/modInstallation';

interface LandDashboardProps {
  selectedLandIndex: number;
  onInstallChange?: () => void;
}

const RARITY_COLORS: Record<number, string> = {
  1: '#9CA3AF',
  2: '#60A5FA',
  3: '#A855F7',
  4: '#FACC15',
};

const TIER_NAMES: Record<number, string> = {
  1: 'Common',
  2: 'Rare',
  3: 'Legendary',
  4: 'Mythic',
};

export default function LandDashboard({ selectedLandIndex, onInstallChange }: LandDashboardProps) {
  const { data: lands, isLoading: landsLoading } = useGetLandData();
  const { data: tokenBalance, isLoading: balanceLoading, error: balanceError } = useGetTokenBalance();
  const claimRewardsMutation = useClaimRewards();
  const upgradePlotMutation = useUpgradePlot();
  const debugBalanceMutation = useDebugTokenBalance();

  // Admin-only canister balance
  const { data: canisterBalance } = useGetCanisterTokenBalance();
  const debugCanisterBalanceMutation = useDebugCanisterBalance();

  const [showAdminDebug, setShowAdminDebug] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<number | null>(null);
  const [isCooldownActive, setIsCooldownActive] = useState(false);

  // Local modifier inventory state (test mode)
  const [localModifiers, setLocalModifiers] = useState<LocalModifier[]>([]);
  const [installedMods, setInstalledMods] = useState<InstalledMod[]>([]);
  const [installingId, setInstallingId] = useState<number | null>(null);

  const selectedLand: LandData | undefined = lands && lands[selectedLandIndex];
  const landIdStr = selectedLand ? selectedLand.landId.toString() : '';

  // Refresh local mod lists
  const refreshLocalMods = useCallback(() => {
    setLocalModifiers(getAllLocalModifiers());
    if (landIdStr) {
      setInstalledMods(getInstalledMods(landIdStr));
    }
  }, [landIdStr]);

  useEffect(() => {
    refreshLocalMods();
    const handler = () => refreshLocalMods();
    window.addEventListener('mods-updated', handler);
    return () => window.removeEventListener('mods-updated', handler);
  }, [refreshLocalMods]);

  // Calculate cooldown timer
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
      const result = await claimRewardsMutation.mutateAsync(selectedLand.landId);

      if (result.__kind__ === 'success') {
        toast.success(`Claimed ${formatTokenBalance(result.success.tokensClaimed)} CBR tokens!`);
      } else if (result.__kind__ === 'cooldown') {
        const hours = Math.floor(Number(result.cooldown.remainingTime) / 3600000000000);
        const minutes = Math.floor((Number(result.cooldown.remainingTime) % 3600000000000) / 60000000000);
        toast.error(`Please wait ${hours}h ${minutes}m more`);
      } else if (result.__kind__ === 'insufficientCharge') {
        toast.error(`Insufficient charge. Required: ${result.insufficientCharge.required}, available: ${result.insufficientCharge.current}`);
      } else if (result.__kind__ === 'mintFailed') {
        toast.error(`Minting error: ${result.mintFailed}`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Claim error: ' + msg);
    }
  };

  const handleUpgradePlot = async () => {
    if (!selectedLand) return;

    const cost = BigInt(1000);
    if (!tokenBalance || tokenBalance < cost) {
      toast.error(`Insufficient tokens. Required: ${formatTokenBalance(cost)} CBR`);
      return;
    }

    try {
      const result = await upgradePlotMutation.mutateAsync({ landId: selectedLand.landId, cost });

      if (result.__kind__ === 'success') {
        toast.success(`Plot upgraded to level ${result.success.newLevel}!`);
      } else if (result.__kind__ === 'maxLevelReached') {
        toast.error('Maximum level reached');
      } else if (result.__kind__ === 'insufficientTokens') {
        toast.error(`Insufficient tokens. Required: ${formatTokenBalance(result.insufficientTokens.required)} CBR`);
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Upgrade error: ' + msg);
    }
  };

  const handleInstallMod = async (instanceId: number) => {
    if (!selectedLand) return;
    setInstallingId(instanceId);
    try {
      const result = installMod(instanceId, landIdStr);
      if (result) {
        toast.success(`Installed in slot ${result.slotId}`);
        refreshLocalMods();
        onInstallChange?.();
      } else {
        toast.error('No free slots available for this tier');
      }
    } finally {
      setInstallingId(null);
    }
  };

  const handleUninstallMod = (instanceId: number) => {
    if (!selectedLand) return;
    const ok = uninstallMod(instanceId, landIdStr);
    if (ok) {
      toast.success('Modifier removed from land');
      refreshLocalMods();
      onInstallChange?.();
    } else {
      toast.error('Could not remove modifier');
    }
  };

  const handleOpenMap = () => {
    if (!selectedLand) return;
    const { lat, lon } = selectedLand.coordinates;
    const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=15/${lat}/${lon}`;
    window.open(url, '_blank');
  };

  if (landsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#00ffff] drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]" />
      </div>
    );
  }

  if (!selectedLand) {
    return (
      <div className="text-center py-12">
        <p className="text-white/70 font-jetbrains">Land not found</p>
      </div>
    );
  }

  const biomeNames: Record<string, string> = {
    FOREST_VALLEY: 'Forest Valley',
    ISLAND_ARCHIPELAGO: 'Island Archipelago',
    SNOW_PEAK: 'Snow Peak',
    DESERT_DUNE: 'Desert Dune',
    VOLCANIC_CRAG: 'Volcanic Crag',
    MYTHIC_VOID: 'Mythic Void',
    MYTHIC_AETHER: 'Mythic Aether',
  };

  // Split modifiers: installed on this land vs not installed
  const installedInstanceIds = new Set(installedMods.map((m) => m.instanceId));

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
              <span className="text-white/70 font-jetbrains">Loading balance...</span>
            </div>
          ) : balanceError ? (
            <div className="space-y-2">
              <p className="text-red-400 font-jetbrains">Balance unavailable</p>
              <button
                type="button"
                onClick={() => debugBalanceMutation.mutate()}
                disabled={debugBalanceMutation.isPending}
                className="px-4 py-2 rounded-lg btn-gradient-green text-black font-orbitron disabled:opacity-50"
              >
                {debugBalanceMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Refreshing...</> : 'Refresh Balance'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-3xl font-bold text-white font-orbitron">
                {formatTokenBalance(tokenBalance || BigInt(0))} CBR
              </p>
              <button
                type="button"
                onClick={() => debugBalanceMutation.mutate()}
                disabled={debugBalanceMutation.isPending}
                className="px-3 py-1 rounded glassmorphism text-[#00ffff] hover:text-[#00ffff] hover:bg-[#00ffff]/10 transition-all duration-300 text-sm font-jetbrains border border-[#00ffff]/30"
              >
                {debugBalanceMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Refreshing...</> : 'Refresh Balance'}
              </button>
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
              <p className="text-white font-medium font-jetbrains">{selectedLand.landId.toString()}</p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Biome</p>
              <p className="text-white font-medium font-jetbrains">{biomeNames[selectedLand.biome] || selectedLand.biome}</p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Coordinates</p>
              <p className="text-white font-medium font-jetbrains">
                {selectedLand.coordinates.lat.toFixed(2)}, {selectedLand.coordinates.lon.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Level</p>
              <p className="text-white font-medium font-jetbrains">{selectedLand.upgradeLevel.toString()}</p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Multiplier</p>
              <p className="text-white font-medium font-jetbrains">{selectedLand.baseTokenMultiplier}x</p>
            </div>
            <div>
              <p className="text-white/50 text-sm font-jetbrains">Charge</p>
              <p className="text-white font-medium font-jetbrains">
                {selectedLand.cycleCharge.toString()} / {selectedLand.chargeCap.toString()}
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClaimRewards}
              disabled={claimRewardsMutation.isPending || isCooldownActive}
              className="flex-1 px-6 py-3 rounded-lg btn-gradient-green text-black font-bold font-orbitron disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {claimRewardsMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Claiming...</>
              ) : isCooldownActive && cooldownRemaining ? (
                <>GET 100 CBR ({formatCooldownTime(cooldownRemaining)})</>
              ) : (
                'GET 100 CBR'
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

      {/* Modifier Inventory Card — shows ALL mods (installed + uninstalled) */}
      <Card className="glassmorphism neon-border box-glow-purple">
        <CardHeader>
          <CardTitle className="text-[#9933ff] flex items-center gap-2 font-orbitron text-glow-purple">
            <Package className="w-5 h-5" />
            MODIFIER INVENTORY
          </CardTitle>
        </CardHeader>
        <CardContent>
          {localModifiers.length === 0 && installedMods.length === 0 ? (
            <p className="text-white/50 text-center py-4 font-jetbrains">
              No modifiers yet — open loot caches in Discovery
            </p>
          ) : (
            <div className="space-y-3">
              {/* Uninstalled mods */}
              {localModifiers.filter((m) => !installedInstanceIds.has(m.instanceId)).map((modifier) => {
                const color = RARITY_COLORS[modifier.rarityTier] ?? '#9CA3AF';
                const isInstalling = installingId === modifier.instanceId;
                return (
                  <div
                    key={modifier.instanceId}
                    className="glassmorphism rounded-lg p-4 transition-colors"
                    style={{ border: `1px solid ${color}50` }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium font-jetbrains truncate">{modifier.displayName}</p>
                        <p className="text-white/50 text-sm font-jetbrains">
                          <span style={{ color }}>{TIER_NAMES[modifier.rarityTier] ?? 'Unknown'}</span>
                          {' · '}ID: {modifier.instanceId}
                        </p>
                      </div>
                      {modifier.assetUrl && (
                        <img
                          src={modifier.assetUrl}
                          alt={modifier.displayName}
                          className="w-10 h-10 object-contain rounded ml-3 flex-shrink-0"
                        />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInstallMod(modifier.instanceId)}
                      disabled={isInstalling}
                      className="w-full px-4 py-2 rounded-lg font-bold font-orbitron text-sm transition-all disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${color}30, ${color}15)`,
                        border: `1px solid ${color}60`,
                        color,
                      }}
                    >
                      {isInstalling ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Installing...</>
                      ) : (
                        'INSTALL ON LAND'
                      )}
                    </button>
                  </div>
                );
              })}

              {/* Installed mods on this land */}
              {installedMods.map((mod) => {
                const color = RARITY_COLORS[mod.rarityTier] ?? '#9CA3AF';
                return (
                  <div
                    key={mod.instanceId}
                    className="glassmorphism rounded-lg p-4 transition-colors"
                    style={{ border: `1px solid ${color}40`, background: 'rgba(0,0,0,0.4)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium font-jetbrains truncate">{mod.modifierName}</p>
                        <p className="text-white/50 text-sm font-jetbrains">
                          <span style={{ color }}>{TIER_NAMES[mod.rarityTier] ?? 'Unknown'}</span>
                          {' · '}Slot: <span className="text-white/70">{mod.slotId}</span>
                        </p>
                      </div>
                      {mod.assetUrl && (
                        <img
                          src={mod.assetUrl}
                          alt={mod.modifierName}
                          className="w-10 h-10 object-contain rounded ml-3 flex-shrink-0"
                        />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-xs font-jetbrains px-2 py-1 rounded"
                        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
                      >
                        ✓ INSTALLED
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUninstallMod(mod.instanceId)}
                        className="text-xs font-jetbrains px-3 py-1 rounded transition-colors text-red-400 border border-red-500/30 hover:bg-red-500/10"
                      >
                        REMOVE
                      </button>
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
                Current level: <span className="text-white font-bold">{selectedLand.upgradeLevel.toString()}</span>
              </p>
              <p className="text-white/70 text-sm font-jetbrains">
                Upgrade cost: <span className="text-[#00ff41] font-bold">1000 CBR</span>
              </p>
            </div>
            <button
              type="button"
              onClick={handleUpgradePlot}
              disabled={upgradePlotMutation.isPending || Number(selectedLand.upgradeLevel) >= 5}
              className="w-full px-6 py-3 rounded-lg btn-gradient-green text-black font-bold font-orbitron disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {upgradePlotMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Upgrading...</>
              ) : Number(selectedLand.upgradeLevel) >= 5 ? (
                'MAXIMUM LEVEL'
              ) : (
                'UPGRADE PLOT'
              )}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Admin Debug Panel */}
      <Card className="glassmorphism border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <CardHeader>
          <CardTitle
            className="text-red-400 cursor-pointer flex items-center justify-between font-orbitron"
            onClick={() => setShowAdminDebug(!showAdminDebug)}
          >
            <span>DEBUG PANEL (ADMIN)</span>
            <span className="text-sm">{showAdminDebug ? '▼' : '▶'}</span>
          </CardTitle>
        </CardHeader>
        {showAdminDebug && (
          <CardContent className="space-y-4">
            <div>
              <p className="text-white/70 text-sm mb-2 font-jetbrains">Canister balance:</p>
              <p className="text-white font-mono font-jetbrains">
                {canisterBalance ? formatTokenBalance(canisterBalance) : '---'} CBR
              </p>
              <p className="text-white/50 text-xs font-jetbrains">
                Raw: {canisterBalance ? canisterBalance.toString() : '---'} e8s
              </p>
            </div>
            <button
              type="button"
              onClick={() => debugCanisterBalanceMutation.mutate()}
              disabled={debugCanisterBalanceMutation.isPending}
              className="w-full px-4 py-2 rounded-lg glassmorphism border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all duration-300 font-orbitron disabled:opacity-50"
            >
              {debugCanisterBalanceMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-2 inline" />Checking...</>
              ) : (
                'CHECK CANISTER BALANCE'
              )}
            </button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
