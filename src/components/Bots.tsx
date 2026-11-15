import { useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { addTracer, hurtBot, runtime, type Bot } from "../lib/runtime";
import { clampMap, collides, findFree, MAP_HALF, moveWithCollision, rayBlocked } from "../lib/world";
import { applyBotConsumable, BOT_AIRCRAFT_BOARD_RANGE, BOT_CAR_BOARD_RANGE, canBotBoardVehicle, chooseBotConsumable } from "../lib/botActions";
import { useGameStore } from "../store/useGameStore";
import { Soldier, type SoldierClip } from "./Soldier";

const SIGHT = 55;
const FIRE_RANGE = 48;
const BOT_SPEED = 4.2;

function releaseBotVehicle(bot: Bot) {
  if (!bot.vehicle) return;
  if (bot.vehicle.kind === "aircraft") {
    const aircraft = runtime.aircraft[bot.vehicle.id];
    if (aircraft?.pilotBotId === bot.id) aircraft.pilotBotId = null;
  } else {
    const vehicle = runtime.vehicles[bot.vehicle.id];
    if (vehicle?.botDriver === bot.id) vehicle.botDriver = null;
  }
  bot.vehicle = null;
  bot.vehicleTime = 0;
}

function turnToward(current: number, target: number, maxTurn: number, dt: number) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + THREE.MathUtils.clamp(diff, -maxTurn * dt, maxTurn * dt);
}

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

    if (runtime.grace > 0) runtime.grace -= dt;

    const player = runtime.player;
    let aliveBots = 0;

    for (const bot of runtime.bots) {
      if (!bot.alive) {
        releaseBotVehicle(bot);
        bot.dying += dt;
        continue;
      }
      aliveBots++;
      if (!bot.landed && runtime.clock >= bot.landAt) bot.landed = true;

      EYE.set(bot.pos.x, bot.pos.y + 1.5, bot.pos.z);

      // --- choose an enemy: the player, or another bot ---------------
      const toPlayer = Math.hypot(player.x - bot.pos.x, player.z - bot.pos.z);
      TARGET.set(player.x, player.y + 1.4, player.z);
      RAY.copy(TARGET).sub(EYE);
      const dist = RAY.length();
      RAY.normalize();
      const playerVisible =
        runtime.grace <= 0 &&
        dist < SIGHT &&
        !rayBlocked(EYE, RAY, dist - 0.6);

      // find / keep a bot target
      let foe = runtime.bots.find((b) => b.id === bot.target && b.alive);
      if (!foe) {
        bot.target = -1;
        let best = Infinity;
        for (const other of runtime.bots) {
          if (other === bot || !other.alive) continue;
          const d = Math.hypot(other.pos.x - bot.pos.x, other.pos.z - bot.pos.z);
          if (d < SIGHT && d < best) {
            TARGET.set(other.pos.x, other.pos.y + 1.4, other.pos.z);
            RAY.copy(TARGET).sub(EYE).normalize();
            if (!rayBlocked(EYE, RAY, d - 0.6)) {
              best = d;
              bot.target = other.id;
            }
          }
        }
        foe = runtime.bots.find((b) => b.id === bot.target && b.alive);
      }

      // prefer whichever enemy is closer; player only after grace
      let foeDist = Infinity;
      let foeX = 0;
      let foeZ = 0;
      if (foe) {
        foeDist = Math.hypot(foe.pos.x - bot.pos.x, foe.pos.z - bot.pos.z);
        TARGET.set(foe.pos.x, foe.pos.y + 1.4, foe.pos.z);
        RAY.copy(TARGET).sub(EYE);
        RAY.normalize();
        if (foeDist >= SIGHT || rayBlocked(EYE, RAY, foeDist - 0.6)) {
          foe = undefined;
          bot.target = -1;
        } else {
          foeX = foe.pos.x;
          foeZ = foe.pos.z;
        }
      }

      const fightPlayer = playerVisible && (!foe || dist <= foeDist);
      const engaged = fightPlayer || !!foe;
      if (engaged) bot.aware = true;

      const enemyX = fightPlayer ? player.x : foeX;
      const enemyZ = fightPlayer ? player.z : foeZ;
      const enemyDist = fightPlayer ? dist : foeDist;

      // --- pick a destination -------------------------------------
      bot.repath -= dt;
      const zoneDx = bot.pos.x - store.zoneX;
      const zoneDz = bot.pos.z - store.zoneZ;
      const zoneDist = Math.hypot(zoneDx, zoneDz);
      const outside = zoneDist > store.zoneRadius;
      // rotate early: keep a safety margin from the storm wall
      const mustRotate = zoneDist > store.zoneRadius * 0.75 - 15;
      const lowHp = bot.health < 60 && bot.shield <= 0;
      if (outside) bot.repath = Math.min(bot.repath, 0.3);
      bot.healCooldown = Math.max(0, bot.healCooldown - dt);
      if (bot.healCooldown <= 0) {
        const consumable = chooseBotConsumable({
          health: bot.health,
          shield: bot.shield,
          medkits: bot.medkits,
          shieldPotions: bot.shieldPotions,
        }, engaged);
        if (consumable) {
          const healed = applyBotConsumable({
            health: bot.health,
            shield: bot.shield,
            medkits: bot.medkits,
            shieldPotions: bot.shieldPotions,
          }, consumable);
          bot.health = healed.health;
          bot.shield = healed.shield;
          bot.medkits = healed.medkits;
          bot.shieldPotions = healed.shieldPotions;
          bot.healCooldown = consumable === "med" ? 4 : 2;
        }
      }

      if (bot.repath <= 0) {
        bot.repath = 1.4 + Math.random() * 1.6;
        if (outside) {
          // run straight for the safe zone, no detours
          bot.dest.set(store.zoneX, 0, store.zoneZ);
          bot.repath = 0.5;
        } else if (engaged && lowHp) {
          // retreat away from the enemy, toward the zone center
          const ax = bot.pos.x - enemyX + (store.zoneX - bot.pos.x) * 0.02;
          const az = bot.pos.z - enemyZ + (store.zoneZ - bot.pos.z) * 0.02;
          const n = Math.hypot(ax, az) || 1;
          bot.dest.set(bot.pos.x + (ax / n) * 25, 0, bot.pos.z + (az / n) * 25);
        } else if (mustRotate) {
          const ang = Math.random() * Math.PI * 2;
          const r = store.zoneRadius * 0.4 * Math.random();
          bot.dest.set(store.zoneX + Math.cos(ang) * r, 0, store.zoneZ + Math.sin(ang) * r);
        } else if (engaged) {
          // close in, but keep a fighting distance and strafe
          const side = Math.random() > 0.5 ? 1 : -1;
          const ang = Math.atan2(bot.pos.z - enemyZ, bot.pos.x - enemyX) + side * 0.6;
          const keep = 14 + Math.random() * 6;
          bot.dest.set(enemyX + Math.cos(ang) * keep, 0, enemyZ + Math.sin(ang) * keep);
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
      bot.moving = !!bot.vehicle || destDist > 1.2;
      if (bot.vehicle?.kind === "aircraft") {
        const aircraft = runtime.aircraft[bot.vehicle.id];
        if (!aircraft || aircraft.pilotBotId !== bot.id) {
          bot.vehicle = null;
          bot.vehicleTime = 0;
        } else {
          bot.vehicleTime -= dt;
          const returning = bot.vehicleTime <= 0;
          const targetX = returning ? aircraft.home.x : bot.dest.x;
          const targetZ = returning ? aircraft.home.z : bot.dest.z;
          const targetAltitude = returning
            ? aircraft.home.y
            : aircraft.kind === "jet"
              ? 65
              : THREE.MathUtils.clamp(aircraft.home.y, 45, 85);
          const dx = targetX - aircraft.x;
          const dz = targetZ - aircraft.z;
          const distance = Math.hypot(dx, dz);
          const targetYaw = Math.atan2(-dx, -dz);
          aircraft.yaw = turnToward(aircraft.yaw, targetYaw, aircraft.kind === "jet" ? 0.45 : 0.85, dt);
          const cruiseSpeed = aircraft.kind === "jet" ? 78 : 25;
          const speedTarget = returning ? Math.min(cruiseSpeed, Math.max(12, distance * 0.65)) : cruiseSpeed;
          aircraft.speed += (speedTarget - aircraft.speed) * (1 - Math.exp(-1.8 * dt));
          aircraft.x = clampMap(aircraft.x - Math.sin(aircraft.yaw) * aircraft.speed * dt);
          aircraft.z = clampMap(aircraft.z - Math.cos(aircraft.yaw) * aircraft.speed * dt);
          const altitudeDelta = targetAltitude - aircraft.y;
          const climbRate = aircraft.kind === "jet" ? 11 : 8;
          aircraft.y += THREE.MathUtils.clamp(altitudeDelta, -climbRate * dt, climbRate * dt);
          aircraft.pitch = THREE.MathUtils.clamp(altitudeDelta * 0.025, -0.45, 0.45);
          bot.pos.set(aircraft.x, aircraft.y, aircraft.z);
          bot.yaw = aircraft.yaw;
          if (returning && distance < 22 && Math.abs(aircraft.y - aircraft.home.y) < 4) {
            const spot = findFree(aircraft.x, aircraft.z, 0.8);
            releaseBotVehicle(bot);
            bot.pos.set(spot.x, 0, spot.z);
            bot.repath = 0;
          }
        }
      } else if (bot.vehicle?.kind === "car") {
        const vehicle = runtime.vehicles[bot.vehicle.id];
        if (!vehicle || vehicle.botDriver !== bot.id) {
          bot.vehicle = null;
          bot.vehicleTime = 0;
        } else {
          bot.vehicleTime -= dt;
          const dx = bot.dest.x - vehicle.x;
          const dz = bot.dest.z - vehicle.z;
          const distance = Math.hypot(dx, dz);
          const targetYaw = Math.atan2(-dx, -dz);
          vehicle.yaw = turnToward(vehicle.yaw, targetYaw, 1.4, dt);
          vehicle.speed += (16 - vehicle.speed) * (1 - Math.exp(-1.4 * dt));
          const nx = clampMap(vehicle.x - Math.sin(vehicle.yaw) * vehicle.speed * dt);
          const nz = clampMap(vehicle.z - Math.cos(vehicle.yaw) * vehicle.speed * dt);
          if (!collides(nx, nz, 1.5, 0)) {
            vehicle.x = nx;
            vehicle.z = nz;
          } else {
            vehicle.yaw += (bot.id % 2 === 0 ? 1 : -1) * 0.8;
            vehicle.speed *= 0.55;
          }
          bot.pos.set(vehicle.x, 0, vehicle.z);
          bot.yaw = vehicle.yaw;
          if (bot.vehicleTime <= 0) {
            const spot = findFree(vehicle.x + Math.cos(vehicle.yaw) * 3, vehicle.z - Math.sin(vehicle.yaw) * 3, 0.8);
            releaseBotVehicle(bot);
            vehicle.speed = 0;
            bot.pos.set(spot.x, 0, spot.z);
            bot.repath = 0;
          }
        }
      } else if (bot.moving) {
        DIR.normalize();
        const sp = outside ? BOT_SPEED * 1.7 : mustRotate || lowHp ? BOT_SPEED * 1.4 : BOT_SPEED;
        const bx = bot.pos.x, bz = bot.pos.z;
        moveWithCollision(bot.pos, DIR.x * sp * dt, DIR.z * sp * dt, 0.55, bot.pos.y);
        // stuck on a wall? slide sideways
        if (Math.hypot(bot.pos.x - bx, bot.pos.z - bz) < sp * dt * 0.2) {
          const side = bot.id % 2 ? 1 : -1;
          moveWithCollision(bot.pos, -DIR.z * side * sp * dt, DIR.x * side * sp * dt, 0.55);
        }
      }

      if (!bot.vehicle && !engaged && !outside && bot.landed) {
        let boardedAircraft = -1;
        let boardedCar = -1;
        let nearestDistance = Infinity;
        for (const aircraft of runtime.aircraft) {
          if (aircraft.pilotBotId !== null || runtime.piloting === aircraft.id) continue;
          const d = Math.hypot(aircraft.x - bot.pos.x, aircraft.z - bot.pos.z);
          const range = aircraft.kind === "jet" ? BOT_CAR_BOARD_RANGE : BOT_AIRCRAFT_BOARD_RANGE;
          if (canBotBoardVehicle(d, false, range) && d < nearestDistance) {
            nearestDistance = d;
            boardedAircraft = aircraft.id;
            boardedCar = -1;
          }
        }
        for (const vehicle of runtime.vehicles) {
          if (vehicle.botDriver !== null || runtime.driving === vehicle.id) continue;
          const d = Math.hypot(vehicle.x - bot.pos.x, vehicle.z - bot.pos.z);
          if (canBotBoardVehicle(d, false, BOT_CAR_BOARD_RANGE) && d < nearestDistance) {
            nearestDistance = d;
            boardedCar = vehicle.id;
            boardedAircraft = -1;
          }
        }
        if (boardedAircraft >= 0) {
          const aircraft = runtime.aircraft[boardedAircraft];
          if (aircraft) {
            bot.vehicle = { kind: "aircraft", id: aircraft.id };
            bot.vehicleTime = 12 + Math.random() * 16;
            aircraft.pilotBotId = bot.id;
            aircraft.speed = Math.max(aircraft.speed, aircraft.kind === "jet" ? 18 : 0);
            bot.pos.set(aircraft.x, aircraft.y, aircraft.z);
            bot.yaw = aircraft.yaw;
          }
        } else if (boardedCar >= 0) {
          const vehicle = runtime.vehicles[boardedCar];
          if (vehicle) {
            bot.vehicle = { kind: "car", id: vehicle.id };
            bot.vehicleTime = 12 + Math.random() * 18;
            vehicle.botDriver = bot.id;
            bot.pos.set(vehicle.x, 0, vehicle.z);
            bot.yaw = vehicle.yaw;
          }
        }
      }

      // face the enemy when engaged, otherwise face travel direction
      const faceX = engaged ? enemyX - bot.pos.x : bot.dest.x - bot.pos.x;
      const faceZ = engaged ? enemyZ - bot.pos.z : bot.dest.z - bot.pos.z;
      const wantYaw = Math.atan2(faceX, faceZ);
      let diff = wantYaw - bot.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      bot.yaw += diff * (1 - Math.exp(-8 * dt));

      // --- shooting -------------------------------------------------
      bot.fireCd -= dt;
      if (engaged && enemyDist < FIRE_RANGE && bot.fireCd <= 0) {
        bot.fireCd = bot.burst > 0 ? 0.13 : 1.1 + Math.random() * 1.2;
        if (bot.burst > 0) bot.burst--;
        else bot.burst = 2 + Math.floor(Math.random() * 3);

        TARGET.set(
          enemyX + (Math.random() - 0.5) * (1.6 + enemyDist * 0.045),
          1.2 + (Math.random() - 0.5) * 1.2,
          enemyZ + (Math.random() - 0.5) * (1.6 + enemyDist * 0.045)
        );
        addTracer(EYE, TARGET, true);

        const accuracy = Math.max(0.1, 0.5 - enemyDist * 0.008);
        if (Math.random() < accuracy) {
          if (fightPlayer) {
            store.damage(4 + Math.random() * 6);
          } else if (foe) {
            foe.aware = true;
            if (foe.target < 0) foe.target = bot.id;
            if (hurtBot(foe, 9 + Math.random() * 8)) {
              store.pushFeed(`${bot.name} eliminated ${foe.name}`);
              if (bot.target === foe.id) bot.target = -1;
            }
          }
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
    if (alive !== store.alive) useGameStore.setState({ alive });
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
    group.current.position.set(bot.pos.x, bot.pos.y, bot.pos.z);
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
