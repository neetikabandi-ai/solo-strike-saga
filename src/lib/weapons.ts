export type WeaponKind = "ar" | "smg" | "shotgun" | "sniper" | "burst" | "handcannon" | "dmr";
export type Weapon = { kind: WeaponKind; rarity: number; mag: number };

export const RARITY = [
  { name: "Common", color: "#b4b8bf", mul: 1 },
  { name: "Uncommon", color: "#3fbf4f", mul: 1.08 },
  { name: "Rare", color: "#3b8cf0", mul: 1.16 },
  { name: "Epic", color: "#b35cf2", mul: 1.25 },
  { name: "Legendary", color: "#f5a524", mul: 1.35 },
];

export const WEAPONS: Record<
  WeaponKind,
  {
    name: string;
    dmg: number;
    pellets: number;
    interval: number;
    mag: number;
    spread: number;
    adsSpread: number;
    reload: number;
    auto: boolean;
    range: number;
    head: number;
    adsFov: number;
    burst?: number;
  }
> = {
  ar: { name: "Assault Rifle", dmg: 30, pellets: 1, interval: 0.17, mag: 30, spread: 0.03, adsSpread: 0.008, reload: 2.2, auto: true, range: 120, head: 1.6, adsFov: 55 },
  smg: { name: "SMG", dmg: 17, pellets: 1, interval: 0.08, mag: 30, spread: 0.045, adsSpread: 0.025, reload: 2, auto: true, range: 50, head: 1.5, adsFov: 62 },
  shotgun: { name: "Pump Shotgun", dmg: 11, pellets: 10, interval: 0.9, mag: 5, spread: 0.09, adsSpread: 0.07, reload: 4, auto: false, range: 22, head: 1.6, adsFov: 65 },
  burst: { name: "Burst Rifle", dmg: 27, pellets: 1, interval: 0.45, mag: 24, spread: 0.025, adsSpread: 0.006, reload: 2.4, auto: false, range: 140, head: 1.7, adsFov: 52, burst: 3 },
  handcannon: { name: "Hand Cannon", dmg: 62, pellets: 1, interval: 0.6, mag: 7, spread: 0.035, adsSpread: 0.01, reload: 1.8, auto: false, range: 70, head: 2, adsFov: 60 },
  dmr: { name: "DMR", dmg: 48, pellets: 1, interval: 0.35, mag: 10, spread: 0.04, adsSpread: 0.002, reload: 2.6, auto: false, range: 260, head: 1.9, adsFov: 35 },
  sniper: { name: "Sniper Rifle", dmg: 100, pellets: 1, interval: 1.3, mag: 1, spread: 0.07, adsSpread: 0.0008, reload: 2.4, auto: false, range: 400, head: 2.2, adsFov: 22 },
};

export const KINDS: WeaponKind[] = ["ar", "smg", "shotgun", "sniper", "burst", "handcannon", "dmr"];
const WEIGHTS: Record<WeaponKind, number> = { ar: 20, smg: 16, shotgun: 18, sniper: 6, burst: 14, handcannon: 12, dmr: 10 };

export function rollRarity() {
  const r = Math.random();
  if (r < 0.08) return 4;
  if (r < 0.22) return 3;
  if (r < 0.45) return 2;
  if (r < 0.75) return 1;
  return 0;
}

export function rollKind(exclude: WeaponKind[] = []): WeaponKind {
  const pool = KINDS.filter((k) => !exclude.includes(k));
  const list = pool.length ? pool : KINDS;
  let r = Math.random() * list.reduce((a, k) => a + WEIGHTS[k], 0);
  for (const k of list) if ((r -= WEIGHTS[k]) <= 0) return k;
  return list[0]!;
}

export function rollWeapon(exclude: WeaponKind[] = []): Weapon {
  const kind = rollKind(exclude);
  return { kind, rarity: rollRarity(), mag: WEAPONS[kind].mag };
}

export type ChestResult = { slots: (Weapon | null)[]; ammoKind: WeaponKind | null; text: string };

/**
 * Chest rule: upgrade the held weapon one rarity tier; if it is already
 * Legendary, add a new weapon class you don't own to an empty slot, else
 * upgrade another weapon; if everything is Legendary, return bonus only.
 */
export function chestLoot(slots: (Weapon | null)[], active: number, roll = rollWeapon): ChestResult {
  const out = [...slots];
  const held = out[active];
  const label = (w: Weapon) => `${RARITY[w.rarity]!.name} ${WEAPONS[w.kind].name}`;
  if (held && held.rarity < 4) {
    const up = { ...held, rarity: held.rarity + 1, mag: WEAPONS[held.kind].mag };
    out[active] = up;
    return { slots: out, ammoKind: up.kind, text: `Upgraded to ${label(up)}` };
  }
  const empty = held ? out.indexOf(null) : active;
  if (empty >= 0) {
    const owned = out.filter((w): w is Weapon => !!w).map((w) => w.kind);
    const w = roll(owned);
    out[empty] = w;
    return { slots: out, ammoKind: w.kind, text: `New weapon: ${label(w)}` };
  }
  const other = out.findIndex((w) => w && w.rarity < 4);
  if (other >= 0) {
    const w = out[other]!;
    const up = { ...w, rarity: w.rarity + 1, mag: WEAPONS[w.kind].mag };
    out[other] = up;
    return { slots: out, ammoKind: up.kind, text: `Upgraded to ${label(up)}` };
  }
  return { slots: out, ammoKind: held?.kind ?? null, text: "Loadout maxed: bonus supplies" };
}
