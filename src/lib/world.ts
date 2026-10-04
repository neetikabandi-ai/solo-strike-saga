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

/** City grid: blocks every 48m, 12m streets between them. */
export const CELL_W = 48;
const GRID_N = 15;
/** Elevated maglev loop runs along these street lines. */
export const LOOP = 456;
export const TRAIN_Y = 18;

export const POIS: Poi[] = [
  { name: "Laser Tag Arena", x: 0, z: 0, big: true },
  { name: "Neon Central Station", x: -470, z: 0 },
  { name: "Skyport", x: 600, z: -480 },
  { name: "Arcade District", x: 600, z: 510 },
  { name: "Infinity Heights", x: -300, z: -300 },
  { name: "Lantern Row", x: 260, z: -200 },
  { name: "Mirror Maze", x: -220, z: 320 },
  { name: "Undercity", x: 220, z: 260 },
  { name: "Pagoda Stacks", x: -600, z: -560 },
  { name: "Glitch Gardens", x: -600, z: 560 },
  { name: "Circuit Yard", x: 0, z: -600 },
  { name: "Rain Docks", x: 0, z: 620 },
];

const FACADES = ["#1b1f2e", "#232838", "#1a2230", "#2a2436", "#202a2e", "#2b2b33"];
const NEONS = ["#22d3ee", "#f0abfc", "#e879f9", "#facc15", "#34d399", "#fb7185", "#60a5fa"];
export const FLOOR_H = 4;

export type ChestSpot = { x: number; z: number; y: number; rot: number };
type Group = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; items: Box[] };

const inRect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
/** Areas reserved for landmarks — no generic blocks there. */
function landmark(x: number, z: number) {
  return (
    inRect(x, z, -72, 72, -72, 72) || // laser tag
    inRect(x, z, -540, -420, -130, 130) || // station
    inRect(x, z, 470, 760, -760, -230) || // airport
    inRect(x, z, 470, 760, 290, 760) // arcade
  );
}

function build() {
  const rnd = mulberry32(20261001);
  const boxes: Box[] = [];
  const neon: Neon[] = [];
  const lamps: Lamp[] = [];
  const chests: ChestSpot[] = [];
  const groups: Group[] = [];
  let gi = 0;
  let gStart = 0;
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

  const add = (b: Omit<Box, "g">) => boxes.push({ ...b, g: gi });
  const closeGroup = () => {
    const items = boxes.slice(gStart);
    gStart = boxes.length;
    if (!items.length) return;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, top = 0;
    for (const b of items) {
      minX = Math.min(minX, b.x - b.w / 2);
      maxX = Math.max(maxX, b.x + b.w / 2);
      minZ = Math.min(minZ, b.z - b.d / 2);
      maxZ = Math.max(maxZ, b.z + b.d / 2);
      top = Math.max(top, b.y0 + b.h);
    }
    groups.push({ minX: minX - 0.2, maxX: maxX + 0.2, minZ: minZ - 0.2, maxZ: maxZ + 0.2, top, items });
    gi++;
  };

  /** Open stair flight descending from (x,z) at `top` along (dx,dz) down to `base`. */
  const stairs = (x: number, z: number, dx: number, dz: number, top: number, base: number, sw = 2.6) => {
    const rise = 0.3, run = 0.45;
    for (let s = 0; ; s++) {
      const t = top - (s + 1) * rise;
      if (t <= base + 0.01) break;
      const cx = x + dx * (s + 0.5) * run;
      const cz = z + dz * (s + 0.5) * run;
      add({ x: cx, z: cz, w: dx ? run : sw, d: dz ? run : sw, h: 0.3, y0: t - 0.3, kind: "step", color: "#3a3f52" });
    }
  };

  /** Walkable slab whose top surface is at `top`, with neon edges. */
  const deck = (x: number, z: number, w: number, d: number, top: number, nc: string) => {
    add({ x, z, w, d, h: 0.4, y0: top - 0.4, kind: "floor", color: "#2a2f40" });
    neon.push({ x, y: top - 0.45, z: z + d / 2, w, h: 0.1, d: 0.1, color: nc });
    neon.push({ x, y: top - 0.45, z: z - d / 2, w, h: 0.1, d: 0.1, color: nc });
    neon.push({ x: x + w / 2, y: top - 0.45, z, w: 0.1, h: 0.1, d, color: nc });
    neon.push({ x: x - w / 2, y: top - 0.45, z, w: 0.1, h: 0.1, d, color: nc });
  };

  /** Open bridge with low neon guardrails. Axis-aligned between two points. */
  const bridge = (x0: number, z0: number, x1: number, z1: number, top: number, nc: string, bw = 3) => {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    const w = alongX ? len : bw, d = alongX ? bw : len;
    add({ x: cx, z: cz, w, d, h: 0.35, y0: top - 0.35, kind: "floor", color: "#252a3a" });
    for (const s of [-1, 1]) {
      const rx = alongX ? cx : cx + s * (bw / 2 - 0.05);
      const rz = alongX ? cz + s * (bw / 2 - 0.05) : cz;
      add({ x: rx, z: rz, w: alongX ? len : 0.1, d: alongX ? 0.1 : len, h: 0.9, y0: top, kind: "wall", color: "#151822" });
      neon.push({ x: rx, y: top + 0.95, z: rz, w: alongX ? len : 0.12, h: 0.08, d: alongX ? 0.12 : len, color: nc });
    }
  };

  /** Enterable building with stairs up to the roof. Roof parapets have gaps for bridges. */
  const enterable = (x: number, z: number, W: number, D: number, floors: number, color: string, nc: string) => {
    const T = 0.4;
    const top = floors * FLOOR_H;
    const doorW = 3;
    for (let f = 0; f < floors; f++) {
      const y0 = f * FLOOR_H;
      const h = FLOOR_H - 0.3;
      for (const side of [-1, 1]) {
        const zz = z + side * (D / 2 - T / 2);
        const gap = f === 0 ? doorW : 2.2;
        const seg = (W - gap) / 2;
        add({ x: x - W / 2 + seg / 2, z: zz, w: seg, d: T, h, y0, kind: "building", color });
        add({ x: x + W / 2 - seg / 2, z: zz, w: seg, d: T, h, y0, kind: "building", color });
        if (f > 0) {
          add({ x, z: zz, w: gap, d: T, h: 1, y0, kind: "building", color });
          add({ x, z: zz, w: gap, d: T, h: 0.9, y0: y0 + h - 0.9, kind: "building", color });
        } else add({ x, z: zz, w: gap, d: T, h: 1.2, y0: y0 + h - 1.2, kind: "building", color });
      }
      for (const side of [-1, 1]) {
        const xx = x + side * (W / 2 - T / 2);
        const seg = (D - 2.2) / 2;
        add({ x: xx, z: z - D / 2 + seg / 2, w: T, d: seg, h, y0, kind: "building", color });
        add({ x: xx, z: z + D / 2 - seg / 2, w: T, d: seg, h, y0, kind: "building", color });
        add({ x: xx, z, w: T, d: 2.2, h: 1, y0, kind: "building", color });
        add({ x: xx, z, w: T, d: 2.2, h: 0.9, y0: y0 + h - 0.9, kind: "building", color });
      }
    }
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
      const ox0 = east ? inX0 : hx1;
      const ox1 = east ? hx0 : inX1;
      add({ x: (ox0 + ox1) / 2, z: (inZ0 + inZ1) / 2, w: ox1 - ox0, d: inZ1 - inZ0, h: 0.3, y0, kind: "floor", color: c });
      if (holeZ0 > inZ0) add({ x: (hx0 + hx1) / 2, z: (inZ0 + holeZ0) / 2, w: hx1 - hx0, d: holeZ0 - inZ0, h: 0.3, y0, kind: "floor", color: c });
      add({ x: (hx0 + hx1) / 2, z: (holeZ1 + inZ1) / 2, w: hx1 - hx0, d: inZ1 - holeZ1, h: 0.3, y0, kind: "floor", color: c });
      // loot on upper floors
      if (f < floors && rnd() < 0.5) chests.push({ x: (ox0 + ox1) / 2, z: z + D / 4, y: f * FLOOR_H, rot: 0 });
    }
    // roof parapet with a 2.6m gap in the middle of every side (bridge access)
    const g = 1.3;
    for (const side of [-1, 1]) {
      const zz = z + side * (D / 2 - T / 2);
      const xx = x + side * (W / 2 - T / 2);
      const sx = (W / 2 - g) / 1;
      const sz = (D / 2 - g) / 1;
      add({ x: x - g - sx / 2, z: zz, w: sx, d: T, h: 1, y0: top, kind: "building", color });
      add({ x: x + g + sx / 2, z: zz, w: sx, d: T, h: 1, y0: top, kind: "building", color });
      add({ x: xx, z: z - g - sz / 2, w: T, d: sz, h: 1, y0: top, kind: "building", color });
      add({ x: xx, z: z + g + sz / 2, w: T, d: sz, h: 1, y0: top, kind: "building", color });
    }
    chests.push({ x: x - W / 4, z: z - D / 4, y: top, rot: 0.5 });
    chests.push({ x: x + 1, z: z, y: 0, rot: 0 });
    neon.push({ x, y: top + 1.05, z: z + D / 2, w: W + 0.1, h: 0.15, d: 0.1, color: nc });
    neon.push({ x, y: top + 1.05, z: z - D / 2, w: W + 0.1, h: 0.15, d: 0.1, color: nc });
    neon.push({ x: x + W / 2, y: top + 1.05, z, w: 0.1, h: 0.15, d: D + 0.1, color: nc });
    neon.push({ x: x - W / 2, y: top + 1.05, z, w: 0.1, h: 0.15, d: D + 0.1, color: nc });
    for (let f = 1; f < floors; f++) neon.push({ x, y: f * FLOOR_H - 0.15, z: z + D / 2 + 0.03, w: W, h: 0.08, d: 0.06, color: nc });
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
      neon.push({ x: x + cx * (W / 2 + 0.03), y: top / 2, z: z + cz * (D / 2 + 0.03), w: 0.12, h: top, d: 0.12, color: nc });
    neon.push({ x, y: 3.2, z: z + D / 2 + 0.1, w: 4, h: 0.6, d: 0.1, color: pick(NEONS) });
  };

  const tower = (x: number, z: number, W: number, D: number, H: number, color: string, nc: string) => {
    add({ x, z, w: W, d: D, h: H, y0: 0, kind: "tower", color });
    neon.push({ x, y: H + 0.2, z, w: W + 0.3, h: 0.4, d: D + 0.3, color: nc });
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const)
      neon.push({ x: x + cx * (W / 2 + 0.05), y: H / 2, z: z + cz * (D / 2 + 0.05), w: 0.25, h: H, d: 0.25, color: nc });
    neon.push({ x, y: H * 0.7, z: z + D / 2 + 0.1, w: W * 0.6, h: 2, d: 0.1, color: pick(NEONS) });
    chests.push({ x, z, y: H, rot: 0 });
  };

  /** Floating stacked rooms linked by stair flights — the Infinity Castle maze. */
  const labyrinth = (x: number, z: number, levels: number, nc: string) => {
    let px = x, pz = z;
    const S = 9;
    const len = Math.round(4 / 0.3) * 0.45;
    let dirIdx = Math.floor(rnd() * 4);
    for (let k = 1; k <= levels; k++) {
      const top = k * 4;
      if (k === 1) {
        deck(px, pz, S, S, top, nc);
        const [dx, dz] = ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)[dirIdx]!;
        stairs(px + dx * S / 2, pz + dz * S / 2, dx, dz, top, 0);
      } else {
        dirIdx = (dirIdx + (rnd() < 0.5 ? 1 : 3)) % 4;
        const [dx, dz] = ([[1, 0], [0, 1], [-1, 0], [0, -1]] as const)[dirIdx]!;
        const nx = px + dx * (S + len), nz = pz + dz * (S + len);
        deck(nx, nz, S, S, top, nc);
        // stair descends from new deck back to previous one
        stairs(nx - dx * S / 2, nz - dz * S / 2, -dx, -dz, top, top - 4);
        px = nx;
        pz = nz;
      }
      if (rnd() < 0.6) chests.push({ x: px + 2, z: pz, y: top, rot: rnd() * 3 });
      // floating neon "lantern" pillars underneath
      neon.push({ x: px, y: top - 2, z: pz, w: 0.3, h: 3.6, d: 0.3, color: nc });
    }
  };

  // ---------------- city blocks ----------------
  type Cell = { ent: boolean; floors: number; x: number; z: number; W: number; D: number };
  const cells = new Map<string, Cell>();
  for (let i = -GRID_N; i <= GRID_N; i++)
    for (let j = -GRID_N; j <= GRID_N; j++) {
      const bx = i * CELL_W, bz = j * CELL_W;
      if (landmark(bx, bz)) continue;
      const color = pick(FACADES);
      const nc = pick(NEONS);
      const r = rnd();
      const central = Math.hypot(bx, bz) < 300;
      if (r < (central ? 0.3 : 0.18)) {
        // two towers per block
        for (const s of [-1, 1]) {
          const W = 12 + rnd() * 4, D = 12 + rnd() * 4;
          tower(bx + s * 8, bz - s * 8, W, D, (central ? 50 : 26) + rnd() * (central ? 70 : 40), color, nc);
          closeGroup();
        }
      } else if (r < 0.32) {
        labyrinth(bx + (rnd() - 0.5) * 6, bz + (rnd() - 0.5) * 6, 3 + Math.floor(rnd() * 3), nc);
        closeGroup();
      } else {
        const W = 22 + Math.floor(rnd() * 4) * 2;
        const D = 22 + Math.floor(rnd() * 4) * 2;
        const floors = rnd() < 0.7 ? 4 : 5;
        enterable(bx, bz, W, D, floors, color, nc);
        closeGroup();
        cells.set(`${i},${j}`, { ent: true, floors, x: bx, z: bz, W, D });
      }
      lamps.push({ x: bx + 21, z: bz + 21 });
    }
  // roof-to-roof open bridges across streets
  for (const c of cells.values()) {
    const i = c.x / CELL_W, j = c.z / CELL_W;
    for (const [di, dj] of [[1, 0], [0, 1]] as const) {
      const n = cells.get(`${i + di},${j + dj}`);
      if (!n || n.floors !== c.floors || rnd() > 0.65) continue;
      const top = c.floors * FLOOR_H;
      if (di) bridge(c.x + c.W / 2, c.z, n.x - n.W / 2, n.z, top, pick(NEONS), 2.6);
      else bridge(c.x, c.z + c.D / 2, n.x, n.z - n.D / 2, top, pick(NEONS), 2.6);
      closeGroup();
    }
  }

  // ---------------- street-level layers: decks + skywalks ----------------
  const tierA = new Set<string>();
  const tierB = new Set<string>();
  const ipos = (k: number) => (k + 0.5) * CELL_W;
  const onLoop = (v: number) => Math.abs(Math.abs(v) - LOOP) < 1;
  for (let i = -GRID_N; i < GRID_N; i++)
    for (let j = -GRID_N; j < GRID_N; j++) {
      const x = ipos(i), z = ipos(j);
      if (onLoop(x) || onLoop(z) || landmark(x, z)) continue;
      if (rnd() < 0.42) {
        tierA.add(`${i},${j}`);
        if (rnd() < 0.5) tierB.add(`${i},${j}`);
      }
    }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  for (const [set, top] of [[tierA, 8], [tierB, 16]] as const) {
    for (const k of set) {
      const [i, j] = k.split(",").map(Number) as [number, number];
      const x = ipos(i), z = ipos(j);
      const nc = pick(NEONS);
      deck(x, z, 10, 10, top, nc);
      if (rnd() < 0.5) chests.push({ x: x + 2, z: z - 2, y: top, rot: 1 });
      const linked: boolean[] = [];
      for (const [di, dj] of DIRS) {
        const has = set.has(`${i + di},${j + dj}`);
        linked.push(has);
        if (has && (di > 0 || dj > 0)) bridge(x + di * 5, z + dj * 5, x + di * (CELL_W - 5), z + dj * (CELL_W - 5), top, nc);
      }
      // stairs on a free side: tier A down to the street, tier B down to tier A
      const free = DIRS.map((_, n) => n).filter((n) => !linked[n]);
      const side = free.length ? free[Math.floor(rnd() * free.length)]! : -1;
      if (side >= 0) {
        const [dx, dz] = DIRS[side]!;
        stairs(x + dx * 5, z + dz * 5, dx, dz, top, top === 8 ? 0 : 8);
        if (top === 16) {
          // landing at the bottom of the upper flight
          const L = Math.round(8 / 0.3) * 0.45 + 5;
          deck(x + dx * (L + 3), z + dz * (L + 3), 6, 6, 8, nc);
          stairs(x + dx * (L + 6), z + dz * (L + 6), dx, dz, 8, 0);
        }
      }
      neon.push({ x: x + 4.6, y: top / 2, z: z + 4.6, w: 0.4, h: top, d: 0.4, color: nc });
      add({ x: x - 4.6, z: z - 4.6, w: 0.6, d: 0.6, h: top - 0.4, y0: 0, kind: "wall", color: "#151822" });
      closeGroup();
    }
  }

  // ---------------- maglev loop (track + pillars) ----------------
  for (const side of [-1, 1]) {
    for (const axis of [0, 1]) {
      const c = side * LOOP;
      if (axis === 0) add({ x: 0, z: c, w: LOOP * 2 + 4, d: 5.5, h: 0.65, y0: TRAIN_Y - 0.65, kind: "floor", color: "#62676d" });
      else add({ x: c, z: 0, w: 5.5, d: LOOP * 2 + 4, h: 0.65, y0: TRAIN_Y - 0.65, kind: "floor", color: "#62676d" });
      // Twin steel running rails and regular concrete sleepers.
      for (const s of [-1, 1]) {
        if (axis === 0) add({ x: 0, z: c + s * 1.25, w: LOOP * 2 + 4, d: 0.16, h: 0.18, y0: TRAIN_Y, kind: "wall", color: "#a4a8ac" });
        else add({ x: c + s * 1.25, z: 0, w: 0.16, d: LOOP * 2 + 4, h: 0.18, y0: TRAIN_Y, kind: "wall", color: "#a4a8ac" });
      }
      for (let p = -LOOP; p <= LOOP; p += 8) {
        if (axis === 0) add({ x: p, z: c, w: 0.45, d: 4.2, h: 0.12, y0: TRAIN_Y, kind: "wall", color: "#34383c" });
        else add({ x: c, z: p, w: 4.2, d: 0.45, h: 0.12, y0: TRAIN_Y, kind: "wall", color: "#34383c" });
      }
      for (let t = -GRID_N; t <= GRID_N; t++) {
        const p = t * CELL_W;
        if (Math.abs(p) > LOOP) continue;
        if (axis === 0) add({ x: p, z: c, w: 1.2, d: 1.2, h: TRAIN_Y - 0.4, y0: 0, kind: "wall", color: "#2b3040" });
        else add({ x: c, z: p, w: 1.2, d: 1.2, h: TRAIN_Y - 0.4, y0: 0, kind: "wall", color: "#2b3040" });
      }
      closeGroup();
    }
  }

  // ---------------- Laser Tag Arena (center) ----------------
  {
    const A = 64;
    const dark = "#101218";
    const cy = "#22d3ee", mg = "#ff2d95";
    for (const side of [-1, 1]) {
      for (const axis of [0, 1]) {
        const seg = A - 3;
        for (const s of [-1, 1]) {
          const off = s * (3 + seg / 2);
          if (axis === 0) add({ x: off, z: side * A, w: seg, d: 1, h: 8, y0: 0, kind: "wall", color: dark });
          else add({ x: side * A, z: off, w: 1, d: seg, h: 8, y0: 0, kind: "wall", color: dark });
        }
        if (axis === 0) neon.push({ x: 0, y: 8.05, z: side * A, w: A * 2, h: 0.2, d: 1.1, color: side > 0 ? cy : mg });
        else neon.push({ x: side * A, y: 8.05, z: 0, w: 1.1, h: 0.2, d: A * 2, color: side > 0 ? mg : cy });
      }
    }
    // inner catwalk ring at y=4
    for (const side of [-1, 1]) {
      add({ x: 0, z: side * (A - 2.5), w: A * 2 - 2, d: 4, h: 0.3, y0: 3.7, kind: "floor", color: "#1a1d26" });
      add({ x: side * (A - 2.5), z: 0, w: 4, d: A * 2 - 10, h: 0.3, y0: 3.7, kind: "floor", color: "#1a1d26" });
      neon.push({ x: 0, y: 3.65, z: side * (A - 4.5), w: A * 2 - 10, h: 0.1, d: 0.1, color: cy });
      neon.push({ x: side * (A - 4.5), y: 3.65, z: 0, w: 0.1, h: 0.1, d: A * 2 - 10, color: mg });
    }
    // maze partitions
    for (let gx = -6; gx <= 6; gx++)
      for (let gz = -6; gz <= 6; gz++) {
        if (Math.abs(gx) <= 1 && Math.abs(gz) <= 1) continue;
        if (rnd() < 0.45) continue;
        const x = gx * 8.5, z = gz * 8.5;
        const horiz = rnd() < 0.5;
        const L = 5 + rnd() * 3;
        const h = rnd() < 0.3 ? 1.2 : 2.6;
        add({ x, z, w: horiz ? L : 0.6, d: horiz ? 0.6 : L, h, y0: 0, kind: "wall", color: dark });
        neon.push({ x, y: h + 0.03, z, w: horiz ? L : 0.65, h: 0.06, d: horiz ? 0.65 : L, color: rnd() < 0.5 ? cy : mg });
        if (rnd() < 0.25) chests.push({ x: x + (horiz ? 0 : 1.4), z: z + (horiz ? 1.4 : 0), y: 0, rot: 0 });
      }
    // central command platform + bridges to catwalks
    deck(0, 0, 16, 16, 4, mg);
    for (const [dx, dz] of DIRS) {
      bridge(dx * 8, dz * 8, dx * (A - 4.5), dz * (A - 4.5), 4, cy);
    }
    stairs(-8, 3, -1, 0, 4, 0);
    stairs(8, -3, 1, 0, 4, 0);
    deck(0, 0, 8, 8, 8, cy);
    stairs(0, 4, 0, 1, 8, 4, 2);
    chests.push({ x: 0, z: 0, y: 8, rot: 0 }, { x: 4, z: 4, y: 4, rot: 0 }, { x: -4, z: -4, y: 4, rot: 0 });
    // stairs to catwalk in the corners
    for (const [sx, sz] of [[-1, -1], [1, 1]] as const) stairs(sx * (A - 2.5), sz * (A - 6), 0, -sz, 4, 0);
    closeGroup();
  }

  // ---------------- Railway Station (west, on the maglev loop) ----------------
  {
    const px = -LOOP + 8;
    add({ x: px, z: 0, w: 12, d: 200, h: 0.45, y0: TRAIN_Y - 0.45, kind: "floor", color: "#8a8d8f" });
    add({ x: px, z: 0, w: 14, d: 200, h: 0.4, y0: TRAIN_Y + 6, kind: "floor", color: "#3d4247" });
    add({ x: px + 4.9, z: 0, w: 0.35, d: 190, h: 0.08, y0: TRAIN_Y, kind: "wall", color: "#e2b714" });
    for (let z = -96; z <= 96; z += 24) {
      add({ x: px + 5.5, z, w: 0.8, d: 0.8, h: TRAIN_Y, y0: 0, kind: "wall", color: "#2b3040" });
      add({ x: px - 5.5, z, w: 0.6, d: 0.6, h: 6, y0: TRAIN_Y, kind: "wall", color: "#2b3040" });
      neon.push({ x: px - 5.5, y: TRAIN_Y + 3, z, w: 0.65, h: 6, d: 0.65, color: "#facc15" });
      chests.push({ x: px + 2, z: z + 6, y: TRAIN_Y, rot: 0 });
    }
    neon.push({ x: px, y: TRAIN_Y + 5.5, z: 100.3, w: 10, h: 1.2, d: 0.2, color: "#22d3ee" });
    stairs(px, 100, 0, 1, TRAIN_Y, 0, 4);
    stairs(px, -100, 0, -1, TRAIN_Y, 0, 4);
    // Low boarding steps beside the stopping line.
    for (const z of [-72, -24, 24, 72]) {
      add({ x: px + 3.8, z, w: 1.8, d: 5, h: 0.35, y0: TRAIN_Y, kind: "step", color: "#70757a" });
    }
    closeGroup();
    enterable(-505, -60, 30, 40, 3, "#232838", "#facc15");
    closeGroup();
    enterable(-505, 60, 30, 40, 3, "#232838", "#facc15");
    closeGroup();
    bridge(-505 + 15, -60, px - 6, -60, 12, "#facc15");
    closeGroup();
  }

  // ---------------- Skyport (airport, NE) ----------------
  {
    const rz = -500;
    add({ x: 615, z: rz, w: 280, d: 42, h: 0.12, y0: 0, kind: "floor", color: "#31363b" });
    for (let x = 490; x <= 740; x += 10) {
      neon.push({ x, y: 0.14, z: rz - 18, w: 0.25, h: 0.06, d: 0.25, color: "#f8fafc" });
      neon.push({ x, y: 0.14, z: rz + 18, w: 0.25, h: 0.06, d: 0.25, color: "#f8fafc" });
      add({ x, z: rz, w: 5, d: 0.28, h: 0.04, y0: 0.12, kind: "floor", color: "#e5e7eb" });
    }
    for (const x of [482, 492, 502]) add({ x, z: rz, w: 1.2, d: 18, h: 0.05, y0: 0.12, kind: "floor", color: "#f8fafc" });
    // Apron stand markings and service lanes.
    for (const z of [-430, -600]) for (const x of [540, 590, 640, 700]) {
      add({ x, z, w: 36, d: 0.18, h: 0.04, y0: 0.02, kind: "floor", color: "#d9b64c" });
      add({ x, z: z + 11, w: 0.18, d: 22, h: 0.04, y0: 0.02, kind: "floor", color: "#d9b64c" });
    }
    // parked jets
    for (const [x, z] of [[540, -430], [640, -430], [590, -600], [700, -600]] as const) {
      // Compact collision hull; the recognizable aircraft is rendered separately.
      add({ x, z, w: 28, d: 3.6, h: 3.4, y0: 0.8, kind: "wall", color: "#d6d9dc" });
      add({ x: x + 1, z, w: 5, d: 25, h: 0.45, y0: 2.7, kind: "wall", color: "#b9bec3" });
      chests.push({ x: x + 5, z: z + 5, y: 0, rot: 0 }, { x, z, y: 5.1, rot: 0 });
      closeGroup();
    }
    enterable(540, -300, 60, 26, 3, "#4a5158", "#d7e1e8"); // terminal
    closeGroup();
    tower(720, -300, 10, 10, 46, "#1e293b", "#22d3ee"); // control tower
    closeGroup();
    deck(720, -300, 18, 18, 46.4, "#22d3ee");
    closeGroup();
    for (const x of [500, 560, 620, 680]) {
      enterable(x + 10, -700, 44, 30, 2, "#555d62", "#d7e1e8"); // hangars
      closeGroup();
    }
  }

  // ---------------- Arcade District (gaming zone, SE) ----------------
  {
    const glow = ["#e35745", "#45a6b7", "#d8ad45"];
    const facades = ["#343a40", "#454b50", "#50555a", "#2f3539"];
    for (let x = 500; x <= 720; x += 55)
      for (let z = 330; z <= 720; z += 55) {
        const r = rnd();
        if (r < 0.65) enterable(x, z, 26, 26, 3, pick(facades), pick(glow));
        else if (r < 0.82) labyrinth(x, z, 4, pick(glow));
        else tower(x, z, 18, 18, 30 + rnd() * 30, pick(facades), pick(glow));
        closeGroup();
        // Grounded storefront sign, canvas awning, and rooftop plant equipment.
        neon.push({ x: x + 13.25, y: 3.2, z, w: 0.12, h: 1.1, d: 7, color: pick(glow) });
        add({ x: x + 13.8, z, w: 2.4, d: 9, h: 0.25, y0: 2.35, kind: "floor", color: "#596168" });
        add({ x: x - 4, z: z + 2, w: 7, d: 5, h: 2, y0: 12, kind: "wall", color: "#6b7379" });
        add({ x: x + 5, z: z - 4, w: 4, d: 4, h: 1.2, y0: 12, kind: "wall", color: "#737b80" });
      }
    // Street-level entrance gantry rather than a floating neon monument.
    add({ x: 600, z: 300, w: 58, d: 1.2, h: 2, y0: 8, kind: "wall", color: "#4b5258" });
    add({ x: 572, z: 300, w: 2, d: 2, h: 10, y0: 0, kind: "wall", color: "#41484e" });
    add({ x: 628, z: 300, w: 2, d: 2, h: 10, y0: 0, kind: "wall", color: "#41484e" });
    neon.push({ x: 600, y: 8.9, z: 299.35, w: 22, h: 0.5, d: 0.12, color: "#e35745" });
  }

  // street chests
  for (let n = 0; n < 260; n++) {
    const i = Math.floor((rnd() - 0.5) * 2 * GRID_N);
    const j = Math.floor((rnd() - 0.5) * 2 * GRID_N);
    const alongX = rnd() < 0.5;
    const x = alongX ? i * CELL_W + (rnd() - 0.5) * 30 : ipos(i) + 4;
    const z = alongX ? ipos(j) + 4 : j * CELL_W + (rnd() - 0.5) * 30;
    chests.push({ x, z, y: 0, rot: rnd() * 3 });
  }

  return { boxes, groups, neon, lamps, chests, trees: [] as { x: number; z: number; s: number }[] };
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

export const CHEST_SPOTS: ChestSpot[] = WORLD.chests.filter(
  (c) => Math.abs(c.x) < MAP_HALF - 4 && Math.abs(c.z) < MAP_HALF - 4 && !collides(c.x, c.z, 0.9, c.y) && Math.abs(groundAt(c.x, c.z, c.y + 0.1) - c.y) < 0.5,
);

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

// group-level spatial hash for ray queries
const GCELL = 48;
const GGRID = new Map<number, number[]>();
GROUPS.forEach((g, idx) => {
  for (let cx = Math.floor(g.minX / GCELL); cx <= Math.floor(g.maxX / GCELL); cx++)
    for (let cz = Math.floor(g.minZ / GCELL); cz <= Math.floor(g.maxZ / GCELL); cz++) {
      const k = key(cx, cz);
      let a = GGRID.get(k);
      if (!a) GGRID.set(k, (a = []));
      a.push(idx);
    }
});
const STAMP = new Uint32Array(GROUPS.length);
let stampId = 0;

/** Ray vs boxes (grid + per-building broadphase) — bullets and line of sight. */
export function rayBlocked(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): boolean {
  stampId++;
  const step = 8;
  let lastK = NaN;
  for (let t = 0; t <= maxDist + step; t += step) {
    const tt = Math.min(t, maxDist);
    const px = origin.x + dir.x * tt, pz = origin.z + dir.z * tt;
    const bcx = Math.floor(px / GCELL), bcz = Math.floor(pz / GCELL);
    const k0 = key(bcx, bcz);
    if (k0 === lastK) continue;
    lastK = k0;
    for (let ox = -1; ox <= 1; ox++)
      for (let oz = -1; oz <= 1; oz++) {
        const arr = GGRID.get(key(bcx + ox, bcz + oz));
        if (!arr) continue;
        for (const idx of arr) {
          if (STAMP[idx] === stampId) continue;
          STAMP[idx] = stampId;
          const g = GROUPS[idx]!;
          if (!rayBox(origin, dir, maxDist, g.minX, g.maxX, 0, g.top, g.minZ, g.maxZ)) continue;
          for (const b of g.items) {
            if (rayBox(origin, dir, maxDist, b.x - b.w / 2, b.x + b.w / 2, b.y0, b.y0 + b.h, b.z - b.d / 2, b.z + b.d / 2)) return true;
          }
        }
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
