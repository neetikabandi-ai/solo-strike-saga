import { create } from "zustand";

export type Phase = "menu" | "playing" | "dead" | "won";

export type FeedEntry = { id: number; text: string };

const MAG_SIZE = 30;
const START_RESERVE = 150;
export const TOTAL_BOTS = 15;

type GameState = {
  phase: Phase;
  health: number;
  mag: number;
  reserve: number;
  reloading: boolean;
  kills: number;
  alive: number;
  zoneRadius: number;
  zoneNext: number;
  zoneX: number;
  zoneZ: number;
  inZone: boolean;
  feed: FeedEntry[];
  hitMarker: number;
  runSeed: number;
  start: () => void;
  reset: () => void;
  damage: (n: number) => void;
  heal: (n: number) => void;
  setMag: (n: number) => void;
  setReserve: (n: number) => void;
  setReloading: (v: boolean) => void;
  addKill: (name: string) => void;
  setAlive: (n: number) => void;
  setZone: (r: number, next: number, x: number, z: number) => void;
  setInZone: (v: boolean) => void;
  pushFeed: (text: string) => void;
  markHit: () => void;
};

let feedId = 0;

const initial = {
  health: 100,
  mag: MAG_SIZE,
  reserve: START_RESERVE,
  reloading: false,
  kills: 0,
  alive: TOTAL_BOTS + 1,
  zoneRadius: 105,
  zoneNext: 105,
  zoneX: 0,
  zoneZ: 0,
  inZone: true,
  feed: [] as FeedEntry[],
  hitMarker: 0,
};

export const MAGAZINE_SIZE = MAG_SIZE;

export const useGameStore = create<GameState>((set, get) => ({
  phase: "menu",
  runSeed: 0,
  ...initial,
  start: () =>
    set({ ...initial, phase: "playing", runSeed: Date.now() }),
  reset: () => set({ ...initial, phase: "menu" }),
  damage: (n) => {
    const health = Math.max(0, get().health - n);
    if (health <= 0 && get().phase === "playing") {
      set({ health: 0, phase: "dead" });
    } else {
      set({ health });
    }
  },
  heal: (n) => set({ health: Math.min(100, get().health + n) }),
  setMag: (n) => set({ mag: n }),
  setReserve: (n) => set({ reserve: n }),
  setReloading: (v) => set({ reloading: v }),
  addKill: (name) => {
    const kills = get().kills + 1;
    const alive = Math.max(1, get().alive - 1);
    set({ kills, alive });
    get().pushFeed(`You eliminated ${name}`);
    if (alive <= 1 && get().phase === "playing") set({ phase: "won" });
  },
  setAlive: (n) => set({ alive: n }),
  setZone: (zoneRadius, zoneNext, zoneX, zoneZ) =>
    set({ zoneRadius, zoneNext, zoneX, zoneZ }),
  setInZone: (v) => set({ inZone: v }),
  pushFeed: (text) =>
    set((s) => ({ feed: [...s.feed, { id: ++feedId, text }].slice(-4) })),
  markHit: () => set({ hitMarker: Date.now() }),
}));
