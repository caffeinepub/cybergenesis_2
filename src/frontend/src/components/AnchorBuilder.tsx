import { Html, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
import * as THREE from "three";

interface Anchor {
  name: string;
  position: [number, number, number];
}

interface AnchorBuilderProps {
  landRef: React.RefObject<THREE.Group | null>;
  finalLandScale?: number;
}

export default function AnchorBuilder({
  landRef,
  finalLandScale = 1,
}: AnchorBuilderProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const { gl, camera, raycaster } = useThree();
  const mouseRef = useRef(new THREE.Vector2());
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

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
        if (prev.length >= 49) return prev;
        const idx = prev.length + 1;
        const name = `c_${String(idx).padStart(2, "0")}`;
        const pos: [number, number, number] = [
          Number.parseFloat((pt.x / finalLandScale).toFixed(4)),
          Number.parseFloat((pt.y / finalLandScale).toFixed(4)),
          Number.parseFloat((pt.z / finalLandScale).toFixed(4)),
        ];
        return [...prev, { name, position: pos }];
      });
    };

    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("click", onClick);
    return () => {
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("click", onClick);
    };
  }, [gl, camera, raycaster, landRef, finalLandScale]);

  const deleteLast = useCallback(() => {
    setAnchors((prev) => prev.slice(0, -1));
  }, []);

  const exportJson = useCallback(() => {
    const data = anchors.map((a) => ({
      name: a.name,
      position: a.position,
      rotation: [0, 0, 0] as [number, number, number],
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "anchors.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [anchors]);

  return (
    <>
      {anchors.map((anchor) => (
        <group key={anchor.name} position={anchor.position}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.08, 32]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.9} />
          </mesh>
          <Text
            position={[0, 0.15, 0]}
            fontSize={0.08}
            color="#00ff88"
            anchorX="center"
            anchorY="middle"
            outlineColor="#000000"
            outlineWidth={0.005}
          >
            {anchor.name}
          </Text>
        </group>
      ))}
      <Html fullscreen>
        <div
          style={{
            position: "absolute",
            bottom: 80,
            left: 20,
            width: 200,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(0,255,136,0.4)",
            backdropFilter: "blur(10px)",
            borderRadius: 8,
            padding: "12px 16px",
            fontFamily: "monospace",
            color: "#00ff88",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: 2,
              marginBottom: 8,
              opacity: 0.7,
              borderBottom: "1px solid rgba(0,255,136,0.2)",
              paddingBottom: 6,
            }}
          >
            ⬡ ANCHOR BUILDER
          </div>
          <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 10 }}>
            PLACED: {anchors.length} / 49
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              type="button"
              onClick={deleteLast}
              disabled={anchors.length === 0}
              onMouseEnter={() => setHoveredBtn("delete")}
              onMouseLeave={() => setHoveredBtn(null)}
              style={{
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: 1,
                padding: "5px 8px",
                background:
                  hoveredBtn === "delete" ? "rgba(255,0,0,0.1)" : "transparent",
                border: `1px solid ${hoveredBtn === "delete" ? "rgba(255,0,0,0.8)" : "rgba(255,100,100,0.5)"}`,
                borderRadius: 4,
                color:
                  hoveredBtn === "delete"
                    ? "rgba(255,80,80,1)"
                    : "rgba(255,100,100,0.8)",
                cursor: anchors.length === 0 ? "not-allowed" : "pointer",
                opacity: anchors.length === 0 ? 0.4 : 1,
                transition: "all 0.15s ease",
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
                fontFamily: "monospace",
                fontSize: 10,
                letterSpacing: 1,
                padding: "5px 8px",
                background:
                  hoveredBtn === "export"
                    ? "rgba(0,255,136,0.1)"
                    : "transparent",
                border: `1px solid ${hoveredBtn === "export" ? "rgba(0,255,136,0.9)" : "rgba(0,255,136,0.5)"}`,
                borderRadius: 4,
                color: "#00ff88",
                cursor: anchors.length === 0 ? "not-allowed" : "pointer",
                opacity: anchors.length === 0 ? 0.4 : 1,
                transition: "all 0.15s ease",
              }}
            >
              EXPORT JSON
            </button>
          </div>
        </div>
      </Html>
    </>
  );
}
