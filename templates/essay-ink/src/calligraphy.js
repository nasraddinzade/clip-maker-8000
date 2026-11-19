// Иероглиф кистью по порядку черт KanjiVG.
// Каждая черта — мазок суми (тело + волоски) с профилем нажима по типу
// черты: нажим на входе, утолщение на изломах, сход с сухой кистью
// у откидных (㇒ ㇏ ㇀), тормоз (томэ) у горизонталей и вертикалей,
// быстрый крючок у ㇚ ㇆ ㇟. Под мазками — растекание туши (GL-размывка).
import KANJI from "./data/kanji.json";
import { makeInkStroke, drawInkStroke, clamp01, lerp, easeOut, easeIn, brushEase } from "./ink.js";
import { washElement, wash } from "./gl/layers.js";

const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const bump = (u, c, w) => Math.exp(-Math.pow((u - c) / w, 2));

function profileFor(type) {
  const t = type.split("/")[0];
  const hook = /[㇚㇆㇟㇖㇈㇇㇄]/.test(t);
  if (/㇒/.test(t)) return { kind: "harai", dryStart: 0.42, dryness: 0.9, f: (u) => lerp(1.12, 0.95, smooth(0, 0.12, u)) * (1 - 0.9 * smooth(0.35, 1, u)) + 0.04 };
  if (/㇏/.test(t)) return { kind: "na", dryStart: 0.82, dryness: 0.75, f: (u) => lerp(0.55, 1.42, smooth(0.0, 0.82, u)) * (1 - 0.92 * smooth(0.86, 1, u)) + 0.05 };
  if (/㇔/.test(t)) return { kind: "dot", dryStart: 0.95, dryness: 0.3, f: (u) => lerp(0.55, 1.35, smooth(0, 0.7, u)) * (1 - 0.35 * smooth(0.8, 1, u)) };
  if (/㇀/.test(t)) return { kind: "rise", dryStart: 0.4, dryness: 0.85, f: (u) => lerp(1.25, 0.12, smooth(0.1, 1, u)) };
  if (hook) return { kind: "hook", dryStart: 0.9, dryness: 0.7, f: (u) => (0.92 + 0.2 * bump(u, 0.03, 0.05) + 0.18 * bump(u, 0.86, 0.05)) * (1 - 0.9 * smooth(0.88, 1, u)) };
  // ㇐ ㇑ ㇕ и прочие: вход с нажимом, тело, томэ на конце
  return { kind: "tome", dryStart: 0.93, dryness: 0.4, f: (u) => 0.9 + 0.22 * bump(u, 0.03, 0.06) - 0.08 * bump(u, 0.5, 0.25) + 0.16 * bump(u, 0.95, 0.05) - 0.4 * smooth(0.985, 1, u) };
}

// Ресемплинг ломаной с шагом step (в px).
function resample(pts, step) {
  const out = [pts[0]];
  let need = step; // сколько осталось пройти до следующей точки
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    let d = Math.hypot(bx - ax, by - ay);
    while (d >= need && d > 0) {
      const k = need / d;
      ax += (bx - ax) * k; ay += (by - ay) * k;
      out.push([ax, ay]);
      d -= need;
      need = step;
    }
    need -= d;
  }
  const last = pts[pts.length - 1];
  if (Math.hypot(last[0] - out[out.length - 1][0], last[1] - out[out.length - 1][1]) > step * 0.3) out.push(last);
  return out;
}

// Нажим на изломах черты (калиграф «давит» в углу).
function cornerBumps(pts) {
  const n = pts.length, res = new Array(n).fill(0);
  for (let i = 2; i < n - 2; i++) {
    const a = Math.atan2(pts[i][1] - pts[i - 2][1], pts[i][0] - pts[i - 2][0]);
    const b = Math.atan2(pts[i + 2][1] - pts[i][1], pts[i + 2][0] - pts[i][0]);
    let d = Math.abs(b - a); if (d > Math.PI) d = 2 * Math.PI - d;
    if (d > 0.6) for (let j = Math.max(0, i - 3); j < Math.min(n, i + 4); j++) res[j] = Math.max(res[j], 0.15 * Math.exp(-Math.pow((j - i) / 2, 2)));
  }
  return res;
}

/**
 * Готовит иероглиф: x, y — левый верх квадрата 109×109, size — сторона в px.
 * width — ширина кисти в px. seed — для неповторяемости.
 */
// Правки формы черт против KanjiVG (CC BY-SA 3.0 — изменения указываются).
// 空, черта 5: KanjiVG даёт тип «㇟a/㇏» и рисует вариант ㇟ — низ 穴 читается как 乚.
// Берём допустимый тем же источником вариант ㇏: нисходящий мазок вправо — низ читается как 八.
const qb = (a, b, c, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return [(1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]; });
const OVERRIDE = { "空": { 4: { type: "㇏", pts: qb([59, 36], [64, 50], [86, 58]) } } };

export function makeKanji(p, ch, { x = 0, y = 0, size = 700, width, seed = 1, jitter = 1.2 } = {}) {
  const src = KANJI[ch];
  if (!src) throw new Error("Нет иероглифа в kanji.json: " + ch);
  const data = OVERRIDE[ch] ? { ...src, strokes: src.strokes.map((s, i) => OVERRIDE[ch][i] ?? s) } : src;
  const k = size / 109;
  const W = width ?? size * 0.088;
  let rs = seed * 9.13;
  const rnd = () => { rs = (rs * 16807 + 0.5) % 2147483647; return (rs % 10000) / 10000; };
  const strokes = data.strokes.map((st, si) => {
    // лёгкая «рука»: небольшой сдвиг и наклон, чтобы не было идеальной геометрии
    const dx = (rnd() - 0.5) * jitter, dy = (rnd() - 0.5) * jitter;
    const raw = st.pts.map(([px, py]) => [x + (px + dx) * k, y + (py + dy) * k]);
    const pts = resample(raw, 4);
    const prof = profileFor(st.type);
    const cb = cornerBumps(pts);
    const n = pts.length;
    const pressure = (s, L) => {
      const u = s / L;
      const idx = Math.min(n - 1, Math.round(u * (n - 1)));
      return Math.min(1.3, Math.max(0.03, prof.f(u) + cb[idx]));
    };
    const len = pts.reduce((a, pt, i) => (i ? a + Math.hypot(pt[0] - pts[i - 1][0], pt[1] - pts[i - 1][1]) : 0), 0);
    const ink = makeInkStroke(pts, {
      width: W * (prof.kind === "dot" ? 1.05 : 1), pressure,
      bristles: 11, dryStart: prof.dryStart, dryness: prof.dryness, seed: seed * 31 + si * 7, halo: false,
      fude: true, hairsDryOnly: true,
    });
    // растекание туши: маска по линии черты
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const pad = W * 1.6;
    const bx = Math.min(...xs) - pad, by = Math.min(...ys) - pad;
    const bw = Math.max(...xs) - bx + pad, bh = Math.max(...ys) - by + pad;
    const bleed = washElement(p, bw, bh, (c) => {
      c.lineCap = "round"; c.lineJoin = "round";
      for (let i = 1; i < n; i++) {
        const u = i / (n - 1);
        if (u > prof.dryStart + 0.1) break; // сухая часть не растекается
        c.lineWidth = W * 0.92 * prof.f(u);
        c.beginPath(); c.moveTo(pts[i - 1][0] - bx, pts[i - 1][1] - by); c.lineTo(pts[i][0] - bx, pts[i][1] - by); c.stroke();
      }
    }, null, { scale: 0.5, blur: 9 });
    // рамка самой туши черты: линия ± 0,7 ширины кисти (нажим до 1,3)
    const box = { x0: Math.min(...xs) - W * 0.7, y0: Math.min(...ys) - W * 0.7, x1: Math.max(...xs) + W * 0.7, y1: Math.max(...ys) + W * 0.7 };
    return { ink, len, prof, box, bleed: { el: bleed, x: bx, y: by, w: bw, h: bh }, start: pts[0], end: pts[n - 1] };
  });
  // расписание в секундах: черта 0,2–0,4 с (длиннее — дольше),
  // отрыв кисти между чертами 0,08–0,15 с. Целимся примерно в 2 с на знак;
  // у многочертных знаков всё поджимается, но не короче 0,2 с / 0,08 с.
  // v10: «рисуй быстро, потом держи» — черта 0,15–0,35 с, отрыв 0,04–0,07 с, знак 0,8–1,4 с
  let durs = strokes.map((s) => Math.min(0.35, Math.max(0.15, 0.12 + (s.len / k) * 0.0024)));
  let gaps = strokes.map((s, i) => (i === 0 ? 0 : 0.04 + rnd() * 0.03));
  const sum = () => durs.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0);
  const target = 1.2, cap = 1.4;
  if (sum() > target) {
    const f = target / sum();
    durs = durs.map((d) => Math.max(0.15, d * f));
    gaps = gaps.map((g, i) => (i === 0 ? 0 : Math.max(0.03, g * f)));
  }
  // многочертные знаки (風, 輪): если и при черте 0,15 с выходит больше 1,4 с — черты короче 0,15 с
  if (sum() > cap) { const f = cap / sum(); durs = durs.map((d) => d * f); gaps = gaps.map((g) => g * f); }
  const total = sum();
  let acc = 0;
  strokes.forEach((s, i) => {
    acc += gaps[i]; s.a0 = acc; s.t0 = acc / total;
    acc += durs[i]; s.a1 = acc; s.t1 = acc / total;
  });
  // рамка туши (с растеканием) — для проверки «ничего не входит в рамку подписи»
  const bb = strokes.reduce((b, s) => ({
    x0: Math.min(b.x0, s.box.x0), y0: Math.min(b.y0, s.box.y0),
    x1: Math.max(b.x1, s.box.x1), y1: Math.max(b.y1, s.box.y1),
  }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
  return { ch, strokes, x, y, size, width: W, seed, total, bbox: bb };
}

/**
 * Движение кисти внутри черты (время → доля длины): медленный нажим
 * на входе, быстрый проход в середине, торможение и отрыв в конце.
 */
export function strokeMotion(t) {
  t = clamp01(t);
  if (t < 0.16) return 0.05 * (t / 0.16) * (t / 0.16);           // нажим, кисть почти стоит
  if (t > 0.84) { const u = (t - 0.84) / 0.16; return 0.93 + 0.07 * (1 - (1 - u) * (1 - u)); } // торможение, отрыв
  const u = (t - 0.16) / 0.68;                                     // середина: разгон и быстрый проход
  return 0.05 + 0.88 * (0.5 - 0.5 * Math.cos(Math.PI * u));
}

/** Прогресс черты i при общем прогрессе prog. */
export function strokeProgress(kj, i, prog) {
  const s = kj.strokes[i];
  return clamp01((prog - s.t0) / (s.t1 - s.t0));
}

/** GL-часть: растекание туши под чертами (рисовать ДО мазков). */
export function drawKanjiBleed(p, kj, prog, { spread = 0.12, opacity = 1 } = {}) {
  kj.strokes.forEach((s, i) => {
    // тушь расходится только после того, как черта легла: раньше подтёк проявлялся
    // по всей форме черты сразу и рисовал «призрак» ещё не написанного штриха
    if (prog <= s.t1) return;
    const r = easeOut(clamp01((prog - s.t1) / spread));
    wash(p, s.bleed.el, s.bleed.x, s.bleed.y, {
      // только редкие подтёки по волокнам за краем черты, без заливки и сплошного ореола
      reveal: r, thr: 0.5, soft: 0.04, edge: 0, gran: 0.6, bleed: 3, halo: 0.55, haloW: 0.26, body: 0,
      opacity: opacity * 0.45, seed: kj.seed * 3 + i,
    });
  });
}

/** Мазки p5.brush. */
export function drawKanji(brush, kj, prog, { reseed, idBase = 500, color } = {}) {
  kj.strokes.forEach((s, i) => {
    const sp = strokeProgress(kj, i, prog);
    if (sp <= 0) return;
    drawInkStroke(brush, s.ink, strokeMotion(sp), { reseed, id: idBase + i, ...(color ? { color } : {}) });
  });
}

export function kanjiData(ch) { return KANJI[ch]; }
