import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { keys, look, mouse, pressed } from "../lib/input";
import { addTracer, BUS_ALT, busPos, carUnder, hurtBot, runtime, trainCars, TRAIN_ROOF, TRAIN_Y, updateTrain, type Chest } from "../lib/runtime";
import { clampMap, collides, findFree, groundAt, PADS, moveWithCollision, rayBlocked, raySphere } from "../lib/world";
import { RARITY, rollWeapon, WEAPONS } from "../lib/weapons";
import { STORM_DPS, useGameStore } from "../store/useGameStore";

const WALK = 6;
const SPRINT = 9.5;
const CROUCH = 3;
const ADS = 3.8;
const GRAVITY = 22;

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const MOVE = new THREE.Vector3();
const AIM = new THREE.Vector3();
const EYE = new THREE.Vector3();
const HIT = new THREE.Vector3();
const MUZ = new THREE.Vector3();
const HEAD = new THREE.Vector3();
const BODY = new THREE.Vector3();
const BUS = new THREE.Vector3();
const DIR = new THREE.Vector3();

export function Player() {
  const vy = useRef(0);
  const height = useRef(0);
  const fireCd = useRef(0);
  const reloadT = useRef(0);
  const useT = useRef(0);
  const useKind = useRef<"shield" | "med">("shield");
  const zoneTick = useRef(0);
  const recoil = useRef(0);
  const bobT = useRef(0);

  useFrame(({ camera, clock }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const store = useGameStore.getState();
    const phase = store.phase;
    const cam = camera as THREE.PerspectiveCamera;
    const pos = runtime.player;
    const set = useGameStore.setState;

    if (phase === "bus" || phase === "dive" || phase === "playing") runtime.clock += dt;
    const prevCars = trainCars.map((c) => ({ ...c }));
    updateTrain(phase === "menu" ? clock.elapsedTime : runtime.clock);

    // ---- teleport menu request -----------------------------------
    if (runtime.teleport && (phase === "playing" || phase === "dive" || phase === "bus")) {
      const t = runtime.teleport;
      runtime.teleport = null;
      runtime.driving = -1;

      if (t.train) {
        const lead = trainCars[0]!;
        runtime.ridingTrain = 0;
        pos.set(lead.x, TRAIN_Y + 0.5, lead.z);
        height.current = TRAIN_Y + 0.5;
        look.yaw = lead.yaw;
      } else {
        runtime.ridingTrain = -1;
        pos.set(t.x, 0, t.z);
        height.current = Math.max(groundAt(t.x, t.z, 400), 0);
        pos.y = height.current;
      }

      vy.current = 0;
      reloadT.current = 0;
      useT.current = 0;
      runtime.gliding = false;
      runtime.grace = Math.max(runtime.grace, 2);
      set({ phase: "playing", prompt: null, reloading: false, using: null });
      pressed.clear();
      mouse.clicked = false;
      return;
    }

    // ---- riding inside the train passenger cabin -----------------
    if (runtime.ridingTrain >= 0) {
      const carIdx = runtime.ridingTrain;
      const pc = prevCars[carIdx]!, nc = trainCars[carIdx]!;

      let dyaw = nc.yaw - pc.yaw;
      if (dyaw > Math.PI) dyaw -= Math.PI * 2;
      if (dyaw < -Math.PI) dyaw += Math.PI * 2;
      look.yaw += dyaw;

      pos.set(nc.x, TRAIN_Y + 0.5, nc.z);
      height.current = TRAIN_Y + 0.5;
      vy.current = 0;
      runtime.view.ads = false;

      const cp = Math.cos(look.pitch);
      AIM.set(-Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp).normalize();
      
      EYE.set(pos.x, pos.y + 1.2, pos.z);
      cam.position.copy(EYE);
      cam.lookAt(EYE.x + AIM.x, EYE.y + AIM.y, EYE.z + AIM.z);
      setFov(85);

      const promptText = "Press E to exit train";
      if (store.prompt !== promptText) set({ prompt: promptText });

      if (pressed.has("KeyE")) {
        runtime.ridingTrain = -1;
        height.current = TRAIN_ROOF;
        pos.y = TRAIN_ROOF;
        set({ prompt: null });
      }

      pressed.clear();
      mouse.clicked = false;
      return;
    }

    const cp = Math.cos(look.pitch);
    AIM.set(-Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp).normalize();
    FORWARD.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    RIGHT.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));
    runtime.playerYaw = look.yaw;

    const setFov = (f: number) => {
      cam.fov += (f - cam.fov) * (1 - Math.exp(-14 * dt));
      cam.updateProjectionMatrix();
    };

    const k = keys;
    const fwd = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    const strafe = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);

    // ---- menu: slow flyover ---------------------------------------
    if (phase === "menu") {
      const t = clock.elapsedTime * 0.05;
      cam.position.set(Math.cos(t) * 420, 200, Math.sin(t) * 420);
      cam.lookAt(0, 0, 0);
      setFov(70);
      pressed.clear();
      mouse.clicked = false;
      return;
    }

    // ---- riding the battle bus -----------------------------------
    if (phase === "bus") {
      const t = runtime.clock / runtime.bus.dur;
      busPos(t, BUS);
      pos.set(BUS.x, 0, BUS.z);
      height.current = BUS_ALT - 3;
      runtime.altitude = height.current;
      cam.position.copy(BUS).addScaledVector(AIM, -26);
      cam.position.y += 6;
      cam.lookAt(BUS.x + AIM.x * 10, BUS.y + 2 + AIM.y * 10, BUS.z + AIM.z * 10);
      setFov(75);
      if (pressed.has("Space") || t >= 1) {
        set({ phase: "dive" });
        look.pitch = -0.9;
      }
      pressed.clear();
      mouse.clicked = false;
      return;
    }

    // ---- skydive + glider ----------------------------------------
    if (phase === "dive") {
      const glide = height.current < 75;
      runtime.gliding = glide;
      const diving = !glide && look.pitch < -0.6 && fwd > 0;
      const fall = glide ? 10 : diving ? 42 : 26;
      const hs = glide ? 17 : diving ? 14 : 22;
      MOVE.set(0, 0, 0).addScaledVector(FORWARD, fwd).addScaledVector(RIGHT, strafe);
      if (MOVE.lengthSq() > 0) {
        MOVE.normalize().multiplyScalar(hs * dt);
        pos.x = clampMap(pos.x + MOVE.x);
        pos.z = clampMap(pos.z + MOVE.z);
      }
      height.current -= fall * dt;
      const floorY = groundAt(pos.x, pos.z, height.current + 200);
      runtime.altitude = Math.max(0, height.current);
      if (height.current <= floorY) {
        height.current = floorY;
        vy.current = 0;
        if (floorY <= 0) {
          const spot = findFree(pos.x, pos.z, 0.7);
          pos.set(spot.x, 0, spot.z);
        } else pos.y = floorY;
        runtime.grace = 4;
        runtime.gliding = false;
        look.pitch = -0.05;
        set({ phase: "playing" });
      }
      EYE.set(pos.x, height.current + 1.6, pos.z);
      if (glide) {
        cam.position.copy(EYE).addScaledVector(AIM, -9);
        cam.position.y += 3;
        cam.lookAt(EYE.x + AIM.x * 6, EYE.y + AIM.y * 6, EYE.z + AIM.z * 6);
      } else {
        cam.position.copy(EYE);
        cam.lookAt(EYE.x + AIM.x, EYE.y + AIM.y, EYE.z + AIM.z);
      }
      setFov(glide ? 80 : 90);
      pressed.clear();
      mouse.clicked = false;
      return;
    }

    if (phase !== "playing") {
      pressed.clear();
      mouse.clicked = false;
      return;
    }

    // ---- vehicles ------------------------------------------------
    if (runtime.driving >= 0) {
      const v = runtime.vehicles[runtime.driving]!;
      const max = k.has("ShiftLeft") ? 38 : 26;
      if (fwd > 0) v.speed = Math.min(max, v.speed + 18 * dt);
      else if (fwd < 0) v.speed = Math.max(-9, v.speed - 22 * dt);
      else v.speed *= Math.exp(-1.2 * dt);
      if (k.has("Space")) v.speed *= Math.exp(-4 * dt);
      const steer = Math.min(1, Math.abs(v.speed) / 6) * Math.sign(v.speed);
      v.yaw -= strafe * 1.9 * steer * dt;
      const nx = clampMap(v.x - Math.sin(v.yaw) * v.speed * dt);
      const nz = clampMap(v.z - Math.cos(v.yaw) * v.speed * dt);
      if (collides(nx, nz, 1.6)) v.speed *= -0.3;
      else {
        v.x = nx;
        v.z = nz;
      }
      pos.set(v.x, 0, v.z);
      height.current = 0;
      runtime.view.ads = false;
      const cy = v.yaw + (look.yaw - v.yaw) * 0;
      look.yaw += (v.yaw - look.yaw) * (1 - Math.exp(-3 * dt));
      cam.position.set(v.x + Math.sin(look.yaw) * 9, 4.2, v.z + Math.cos(look.yaw) * 9);
      cam.lookAt(v.x - Math.sin(cy) * 4, 1.4, v.z - Math.cos(cy) * 4);
      setFov(80 + Math.abs(v.speed) * 0.3);
      const pr = "Press E to exit vehicle";
      if (store.prompt !== pr) set({ prompt: pr });
      if (pressed.has("KeyE")) {
        v.speed = 0;
        runtime.driving = -1;
        const spot = findFree(v.x + Math.cos(v.yaw) * 2.5, v.z - Math.sin(v.yaw) * 2.5, 0.6);
        pos.set(spot.x, 0, spot.z);
        set({ prompt: null });
      }
      pressed.clear();
      mouse.clicked = false;
      return;
    }

    // ---- launch pads ---------------------------------------------
    if (height.current < 0.5) {
      for (const pad of PADS) {
        if (Math.abs(pad.x - pos.x) < 1.6 && Math.abs(pad.z - pos.z) < 1.6) {
          height.current = 70;
          vy.current = 0;
          set({ phase: "dive", prompt: null, reloading: false, using: null });
          reloadT.current = 0;
          useT.current = 0;
          pressed.clear();
          mouse.clicked = false;
          return;
        }
      }
    }

    // ---- on foot -------------------------------------------------
    const crouching = k.has("ControlLeft") || k.has("KeyC");
    const w = store.slots[store.slot] ?? null;
    const spec = w ? WEAPONS[w.kind] : null;
    const aiming = mouse.aiming && !!w;
    const sprinting = k.has("ShiftLeft") && fwd > 0 && !aiming && !crouching && useT.current <= 0;
    const speed = crouching ? CROUCH : aiming ? ADS : sprinting ? SPRINT : useT.current > 0 ? ADS : WALK;
    MOVE.set(0, 0, 0).addScaledVector(FORWARD, fwd).addScaledVector(RIGHT, strafe);
    const moving = MOVE.lengthSq() > 0;
    if (moving) {
      MOVE.normalize().multiplyScalar(speed * dt);
      moveWithCollision(pos, MOVE.x, MOVE.z, 0.45, height.current);
    }
    let floor = groundAt(pos.x, pos.z, height.current);
    if (height.current >= TRAIN_ROOF - 0.8 && carUnder(pos.x, pos.z) >= 0) floor = Math.max(floor, TRAIN_ROOF);
    const onGround = height.current <= floor + 0.001;
    if (k.has("Space") && onGround && vy.current <= 0) vy.current = 7.2;
    vy.current -= GRAVITY * dt;
    height.current += vy.current * dt;

    if (vy.current > 0 && collides(pos.x, pos.z, 0.3, height.current)) {
      height.current -= vy.current * dt;
      vy.current = 0;
    }
    floor = groundAt(pos.x, pos.z, Math.max(height.current, floor));

    const car = carUnder(pos.x, pos.z);
    if (car >= 0 && height.current >= TRAIN_ROOF - 0.8 && vy.current <= 0) {
      floor = Math.max(floor, TRAIN_ROOF);
      const pc = prevCars[car]!, nc = trainCars[car]!;
      if (height.current <= TRAIN_ROOF + 0.05) {
        let dyaw = nc.yaw - pc.yaw;
        if (dyaw > Math.PI) dyaw -= Math.PI * 2;
        if (dyaw < -Math.PI) dyaw += Math.PI * 2;
        const rx = pos.x - pc.x, rz = pos.z - pc.z;
        const cs = Math.cos(dyaw), sn = Math.sin(dyaw);
        pos.x = nc.x + rx * cs + rz * sn;
        pos.z = nc.z - rx * sn + rz * cs;
        look.yaw += dyaw;
      }
    }
    if (height.current <= floor) {
      height.current = floor;
      vy.current = 0;
    }
    pos.y = height.current;
    runtime.altitude = height.current;

    if (moving && height.current <= floor + 0.001) bobT.current += dt * (sprinting ? 13 : 9);
    runtime.view.bob = Math.sin(bobT.current) * (moving ? (sprinting ? 0.03 : 0.015) : 0);
    runtime.view.ads = aiming;

    const eyeH = crouching ? 1.1 : 1.62;
    EYE.set(pos.x, height.current + eyeH, pos.z);
    cam.position.copy(EYE);
    cam.lookAt(EYE.x + AIM.x, EYE.y + AIM.y, EYE.z + AIM.z);
    setFov(aiming && spec ? spec.adsFov : 80);

    // ---- weapon slots & consumables ------------------------------
    const cancelActions = () => {
      reloadT.current = 0;
      useT.current = 0;
      set({ reloading: false, using: null });
    };
    (["Digit1", "Digit2", "Digit3"] as const).forEach((code, idx) => {
      if (pressed.has(code) && store.slot !== idx) {
        cancelActions();
        set({ slot: idx });
      }
    });
    if (pressed.has("Digit4") && useT.current <= 0 && store.potions.shield > 0 && store.shield < 100) {
      reloadT.current = 0;
      useT.current = 2;
      useKind.current = "shield";
      set({ using: "Drinking Shield Potion…", reloading: false });
    }
    if (pressed.has("Digit5") && useT.current <= 0 && store.potions.med > 0 && store.health < 100) {
      reloadT.current = 0;
      useT.current = 4;
      useKind.current = "med";
      set({ using: "Using Medkit…", reloading: false });
    }
    if (useT.current > 0) {
      useT.current -= dt;
      if (useT.current <= 0) {
        const cur = useGameStore.getState();
        if (useKind.current === "shield") {
          set({ shield: Math.min(100, cur.shield + 50), potions: { ...cur.potions, shield: cur.potions.shield - 1 }, using: null });
        } else {
          set({ health: 100, potions: { ...cur.potions, med: cur.potions.med - 1 }, using: null });
        }
      }
    }

    // ---- chests & train/car mounts -------------------------------
    let near: Chest | null = null;
    let nd = 2.8;
    for (const c of runtime.chests) {
      if (c.opened || Math.abs(c.y - height.current) > 2) continue;
      const d = Math.hypot(c.x - pos.x, c.z - pos.z);
      if (d < nd) {
        nd = d;
        near = c;
      }
    }

    let nearCar = -1;
    for (const v of runtime.vehicles) if (Math.hypot(v.x - pos.x, v.z - pos.z) < 3.5) nearCar = v.id;

    let nearTrainCar = -1;
    for (let i = 0; i < trainCars.length; i++) {
      const tc = trainCars[i]!;
      const d = Math.hypot(tc.x - pos.x, tc.z - pos.z);
      if (d < 4.5 && Math.abs(height.current - TRAIN_Y) < 4.5) {
        nearTrainCar = i;
        break;
      }
    }

    const prompt = near 
      ? "Press F to open chest" 
      : nearTrainCar >= 0 
        ? "Press E to board train" 
        : nearCar >= 0 
          ? "Press E to drive" 
          : null;

    if (prompt !== store.prompt) set({ prompt });

    if (nearTrainCar >= 0 && pressed.has("KeyE")) {
      cancelActions();
      runtime.ridingTrain = nearTrainCar;
      look.yaw = trainCars[nearTrainCar]!.yaw;
      set({ prompt: null });
    } else if (nearCar >= 0 && pressed.has("KeyE")) {
      cancelActions();
      runtime.driving = nearCar;
      look.yaw = runtime.vehicles[nearCar]!.yaw;
      set({ prompt: null });
    }

    if (near && pressed.has("KeyF")) {
      near.opened = true;
      runtime.chestVersion++;
      const cur = useGameStore.getState();
      const loot = rollWeapon();
      const slots = [...cur.slots];
      const empty = slots.indexOf(null);
      const idx = empty >= 0 ? empty : cur.slot;
      if (idx === cur.slot) cancelActions();
      slots[idx] = loot;
      const ammo = { ...cur.ammo, [loot.kind]: cur.ammo[loot.kind] + WEAPONS[loot.kind].mag * 2 };
      const potions = { ...cur.potions };
      const extras: string[] = [];
      if (Math.random() < 0.6) {
        potions.shield++;
        extras.push("Shield Potion");
      }
      if (Math.random() < 0.3) {
        potions.med++;
        extras.push("Medkit");
      }
      set({ slots, ammo, potions });
      cur.pushFeed(`Chest: ${RARITY[loot.rarity]!.name} ${WEAPONS[loot.kind].name}${extras.length ? " + " + extras.join(" + ") : ""}`);
    }

    // ---- shooting ------------------------------------------------
    fireCd.current -= dt;
    if (w && spec) {
      if (reloadT.current > 0) {
        reloadT.current -= dt;
        if (reloadT.current <= 0) {
          const cur = useGameStore.getState();
          const cw = cur.slots[cur.slot];
          if (cw) {
            const take = Math.min(WEAPONS[cw.kind].mag - cw.mag, cur.ammo[cw.kind]);
            const slots = [...cur.slots];
            slots[cur.slot] = { ...cw, mag: cw.mag + take };
            set({ slots, ammo: { ...cur.ammo, [cw.kind]: cur.ammo[cw.kind] - take }, reloading: false });
          }
        }
      } else if ((pressed.has("KeyR") || w.mag === 0) && w.mag < spec.mag && store.ammo[w.kind] > 0 && useT.current <= 0) {
        reloadT.current = spec.reload;
        set({ reloading: true });
      }

      const trigger = spec.auto ? mouse.firing : mouse.clicked;
      if (trigger && fireCd.current <= 0 && w.mag > 0 && reloadT.current <= 0 && useT.current <= 0) {
        fireCd.current = spec.interval;
        const slots = [...store.slots];
        slots[store.slot] = { ...w, mag: w.mag - 1 };
        set({ slots });
        runtime.muzzle = 0.06;
        MUZ.copy(EYE).addScaledVector(RIGHT, 0.22).addScaledVector(AIM, 0.6);
        MUZ.y -= 0.18;
        const baseSpread = (aiming ? spec.adsSpread : spec.spread) + (moving ? 0.01 : 0) + recoil.current * 0.008;
        let hitAny = false;
        for (let p = 0; p < spec.pellets; p++) {
          DIR.copy(AIM);
          DIR.x += (Math.random() - 0.5) * baseSpread * 2;
          DIR.y += (Math.random() - 0.5) * baseSpread * 2;
          DIR.z += (Math.random() - 0.5) * baseSpread * 2;
          DIR.normalize();
          let bestT = spec.range * 2;
          let best = -1;
          let head = false;
          for (const bot of runtime.bots) {
            if (!bot.landed && runtime.clock >= bot.landAt) bot.landed = true;
            if (!bot.alive || !bot.landed) continue;
            if (Math.abs(bot.pos.x - pos.x) > bestT || Math.abs(bot.pos.z - pos.z) > bestT) continue;
            HEAD.set(bot.pos.x, 1.6, bot.pos.z);
            BODY.set(bot.pos.x, 0.95, bot.pos.z);
            const th = raySphere(EYE, DIR, HEAD, 0.45);
            const tb = raySphere(EYE, DIR, BODY, 0.75);
            const t = th ?? tb;
            if (t !== null && t < bestT) {
              bestT = t;
              best = bot.id;
              head = th !== null;
            }
          }
          const reach = best >= 0 ? bestT : spec.range * 2;
          const blocked = rayBlocked(EYE, DIR, Math.max(0, reach - 0.6));
          HIT.copy(EYE).addScaledVector(DIR, reach);
          if (p < 3) addTracer(MUZ, HIT, false);
          if (best >= 0 && !blocked) {
            const bot = runtime.bots[best]!;
            const falloff = bestT > spec.range ? 0.5 : 1;
            const dmg = spec.dmg * RARITY[w.rarity]!.mul * (head ? spec.head : 1) * falloff;
            bot.aware = true;
            hitAny = true;
            if (hurtBot(bot, dmg)) store.addKill(bot.name);
          }
        }
        if (hitAny) store.markHit();
        recoil.current = Math.min(1, recoil.current + (spec.pellets > 1 || spec.mag === 1 ? 1 : 0.3));
        look.pitch = Math.min(1.3, look.pitch + 0.004 + recoil.current * (spec.mag <= 5 ? 0.02 : 0.002));
      }
    }
    recoil.current *= Math.exp(-5 * dt);

    // ---- storm damage (health only) ------------------------------
    const dxz = Math.hypot(pos.x - store.zoneX, pos.z - store.zoneZ);
    const outside = dxz > store.zoneRadius;
    if (outside === store.inZone) set({ inZone: !outside });
    if (outside) {
      zoneTick.current += dt;
      if (zoneTick.current >= 1) {
        zoneTick.current = 0;
        store.stormDamage(STORM_DPS[store.stormStage] ?? 12);
      }
    } else zoneTick.current = 0;

    pressed.clear();
    mouse.clicked = false;
  });

  return null;
}