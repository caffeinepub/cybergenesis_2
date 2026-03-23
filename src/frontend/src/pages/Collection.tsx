import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Star, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";
import {
  PLANNED_MODIFIER_CATALOG,
  type PlannedModifier,
  RARITY_COLORS,
  RARITY_GLOW,
} from "../data/modifierCatalog";

export default function Collection() {
  const [selectedImage, setSelectedImage] = useState<{
    src: string;
    name: string;
  } | null>(null);

  const tierCounts = PLANNED_MODIFIER_CATALOG.reduce(
    (acc, mod) => {
      acc[mod.rarity_tier] = (acc[mod.rarity_tier] || 0) + 1;
      return acc;
    },
    {} as Record<number, number>,
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom duration-700">
      {/* Header Card */}
      <Card className="glassmorphism border-primary/30">
        <CardHeader>
          <CardTitle className="font-orbitron text-3xl text-glow-teal flex items-center gap-3">
            <Sparkles className="h-8 w-8" />
            MODIFIER COLLECTION
          </CardTitle>
          <p className="font-jetbrains text-sm text-muted-foreground mt-2">
            Explore the complete catalog of modifiers available in CyberGenesis.
            Collect them through loot cache discoveries.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              className="glassmorphism p-4 rounded-lg text-center"
              style={{ border: "1px solid rgba(156,163,175,0.25)" }}
            >
              <p className="font-jetbrains text-xs text-muted-foreground uppercase mb-1">
                Common
              </p>
              <p
                className="font-orbitron text-2xl font-bold"
                style={{
                  color: "#9CA3AF",
                  textShadow: "0 0 8px rgba(156,163,175,0.5)",
                }}
              >
                {tierCounts[1] || 0}
              </p>
            </div>
            <div
              className="glassmorphism p-4 rounded-lg text-center"
              style={{ border: "1px solid rgba(96,165,250,0.25)" }}
            >
              <p className="font-jetbrains text-xs text-muted-foreground uppercase mb-1">
                Rare
              </p>
              <p
                className="font-orbitron text-2xl font-bold"
                style={{
                  color: "#60A5FA",
                  textShadow: "0 0 8px rgba(96,165,250,0.6)",
                }}
              >
                {tierCounts[2] || 0}
              </p>
            </div>
            <div
              className="glassmorphism p-4 rounded-lg text-center"
              style={{ border: "1px solid rgba(168,85,247,0.25)" }}
            >
              <p className="font-jetbrains text-xs text-muted-foreground uppercase mb-1">
                Legendary
              </p>
              <p
                className="font-orbitron text-2xl font-bold"
                style={{
                  color: "#A855F7",
                  textShadow: "0 0 8px rgba(168,85,247,0.7)",
                }}
              >
                {tierCounts[3] || 0}
              </p>
            </div>
            <div
              className="glassmorphism p-4 rounded-lg text-center"
              style={{ border: "1px solid rgba(250,204,21,0.25)" }}
            >
              <p className="font-jetbrains text-xs text-muted-foreground uppercase mb-1">
                Mythic
              </p>
              <p
                className="font-orbitron text-2xl font-bold"
                style={{
                  color: "#FACC15",
                  textShadow: "0 0 10px rgba(250,204,21,0.8)",
                }}
              >
                {tierCounts[4] || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modifier Grid */}
      <Card className="glassmorphism border-accent/30">
        <CardHeader>
          <CardTitle className="font-orbitron text-2xl text-glow-green flex items-center gap-2">
            <Star className="h-6 w-6" />
            ALL MODIFIERS ({PLANNED_MODIFIER_CATALOG.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {PLANNED_MODIFIER_CATALOG.map((modifier, index) => (
              <ModifierCard
                key={modifier.id}
                modifier={modifier}
                index={index}
                onImageClick={(src, name) => setSelectedImage({ src, name })}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Image Modal 500x500 - rendered via portal to escape scroll containers */}
      {selectedImage &&
        createPortal(
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            style={{ zIndex: 9999 }}
            onClick={() => setSelectedImage(null)}
            onKeyDown={(e) => e.key === "Escape" && setSelectedImage(null)}
            aria-label="Image viewer"
          >
            <div
              className="relative glassmorphism border border-primary/40 rounded-xl p-4 shadow-[0_0_40px_rgba(0,243,255,0.3)]"
              style={{ width: 540, height: 540 }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-3 right-3 text-white/60 hover:text-white transition-colors z-10"
                data-ocid="collection.image_modal.close_button"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={selectedImage.src}
                alt={selectedImage.name}
                className="w-full h-full object-contain rounded-lg"
                style={{ width: 500, height: 500 }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

interface ModifierCardProps {
  modifier: PlannedModifier;
  index: number;
  onImageClick: (src: string, name: string) => void;
}

function ModifierCard({ modifier, index, onImageClick }: ModifierCardProps) {
  const [hovered, setHovered] = useState(false);

  const color = RARITY_COLORS[modifier.rarity_tier] ?? "#9CA3AF";
  const glow = RARITY_GLOW[modifier.rarity_tier] ?? "rgba(156,163,175,0.25)";

  const getTierName = (tier: number): string => {
    switch (tier) {
      case 1:
        return "COMMON";
      case 2:
        return "RARE";
      case 3:
        return "LEGENDARY";
      case 4:
        return "MYTHIC";
      default:
        return "UNKNOWN";
    }
  };

  const getBorderColor = (tier: number, isHovered: boolean) => {
    const alpha = isHovered ? 0.75 : 0.55;
    switch (tier) {
      case 1:
        return `rgba(156,163,175,${alpha})`;
      case 2:
        return `rgba(96,165,250,${alpha})`;
      case 3:
        return `rgba(168,85,247,${alpha})`;
      case 4:
        return `rgba(250,204,21,${alpha})`;
      default:
        return `rgba(156,163,175,${alpha})`;
    }
  };

  const getDividerColor = (tier: number) => {
    switch (tier) {
      case 1:
        return "rgba(156,163,175,0.5)";
      case 2:
        return "rgba(96,165,250,0.6)";
      case 3:
        return "rgba(168,85,247,0.65)";
      case 4:
        return "rgba(250,204,21,0.7)";
      default:
        return "rgba(156,163,175,0.5)";
    }
  };

  const cardStyle: React.CSSProperties = {
    animationDelay: `${index * 20}ms`,
    animationDuration: "400ms",
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${getBorderColor(modifier.rarity_tier, hovered)}`,
    borderRadius: "10px",
    padding: "12px 8px 10px",
    transition: "all 0.25s ease",
    cursor: "pointer",
    boxShadow: hovered
      ? `0 0 18px ${glow}, inset 0 0 0 1px rgba(255,255,255,0.05)`
      : `0 0 8px ${glow}, inset 0 0 0 1px rgba(255,255,255,0.03)`,
    transform: hovered ? "translateY(-2px) scale(1.03)" : "none",
  };

  const imgStyle: React.CSSProperties = {
    filter: `drop-shadow(0 0 ${hovered ? "16px" : "8px"} ${glow})`,
    transition: "filter 0.3s ease",
    width: 64,
    height: 64,
    objectFit: "contain" as const,
  };

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom"
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex flex-col items-center gap-1">
        {/* Image or placeholder */}
        <button
          type="button"
          className="p-0 border-0 bg-transparent cursor-zoom-in"
          onClick={(e) => {
            e.stopPropagation();
            if (modifier.asset_url)
              onImageClick(modifier.asset_url, modifier.name);
          }}
          aria-label={`Открыть изображение ${modifier.name}`}
        >
          {modifier.asset_url ? (
            <img
              src={modifier.asset_url}
              alt={modifier.name}
              style={imgStyle}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                background: "rgba(255,255,255,0.03)",
                border: `1px dashed ${color}40`,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                color: `${color}60`,
              }}
            >
              ?
            </div>
          )}
        </button>

        {/* Rarity divider line */}
        <div
          style={{
            height: 1,
            width: "80%",
            margin: "6px auto 4px",
            background: `linear-gradient(to right, transparent, ${getDividerColor(modifier.rarity_tier)}, transparent)`,
          }}
        />

        {/* Rarity badge */}
        <span
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            color: color,
            letterSpacing: "0.05em",
            opacity: 0.9,
          }}
        >
          {getTierName(modifier.rarity_tier)}
        </span>

        {/* Name */}
        <p
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            textAlign: "center",
            lineHeight: 1.3,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: "100%",
            margin: 0,
          }}
        >
          {modifier.name}
        </p>

        {/* ID */}
        <p
          style={{
            fontSize: 9,
            fontFamily: "monospace",
            color: "rgba(255,255,255,0.2)",
            textAlign: "center",
            margin: 0,
          }}
        >
          ID: {modifier.id}
        </p>
      </div>
    </div>
  );
}
