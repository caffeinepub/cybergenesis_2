import {
  Html,
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera,
  useGLTF,
} from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef, useState } from "react";
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

// ─── BiomeLandModel: renders model, calls onLoaded when ready ───────────────
function BiomeLandModel({
  modelUrl,
  landRef,
  scale,
  onLoaded,
}: {
  modelUrl: string;
  landRef: React.RefObject<THREE.Group | null>;
  scale: number;
  onLoaded: () => void;
}) {
  const { scene } = useGLTF(modelUrl);

  // Signal loaded on next frame after scene is available
  useEffect(() => {
    const id = requestAnimationFrame(onLoaded);
    return () => cancelAnimationFrame(id);
  }, [onLoaded]);

  return (
    <primitive ref={landRef} object={scene} scale={[scale, scale, scale]} />
  );
}

// ─── BlackBackground: always-on clear color via useThree ───────────────────
function BlackBackground() {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(0x000000, 1);
  }, [gl]);
  return <color attach="background" args={["#000000"]} />;
}

// ─── SceneContent: camera lives HERE, not inside AnchorBuilder ─────────────
function SceneContent({
  biome,
  landScale,
  onScaleChange,
  setOrbitEnabled,
  orbitEnabled,
  cameraMode,
  onLoaded,
}: {
  biome: string;
  landScale: number;
  onScaleChange: (s: number) => void;
  setOrbitEnabled: (v: boolean) => void;
  orbitEnabled: boolean;
  cameraMode: "perspective" | "ortho";
  onLoaded: () => void;
}) {
  const landRef = useRef<THREE.Group>(null);
  const modelUrl = BIOME_MODEL_MAP[biome];

  return (
    <>
      <BlackBackground />

      {/* Camera is OUTSIDE Suspense so it never unmounts during model load */}
      {cameraMode === "perspective" ? (
        <PerspectiveCamera makeDefault position={[0, 5, 10]} fov={50} />
      ) : (
        <OrthographicCamera
          makeDefault
          position={[15, 0, 0]}
          zoom={40}
          up={[0, 1, 0]}
        />
      )}

      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 10, 5]} intensity={1.5} />

      <OrbitControls
        makeDefault
        enabled={orbitEnabled}
        enableDamping
        dampingFactor={0.05}
      />

      {/* Model in its own Suspense — keyed on biome to force remount of model only */}
      {modelUrl && (
        <Suspense fallback={null} key={biome}>
          <BiomeLandModel
            modelUrl={modelUrl}
            landRef={landRef}
            scale={landScale}
            onLoaded={onLoaded}
          />
        </Suspense>
      )}

      {/* AnchorBuilder OUTSIDE Suspense — never suspends, handles biome switch via prop */}
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
  const [cameraMode, setCameraMode] = useState<"perspective" | "ortho">(
    "perspective",
  );
  const [isLoading, setIsLoading] = useState(true);

  // Reset loading state when biome changes
  const handleBiomeChange = (biome: string) => {
    setIsLoading(true);
    setSelectedBiome(biome);
  };

  const handleLoaded = () => {
    setIsLoading(false);
  };

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
          background: "rgba(0,0,0,0.95)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(0,255,136,0.2)",
          zIndex: 99999,
          position: "relative",
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
                onClick={() => handleBiomeChange(biome)}
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
                  opacity: isLoading && !isActive ? 0.5 : 1,
                  pointerEvents: isLoading ? "none" : "auto",
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

        {/* Camera toggle in top bar */}
        <button
          type="button"
          onClick={() =>
            setCameraMode((m) =>
              m === "perspective" ? "ortho" : "perspective",
            )
          }
          style={{
            fontFamily: "monospace",
            fontSize: 9,
            padding: "4px 10px",
            background: "rgba(0,0,0,0.6)",
            color: "rgba(0,243,255,0.7)",
            border: "1px solid rgba(0,243,255,0.3)",
            borderRadius: 3,
            cursor: "pointer",
            letterSpacing: 1,
            whiteSpace: "nowrap",
          }}
        >
          {cameraMode === "perspective" ? "📷 PERSP" : "📐 ORTHO"}
        </button>

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

      {/* 3D Canvas wrapper */}
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        {/* Canvas — NEVER keyed, stays alive always */}
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 1);
          }}
        >
          <SceneContent
            biome={selectedBiome}
            landScale={landScale}
            onScaleChange={setLandScale}
            setOrbitEnabled={setOrbitEnabled}
            orbitEnabled={orbitEnabled}
            cameraMode={cameraMode}
            onLoaded={handleLoaded}
          />
        </Canvas>

        {/* Loading overlay — renders on top of Canvas, fully opaque black during load */}
        {isLoading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "#000",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            {/* Animated ring */}
            <div
              style={{
                width: 48,
                height: 48,
                border: "2px solid rgba(0,255,136,0.12)",
                borderTop: "2px solid #00ff88",
                borderRadius: "50%",
                animation: "anchorSpin 0.9s linear infinite",
              }}
            />
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                letterSpacing: 3,
                color: "rgba(0,255,136,0.7)",
                textShadow: "0 0 12px rgba(0,255,136,0.5)",
              }}
            >
              LOADING {BIOME_LABELS[selectedBiome] ?? selectedBiome}...
            </div>
            <style>{`
              @keyframes anchorSpin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
