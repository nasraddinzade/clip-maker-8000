// Свиток (какэмоно): главы нарисованы одна под другой на одной бумаге.
// Камера плывёт вниз: в начале главы — переезд через туман от прошлой
// главы, дальше — ключи камеры самой главы. Камера всегда слегка «дышит».
import { clamp01 } from "./ink.js";

export const GAP = 900;       // пустая бумага/туман между главами (мировые px)
// переезд камеры между главами, с (config.timing.travel)
export let TRAVEL = 3.2;
// PRE — какая часть переезда идёт в хвосте прошлой главы (до смены сцены)
export let PRE = 0;
export function setTravel(t, pre = 0) { if (t > 0) TRAVEL = t; PRE = Math.max(0, Math.min(pre, TRAVEL)); }

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// мягкое ускорение/замедление (smootherstep)
const soft = (x) => x * x * x * (x * (x * 6 - 15) + 10);

export function layoutScroll(tl, modules) {
  let y = 0;
  for (const sc of tl.scenes) {
    const mod = modules(sc);
    sc.mod = mod;
    sc.height = mod.height ?? 2400;
    sc.top = y;
    y += sc.height + GAP;
  }
  tl.scrollHeight = y;
}

// Ключи камеры главы в мировых координатах: [{s, y, z, x}]
function keysOf(sc) {
  const raw = sc.mod.camera ? sc.mod.camera(sc.duration, sc) : [{ s: 0, y: sc.height / 2, z: 1 }];
  return raw.map((k) => ({ s: k.s, x: k.x ?? 540, y: sc.top + k.y, z: k.z ?? 1, lin: !!k.lin }));
}

function along(keys, s) {
  if (s <= keys[0].s) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (s <= b.s) {
      // lin — медленный дрейф в паузе (равномерно, без S-кривой); иначе плавный разгон/торможение
      const u = clamp01((s - a.s) / (b.s - a.s));
      const k = b.lin ? u : soft(u);
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k };
    }
  }
  return keys[keys.length - 1];
}

/** Камера в момент globalSec: { cx, cy, zoom } (центр кадра в мире). */
export function cameraAt(tl, sceneIndex, sec, globalSec, { breathe = true } = {}) {
  const sc = tl.scenes[sceneIndex];
  const keys = keysOf(sc);
  let cam = along(keys, sec);
  const post = TRAVEL - PRE; // часть переезда внутри новой главы
  const mix = (a, b, k) => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k });
  // переезд в эту главу: начался за PRE до её начала
  if (sceneIndex > 0 && sec < post) {
    const prev = tl.scenes[sceneIndex - 1];
    const from = along(keysOf(prev), prev.duration - PRE);
    cam = mix(from, along(keys, post), ease(clamp01((sec + PRE) / TRAVEL)));
  }
  // переезд в следующую главу начинается в конце этой
  const next = tl.scenes[sceneIndex + 1];
  if (next && PRE > 0 && sec > sc.duration - PRE) {
    const from = along(keys, sc.duration - PRE);
    cam = mix(from, along(keysOf(next), post), ease(clamp01((sec - (sc.duration - PRE)) / TRAVEL)));
  }
  let { x, y, z } = cam;
  if (breathe) {
    const T = globalSec;
    y += 2.5 * Math.sin((2 * Math.PI * T) / 7.3) + 0.8 * Math.sin((2 * Math.PI * T) / 3.1 + 1.3);
    x += 1.5 * Math.sin((2 * Math.PI * T) / 9.7 + 0.7);
    z *= 1 + 0.0015 * Math.sin((2 * Math.PI * T) / 11.3 + 2.1);
  }
  return { cx: x, cy: y, zoom: z };
}
