import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { START_ZONE, useGameStore } from "../store/useGameStore";

// Each stage: wait (seconds) then shrink over `shrink` seconds to `radius`.
const STAGES = [
  { wait: 70, shrink: 45, radius: 420 },
  { wait: 40, shrink: 35, radius: 240 },
  { wait: 30, shrink: 30, radius: 130 },
  { wait: 25, shrink: 25, radius: 60 },
  { wait: 20, shrink: 20, radius: 22 },
  { wait: 15, shrink: 15, radius: 0 },
];

export function ZoneController() {
  const runSeed = useGameStore((s) => s.runSeed);
  const t = useRef(0);
  const stage = useRef(0);
  const from = useRef({ r: START_ZONE, x: 0, z: 0 });
  const to = useRef({ r: START_ZONE, x: 0, z: 0 });
  const lastLabel = useRef("");

  const pickNext = () => {
    const s = STAGES[stage.current];
    if (!s) return;
    const cur = from.current;
    const maxOff = Math.max(0, cur.r - s.radius);
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * maxOff * 0.8;
    to.current = { r: s.radius, x: cur.x + Math.cos(a) * d, z: cur.z + Math.sin(a) * d };
    useGameStore.setState({
      zoneRadius: cur.r,
      zoneX: cur.x,
      zoneZ: cur.z,
      zoneNext: s.radius,
      nextX: to.current.x,
      nextZ: to.current.z,
      stormStage: stage.current,
    });
  };

  useEffect(() => {
    t.current = 0;
    stage.current = 0;
    from.current = { r: START_ZONE, x: 0, z: 0 };
    pickNext();
  }, [runSeed]);

  useFrame((_, raw) => {
    const store = useGameStore.getState();
    if (store.phase !== "playing" && store.phase !== "bus" && store.phase !== "dive") return;
    const s = STAGES[stage.current];
    if (!s) return;
    t.current += Math.min(raw, 0.05);
    const waiting = t.current <= s.wait;
    const secs = Math.ceil(waiting ? s.wait - t.current : s.wait + s.shrink - t.current);
    const label = `${waiting ? "Storm shrinks in" : "Storm closing"} ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    if (label !== lastLabel.current) {
      lastLabel.current = label;
      useGameStore.setState({ stormLabel: label });
    }
    if (waiting) return;
    const k = Math.min(1, (t.current - s.wait) / s.shrink);
    const f = from.current;
    const n = to.current;
    useGameStore.setState({
      zoneRadius: f.r + (n.r - f.r) * k,
      zoneX: f.x + (n.x - f.x) * k,
      zoneZ: f.z + (n.z - f.z) * k,
    });
    if (k >= 1) {
      from.current = { ...n };
      stage.current++;
      t.current = 0;
      pickNext();
    }
  });
  return null;
}
