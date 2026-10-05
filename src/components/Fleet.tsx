import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { NUKE_RADIUS } from "../lib/fleet";
import { runtime, trainCars } from "../lib/runtime";
import { POIS, TOWER_TOPS } from "../lib/world";

function FighterJet() {
  return (
    <group>
      <mesh position={[0, 1.6, 0]} rotation-x={Math.PI / 2} castShadow>
        <capsuleGeometry args={[0.8, 9, 4, 10]} />
        <meshStandardMaterial color="#7d858c" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.6, -6.2]} rotation-x={-Math.PI / 2}>
        <coneGeometry args={[0.8, 2.6, 10]} />
        <meshStandardMaterial color="#5f666c" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0, 2.35, -2.6]}>
        <sphereGeometry args={[0.6, 10, 8]} />
        <meshStandardMaterial color="#1c2a33" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0, 1.5, 0.8]}>
        <boxGeometry args={[9, 0.18, 3.2]} />
        <meshStandardMaterial color="#6d757c" metalness={0.45} roughness={0.45} />
      </mesh>
      <mesh position={[0, 3, 4.6]}>
        <boxGeometry args={[0.16, 2.6, 1.8]} />
        <meshStandardMaterial color="#6d757c" />
      </mesh>
      <mesh position={[0, 1.7, 4.8]}>
        <boxGeometry args={[4, 0.14, 1.4]} />
        <meshStandardMaterial color="#6d757c" />
      </mesh>
      <mesh position={[0, 1.6, 6]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.55, 0.45, 0.4, 10]} />
        <meshBasicMaterial color="#ff8a3d" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Helicopter({ rotor }: { rotor: (el: THREE.Mesh | null) => void }) {
  return (
    <group>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[1.5, 12, 10]} />
        <meshStandardMaterial color="#3e4a3a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.8, -1]}>
        <sphereGeometry args={[1.05, 10, 8]} />
        <meshStandardMaterial color="#1c2a33" metalness={0.8} roughness={0.15} />
      </mesh>
      <mesh position={[0, 1.9, 3.4]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.18, 0.35, 4.5, 8]} />
        <meshStandardMaterial color="#3e4a3a" />
      </mesh>
      <mesh position={[0.25, 2.4, 5.5]}>
        <boxGeometry args={[0.08, 1.4, 0.25]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.15, 0]}>
          <boxGeometry args={[0.12, 0.12, 3.4]} />
          <meshStandardMaterial color="#222" />
        </mesh>
      ))}
      <mesh ref={rotor} position={[0, 3.25, 0]}>
        <boxGeometry args={[9, 0.06, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
    </group>
  );
}

export function Aircraft() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const rotors = useRef<(THREE.Mesh | null)[]>([]);
  useFrame((_, dt) => {
    runtime.aircraft.forEach((a, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.position.set(a.x, a.y, a.z);
      g.rotation.set(a.kind === "jet" ? a.pitch * 0.6 : -a.speed * 0.008, a.yaw, 0, "YXZ");
      const r = rotors.current[i];
      if (r) r.rotation.y += dt * (runtime.piloting === i ? 30 : 0.4);
    });
  });
  return (
    <>
      {runtime.aircraft.map((a, i) => (
        <group key={a.id} ref={(el) => { groups.current[i] = el; }}>
          {a.kind === "jet" ? <FighterJet /> : <Helicopter rotor={(el) => { rotors.current[i] = el; }} />}
        </group>
      ))}
    </>
  );
}

export function TransitFleet() {
  const groups = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    runtime.transit.forEach((t, i) => {
      const g = groups.current[i];
      if (g) { g.position.set(t.x, 0, t.z); g.rotation.y = t.yaw; }
    });
  });
  return (
    <>
      {runtime.transit.map((t, i) => {
        const bus = t.kind === "bus";
        const L = bus ? 11 : 4.4, W = bus ? 2.6 : 1.9, H = bus ? 3.1 : 1.1;
        return (
          <group key={t.id} ref={(el) => { groups.current[i] = el; }}>
            <mesh position={[0, 0.5 + H / 2, 0]} castShadow>
              <boxGeometry args={[W, H, L]} />
              <meshStandardMaterial color={t.color} roughness={0.5} />
            </mesh>
            <mesh position={[0, bus ? 2.4 : 1.95, bus ? 0 : 0.3]}>
              <boxGeometry args={[W + 0.04, bus ? 1 : 0.7, bus ? L - 1 : 2]} />
              <meshStandardMaterial color="#1b252c" metalness={0.6} roughness={0.2} />
            </mesh>
            {!bus && (
              <mesh position={[0, 2.4, 0.3]}>
                <boxGeometry args={[0.7, 0.25, 0.3]} />
                <meshBasicMaterial color="#fff3b0" toneMapped={false} />
              </mesh>
            )}
            <mesh position={[0, 0.9, -L / 2 - 0.01]}>
              <boxGeometry args={[W - 0.3, 0.25, 0.05]} />
              <meshBasicMaterial color="#fff6d8" toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

const BOMB_POOL = 24;
const BLAST_POOL = 12;
export function Nukes() {
  const bombs = useRef<(THREE.Mesh | null)[]>([]);
  const blasts = useRef<(THREE.Mesh | null)[]>([]);
  useFrame(() => {
    for (let i = 0; i < BOMB_POOL; i++) {
      const m = bombs.current[i], b = runtime.bombs[i];
      if (!m) continue;
      m.visible = !!b;
      if (b) m.position.set(b.x, b.y, b.z);
    }
    for (let i = 0; i < BLAST_POOL; i++) {
      const m = blasts.current[i], b = runtime.blasts[i];
      if (!m) continue;
      m.visible = !!b;
      if (!b) continue;
      const k = 1 - b.life / 1.4;
      m.position.set(b.x, b.y, b.z);
      m.scale.setScalar(2 + k * NUKE_RADIUS);
      (m.material as THREE.MeshBasicMaterial).opacity = 0.85 * (1 - k);
    }
  });
  return (
    <>
      {Array.from({ length: BOMB_POOL }, (_, i) => (
        <mesh key={i} ref={(el) => { bombs.current[i] = el; }} visible={false}>
          <capsuleGeometry args={[0.35, 1.2, 4, 8]} />
          <meshStandardMaterial color="#2f3a2a" />
        </mesh>
      ))}
      {Array.from({ length: BLAST_POOL }, (_, i) => (
        <mesh key={i} ref={(el) => { blasts.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 20, 14]} />
          <meshBasicMaterial color="#ffb347" transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  );
}

const BEAM_H = 600;
const DISTRICT_COLORS = ["#8b5cf6", "#f59e0b", "#38bdf8", "#f43f5e", "#22c55e", "#eab308", "#06b6d4", "#ec4899", "#a3e635", "#fb923c", "#60a5fa", "#e879f9"];

function Beam({ x, y, z, color, width = 2.2 }: { x: number; y: number; z: number; color: string; width?: number }) {
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, BEAM_H / 2, 0]}>
        <cylinderGeometry args={[width * 0.6, width, BEAM_H, 10, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, BEAM_H / 2, 0]}>
        <cylinderGeometry args={[width * 0.2, width * 0.35, BEAM_H, 8, 1, true]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} fog={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function Beacons() {
  const train = useRef<THREE.Group>(null);
  useFrame(() => {
    const c = trainCars[1]!;
    train.current?.position.set(c.x, 21, c.z);
  });
  return (
    <>
      {POIS.map((p, i) => <Beam key={p.name} x={p.x} y={0} z={p.z} color={DISTRICT_COLORS[i % DISTRICT_COLORS.length]!} width={3} />)}
      {TOWER_TOPS.map((t, i) => <Beam key={i} x={t.x} y={t.y} z={t.z} color="#fde68a" width={1.4} />)}
      <group ref={train}>
        <Beam x={0} y={0} z={0} color="#10f0a0" width={2.6} />
      </group>
    </>
  );
}
