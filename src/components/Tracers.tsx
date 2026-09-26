import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { runtime } from "../lib/runtime";

const MAX = 48;

/** Cheap bullet tracers: one line-segment buffer reused every frame. */
export function Tracers() {
  const ref = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(MAX * 6), []);
  const colors = useMemo(() => new Float32Array(MAX * 6), []);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const list = runtime.tracers;
    for (let i = list.length - 1; i >= 0; i--) {
      list[i].life -= dt;
      if (list[i].life <= 0) list.splice(i, 1);
    }

    let n = 0;
    for (const t of list) {
      if (n >= MAX) break;
      const o = n * 6;
      positions[o] = t.from.x;
      positions[o + 1] = t.from.y;
      positions[o + 2] = t.from.z;
      positions[o + 3] = t.to.x;
      positions[o + 4] = t.to.y;
      positions[o + 5] = t.to.z;
      const r = t.hostile ? 1 : 1;
      const g = t.hostile ? 0.35 : 0.85;
      const b = t.hostile ? 0.15 : 0.4;
      for (let v = 0; v < 2; v++) {
        colors[o + v * 3] = r;
        colors[o + v * 3 + 1] = g;
        colors[o + v * 3 + 2] = b;
      }
      n++;
    }
    geometry.setDrawRange(0, n * 2);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;
  });

  return (
    <lineSegments ref={ref} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0.9} />
    </lineSegments>
  );
}
