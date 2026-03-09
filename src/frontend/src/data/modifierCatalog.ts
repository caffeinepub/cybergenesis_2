// Static modifier catalog with 48 entries
// This data will be replaced with backend data once modifier management is fully integrated

export interface PlannedModifier {
  id: number;
  name: string;
  rarity_tier: 1 | 2 | 3 | 4;
  asset_url: string;
}

// Booster types — instant energy items
export interface Booster {
  id: string;
  name: string;
  description: string;
  energyAmount: number;
  asset_url: string;
  rarity: "common" | "rare" | "legendary";
}

// Crystal types — placeholder items (logic TBD)
export interface Crystal {
  id: string;
  name: string;
  description: string;
  color: "void" | "nebula" | "solar";
  asset_url: string;
  rarity: "rare" | "legendary" | "mythic";
}

// IMG_0354.webp = cyber rabbit (odd IDs: 1,3,5,...)
// IMG_0351.webp = astronaut  (even IDs: 2,4,6,...)
const IMG_RABBIT = "/assets/uploads/IMG_0354-1.webp";
const IMG_ASTRONAUT = "/assets/uploads/IMG_0351-2.webp";

// Alternate images by ID: odd = rabbit, even = astronaut
function img(id: number): string {
  return id % 2 !== 0 ? IMG_RABBIT : IMG_ASTRONAUT;
}

export const PLANNED_MODIFIER_CATALOG: PlannedModifier[] = [
  // Tier 1 - Common (15 entries)
  { id: 1, name: "Crystal Shard", rarity_tier: 1, asset_url: img(1) },
  { id: 2, name: "Data Fragment", rarity_tier: 1, asset_url: img(2) },
  { id: 3, name: "Nano Circuit", rarity_tier: 1, asset_url: img(3) },
  { id: 4, name: "Pixel Core", rarity_tier: 1, asset_url: img(4) },
  { id: 5, name: "Binary Chip", rarity_tier: 1, asset_url: img(5) },
  { id: 6, name: "Cyber Dust", rarity_tier: 1, asset_url: img(6) },
  { id: 7, name: "Neon Spark", rarity_tier: 1, asset_url: img(7) },
  { id: 8, name: "Code Byte", rarity_tier: 1, asset_url: img(8) },
  { id: 9, name: "Wire Mesh", rarity_tier: 1, asset_url: img(9) },
  { id: 10, name: "Glitch Token", rarity_tier: 1, asset_url: img(10) },
  { id: 11, name: "Static Charge", rarity_tier: 1, asset_url: img(11) },
  { id: 12, name: "Pulse Node", rarity_tier: 1, asset_url: img(12) },
  { id: 13, name: "Flux Capacitor", rarity_tier: 1, asset_url: img(13) },
  { id: 14, name: "Bit Stream", rarity_tier: 1, asset_url: img(14) },
  { id: 15, name: "Scan Matrix", rarity_tier: 1, asset_url: img(15) },

  // Tier 2 - Rare (15 entries)
  { id: 16, name: "Energy Orb", rarity_tier: 2, asset_url: img(16) },
  { id: 17, name: "Plasma Core", rarity_tier: 2, asset_url: img(17) },
  { id: 18, name: "Quantum Relay", rarity_tier: 2, asset_url: img(18) },
  { id: 19, name: "Neural Link", rarity_tier: 2, asset_url: img(19) },
  { id: 20, name: "Holo Prism", rarity_tier: 2, asset_url: img(20) },
  { id: 21, name: "Cyber Matrix", rarity_tier: 2, asset_url: img(21) },
  { id: 22, name: "Void Shard", rarity_tier: 2, asset_url: img(22) },
  { id: 23, name: "Photon Beam", rarity_tier: 2, asset_url: img(23) },
  { id: 24, name: "Laser Grid", rarity_tier: 2, asset_url: img(24) },
  { id: 25, name: "Neon Pulse", rarity_tier: 2, asset_url: img(25) },
  { id: 26, name: "Data Nexus", rarity_tier: 2, asset_url: img(26) },
  { id: 27, name: "Sync Module", rarity_tier: 2, asset_url: img(27) },
  { id: 28, name: "Echo Chamber", rarity_tier: 2, asset_url: img(28) },
  { id: 29, name: "Phase Shifter", rarity_tier: 2, asset_url: img(29) },
  { id: 30, name: "Warp Drive", rarity_tier: 2, asset_url: img(30) },

  // Tier 3 - Legendary (12 entries)
  { id: 31, name: "Quantum Portal", rarity_tier: 3, asset_url: img(31) },
  { id: 32, name: "Singularity Core", rarity_tier: 3, asset_url: img(32) },
  { id: 33, name: "Infinity Matrix", rarity_tier: 3, asset_url: img(33) },
  { id: 34, name: "Cosmic Nexus", rarity_tier: 3, asset_url: img(34) },
  { id: 35, name: "Void Engine", rarity_tier: 3, asset_url: img(35) },
  { id: 36, name: "Hyper Reactor", rarity_tier: 3, asset_url: img(36) },
  { id: 37, name: "Stellar Forge", rarity_tier: 3, asset_url: img(37) },
  { id: 38, name: "Dimension Gate", rarity_tier: 3, asset_url: img(38) },
  { id: 39, name: "Time Crystal", rarity_tier: 3, asset_url: img(39) },
  { id: 40, name: "Omega Sphere", rarity_tier: 3, asset_url: img(40) },
  { id: 41, name: "Genesis Cube", rarity_tier: 3, asset_url: img(41) },
  { id: 42, name: "Apex Conduit", rarity_tier: 3, asset_url: img(42) },

  // Tier 4 - Mythic (6 entries)
  { id: 43, name: "Eternal Nexus", rarity_tier: 4, asset_url: img(43) },
  { id: 44, name: "Primordial Core", rarity_tier: 4, asset_url: img(44) },
  { id: 45, name: "Celestial Artifact", rarity_tier: 4, asset_url: img(45) },
  { id: 46, name: "Divine Catalyst", rarity_tier: 4, asset_url: img(46) },
  { id: 47, name: "Transcendent Relic", rarity_tier: 4, asset_url: img(47) },
  { id: 48, name: "Omnipotent Shard", rarity_tier: 4, asset_url: img(48) },
];

// Booster catalog — 3 types, each gives energy immediately on use
export const BOOSTER_CATALOG: Booster[] = [
  {
    id: "NOVA_CHARGE",
    name: "Nova Charge",
    description: "+250 энергии",
    energyAmount: 250,
    asset_url:
      "/assets/generated/booster-energy-250-transparent.dim_256x256.png",
    rarity: "common",
  },
  {
    id: "PLASMA_SURGE",
    name: "Plasma Surge",
    description: "+500 энергии",
    energyAmount: 500,
    asset_url:
      "/assets/generated/booster-energy-500-transparent.dim_256x256.png",
    rarity: "rare",
  },
  {
    id: "STELLAR_BURST",
    name: "Stellar Burst",
    description: "+1000 энергии",
    energyAmount: 1000,
    asset_url:
      "/assets/generated/booster-energy-1000-transparent.dim_256x256.png",
    rarity: "legendary",
  },
];

// Crystal catalog — 3 types, placeholder (purpose TBD)
export const CRYSTAL_CATALOG: Crystal[] = [
  {
    id: "VOID_CRYSTAL",
    name: "Void Crystal",
    description: "Кристалл тёмной пустоты. Назначение неизвестно.",
    color: "void",
    asset_url: "/assets/generated/crystal-void-transparent.dim_256x256.png",
    rarity: "rare",
  },
  {
    id: "NEBULA_CRYSTAL",
    name: "Nebula Crystal",
    description:
      "Изумрудный кристалл космической туманности. Назначение неизвестно.",
    color: "nebula",
    asset_url: "/assets/generated/crystal-nebula-transparent.dim_256x256.png",
    rarity: "legendary",
  },
  {
    id: "SOLAR_CRYSTAL",
    name: "Solar Crystal",
    description: "Солнечный кристалл звёздной энергии. Назначение неизвестно.",
    color: "solar",
    asset_url: "/assets/generated/crystal-solar-transparent.dim_256x256.png",
    rarity: "mythic",
  },
];
