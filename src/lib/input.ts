export const keys = new Set<string>();
/** Keys pressed since the last frame (consumed by the player each frame). */
export const pressed = new Set<string>();
export const look = { yaw: 0, pitch: -0.12 };
export const mouse = { firing: false, aiming: false, clicked: false };
export const pointer = { locked: false };
let onMenuKey: (() => void) | null = null;
export function setMenuKeyHandler(fn: (() => void) | null) {
  onMenuKey = fn;
}

const PREVENT = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"]);

export function installInput(el: HTMLElement) {
  const onDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    if (e.code === "KeyM" && !e.repeat) onMenuKey?.();
    keys.add(e.code);
  };
  const onUp = (e: KeyboardEvent) => keys.delete(e.code);
  const onBlur = () => {
    keys.clear();
    mouse.firing = false;
  };
  const onMouseDown = (e: MouseEvent) => {
    if (!pointer.locked) {
      el.requestPointerLock();
      return;
    }
    if (e.button === 0) {
      mouse.firing = true;
      mouse.clicked = true;
    }
    if (e.button === 2) mouse.aiming = true;
  };
  const onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) mouse.firing = false;
    if (e.button === 2) mouse.aiming = false;
  };
  const onMove = (e: MouseEvent) => {
    if (!pointer.locked) return;
    const sens = mouse.aiming ? 0.0011 : 0.0022;
    look.yaw -= e.movementX * sens;
    look.pitch -= e.movementY * sens;
    look.pitch = Math.max(-1.45, Math.min(1.35, look.pitch));
  };
  const onLockChange = () => {
    pointer.locked = document.pointerLockElement === el;
    if (!pointer.locked) {
      mouse.firing = false;
      mouse.aiming = false;
      keys.clear();
    }
  };
  const onContext = (e: Event) => e.preventDefault();

  window.addEventListener("keydown", onDown);
  window.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);
  el.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousemove", onMove);
  document.addEventListener("pointerlockchange", onLockChange);
  el.addEventListener("contextmenu", onContext);

  return () => {
    window.removeEventListener("keydown", onDown);
    window.removeEventListener("keyup", onUp);
    window.removeEventListener("blur", onBlur);
    el.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("pointerlockchange", onLockChange);
    el.removeEventListener("contextmenu", onContext);
  };
}
