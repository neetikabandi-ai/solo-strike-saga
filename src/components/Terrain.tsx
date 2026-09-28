import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { runtime } from "../lib/runtime";
import { MAP_SIZE, OBSTACLES, TREES } from "../lib/world";
import { makeConcreteTexture, makeGroundTexture } from "../lib/textures";

const M = new THREE.Matrix4();
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const C = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export function Ground() {
  const tex = useMemo(() => {
    const t = makeGroundTexture();
    t.repeat.set(160, 160);
    return t;
  }, []);
  useEffect(() => () => tex.dispose(), [tex]);

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[MAP_SIZE + 40, MAP_SIZE + 40]} />
        <meshStandardMaterial map={tex} color="#a6e36b" roughness={1} />
      </mesh>
      {/* sea around the island */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#3aa0d8" roughness={0.3} metalness={0.1} />
      </mesh>
    </group>
  );
}

export function Structures() {
  const concrete = useMemo(() => makeConcreteTexture(), []);
  useEffect(() => () => concrete.dispose(), [concrete]);
  const solids = useMemo(() => OBSTACLES.filter((b) => b.kind !== "rock"), []);
  const rocks = useMemo(() => OBSTACLES.filter((b) => b.kind === "rock"), []);
  const roofs = useMemo(() => OBSTACLES.filter((b) => b.kind === "building"), []);
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    solids.forEach((b, i) => {
      M.compose(P.set(b.x, b.h / 2, b.z), Q.identity(), S.set(b.w, b.h, b.d));
      solidRef.current?.setMatrixAt(i, M);
      solidRef.current?.setColorAt(i, C.set(b.color));
    });
    roofs.forEach((b, i) => {
      M.compose(P.set(b.x, b.h + 0.2, b.z), Q.identity(), S.set(b.w + 0.8, 0.4, b.d + 0.8));
      roofRef.current?.setMatrixAt(i, M);
    });
    rocks.forEach((b, i) => {
      M.compose(P.set(b.x, b.h * 0.35, b.z), Q.setFromAxisAngle(UP, i), S.set(b.w * 0.6, b.h * 0.7, b.d * 0.6));
      rockRef.current?.setMatrixAt(i, M);
    });
    for (const r of [solidRef, roofRef, rockRef]) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      r.current.computeBoundingSphere();
    }
  }, [solids, roofs, rocks]);

  return (
    <group>
      <instancedMesh ref={solidRef} args={[undefined, undefined, solids.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial map={concrete} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={roofRef} args={[undefined, undefined, roofs.length]} castShadow>
        <boxGeometry />
        <meshStandardMaterial color="#7a5c4a" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={rockRef} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#8a8f96" roughness={1} flatShading />
      </instancedMesh>
      <Trees />
      <Chests />
    </group>
  );
}

function Trees() {
  const trunk = useRef<THREE.InstancedMesh>(null);
  const leaves = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    TREES.forEach((t, i) => {
      M.compose(P.set(t.x, 1.6 * t.s, t.z), Q.identity(), S.setScalar(t.s));
      trunk.current?.setMatrixAt(i, M);
      M.compose(P.set(t.x, 4.2 * t.s, t.z), Q.setFromAxisAngle(UP, i), S.setScalar(t.s));
      leaves.current?.setMatrixAt(i, M);
      leaves.current?.setColorAt(i, C.set(i % 3 === 0 ? "#3f9b3a" : i % 3 === 1 ? "#58b847" : "#2f8a45"));
    });
    for (const r of [trunk, leaves]) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      r.current.computeBoundingSphere();
    }
  }, []);
  return (
    <group>
      <instancedMesh ref={trunk} args={[undefined, undefined, TREES.length]} castShadow>
        <cylinderGeometry args={[0.2, 0.3, 3.2, 6]} />
        <meshStandardMaterial color="#7a5433" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={leaves} args={[undefined, undefined, TREES.length]} castShadow>
        <coneGeometry args={[1.8, 4, 7]} />
        <meshStandardMaterial roughness={1} flatShading />
      </instancedMesh>
    </group>
  );
}

const MAX_CHESTS = 400;

function Chests() {
  const body = useRef<THREE.InstancedMesh>(null);
  const lid = useRef<THREE.InstancedMesh>(null);
  const version = useRef(-1);

  useFrame(({ clock }) => {
    if (!body.current || !lid.current) return;
    const list = runtime.chests;
    const pulse = 0.35 + Math.sin(clock.elapsedTime * 4) * 0.15;
    (body.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
    if (version.current === runtime.chestVersion) return;
    version.current = runtime.chestVersion;
    for (let i = 0; i < MAX_CHESTS; i++) {
      const c = list[i];
      const show = !!c && !c.opened;
      Q.setFromAxisAngle(UP, c?.rot ?? 0);
      M.compose(P.set(c?.x ?? 0, 0.4, c?.z ?? 0), Q, S.set(show ? 1.3 : 0, show ? 0.8 : 0, show ? 0.8 : 0));
      body.current.setMatrixAt(i, M);
      M.compose(P.set(c?.x ?? 0, 0.9, c?.z ?? 0), Q, S.set(show ? 1.36 : 0, show ? 0.25 : 0, show ? 0.86 : 0));
      lid.current.setMatrixAt(i, M);
    }
    body.current.count = lid.current.count = Math.min(MAX_CHESTS, list.length);
    body.current.instanceMatrix.needsUpdate = true;
    lid.current.instanceMatrix.needsUpdate = true;
    body.current.computeBoundingSphere();
    lid.current.computeBoundingSphere();
  });

  return (
    <group>
      <instancedMesh ref={body} args={[undefined, undefined, MAX_CHESTS]} castShadow frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#c98a1b" emissive="#ffb300" emissiveIntensity={0.4} metalness={0.4} roughness={0.4} />
      </instancedMesh>
      <instancedMesh ref={lid} args={[undefined, undefined, MAX_CHESTS]} frustumCulled={false}>
        <boxGeometry />
        <meshStandardMaterial color="#ffd54a" emissive="#ffcc33" emissiveIntensity={0.5} metalness={0.5} roughness={0.3} />
      </instancedMesh>
    </group>
  );
}
