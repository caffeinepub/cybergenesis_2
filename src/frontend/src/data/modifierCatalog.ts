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

export const PLANNED_MODIFIER_CATALOG: PlannedModifier[] = [
  // Tier 1 - Common (15 entries)
  {
    id: 1,
    name: "RuBaRu",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_1.webp",
  },
  {
    id: 2,
    name: "Omnity",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_2.webp",
  },
  {
    id: 3,
    name: "Catalyze",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_3.webp",
  },
  {
    id: 4,
    name: "ELNAai",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_4.webp",
  },
  {
    id: 5,
    name: "BoB",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_5.webp",
  },
  {
    id: 6,
    name: "KinicAI",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_6.webp",
  },
  {
    id: 7,
    name: "CLOUD",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_7.webp",
  },
  {
    id: 8,
    name: "WaterNeuron",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_8.webp",
  },
  {
    id: 9,
    name: "ICLighthouse",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_9.webp",
  },
  {
    id: 10,
    name: "LiquidiumWTF",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_10.webp",
  },
  {
    id: 11,
    name: "DecideAI",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_11.webp",
  },
  {
    id: 12,
    name: "ICPHUBS",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_12.webp",
  },
  {
    id: 13,
    name: "TRAX",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_13.webp",
  },
  {
    id: 14,
    name: "zCloak",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_14.webp",
  },
  {
    id: 15,
    name: "GLDT",
    rarity_tier: 1,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_15.webp",
  },

  // Tier 2 - Rare (15 entries)
  {
    id: 16,
    name: "Plug",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_16.webp",
  },
  {
    id: 17,
    name: "dscvrOne",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_17.webp",
  },
  {
    id: 18,
    name: "distrikt",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_18.webp",
  },
  {
    id: 19,
    name: "BoomDAO",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_19.webp",
  },
  {
    id: 20,
    name: "YRAL",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_20.webp",
  },
  {
    id: 21,
    name: "onicai",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_21.webp",
  },
  {
    id: 22,
    name: "IC_GHOST",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_22.webp",
  },
  {
    id: 23,
    name: "SNEED",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_23.webp",
  },
  {
    id: 24,
    name: "WUMBO",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_24.webp",
  },
  {
    id: 25,
    name: "Sonic",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_25.webp",
  },
  {
    id: 26,
    name: "ICPSwap",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_26.webp",
  },
  {
    id: 27,
    name: "COE",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_27.webp",
  },
  {
    id: 28,
    name: "Windoge98",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_28.webp",
  },
  {
    id: 29,
    name: "Yuku",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_29.webp",
  },
  {
    id: 30,
    name: "TabbyPOS",
    rarity_tier: 2,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_30.webp",
  },

  // Tier 3 - Legendary (12 entries)
  {
    id: 31,
    name: "CLOWN",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_31.webp",
  },
  {
    id: 32,
    name: "drifty",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_32.webp",
  },
  {
    id: 33,
    name: "DOGMI",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_33.webp",
  },
  {
    id: 34,
    name: "OpenChat",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_34.webp",
  },
  {
    id: 35,
    name: "KongSwap",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_35.webp",
  },
  {
    id: 36,
    name: "Odin_fun",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_36.webp",
  },
  {
    id: 37,
    name: "TokoApp",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_37.webp",
  },
  {
    id: 38,
    name: "DfinityDEV",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_38.webp",
  },
  {
    id: 39,
    name: "Piggycell",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_39.webp",
  },
  {
    id: 40,
    name: "Dragginz",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_40.webp",
  },
  {
    id: 41,
    name: "TAGGR",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_41.webp",
  },
  {
    id: 42,
    name: "ICPanda",
    rarity_tier: 3,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_42.webp",
  },

  // Tier 4 - Mythic (6 entries)
  {
    id: 43,
    name: "OISY",
    rarity_tier: 4,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_43.webp",
  },
  {
    id: 44,
    name: "DMAIL",
    rarity_tier: 4,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_44.webp",
  },
  {
    id: 45,
    name: "ICP",
    rarity_tier: 4,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_45.webp",
  },
  {
    id: 46,
    name: "Motoko",
    rarity_tier: 4,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_46.webp",
  },
  {
    id: 47,
    name: "caffeine",
    rarity_tier: 4,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_47.webp",
  },
  {
    id: 48,
    name: "InternetComputer",
    rarity_tier: 4,
    asset_url:
      "https://raw.githubusercontent.com/dobr312/cyberland/refs/heads/main/Mods/modifier_48.webp",
  },
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

// Rarity color helpers
export const RARITY_COLORS: Record<number, string> = {
  1: "#9CA3AF", // Common — серый
  2: "#60A5FA", // Rare — синий
  3: "#A855F7", // Legendary — фиолетовый
  4: "#FACC15", // Mythic — золотой
};

export const RARITY_GLOW: Record<number, string> = {
  1: "rgba(156,163,175,0.25)",
  2: "rgba(96,165,250,0.45)",
  3: "rgba(168,85,247,0.55)",
  4: "rgba(250,204,21,0.7)",
};
