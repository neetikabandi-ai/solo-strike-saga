import * as THREE from "three";

export type Box = {
  x: number;
  z: number;
  w: number;
  d: number;
  /** height of the box */
  h: number;
  /** base elevation (0 = ground) */
  y0: number;
  kind: "building" | "wall" | "rock" | "floor" | "step" | "tower";
  color: string;
  g: number;
};

/** Visual-only neon trim. */
export type Neon = { x: number; y: number; z: number; w: number; h: number; d: number; color: string };
export type Lamp = { x: number; z: number };

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

const FACADES = ["#1b1f2e", "#232838", "#1a2230", "#2a2436", "#202a2e", "#2b2b33"];
const NEONS = ["#22d3ee", "#f0abfc", "#e879f9", "#facc15", "#34d399", "#fb7185", "#60a5fa"];
export const FLOOR_H = 4;

function hitsBoxes(boxes: Box[], x: number, z: number, r: number) {
  for (const b of boxes) {
    if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return true;
  }
  return false;
}

export type ChestSpot = { x: number; z: number; rot: number };
type Group = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; items: Box[] };

function build() {
  const rnd = mulberry32(20260930);
  const boxes: Box[] = [];
  const footprints: Box[] = [];
  const neon: Neon[] = [];
  const lamps: Lamp[] = [];
  const chests: ChestSpot[] = [];
  const groups: Group[] = [];
  let gi = 0;

  const add = (b: Omit<Box, "g">) => boxes.push({ ...b, g: gi });

  /** Enterable 4-5 storey building with stairs up to the roof. */
  const enterable = (x: number, z: number, W: number, D: number, floors: number, color: string, nc: string) => {
    const T = 0.4;
    const top = floors * FLOOR_H;
    const doorW = 3;
    for (let f = 0; f < floors; f++) {
      const y0 = f * FLOOR_H;
      const h = FLOOR_H - 0.3;
      // north/south walls with window gaps (door on ground floor, south side)
      for (const side of [-1, 1]) {
        const zz = z + side * (D / 2 - T / 2);
        const gap = f === 0 && side === 1 ? doorW : 2.2;
        const seg = (W - gap) / 2;
        add({ x: x - W / 2 + seg / 2, z: zz, w: seg, d: T, h, y0, kind: "building", color });
        add({ x: x + W / 2 - seg / 2, z: zz, w: seg, d: T, h, y0, kind: "building", color });
        if (f > 0 || side === -1) {
          // window: parapet below + lintel above
          add({ x, z: zz, w: gap, d: T, h: 1, y0, kind: "building", color });
          add({ x, z: zz, w: gap, d: T, h: 0.9, y0: y0 + h - 0.9, kind: "building", color });
        } else add({ x, z: zz, w: gap, d: T, h: 1.2, y0: y0 + h - 1.2, kind: "building", color });
      }
      // east/west walls with a window
      for (const side of [-1, 1]) {
        const xx = x + side * (W / 2 - T / 2);
        const seg = (D - 2.2) / 2;
        add({ x: xx, z: z - D / 2 + seg / 2, w: T, d: seg, h, y0, kind: "building", color });
        add({ x: xx, z: z + D / 2 - seg / 2, w: T, d: seg, h, y0, kind: "building", color });
        add({ x: xx, z, w: T, d: 2.2, h: 1, y0, kind: "building", color });
        add({ x: xx, z, w: T, d: 2.2, h: 0.9, y0: y0 + h - 0.9, kind: "building", color });
      }
    }
    // stairs: flight f climbs from floor f-1 to floor f, alternating strips
    const sw = 2.6;
    const rise = 0.3;
    const steps = Math.round(FLOOR_H / rise);
    const run = 0.45;
    const len = steps * run;
    const zStart = z - D / 2 + T + 1.2;
    for (let f = 1; f <= floors; f++) {
      const east = f % 2 === 1;
      const sx = east ? x + W / 2 - T - sw / 2 : x - W / 2 + T + sw / 2;
      const base = (f - 1) * FLOOR_H;
      for (let s = 0; s < steps; s++) {
        const stepTop = (s + 1) * (FLOOR_H / steps);
        add({ x: sx, z: zStart + s * run + run / 2, w: sw, d: run, h: 0.3, y0: base + stepTop - 0.3, kind: "step", color: "#3a3f52" });
      }
      // slab at floor f with a hole over this flight
      const y0 = f * FLOOR_H - 0.3;
      const holeZ0 = zStart - 0.2;
      const holeZ1 = zStart + len + 0.2;
      const inX0 = x - W / 2 + T;
      const inX1 = x + W / 2 - T;
      const hx0 = east ? inX1 - sw : inX0;
      const hx1 = east ? inX1 : inX0 + sw;
      const inZ0 = z - D / 2 + T;
      const inZ1 = z + D / 2 - T;
      const c = f === floors ? "#2e3346" : "#34384a";
      // part excluding strip
      const ox0 = east ? inX0 : hx1;
      const ox1 = east ? hx0 : inX1;
      add({ x: (ox0 + ox1) / 2, z: (inZ0 + inZ1) / 2, w: ox1 - ox0, d: inZ1 - inZ0, h: 0.3, y0, kind: "floor", color: c });
      // strip before and after hole
      if (holeZ0 > inZ0) add({ x: (hx0 + hx1) / 2, z: (inZ0 + holeZ0) / 2, w: hx1 - hx0, d: holeZ0 - inZ0, h: 0.3, y0, kind: "floor", color: c });
      add({ x: (hx0 + hx1) / 2, z: (holeZ1 + inZ1) / 2, w: hx1 - hx0, d: inZ1 - holeZ1, h: 0.3, y0, kind: "floor", color: c });
    }
    // roof parapet
    for (const side of [-1, 1]) {
      add({ x, z: z + side * (D / 2 - T / 2), w: W, d: T, h: 1, y0: top, kind: "building", color });
      add({ x: x + side * (W / 2 - T / 2), z, w: T, d: D, h: 1, y0: top, kind: "building", color });
    }
    // neon trims: roof edge + floor bands + corner strips
    neon.push({ x, y: top + 1.05, z: z + D / 2, w: W + 0.1, h: 0.15, d: 0.1, color: nc });
    neon.push({ x, y: top + 1.05, z: z - D / 2, w: W + 0.1, h: 0.15, d: 0.1, color: nc });
    neon.push({ x: x + W / 2, y: top + 1.05, z, w: 0.1, h: 0.15, d: D + 0.1, color: nc });
    neon.push({ x: x - W / 2, y: top + 1.05, z, w: 0.1, h: 0.15, d: D + 0.1, color: nc });
    for (let f = 1; f < floors; f++) neon.push({ x, y: f * FLOOR_H - 0.15, z: z + D / 2 + 0.03, w: W, h: 0.08, d: 0.06, color: nc });
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
      neon.push({ x: x + cx * (W / 2 + 0.03), y: top / 2, z: z + cz * (D / 2 + 0.03), w: 0.12, h: top, d: 0.12, color: nc });
    // sign above the door
    neon.push({ x, y: 3.2, z: z + D / 2 + 0.1, w: 4, h: 0.6, d: 0.1, color: NEONS[Math.floor(rnd() * NEONS.length)]! });
  };

  /** Solid skyscraper (not enterable), window texture + neon crown. */
  const tower = (x: number, z: number, W: number, D: number, H: number, color: string, nc: string) => {
    add({ x, z, w: W, d: D, h: H, y0: 0, kind: "tower", color });
    neon.push({ x, y: H + 0.2, z, w: W + 0.3, h: 0.4, d: D + 0.3, color: nc });
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
      neon.push({ x: x + cx * (W / 2 + 0.05), y: H / 2, z: z + cz * (D / 2 + 0.05), w: 0.25, h: H, d: 0.25, color: nc });
    neon.push({ x, y: H * 0.7, z: z + D / 2 + 0.1, w: W * 0.6, h: 2, d: 0.1, color: NEONS[Math.floor(rnd() * NEONS.length)]! });
  };

  const closeGroup = (x: number, z: number, W: number, D: number) => {
    const items = boxes.filter((b) => b.g === gi);
    groups.push({ minX: x - W / 2 - 0.5, maxX: x + W / 2 + 0.5, minZ: z - D / 2 - 0.5, maxZ: z + D / 2 + 0.5, top: Math.max(...items.map((b) => b.y0 + b.h)), items });
    gi++;
  };

  for (const poi of POIS) {
    const big = !!poi.big;
    const grid = big ? 6 : 3;
    const cell = 34;
    for (let gx = 0; gx < grid; gx++)
      for (let gz = 0; gz < grid; gz++) {
        if (rnd() < 0.15) continue;
        const x = poi.x + (gx - (grid - 1) / 2) * cell + (rnd() - 0.5) * 3;
        const z = poi.z + (gz - (grid - 1) / 2) * cell + (rnd() - 0.5) * 3;
        const color = FACADES[Math.floor(rnd() * FACADES.length)]!;
        const nc = NEONS[Math.floor(rnd() * NEONS.length)]!;
        const central = big && gx > 0 && gx < grid - 1 && gz > 0 && gz < grid - 1;
        const isTower = central ? rnd() < 0.55 : rnd() < 0.12;
        let W: number, D: number;
        if (isTower) {
          W = 12 + rnd() * 10;
          D = 12 + rnd() * 10;
          tower(x, z, W, D, (central ? 45 : 25) + rnd() * (central ? 60 : 25), color, nc);
        } else {
          W = 16 + Math.floor(rnd() * 4) * 2;
          D = 16 + Math.floor(rnd() * 3) * 2;
          enterable(x, z, W, D, 4 + (rnd() > 0.5 ? 1 : 0), color, nc);
          chests.push({ x: x + (rnd() - 0.5) * 4, z: z + 2, rot: 0 });
        }
        footprints.push({ x, z, w: W, d: D, h: 1, y0: 0, kind: "building", color, g: gi });
        closeGroup(x, z, W, D);
        // chests on the sidewalk + street lamps at the corners
        chests.push({ x: x + W / 2 + 2.5, z: z + (rnd() - 0.5) * D * 0.6, rot: Math.PI / 2 });
        lamps.push({ x: x + W / 2 + 4, z: z + D / 2 + 4 });
        lamps.push({ x: x - W / 2 - 4, z: z - D / 2 - 4 });
      }
    // barriers
    for (let i = 0; i < 6; i++) {
      const horizontal = rnd() > 0.5;
      const x = poi.x + (rnd() - 0.5) * grid * cell * 1.1;
      const z = poi.z + (rnd() - 0.5) * grid * cell * 1.1;
      const w = horizontal ? 6 + rnd() * 6 : 1;
      const d = horizontal ? 1 : 6 + rnd() * 6;
      if (hitsBoxes(footprints, x, z, 4)) continue;
      add({ x, z, w, d, h: 1.3, y0: 0, kind: "wall", color: "#4b5160" });
      footprints.push(boxes[boxes.length - 1]!);
      closeGroup(x, z, w, d);
    }
  }

  // rocks
  for (let i = 0; i < 140; i++) {
    const r = 2 + rnd() * 4;
    const x = (rnd() - 0.5) * (MAP_SIZE - 40);
    const z = (rnd() - 0.5) * (MAP_SIZE - 40);
    if (hitsBoxes(footprints, x, z, r + 3)) continue;
    const d = r * (0.7 + rnd() * 0.6);
    add({ x, z, w: r, d, h: 1.4 + rnd() * 2, y0: 0, kind: "rock", color: "#565b66" });
    footprints.push(boxes[boxes.length - 1]!);
    closeGroup(x, z, r, d);
  }

  for (let i = 0; i < 45; i++) {
    const x = (rnd() - 0.5) * (MAP_SIZE - 60);
    const z = (rnd() - 0.5) * (MAP_SIZE - 60);
    if (hitsBoxes(footprints, x, z, 2)) continue;
    chests.push({ x, z, rot: rnd() * Math.PI });
  }

  const trees: { x: number; z: number; s: number }[] = [];
  for (let i = 0; i < 1000 && trees.length < 500; i++) {
    const x = (rnd() - 0.5) * (MAP_SIZE - 20);
    const z = (rnd() - 0.5) * (MAP_SIZE - 20);
    if (POIS.some((p) => Math.hypot(p.x - x, p.z - z) < (p.big ? 130 : 70))) continue;
    if (hitsBoxes(footprints, x, z, 2)) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.9 });
  }

  return { boxes, footprints, groups, neon, lamps, chests, trees };
}

const WORLD = build();
export const OBSTACLES: Box[] = WORLD.boxes;
export const NEON: Neon[] = WORLD.neon;
export const LAMPS: Lamp[] = WORLD.lamps;
export const TREES = WORLD.trees;
const GROUPS = WORLD.groups;

// spatial hash for fast collision lookups
const CELL = 24;
const GRID = new Map<number, Box[]>();
const key = (cx: number, cz: number) => cx * 100003 + cz;
for (const b of OBSTACLES) {
  const x0 = Math.floor((b.x - b.w / 2) / CELL), x1 = Math.floor((b.x + b.w / 2) / CELL);
  const z0 = Math.floor((b.z - b.d / 2) / CELL), z1 = Math.floor((b.z + b.d / 2) / CELL);
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) {
      const k = key(cx, cz);
      let arr = GRID.get(k);
      if (!arr) GRID.set(k, (arr = []));
      arr.push(b);
    }
}
function near(x: number, z: number, r: number, fn: (b: Box) => boolean | void) {
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
  for (let cx = x0; cx <= x1; cx++)
    for (let cz = z0; cz <= z1; cz++) {
      const arr = GRID.get(key(cx, cz));
      if (arr) for (const b of arr) if (fn(b)) return true;
    }
  return false;
}

export const STEP = 0.65;

/** Blocks if a box overlaps the body column [y+STEP, y+1.8]. */
export function collides(x: number, z: number, radius: number, y = 0): boolean {
  return near(x, z, radius, (b) =>
    Math.abs(x - b.x) < b.w / 2 + radius &&
    Math.abs(z - b.z) < b.d / 2 + radius &&
    b.y0 + b.h > y + STEP &&
    b.y0 < y + 1.8,
  );
}

/** Highest walkable surface at or below `y + STEP`. */
export function groundAt(x: number, z: number, y: number, radius = 0.3): number {
  let g = 0;
  near(x, z, radius, (b) => {
    if (Math.abs(x - b.x) < b.w / 2 + radius * 0.5 && Math.abs(z - b.z) < b.d / 2 + radius * 0.5) {
      const t = b.y0 + b.h;
      if (t <= y + STEP && t > g) g = t;
    }
  });
  return g;
}

export const CHEST_SPOTS: ChestSpot[] = WORLD.chests.filter((c) => !collides(c.x, c.z, 0.9));

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
export function moveWithCollision(pos: THREE.Vector3, dx: number, dz: number, radius = 0.6, y = 0) {
  if (dx !== 0 && !collides(pos.x + dx, pos.z, radius, y)) pos.x += dx;
  if (dz !== 0 && !collides(pos.x, pos.z + dz, radius, y)) pos.z += dz;
  pos.x = clampMap(pos.x);
  pos.z = clampMap(pos.z);
}

/** Ray vs axis-aligned boxes — used for bullets and line of sight. */
function rayBox(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number, minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number) {
  let t0 = 0;
  let t1 = maxDist;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const mn = [minX, minY, minZ];
  const mx = [maxX, maxY, maxZ];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]!) < 1e-6) {
      if (o[i]! < mn[i]! || o[i]! > mx[i]!) return false;
    } else {
      let ta = (mn[i]! - o[i]!) / d[i]!;
      let tb = (mx[i]! - o[i]!) / d[i]!;
      if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta);
      t1 = Math.min(t1, tb);
      if (t0 > t1) return false;
    }
  }
  return t1 >= 0 && t0 <= maxDist;
}

/** Ray vs boxes (broadphase per building) — bullets and line of sight. */
export function rayBlocked(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): boolean {
  for (const g of GROUPS) {
    if (!rayBox(origin, dir, maxDist, g.minX, g.maxX, 0, g.top, g.minZ, g.maxZ)) continue;
    for (const b of g.items) {
      if (rayBox(origin, dir, maxDist, b.x - b.w / 2, b.x + b.w / 2, b.y0, b.y0 + b.h, b.z - b.d / 2, b.z + b.d / 2)) return true;
    }
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
