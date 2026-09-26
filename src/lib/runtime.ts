import * as THREE from "three";
import { spawnPoints } from "./world";
import { TOTAL_BOTS } from "../store/useGameStore";

export type Bot = {
  id: number;
  name: string;
  pos: THREE.Vector3;
  yaw: number;
  health: number;
  alive: boolean;
  dying: number; // seconds since death, for the death animation
  fireCd: number;
  burst: number;
  repath: number;
  dest: THREE.Vector3;
  moving: boolean;
  aware: boolean;
};

export type Tracer = {
  id: number;
  from: THREE.Vector3;
  to: THREE.Vector3;
  life: number;
  hostile: boolean;
};

const NAMES = [
  "ScarKing",
  "PochinkiRat",
  "DesiSniper",
  "M416Maniac",
  "BoltRaider",
  "GhillieGhost",
  "PanBaba",
  "AWM_Ankit",
  "ErangelWolf",
  "FlareCaller",
  "SanhokSlayer",
  "ZoneRunner",
  "LoneWolfie",
  "HeadshotHari",
  "SmokeNinja",
];

export const runtime = {
  bots: [] as Bot[],
  player: new THREE.Vector3(0, 0, 0),
  playerYaw: 0,
  playerAlive: true,
  tracers: [] as Tracer[],
  muzzle: 0,
};

let tracerId = 0;

export function initRun() {
  const pts = spawnPoints(TOTAL_BOTS + 1);
  const start = pts[0];
  runtime.player.set(start.x, 0, start.z);
  runtime.playerAlive = true;
  runtime.tracers = [];
  runtime.bots = pts.slice(1).map((p, i) => ({
    id: i,
    name: NAMES[i % NAMES.length],
    pos: new THREE.Vector3(p.x, 0, p.z),
    yaw: Math.random() * Math.PI * 2,
    health: 100,
    alive: true,
    dying: 0,
    fireCd: 1 + Math.random() * 2,
    burst: 0,
    repath: 0,
    dest: new THREE.Vector3(p.x, 0, p.z),
    moving: false,
    aware: false,
  }));
}

export function addTracer(
  from: THREE.Vector3,
  to: THREE.Vector3,
  hostile: boolean
) {
  runtime.tracers.push({
    id: ++tracerId,
    from: from.clone(),
    to: to.clone(),
    life: hostile ? 0.12 : 0.07,
    hostile,
  });
  if (runtime.tracers.length > 40) runtime.tracers.shift();
}
