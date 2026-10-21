import { CELL_W, mulberry32, TOWER_TOPS } from "./world";

/** Player-flyable aircraft. Parked until mounted. */
export type Aircraft = {
  id: number;
  kind: "jet" | "heli";
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  speed: number;
  home: { x: number; y: number; z: number; yaw: number };
};

/** Bus/taxi driving a fixed rectangular loop along street lines. */
export type Transit = {
  id: number;
  kind: "bus" | "taxi";
  cx: number;
  cz: number;
  hx: number;
  hz: number;
  speed: number;
  offset: number;
  dir: 1 | -1;
  color: string;
  x: number;
  z: number;
  yaw: number;
};

export type Bomb = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
export type Blast = { x: number; y: number; z: number; life: number };

export const JET_COUNT = 5;
export const HELI_COUNT = 10;
export const BUS_COUNT = 20;
export const TAXI_COUNT = 15;
export const NUKE_RADIUS = 32;
export const NUKE_COOLDOWN = 0.6;

const JET_SPOTS = [
  [520, -500],
  [560, -500],
  [600, -500],
  [640, -500],
  [680, -500],
] as const;

export function makeAircraft(): Aircraft[] {
  const list: Aircraft[] = [];
  JET_SPOTS.forEach(([x, z], i) => {
    const home = { x, y: 0.4, z, yaw: Math.PI / 2 };
    list.push({ id: i, kind: "jet", ...home, pitch: 0, speed: 0, home });
  });
  TOWER_TOPS.slice(0, HELI_COUNT).forEach((t, i) => {
    const home = { x: t.x, y: t.y, z: t.z, yaw: 0 };
    list.push({ id: JET_COUNT + i, kind: "heli", ...home, pitch: 0, speed: 0, home });
  });
  return list;
}

const BUS_COLORS = ["#d9a227", "#c4472f", "#2f6fb0", "#3d8b55"];
const half = CELL_W / 2;

/** Street lines sit at 24 + 48k, so loop edges are chosen to land on them. */
export function makeTransit(): Transit[] {
  const rnd = mulberry32(4242);
  const list: Transit[] = [];
  for (let i = 0; i < BUS_COUNT + TAXI_COUNT; i++) {
    const bus = i < BUS_COUNT;
    const cx = Math.round((rnd() - 0.5) * 22) * CELL_W;
    const cz = Math.round((rnd() - 0.5) * 22) * CELL_W;
    const hx = (1 + Math.floor(rnd() * 5)) * CELL_W + half;
    const hz = (1 + Math.floor(rnd() * 5)) * CELL_W + half;
    list.push({
      id: i,
      kind: bus ? "bus" : "taxi",
      cx: Math.max(-700 + hx, Math.min(700 - hx, cx)),
      cz: Math.max(-700 + hz, Math.min(700 - hz, cz)),
      hx,
      hz,
      speed: bus ? 11 + rnd() * 3 : 17 + rnd() * 5,
      offset: rnd() * 4000,
      dir: rnd() < 0.5 ? 1 : -1,
      color: bus ? BUS_COLORS[i % BUS_COLORS.length]! : "#f2c230",
      x: 0,
      z: 0,
      yaw: 0,
    });
  }
  return list;
}

/** Position on a rectangular loop at arc length s. */
export function rectAt(t: Transit, s: number) {
  const { hx, hz } = t;
  const per = 4 * (hx + hz);
  let d = ((s % per) + per) % per;
  let x: number, z: number, yaw: number;
  if (d < 2 * hx) { x = -hx + d; z = -hz; yaw = -Math.PI / 2; }
  else if ((d -= 2 * hx) < 2 * hz) { x = hx; z = -hz + d; yaw = Math.PI; }
  else if ((d -= 2 * hz) < 2 * hx) { x = hx - d; z = hz; yaw = Math.PI / 2; }
  else { d -= 2 * hx; x = -hx; z = hz - d; yaw = 0; }
  if (t.dir < 0) yaw += Math.PI;
  t.x = t.cx + x;
  t.z = t.cz + z;
  t.yaw = yaw;
}

export function updateTransit(list: Transit[], clock: number) {
  for (const t of list) rectAt(t, t.dir * (clock * t.speed + t.offset));
}
