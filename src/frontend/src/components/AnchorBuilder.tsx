import {
  Html,
  OrthographicCamera,
  PerspectiveCamera,
  Text,
  TransformControls,
} from "@react-three/drei";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import type * as THREE from "three";

// ─── Tiers ──────────────────────────────────────────────────────────────────
const TIERS = [
  { prefix: "c", max: 15, label: "C — COMMON", color: "#9CA3AF" },
  { prefix: "r", max: 15, label: "R — RARE", color: "#60A5FA" },
  { prefix: "l", max: 12, label: "L — LEGENDARY", color: "#A855F7" },
  { prefix: "m", max: 6, label: "M — MYTHIC", color: "#FACC15" },
  { prefix: "k", max: 1, label: "K — KING", color: "#FF6B35" },
] as const;
type TierPrefix = (typeof TIERS)[number]["prefix"];

interface Anchor {
  name: string;
  tier: TierPrefix;
  position: [number, number, number];
  rotationY: number;
}

export interface AnchorBuilderProps {
  landRef: React.RefObject<THREE.Object3D | null>;
  finalLandScale?: number;
  biomeName?: string;
  onScaleChange?: (scale: number) => void;
  currentScale?: number;
  /** pass setter so AnchorBuilder can control OrbitControls in parent */
  setOrbitEnabled?: (v: boolean) => void;
}

// ─── localStorage helpers ────────────────────────────────────────────────────
function storageKey(biome: string) {
  return `cyberland_anchors_${biome}`;
}
function loadAnchors(biome: string): Anchor[] {
  try {
    const raw = localStorage.getItem(storageKey(biome));
    if (raw) return JSON.parse(raw) as Anchor[];
  } catch {}
  return [];
}
function saveAnchors(biome: string, anchors: Anchor[]) {
  try {
    localStorage.setItem(storageKey(biome), JSON.stringify(anchors));
  } catch {}
}

// ─── Anchor chassis: sphere + cylinder + nose cone ───────────────────────────
function AnchorChassis({
  color,
  selected,
}: { color: string; selected: boolean }) {
  const c = selected ? "#ffff00" : color;
  return (
    <group>
      {/* Ground ring — shows anchor base clearly */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.08, 0.13, 32]} />
        <meshBasicMaterial
          color={selected ? "#ffff00" : "#ff0099"}
          transparent
          opacity={0.9}
          side={2}
        />
      </mesh>
      {/* Pivot — large bright neon pink/yellow sphere */}
      <mesh>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color={selected ? "#ffff00" : "#ff0099"} />
      </mesh>
      {/* Outer glow ring around sphere */}
      <mesh>
        <torusGeometry args={[0.14, 0.02, 8, 32]} />
        <meshBasicMaterial
          color={selected ? "#ffff00" : "#ff00cc"}
          transparent
          opacity={0.7}
        />
      </mesh>
      {/* Height guide cylinder — bottom at y=0 */}
      <mesh position={[0, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.8, 12]} />
        <meshBasicMaterial color={c} transparent opacity={0.35} />
      </mesh>
      {/* Directional nose — blue cone pointing +Z, shows forward direction */}
      <mesh position={[0, 0.14, 0.22]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.06, 0.18, 8]} />
        <meshBasicMaterial color="#00aaff" />
      </mesh>
    </group>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function AnchorBuilder({
  biomeName = "BIOME",
  finalLandScale = 1,
  onScaleChange,
  currentScale = 1,
  setOrbitEnabled,
}: AnchorBuilderProps) {
  const [anchors, setAnchors] = useState<Anchor[]>(() =>
    loadAnchors(biomeName),
  );
  const [activeTier, setActiveTier] = useState<TierPrefix>("c");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [gizmoMode, setGizmoMode] = useState<"translate" | "rotate">(
    "translate",
  );
  const [cameraMode, setCameraMode] = useState<"perspective" | "ortho">(
    "perspective",
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [isHudOpen, setIsHudOpen] = useState(true);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  // Track position during TransformControls drag (avoid setState on every frame)
  const positionTrackRef = useRef<[number, number, number]>([0, 0, 0]);
  // Track previous biomeName to detect biome switches
  const prevBiomeRef = useRef(biomeName);

  // ── Reload anchors when biomeName changes (without remounting) ──────────────
  useEffect(() => {
    if (prevBiomeRef.current === biomeName) return;
    // Save current anchors for the old biome
    saveAnchors(prevBiomeRef.current, anchors);
    // Load anchors for the new biome
    setAnchors(loadAnchors(biomeName));
    setSelectedName(null);
    positionTrackRef.current = [0, 0, 0];
    prevBiomeRef.current = biomeName;
  }, [biomeName, anchors]);

  // Persist to localStorage whenever anchors change
  useEffect(() => {
    saveAnchors(biomeName, anchors);
  }, [anchors, biomeName]);

  // Mirror anchors state into a ref so scale effect can read it without a dep
  const anchorsRef = useRef(anchors);
  useEffect(() => {
    anchorsRef.current = anchors;
  }, [anchors]);

  // Reposition all anchor groups when finalLandScale changes.
  // Uses anchorsRef (stable ref) so this effect only fires on scale change.
  useEffect(() => {
    setSelectedName(null);
    for (const anchor of anchorsRef.current) {
      const g = groupRefs.current.get(anchor.name);
      if (g) {
        g.position.set(
          anchor.position[0] * finalLandScale,
          anchor.position[1] * finalLandScale,
          anchor.position[2] * finalLandScale,
        );
      }
    }
  }, [finalLandScale]);

  const selectedAnchor = anchors.find((a) => a.name === selectedName) ?? null;
  const totalUsed = anchors.length;
  const tierColor = (p: string) =>
    TIERS.find((t) => t.prefix === p)?.color ?? "#00ff88";

  // ── Actions ────────────────────────────────────────────────────────────────
  const addAnchor = useCallback(() => {
    const tierDef = TIERS.find((t) => t.prefix === activeTier);
    if (!tierDef) return;
    const tierAnchors = anchors.filter((a) => a.tier === activeTier);
    if (tierAnchors.length >= tierDef.max) return;
    const count = tierAnchors.length + 1;
    const name = `${activeTier}_${String(count).padStart(2, "0")}`;
    const newAnchor: Anchor = {
      name,
      tier: activeTier,
      position: [0, 0, 0],
      rotationY: 0,
    };
    setAnchors((prev) => [...prev, newAnchor]);
    setSelectedName(name);
  }, [anchors, activeTier]);

  const deleteAnchor = useCallback(
    (name: string) => {
      setAnchors((prev) => {
        const idx = prev.findIndex((a) => a.name === name);
        if (idx === -1) return prev;
        const tier = prev[idx].tier;
        const next = prev.filter((_, i) => i !== idx);
        let tc = 0;
        return next.map((a) => {
          if (a.tier === tier) {
            tc++;
            return { ...a, name: `${tier}_${String(tc).padStart(2, "0")}` };
          }
          return a;
        });
      });
      if (selectedName === name) setSelectedName(null);
    },
    [selectedName],
  );

  const clearAll = useCallback(() => {
    if (window.confirm(`Clear all anchors for ${biomeName}?`)) {
      setAnchors([]);
      setSelectedName(null);
    }
  }, [biomeName]);

  // Sync group transform → state on drag-end
  const syncTransform = useCallback(() => {
    if (!selectedName) return;
    const g = groupRefs.current.get(selectedName);
    if (!g) return;
    const scale = finalLandScale;
    setAnchors((prev) =>
      prev.map((a) =>
        a.name === selectedName
          ? {
              ...a,
              position: [
                Number.parseFloat((g.position.x / scale).toFixed(4)),
                Number.parseFloat((g.position.y / scale).toFixed(4)),
                Number.parseFloat((g.position.z / scale).toFixed(4)),
              ],
              rotationY: g.rotation.y,
            }
          : a,
      ),
    );
  }, [selectedName, finalLandScale]);

  const updateY = useCallback((name: string, y: number) => {
    setAnchors((prev) =>
      prev.map((a) =>
        a.name === name
          ? { ...a, position: [a.position[0], y, a.position[2]] }
          : a,
      ),
    );
    // Also update the live group
    const g = groupRefs.current.get(name);
    if (g) g.position.y = y;
  }, []);

  const rotateYaw = useCallback(
    (dir: 1 | -1) => {
      if (!selectedName) return;
      const step = Math.PI / 12;
      setAnchors((prev) =>
        prev.map((a) =>
          a.name === selectedName
            ? { ...a, rotationY: a.rotationY + dir * step }
            : a,
        ),
      );
      const g = groupRefs.current.get(selectedName);
      if (g) g.rotation.y += dir * step;
    },
    [selectedName],
  );

  const exportJson = useCallback(() => {
    const data = anchors.map((a) => ({
      id: a.name,
      tier: a.tier,
      position: a.position,
      rotation: [0, a.rotationY, 0] as [number, number, number],
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `anchors_${biomeName}.json`;
    el.click();
    URL.revokeObjectURL(url);
  }, [anchors, biomeName]);

  // ── Button style helper ────────────────────────────────────────────────────
  const btn = (key: string, danger = false): React.CSSProperties => ({
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    padding: "5px 8px",
    background:
      hovered === key
        ? danger
          ? "rgba(255,50,50,0.12)"
          : "rgba(0,243,255,0.08)"
        : "rgba(0,0,0,0.35)",
    border: `1px solid ${
      hovered === key
        ? danger
          ? "rgba(255,80,80,0.9)"
          : "rgba(0,243,255,0.8)"
        : danger
          ? "rgba(255,80,80,0.3)"
          : "rgba(0,243,255,0.28)"
    }`,
    borderRadius: 4,
    color:
      hovered === key
        ? danger
          ? "#ff6060"
          : "#00f3ff"
        : danger
          ? "rgba(255,100,100,0.65)"
          : "rgba(0,243,255,0.75)",
    cursor: "pointer",
    transition: "all 0.15s ease",
    width: "100%",
    textAlign: "left" as const,
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Camera */}
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

      {/* Anchor 3D objects */}
      {anchors.map((anchor) => {
        const isSelected = anchor.name === selectedName;
        const color = tierColor(anchor.tier);
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: R3F group
          <group
            key={anchor.name}
            ref={(g) => {
              if (g) groupRefs.current.set(anchor.name, g);
              else groupRefs.current.delete(anchor.name);
            }}
            position={[
              anchor.position[0] * finalLandScale,
              anchor.position[1] * finalLandScale,
              anchor.position[2] * finalLandScale,
            ]}
            rotation={[0, anchor.rotationY, 0]}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedName(isSelected ? null : anchor.name);
            }}
          >
            <AnchorChassis color={color} selected={isSelected} />
            <Text
              position={[0, 2.2, 0]}
              fontSize={0.1}
              color={isSelected ? "#ffff00" : color}
              anchorX="center"
              anchorY="middle"
              outlineColor="#000000"
              outlineWidth={0.008}
            >
              {anchor.name}
            </Text>
          </group>
        );
      })}

      {/* TransformControls on selected anchor */}
      {selectedName && groupRefs.current.has(selectedName) && (
        <TransformControls
          object={groupRefs.current.get(selectedName)!}
          mode={gizmoMode}
          space="local"
          showX={gizmoMode !== "rotate"}
          showZ={gizmoMode !== "rotate"}
          // @ts-ignore
          onChange={() => {
            const g = groupRefs.current.get(selectedName ?? "");
            if (g) {
              positionTrackRef.current = [
                g.position.x,
                g.position.y,
                g.position.z,
              ];
              // In rotate mode, lock X and Z axes
              if (gizmoMode === "rotate") {
                g.rotation.x = 0;
                g.rotation.z = 0;
              }
            }
          }}
          // @ts-ignore
          onDraggingChanged={(e: any) => {
            setOrbitEnabled?.(!e.value);
            if (!e.value) {
              // Drag ended — sync group transform to React state
              syncTransform();
            }
          }}
        />
      )}

      {/* ─── Glassmorphism HUD Sidebar ─── */}
      <Html fullscreen style={{ pointerEvents: "none" }}>
        {isHudOpen ? (
          <div
            style={{
              position: "absolute",
              right: 16,
              top: 16,
              bottom: 16,
              width: 262,
              background: "rgba(0,0,0,0.80)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(0,243,255,0.22)",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              fontFamily: "monospace",
              color: "#00f3ff",
              overflow: "hidden",
              pointerEvents: "auto",
              userSelect: "none",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "12px 14px 10px",
                borderBottom: "1px solid rgba(0,243,255,0.14)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: 2,
                      fontWeight: "bold",
                      marginBottom: 2,
                      textShadow: "0 0 8px rgba(0,243,255,0.6)",
                    }}
                  >
                    CYBERLAND ANCHOR GEN v2.0
                  </div>
                  <div style={{ fontSize: 9, color: "rgba(0,243,255,0.45)" }}>
                    {biomeName} · {totalUsed} / 49
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHudOpen(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(0,243,255,0.5)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "0 2px",
                    lineHeight: 1,
                    marginTop: 2,
                  }}
                  title="Collapse panel"
                >
                  ⇥
                </button>
              </div>
            </div>

            {/* Tier Selector */}
            <div
              style={{
                padding: "9px 14px",
                borderBottom: "1px solid rgba(0,243,255,0.1)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: 2,
                  color: "rgba(0,243,255,0.35)",
                  marginBottom: 6,
                }}
              >
                TIER
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {TIERS.map((t) => {
                  const used = anchors.filter(
                    (a) => a.tier === t.prefix,
                  ).length;
                  const isActive = activeTier === t.prefix;
                  const isFull = used >= t.max;
                  return (
                    <button
                      key={t.prefix}
                      type="button"
                      onClick={() => setActiveTier(t.prefix as TierPrefix)}
                      style={{
                        flex: 1,
                        fontFamily: "monospace",
                        fontSize: 8,
                        padding: "4px 2px",
                        background: isActive ? `${t.color}20` : "transparent",
                        border: `1px solid ${
                          isActive ? t.color : `${t.color}40`
                        }`,
                        borderRadius: 4,
                        color: isFull
                          ? `${t.color}40`
                          : isActive
                            ? t.color
                            : `${t.color}80`,
                        cursor: isFull ? "not-allowed" : "pointer",
                        boxShadow: isActive ? `0 0 6px ${t.color}55` : "none",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ fontSize: 9, fontWeight: "bold" }}>
                        {t.prefix.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 7 }}>
                        {used}/{t.max}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Global Actions */}
            <div
              style={{
                padding: "9px 14px",
                borderBottom: "1px solid rgba(0,243,255,0.1)",
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                gap: 5,
              }}
            >
              <button
                type="button"
                onClick={addAnchor}
                onMouseEnter={() => setHovered("add")}
                onMouseLeave={() => setHovered(null)}
                style={btn("add")}
              >
                + ADD NEW
              </button>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={() =>
                    setGizmoMode(
                      gizmoMode === "translate" ? "rotate" : "translate",
                    )
                  }
                  onMouseEnter={() => setHovered("gizmo")}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...btn("gizmo"),
                    flex: 1,
                    textAlign: "center" as const,
                  }}
                >
                  {gizmoMode === "translate" ? "⇄ MOVE" : "↻ ROTATE"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCameraMode(
                      cameraMode === "perspective" ? "ortho" : "perspective",
                    )
                  }
                  onMouseEnter={() => setHovered("cam")}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...btn("cam"),
                    flex: 1,
                    textAlign: "center" as const,
                  }}
                >
                  {cameraMode === "perspective" ? "📷 PERSP" : "📐 ORTHO"}
                </button>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={exportJson}
                  disabled={anchors.length === 0}
                  onMouseEnter={() => setHovered("export")}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...btn("export"),
                    flex: 1,
                    textAlign: "center" as const,
                    opacity: anchors.length === 0 ? 0.35 : 1,
                  }}
                >
                  ↓ EXPORT JSON
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  disabled={anchors.length === 0}
                  onMouseEnter={() => setHovered("clear")}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    ...btn("clear", true),
                    flex: 1,
                    textAlign: "center" as const,
                    opacity: anchors.length === 0 ? 0.35 : 1,
                  }}
                >
                  ✕ CLEAR ALL
                </button>
              </div>
            </div>

            {/* Selected Anchor Panel */}
            {selectedAnchor && (
              <div
                style={{
                  padding: "9px 14px",
                  borderBottom: "1px solid rgba(0,243,255,0.1)",
                  flexShrink: 0,
                  background: "rgba(255,255,0,0.03)",
                }}
              >
                <div
                  style={{
                    fontSize: 9,
                    color: "#ffff00",
                    letterSpacing: 1.5,
                    marginBottom: 6,
                    textShadow: "0 0 6px rgba(255,255,0,0.5)",
                  }}
                >
                  SELECTED: {selectedAnchor.name}
                </div>
                <div
                  style={{
                    fontSize: 8,
                    color: "rgba(255,255,255,0.35)",
                    marginBottom: 6,
                  }}
                >
                  X: {selectedAnchor.position[0].toFixed(3)} &nbsp; Z:
                  {selectedAnchor.position[2].toFixed(3)}
                </div>
                {/* Y manual input */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontSize: 8,
                      color: "rgba(0,243,255,0.45)",
                      letterSpacing: 1,
                      flexShrink: 0,
                    }}
                  >
                    Y =
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={selectedAnchor.position[1]}
                    onChange={(e) =>
                      updateY(
                        selectedAnchor.name,
                        Number.parseFloat(e.target.value) || 0,
                      )
                    }
                    style={{
                      flex: 1,
                      background: "rgba(0,0,0,0.5)",
                      border: "1px solid rgba(0,243,255,0.3)",
                      borderRadius: 3,
                      color: "#00f3ff",
                      fontFamily: "monospace",
                      fontSize: 10,
                      padding: "3px 6px",
                      outline: "none",
                    }}
                  />
                </div>
                {/* Yaw rotation buttons */}
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    type="button"
                    onClick={() => rotateYaw(-1)}
                    onMouseEnter={() => setHovered("rl")}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      ...btn("rl"),
                      flex: 1,
                      textAlign: "center" as const,
                      fontSize: 11,
                    }}
                  >
                    ← YAW
                  </button>
                  <button
                    type="button"
                    onClick={() => rotateYaw(1)}
                    onMouseEnter={() => setHovered("rr")}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      ...btn("rr"),
                      flex: 1,
                      textAlign: "center" as const,
                      fontSize: 11,
                    }}
                  >
                    YAW →
                  </button>
                </div>
              </div>
            )}

            {/* Scale panel */}
            {onScaleChange && (
              <div
                style={{
                  padding: "9px 14px",
                  borderBottom: "1px solid rgba(0,243,255,0.1)",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 8,
                    letterSpacing: 2,
                    color: "rgba(0,243,255,0.35)",
                    marginBottom: 6,
                  }}
                >
                  LAND SCALE
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {[1, 12].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onScaleChange(s)}
                      style={{
                        flex: 1,
                        fontFamily: "monospace",
                        fontSize: 9,
                        padding: "4px",
                        background:
                          currentScale === s
                            ? "rgba(0,243,255,0.12)"
                            : "transparent",
                        border: `1px solid ${
                          currentScale === s
                            ? "rgba(0,243,255,0.8)"
                            : "rgba(0,243,255,0.22)"
                        }`,
                        borderRadius: 4,
                        color:
                          currentScale === s
                            ? "#00f3ff"
                            : "rgba(0,243,255,0.35)",
                        cursor: "pointer",
                        boxShadow:
                          currentScale === s
                            ? "0 0 6px rgba(0,243,255,0.28)"
                            : "none",
                        transition: "all 0.15s",
                      }}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Anchor List */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "8px 14px",
                scrollbarWidth: "thin",
              }}
            >
              <div
                style={{
                  fontSize: 8,
                  letterSpacing: 2,
                  color: "rgba(0,243,255,0.35)",
                  marginBottom: 6,
                }}
              >
                ANCHORS ({totalUsed}/49)
              </div>
              {anchors.length === 0 && (
                <div
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.2)",
                    textAlign: "center",
                    marginTop: 20,
                    lineHeight: 1.8,
                  }}
                >
                  No anchors placed.
                  <br />
                  Press ADD NEW to start.
                </div>
              )}
              {anchors.map((anchor) => {
                const tc = tierColor(anchor.tier);
                const isSel = anchor.name === selectedName;
                return (
                  <button
                    key={anchor.name}
                    type="button"
                    onClick={() => setSelectedName(isSel ? null : anchor.name)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 6px",
                      marginBottom: 3,
                      borderRadius: 4,
                      background: isSel
                        ? "rgba(255,255,0,0.06)"
                        : "rgba(255,255,255,0.018)",
                      border: `1px solid ${
                        isSel
                          ? "rgba(255,255,0,0.25)"
                          : "rgba(255,255,255,0.05)"
                      }`,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 1,
                        background: tc,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 9,
                        color: isSel ? "#ffff00" : tc,
                      }}
                    >
                      {anchor.name}
                    </span>
                    <span
                      style={{
                        fontSize: 8,
                        color: "rgba(255,255,255,0.22)",
                        marginRight: 2,
                      }}
                    >
                      {anchor.position[0].toFixed(3)},
                      {anchor.position[1].toFixed(3)},
                      {anchor.position[2].toFixed(3)}
                    </span>
                    {/* Focus */}
                    <button
                      type="button"
                      title="Focus"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedName(anchor.name);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(0,243,255,0.45)",
                        cursor: "pointer",
                        fontSize: 11,
                        padding: "0 2px",
                      }}
                    >
                      ◎
                    </button>
                    {/* Delete */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteAnchor(anchor.name);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "rgba(255,80,80,0.65)",
                        cursor: "pointer",
                        fontSize: 13,
                        padding: "0 2px",
                      }}
                    >
                      ×
                    </button>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              right: 16,
              top: 16,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              pointerEvents: "auto",
            }}
          >
            <button
              type="button"
              onClick={() => setIsHudOpen(true)}
              style={{
                fontFamily: "monospace",
                fontSize: 9,
                padding: "6px 10px",
                background: "rgba(0,0,0,0.8)",
                color: "#00f3ff",
                border: "1px solid rgba(0,243,255,0.4)",
                borderRadius: 6,
                cursor: "pointer",
                backdropFilter: "blur(10px)",
                letterSpacing: 1,
              }}
            >
              ☰ PANEL
            </button>
          </div>
        )}
      </Html>
    </>
  );
}
