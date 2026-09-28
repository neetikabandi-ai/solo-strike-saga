export type WeaponKind = "ar" | "smg" | "shotgun" | "sniper";
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
  }
> = {
  ar: { name: "Assault Rifle", dmg: 30, pellets: 1, interval: 0.17, mag: 30, spread: 0.03, adsSpread: 0.008, reload: 2.2, auto: true, range: 120, head: 1.6, adsFov: 55 },
  smg: { name: "SMG", dmg: 17, pellets: 1, interval: 0.08, mag: 30, spread: 0.045, adsSpread: 0.025, reload: 2, auto: true, range: 50, head: 1.5, adsFov: 62 },
  shotgun: { name: "Pump Shotgun", dmg: 11, pellets: 10, interval: 0.9, mag: 5, spread: 0.09, adsSpread: 0.07, reload: 4, auto: false, range: 22, head: 1.6, adsFov: 65 },
  sniper: { name: "Sniper Rifle", dmg: 100, pellets: 1, interval: 1.3, mag: 1, spread: 0.07, adsSpread: 0.0008, reload: 2.4, auto: false, range: 400, head: 2.2, adsFov: 22 },
};

const KINDS: WeaponKind[] = ["ar", "smg", "shotgun", "sniper"];

export function rollRarity() {
  const r = Math.random();
  if (r < 0.08) return 4;
  if (r < 0.22) return 3;
  if (r < 0.45) return 2;
  if (r < 0.75) return 1;
  return 0;
}

export function rollWeapon(): Weapon {
  const r = Math.random();
  const kind = r < 0.35 ? "ar" : r < 0.6 ? "shotgun" : r < 0.85 ? "smg" : "sniper";
  return { kind: KINDS.includes(kind) ? kind : "ar", rarity: rollRarity(), mag: WEAPONS[kind].mag };
}
