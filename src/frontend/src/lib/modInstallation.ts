/**
 * modInstallation.ts
 * Manages mod slot assignment and installed mods per land.
 * All data is stored in localStorage for test mode.
 *
 * Anchor slot naming:
 *   Common    c_01 ... c_15  (rarityTier=1)
 *   Rare      r_01 ... r_15  (rarityTier=2)
 *   Legendary l_01 ... l_12  (rarityTier=3)
 *   Mythic    m_01 ... m_06  (rarityTier=4)
 *
 * Mega-GLB node naming matches anchor slots but prefixed with "mod_":
 *   mod_c_01 ... mod_c_15
 *   mod_r_01 ... mod_r_15
 *   mod_l_01 ... mod_l_12
 *   mod_m_01 ... mod_m_06
 */

import { getLocalModifiers, markModifierApplied } from "./fakeCbr";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InstalledMod {
  instanceId: number; // fakeCbr instance id
  slotId: string; // e.g. "c_03"
  modNodeName: string; // e.g. "mod_c_03" — node name inside mega-GLB
  modifierName: string; // display name
  rarityTier: number; // 1|2|3|4
  assetUrl: string; // webp preview url
  installedAt: number; // timestamp
}

export interface AnchorPoint {
  id: string; // e.g. "c_03"
  position: [number, number, number];
  rotation: [number, number, number];
  tier?: string; // optional tier override
}

// ─── Slot tables ────────────────────────────────────────────────────────────

const TIER_SLOTS: Record<number, string[]> = {
  1: Array.from(
    { length: 15 },
    (_, i) => `c_${String(i + 1).padStart(2, "0")}`,
  ),
  2: Array.from(
    { length: 15 },
    (_, i) => `r_${String(i + 1).padStart(2, "0")}`,
  ),
  3: Array.from(
    { length: 12 },
    (_, i) => `l_${String(i + 1).padStart(2, "0")}`,
  ),
  4: Array.from({ length: 6 }, (_, i) => `m_${String(i + 1).padStart(2, "0")}`),
};

export const TIER_SLOT_COUNTS: Record<number, number> = {
  1: 15,
  2: 15,
  3: 12,
  4: 6,
};

/** Convert slotId to the mega-GLB node name */
export function slotToNodeName(slotId: string): string {
  return `mod_${slotId}`;
}

/** Tier prefix: 1→c, 2→r, 3→l, 4→m */
export function tierPrefix(rarityTier: number): string {
  const map: Record<number, string> = { 1: "c", 2: "r", 3: "l", 4: "m" };
  return map[rarityTier] ?? "c";
}

/** Which mega-GLB url to use for a given tier */
export const MEGA_GLB_URLS: Record<number, string> = {
  1: "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/mega_common.glb",
  2: "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/mega_rare.glb",
  3: "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/mega_legendary.glb",
  4: "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/mega_mythic.glb",
};

// ─── localStorage helpers ───────────────────────────────────────────────────

function storageKey(landId: string): string {
  return `cyberland_installed_mods_${landId}`;
}

export function getInstalledMods(landId: string): InstalledMod[] {
  try {
    const raw = localStorage.getItem(storageKey(landId));
    if (!raw) return [];
    return JSON.parse(raw) as InstalledMod[];
  } catch {
    return [];
  }
}

function saveInstalledMods(landId: string, mods: InstalledMod[]): void {
  localStorage.setItem(storageKey(landId), JSON.stringify(mods));
  try {
    window.dispatchEvent(
      new CustomEvent("mods-updated", { detail: { landId } }),
    );
  } catch {}
}

// ─── Install logic ──────────────────────────────────────────────────────────

/**
 * Install a modifier onto a land.
 * Picks a random FREE slot in the modifier's tier.
 * Returns the assigned slotId or null if no free slot.
 */
export function installMod(
  instanceId: number,
  landId: string,
): { slotId: string; modNodeName: string } | null {
  // Get the modifier from inventory
  const allMods = getLocalModifiers();
  const modifier = allMods.find((m) => m.instanceId === instanceId);
  if (!modifier) return null;

  const tier = modifier.rarityTier;
  const slots = TIER_SLOTS[tier] ?? TIER_SLOTS[1];

  // Find occupied slots for this land
  const installed = getInstalledMods(landId);
  const occupiedSlots = new Set(installed.map((m) => m.slotId));

  // Free slots
  const freeSlots = slots.filter((s) => !occupiedSlots.has(s));
  if (freeSlots.length === 0) return null;

  // Pick a random free slot
  const slotId = freeSlots[Math.floor(Math.random() * freeSlots.length)];
  const modNodeName = slotToNodeName(slotId);

  const entry: InstalledMod = {
    instanceId,
    slotId,
    modNodeName,
    modifierName: modifier.displayName,
    rarityTier: tier,
    assetUrl: modifier.assetUrl,
    installedAt: Date.now(),
  };

  // Persist
  const updated = [...installed, entry];
  saveInstalledMods(landId, updated);

  // Mark modifier as applied in fakeCbr inventory so it disappears from inventory
  markModifierApplied(instanceId, landId);

  return { slotId, modNodeName };
}

/**
 * Remove an installed modifier from a land by instanceId.
 * Returns it to inventory (clears appliedToLand in fakeCbr).
 */
export function uninstallMod(instanceId: number, landId: string): boolean {
  const installed = getInstalledMods(landId);
  const idx = installed.findIndex((m) => m.instanceId === instanceId);
  if (idx === -1) return false;

  const updated = installed.filter((m) => m.instanceId !== instanceId);
  saveInstalledMods(landId, updated);

  // Clear appliedToLand in fakeCbr so it re-appears in inventory
  try {
    const raw = localStorage.getItem("cyberland_local_modifiers");
    if (raw) {
      const all = JSON.parse(raw);
      const patched = all.map(
        (m: { instanceId: number; appliedToLand?: string }) =>
          m.instanceId === instanceId ? { ...m, appliedToLand: undefined } : m,
      );
      localStorage.setItem(
        "cyberland_local_modifiers",
        JSON.stringify(patched),
      );
    }
  } catch {
    /* ignore */
  }

  return true;
}

/**
 * Load anchor points for a biome from AnchorBuilder localStorage.
 * Returns array with id, position (world scale 1), rotation.
 */
export function loadAnchorsForBiome(biome: string): AnchorPoint[] {
  try {
    const raw = localStorage.getItem(`cyberland_anchors_${biome}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AnchorPoint[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get the world-space position for a slot on a land.
 * Multiplies stored anchor coords by 12 (land scale).
 */
export function getAnchorWorldPosition(
  slotId: string,
  biome: string,
  landScale = 12,
): {
  position: [number, number, number];
  rotation: [number, number, number];
} | null {
  const anchors = loadAnchorsForBiome(biome);
  const anchor = anchors.find((a) => a.id === slotId);
  if (!anchor) return null;
  return {
    position: [
      anchor.position[0] * landScale,
      anchor.position[1] * landScale,
      anchor.position[2] * landScale,
    ],
    rotation: anchor.rotation ?? [0, 0, 0],
  };
}

/** Count free slots per tier for a given land */
export function getFreeSlotCount(landId: string, rarityTier: number): number {
  const total = TIER_SLOT_COUNTS[rarityTier] ?? 0;
  const installed = getInstalledMods(landId);
  const occupied = installed.filter((m) => m.rarityTier === rarityTier).length;
  return Math.max(0, total - occupied);
}
