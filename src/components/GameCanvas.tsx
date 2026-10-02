import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { Suspense, useEffect, useRef } from "react";
import { installInput } from "../lib/input";
import { initRun } from "../lib/runtime";
import { Bots } from "./Bots";
import { HUD } from "./HUD";
import { Player } from "./Player";
import { Ground, Structures } from "./Terrain";
import { Tracers } from "./Tracers";
import { BattleBus } from "./BattleBus";
import { ViewModel } from "./ViewModel";
import { GliderAvatar, LaunchPads, MaglevTrain, Vehicles } from "./Extras";
import { Zone } from "./Zone";
import { ZoneController } from "./ZoneController";

initRun();

export function GameCanvas() {
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!wrap.current) return;
    return installInput(wrap.current);
  }, []);

  return (
    <div ref={wrap} id="game-wrap" className="fixed inset-0">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 10, 14], fov: 70, far: 2500, near: 0.05 }}>
        <color attach="background" args={["#070a14"]} />
        <fog attach="fog" args={["#1a0f2e", 40, 260]} />
        <hemisphereLight args={["#6d5bd0", "#0b1024", 0.9]} />
        <ambientLight intensity={0.35} color="#8fa3ff" />
        <directionalLight
          position={[60, 90, 40]}
          intensity={0.8}
          color="#9fb4ff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-120}
          shadow-camera-right={120}
          shadow-camera-top={120}
          shadow-camera-bottom={-120}
          shadow-camera-far={300}
        />
        <Environment>
          <Lightformer intensity={1} color="#f0abfc" position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} color="#22d3ee" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Ground />
          <Structures />
          <Player />
          <Bots />
          <ViewModel />
          <BattleBus />
          <LaunchPads />
          <Vehicles />
          <GliderAvatar />
          <MaglevTrain />
        </Suspense>
        <Zone />
        <ZoneController />
        <Tracers />
      </Canvas>
      <HUD />
    </div>
  );
}
