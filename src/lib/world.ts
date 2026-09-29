import * as THREE from "three";

export type Box = {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  kind: "building" | "wall" | "rock";
  color: string;
};

export const MAP_SIZE = 1500;
export const MAP_HALF = MAP_SIZE / 2;

/** Deterministic pseudo random so reloads agree. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Poi = { name: string; x: number; z: number; big?: boolean };

export const POIS: Poi[] = [
  { name: "Tilted Towers", x: 0, z: 0, big: true },
  { name: "Pleasant Park", x: -420, z: -380 },
  { name: "Retail Row", x: 430, z: -120 },
  { name: "Salty Springs", x: -150, z: 330 },
  { name: "Lazy Lagoon", x: -540, z: 200 },
  { name: "Loot Lake", x: 180, z: -460 },
  { name: "Misty Meadows", x: 470, z: 420 },
  { name: "Frenzy Farm", x: -300, z: -60 },
  { name: "Sweaty Sands", x: 110, z: 570 },
  { name: "Craggy Cliffs", x: -560, z: -600 },
  { name: "Holly Hedges", x: 600, z: -560 },
];

const BUILDING_COLORS = ["#efdcb4", "#f2a65a", "#8ecae6", "#e76f51", "#f4e285", "#b5e48c", "#cdb4db", "#ffffff"];

function hitsBoxes(boxes: Box[], x: number, z: number, r: number) {
  for (const b of boxes) {
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  }
  return false;
}

export type ChestSpot = { x: number; z: number; rot: number };

function build() {
  const rnd = mulberry32(20260928);
  const boxes: Box[] = [];
  const chests: ChestSpot[] = [];

  for (const poi of POIS) {
    const count = poi.big ? 16 : 8;
    const spread = poi.big ? 110 : 70;
    let placed = 0;
    for (let tries = 0; tries < 200 && placed < count; tries++) {
      const w = (poi.big ? 10 : 8) + rnd() * 10;
      const d = (poi.big ? 10 : 8) + rnd() * 10;
      const h = poi.big ? 10 + rnd() * 24 : 5 + rnd() * 6;
      const x = poi.x + (rnd() - 0.5) * spread;
      const z = poi.z + (rnd() - 0.5) * spread;
      if (hitsBoxes(boxes, x, z, Math.max(w, d) / 2 + 5)) continue;
      const b: Box = { x, z, w, d, h, kind: "building", color: BUILDING_COLORS[Math.floor(rnd() * BUILDING_COLORS.length)]! };
      boxes.push(b);
      placed++;
      // 1-2 chests beside each building
      const n = 1 + (rnd() > 0.5 ? 1 : 0);
      for (let c = 0; c < n; c++) {
        const side = Math.floor(rnd() * 4);
        const along = (rnd() - 0.5) * 0.7;
        const cx = side < 2 ? x + (side === 0 ? 1 : -1) * (w / 2 + 1.6) : x + along * w;
        const cz = side >= 2 ? z + (side === 2 ? 1 : -1) * (d / 2 + 1.6) : z + along * d;
        chests.push({ x: cx, z: cz, rot: side < 2 ? Math.PI / 2 : 0 });
      }
    }
    // cover walls
    for (let i = 0; i < 5; i++) {
      const horizontal = rnd() > 0.5;
      const x = poi.x + (rnd() - 0.5) * spread * 1.2;
      const z = poi.z + (rnd() - 0.5) * spread * 1.2;
      const w = horizontal ? 8 + rnd() * 8 : 1;
      const d = horizontal ? 1 : 8 + rnd() * 8;
      if (hitsBoxes(boxes, x, z, 4)) continue;
      boxes.push({ x, z, w, d, h: 1.5, kind: "wall", color: "#c9b58a" });
    }
  }

  // rocks
  for (let i = 0; i < 140; i++) {
    const r = 2 + rnd() * 4;
    const x = (rnd() - 0.5) * (MAP_SIZE - 40);
    const z = (rnd() - 0.5) * (MAP_SIZE - 40);
    if (hitsBoxes(boxes, x, z, r + 3)) continue;
    boxes.push({ x, z, w: r, d: r * (0.7 + rnd() * 0.6), h: 1.4 + rnd() * 2, kind: "rock", color: "#8a8f96" });
  }

  // chests out in the wild
  for (let i = 0; i < 45; i++) {
    const x = (rnd() - 0.5) * (MAP_SIZE - 60);
    const z = (rnd() - 0.5) * (MAP_SIZE - 60);
    if (hitsBoxes(boxes, x, z, 2)) continue;
    chests.push({ x, z, rot: rnd() * Math.PI });
  }

  // drop any chest that overlaps a structure
  const okChests = chests.filter((c) => !hitsBoxes(boxes, c.x, c.z, 0.9));

  // trees (visual only)
  const trees: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 1400 && trees.length < 900; i++) {
    const x = (rnd() - 0.5) * (MAP_SIZE - 20);
    const z = (rnd() - 0.5) * (MAP_SIZE - 20);
    if (POIS.some((p) => Math.hypot(p.x - x, p.z - z) < (p.big ? 75 : 50))) continue;
    if (hitsBoxes(boxes, x, z, 2)) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.9 });
  }

  return { boxes, chests: okChests, trees };
}

const WORLD = build();
export const OBSTACLES: Box[] = WORLD.boxes;
export const CHEST_SPOTS: ChestSpot[] = WORLD.chests;
export const TREES = WORLD.trees;

export function collides(x: number, z: number, radius: number): boolean {
  return hitsBoxes(OBSTACLES, x, z, radius);
}

/** Nearest free spot to (x, z) — used when landing from the sky. */
export function findFree(x: number, z: number, r = 0.8): { x: number; z: number } {
  if (!collides(x, z, r)) return { x, z };
  for (let rad = 2; rad < 80; rad += 2) {
    for (let a = 0; a < 16; a++) {
      const nx = x + Math.cos((a / 16) * Math.PI * 2) * rad;
      const nz = z + Math.sin((a / 16) * Math.PI * 2) * rad;
      if (!collides(nx, nz, r)) return { x: nx, z: nz };
    }
  }
  return { x, z };
}

export function clampMap(v: number) {
  return THREE.MathUtils.clamp(v, -MAP_HALF + 3, MAP_HALF - 3);
}

/** Slide-along-walls resolution, axis by axis. */
export function moveWithCollision(pos: THREE.Vector3, dx: number, dz: number, radius = 0.6) {
  if (dx !== 0 && !collides(pos.x + dx, pos.z, radius)) pos.x += dx;
  if (dz !== 0 && !collides(pos.x, pos.z + dz, radius)) pos.z += dz;
  pos.x = clampMap(pos.x);
  pos.z = clampMap(pos.z);
}

/** Ray vs axis-aligned boxes — used for bullets and line of sight. */
export function rayBlocked(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): boolean {
  for (const b of OBSTACLES) {
    const minX = b.x - b.w / 2;
    const maxX = b.x + b.w / 2;
    const minZ = b.z - b.d / 2;
    const maxZ = b.z + b.d / 2;
    let t0 = 0;
    let t1 = maxDist;
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
export function raySphere(origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number): number | null {
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

/** Launch pads: two near every named location. */
export const PADS: { x: number; z: number }[] = POIS.flatMap((p, i) =>
  [0, 1].map((k) => {
    const a = i * 1.7 + k * Math.PI;
    return findFree(clampMap(p.x + Math.cos(a) * 55), clampMap(p.z + Math.sin(a) * 55), 2);
  }),
);

/** Vehicle parking spots: one per named location plus a few in the wild. */
export const VEHICLE_SPOTS: { x: number; z: number; yaw: number }[] = [
  ...POIS.map((p, i) => ({ ...findFree(clampMap(p.x - 35), clampMap(p.z + 30 + i), 2.2), yaw: i })),
  ...[[-300, 300], [300, -300], [0, -500], [500, 200], [-500, -150]].map(([x, z], i) => ({ ...findFree(x!, z!, 2.2), yaw: i * 2 })),
];
