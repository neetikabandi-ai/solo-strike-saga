import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { runtime } from "../lib/runtime";
import { RARITY } from "../lib/weapons";
import { useGameStore } from "../store/useGameStore";

/** First-person gun that follows the camera. Must be mounted after <Player />. */
export function ViewModel() {
  const root = useRef<THREE.Group>(null);
  const gun = useRef<THREE.Group>(null);
  const flash = useRef<THREE.Mesh>(null);
  const weapon = useGameStore((s) => s.slots[s.slot] ?? null);
  const phase = useGameStore((s) => s.phase);
  const busy = useGameStore((s) => s.reloading || !!s.using);

  useFrame(({ camera }, raw) => {
    const dt = Math.min(raw, 0.05);
    if (!root.current || !gun.current) return;
    root.current.visible = phase === "playing" && !!weapon && runtime.driving < 0;
    root.current.position.copy(camera.position);
    root.current.quaternion.copy(camera.quaternion);
    const ads = runtime.view.ads;
    const hideForScope = ads && weapon?.kind === "sniper";
    gun.current.visible = !hideForScope;
    const kick = runtime.muzzle > 0 ? 0.05 : 0;
    const tx = ads ? 0 : 0.24;
    const ty = (ads ? -0.13 : -0.22) + runtime.view.bob - (busy ? 0.18 : 0);
    const tz = (ads ? -0.38 : -0.5) + kick;
    const s = 1 - Math.exp(-18 * dt);
    gun.current.position.x += (tx - gun.current.position.x) * s;
    gun.current.position.y += (ty - gun.current.position.y) * s;
    gun.current.position.z += (tz - gun.current.position.z) * s;
    if (flash.current) flash.current.visible = runtime.muzzle > 0 && !hideForScope;
    runtime.muzzle = Math.max(0, runtime.muzzle - dt);
  });

  const kind = weapon?.kind ?? "ar";
  const accent = RARITY[weapon?.rarity ?? 0]!.color;
  const barrel = kind === "sniper" ? 0.75 : kind === "shotgun" ? 0.42 : kind === "smg" ? 0.18 : 0.34;
  const bodyLen = kind === "smg" ? 0.34 : 0.5;
  const radius = kind === "shotgun" ? 0.03 : 0.018;

  return (
    <group ref={root}>
      <group ref={gun} position={[0.24, -0.22, -0.5]}>
        <mesh>
          <boxGeometry args={[0.08, 0.11, bodyLen]} />
          <meshStandardMaterial color="#2d3138" roughness={0.6} metalness={0.3} />
        </mesh>
        <mesh position={[0, 0.058, 0]}>
          <boxGeometry args={[0.082, 0.012, bodyLen * 0.8]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.02, -bodyLen / 2 - barrel / 2]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[radius, radius, barrel, 8]} />
          <meshStandardMaterial color="#1c1f24" metalness={0.5} roughness={0.4} />
        </mesh>
        {kind !== "shotgun" && (
          <mesh position={[0, -0.1, -0.06]} rotation-x={0.2}>
            <boxGeometry args={[0.05, 0.14, 0.07]} />
            <meshStandardMaterial color={accent} />
          </mesh>
        )}
        {kind === "sniper" && (
          <mesh position={[0, 0.1, -0.02]} rotation-x={Math.PI / 2}>
            <cylinderGeometry args={[0.03, 0.03, 0.26, 10]} />
            <meshStandardMaterial color="#111" />
          </mesh>
        )}
        <mesh position={[0, -0.06, bodyLen / 2 - 0.02]}>
          <boxGeometry args={[0.07, 0.14, 0.12]} />
          <meshStandardMaterial color="#6b4a2e" />
        </mesh>
        <mesh ref={flash} position={[0, 0.02, -bodyLen / 2 - barrel - 0.05]} visible={false}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ffd27a" />
        </mesh>
      </group>
    </group>
  );
}
