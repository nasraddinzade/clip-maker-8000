// Сцена-образец главы (шаблон templates/essay-ink). Не образ, а приёмы:
//  1. знак главы пишется кистью по порядку черт, после последней черты ставится печать (kit.js, makeHeader);
//  2. предмет рисуется быстро (0,5 с) и готов за 0,5 с до слова, которое его называет;
//  3. событие привязано к слову голоса (ctx.wordAt): капля падает 0,3 с и касается бумаги на слове, пятно растекается 0,7 с;
//  4. после события только удержание готового образа (CLAUDE.md, «Темп»: рисуй быстро, потом держи).
// Всё, что меняется от главы к главе, лежит в config.json (scenes[]): kanji, layout, object, event, подписи.
// Один модуль может обслуживать несколько глав, поэтому состояние хранится в scene.state, а не в переменных модуля.
//
// Что может отдавать модуль сцены (всё необязательно, кроме pass):
//  height, focus          — высота главы на свитке и точка, вокруг которой считается параллакс (мировые px)
//  setup({p, scene, ...}) — один раз: построить мазки, размывки, печати; addRegion() для проверок
//  camera(dur, scene)     — ключи камеры [{s, x, y, z, lin}] в секундах сцены; lin — медленный дрейф без S-кривой
//  still(dur)             — секунда стоп-кадра главы (render.mjs --stills)
//  keepout(ctx)           — рамки элементов [{name, x, y, w, h, t0, t1}] для проверки зон и подписей
//  events(ctx)            — таблица событий [{name, t0, t1, anchor}] (scripts/export_geometry.mjs)
//  pass(k, ctx)           — проходы рисования k = 0…4 (в каждом сначала GL-размывки, затем мазки p5.brush)
//  overlay(ctx)           — поверх всех проходов, в координатах главы (печати)
//  screen(ctx)            — в экранных координатах, поверх подписей (подпись художника)
//  caption                — раскладка подписи, если её нет в config.json (scenes[].captionLayout)
//  captionAt(dur, scene)  — когда проявляется подпись (по умолчанию с началом голоса)
// ctx: p, brush, s (секунда сцены), g (секунда ролика), reseed(id), par(f, fn), phrase(n), phraseEnd(n),
//      wordAt(n, "слово"), wordEnd(n, "слово"), scene, fonts, cam.
import { makeHeader, headerBleed, headerInk, headerOverlay, headerTimes, seg, rng } from "../kit.js";
import { washElement, wash } from "../gl/layers.js";
import { makeInkStroke, drawInkStroke, liveStroke, sampleCurve, brushEase, easeOut, lerp, noise1 } from "../ink.js";

export const height = 2400;
export const focus = 1200;

const DEF = {
  kanji: { x: 80, y: 760, size: 640 },     // квадрат знака в координатах главы; в покое знак выше нижних 35 % кадра
  seal: { x: 900, y: 820, size: 84 },      // центр малой печати главы
  object: { x0: 560, y0: 1180, x1: 960, y1: 1110 }, // предмет: ветка сухой кистью от (x0,y0) к (x1,y1)
  drop: { x: 820, y: 1250 },               // куда падает капля события
};

export function setup({ p, scene }) {
  const L = { ...DEF, ...(scene.layout ?? {}) };
  const R = rng(scene.seed);
  const hd = makeHeader(p, { ch: scene.kanji, x: L.kanji.x, y: L.kanji.y, size: L.kanji.size, seal: L.seal }, scene.seed);
  // предмет: ветка — живая линия сухой кистью (нажим меняется, к концу сохнет) и два отростка
  const o = L.object;
  const main = sampleCurve((u) => [lerp(o.x0, o.x1, u), lerp(o.y0, o.y1, u) - 40 * Math.sin(Math.PI * u) + 10 * (noise1(u * 3, scene.seed) - 0.5)], Math.hypot(o.x1 - o.x0, o.y1 - o.y0), 6);
  const twigs = [0.45, 0.72].map((t, i) => {
    const [bx, by] = main[Math.floor(t * (main.length - 1))];
    const len = 70 + 50 * R(), a = -1.2 - 0.5 * R() + i * 0.3;
    return sampleCurve((u) => [bx + Math.cos(a) * len * u, by + Math.sin(a) * len * u + 8 * u * u], len, 5);
  });
  const branch = [liveStroke(main, { width: 12, seed: scene.seed + 5, breaks: 0.3, dry: 0.8, bristles: 8, taperIn: 0.08, taperOut: 0.35 }),
    ...twigs.map((t, i) => liveStroke(t, { width: 6, seed: scene.seed + 7 + i, breaks: 0.2, dry: 0.9, bristles: 4, taperIn: 0.05, taperOut: 0.5 }))];
  // событие: пятно туши, растекается от точки удара; без тёмного ядра и без ровной каймы (каркас, раздел 3)
  const d = L.drop;
  const blot = washElement(p, 260, 140, (c) => {
    // одно пятно из перекрытых лопастей: отдельные пятна рядом читаются «глазами» (проверка россыпей на лица)
    for (let k = 0; k < 8; k++) {
      const a = R() * Math.PI * 2, r = R() * 12;
      c.beginPath(); c.ellipse(118 + Math.cos(a) * r * 2.2, 70 + Math.sin(a) * r * 0.6, 22 + R() * 20, 9 + R() * 6, (R() - 0.5) * 0.3, 0, Math.PI * 2); c.fill();
    }
  }, (c) => {
    c.fillStyle = "rgba(255,255,255,0.55)"; c.fillRect(0, 0, 260, 140); // плотность неровная — несколько пятен тона
    for (let k = 0; k < 4; k++) { c.fillStyle = `rgba(255,255,255,${0.3 + 0.7 * R()})`; c.beginPath(); c.arc(60 + R() * 140, 40 + R() * 60, 20 + R() * 25, 0, Math.PI * 2); c.fill(); }
  }, { scale: 0.5, blur: 6, toneScale: 0.5, toneBlur: 10 });
  // предмет и пятно попадают в проверки через keepout(ctx) — там известно, с какой секунды они видны
  scene.state = { L, hd, branch, blot };
}

// Тайминг сцены: всё считается от голоса (ctx.phrase / ctx.wordAt), чтобы правка текста не ломала синхрон.
function T(ctx) {
  const { hd } = ctx.scene.state;
  const k = headerTimes(hd);                       // start/end письма знака (расписание черт, 0,8–1,4 с)
  const ob = ctx.scene.object ?? {};
  const ev = ctx.scene.event ?? {};
  // предмет готов за 0,5 с до своего слова (если слово задано), иначе сразу после печати
  const ready = ob.word ? ctx.wordAt(ob.phrase ?? 1, ob.word) - 0.5 : k.end + 1.0;
  const obj1 = Math.max(k.end + 0.8, ready), obj0 = obj1 - 0.5;
  // событие на слове: касание ровно на слове, падение 0,3 с до него
  const hit = ev.word ? Math.max(ctx.wordAt(ev.phrase ?? 1, ev.word), obj1 + 0.2) : obj1 + 1.2;
  return { ...k, obj0, obj1, drop0: hit - 0.3, hit };
}

export function camera(dur) {
  // неподвижный план с медленным дрейфом; переезды между главами делает scroll.js
  return [{ s: 0, x: 540, y: 1200, z: 1 }, { s: dur, x: 548, y: 1215, z: 1.03, lin: true }];
}
export const still = (dur) => dur - 1.4; // до угасания подписи (оно начинается за travelPre + 0,45 с до конца сцены)

export function keepout(ctx) {
  const { L } = ctx.scene.state, tm = T(ctx), o = L.object, d = L.drop;
  return [
    { name: "предмет", x: Math.min(o.x0, o.x1) - 20, y: Math.min(o.y0, o.y1) - 120, w: Math.abs(o.x1 - o.x0) + 40, h: 200, t0: tm.obj0 },
    { name: "капля", x: d.x - 130, y: d.y - 70, w: 260, h: 140, t0: tm.hit },
  ];
}

export function events(ctx) {
  const tm = T(ctx), sc = ctx.scene;
  return [
    { name: `знак ${sc.kanji} пишется`, t0: tm.start, t1: tm.end, anchor: "расписание черт" },
    { name: `печать ${sc.kanji}`, t0: tm.end + 0.25, t1: tm.end + 0.75, anchor: "конец знака" },
    { name: "предмет рисуется", t0: tm.obj0, t1: tm.obj1, anchor: sc.object?.word ? `за 0,5 с до «${sc.object.word}»` : "после печати" },
    { name: "капля касается бумаги", t0: tm.drop0, t1: tm.hit, anchor: sc.event?.word ? `слово «${sc.event.word}»` : "после предмета" },
    { name: "пятно растекается", t0: tm.hit, t1: tm.hit + 0.7, anchor: "касание" },
  ];
}

export function pass(k, ctx) {
  const { p, brush, s, reseed } = ctx;
  const { hd, branch, blot, L } = ctx.scene.state;
  const tm = T(ctx);
  if (k === 1) headerBleed(ctx, hd);                // растекание туши под чертами знака (GL)
  if (k === 2) {
    // пятно события — под знаком и предметом (GL-размывка, монотонное проявление)
    const r = easeOut(seg(s, tm.hit, tm.hit + 0.7));
    if (r > 0) wash(p, blot, L.drop.x - 130, L.drop.y - 70, { reveal: r, opacity: 0.55, thr: 0.34, soft: 0.14, edge: 0.12, gran: 0.6, bleed: 10, halo: 0.15, haloW: 0.3, seed: 9 });
    // предмет: 0,5 с, мазки один за другим
    branch.forEach((st, i) => {
      const u = seg(s, tm.obj0 + i * 0.12, tm.obj1 - (branch.length - 1 - i) * 0.05);
      if (u > 0) drawInkStroke(brush, st, brushEase(u), { reseed, id: 300 + i, color: i ? "#2b2824" : "#151311" });
    });
    // капля падает 0,3 с и касается бумаги на слове
    const f = seg(s, tm.drop0, tm.hit);
    if (f > 0 && f < 1) {
      const y = lerp(L.drop.y - 110, L.drop.y, f * f), st = 18 + 18 * f;
      const drop = makeInkStroke(sampleCurve((u) => [L.drop.x, y - st + st * u], st, 2), { width: 16, bristles: 0, seed: 3, pressure: (q, len) => 0.1 + Math.pow(q / len, 0.7) });
      drawInkStroke(brush, drop, 1, { reseed, id: 5 });
    }
    headerInk(ctx, hd);                             // знак тушью поверх всего остального
  }
}

export function overlay(ctx) {
  headerOverlay(ctx, ctx.scene.state.hd);           // малая печать главы после последней черты
}

// Раскладка подписи по умолчанию (Reels: полоса 14–65 % высоты, 6 % от боков); лучше задавать в config.json.
export const caption = { title: { x: 96, y: 340 }, idea: { x: 96, y: 416, wrap: 760 } };
