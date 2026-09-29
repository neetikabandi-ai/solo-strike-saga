import * as THREE from "three";
import { CHEST_SPOTS, clampMap, findFree, POIS, VEHICLE_SPOTS } from "./world";
import { TOTAL_BOTS } from "../store/useGameStore";

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
export type Chest = { id: number; x: number; z: number; rot: number; opened: boolean };

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
  // random straight flight path across the island
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
  runtime.chests = CHEST_SPOTS.map((c, i) => ({ id: i, x: c.x, z: c.z, rot: c.rot, opened: false }));
  runtime.chestVersion++;
  runtime.vehicles = VEHICLE_SPOTS.map((v, i) => ({ id: i, x: v.x, z: v.z, yaw: v.yaw, speed: 0 }));
  runtime.driving = -1;

  runtime.bots = Array.from({ length: TOTAL_BOTS }, (_, i) => {
    const jump = b.dur * (0.08 + Math.random() * 0.85);
    busPos(jump / b.dur, TMP);
    let tx = TMP.x + (Math.random() - 0.5) * 240;
    let tz = TMP.z + (Math.random() - 0.5) * 240;
    // most bots head for the nearest named location
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
      health: 100,
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

/** Shield first, then health. Returns true when this hit killed the bot. */
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
