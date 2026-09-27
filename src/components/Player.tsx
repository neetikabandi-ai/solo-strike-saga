import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";
import { keys, look, mouse } from "../lib/input";
import { addTracer, runtime } from "../lib/runtime";
import { collides, moveWithCollision, rayBlocked, raySphere } from "../lib/world";
import { MAGAZINE_SIZE, useGameStore } from "../store/useGameStore";
import { Soldier, type SoldierClip } from "./Soldier";

const WALK = 5.4;
const SPRINT = 9;
const CROUCH = 2.6;
const ADS = 3.4;
const GRAVITY = 22;
const FIRE_INTERVAL = 0.1;
const RELOAD_TIME = 2.1;

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const MOVE = new THREE.Vector3();
const AIM = new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
const HIT = new THREE.Vector3();
const CAM_TARGET = new THREE.Vector3();
const LOOK_AT = new THREE.Vector3();
const HEAD = new THREE.Vector3();
const BODY = new THREE.Vector3();

export function Player() {
  const group = useRef<THREE.Group>(null);
  const [clip, setClip] = useState<SoldierClip>("idle");
  const vy = useRef(0);
  const height = useRef(0);
  const fireCd = useRef(0);
  const reloadT = useRef(0);
  const zoneTick = useRef(0);
  const recoil = useRef(0);

  useFrame(({ camera }, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    const store = useGameStore.getState();
    const playing = store.phase === "playing";
    const pos = runtime.player;

    // ---- movement -------------------------------------------------
    const k = keys;
    const crouching = k.has("ControlLeft") || k.has("KeyC");
    const fwd = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0);
    const strafe = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
    const sprinting =
      playing && k.has("ShiftLeft") && fwd > 0 && !mouse.aiming && !crouching;

    FORWARD.set(-Math.sin(look.yaw), 0, -Math.cos(look.yaw));
    RIGHT.set(Math.cos(look.yaw), 0, -Math.sin(look.yaw));

    let speed = crouching ? CROUCH : mouse.aiming ? ADS : sprinting ? SPRINT : WALK;
    MOVE.set(0, 0, 0);
    if (playing) {
      MOVE.addScaledVector(FORWARD, fwd).addScaledVector(RIGHT, strafe);
    }
    const moving = MOVE.lengthSq() > 0;
    if (moving) {
      MOVE.normalize().multiplyScalar(speed * dt);
      moveWithCollision(pos, MOVE.x, MOVE.z, 0.55);
    }

    // jump / gravity
    if (playing && k.has("Space") && height.current <= 0.001 && vy.current <= 0) {
      vy.current = 7.4;
    }
    vy.current -= GRAVITY * dt;
    height.current = Math.max(0, height.current + vy.current * dt);
    if (height.current === 0) vy.current = 0;

    const stance = crouching ? -0.45 : 0;
    if (group.current) {
      group.current.position.set(pos.x, height.current + stance, pos.z);
      group.current.rotation.y = look.yaw + Math.PI;
      group.current.visible = store.phase !== "menu";
    }
    runtime.playerYaw = look.yaw;
    runtime.playerAlive = playing;

    // ---- camera (third person, over the shoulder) -------------------
    const cp = Math.cos(look.pitch);
    AIM.set(-Math.sin(look.yaw) * cp, Math.sin(look.pitch), -Math.cos(look.yaw) * cp)
      .normalize();

    const dist = mouse.aiming ? 2.4 : 4.6;
    const shoulder = mouse.aiming ? 0.75 : 0.55;
    CAM_TARGET.copy(pos);
    CAM_TARGET.y += 1.75 + height.current + stance;
    CAM_TARGET.addScaledVector(RIGHT, shoulder);
    CAM_TARGET.addScaledVector(AIM, -dist);
    if (collides(CAM_TARGET.x, CAM_TARGET.z, 0.4)) {
      CAM_TARGET.copy(pos);
      CAM_TARGET.y += 2.1 + height.current;
      CAM_TARGET.addScaledVector(AIM, -1.6);
    }
    CAM_TARGET.y = Math.max(CAM_TARGET.y, 0.7);

    const smooth = 1 - Math.exp(-14 * dt);
    camera.position.lerp(CAM_TARGET, store.phase === "menu" ? 0.02 : smooth);
    LOOK_AT.copy(pos);
    LOOK_AT.y += 1.7 + height.current + stance;
    LOOK_AT.addScaledVector(AIM, 12);
    camera.lookAt(LOOK_AT);
    (camera as THREE.PerspectiveCamera).fov +=
      ((mouse.aiming ? 48 : 70) - (camera as THREE.PerspectiveCamera).fov) * smooth;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    if (!playing) {
      setClip((c) => (c === "idle" ? c : "idle"));
      return;
    }

    // ---- shooting ---------------------------------------------------
    fireCd.current -= dt;
    let firedThisFrame = false;

    if (reloadT.current > 0) {
      reloadT.current -= dt;
      if (reloadT.current <= 0) {
        const need = MAGAZINE_SIZE - store.mag;
        const take = Math.min(need, store.reserve);
        store.setMag(store.mag + take);
        store.setReserve(store.reserve - take);
        store.setReloading(false);
      }
    } else if (
      (k.has("KeyR") || store.mag === 0) &&
      store.mag < MAGAZINE_SIZE &&
      store.reserve > 0
    ) {
      reloadT.current = RELOAD_TIME;
      store.setReloading(true);
    }

    if (mouse.firing && fireCd.current <= 0 && store.mag > 0 && reloadT.current <= 0) {
      fireCd.current = FIRE_INTERVAL;
      store.setMag(store.mag - 1);
      firedThisFrame = true;
      runtime.muzzle = 0.05;

      // bullet spread: tighter while aiming and standing still
      const spread = (mouse.aiming ? 0.006 : 0.018) + (moving ? 0.014 : 0) + recoil.current * 0.01;
      const dir = AIM.clone();
      dir.x += (Math.random() - 0.5) * spread;
      dir.y += (Math.random() - 0.5) * spread;
      dir.z += (Math.random() - 0.5) * spread;
      dir.normalize();

      ORIGIN.copy(pos);
      ORIGIN.y += 1.55 + height.current + stance;

      let bestT = 140;
      let bestBot = -1;
      let head = false;
      for (const bot of runtime.bots) {
        if (!bot.alive) continue;
        HEAD.set(bot.pos.x, 1.55, bot.pos.z);
        BODY.set(bot.pos.x, 0.9, bot.pos.z);
        const th = raySphere(ORIGIN, dir, HEAD, 0.34);
        const tb = raySphere(ORIGIN, dir, BODY, 0.55);
        const t = th ?? tb;
        if (t !== null && t < bestT) {
          bestT = t;
          bestBot = bot.id;
          head = th !== null;
        }
      }

      const wallHit = rayBlocked(ORIGIN, dir, bestBot >= 0 ? bestT : 140);
      HIT.copy(ORIGIN).addScaledVector(dir, bestBot >= 0 ? bestT : 140);
      addTracer(ORIGIN, HIT, false);

      if (bestBot >= 0 && !wallHit) {
        const bot = runtime.bots[bestBot]!;
        bot.health -= head ? 62 : 24;
        bot.aware = true;
        store.markHit();
        if (bot.health <= 0) {
          bot.alive = false;
          bot.dying = 0;
          store.addKill(bot.name);
        }
      }

      recoil.current = Math.min(1, recoil.current + 0.35);
      look.pitch = Math.min(0.65, look.pitch + 0.0045 + recoil.current * 0.002);
    }
    recoil.current *= Math.exp(-4 * dt);

    // ---- blue zone damage -------------------------------------------
    const dxz = Math.hypot(pos.x - store.zoneX, pos.z - store.zoneZ);
    const outside = dxz > store.zoneRadius;
    if (outside !== !store.inZone) store.setInZone(!outside);
    if (outside) {
      zoneTick.current += dt;
      if (zoneTick.current >= 1) {
        zoneTick.current = 0;
        store.damage(4 + Math.min(10, (dxz - store.zoneRadius) * 0.08));
      }
    } else {
      zoneTick.current = 0;
    }

    // ---- animation state --------------------------------------------
    const next: SoldierClip = firedThisFrame || mouse.firing
      ? "shoot"
      : sprinting
        ? "sprint"
        : moving
          ? "walk"
          : "idle";
    setClip((c) => (c === next ? c : next));
  });

  return (
    <group ref={group}>
      <Soldier url="/models/soldier.glb" tint="#8fa06a" clip={clip} />
    </group>
  );
}
