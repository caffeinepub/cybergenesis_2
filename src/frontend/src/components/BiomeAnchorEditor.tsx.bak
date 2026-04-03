import { OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useRef, useState } from "react";
import ReactDOM from "react-dom";
import type * as THREE from "three";
import AnchorBuilder from "./AnchorBuilder";

const BIOME_MODEL_MAP: Record<string, string> = {
  FOREST_VALLEY:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/FOREST_VALLEY_KTX2.glb",
  ISLAND_ARCHIPELAGO:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/ISLAND_ARCHIPELAGO.glb",
  SNOW_PEAK:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/SNOW_PEAK.glb",
  DESERT_DUNE:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/DESERT_DUNE.glb",
  VOLCANIC_CRAG:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/VOLCANIC_CRAG.glb",
  MYTHIC_VOID:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/MYTHIC_VOID.glb",
  MYTHIC_AETHER:
    "https://raw.githubusercontent.com/dobr312/cyberland/main/public/models/MYTHIC_AETHER.glb",
};

const BIOME_LABELS: Record<string, string> = {
  FOREST_VALLEY: "FOREST",
  ISLAND_ARCHIPELAGO: "ISLAND",
  SNOW_PEAK: "SNOW",
  DESERT_DUNE: "DESERT",
  VOLCANIC_CRAG: "VOLCANIC",
  MYTHIC_VOID: "MYTHIC_VOID",
  MYTHIC_AETHER: "MYTHIC_AETHER",
};

const BIOME_KEYS = Object.keys(BIOME_MODEL_MAP);

// ─── Biome key normalization ─────────────────────────────────────────────────
const BACKEND_BIOME_MAP: Record<string, string> = {
  Forest: "FOREST_VALLEY",
  FOREST_VALLEY: "FOREST_VALLEY",
  Desert: "DESERT_DUNE",
  DESERT_DUNE: "DESERT_DUNE",
  Ocean: "ISLAND_ARCHIPELAGO",
  ISLAND_ARCHIPELAGO: "ISLAND_ARCHIPELAGO",
  Mountain: "SNOW_PEAK",
  Tundra: "SNOW_PEAK",
  SNOW_PEAK: "SNOW_PEAK",
  Volcano: "VOLCANIC_CRAG",
  VOLCANIC_CRAG: "VOLCANIC_CRAG",
  MYTHIC_VOID: "MYTHIC_VOID",
  MYTHIC_AETHER: "MYTHIC_AETHER",
};

function normalizeBiomeForEditor(biome: unknown): string {
  let key: string;
  if (typeof biome === "string") key = biome;
  else if (typeof biome === "object" && biome !== null)
    key = Object.keys(biome as Record<string, unknown>)[0] ?? "";
  else key = "";
  return BACKEND_BIOME_MAP[key] ?? "FOREST_VALLEY";
}

function BiomeLandModel({
  modelUrl,
  landRef,
  scale,
}: {
  modelUrl: string;
  landRef: React.RefObject<THREE.Group | null>;
  scale: number;
}) {
  const { scene } = useGLTF(modelUrl);
  return (
    <primitive ref={landRef} object={scene} scale={[scale, scale, scale]} />
  );
}

/**
 * SceneContent — lives INSIDE the Canvas.
 * ONE Canvas stays alive; only inner model reloads on biome change.
 * AnchorBuilder does NOT remount — it receives biomeName prop and
 * handles the transition internally via prevBiomeRef useEffect.
 */
function SceneContent({
  biome,
  landScale,
  onScaleChange,
  setOrbitEnabled,
  orbitEnabled,
}: {
  biome: string;
  landScale: number;
  onScaleChange: (s: number) => void;
  setOrbitEnabled: (v: boolean) => void;
  orbitEnabled: boolean;
}) {
  const landRef = useRef<THREE.Group>(null);
  const modelUrl = BIOME_MODEL_MAP[biome];

  return (
    <>
      {/* Black scene background — prevents purple gradient bleed */}
      <color attach="background" args={["#000000"]} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} />

      {/* OrbitControls controlled by AnchorBuilder drag state */}
      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Model — keyed so it reloads on biome change without Canvas remount */}
      <Suspense fallback={null} key={biome}>
        {modelUrl && (
          <BiomeLandModel
            modelUrl={modelUrl}
            landRef={landRef}
            scale={landScale}
          />
        )}
      </Suspense>

      {/* AnchorBuilder — NOT keyed on biome; handles biome switch internally */}
      {modelUrl && (
        <AnchorBuilder
          landRef={landRef}
          finalLandScale={landScale}
          currentScale={landScale}
          onScaleChange={onScaleChange}
          biomeName={biome}
          setOrbitEnabled={setOrbitEnabled}
        />
      )}
    </>
  );
}

export default function BiomeAnchorEditor({
  onClose,
  defaultBiome,
}: { onClose: () => void; defaultBiome?: string }) {
  const initialBiome = normalizeBiomeForEditor(defaultBiome);
  const [selectedBiome, setSelectedBiome] = useState(initialBiome);
  const [landScale, setLandScale] = useState(1);
  const [orbitEnabled, setOrbitEnabled] = useState(true);

  const content = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        background: "#000",
        display: "flex",
        flexDirection: "column",
        isolation: "isolate",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          height: 52,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 12,
          background: "rgba(0,0,0,0.9)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0,255,136,0.2)",
          zIndex: 99999,
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            fontSize: 12,
            color: "#00ff88",
            letterSpacing: 2,
            whiteSpace: "nowrap",
            opacity: 0.9,
          }}
        >
          ⬡ BIOME ANCHOR EDITOR
        </span>

        {/* Biome selector */}
        <div
          style={{
            display: "flex",
            gap: 4,
            flex: 1,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {BIOME_KEYS.map((biome) => {
            const isActive = selectedBiome === biome;
            return (
              <button
                key={biome}
                type="button"
                onClick={() => setSelectedBiome(biome)}
                style={{
                  fontFamily: "monospace",
                  fontSize: 9,
                  letterSpacing: 1,
                  padding: "4px 8px",
                  background: isActive
                    ? "rgba(0,255,136,0.15)"
                    : "rgba(0,0,0,0.5)",
                  border: `1px solid ${
                    isActive ? "rgba(0,255,136,0.9)" : "rgba(0,255,136,0.2)"
                  }`,
                  borderRadius: 4,
                  color: isActive ? "#00ff88" : "rgba(0,255,136,0.45)",
                  cursor: "pointer",
                  boxShadow: isActive ? "0 0 8px rgba(0,255,136,0.35)" : "none",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {BIOME_LABELS[biome]}
              </button>
            );
          })}
        </div>

        <span
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            color: "rgba(0,255,136,0.5)",
            whiteSpace: "nowrap",
          }}
        >
          SCALE {landScale}×
        </span>

        <button
          type="button"
          onClick={onClose}
          style={{
            fontFamily: "monospace",
            fontSize: 10,
            padding: "5px 14px",
            background: "rgba(0,0,0,0.7)",
            color: "#00ff88",
            border: "1px solid rgba(0,255,136,0.5)",
            borderRadius: 3,
            cursor: "pointer",
            letterSpacing: 1,
            backdropFilter: "blur(8px)",
            whiteSpace: "nowrap",
          }}
        >
          ✕ EXIT
        </button>
      </div>

      {/* 3D Canvas — NOT keyed on biome to prevent crash */}
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        <Canvas
          style={{ width: "100%", height: "100%", background: "#000" }}
          gl={{ antialias: true, alpha: false }}
        >
          <SceneContent
            biome={selectedBiome}
            landScale={landScale}
            onScaleChange={setLandScale}
            setOrbitEnabled={setOrbitEnabled}
            orbitEnabled={orbitEnabled}
          />
        </Canvas>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
