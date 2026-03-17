import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

const MAP_SIZE = 2560;
const VORTEX_CENTER: [number, number] = [1280, 1280];
const RAW_MAP_URL =
  "https://raw.githubusercontent.com/dobr312/cyberland/main/CyberMap/IMG_0133.webp";

// Max CSS z-index values for absolute priority
const Z_MAP = 2147483640;
const Z_BUTTON = 2147483647;

const MapView = ({ onClose }: { onClose: () => void }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const hasAnimatedRef = useRef(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const principalId = identity?.getPrincipal().toString();

  const { data: lands } = useQuery({
    queryKey: ["landData"],
    queryFn: () => actor?.getLandData(),
    enabled: !!actor,
  });

  // 1. Lock scroll + force black background + load Leaflet
  useEffect(() => {
    // Force body background to black — prevents purple gradient from bleeding through
    document.body.style.backgroundColor = "#000000";
    document.body.style.overflow = "hidden";

    if ((window as any).L) {
      setLeafletReady(true);
      return () => {
        document.body.style.backgroundColor = "";
        document.body.style.overflow = "unset";
      };
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
    return () => {
      document.body.style.backgroundColor = "";
      document.body.style.overflow = "unset";
    };
  }, []);

  // 2. Initialize map
  useEffect(() => {
    if (
      !leafletReady ||
      !mapContainerRef.current ||
      mapRef.current ||
      !(window as any).L
    )
      return;
    const L = (window as any).L;
    // Fix for React StrictMode double-mount: reset _leaflet_id before init
    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      (container as any)._leaflet_id = undefined;
    }
    const map = L.map(container, {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
      maxBoundsViscosity: 1.0,
    });
    const bounds: [number, number][] = [
      [0, 0],
      [MAP_SIZE, MAP_SIZE],
    ];
    L.imageOverlay(RAW_MAP_URL, bounds).addTo(map);
    map.setMaxBounds(bounds);
    const scale = Math.max(
      window.innerWidth / MAP_SIZE,
      window.innerHeight / MAP_SIZE,
    );
    map.setMinZoom(Math.log2(scale));
    map.fitBounds(bounds);
    mapRef.current = map;
    // invalidateSize ensures Leaflet fills the container correctly
    setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [leafletReady]);

  // 3. Draw beams when data ready
  // biome-ignore lint/correctness/useExhaustiveDependencies: leafletReady triggers beam draw after map init
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lands || !(window as any).L) return;
    const L = (window as any).L;
    let myFirst: [number, number] | null = null;
    for (const land of lands as any[]) {
      const coords = getPointInBiome(Number(land.id), land.biome);
      const isOwner = land.owner === principalId;
      if (isOwner && !myFirst) myFirst = coords as [number, number];
      const color = isOwner ? getBiomeColor(land.biome) : "#333";
      L.polyline([VORTEX_CENTER, coords], {
        color,
        weight: isOwner ? 2.5 : 0.6,
        opacity: isOwner ? 1 : 0.25,
        className: isOwner
          ? `beam-neon beam-${String(land.biome).toLowerCase()}`
          : "beam-other",
      }).addTo(map);
      if (isOwner) {
        L.circleMarker(coords, {
          radius: 2,
          fillColor: color,
          fillOpacity: 1,
          color: "#fff",
          weight: 1,
          className: "land-impact-point",
        }).addTo(map);
      }
    }
    if (myFirst && !hasAnimatedRef.current) {
      map.setView(myFirst, 1);
      hasAnimatedRef.current = true;
    }
  }, [lands, principalId, leafletReady]);

  const getBiomeColor = (biome: string) => {
    const colors: Record<string, string> = {
      MYTHIC_VOID: "#9933FF",
      MYTHIC_AETHER: "#0055FF",
      VOLCANIC_CRAG: "#ff3300",
      DESERT_DUNE: "#FFCC00",
      FOREST_VALLEY: "#00ff41",
      SNOW_PEAK: "#ffffff",
      ISLAND_ARCHIPELAGO: "#00ffff",
    };
    return colors[biome] || "#555";
  };

  const getPointInBiome = (landId: number, biome: string) => {
    const seed = landId * 1337.42;
    const rng = (offset: number) => Math.abs(Math.sin(seed + offset));
    const regions: any = {
      MYTHIC_VOID: { x: [1150, 1410], y: [1150, 1410] },
      MYTHIC_AETHER: { x: [1150, 1410], y: [1150, 1410] },
      VOLCANIC_CRAG: { x: [1800, 2300], y: [500, 1000] },
      DESERT_DUNE: { x: [1700, 2350], y: [1700, 2300] },
      FOREST_VALLEY: { x: [400, 900], y: [1200, 1700] },
      SNOW_PEAK: { x: [300, 1000], y: [400, 800] },
      ISLAND_ARCHIPELAGO: { x: [300, 1100], y: [1900, 2400] },
    };
    const z = regions[biome] || regions.MYTHIC_VOID;
    return [
      z.y[0] + rng(1) * (z.y[1] - z.y[0]),
      z.x[0] + rng(2) * (z.x[1] - z.x[0]),
    ];
  };

  // MAP PORTAL — full screen black container, completely isolated
  const mapPortal = ReactDOM.createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: Z_MAP,
        backgroundColor: "#000000",
        overflow: "hidden",
        touchAction: "none",
        isolation: "isolate",
      }}
    >
      {/* Loader: visible only while Leaflet CDN hasn't loaded yet */}
      {!leafletReady && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "#000000",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                color: "#00ff41",
                fontFamily: "monospace",
                fontSize: "12px",
                letterSpacing: "3px",
              }}
            >
              SCANNING SECTORS...
            </div>
            <div
              style={{
                width: "120px",
                height: "1px",
                background: "#00ff41",
                margin: "10px auto",
                animation: "mapSlide 2s infinite",
              }}
            />
          </div>
        </div>
      )}

      {/* Leaflet mount target */}
      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", backgroundColor: "#000000" }}
      />

      <style>{`
        .leaflet-container { background: #000000 !important; cursor: crosshair; }
        .beam-neon {
          stroke-dasharray: 12, 6;
          animation: beamFlow 0.8s linear infinite;
          filter: drop-shadow(0 0 4px currentColor);
        }
        @keyframes beamFlow {
          from { stroke-dashoffset: 36; }
          to { stroke-dashoffset: 0; }
        }
        .land-impact-point { filter: drop-shadow(0 0 8px #fff); }
        @keyframes mapSlide {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }
      `}</style>
    </div>,
    document.body,
  );

  // CLOSE BUTTON PORTAL — separate portal at absolute max z-index.
  // Completely independent from map container — always visible no matter what.
  const closeButtonPortal = ReactDOM.createPortal(
    <button
      type="button"
      onClick={onClose}
      style={{
        position: "fixed",
        top: "15px",
        right: "15px",
        zIndex: Z_BUTTON,
        padding: "6px 14px",
        fontSize: "10px",
        backgroundColor: "rgba(0,0,0,0.85)",
        color: "#00ff41",
        border: "1px solid #00ff41",
        borderRadius: "3px",
        cursor: "pointer",
        fontFamily: "monospace",
        letterSpacing: "1px",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      ✕ EXIT
    </button>,
    document.body,
  );

  return (
    <>
      {mapPortal}
      {closeButtonPortal}
    </>
  );
};

export default MapView;
