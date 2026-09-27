import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { useGameStore } from "../store/useGameStore";

// Each stage: wait (seconds) then shrink over `shrink` seconds to `radius`.
const STAGES = [
  { wait: 25, shrink: 25, radius: 70 },
  { wait: 20, shrink: 20, radius: 42 },
  { wait: 15, shrink: 18, radius: 22 },
  { wait: 12, shrink: 15, radius: 8 },
  { wait: 10, shrink: 12, radius: 0 },
];

export function ZoneController() {
  const runSeed = useGameStore((s) => s.runSeed);
  const t = useRef(0);
  const stage = useRef(0);
  const from = useRef({ r: 105, x: 0, z: 0 });
  const to = useRef({ r: 105, x: 0, z: 0 });

  const pickNext = () => {
    const s = STAGES[stage.current];
    if (!s) return;
    const cur = from.current;
    const maxOff = Math.max(0, cur.r - s.radius);
    const a = Math.random() * Math.PI * 2;
    const d = Math.random() * maxOff * 0.8;
    to.current = { r: s.radius, x: cur.x + Math.cos(a) * d, z: cur.z + Math.sin(a) * d };
    useGameStore.getState().setZone(cur.r, s.radius, cur.x, cur.z);
    // keep marker centered on the next circle
    useGameStore.setState({ zoneNext: s.radius });
  };

  useEffect(() => {
    t.current = 0;
    stage.current = 0;
    from.current = { r: 105, x: 0, z: 0 };
    pickNext();
  }, [runSeed]);

  useFrame((_, raw) => {
    const store = useGameStore.getState();
    if (store.phase !== "playing") return;
    const s = STAGES[stage.current];
    if (!s) return;
    t.current += Math.min(raw, 0.05);
    if (t.current <= s.wait) return;
    const k = Math.min(1, (t.current - s.wait) / s.shrink);
    const f = from.current;
    const n = to.current;
    store.setZone(
      f.r + (n.r - f.r) * k,
      n.r,
      f.x + (n.x - f.x) * k,
      f.z + (n.z - f.z) * k,
    );
    if (k >= 1) {
      from.current = { ...n };
      stage.current++;
      t.current = 0;
      pickNext();
    }
  });
  return null;
}
