// Static modifier catalog with 48 entries
// This data will be replaced with backend data once modifier management is fully integrated

export interface PlannedModifier {
  id: number;
  name: string;
  rarity_tier: 1 | 2 | 3 | 4;
  asset_url: string;
}

const CYBER_RABBIT = "/assets/uploads/IMG_8545-1.png";

export const PLANNED_MODIFIER_CATALOG: PlannedModifier[] = [
  // Tier 1 - Common (15 entries)
  { id: 1, name: "Crystal Shard", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 2, name: "Data Fragment", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 3, name: "Nano Circuit", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 4, name: "Pixel Core", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 5, name: "Binary Chip", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 6, name: "Cyber Dust", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 7, name: "Neon Spark", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 8, name: "Code Byte", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 9, name: "Wire Mesh", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 10, name: "Glitch Token", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 11, name: "Static Charge", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 12, name: "Pulse Node", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 13, name: "Flux Capacitor", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 14, name: "Bit Stream", rarity_tier: 1, asset_url: CYBER_RABBIT },
  { id: 15, name: "Scan Matrix", rarity_tier: 1, asset_url: CYBER_RABBIT },

  // Tier 2 - Rare (15 entries)
  { id: 16, name: "Energy Orb", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 17, name: "Plasma Core", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 18, name: "Quantum Relay", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 19, name: "Neural Link", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 20, name: "Holo Prism", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 21, name: "Cyber Matrix", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 22, name: "Void Shard", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 23, name: "Photon Beam", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 24, name: "Laser Grid", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 25, name: "Neon Pulse", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 26, name: "Data Nexus", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 27, name: "Sync Module", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 28, name: "Echo Chamber", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 29, name: "Phase Shifter", rarity_tier: 2, asset_url: CYBER_RABBIT },
  { id: 30, name: "Warp Drive", rarity_tier: 2, asset_url: CYBER_RABBIT },

  // Tier 3 - Legendary (12 entries)
  { id: 31, name: "Quantum Portal", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 32, name: "Singularity Core", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 33, name: "Infinity Matrix", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 34, name: "Cosmic Nexus", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 35, name: "Void Engine", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 36, name: "Hyper Reactor", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 37, name: "Stellar Forge", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 38, name: "Dimension Gate", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 39, name: "Time Crystal", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 40, name: "Omega Sphere", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 41, name: "Genesis Cube", rarity_tier: 3, asset_url: CYBER_RABBIT },
  { id: 42, name: "Apex Conduit", rarity_tier: 3, asset_url: CYBER_RABBIT },

  // Tier 4 - Mythic (6 entries)
  { id: 43, name: "Eternal Nexus", rarity_tier: 4, asset_url: CYBER_RABBIT },
  { id: 44, name: "Primordial Core", rarity_tier: 4, asset_url: CYBER_RABBIT },
  {
    id: 45,
    name: "Celestial Artifact",
    rarity_tier: 4,
    asset_url: CYBER_RABBIT,
  },
  { id: 46, name: "Divine Catalyst", rarity_tier: 4, asset_url: CYBER_RABBIT },
  {
    id: 47,
    name: "Transcendent Relic",
    rarity_tier: 4,
    asset_url: CYBER_RABBIT,
  },
  { id: 48, name: "Omnipotent Shard", rarity_tier: 4, asset_url: CYBER_RABBIT },
];
