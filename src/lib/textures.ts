import * as THREE from "three";

/** Mottled dry-grass / dirt terrain texture drawn on a canvas. */
export function makeGroundTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#2a2d36";
  ctx.fillRect(0, 0, size, size);

  const palette = ["#23262e", "#30333d", "#262a33", "#1d2027", "#353945"];
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

  // tile seams + lane dashes
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = "#15171d";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#d9c56b";
  for (let y = 20; y < size; y += 80) ctx.fillRect(size / 2 - 3, y, 6, 40);
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

/** Night skyscraper facade: dark glass with randomly lit windows. */
export function makeWindowTexture(): THREE.CanvasTexture {
  const w = 128;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#07090f";
  ctx.fillRect(0, 0, w, h);
  const lit = ["#ffd9a0", "#9be7ff", "#ffffff", "#ffb3f0"];
  for (let y = 4; y < h; y += 12) {
    for (let x = 4; x < w; x += 10) {
      const on = Math.random() < 0.38;
      ctx.fillStyle = on ? lit[(Math.random() * lit.length) | 0]! : "#141a26";
      ctx.globalAlpha = on ? 0.6 + Math.random() * 0.4 : 1;
      ctx.fillRect(x, y, 6, 7);
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
