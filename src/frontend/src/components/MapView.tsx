import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LandData } from "../backend";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

declare global {
  interface Window {
    L: any;
  }
}

const MAP_SIZE = 2560;
const VORTEX_CENTER: [number, number] = [1280, 1280];
const RAW_MAP_URL =
  "https://raw.githubusercontent.com/dobr312/cyberland/main/CyberMap/IMG_0133.webp";

const getBiomeColor = (biome: string) => {
  const colors: Record<string, string> = {
    MYTHIC_VOID: "#9933FF",
    MYTHIC_AETHER: "#9933FF",
    VOLCANIC_CRAG: "#ff3300",
    DESERT_DUNE: "#FF8800",
    FOREST_VALLEY: "#00ff41",
    SNOW_PEAK: "#ffffff",
  };
  return colors[biome] || "#00aaff";
};

const MapView = ({
  onClose,
  landData: _landData,
}: { onClose: () => void; landData?: LandData | null }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const principalId = identity?.getPrincipal().toString();

  const { data: lands } = useQuery({
    queryKey: ["landData"],
    queryFn: () => actor?.getLandData(),
    enabled: !!actor,
  });

  // 1. ENGINE LOADER & MOBILE SCROLL LOCK
  useEffect(() => {
    document.body.style.overflow = "hidden";

    if (window.L) {
      setIsEngineReady(true);
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      document.head.appendChild(script);
      script.onload = () => setIsEngineReady(true);
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  // 2. DETERMINISTIC COORDINATE GENERATOR
  const getPointInBiome = useCallback((landId: number, biome: string) => {
    const seed = landId * 1337.42;
    const pseudoRandom = (offset: number) => Math.abs(Math.sin(seed + offset));

    const regions: Record<
      string,
      { x: [number, number]; y: [number, number] }
    > = {
      MYTHIC_VOID: { x: [1050, 1510], y: [1050, 1510] },
      MYTHIC_AETHER: { x: [1050, 1510], y: [1050, 1510] },
      VOLCANIC_CRAG: { x: [1800, 2400], y: [400, 1100] },
      DESERT_DUNE: { x: [1600, 2450], y: [1600, 2400] },
      FOREST_VALLEY: { x: [400, 1000], y: [1200, 1800] },
      SNOW_PEAK: { x: [200, 1100], y: [300, 900] },
      ISLAND_ARCHIPELAGO: { x: [300, 1200], y: [1900, 2450] },
    };

    const zone = regions[biome] || regions.MYTHIC_VOID;
    const x = zone.x[0] + pseudoRandom(1) * (zone.x[1] - zone.x[0]);
    const y = zone.y[0] + pseudoRandom(2) * (zone.y[1] - zone.y[0]);

    return [y, x];
  }, []);

  // 3. MAP INITIALIZATION — runs only once when Leaflet is ready
  // Intentionally does NOT depend on `lands` to avoid re-init on data arrival
  useEffect(() => {
    if (
      !isEngineReady ||
      !mapContainerRef.current ||
      mapRef.current ||
      !window.L
    )
      return;

    const L = window.L;
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
    });
    mapRef.current = map;

    const bounds: [number, number][] = [
      [0, 0],
      [MAP_SIZE, MAP_SIZE],
    ];
    L.imageOverlay(RAW_MAP_URL, bounds).addTo(map);
    map.setMaxBounds(bounds);
    map.fitBounds(bounds);

    setTimeout(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    }, 300);

    // Map is ready — hide loading overlay immediately
    setIsDataLoaded(true);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEngineReady]);

  // 4. MARKER LAYER — adds beams when lands data arrives (separate from map init)
  useEffect(() => {
    if (!mapRef.current || !window.L || !lands) return;

    const L = window.L;
    const map = mapRef.current;
    let myFirstLandCoords: number[] | null = null;

    for (const land of lands) {
      const coords = getPointInBiome(Number(land.landId), land.biome);
      const isOwner = land.principal?.toString() === principalId;

      if (isOwner && !myFirstLandCoords) myFirstLandCoords = coords;

      const color = isOwner ? getBiomeColor(land.biome) : "#ffffff";
      const weight = isOwner ? 3 : 0.4;
      const opacity = isOwner ? 0.9 : 0.25;

      L.polyline([VORTEX_CENTER, coords], {
        color,
        weight,
        opacity,
        className: isOwner
          ? `beam-owned-${land.biome.toLowerCase()}`
          : "beam-other",
      }).addTo(map);
    }

    if (myFirstLandCoords) {
      map.flyTo(myFirstLandCoords, 2, { duration: 2 });
    }
  }, [lands, principalId, getPointInBiome]);

  // Render via Portal to document.body — guaranteed above ALL parent stacking contexts
  return createPortal(
    <div style={containerStyle}>
      {(!isEngineReady || !isDataLoaded) && (
        <div style={loadingOverlayStyle}>
          <div className="cyber-loader">
            <div className="loader-text">INITIALIZING CYBERMAP...</div>
            <div className="loader-bar" />
          </div>
        </div>
      )}

      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "100%", background: "#000" }}
      />

      <button type="button" onClick={onClose} style={closeButtonStyle}>
        ✕ EXIT TERMINAL
      </button>

      <style>{`
        .leaflet-container { background: #000 !important; cursor: crosshair; outline: none; }
        .beam-other { filter: none; pointer-events: none; stroke-dasharray: 2, 4; }
        ${[
          "MYTHIC_VOID",
          "MYTHIC_AETHER",
          "VOLCANIC_CRAG",
          "DESERT_DUNE",
          "FOREST_VALLEY",
          "SNOW_PEAK",
        ]
          .map(
            (b) =>
              `.beam-owned-${b.toLowerCase()} { filter: drop-shadow(0 0 10px ${getBiomeColor(b)}); z-index: 1000 !important; }`,
          )
          .join("")}
        .cyber-loader { text-align: center; }
        .loader-text { color: #00ff41; font-family: monospace; font-size: 20px; letter-spacing: 4px; animation: blink 1s infinite; }
        .loader-bar { width: 250px; height: 2px; background: #00ff41; box-shadow: 0 0 15px #00ff41; margin: 10px auto; animation: slide 2s infinite; }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes slide { 0% { transform: scaleX(0); } 50% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
      `}</style>
    </div>,
    document.body,
  );
};

const containerStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  zIndex: 99999,
  background: "#000",
  overflow: "hidden",
  touchAction: "none",
};

const loadingOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 100005,
  background: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
};

const closeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "30px",
  right: "30px",
  zIndex: 100001,
  padding: "12px 24px",
  background: "rgba(0,255,65,0.1)",
  color: "#00ff41",
  border: "1px solid #00ff41",
  borderRadius: "4px",
  cursor: "pointer",
  fontFamily: "monospace",
  textShadow: "0 0 5px #00ff41",
  backdropFilter: "blur(10px)",
};

export default MapView;
