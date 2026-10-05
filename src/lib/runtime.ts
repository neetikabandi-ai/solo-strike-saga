import * as THREE from "three";
import { CHEST_SPOTS, clampMap, findFree, LOOP, POIS, TRAIN_Y, VEHICLE_SPOTS } from "./world";
import { makeAircraft, makeTransit, type Aircraft, type Blast, type Bomb, type Transit } from "./fleet";
import { TOTAL_BOTS } from "../store/useGameStore";

export { TRAIN_Y };

export type Bot = {
  id: number;
  name: string;
  pos: THREE.Vector3;
  yaw: number;
  health: number;
  shield: number;
  alive: boolean;
  dying: number;
  fireCd: number;
  burst: number;
  repath: number;
  scan: number;
  dest: THREE.Vector3;
  moving: boolean;
  aware: boolean;
  target: number;
  landed: boolean;
  landAt: number;
};

export type Tracer = { id: number; from: THREE.Vector3; to: THREE.Vector3; life: number; hostile: boolean };
export type Vehicle = { id: number; x: number; z: number; yaw: number; speed: number };
export type Chest = { id: number; x: number; z: number; y: number; rot: number; opened: boolean };

const A = ["Jonesy", "Peely", "Fishstick", "Midas", "Raven", "Drift", "Ramirez", "Banshee", "Lynx", "Meowscles", "Brutus", "Skye", "Ruckus", "Aura", "Crystal", "Calamity"];
const B = ["TTV", "YT", "Pro", "OG", "", "", "xX", "Sweaty", "Default", "Cranky"];

export const BUS_ALT = 190;
const BUS_SPEED = 55;

export const runtime = {
  bots: [] as Bot[],
  player: new THREE.Vector3(),
  playerYaw: 0,
  altitude: 0,
  gliding: false,
  tracers: [] as Tracer[],
  muzzle: 0,
  grace: 0,
  clock: 0,
  chests: [] as Chest[],
  chestVersion: 0,
  view: { bob: 0, ads: false },
  vehicles: [] as Vehicle[],
  driving: -1,
  ridingTrain: -1,
  teleport: null as null | { x: number; z: number; train?: boolean; ride?: "bus" | "taxi" },
  aircraft: makeAircraft() as Aircraft[],
  piloting: -1,
  transit: makeTransit() as Transit[],
  riding: -1,
  bombs: [] as Bomb[],
  blasts: [] as Blast[],
  nukeCd: 0,
  tpOpen: false,
  bus: { sx: 0, sz: 0, ex: 0, ez: 0, dur: 30, yaw: 0 },
};

let tracerId = 0;

export function busPos(t: number, out: THREE.Vector3) {
  const b = runtime.bus;
  const k = THREE.MathUtils.clamp(t, 0, 1.2);
  return out.set(b.sx + (b.ex - b.sx) * k, BUS_ALT, b.sz + (b.ez - b.sz) * k);
}

const TMP = new THREE.Vector3();

export function initRun() {
  const a = Math.random() * Math.PI * 2;
  const off = (Math.random() - 0.5) * 500;
  const px = -Math.sin(a) * off;
  const pz = Math.cos(a) * off;
  const R = 760;
  const b = runtime.bus;
  b.sx = px - Math.cos(a) * R;
  b.sz = pz - Math.sin(a) * R;
  b.ex = px + Math.cos(a) * R;
  b.ez = pz + Math.sin(a) * R;
  b.dur = (R * 2) / BUS_SPEED;
  b.yaw = Math.atan2(b.ex - b.sx, b.ez - b.sz);

  runtime.clock = 0;
  runtime.grace = 0;
  runtime.tracers = [];
  runtime.player.set(b.sx, 0, b.sz);
  runtime.altitude = BUS_ALT;
  runtime.chests = CHEST_SPOTS.map((c, i) => ({ id: i, x: c.x, z: c.z, y: c.y, rot: c.rot, opened: false }));
  runtime.chestVersion++;
  runtime.vehicles = VEHICLE_SPOTS.map((v, i) => ({ id: i, x: v.x, z: v.z, yaw: v.yaw, speed: 0 }));
  runtime.driving = -1;
  runtime.ridingTrain = -1;
  runtime.aircraft = makeAircraft();
  runtime.piloting = -1;
  runtime.riding = -1;
  runtime.bombs = [];
  runtime.blasts = [];

  runtime.bots = Array.from({ length: TOTAL_BOTS }, (_, i) => {
    const jump = b.dur * (0.08 + Math.random() * 0.85);
    busPos(jump / b.dur, TMP);
    let tx = TMP.x + (Math.random() - 0.5) * 240;
    let tz = TMP.z + (Math.random() - 0.5) * 240;
    let best = POIS[0]!;
    let bd = Infinity;
    for (const p of POIS) {
      const d = Math.hypot(p.x - TMP.x, p.z - TMP.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    if (bd < 320 && Math.random() < 0.7) {
      tx = best.x + (Math.random() - 0.5) * 90;
      tz = best.z + (Math.random() - 0.5) * 90;
    }
    const spot = findFree(clampMap(tx), clampMap(tz));
    const name = `${B[Math.floor(Math.random() * B.length)]}${A[i % A.length]}${Math.floor(Math.random() * 99)}`;
    return {
      id: i,
      name,
      pos: new THREE.Vector3(spot.x, 0, spot.z),
      yaw: Math.random() * Math.PI * 2,
      health: 150,
      shield: Math.random() < 0.6 ? 50 : 0,
      alive: true,
      dying: 0,
      fireCd: 1 + Math.random() * 2,
      burst: 0,
      repath: 0,
      scan: Math.random(),
      dest: new THREE.Vector3(spot.x, 0, spot.z),
      moving: false,
      aware: false,
      target: -1,
      landed: false,
      landAt: jump + 14 + Math.random() * 6,
    };
  });
}

export function hurtBot(bot: Bot, n: number): boolean {
  if (!bot.alive) return false;
  const abs = Math.min(bot.shield, n);
  bot.shield -= abs;
  bot.health -= n - abs;
  if (bot.health <= 0) {
    bot.alive = false;
    bot.dying = 0;
    return true;
  }
  return false;
}

export function addTracer(from: THREE.Vector3, to: THREE.Vector3, hostile: boolean) {
  runtime.tracers.push({ id: ++tracerId, from: from.clone(), to: to.clone(), life: hostile ? 0.12 : 0.07, hostile });
  if (runtime.tracers.length > 50) runtime.tracers.shift();
}

export const TRAIN_SPEED = 22;
export const TRAIN_CARS = 4;
export const CAR_LEN = 14;
export const CAR_GAP = 2;
export const CAR_W = 3.4;
export const CAR_H = 3.2;
export const TRAIN_ROOF = TRAIN_Y + CAR_H;
const PERIM = LOOP * 8;

export function loopAt(s: number, out: { x: number; z: number; yaw: number }) {
  const L = LOOP;
  let d = ((s % PERIM) + PERIM) % PERIM;
  const seg = Math.floor(d / (2 * L));
  d -= seg * 2 * L;
  if (seg === 0) { out.x = -L + d; out.z = -L; out.yaw = Math.PI / 2; }
  else if (seg === 1) { out.x = L; out.z = -L + d; out.yaw = 0; }
  else if (seg === 2) { out.x = L - d; out.z = L; out.yaw = -Math.PI / 2; }
  else { out.x = -L; out.z = L - d; out.yaw = Math.PI; }
  return out;
}

export const trainCars = Array.from({ length: TRAIN_CARS }, () => ({ x: 0, z: 0, yaw: 0 }));

export function updateTrain(t: number) {
  const head = t * TRAIN_SPEED;
  for (let i = 0; i < TRAIN_CARS; i++) loopAt(head - i * (CAR_LEN + CAR_GAP) - CAR_LEN / 2, trainCars[i]!);
}

export function carUnder(x: number, z: number): number {
  for (let i = 0; i < TRAIN_CARS; i++) {
    const c = trainCars[i]!;
    const dx = x - c.x, dz = z - c.z;
    const along = Math.abs(dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw));
    const side = Math.abs(dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw));
    // A little wider/longer than the visible roof so boarding remains reliable
    // while the train advances between physics frames and rounds a corner.
    if (along < CAR_LEN / 2 + 0.75 && side < CAR_W / 2 + 0.55) return i;
  }
  return -1;
}