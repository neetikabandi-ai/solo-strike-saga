import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { CAR_H, CAR_LEN, CAR_W, runtime, trainCars, TRAIN_CARS } from "../lib/runtime";
import { TRAIN_Y } from "../lib/world";
import { PADS, VEHICLE_SPOTS } from "../lib/world";
import { useGameStore } from "../store/useGameStore";

export function LaunchPads() {
  const ring = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.08;
    ring.current.children.forEach((c) => c.scale.set(s, 1, s));
  });
  return (
    <group ref={ring}>
      {PADS.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.15, 0]} receiveShadow>
            <cylinderGeometry args={[1.6, 1.8, 0.3, 20]} />
            <meshStandardMaterial color="#2b2b2b" />
          </mesh>
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[1.3, 1.3, 0.06, 20]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} />
          </mesh>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.6, 1.3, 8, 16, 1, true]} />
            <meshBasicMaterial color="#fde047" transparent opacity={0.18} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Car({ id }: { id: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const v = runtime.vehicles[id];
    if (!g.current || !v) return;
    g.current.position.set(v.x, 0, v.z);
    g.current.rotation.y = v.yaw;
  });
  const wheels: [number, number][] = [[-1, -1.3], [1, -1.3], [-1, 1.3], [1, 1.3]];
  return (
    <group ref={g}>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[2, 0.6, 3.6]} />
        <meshStandardMaterial color="#e2572b" />
      </mesh>
      <mesh position={[0, 1.4, 0.3]} castShadow>
        <boxGeometry args={[1.7, 0.6, 1.6]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      <mesh position={[0, 1.1, -1.6]}>
        <boxGeometry args={[1.8, 0.2, 0.3]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fef3c7" emissiveIntensity={0.5} />
      </mesh>
      {wheels.map(([x, z], i) => (
        <mesh key={i} position={[x * 1.05, 0.45, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.45, 0.45, 0.35, 12]} />
          <meshStandardMaterial color="#111" />
        </mesh>
      ))}
    </group>
  );
}

export function Vehicles() {
  return (
    <>
      {VEHICLE_SPOTS.map((_, i) => (
        <Car key={i} id={i} />
      ))}
    </>
  );
}

/** Player body + glider, visible only in third person while gliding. */
export function GliderAvatar() {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const on = useGameStore.getState().phase === "dive" && runtime.gliding;
    g.current.visible = on;
    if (!on) return;
    g.current.position.set(runtime.player.x, runtime.altitude, runtime.player.z);
    g.current.rotation.y = runtime.playerYaw;
  });
  return (
    <group ref={g} visible={false}>
      <mesh position={[0, 1, 0]}>
        <capsuleGeometry args={[0.35, 0.9, 4, 8]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh position={[0, 1.8, 0]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color="#f1c27d" />
      </mesh>
      <mesh position={[0, 3.3, 0.2]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[4.5, 0.12, 1.6]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x / 2, 2.4, 0.1]} rotation={[0, 0, x > 0 ? -0.55 : 0.55]}>
          <cylinderGeometry args={[0.02, 0.02, 2, 4]} />
          <meshBasicMaterial color="#222" />
        </mesh>
      ))}
    </group>
  );
}

export function MaglevTrain() {
  const refs = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    for (let i = 0; i < TRAIN_CARS; i++) {
      const g = refs.current[i];
      const c = trainCars[i]!;
      if (g) {
        g.position.set(c.x, TRAIN_Y, c.z);
        g.rotation.y = c.yaw;
      }
    }
  });
  return (
    <group>
      {Array.from({ length: TRAIN_CARS }, (_, i) => (
        <group key={i} ref={(el) => { refs.current[i] = el; }}>
          <mesh position={[0, CAR_H / 2 + 0.18, 0]} castShadow>
            <capsuleGeometry args={[CAR_W / 2, CAR_LEN - CAR_W, 5, 12]} />
            <meshStandardMaterial color={i === 0 ? "#d8dde1" : "#c6ccd1"} metalness={0.65} roughness={0.28} />
          </mesh>
          <mesh position={[0, CAR_H * 0.68, 0]}>
            <boxGeometry args={[CAR_W + 0.04, 0.75, CAR_LEN - 2.2]} />
            <meshStandardMaterial color="#25313a" metalness={0.7} roughness={0.18} />
          </mesh>
          {[-1, 1].map((sd) => (
            <mesh key={sd} position={[sd * (CAR_W / 2 + 0.01), CAR_H * 0.6, 0]}>
              <boxGeometry args={[0.04, 0.5, CAR_LEN - 1]} />
              <meshStandardMaterial color="#315b69" emissive="#315b69" emissiveIntensity={0.25} />
            </mesh>
          ))}
          {i === 0 && (
            <mesh position={[0, CAR_H * 0.55, CAR_LEN / 2 + 0.02]}>
              <boxGeometry args={[CAR_W - 0.6, 0.5, 0.05]} />
              <meshStandardMaterial color="#f3f0d6" emissive="#f3f0d6" emissiveIntensity={0.8} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
