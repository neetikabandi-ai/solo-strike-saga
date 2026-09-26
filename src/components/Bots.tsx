import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { addTracer, runtime, type Bot } from "../lib/runtime";
import { MAP_HALF, moveWithCollision, rayBlocked } from "../lib/world";
import { useGameStore } from "../store/useGameStore";
import { Soldier, type SoldierClip } from "./Soldier";

const SIGHT = 55;
const FIRE_RANGE = 48;
const BOT_SPEED = 4.2;

const DIR = new THREE.Vector3();
const EYE = new THREE.Vector3();
const TARGET = new THREE.Vector3();
const RAY = new THREE.Vector3();

export function Bots() {
  const runSeed = useGameStore((s) => s.runSeed);
  const [, force] = useState(0);

  // Re-mount every bot when a new match starts.
  useEffect(() => {
    force((n) => n + 1);
  }, [runSeed]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const store = useGameStore.getState();
    if (store.phase !== "playing") return;

    const player = runtime.player;
    let aliveBots = 0;

    for (const bot of runtime.bots) {
      if (!bot.alive) {
        bot.dying += dt;
        continue;
      }
      aliveBots++;

      const toPlayer = Math.hypot(player.x - bot.pos.x, player.z - bot.pos.z);
      EYE.set(bot.pos.x, 1.5, bot.pos.z);
      TARGET.set(player.x, 1.4, player.z);
      RAY.copy(TARGET).sub(EYE);
      const dist = RAY.length();
      RAY.normalize();
      const clearShot = dist < SIGHT && !rayBlocked(EYE, RAY, dist - 0.6);

      if (clearShot && dist < SIGHT) bot.aware = true;

      // --- pick a destination -------------------------------------
      bot.repath -= dt;
      const zoneDx = bot.pos.x - store.zoneX;
      const zoneDz = bot.pos.z - store.zoneZ;
      const zoneDist = Math.hypot(zoneDx, zoneDz);
      const mustRotate = zoneDist > store.zoneRadius * 0.85;

      if (bot.repath <= 0) {
        bot.repath = 1.4 + Math.random() * 1.6;
        if (mustRotate) {
          const ang = Math.random() * Math.PI * 2;
          const r = store.zoneRadius * 0.5 * Math.random();
          bot.dest.set(store.zoneX + Math.cos(ang) * r, 0, store.zoneZ + Math.sin(ang) * r);
        } else if (bot.aware && toPlayer < SIGHT * 1.4) {
          // close in, but keep a fighting distance and strafe
          const side = Math.random() > 0.5 ? 1 : -1;
          const ang = Math.atan2(bot.pos.z - player.z, bot.pos.x - player.x) + side * 0.6;
          const keep = clearShot ? 16 : 8;
          bot.dest.set(player.x + Math.cos(ang) * keep, 0, player.z + Math.sin(ang) * keep);
        } else {
          const ang = Math.random() * Math.PI * 2;
          const r = 12 + Math.random() * 25;
          bot.dest.set(
            THREE.MathUtils.clamp(bot.pos.x + Math.cos(ang) * r, -MAP_HALF + 5, MAP_HALF - 5),
            0,
            THREE.MathUtils.clamp(bot.pos.z + Math.sin(ang) * r, -MAP_HALF + 5, MAP_HALF - 5)
          );
        }
      }

      DIR.set(bot.dest.x - bot.pos.x, 0, bot.dest.z - bot.pos.z);
      const destDist = DIR.length();
      bot.moving = destDist > 1.2;
      if (bot.moving) {
        DIR.normalize();
        const sp = mustRotate ? BOT_SPEED * 1.35 : BOT_SPEED;
        moveWithCollision(bot.pos, DIR.x * sp * dt, DIR.z * sp * dt, 0.55);
      }

      // face the player when engaged, otherwise face travel direction
      const faceX = clearShot ? player.x - bot.pos.x : bot.dest.x - bot.pos.x;
      const faceZ = clearShot ? player.z - bot.pos.z : bot.dest.z - bot.pos.z;
      const wantYaw = Math.atan2(faceX, faceZ);
      let diff = wantYaw - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += diff * (1 - Math.exp(-8 * dt));

      // --- shooting -------------------------------------------------
      bot.fireCd -= dt;
      if (clearShot && dist < FIRE_RANGE && bot.fireCd <= 0) {
        bot.fireCd = bot.burst > 0 ? 0.13 : 1.1 + Math.random() * 1.2;
        if (bot.burst > 0) bot.burst--;
        else bot.burst = 2 + Math.floor(Math.random() * 3);

        TARGET.set(
          player.x + (Math.random() - 0.5) * (1.6 + dist * 0.045),
          1.2 + (Math.random() - 0.5) * 1.2,
          player.z + (Math.random() - 0.5) * (1.6 + dist * 0.045)
        );
        addTracer(EYE, TARGET, true);

        const accuracy = Math.max(0.12, 0.62 - dist * 0.008);
        if (Math.random() < accuracy) {
          store.damage(5 + Math.random() * 7);
        }
      }

      // bots caught outside the zone bleed out too
      if (zoneDist > store.zoneRadius) {
        bot.health -= 6 * dt;
        if (bot.health <= 0) {
          bot.alive = false;
          bot.dying = 0;
          store.pushFeed(`${bot.name} died outside the zone`);
        }
      }
    }

    const alive = aliveBots + (store.phase === "playing" ? 1 : 0);
    if (alive !== store.alive) store.setAlive(alive);
    if (aliveBots === 0 && store.phase === "playing") {
      useGameStore.setState({ phase: "won", alive: 1 });
    }
  });

  return (
    <group>
      {runtime.bots.map((bot) => (
        <BotView key={`${runSeed}-${bot.id}`} bot={bot} />
      ))}
    </group>
  );
}

function BotView({ bot }: { bot: Bot }) {
  const group = useRef<THREE.Group>(null);
  const [clip, setClip] = useState<SoldierClip>("idle");

  useFrame(() => {
    if (!group.current) return;
    group.current.position.set(bot.pos.x, 0, bot.pos.z);
    group.current.rotation.y = bot.yaw;
    group.current.visible = bot.alive || bot.dying < 6;
    const next: SoldierClip = !bot.alive
      ? "die"
      : bot.moving
        ? bot.aware
          ? "sprint"
          : "walk"
        : "idle";
    setClip((c) => (c === next ? c : next));
  });

  return (
    <group ref={group}>
      <Soldier url="/models/enemy.glb" tint="#b08a6a" clip={clip} />
    </group>
  );
}
