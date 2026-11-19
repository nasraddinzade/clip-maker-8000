// Общие элементы глав: горы, шапка главы (иероглиф + печать + подписи),
// точки-мхи, брызги туши между главами.
import { washElement, wash, mist } from "./gl/layers.js";
import { makeKanji, drawKanji, drawKanjiBleed } from "./calligraphy.js";
import { makeSeal, drawSeal } from "./seal.js";
import { trackedText, trackedWidth, IDEA_INK } from "./type.js";
import { INK, clamp01, lerp, easeInOut, easeOut, noise1, makePath, drawPath, liveStroke, makeInkStroke, drawInkStroke } from "./ink.js";
export { liveStroke };
import { TRAVEL, PRE } from "./scroll.js";
// во сколько секунд главы начинает писаться иероглиф (config.timing.headerStart)
let HEADER_START = null;
export function setHeaderStart(s) { HEADER_START = s ?? null; }
export const headerStart = () => HEADER_START ?? TRAVEL - 0.5;

export const seg = (x, a, b) => clamp01((x - a) / (b - a));
export const ease = easeInOut;

// детерминированный ГПСЧ для раскладок
export function rng(seed) {
  let a = Math.floor(seed * 7919) >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------- горы ----------------

/**
 * Гряда: peaks — [{x, top, slope, round}], base — Y подножия (низ элемента),
 * fade — на сколько px вниз от хребта тон уходит в туман.
 * Возвращает элемент размывки и функцию хребта ridge(x).
 */
export function makeRange(p, { x0 = 0, w = 1080, top = 0, h = 900, peaks, fade = 260, rough = 18, seed = 1, edgeDark = 1, lit = 0.35 }) {
  // Вершины-«лепестки»: скруглённый верх, крутые склоны, мелкие уступы.
  const ridge = (x) => {
    let y = h + 50;
    for (const pk of peaks) {
      const d = Math.abs(x - pk.x) / pk.w;
      const v = pk.top + pk.h * Math.pow(d, pk.pow ?? 1.7);
      y = Math.min(y, v);
    }
    y += (noise1(x / 70, seed) - 0.5) * rough + (noise1(x / 19, seed + 4) - 0.5) * rough * 0.4;
    return y;
  };
  const el = washElement(p, w, h,
    (c) => {
      c.beginPath(); c.moveTo(0, h + 40);
      for (let x = 0; x <= w; x += 3) c.lineTo(x, ridge(x));
      c.lineTo(w, h + 40); c.closePath(); c.fill();
    },
    (c) => {
      // тон: тёмный у хребта, вниз уходит в туман; освещённые склоны светлее
      for (let x = 0; x <= w; x += 5) {
        const r = ridge(x);
        const slope = (ridge(x + 6) - ridge(x - 6)) / 12; // >0 — склон вниз вправо
        const lightK = 1 - lit * Math.max(0, Math.min(1, slope * 1.2));
        const f = fade * (0.75 + 0.5 * noise1(x / 120, seed + 9));
        const g = c.createLinearGradient(0, r, 0, r + f);
        g.addColorStop(0, `rgba(255,255,255,${edgeDark * lightK})`);
        g.addColorStop(0.3, `rgba(220,220,220,${0.78 * lightK})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        c.fillStyle = g;
        c.fillRect(x - 3, r - 6, 6, f + 6);
      }
    },
    { scale: 0.5, blur: 4, toneScale: 0.25, toneBlur: 10 },
  );
  return { el, ridge, x0, top, w, h };
}

export function drawRange(p, r, o = {}) {
  wash(p, r.el, r.x0 + (o.x ?? 0), r.top, { thr: 0.45, soft: 0.05, edge: 0.6, gran: 0.65, bleed: 10, halo: 0.16, streak: 0, ...o });
}

// ---------------- точки мха по хребту ----------------

export function mossDots(ridge, { from, to, x0 = 0, top = 0, count = 30, seed = 1, size = 1, below = 14 }) {
  const R = rng(seed);
  const dots = [];
  for (let i = 0; i < count; i++) {
    // кучками, а не ровной цепочкой
    const x = lerp(from, to, Math.pow(R(), 0.9));
    const y = top + ridge(x) + 3 + R() * below;
    const n = R() < 0.35 ? 2 + Math.floor(R() * 2) : 1;
    for (let k = 0; k < n; k++) {
      dots.push({ x: x0 + x + (R() - 0.5) * 14, y: y + (R() - 0.5) * 8, ang: 60 + R() * 60, L: (3 + R() * 6) * size, w: (0.25 + R() * 0.35) * size });
    }
  }
  return dots;
}

export function drawDots(p, brush, dots, prog, reseed, idBase, color = INK) {
  dots.forEach((d, i) => {
    if (prog <= 0 || i / dots.length >= prog) return; // при prog=0 не рисовать ни одной точки
    // точка мха: короткий мазок «тычком» — тяжёлое начало, хвост
    const r = (d.ang * Math.PI) / 180;
    const L = d.L * 1.3 + 3;
    const pts = [];
    for (let k = 0; k <= 4; k++) pts.push([d.x + Math.cos(r) * L * k / 4, d.y + Math.sin(r) * L * k / 4]);
    const st = makeInkStroke(pts, { width: 9 * d.w + 3, bristles: 0, seed: idBase + i, pressure: (s, LL) => 1.1 - 0.85 * (s / LL) });
    drawInkStroke(brush, st, 1, { reseed, id: idBase + i, color });
  });
}

// ---------------- брызги туши ----------------

// Клякса между главами. style задаёт характер брызг, чтобы на каждом стыке была своя:
//  trail — капля и шлейф в одну сторону; burst — удар кистью, брызги во все стороны;
//  flick — взмах: вытянутые капли вдоль дуги; pair — две капли и редкие брызги;
//  sparse — несколько крупных капель врозь; drip — капля и подтёк вниз
export function makeSplatter(p, { w = 500, h = 300, seed = 1, count = 26, big = 1, style = "trail", ang: ang0 }) {
  const R = rng(seed);
  const drops = [];
  const ang = ang0 ?? (R() - 0.5) * 1.2;
  const cx = w * (0.3 + R() * 0.2), cy = h * (0.4 + R() * 0.2);
  // размер брызги — случайный, не убывает ровно с расстоянием
  const rr = (d, k = 1) => Math.max(1.2, (0.35 + 0.65 * R()) * (1 - 0.5 * d / (w * 0.6)) * 8 * big * k * Math.pow(R(), 1.2));
  if (style === "burst") {
    drops.push([w / 2, h / 2, 13 * big]);
    for (let i = 0; i < count; i++) { const a = R() * Math.PI * 2, d = (0.15 + Math.pow(R(), 0.8) * 0.85) * h * 0.48; drops.push([w / 2 + Math.cos(a) * d * 1.7, h / 2 + Math.sin(a) * d, rr(d, 0.8)]); }
  } else if (style === "flick") {
    for (let i = 0; i < count; i++) { const u = R(), a = ang + (u - 0.5) * 0.5; const x = w * (0.1 + 0.8 * u), y = h * 0.5 + Math.sin(u * 3 + seed) * h * 0.22 + (R() - 0.5) * 18; drops.push([x, y, rr(Math.abs(u - 0.3) * w, 0.9), 1.8 + R() * 1.6, a]); }
  } else if (style === "pair") {
    drops.push([w * 0.35, h * 0.45, 12 * big]); drops.push([w * 0.62, h * 0.58, 8 * big]);
    for (let i = 0; i < count; i++) { const k = R() < 0.6 ? 0 : 1, a = R() * Math.PI * 2, d = Math.pow(R(), 1.3) * w * 0.25; drops.push([drops[k][0] + Math.cos(a) * d, drops[k][1] + Math.sin(a) * d * 0.5, rr(d, 0.7)]); }
  } else if (style === "sparse") {
    for (let i = 0; i < Math.max(4, Math.round(count / 4)); i++) drops.push([w * (0.12 + 0.76 * R()), h * (0.2 + 0.6 * R()), (5 + 9 * R()) * big]);
  } else if (style === "drip") {
    drops.push([cx, h * 0.3, 15 * big]);
    for (let i = 0; i < 7; i++) drops.push([cx + (R() - 0.5) * 4, h * 0.3 + 14 + i * 13, (6 - i * 0.6) * big, 1.3, Math.PI / 2]);
    for (let i = 0; i < count / 2; i++) { const a = R() * Math.PI * 2, d = Math.pow(R(), 1.4) * w * 0.3; drops.push([cx + Math.cos(a) * d, h * 0.3 + Math.sin(a) * d * 0.4, rr(d, 0.6)]); }
  } else {
    drops.push([cx, cy, 16 * big]);
    for (let i = 0; i < count; i++) {
      const d = Math.pow(R(), 1.6) * w * 0.55;
      const a = ang + (R() - 0.5) * 0.9;
      drops.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, rr(d)]);
    }
  }
  return washElement(p, w, h, (c) => {
    for (const [x, y, r, el = 1 + R() * 0.4, a = R() * 3] of drops) { c.beginPath(); c.ellipse(x, y, r * el, r, a, 0, Math.PI * 2); c.fill(); }
  }, null, { scale: 0.6, blur: 1.5 });
}

// ---------------- неровная размывка ----------------

/**
 * Туман или расплыв туши неправильной формы: пятна разного размера вдоль шумной полосы,
 * плотность разная (тон), все пятна с отступом от краёв холста — размытие не обрезается
 * прямой кромкой. Рваный край даёт сам шейдер размывки (edge/gran/bleed).
 */
export function inkCloud(p, w, h, R, { blobs = 28, blur = 24 } = {}) {
  const pad = blur * 3;
  const drops = [];
  for (let i = 0; i < blobs; i++) {
    const rx = 28 + R() * 110, ry = 12 + R() * 38;
    const u = R();
    const x = pad + rx + (w - 2 * (pad + rx)) * u;
    const yc = h / 2 + (noise1(u * 3.1, 7) - 0.5) * (h - 2 * pad) * 0.6 + (R() - 0.5) * h * 0.12;
    const y = Math.min(h - pad - ry, Math.max(pad + ry, yc));
    drops.push([x, y, rx, ry, (R() - 0.5) * 0.5]);
  }
  return washElement(p, w, h,
    (c) => { for (const [x, y, rx, ry, a] of drops) { c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, Math.PI * 2); c.fill(); } },
    (c) => {
      // разная плотность: несколько пятен тона поверх ровного фона
      c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 9; i++) {
        const x = pad + R() * (w - 2 * pad), y = pad + R() * (h - 2 * pad), r = 50 + R() * 150;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.4 + R() * 0.6})`); g.addColorStop(1, "rgba(255,255,255,0)");
        c.fillStyle = g; c.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    },
    { scale: 0.35, blur, toneScale: 0.25, toneBlur: 30 });
}

// ---------------- межглавье: туман и брызги ----------------

/** Декор над главой (в отрицательных локальных Y): брызги туши. */
// Реестр областей для детектора вспышек (scripts/check_flashes.mjs):
// иероглифы, печати, брызги — в координатах главы. main.js задаёт текущую главу.
export const REGIONS = [];
export let regionScene = null;
export function setRegionScene(i) { regionScene = i; }
// t0 — секунда сцены, с которой элемент виден (проверка зон не считает его раньше); без t0 — с начала сцены
export function addRegion(name, x, y, w, h, space = "chapter", t0) { REGIONS.push({ scene: regionScene, name, x, y, w, h, space, t0 }); }
// Рамки туши иероглифов (точнее квадрата из REGIONS) — для проверки рамок подписей.
export const KEEPOUT = [];

export function makeGapDecor(p, seed, { x = 120, y = -620, w = 520, h = 300, count = 26, big = 1, style = "trail", ang } = {}) {
  addRegion("брызги", x, y, w, h);
  return { el: makeSplatter(p, { w, h, seed, count, big, style, ang }), x, y, seed };
}
export function drawGapDecor(ctx, g, opacity = 0.85) {
  wash(ctx.p, g.el, g.x, g.y, { thr: 0.5, soft: 0.06, edge: 0.5, gran: 0.4, bleed: 3, halo: 0.2, opacity, seed: g.seed });
}

// ---------------- шапка главы ----------------

/**
 * Иероглиф + печать + подписи. cfg:
 *  ch, x, y, size — квадрат иероглифа
 *  seal: { x, y, size }
 *  title: { x, y, align }, idea: { x, y, align }
 *  start — секунда начала письма, dur — длительность письма
 */
export function makeHeader(p, cfg, seed) {
  const kj = makeKanji(p, cfg.ch, { x: cfg.x, y: cfg.y, size: cfg.size, seed, width: cfg.width });
  const seal = makeSeal(p, cfg.ch, cfg.seal.size, { style: "haku", seed: seed + 3 });
  addRegion(`иероглиф ${cfg.ch}`, cfg.x, cfg.y, cfg.size, cfg.size);
  const b = kj.bbox;
  KEEPOUT.push({ scene: regionScene, name: `иероглиф ${cfg.ch} (тушь)`, x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0, t0: cfg.start ?? headerStart() });
  const sw = seal.img.width, sh = seal.img.height;
  // печать ставится после последней черты (headerOverlay): с этого момента и считается в зонах
  addRegion(`печать ${cfg.ch}`, cfg.seal.x - sw / 2, cfg.seal.y - sh / 2, sw, sh, "chapter", (cfg.start ?? headerStart()) + (cfg.dur ?? kj.total) + 0.25);
  return { cfg, kj, seal };
}

export function headerTimes(hd) {
  const start = hd.cfg.start ?? headerStart();
  // длительность письма — по расписанию черт (≈2 с на знак)
  const dur = hd.cfg.dur ?? hd.kj.total;
  return { start, dur, end: start + dur };
}

export function headerBleed(ctx, hd) {
  const { start, dur } = headerTimes(hd);
  drawKanjiBleed(ctx.p, hd.kj, clamp01((ctx.s - start) / dur));
}

export function headerInk(ctx, hd) {
  const { start, dur } = headerTimes(hd);
  drawKanji(ctx.brush, hd.kj, clamp01((ctx.s - start) / dur), { reseed: ctx.reseed });
}

export function headerOverlay(ctx, hd, caption) {
  const { p, fonts, s } = ctx;
  const { end } = headerTimes(hd);
  const c = hd.cfg;
  // печать ставится после последней черты
  const st = seg(s, end + 0.25, end + 0.75);
  if (st > 0) drawSeal(p, hd.seal, c.seal.x, c.seal.y, { alpha: easeOut(st), scale: lerp(1.08, 1, easeOut(st)), rot: c.seal.rot ?? -1.5 });
  // подписи рисует main.js в экранных координатах (см. drawCaption)
}

/**
 * Подпись главы: название — капителью с широкой разрядкой,
 * идея — курсивом без разрядки, крупнее и темнее, в одну строку.
 */
// начало / конец фразы n (с 1) голоса сцены sc — в секундах сцены (для camera(dur, sc))
export function phraseAt(sc, n) {
  const pt = sc?.parts?.[n - 1];
  return pt ? sc.voiceDelay + pt.start : (sc?.voiceDelay ?? 1.5) + (n - 1) * 2.5;
}
export function phraseEndAt(sc, n) {
  const pt = sc?.parts?.[n - 1];
  return pt ? sc.voiceDelay + pt.start + pt.duration : phraseAt(sc, n) + 2.1;
}

export const SAFE = 80; // безопасное поле от края кадра, px
// цвет подписей и названий — почти тушь
const CAPTION_INK = [12, 10, 9];

/**
 * Подпись главы в ЭКРАННЫХ координатах (1080×1920), не на свитке:
 * название — капителью с широкой разрядкой, идея — курсивом без разрядки.
 * Строки никогда не заходят ближе SAFE к краю кадра.
 */
export function drawCaption(p, fonts, caption, c, ta, ia, W = 1080) {
  const fit = (spec) => {
    const align = spec.align ?? "left";
    const x = Math.min(W - SAFE, Math.max(SAFE, spec.x));
    const maxWidth = align === "right" ? x - SAFE : align === "center" ? 2 * Math.min(x - SAFE, W - SAFE - x) : W - SAFE - x;
    return { x, align, maxWidth };
  };
  if (caption.title) {
    const f = fit(c.title);
    // название капителью: крупнее и темнее, чтобы читалось при ширине экрана 360 px
    trackedText(p, caption.title.toUpperCase(), f.x, c.title.y, { font: fonts[c.title.font ?? "regular"], size: c.title.size ?? 48, tracking: c.title.tracking ?? 0.42, align: f.align, alpha: ta, color: CAPTION_INK, maxWidth: f.maxWidth });
  }
  const f = fit(c.idea);
  const size = c.idea.size ?? 54;
  // wrap (px): перенос идеи по словам на несколько строк не шире wrap (текст не меняется)
  const lines = c.idea.wrap ? wrapLines(p, fonts.italic, size, caption.text, c.idea.wrap) : [caption.text];
  const lead = c.idea.lead ?? Math.round(size * 1.12);
  // курсива плотнее Italic в семействе нет (только Light/Regular/Medium прямые) — шрифт не меняем, цвет почти туши
  lines.forEach((ln, i) => trackedText(p, ln, f.x, c.idea.y + i * lead, { font: fonts.italic, size, tracking: 0, align: f.align, alpha: ia, color: CAPTION_INK, maxWidth: f.maxWidth }));
}

// Перенос по смыслу: сначала по концам предложений; кусок шире width — по запятой
// (самый ровный разрез, где обе части помещаются); иначе — по словам.
function wrapLines(p, font, size, text, width) {
  p.push(); p.textFont(font); p.textSize(size);
  const wd = (s) => trackedWidth(p, s, 0);
  const out = [];
  for (const sent of text.split(/(?<=[.!?…])\s+/)) {
    if (wd(sent) <= width) { out.push(sent); continue; }
    const cuts = [...sent.matchAll(/,\s+/g)].map((m) => [sent.slice(0, m.index + 1), sent.slice(m.index + m[0].length)])
      .filter(([a, b]) => wd(a) <= width && wd(b) <= width)
      .sort((x, y) => Math.abs(wd(x[0]) - wd(x[1])) - Math.abs(wd(y[0]) - wd(y[1])));
    if (cuts.length) { out.push(...cuts[0]); continue; }
    let cur = "";
    for (const w of sent.split(" ")) {
      const t = cur ? cur + " " + w : w;
      if (cur && wd(t) > width) { out.push(cur); cur = w; } else cur = t;
    }
    if (cur) out.push(cur);
  }
  p.pop();
  return out;
}

export { wash, mist, makePath, drawPath };
