import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Result_2 = {
    __kind__: "ok";
    ok: LandData;
} | {
    __kind__: "err";
    err: string;
};
export interface TransformationOutput {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Time = bigint;
export interface LootCache {
    owner: Principal;
    tier: bigint;
    cache_id: bigint;
    discovered_at: Time;
    is_opened: boolean;
}
export type ClaimResult = {
    __kind__: "Ok";
    Ok: number;
} | {
    __kind__: "Err";
    Err: string;
};
export interface LandData {
    lat: number;
    lon: number;
    decorationURL?: string;
    baseTokenMultiplier: number;
    lastChargeUpdate: Time;
    upgradeLevel: bigint;
    owner: Principal;
    landId: bigint;
    lastClaimTime: Time;
    biome: string;
    chargeCap: bigint;
    cycleCharge: bigint;
    plotName: string;
    attachedModifications: Array<ModifierInstance>;
}
export type Result_1 = {
    __kind__: "ok";
    ok: ModifierInstance;
} | {
    __kind__: "err";
    err: string;
};
export interface http_header {
    value: string;
    name: string;
}
export interface http_request_result {
    status: bigint;
    body: Uint8Array;
    headers: Array<http_header>;
}
export type Result_4 = {
    __kind__: "ok";
    ok: LootCache;
} | {
    __kind__: "err";
    err: string;
};
export type Result = {
    __kind__: "ok";
    ok: null;
} | {
    __kind__: "err";
    err: string;
};
export interface TopLandEntry {
    upgradeLevel: bigint;
    owner: Principal;
    landId: bigint;
    tokenBalance: number;
}
export type Result_3 = {
    __kind__: "ok";
    ok: string;
} | {
    __kind__: "err";
    err: string;
};
export interface TransformationInput {
    context: Uint8Array;
    response: http_request_result;
}
export interface Modifier {
    name: string;
    asset_url: string;
    mod_id: bigint;
    rarity_tier: bigint;
    multiplier_value: number;
}
export type UpgradeResult = {
    __kind__: "Ok";
    Ok: LandData;
} | {
    __kind__: "Err";
    Err: string;
};
export interface ModifierInstance {
    modifierInstanceId: bigint;
    modifierType: string;
    model_url: string;
    rarity_tier: bigint;
    multiplier_value: number;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    adminGetLandData(landId: bigint): Promise<LandData | null>;
    adminSetAllModifiers(mods: Array<Modifier>): Promise<Result>;
    applyModifier(landId: bigint, modifierInstanceId: bigint): Promise<Result_2>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    claimRewards(landId: bigint): Promise<ClaimResult>;
    discoverLootCache(tier: bigint): Promise<Result_4>;
    getAllModifiers(): Promise<Array<Modifier>>;
    getAssetCanisterCycleBalance(): Promise<Result_3>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getCurrentCbrBalance(): Promise<number>;
    getLandData(landId: bigint): Promise<LandData | null>;
    getLandDataQuery(landId: bigint): Promise<LandData | null>;
    getLandOwner(landId: bigint): Promise<Principal | null>;
    getMyLootCaches(): Promise<Array<LootCache>>;
    getMyModifications(): Promise<Array<ModifierInstance>>;
    getTopLands(n: bigint): Promise<Array<TopLandEntry>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    mintLand(): Promise<Result_2>;
    processCache(cache_id: bigint): Promise<Result_1>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    setGovernanceCanister(p: Principal): Promise<void>;
    setMarketplaceCanister(p: Principal): Promise<void>;
    setTokenCanister(p: Principal): Promise<void>;
    transferLand(landId: bigint, to: Principal): Promise<Result>;
    transform(raw: TransformationInput): Promise<TransformationOutput>;
    updateDecoration(landId: bigint, url: string | null): Promise<Result>;
    updatePlotName(landId: bigint, name: string): Promise<Result>;
    upgradePlot(landId: bigint): Promise<UpgradeResult>;
}
