import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { runtime } from "../lib/runtime";
import { LAMPS, MAP_SIZE, NEON, OBSTACLES, TREES } from "../lib/world";
import { makeConcreteTexture, makeGroundTexture, makeWindowTexture } from "../lib/textures";

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
        <meshStandardMaterial map={tex} color="#9aa0b4" roughness={0.55} metalness={0.2} />
      </mesh>
      {/* sea around the island */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.6}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#0b1330" roughness={0.15} metalness={0.6} />
      </mesh>
    </group>
  );
}

export function Structures() {
  const concrete = useMemo(() => makeConcreteTexture(), []);
  const windows = useMemo(() => makeWindowTexture(), []);
  useEffect(() => () => { concrete.dispose(); windows.dispose(); }, [concrete, windows]);
  const solids = useMemo(() => OBSTACLES.filter((b) => b.kind !== "rock" && b.kind !== "tower"), []);
  const towers = useMemo(() => OBSTACLES.filter((b) => b.kind === "tower"), []);
  const rocks = useMemo(() => OBSTACLES.filter((b) => b.kind === "rock"), []);
  const solidRef = useRef<THREE.InstancedMesh>(null);
  const towerRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const neonRef = useRef<THREE.InstancedMesh>(null);
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const bulbRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    solids.forEach((b, i) => {
      M.compose(P.set(b.x, b.y0 + b.h / 2, b.z), Q.identity(), S.set(b.w, b.h, b.d));
      solidRef.current?.setMatrixAt(i, M);
      solidRef.current?.setColorAt(i, C.set(b.color));
    });
    towers.forEach((b, i) => {
      M.compose(P.set(b.x, b.y0 + b.h / 2, b.z), Q.identity(), S.set(b.w, b.h, b.d));
      towerRef.current?.setMatrixAt(i, M);
      towerRef.current?.setColorAt(i, C.set(b.color).offsetHSL(0, 0, 0.1));
    });
    rocks.forEach((b, i) => {
      M.compose(P.set(b.x, b.h * 0.35, b.z), Q.setFromAxisAngle(UP, i), S.set(b.w * 0.6, b.h * 0.7, b.d * 0.6));
      rockRef.current?.setMatrixAt(i, M);
    });
    NEON.forEach((n, i) => {
      M.compose(P.set(n.x, n.y, n.z), Q.identity(), S.set(n.w, n.h, n.d));
      neonRef.current?.setMatrixAt(i, M);
      neonRef.current?.setColorAt(i, C.set(n.color).multiplyScalar(2.2));
    });
    LAMPS.forEach((l, i) => {
      M.compose(P.set(l.x, 3.5, l.z), Q.identity(), S.set(1, 1, 1));
      lampRef.current?.setMatrixAt(i, M);
      M.compose(P.set(l.x, 7.1, l.z), Q.identity(), S.set(1, 1, 1));
      bulbRef.current?.setMatrixAt(i, M);
    });
    for (const r of [solidRef, towerRef, rockRef, neonRef, lampRef, bulbRef]) {
      if (!r.current) continue;
      r.current.instanceMatrix.needsUpdate = true;
      if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true;
      r.current.computeBoundingSphere();
    }
  }, [solids, towers, rocks]);

  return (
    <group>
      <instancedMesh ref={solidRef} args={[undefined, undefined, solids.length]} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial map={concrete} roughness={0.8} />
      </instancedMesh>
      <instancedMesh ref={towerRef} args={[undefined, undefined, towers.length]} castShadow receiveShadow>
        <boxGeometry />
        <meshStandardMaterial map={windows} emissiveMap={windows} emissive="#ffd9a0" emissiveIntensity={0.9} roughness={0.4} metalness={0.4} />
      </instancedMesh>
      <instancedMesh ref={neonRef} args={[undefined, undefined, NEON.length]}>
        <boxGeometry />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={lampRef} args={[undefined, undefined, LAMPS.length]}>
        <cylinderGeometry args={[0.08, 0.12, 7, 6]} />
        <meshStandardMaterial color="#222733" />
      </instancedMesh>
      <instancedMesh ref={bulbRef} args={[undefined, undefined, LAMPS.length]}>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color={[3, 2.4, 1.6]} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rockRef} args={[undefined, undefined, rocks.length]} castShadow receiveShadow>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#565b66" roughness={1} flatShading />
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
      leaves.current?.setColorAt(i, C.set(i % 3 === 0 ? "#1f4d3a" : i % 3 === 1 ? "#24583f" : "#173d33"));
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

const MAX_CHESTS = 3200;

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
      M.compose(P.set(c?.x ?? 0, (c?.y ?? 0) + 0.4, c?.z ?? 0), Q, S.set(show ? 1.3 : 0, show ? 0.8 : 0, show ? 0.8 : 0));
      body.current.setMatrixAt(i, M);
      M.compose(P.set(c?.x ?? 0, (c?.y ?? 0) + 0.9, c?.z ?? 0), Q, S.set(show ? 1.36 : 0, show ? 0.25 : 0, show ? 0.86 : 0));
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
