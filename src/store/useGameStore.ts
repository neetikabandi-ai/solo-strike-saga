import { create } from "zustand";
import type { Weapon, WeaponKind } from "../lib/weapons";

export type Phase = "menu" | "bus" | "dive" | "playing" | "dead" | "won";
export type FeedEntry = { id: number; text: string };

export const TOTAL_BOTS = 99;
export const START_ZONE = 820;
/** Storm damage per second, by storm stage. */
export const STORM_DPS = [1, 2, 4, 6, 8, 10, 12];

type Data = {
  health: number;
  shield: number;
  slots: (Weapon | null)[];
  slot: number;
  ammo: Record<WeaponKind, number>;
  potions: { shield: number; med: number };
  reloading: boolean;
  using: string | null;
  kills: number;
  alive: number;
  zoneRadius: number;
  zoneNext: number;
  zoneX: number;
  zoneZ: number;
  nextX: number;
  nextZ: number;
  stormStage: number;
  stormLabel: string;
  inZone: boolean;
  feed: FeedEntry[];
  hitMarker: number;
  prompt: string | null;
};

type GameState = Data & {
  phase: Phase;
  runSeed: number;
  start: () => void;
  reset: () => void;
  damage: (n: number) => void;
  stormDamage: (n: number) => void;
  addKill: (name: string) => void;
  pushFeed: (text: string) => void;
  markHit: () => void;
};

let feedId = 0;

function initial(): Data {
  return {
    health: 100,
    shield: 0,
    slots: [{ kind: "ar", rarity: 2, mag: 30 }, null, null],
    slot: 0,
    ammo: { ar: 150, smg: 60, shotgun: 12, sniper: 6, burst: 72, handcannon: 21, dmr: 30 },
    potions: { shield: 2, med: 1 },
    reloading: false,
    using: null,
    kills: 0,
    alive: TOTAL_BOTS + 1,
    zoneRadius: START_ZONE,
    zoneNext: START_ZONE,
    zoneX: 0,
    zoneZ: 0,
    nextX: 0,
    nextZ: 0,
    stormStage: 0,
    stormLabel: "",
    inZone: true,
    feed: [],
    hitMarker: 0,
    prompt: null,
  };
}

export const useGameStore = create<GameState>((set, get) => ({
  phase: "menu",
  runSeed: 0,
  ...initial(),
  start: () => set({ ...initial(), phase: "bus", runSeed: Date.now() }),
  reset: () => set({ ...initial(), phase: "menu" }),
  damage: (n) => {
    const s = get();
    if (s.phase !== "playing") return;
    const absorbed = Math.min(s.shield, n);
    const health = Math.max(0, s.health - (n - absorbed));
    set({ shield: s.shield - absorbed, health, ...(health <= 0 ? { phase: "dead" as const } : {}) });
  },
  stormDamage: (n) => {
    const s = get();
    if (s.phase !== "playing") return;
    const health = Math.max(0, s.health - n);
    set({ health, ...(health <= 0 ? { phase: "dead" as const } : {}) });
  },
  addKill: (name) => {
    const kills = get().kills + 1;
    set({ kills });
    get().pushFeed(`You eliminated ${name}`);
  },
  pushFeed: (text) => set((s) => ({ feed: [...s.feed, { id: ++feedId, text }].slice(-5) })),
  markHit: () => set({ hitMarker: Date.now() }),
}));
