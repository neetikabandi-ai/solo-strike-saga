import * as THREE from "three";

export type Box = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: "building" | "wall" | "crate" | "rock";
  rot?: number;
};

export const MAP_SIZE = 220;
export const MAP_HALF = MAP_SIZE / 2;

/** Deterministic pseudo random so server/client and reloads agree. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildObstacles(): Box[] {
  const rnd = mulberry32(20260926);
  const boxes: Box[] = [];

  // Compounds: clusters of blocky buildings scattered over the map.
  const compounds = [
    [0, -40],
    [55, 20],
    [-60, 35],
    [40, -75],
    [-45, -60],
    [70, 75],
    [-80, 85],
    [10, 70],
  ];

  for (const [cx, cz] of compounds as [number, number][]) {
    const count = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < count; i++) {
      const w = 8 + rnd() * 14;
      const d = 8 + rnd() * 14;
      const h = 4 + rnd() * 7;
      boxes.push({
        x: cx + (rnd() - 0.5) * 34,
        z: cz + (rnd() - 0.5) * 34,
        w,
        d,
        h,
        kind: "building",
      });
    }
    // Low walls for cover
    for (let i = 0; i < 3; i++) {
      const horizontal = rnd() > 0.5;
      boxes.push({
        x: cx + (rnd() - 0.5) * 40,
        z: cz + (rnd() - 0.5) * 40,
        w: horizontal ? 10 + rnd() * 8 : 1.2,
        d: horizontal ? 1.2 : 10 + rnd() * 8,
        h: 1.6,
        kind: "wall",
      });
    }
  }

  // Rocks in the open field
  for (let i = 0; i < 26; i++) {
    const r = 2 + rnd() * 3;
    boxes.push({
      x: (rnd() - 0.5) * (MAP_SIZE - 30),
      z: (rnd() - 0.5) * (MAP_SIZE - 30),
      w: r,
      d: r * (0.7 + rnd() * 0.6),
      h: 1.4 + rnd() * 1.6,
      kind: "rock",
      rot: rnd() * Math.PI,
    });
  }

  // Supply crates
  for (let i = 0; i < 30; i++) {
    boxes.push({
      x: (rnd() - 0.5) * (MAP_SIZE - 40),
      z: (rnd() - 0.5) * (MAP_SIZE - 40),
      w: 1.8,
      d: 1.8,
      h: 1.8,
      kind: "crate",
      rot: rnd() * Math.PI,
    });
  }

  return boxes;
}

export const OBSTACLES: Box[] = buildObstacles();

/** Trees / bushes are visual only (no collision) to keep movement readable. */
export const FOLIAGE = (() => {
  const rnd = mulberry32(77123);
  const items: { x: number; z: number; s: number; kind: 0 | 1 }[] = [];
  for (let i = 0; i < 170; i++) {
    items.push({
      x: (rnd() - 0.5) * (MAP_SIZE - 10),
      z: (rnd() - 0.5) * (MAP_SIZE - 10),
      s: 0.7 + rnd() * 1.1,
      kind: rnd() > 0.45 ? 1 : 0,
    });
  }
  return items;
})();

export function spawnPoints(count: number): { x: number; z: number }[] {
  const rnd = mulberry32(5150);
  const pts: { x: number; z: number }[] = [];
  while (pts.length < count) {
    const x = (rnd() - 0.5) * (MAP_SIZE - 40);
    const z = (rnd() - 0.5) * (MAP_SIZE - 40);
    if (!collides(x, z, 1.2)) pts.push({ x, z });
  }
  return pts;
}

export function collides(x: number, z: number, radius: number): boolean {
  for (const b of OBSTACLES) {
    const hx = b.w / 2 + radius;
    const hz = b.d / 2 + radius;
    if (Math.abs(x - b.x) < hx && Math.abs(z - b.z) < hz) return true;
  }
  return false;
}

/** Slide-along-walls resolution, axis by axis. */
export function moveWithCollision(
  pos: THREE.Vector3,
  dx: number,
  dz: number,
  radius = 0.6
) {
  if (dx !== 0 && !collides(pos.x + dx, pos.z, radius)) pos.x += dx;
  if (dz !== 0 && !collides(pos.x, pos.z + dz, radius)) pos.z += dz;
  pos.x = THREE.MathUtils.clamp(pos.x, -MAP_HALF + 3, MAP_HALF - 3);
  pos.z = THREE.MathUtils.clamp(pos.z, -MAP_HALF + 3, MAP_HALF - 3);
}

/** Ray vs axis-aligned boxes — used for bullets and enemy line of sight. */
export function rayBlocked(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number
): boolean {
  for (const b of OBSTACLES) {
    const minX = b.x - b.w / 2;
    const maxX = b.x + b.w / 2;
    const minZ = b.z - b.d / 2;
    const maxZ = b.z + b.d / 2;
    let t0 = 0;
    let t1 = maxDist;

    // X slab
    if (Math.abs(dir.x) < 1e-6) {
      if (origin.x < minX || origin.x > maxX) continue;
    } else {
      let ta = (minX - origin.x) / dir.x;
      let tb = (maxX - origin.x) / dir.x;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // Y slab (ground to height)
    if (Math.abs(dir.y) < 1e-6) {
      if (origin.y < 0 || origin.y > b.h) continue;
    } else {
      let ta = (0 - origin.y) / dir.y;
      let tb = (b.h - origin.y) / dir.y;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }
    // Z slab
    if (Math.abs(dir.z) < 1e-6) {
      if (origin.z < minZ || origin.z > maxZ) continue;
    } else {
      let ta = (minZ - origin.z) / dir.z;
      let tb = (maxZ - origin.z) / dir.z;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) continue;
    }

    if (t1 >= 0 && t0 <= maxDist) return true;
  }
  return false;
}

/** Distance along the ray where it hits a sphere, or null. */
export function raySphere(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  center: THREE.Vector3,
  radius: number
): number | null {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  return t >= 0 ? t : null;
}
