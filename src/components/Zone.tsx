import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";

export function Zone() {
  const ref = useRef<THREE.Mesh>(null);
  const markerRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const { zoneRadius, zoneX, zoneZ, zoneNext } = useGameStore.getState();
    if (ref.current) {
      ref.current.position.set(zoneX, 40, zoneZ);
      ref.current.scale.set(zoneRadius, 1, zoneRadius);
    }
    if (markerRef.current) {
      markerRef.current.position.set(zoneX, 0.08, zoneZ);
      markerRef.current.scale.setScalar(zoneNext);
    }
  });

  return (
    <group>
      <mesh ref={ref}>
        <cylinderGeometry args={[1, 1, 80, 64, 1, true]} />
        <meshBasicMaterial
          color="#6ee7ff"
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={markerRef} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.985, 1, 96]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
