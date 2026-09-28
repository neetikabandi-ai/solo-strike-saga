import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { busPos, runtime } from "../lib/runtime";
import { useGameStore } from "../store/useGameStore";

const V = new THREE.Vector3();

export function BattleBus() {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!g.current) return;
    const phase = useGameStore.getState().phase;
    const t = runtime.clock / runtime.bus.dur;
    g.current.visible = phase !== "menu" && t < 1.15;
    busPos(t, V);
    g.current.position.copy(V);
    g.current.rotation.y = runtime.bus.yaw;
  });

  return (
    <group ref={g}>
      {/* bus body */}
      <mesh castShadow>
        <boxGeometry args={[3.2, 3, 10]} />
        <meshStandardMaterial color="#2f6fdc" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[3.25, 0.9, 8.6]} />
        <meshStandardMaterial color="#cfe8ff" roughness={0.2} metalness={0.4} />
      </mesh>
      <mesh position={[0, -0.9, 0]}>
        <boxGeometry args={[3.3, 0.35, 10.1]} />
        <meshStandardMaterial color="#f4c430" />
      </mesh>
      {[-3.5, 3.5].map((z) =>
        [-1.6, 1.6].map((x) => (
          <mesh key={`${x}${z}`} position={[x, -1.5, z]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.6, 0.6, 0.4, 12]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        )),
      )}
      {/* balloon */}
      <mesh position={[0, 11, 0]} castShadow>
        <sphereGeometry args={[6, 20, 16]} />
        <meshStandardMaterial color="#3fa9f5" />
      </mesh>
      <mesh position={[0, 11, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[6.02, 0.5, 8, 32]} />
        <meshStandardMaterial color="#f4c430" />
      </mesh>
      {[
        [-1.4, -4],
        [1.4, -4],
        [-1.4, 4],
        [1.4, 4],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x! * 0.7, 4.5, z! * 0.5]} rotation={[z! > 0 ? 0.35 : -0.35, 0, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 6.5, 4]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
    </group>
  );
}
