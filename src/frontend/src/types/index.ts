import type { Principal } from "@icp-sdk/core/principal";

export type Time = bigint;

export interface LandData {
  landId: bigint;
  owner: Principal;
  // biome can be string directly or Motoko variant object like { FOREST_VALLEY: null }
  biome: string;
  plotLevel: bigint;
  // Extended fields used by components
  plotName: string;
  upgradeLevel: bigint;
  baseTokenMultiplier: number;
  cycleCharge: bigint;
  chargeCap: bigint;
  totalRewardsEarned: bigint;
  lastClaimTime: Time;
  coordinates: { x: bigint; y: bigint; lat?: number; lon?: number };
  customName: { __kind__: "Some"; value: string } | { __kind__: "None" };
  decorationUrl: { __kind__: "Some"; value: string } | { __kind__: "None" };
  decorationURL?: string;
  activeModifiers: bigint[];
  attachedModifications: Array<
    | bigint
    | { modifierInstanceId: bigint; modifierType: string; rarity_tier: bigint }
  >;
}

export interface ModifierInstance {
  instanceId: bigint;
  modifierId: bigint;
  modifierInstanceId: bigint;
  rarity_tier: bigint;
  appliedToLand: { __kind__: "Some"; value: bigint } | { __kind__: "None" };
  acquiredAt: Time;
}

export interface UserProfile {
  username: string;
  name?: string;
  avatarUrl: string;
  bio: string;
}

export interface TopLandEntry {
  landId: bigint;
  owner: Principal;
  principal: Principal;
  biome: string;
  plotLevel: bigint;
  plotName: string;
  upgradeLevel: bigint;
  tokenBalance: bigint;
  totalRewards: bigint;
}

export interface LootCache {
  cacheId: bigint;
  cache_id: bigint;
  landId: bigint;
  isOpened: boolean;
  is_opened: boolean;
  tier?: number;
  createdAt: Time;
  discovered_at?: Time;
}

export type Result_1 =
  | { __kind__: "ok"; ok: LootCache }
  | { __kind__: "err"; err: string };

export type Result_3 =
  | { __kind__: "ok"; ok: ModifierInstance }
  | { __kind__: "err"; err: string };
