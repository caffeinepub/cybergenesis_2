import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useActor } from '../hooks/useActor';
import { useInternetIdentity } from '../hooks/useInternetIdentity';
import { useQuery } from '@tanstack/react-query';

const MAP_SIZE = 2560;
const VORTEX_CENTER: [number, number] = [1280, 1280];
const RAW_MAP_URL = 'https://raw.githubusercontent.com/dobr312/cyberland/main/CyberMap/IMG_0133.webp';

const MapView = ({ onClose }: { onClose: () => void }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const hasAnimatedRef = useRef(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const principalId = identity?.getPrincipal().toString();

  const { data: lands } = useQuery({
    queryKey: ['landData'],
    queryFn: () => actor?.getLandData(),
    enabled: !!actor,
  });

  // 1. ENGINE LOADER
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if ((window as any).L) {
      setIsEngineReady(true);
    } else {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setIsEngineReady(true);
      document.head.appendChild(script);
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  // 2. MAP INITIALIZATION
  useEffect(() => {
    if (!isEngineReady || !mapContainerRef.current || mapRef.current || !(window as any).L) return;

    const L = (window as any).L;
    const map = L.map(mapContainerRef.current, {
      crs: L.CRS.Simple,
      minZoom: -1,
      maxZoom: 3,
      zoomControl: false,
      attributionControl: false,
      maxBoundsViscosity: 1.0,
    });

    const bounds: [number, number][] = [[0, 0], [MAP_SIZE, MAP_SIZE]];
    L.imageOverlay(RAW_MAP_URL, bounds).addTo(map);
    map.setMaxBounds(bounds);
    mapRef.current = map;

    const updateZoom = () => {
      const scale = Math.max(window.innerWidth / MAP_SIZE, window.innerHeight / MAP_SIZE);
      map.setMinZoom(Math.log2(scale));
      map.setZoom(Math.log2(scale));
    };
    updateZoom();
    window.addEventListener('resize', updateZoom);

    setTimeout(() => { if (mapRef.current) mapRef.current.invalidateSize(); }, 300);

    setIsDataLoaded(true);

    return () => {
      window.removeEventListener('resize', updateZoom);
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [isEngineReady]);

  // 3. DRAW BEAMS
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !lands || !(window as any).L) return;

    const L = (window as any).L;
    let myFirstLandCoords: [number, number] | null = null;

    for (const land of lands as any[]) {
      const coords = getPointInBiome(Number(land.id), land.biome);
      const isOwner = land.owner === principalId;
      if (isOwner && !myFirstLandCoords) myFirstLandCoords = coords as [number, number];

      const color = isOwner ? getBiomeColor(land.biome) : '#333';

      L.polyline([VORTEX_CENTER, coords], {
        color: color,
        weight: isOwner ? 2.5 : 0.6,
        opacity: isOwner ? 1 : 0.25,
        className: isOwner ? `beam-neon beam-${String(land.biome).toLowerCase()}` : 'beam-other'
      }).addTo(map);

      if (isOwner) {
        L.circleMarker(coords, {
          radius: 2,
          fillColor: color,
          fillOpacity: 1,
          color: '#fff',
          weight: 1,
          className: 'land-impact-point'
        }).addTo(map);
      }
    }

    if (myFirstLandCoords && !hasAnimatedRef.current) {
      map.setView(myFirstLandCoords, 1);
      hasAnimatedRef.current = true;
    }
  }, [lands, principalId]);

  const getBiomeColor = (biome: string) => {
    const colors: Record<string, string> = {
      'MYTHIC_VOID': '#9933FF',
      'MYTHIC_AETHER': '#0055FF',
      'VOLCANIC_CRAG': '#ff3300',
      'DESERT_DUNE': '#FFCC00',
      'FOREST_VALLEY': '#00ff41',
      'SNOW_PEAK': '#ffffff',
      'ISLAND_ARCHIPELAGO': '#00ffff'
    };
    return colors[biome] || '#555';
  };

  const getPointInBiome = (landId: number, biome: string) => {
    const seed = landId * 1337.42;
    const pseudoRandom = (offset: number) => Math.abs(Math.sin(seed + offset));

    const regions: any = {
      'MYTHIC_VOID':        { x: [1150, 1410], y: [1150, 1410] },
      'MYTHIC_AETHER':      { x: [1150, 1410], y: [1150, 1410] },
      'VOLCANIC_CRAG':      { x: [1800, 2300], y: [500, 1000] },
      'DESERT_DUNE':        { x: [1700, 2350], y: [1700, 2300] },
      'FOREST_VALLEY':      { x: [400, 900],   y: [1200, 1700] },
      'SNOW_PEAK':          { x: [300, 1000],  y: [400, 800] },
      'ISLAND_ARCHIPELAGO': { x: [300, 1100],  y: [1900, 2400] }
    };

    const zone = regions[biome] || regions.MYTHIC_VOID;
    return [
      zone.y[0] + pseudoRandom(1) * (zone.y[1] - zone.y[0]),
      zone.x[0] + pseudoRandom(2) * (zone.x[1] - zone.x[0])
    ];
  };

  const content = (
    <div style={containerStyle}>
      {(!isEngineReady || !isDataLoaded) && (
        <div style={loadingOverlayStyle}>
          <div className="cyber-loader">
            <div className="loader-text">SCANNING SECTORS...</div>
            <div className="loader-bar" />
          </div>
        </div>
      )}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', background: '#000' }} />
      <button type="button" onClick={onClose} style={closeButtonStyle}>✕ EXIT</button>

      <style>{`
        .leaflet-container { background: #000 !important; cursor: crosshair; }
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
        .cyber-loader { text-align: center; }
        .loader-text { color: #00ff41; font-family: monospace; font-size: 12px; letter-spacing: 3px; }
        .loader-bar { width: '120px', height: 1px; background: #00ff41; margin: 10px auto; animation: slide 2s infinite; }
        @keyframes slide { 0% { transform: scaleX(0); } 50% { transform: scaleX(1); } 100% { transform: scaleX(0); } }
      `}</style>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
};

const containerStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100000, background: '#000', overflow: 'hidden', touchAction: 'none'
};
const loadingOverlayStyle: React.CSSProperties = {
  position: 'absolute', inset: 0, zIndex: 100005, background: '#000',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};
const closeButtonStyle: React.CSSProperties = {
  position: 'absolute', top: '15px', right: '15px', zIndex: 100010,
  padding: '6px 14px',
  fontSize: '10px',
  background: 'rgba(0,0,0,0.7)', color: '#00ff41',
  border: '1px solid #00ff41', borderRadius: '3px', cursor: 'pointer',
  fontFamily: 'monospace', letterSpacing: '1px', backdropFilter: 'blur(10px)'
};

export default MapView;
