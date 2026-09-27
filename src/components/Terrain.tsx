import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FOLIAGE, MAP_SIZE, OBSTACLES } from "../lib/world";
import { makeConcreteTexture, makeGroundTexture } from "../lib/textures";

const BUILDING_COLORS = ["#b9ad92", "#a09578", "#8d8367", "#c2b79c"];

export function Ground() {
  const tex = useMemo(() => makeGroundTexture(), []);
  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <mesh rotation-x={-Math.PI / 2} receiveShadow>
      <planeGeometry args={[MAP_SIZE + 60, MAP_SIZE + 60]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

export function Structures() {
  const concrete = useMemo(() => makeConcreteTexture(), []);
  useEffect(() => () => concrete.dispose(), [concrete]);

  const crates = OBSTACLES.filter((b) => b.kind === "crate");
  const solids = OBSTACLES.filter((b) => b.kind !== "crate");

  return (
    <group>
      {solids.map((b, i) => {
        const color =
          b.kind === "rock"
            ? "#6e6a5f"
            : b.kind === "wall"
              ? "#8d8367"
              : BUILDING_COLORS[i % BUILDING_COLORS.length];
        return (
          <group key={`s${i}`} position={[b.x, 0, b.z]}>
            <mesh position-y={b.h / 2} castShadow receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              <meshStandardMaterial
                map={b.kind === "rock" ? null : concrete}
                color={color ?? "#ffffff"}
                roughness={0.95}
                flatShading={b.kind === "rock"}
              />
            </mesh>
            {b.kind === "building" && (
              <mesh position-y={b.h + 0.15} castShadow>
                <boxGeometry args={[b.w + 0.7, 0.3, b.d + 0.7]} />
                <meshStandardMaterial color="#6b6455" roughness={1} />
              </mesh>
            )}
          </group>
        );
      })}
      <Crates
        boxes={crates.map((b) => ({ x: b.x, z: b.z, rot: b.rot ?? 0 }))}
      />
      <Foliage />
    </group>
  );
}

function Crates({ boxes }: { boxes: { x: number; z: number; rot: number }[] }) {
  const { scene } = useGLTF("/models/crate.glb");

  const template = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    clone.scale.setScalar(1.8 / (size.y || 1));
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return (
    <group>
      {boxes.map((b, i) => (
        <primitive
          key={i}
          object={i === 0 ? template : template.clone(true)}
          position={[b.x, 0, b.z]}
          rotation-y={b.rot}
        />
      ))}
    </group>
  );
}

function Foliage() {
  return (
    <group>
      {FOLIAGE.map((f, i) =>
        f.kind === 1 ? (
          <group key={i} position={[f.x, 0, f.z]} scale={f.s}>
            <mesh position-y={1.6} castShadow>
              <cylinderGeometry args={[0.18, 0.28, 3.2, 6]} />
              <meshStandardMaterial color="#5b4a34" roughness={1} />
            </mesh>
            <mesh position-y={3.9} castShadow>
              <icosahedronGeometry args={[1.5, 0]} />
              <meshStandardMaterial
                color="#4a5c31"
                roughness={1}
                flatShading
              />
            </mesh>
          </group>
        ) : (
          <mesh
            key={i}
            position={[f.x, 0.4 * f.s, f.z]}
            scale={f.s}
            castShadow
          >
            <icosahedronGeometry args={[0.7, 0]} />
            <meshStandardMaterial color="#57632f" roughness={1} flatShading />
          </mesh>
        )
      )}
    </group>
  );
}

useGLTF.preload("/models/crate.glb");
