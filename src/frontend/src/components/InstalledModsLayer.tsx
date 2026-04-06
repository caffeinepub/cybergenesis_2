/**
 * InstalledModsLayer.tsx
 * Renders installed mods as 3D objects on their anchor points.
 * Uses GLTFLoader + KTX2Loader (same as LandModel.tsx) for KTX2 texture support.
 * Re-renders when installRevision prop changes.
 */

import { useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import {
  type InstalledMod,
  MEGA_GLB_URLS,
  getAnchorWorldPosition,
  getInstalledMods,
} from "../lib/modInstallation";

const LAND_SCALE = 12;
const KTX2_CDN =
  "https://cdn.jsdelivr.net/npm/three@0.176.0/examples/jsm/libs/basis/";

interface InstalledModsLayerProps {
  landId: string;
  biome: string;
  installRevision?: number;
}

interface ModEntry {
  mod: InstalledMod;
  obj: THREE.Object3D;
  pos: [number, number, number];
  rot: [number, number, number];
}

// Cache loaded mega-GLB scenes by tier to avoid reloading
const megaSceneCache: Record<number, THREE.Group> = {};

export function InstalledModsLayer({
  landId,
  biome,
  installRevision = 0,
}: InstalledModsLayerProps) {
  const { gl } = useThree();
  const [modObjects, setModObjects] = useState<ModEntry[]>([]);
  const abortRef = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: installRevision is a version counter to force re-runs; it is not used inside the callback directly
  useEffect(() => {
    abortRef.current = false;
    void installRevision; // dependency tracking — triggers re-run on install/uninstall

    const installed = getInstalledMods(landId);
    if (installed.length === 0) {
      setModObjects([]);
      return;
    }

    // Group by tier
    const tierGroups: Record<number, InstalledMod[]> = {};
    for (const mod of installed) {
      if (!tierGroups[mod.rarityTier]) tierGroups[mod.rarityTier] = [];
      tierGroups[mod.rarityTier].push(mod);
    }

    const ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(KTX2_CDN);
    ktx2Loader.detectSupport(gl);

    const gltfLoader = new GLTFLoader();
    gltfLoader.setKTX2Loader(ktx2Loader);

    const tiers = Object.keys(tierGroups).map(Number);
    const results: ModEntry[] = [];
    let pending = tiers.length;

    if (pending === 0) {
      setModObjects([]);
      return;
    }

    const finalize = () => {
      pending--;
      if (pending === 0 && !abortRef.current) {
        setModObjects([...results]);
      }
    };

    const extractAndCollect = (tier: number, megaScene: THREE.Group) => {
      const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

      // Apply texture quality settings
      megaScene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material)
            ? child.material
            : [child.material];
          for (const m of mats as THREE.MeshStandardMaterial[]) {
            m.dithering = true;
            for (const tex of [
              m.map,
              m.emissiveMap,
              m.normalMap,
              m.metalnessMap,
              m.roughnessMap,
            ]) {
              if (tex) {
                tex.anisotropy = maxAnisotropy;
                tex.needsUpdate = true;
              }
            }
          }
        }
      });

      for (const mod of tierGroups[tier]) {
        const anchorData = getAnchorWorldPosition(
          mod.slotId,
          biome,
          LAND_SCALE,
        );
        if (!anchorData) continue;

        let found: THREE.Object3D | null = null;
        megaScene.traverse((child) => {
          if (!found && child.name === mod.modNodeName) found = child;
        });
        if (!found) {
          megaScene.traverse((child) => {
            if (
              !found &&
              child.name.toLowerCase() === mod.modNodeName.toLowerCase()
            )
              found = child;
          });
        }
        if (found) {
          results.push({
            mod,
            obj: (found as THREE.Object3D).clone(true),
            pos: anchorData.position,
            rot: anchorData.rotation,
          });
        }
      }
    };

    for (const tier of tiers) {
      const url = MEGA_GLB_URLS[tier];
      if (!url) {
        finalize();
        continue;
      }

      // Use cached scene if available
      if (megaSceneCache[tier]) {
        extractAndCollect(tier, megaSceneCache[tier]);
        finalize();
        continue;
      }

      gltfLoader.load(
        url,
        (gltf) => {
          if (abortRef.current) return;
          megaSceneCache[tier] = gltf.scene;
          extractAndCollect(tier, gltf.scene);
          finalize();
        },
        undefined,
        (err) => {
          console.error(
            "[InstalledModsLayer] Failed to load mega-GLB tier",
            tier,
            err,
          );
          finalize();
        },
      );
    }

    return () => {
      abortRef.current = true;
      ktx2Loader.dispose();
    };
  }, [landId, biome, installRevision, gl]);

  if (modObjects.length === 0) return null;

  return (
    <>
      {modObjects.map(({ mod, obj, pos, rot }) => (
        <primitive
          key={`${mod.slotId}-${mod.instanceId}`}
          object={obj}
          position={pos}
          rotation={rot}
        />
      ))}
    </>
  );
}
