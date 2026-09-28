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
    <div ref={wrap} className="fixed inset-0">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 10, 14], fov: 70, far: 2500, near: 0.05 }}>
        <color attach="background" args={["#b9c7cf"]} />
        <fog attach="fog" args={["#b9c7cf", 60, 190]} />
        <hemisphereLight args={["#dfe8ee", "#5a5a3a", 0.7]} />
        <directionalLight
          position={[60, 90, 40]}
          intensity={2}
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
          <Lightformer intensity={1.5} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={0.8} color="#cdb" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <Suspense fallback={null}>
          <Ground />
          <Structures />
          <Player />
          <Bots />
          <ViewModel />
          <BattleBus />
        </Suspense>
        <Zone />
        <ZoneController />
        <Tracers />
      </Canvas>
      <HUD />
    </div>
  );
}
