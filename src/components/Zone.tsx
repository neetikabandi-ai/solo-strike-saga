import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";

/** Purple storm wall + white ring showing the next safe circle. */
export function Zone() {
  const ref = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { zoneRadius, zoneX, zoneZ, zoneNext, nextX, nextZ } = useGameStore.getState();
    if (ref.current) {
      ref.current.position.set(zoneX, 150, zoneZ);
      ref.current.scale.set(Math.max(0.1, zoneRadius), 1, Math.max(0.1, zoneRadius));
    }
    if (markerRef.current) {
      markerRef.current.position.set(nextX, 0.15, nextZ);
      markerRef.current.scale.setScalar(Math.max(0.1, zoneNext));
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <cylinderGeometry args={[1, 1, 300, 96, 1, true]} />
        <meshBasicMaterial color="#9b3cf0" transparent opacity={0.3} side={THREE.DoubleSide} depthWrite={false} fog={false} />
      </mesh>
      <mesh ref={markerRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.99, 1, 128]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.8} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}
