import { useEffect, useRef, useState } from "react";
import { runtime, initRun } from "../lib/runtime";
import { MAP_HALF, PADS } from "../lib/world";
import { RARITY, WEAPONS } from "../lib/weapons";
import { useGameStore } from "../store/useGameStore";

export function startMatch() {
  initRun();
  useGameStore.getState().start();
}

function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let id = 0;
    const draw = () => {
      const c = ref.current;
      const ctx = c?.getContext("2d");
      if (c && ctx) {
        const S = c.width;
        const m = (v: number) => ((v + MAP_HALF) / (MAP_HALF * 2)) * S;
        const st = useGameStore.getState();
        ctx.fillStyle = "#4b5a33";
        ctx.fillRect(0, 0, S, S);
        ctx.strokeStyle = "#7dd3fc";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(m(st.zoneX), m(st.zoneZ), (st.zoneRadius / (MAP_HALF * 2)) * S, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#facc15";
        for (const pd of PADS) ctx.fillRect(m(pd.x) - 1.5, m(pd.z) - 1.5, 3, 3);
        ctx.fillStyle = "#f97316";
        for (const v of runtime.vehicles) ctx.fillRect(m(v.x) - 2, m(v.z) - 2, 4, 4);
        const p = runtime.player;
        ctx.save();
        ctx.translate(m(p.x), m(p.z));
        ctx.rotate(-runtime.playerYaw);
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.lineTo(4, 4);
        ctx.lineTo(-4, 4);
        ctx.fill();
        ctx.restore();
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={ref} width={160} height={160} className="rounded border-2 border-foreground/40" />;
}

export function HUD() {
  const s = useGameStore();
  const [hit, setHit] = useState(false);
  useEffect(() => {
    if (!s.hitMarker) return;
    setHit(true);
    const t = setTimeout(() => setHit(false), 120);
    return () => clearTimeout(t);
  }, [s.hitMarker]);

  if (s.phase === "menu") {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center bg-background/60">
        <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center text-card-foreground shadow-xl">
          <h1 className="text-4xl font-black tracking-widest">ZONE ROYALE</h1>
          <p className="mt-2 text-muted-foreground">Solo vs 15 bots. Stay in the zone. Be the last one standing.</p>
          <ul className="mt-4 space-y-1 text-left text-sm text-muted-foreground">
            <li>WASD move · Shift sprint · C crouch · Space jump</li>
            <li>Mouse look · Left click fire · Right click aim · R reload</li>
            <li>1-3 weapons · 4 shield potion · 5 medkit · F open chest</li>
            <li>E enter/exit car · Yellow pads launch you into the sky</li>
          </ul>
          <button
            onClick={startMatch}
            className="mt-6 rounded bg-primary px-8 py-3 font-bold text-primary-foreground hover:opacity-90"
          >
            DROP IN
          </button>
        </div>
      </div>
    );
  }

  if (s.phase === "dead" || s.phase === "won") {
    return (
      <div className="fixed inset-0 z-10 flex items-center justify-center bg-background/70">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-card-foreground">
          <h2 className="text-3xl font-black">
            {s.phase === "won" ? "WINNER WINNER CHICKEN DINNER!" : `You placed #${s.alive}`}
          </h2>
          <p className="mt-2 text-muted-foreground">Kills: {s.kills}</p>
          <button
            onClick={() => {
              document.exitPointerLock?.();
              startMatch();
            }}
            className="mt-6 rounded bg-primary px-8 py-3 font-bold text-primary-foreground"
          >
            PLAY AGAIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10 font-mono text-foreground">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className={`h-6 w-6 rounded-full border-2 ${hit ? "border-destructive" : "border-foreground/80"}`} />
      </div>
      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <Minimap />
        <div className="rounded bg-card/80 px-3 py-1 text-sm">Alive {s.alive} · Kills {s.kills}</div>
      </div>
      <div className="absolute left-4 top-4 space-y-1 text-sm">
        {s.feed.map((f) => (
          <div key={f.id} className="rounded bg-card/70 px-2 py-0.5">{f.text}</div>
        ))}
      </div>
      {!s.inZone && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 rounded bg-destructive px-4 py-1 font-bold text-destructive-foreground">
          OUTSIDE THE ZONE — MOVE!
        </div>
      )}
      {(s.prompt || s.using) && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-card/85 px-4 py-1.5 text-sm font-bold">
          {s.using ?? s.prompt}
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2">
        <div className="w-80 space-y-1">
          <div className="h-2.5 overflow-hidden rounded bg-card/70">
            <div className="h-full bg-sky-400 transition-all" style={{ width: `${s.shield}%` }} />
          </div>
          <div className="h-3 overflow-hidden rounded bg-card/70">
            <div className="h-full bg-green-500 transition-all" style={{ width: `${s.health}%` }} />
          </div>
          <div className="flex justify-between text-xs"><span>🛡 {s.shield}</span><span>❤ {Math.round(s.health)}</span></div>
        </div>
        <div className="flex gap-1.5">
          {s.slots.map((w, i) => (
            <div
              key={i}
              className={`relative flex h-16 w-20 flex-col justify-end rounded border-2 bg-card/80 p-1 text-[10px] leading-tight ${i === s.slot ? "-translate-y-1 ring-2 ring-foreground" : ""}`}
              style={{ borderColor: w ? RARITY[w.rarity]!.color : "hsl(var(--border))" }}
            >
              <span className="absolute left-1 top-0.5 text-muted-foreground">{i + 1}</span>
              {w ? (
                <>
                  <span className="font-bold" style={{ color: RARITY[w.rarity]!.color }}>{WEAPONS[w.kind].name}</span>
                  <span>{w.mag}/{s.ammo[w.kind]}</span>
                </>
              ) : (
                <span className="text-muted-foreground">Empty</span>
              )}
            </div>
          ))}
          <div className="relative flex h-16 w-16 flex-col items-center justify-center rounded border-2 border-sky-400 bg-card/80 text-xs">
            <span className="absolute left-1 top-0.5 text-[10px] text-muted-foreground">4</span>
            <span className="text-xl">🧪</span>x{s.potions.shield}
          </div>
          <div className="relative flex h-16 w-16 flex-col items-center justify-center rounded border-2 border-green-500 bg-card/80 text-xs">
            <span className="absolute left-1 top-0.5 text-[10px] text-muted-foreground">5</span>
            <span className="text-xl">➕</span>x{s.potions.med}
          </div>
        </div>
      </div>
      <div className="absolute bottom-6 right-6 text-right">
        <div className="text-4xl font-black">
          {s.slots[s.slot]?.mag ?? 0}<span className="text-lg text-muted-foreground"> / {s.slots[s.slot] ? s.ammo[s.slots[s.slot]!.kind] : 0}</span>
        </div>
        {s.reloading && <div className="text-sm">Reloading…</div>}
      </div>
    </div>
  );
}
