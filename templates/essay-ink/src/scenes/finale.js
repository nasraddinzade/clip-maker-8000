// Финал-образец (шаблон templates/essay-ink): линия кистью через лист до финальной фразы, большая печать
// знака финала после голоса, подпись художника (логотип) сразу после финальной фразы.
// Каркас эссе, разделы 1 и 5: пауза перед финальной фразой около 1 с (scenes[].pauses), линия кончается до фразы,
// подпись видна в полную силу ≥ 1,8 с до петли, на месте названия пролога к петле чистая бумага.
// Параметры — config.json: scenes[].seal { char, size, x, y }, logo { … }, timing.loopFrames.
import { makeSeal, drawSeal } from "../seal.js";
import { addRegion, seg } from "../kit.js";
import { makeInkStroke, drawInkStroke, sampleCurve, lerp, noise1, easeOut } from "../ink.js";
import { drawSignature } from "../signature.js";

export const height = 2000;
export const focus = 1000;

export function setup({ p, scene }) {
  const S = { char: "道", size: 300, x: 730, y: 1120, ...(scene.seal ?? {}) };
  const seal = makeSeal(p, S.char, S.size, { style: "haku", seed: scene.seed });
  addRegion(`печать ${S.char}`, S.x - seal.img.width / 2, S.y - seal.img.height / 2, seal.img.width, seal.img.height, "chapter", voiceEnd(scene) + 0.3);
  // линия: кисть входит наискось (косой срез), нажим в начале, живое тело, сухой рваный конец
  const entry = sampleCurve((u) => [140 + 16 * u, 910 + 12 * u], 22, 3);
  const body = sampleCurve((u) => [156 + 600 * u, 922 - 5 * Math.sin(Math.PI * u) + 3 * u], 600, 6);
  const line = makeInkStroke([...entry, ...body.slice(1)], {
    width: 19, bristles: 12, fude: true, dryStart: 0.62, dryness: 0.92, seed: scene.seed + 77,
    pressure: (s2, L) => { const u = s2 / L; const head = u < 0.035 ? lerp(1.25, 1.05, u / 0.035) : 1.05; return head * (0.92 + 0.12 * noise1(s2 / 60, 5)) * (1 - 0.55 * Math.max(0, u - 0.6) / 0.4); },
  });
  scene.state = { S, seal, line };
}

// конец голоса сцены (секунды сцены); от него — печать и подпись
const voiceEnd = (sc) => sc.voiceDelay + (sc.voiceDuration ?? 3);
// начало последней фразы — до неё линия должна кончиться
const lastPhrase = (ctx) => ctx.phrase(Math.max(1, ctx.scene.parts?.length ?? 1));

export function camera(dur) {
  return [{ s: 0, x: 540, y: 1000, z: 1 }, { s: dur, x: 555, y: 1020, z: 1.03, lin: true }];
}
export const still = (dur) => dur - 0.3;

export function keepout(ctx) {
  return [{ name: "линия кистью", x: 130, y: 895, w: 640, h: 50, t0: 0.45 }]; // печать — в addRegion (setup), с t0
}

export function events(ctx) {
  const sc = ctx.scene, end = voiceEnd(sc), line1 = Math.min(2.45, lastPhrase(ctx) - 0.1);
  return [
    { name: "линия через лист", t0: 0.45, t1: line1, anchor: "до финальной фразы" },
    { name: `большая печать ${sc.state.S.char}`, t0: end + 0.3, t1: end + 0.9, anchor: "конец голоса" },
    ...(ctx.scene.signature !== false ? [{ name: "подпись художника", t0: end + (sc.signatureOffset ?? -0.11), t1: end + (sc.signatureOffset ?? -0.11) + 0.5, anchor: "конец финальной фразы" }] : []),
  ];
}

export function pass(k, ctx) {
  const { brush, s, reseed } = ctx;
  if (k === 2) {
    const line1 = Math.min(2.45, lastPhrase(ctx) - 0.1);
    const u = seg(s, 0.45, line1);
    drawInkStroke(brush, ctx.scene.state.line, u * u * (3 - 2 * u) * 0.35 + u * 0.65, { reseed, id: 7 });
  }
}

export function overlay(ctx) {
  const { p, s } = ctx;
  const { S, seal } = ctx.scene.state;
  const st = seg(s, voiceEnd(ctx.scene) + 0.3, voiceEnd(ctx.scene) + 0.9);
  if (st > 0) drawSeal(p, seal, S.x, S.y, { alpha: easeOut(st), scale: lerp(1.1, 1, easeOut(st)), rot: -2 });
}

// подпись художника: сразу после финальной фразы. signatureOffset — сдвиг от конца файла голоса: возьми из
// огибающей голоса (последний момент громче −35 dBFS), на «Пяти кольцах» −0,11 с.
export function screen(ctx) {
  if (ctx.scene.signature === false) return;
  drawSignature(ctx, { t0: voiceEnd(ctx.scene) + (ctx.scene.signatureOffset ?? -0.11) });
}

export const caption = { title: { x: 96, y: 700 }, idea: { x: 96, y: 768, size: 66 } };
// финальная фраза на экране проявляется вместе с последней фразой голоса
export function captionAt(dur, sc) { return sc.voiceDelay + (sc.parts?.[Math.max(0, (sc.parts?.length ?? 1) - 1)]?.start ?? 0) - 0.1; }
