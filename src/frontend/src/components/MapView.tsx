import { useQuery } from "@tanstack/react-query";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { useGetLandData } from "../hooks/useQueries";

const MAP_SIZE = 6000;

const BIOME_COLORS: Record<string, string> = {
  MYTHIC_VOID: "#cc00ff",
  MYTHIC_AETHER: "#0088ff",
  VOLCANIC_CRAG: "#ff2200",
  DESERT_DUNE: "#ffaa00",
  FOREST_VALLEY: "#00ff44",
  SNOW_PEAK: "#88ddff",
  ISLAND_ARCHIPELAGO: "#00ffcc",
};

const BIOME_REGIONS: Record<
  string,
  { x: [number, number]; y: [number, number] }
> = {
  MYTHIC_VOID: { x: [2350, 3650], y: [2350, 3650] },
  MYTHIC_AETHER: { x: [2350, 3650], y: [2350, 3650] },
  SNOW_PEAK: { x: [650, 1950], y: [650, 1950] },
  VOLCANIC_CRAG: { x: [3850, 5150], y: [650, 1950] },
  FOREST_VALLEY: { x: [550, 1850], y: [3850, 5150] },
  DESERT_DUNE: { x: [4050, 5350], y: [3850, 5150] },
  ISLAND_ARCHIPELAGO: { x: [2050, 3750], y: [4550, 5850] },
};

function getBiomeKey(biome: any): string {
  if (typeof biome === "string") return biome;
  if (typeof biome === "object" && biome !== null)
    return Object.keys(biome)[0] ?? "MYTHIC_VOID";
  return "MYTHIC_VOID";
}

function getPointInBiome(landId: number, biome: any): [number, number] {
  const seed = landId * 1337.42;
  const r = (offset: number) => Math.abs(Math.sin(seed + offset));
  const key = getBiomeKey(biome);
  const zone = BIOME_REGIONS[key] ?? BIOME_REGIONS.MYTHIC_VOID;
  return [
    zone.y[0] + r(1) * (zone.y[1] - zone.y[0]),
    zone.x[0] + r(2) * (zone.x[1] - zone.x[0]),
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function makeBeamIcon(L: any, color: string, isOwner: boolean) {
  const h = isOwner ? 140 : 90;
  const coreW = isOwner ? 2 : 1;
  const glowW = isOwner ? 14 : 5;
  const blurPx = isOwner ? 2 : 0;

  const effectiveColor = isOwner ? color : "#FAD26A";
  const [r, g, b] = hexToRgb(effectiveColor);

  const coreShadow = isOwner
    ? `0 0 3px 1px rgba(${r},${g},${b},1), 0 0 6px 2px rgba(${r},${g},${b},0.6)`
    : "none";

  const html = `
    <div style="position:relative;width:${glowW}px;height:${h}px;cursor:pointer;pointer-events:auto;">
      ${
        isOwner
          ? `<div style="
        position:absolute;
        left:50%;
        transform:translateX(-50%);
        width:${glowW}px;
        height:${h}px;
        background:linear-gradient(to bottom,rgba(${r},${g},${b},0.5) 0%,rgba(${r},${g},${b},0.2) 55%,transparent 100%);
        border-radius:${glowW / 2}px ${glowW / 2}px 2px 2px;
        filter:blur(${blurPx}px);
        pointer-events:none;
      "></div>`
          : ""
      }
      <div style="
        position:absolute;
        left:50%;
        transform:translateX(-50%);
        width:${coreW}px;
        height:${h}px;
        background:linear-gradient(to bottom,rgba(${r},${g},${b},0.5) 0%,rgba(${r},${g},${b},0.9) 100%);
        border-radius:${coreW / 2}px;
        box-shadow:${coreShadow};
        pointer-events:none;
      "></div>
    </div>`;

  return L.divIcon({
    html,
    className: "",
    iconSize: [glowW, h],
    iconAnchor: [glowW / 2, h],
  });
}

const MapView = ({ onClose }: { onClose: () => void }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const beamLayerRef = useRef<any>(null);
  const hasZoomedRef = useRef(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isZoomReady, setIsZoomReady] = useState(false);
  const [popup, setPopup] = useState<{
    landId: number;
    biome: string;
    principal: string;
    modCount: number;
    latlng: any;
    isOwner: boolean;
  } | null>(null);
  const [popupPx, setPopupPx] = useState<{ x: number; y: number } | null>(null);

  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const principalId = identity?.getPrincipal().toString() ?? null;

  const { data: myLands } = useGetLandData();

  const { data: allLandsPublic } = useQuery({
    queryKey: ["allLandsPublic"],
    queryFn: () => (actor as any)?.getAllLandsPublic(),
    enabled: !!actor,
  });

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !popup) return;
    const recalc = () => {
      const pt = map.latLngToContainerPoint(popup.latlng);
      setPopupPx({ x: pt.x, y: pt.y });
    };
    recalc();
    map.on("move", recalc);
    map.on("zoom", recalc);
    return () => {
      map.off("move", recalc);
      map.off("zoom", recalc);
    };
  }, [popup]);

  // Failsafe: mark zoom ready after 6s
  useEffect(() => {
    const t = setTimeout(() => setIsZoomReady(true), 6000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    if ((window as any).L) {
      setIsEngineReady(true);
    } else {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => setIsEngineReady(true);
      document.head.appendChild(script);
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, []);

  useEffect(() => {
    if (!isEngineReady || !mapContainerRef.current || mapRef.current) return;
    const L = (window as any).L;
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 1.0,
      zoomControl: false,
      attributionControl: false,
      maxBoundsViscosity: 1.0,
      inertia: true,
      inertiaDeceleration: 500,
      inertiaMaxSpeed: 800,
      easeLinearity: 0.15,
      zoomAnimation: true,
      zoomAnimationThreshold: 4,
      wheelPxPerZoomLevel: 60,
      scrollWheelZoom: false,
      fadeAnimation: false,
    });

    const bounds: [[number, number], [number, number]] = [
      [0, 0],
      [MAP_SIZE, MAP_SIZE],
    ];

    // Layer 1: background (cosmos) — no load event needed
    L.imageOverlay(
      "/assets/uploads/map_background.webp",
      [
        [0, 0],
        [6000, 6000],
      ],
      { opacity: 1 },
    ).addTo(map);

    // Layers 2–6: region PNGs with transparency
    const regionLayers = [
      {
        path: "/assets/uploads/map_mythic.webp",
        bounds: [
          [2300, 2300],
          [3700, 3700],
        ],
      },
      {
        path: "/assets/uploads/map_snow_peak.webp",
        bounds: [
          [600, 600],
          [2000, 2000],
        ],
      },
      {
        path: "/assets/uploads/map_volcanic_crag.webp",
        bounds: [
          [600, 3800],
          [2000, 5200],
        ],
      },
      {
        path: "/assets/uploads/map_forest_valley.webp",
        bounds: [
          [3800, 500],
          [5200, 1900],
        ],
      },
      {
        path: "/assets/uploads/map_desert_dune.webp",
        bounds: [
          [3800, 4000],
          [5200, 5400],
        ],
      },
      {
        path: "/assets/uploads/map_island_archipelago.webp",
        bounds: [
          [4500, 2000],
          [5900, 3800],
        ],
      },
    ];

    regionLayers.forEach((layer, idx) => {
      const overlay = L.imageOverlay(layer.path, layer.bounds, { opacity: 1 });
      if (idx === regionLayers.length - 1) {
        overlay.on("load", () => setIsImageLoaded(true));
        overlay.on("error", () => setIsImageLoaded(true));
      }
      overlay.addTo(map);
    });

    map.setMaxBounds(bounds);
    // Change 3: start closer (was -1.3)
    map.setView([3000, 3000], -0.7, { animate: false });
    mapRef.current = map;
    beamLayerRef.current = L.layerGroup().addTo(map);

    const updateMinZoom = () => {
      const scale = Math.max(
        window.innerWidth / MAP_SIZE,
        window.innerHeight / MAP_SIZE,
      );
      map.setMinZoom(Math.log2(scale));
    };
    updateMinZoom();
    window.addEventListener("resize", updateMinZoom);

    const perfStyle = document.createElement("style");
    perfStyle.textContent = `
      .leaflet-pane { will-change: transform; }
      .leaflet-zoom-animated { will-change: transform; }
    `;
    document.head.appendChild(perfStyle);

    let zoomTarget = map.getZoom();
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    // Change 2: smoother wheel zoom, especially near min zoom
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const minZ = map.getMinZoom();
      const maxZ = map.getMaxZoom();
      const nearMin = zoomTarget - minZ < 0.4;
      const rawDelta = e.deltaY < 0 ? 0.35 : -0.35;
      const delta = nearMin && rawDelta < 0 ? rawDelta * 0.5 : rawDelta;
      zoomTarget = Math.max(minZ, Math.min(maxZ, zoomTarget + delta));
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        const containerPoint = L.point(e.clientX, e.clientY);
        const latlng = map.containerPointToLatLng(containerPoint);
        map.setZoomAround(latlng, zoomTarget, {
          animate: true,
          duration: 0.4,
        });
      }, 60);
    };
    mapContainerRef.current?.addEventListener("wheel", onWheel, {
      passive: false,
    });

    // Close popup on map click (not on marker)
    map.on("click", () => {
      setPopup(null);
      setPopupPx(null);
    });

    setIsMapReady(true);
    return () => {
      window.removeEventListener("resize", updateMinZoom);
      mapContainerRef.current?.removeEventListener("wheel", onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        beamLayerRef.current = null;
      }
    };
  }, [isEngineReady]);

  const handleBeamClick = async (
    e: any,
    landId: number,
    biome: string,
    principal: string,
    isOwner: boolean,
  ) => {
    e.originalEvent?.stopPropagation();
    const map = mapRef.current;
    if (!map) return;
    const latlng = e.latlng;
    let modCount = 0;
    let resolvedPrincipal = principal;
    let resolvedBiome = biome;
    try {
      const result = await (actor as any)?.getLandDataById(BigInt(landId));
      if (result && result.length > 0) {
        modCount = result[0].attachedModifications?.length ?? 0;
        resolvedPrincipal = result[0].owner?.toString() ?? principal;
        resolvedBiome = result[0].biome ?? biome;
      }
    } catch (_) {}
    setPopup({
      landId,
      biome: resolvedBiome,
      principal: resolvedPrincipal,
      modCount,
      latlng,
      isOwner,
    });
  };

  useEffect(() => {
    const map = mapRef.current;
    const beamLayer = beamLayerRef.current;
    if (!isMapReady || !map || !beamLayer || !(window as any).L) return;
    if (!myLands && !allLandsPublic) return;
    const L = (window as any).L;
    beamLayer.clearLayers();

    const renderedLandIds = new Set<number>();
    let myCoords: [number, number] | null = null;

    // 1. All public lands
    if (Array.isArray(allLandsPublic)) {
      try {
        for (const land of allLandsPublic as any[]) {
          const id = Number(land.landId);
          const coords = getPointInBiome(id, land.biome);
          const isOwner =
            principalId != null && land.principal?.toString() === principalId;
          if (isOwner && !myCoords) myCoords = coords;
          renderedLandIds.add(id);
          // Change 1: use getBiomeKey to normalize biome from Motoko object/string
          const color = BIOME_COLORS[getBiomeKey(land.biome)] ?? "#8800ff";
          const marker = L.marker(coords, {
            icon: makeBeamIcon(L, color, isOwner),
          });
          marker.on("click", (e: any) =>
            handleBeamClick(
              e,
              id,
              getBiomeKey(land.biome),
              land.principal?.toString() ?? "",
              isOwner,
            ),
          );
          marker.addTo(beamLayer);
        }
      } catch (e) {
        console.warn("[MapView] allLandsPublic beam render error:", e);
      }
    }

    // 2. Owner beam fallback from myLands
    if (Array.isArray(myLands)) {
      try {
        for (const land of myLands as any[]) {
          const id = Number(land.landId);
          if (!renderedLandIds.has(id)) {
            const coords = getPointInBiome(id, land.biome);
            if (!myCoords) myCoords = coords;
            // Change 1: use getBiomeKey to normalize biome
            const color = BIOME_COLORS[getBiomeKey(land.biome)] ?? "#8800ff";
            const marker = L.marker(coords, {
              icon: makeBeamIcon(L, color, true),
            });
            marker.on("click", (e: any) =>
              handleBeamClick(
                e,
                id,
                getBiomeKey(land.biome),
                land.principal?.toString() ?? "",
                true,
              ),
            );
            marker.addTo(beamLayer);
          } else if (!myCoords) {
            myCoords = getPointInBiome(id, land.biome);
          }
        }
      } catch (e) {
        console.warn("[MapView] myLands beam render error:", e);
      }
    }

    // 3. Zoom to owner's land once
    if (myCoords && !hasZoomedRef.current) {
      hasZoomedRef.current = true;
      map.flyTo(myCoords, -0.5, {
        animate: true,
        duration: 1.8,
        easeLinearity: 0.2,
      });
      setTimeout(() => setIsZoomReady(true), 700);
    } else if (!myCoords) {
      setIsZoomReady(true);
    }
    // biome-ignore lint/correctness/useExhaustiveDependencies: handleBeamClick stable via useCallback not needed here
  }, [allLandsPublic, myLands, principalId, isMapReady, handleBeamClick]);

  const showOverlay = !isEngineReady || !isImageLoaded || !isZoomReady;

  const formatPrincipal = (p: string) => {
    if (!p || p.length < 12) return p;
    return `${p.slice(0, 8)}...${p.slice(-4)}`;
  };

  const content = (
    <div style={containerStyle}>
      {showOverlay && (
        <div style={loadingOverlayStyle}>
          <div className="cyber-loader">
            <div className="loader-text">SCANNING SECTORS...</div>
            <div className="loader-bar" />
          </div>
        </div>
      )}
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          background: "#000",
          position: "relative",
        }}
      />

      {/* Popup card */}
      {popup !== null &&
        popupPx !== null &&
        (() => {
          const biomeColor = BIOME_COLORS[popup.biome] ?? "#8800ff";
          const CARD_W = 220;
          const CARD_H = 120;
          const MARGIN = 8;
          let cx = popupPx.x + 16;
          let cy = popupPx.y - 60;
          if (cx + CARD_W > window.innerWidth - MARGIN)
            cx = popupPx.x - CARD_W - 16;
          if (cx < MARGIN) cx = MARGIN;
          if (cy < MARGIN) cy = popupPx.y + 16;
          if (cy + CARD_H > window.innerHeight - MARGIN)
            cy = window.innerHeight - CARD_H - MARGIN;
          return (
            <div
              style={{
                position: "absolute",
                left: cx,
                top: cy,
                width: 220,
                zIndex: 9999,
                pointerEvents: "auto",
                animation: "popupIn 0.15s ease-out forwards",
              }}
            >
              {/* Biome color top strip */}
              <div
                style={{
                  height: 2,
                  width: "100%",
                  background: biomeColor,
                  borderRadius: "10px 10px 0 0",
                  boxShadow: `0 0 8px ${biomeColor}`,
                }}
              />
              {/* Card body */}
              <div
                style={{
                  background: "rgba(0,0,0,0.75)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderTop: "none",
                  borderRadius: "0 0 10px 10px",
                  padding: "12px 14px",
                  boxShadow:
                    "0 0 24px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.04)",
                  position: "relative",
                }}
              >
                {/* Close button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPopup(null);
                    setPopupPx(null);
                  }}
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 8,
                    fontSize: 11,
                    color: "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    background: "none",
                    border: "none",
                    padding: 0,
                    lineHeight: 1,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "rgba(255,255,255,0.3)";
                  }}
                >
                  ×
                </button>

                {/* Row 1: Biome + YOUR LAND tag */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 2,
                      color: biomeColor,
                      textShadow: `0 0 8px ${biomeColor}`,
                      textTransform: "uppercase",
                    }}
                  >
                    {popup.biome.replace(/_/g, " ")}
                  </span>
                  {popup.isOwner && (
                    <span
                      style={{
                        fontSize: 8,
                        color: biomeColor,
                        border: `1px solid ${biomeColor}`,
                        borderRadius: 3,
                        padding: "1px 5px",
                        letterSpacing: 1,
                        opacity: 0.85,
                        fontFamily: "monospace",
                      }}
                    >
                      YOUR LAND
                    </span>
                  )}
                </div>

                {/* Row 2: Land ID */}
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: 12,
                    color: "rgba(255,255,255,0.9)",
                    letterSpacing: 1,
                    marginBottom: 4,
                  }}
                >
                  LAND #{popup.landId}
                </div>

                {/* Row 3: Principal */}
                <div
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: "monospace",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}
                >
                  {formatPrincipal(popup.principal)}
                </div>

                {/* Divider */}
                <div
                  style={{
                    height: 1,
                    background: "rgba(255,255,255,0.06)",
                    marginBottom: 8,
                  }}
                />

                {/* Row 4: Mod counter */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      color: "rgba(255,255,255,0.3)",
                      letterSpacing: 1.5,
                      fontFamily: "monospace",
                    }}
                  >
                    MODS INSTALLED
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: biomeColor,
                      textShadow: `0 0 6px ${biomeColor}`,
                      fontFamily: "monospace",
                    }}
                  >
                    {popup.modCount}/49
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

      <button type="button" onClick={onClose} style={closeButtonStyle}>
        ✕ EXIT
      </button>
      <style>{`
        .leaflet-container { background:#000 !important; cursor:crosshair; }
        .leaflet-marker-icon,.leaflet-marker-shadow { background:none; border:none; }
        .cyber-loader { text-align:center; }
        .loader-text { color:#00ff41; font-family:monospace; font-size:12px; letter-spacing:3px; }
        .loader-bar { width:120px; height:1px; background:#00ff41; margin:10px auto; animation:slide 2s infinite; }
        @keyframes slide { 0%{transform:scaleX(0);} 50%{transform:scaleX(1);} 100%{transform:scaleX(0);} }
        @keyframes popupIn {
          from { opacity: 0; transform: scale(0.92) translateY(4px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

const containerStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483647,
  background: "#000",
  overflow: "hidden",
  touchAction: "none",
  isolation: "isolate",
};
const loadingOverlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 2147483640,
  background: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};
const closeButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "15px",
  right: "15px",
  zIndex: 2147483646,
  padding: "6px 14px",
  fontSize: "10px",
  background: "rgba(0,0,0,0.7)",
  color: "#00ff41",
  border: "1px solid #00ff41",
  borderRadius: "3px",
  cursor: "pointer",
  fontFamily: "monospace",
  letterSpacing: "1px",
  backdropFilter: "blur(10px)",
};

export default MapView;
