import * as THREE from "three";

/** Mottled dry-grass / dirt terrain texture drawn on a canvas. */
export function makeGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#6b7343";
  ctx.fillRect(0, 0, size, size);

  const palette = ["#5d6739", "#77804c", "#8a8452", "#4f5a32", "#948a5c"];
  for (let i = 0; i < 5200; i++) {
    ctx.fillStyle = palette[(Math.random() * palette.length) | 0]!;
    ctx.globalAlpha = 0.25 + Math.random() * 0.4;
    const r = 2 + Math.random() * 14;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      r,
      r * (0.5 + Math.random()),
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  // Faint dirt tracks
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#9a8c63";
  ctx.lineWidth = 16;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, 0);
    ctx.bezierCurveTo(
      Math.random() * size,
      size * 0.33,
      Math.random() * size,
      size * 0.66,
      Math.random() * size,
      size
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Concrete wall texture with panel seams and grime. */
export function makeConcreteTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#9d9686";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#8b8474" : "#aaa395";
    ctx.globalAlpha = 0.2 + Math.random() * 0.35;
    ctx.fillRect(
      Math.random() * size,
      Math.random() * size,
      1 + Math.random() * 5,
      1 + Math.random() * 5
    );
  }
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#6f6a5d";
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(0, (size / 4) * i);
    ctx.lineTo(size, (size / 4) * i);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
