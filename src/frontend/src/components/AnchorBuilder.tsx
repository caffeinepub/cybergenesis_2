import { Html, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import * as THREE from "three";

const TIERS = [
  { prefix: "c", max: 15, label: "C — COMMON", color: "#9CA3AF" },
  { prefix: "r", max: 15, label: "R — RARE", color: "#60A5FA" },
  { prefix: "l", max: 12, label: "L — LEGENDARY", color: "#A855F7" },
  { prefix: "m", max: 6, label: "M — MYTHIC", color: "#FACC15" },
  { prefix: "k", max: 1, label: "K — KING", color: "#FF6B35" },
] as const;

type TierPrefix = (typeof TIERS)[number]["prefix"];

function tierColor(prefix: string): string {
  return TIERS.find((t) => t.prefix === prefix)?.color ?? "#00ff88";
}

interface Anchor {
  name: string;
  position: [number, number, number];
  yaw: number;
  tier: TierPrefix;
}

interface AnchorBuilderProps {
  landRef: React.RefObject<THREE.Group | null>;
  finalLandScale?: number;
  onScaleChange?: (scale: number) => void;
  currentScale?: number;
  biomeName?: string;
}

const RAD_TO_DEG = 180 / Math.PI;
const YAW_STEP = Math.PI / 12;

const panelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: 80,
  left: 20,
  width: 228,
  background: "rgba(0,0,0,0.82)",
  border: "1px solid rgba(0,255,136,0.4)",
  backdropFilter: "blur(12px)",
  borderRadius: 8,
  padding: "12px 14px",
  fontFamily: "monospace",
  color: "#00ff88",
  pointerEvents: "auto",
  userSelect: "none",
};

export default function AnchorBuilder({
  landRef,
  finalLandScale = 1,
  onScaleChange,
  currentScale = 1,
  biomeName = "BIOME",
}: AnchorBuilderProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [activeTier, setActiveTier] = useState<TierPrefix>("c");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const { gl, camera, raycaster } = useThree();
  const mouseRef = useRef(new THREE.Vector2());

  useEffect(() => {
    const canvas = gl.domElement;
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onClick = () => {
      if (!landRef.current) return;
      raycaster.setFromCamera(mouseRef.current, camera);
      const hits = raycaster.intersectObject(landRef.current, true);
      if (hits.length === 0) return;
      const pt = hits[0].point;
      setAnchors((prev) => {
        const tierDef = TIERS.find((t) => t.prefix === activeTier);
        if (!tierDef) return prev;
        const tierAnchors = prev.filter((a) => a.tier === activeTier);
        if (tierAnchors.length >= tierDef.max) return prev;
        const count = tierAnchors.length + 1;
        const name = `${activeTier}_${String(count).padStart(2, "0")}`;
        const pos: [number, number, number] = [
          Number.parseFloat((pt.x / finalLandScale).toFixed(4)),
          Number.parseFloat((pt.y / finalLandScale).toFixed(4)),
          Number.parseFloat((pt.z / finalLandScale).toFixed(4)),
        ];
        return [...prev, { name, position: pos, yaw: 0, tier: activeTier }];
      });
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [gl, camera, raycaster, landRef, finalLandScale, activeTier]);

  const deleteLast = useCallback(() => {
    setAnchors((prev) => {
      const next = prev.slice(0, -1);
      setSelectedIdx((s) => (s !== null && s >= next.length ? null : s));
      return next;
    });
  }, []);

  const deleteByIdx = useCallback((idx: number) => {
    setAnchors((prev) => {
      const removed = prev[idx];
      const removedTier = removed.tier;
      // rebuild: keep order, renumber within tier
      const next = prev.filter((_, i) => i !== idx);
      let tierCount = 0;
      return next.map((a) => {
        if (a.tier === removedTier) {
          tierCount++;
          return {
            ...a,
            name: `${removedTier}_${String(tierCount).padStart(2, "0")}`,
          };
        }
        return a;
      });
    });
    setSelectedIdx((s) => {
      if (s === null) return null;
      if (s === idx) return null;
      if (s > idx) return s - 1;
      return s;
    });
  }, []);

  const rotateYaw = useCallback(
    (dir: 1 | -1) => {
      setAnchors((prev) =>
        prev.map((a, i) =>
          i === selectedIdx ? { ...a, yaw: a.yaw + dir * YAW_STEP } : a,
        ),
      );
    },
    [selectedIdx],
  );

  const exportJson = useCallback(() => {
    const data = anchors.map((a) => ({
      name: a.name,
      tier: a.tier,
      position: a.position,
      rotation: [0, a.yaw, 0] as [number, number, number],
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

  const mkBtn = (key: string, danger = false): React.CSSProperties => ({
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    padding: "4px 8px",
    background:
      hoveredBtn === key
        ? danger
          ? "rgba(255,0,0,0.12)"
          : "rgba(0,255,136,0.1)"
        : "transparent",
    border: `1px solid ${hoveredBtn === key ? (danger ? "rgba(255,60,60,0.9)" : "rgba(0,255,136,0.9)") : danger ? "rgba(255,100,100,0.45)" : "rgba(0,255,136,0.4)"}`,
    borderRadius: 4,
    color: danger
      ? hoveredBtn === key
        ? "#ff6060"
        : "rgba(255,100,100,0.8)"
      : "#00ff88",
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  const selectedAnchor = selectedIdx !== null ? anchors[selectedIdx] : null;
  const yawDeg = selectedAnchor
    ? Math.round(selectedAnchor.yaw * RAD_TO_DEG)
    : 0;

  return (
    <>
      {anchors.map((anchor, i) => {
        const isSelected = selectedIdx === i;
        const col = isSelected ? "#ffff00" : tierColor(anchor.tier);
        return (
          // biome-ignore lint/a11y/useKeyWithClickEvents: R3F group has no DOM keyboard events
          <group
            key={anchor.name}
            position={anchor.position}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedIdx(i === selectedIdx ? null : i);
            }}
          >
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.025, 24]} />
              <meshBasicMaterial color={col} transparent opacity={0.95} />
            </mesh>
            <mesh
              position={[
                Math.sin(anchor.yaw) * 0.06,
                0.005,
                Math.cos(anchor.yaw) * 0.06,
              ]}
              rotation={[0, -anchor.yaw, 0]}
            >
              <boxGeometry args={[0.008, 0.008, 0.1]} />
              <meshBasicMaterial color={col} />
            </mesh>
            <Text
              position={[0, 0.08, 0]}
              fontSize={0.04}
              color={col}
              anchorX="center"
              anchorY="middle"
              outlineColor="#000000"
              outlineWidth={0.004}
            >
              {anchor.name}
            </Text>
          </group>
        );
      })}

      <Html fullscreen>
        <div style={panelStyle}>
          {/* Header */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: 2,
              marginBottom: 8,
              opacity: 0.6,
              borderBottom: "1px solid rgba(0,255,136,0.18)",
              paddingBottom: 6,
            }}
          >
            ⬡ ANCHOR BUILDER
          </div>

          {/* Tier selector */}
          <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
            {TIERS.map((t) => {
              const used = anchors.filter((a) => a.tier === t.prefix).length;
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
                    background: isActive ? `${t.color}22` : "transparent",
                    border: `1px solid ${isActive ? t.color : `${t.color}44`}`,
                    borderRadius: 4,
                    color: isFull
                      ? `${t.color}55`
                      : isActive
                        ? t.color
                        : `${t.color}99`,
                    cursor: isFull ? "not-allowed" : "pointer",
                    boxShadow: isActive ? `0 0 6px ${t.color}55` : "none",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  <span style={{ fontSize: 9, fontWeight: "bold" }}>
                    {t.prefix.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 7, opacity: 0.8 }}>
                    {used}/{t.max}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active tier label */}
          <div
            style={{
              fontSize: 9,
              color: tierColor(activeTier),
              letterSpacing: 1,
              marginBottom: 8,
              opacity: 0.8,
            }}
          >
            {TIERS.find((t) => t.prefix === activeTier)?.label}
          </div>

          {/* Total counter */}
          <div
            style={{
              fontSize: 11,
              fontWeight: "bold",
              marginBottom: 8,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            TOTAL: {anchors.length} / 49
          </div>

          {/* Yaw controls */}
          {selectedAnchor && (
            <div
              style={{
                marginBottom: 10,
                padding: "8px",
                background: "rgba(255,255,0,0.06)",
                border: "1px solid rgba(255,255,0,0.25)",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: "#ffff00",
                  letterSpacing: 1.5,
                  marginBottom: 6,
                  opacity: 0.8,
                }}
              >
                SELECTED: {selectedAnchor.name}
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.4)",
                  marginBottom: 6,
                }}
              >
                YAW: {yawDeg}°
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => rotateYaw(-1)}
                  onMouseEnter={() => setHoveredBtn("yaw_l")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{ ...mkBtn("yaw_l"), flex: 1, fontSize: 11 }}
                >
                  ← ROT
                </button>
                <button
                  type="button"
                  onClick={() => rotateYaw(1)}
                  onMouseEnter={() => setHoveredBtn("yaw_r")}
                  onMouseLeave={() => setHoveredBtn(null)}
                  style={{ ...mkBtn("yaw_r"), flex: 1, fontSize: 11 }}
                >
                  ROT →
                </button>
              </div>
            </div>
          )}

          {/* Anchor list */}
          {anchors.length > 0 && (
            <div
              style={{
                maxHeight: 120,
                overflowY: "auto",
                marginBottom: 8,
                scrollbarWidth: "thin",
              }}
            >
              {anchors.map((a, i) => {
                const tc = tierColor(a.tier);
                return (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => setSelectedIdx(i === selectedIdx ? null : i)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      padding: "2px 4px",
                      marginBottom: 2,
                      borderRadius: 3,
                      cursor: "pointer",
                      background:
                        selectedIdx === i
                          ? "rgba(255,255,0,0.08)"
                          : "transparent",
                      border: `1px solid ${selectedIdx === i ? "rgba(255,255,0,0.3)" : "transparent"}`,
                      fontFamily: "monospace",
                      fontSize: 9,
                    }}
                  >
                    <span
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          width: 6,
                          height: 6,
                          borderRadius: 1,
                          background: tc,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{ color: selectedIdx === i ? "#ffff00" : tc }}
                      >
                        {a.name}
                      </span>
                      <span
                        style={{ color: "rgba(255,255,255,0.25)", fontSize: 8 }}
                      >
                        {Math.round(a.yaw * RAD_TO_DEG)}°
                      </span>
                    </span>
                    <span
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        deleteByIdx(i);
                      }}
                      style={{
                        color: "rgba(255,80,80,0.7)",
                        fontSize: 12,
                        padding: "0 2px",
                        cursor: "pointer",
                      }}
                    >
                      ×
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <button
              type="button"
              onClick={deleteLast}
              disabled={anchors.length === 0}
              onMouseEnter={() => setHoveredBtn("del_last")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...mkBtn("del_last", true),
                opacity: anchors.length === 0 ? 0.35 : 1,
              }}
            >
              DELETE LAST
            </button>
            <button
              type="button"
              onClick={exportJson}
              disabled={anchors.length === 0}
              onMouseEnter={() => setHoveredBtn("export")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                ...mkBtn("export"),
                opacity: anchors.length === 0 ? 0.35 : 1,
              }}
            >
              EXPORT JSON
            </button>
          </div>

          {/* Scale panel */}
          {onScaleChange && (
            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px solid rgba(0,255,136,0.18)",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
                  marginBottom: 6,
                  opacity: 0.6,
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
                    onMouseEnter={() => setHoveredBtn(`scale_${s}`)}
                    onMouseLeave={() => setHoveredBtn(null)}
                    style={{
                      flex: 1,
                      fontFamily: "monospace",
                      fontSize: 9,
                      padding: "4px 4px",
                      background:
                        currentScale === s
                          ? "rgba(0,255,136,0.15)"
                          : "transparent",
                      border: `1px solid ${currentScale === s ? "rgba(0,255,136,0.9)" : "rgba(0,255,136,0.3)"}`,
                      borderRadius: 4,
                      color:
                        currentScale === s ? "#00ff88" : "rgba(0,255,136,0.5)",
                      cursor: "pointer",
                      boxShadow:
                        currentScale === s
                          ? "0 0 6px rgba(0,255,136,0.4)"
                          : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {s}×{s}×{s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Html>
    </>
  );
}
