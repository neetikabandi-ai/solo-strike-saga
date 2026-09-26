import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";

export type SoldierClip = "idle" | "walk" | "sprint" | "die" | "shoot";

const CLIP_MAP: Record<SoldierClip, string> = {
  idle: "holding-both",
  walk: "walk",
  sprint: "sprint",
  die: "die",
  shoot: "holding-both-shoot",
};

/**
 * One low-poly soldier: cloned GLB, tinted fatigues, rifle parented to the
 * right arm so it swings with the animation.
 */
export function Soldier({
  url,
  tint,
  clip,
  withRifle = true,
}: {
  url: string;
  tint: string;
  clip: SoldierClip;
  withRifle?: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(url);
  const rifleGltf = useGLTF("/models/rifle.glb");

  const model = useMemo(() => {
    const c = skeletonClone(scene);
    const color = new THREE.Color(tint);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      const mat = m.material as THREE.MeshStandardMaterial;
      const next = mat.clone();
      next.color.multiply(color);
      next.roughness = 0.9;
      next.metalness = 0;
      m.material = next;
    });

    if (withRifle) {
      const arm = c.getObjectByName("arm-right");
      const rifle = rifleGltf.scene.clone(true);
      const box = new THREE.Box3().setFromObject(rifle);
      const size = box.getSize(new THREE.Vector3());
      rifle.scale.setScalar(0.85 / (size.z || 1));
      rifle.position.set(0.12, -0.42, 0.22);
      rifle.rotation.set(0, 0, 0);
      rifle.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) m.castShadow = true;
      });
      (arm ?? c).add(rifle);
    }
    return c;
  }, [scene, tint, withRifle, rifleGltf.scene]);

  const { actions } = useAnimations(animations, group);
  const prev = useRef<string | null>(null);

  useEffect(() => {
    const name = CLIP_MAP[clip];
    if (prev.current === name) return;
    const next = actions[name];
    if (!next) return;
    if (prev.current) actions[prev.current]?.fadeOut(0.18);
    if (clip === "die") {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.reset().fadeIn(0.18).play();
    prev.current = name;
  }, [actions, clip]);

  return (
    <group ref={group}>
      <primitive object={model} />
    </group>
  );
}

useGLTF.preload("/models/soldier.glb");
useGLTF.preload("/models/enemy.glb");
useGLTF.preload("/models/rifle.glb");
