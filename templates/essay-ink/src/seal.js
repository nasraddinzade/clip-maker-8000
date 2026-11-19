// Печать ханко (киноварь). Генерируется один раз в Canvas2D:
// красный оттиск с неравномерной краской, выщербленными краями и
// иероглифами (из KanjiVG) белым по красному (хакубун) или красным по белому (сюбун).
import KANJI from "./data/kanji.json";

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Глиф в квадрат: растягиваем по габаритам (печатный стиль заполняет поле).
function glyphStrokes(ch, x, y, w, h) {
  const d = KANJI[ch];
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for (const s of d.strokes) for (const [px, py] of s.pts) {
    minx = Math.min(minx, px); maxx = Math.max(maxx, px); miny = Math.min(miny, py); maxy = Math.max(maxy, py);
  }
  // растягиваем к полю, но не больше чем в 1,3 раза по одной оси
  const gw = maxx - minx, gh = maxy - miny;
  let sx = w / gw, sy = h / gh;
  if (sx > sy * 1.3) sx = sy * 1.3;
  if (sy > sx * 1.3) sy = sx * 1.3;
  const ox = x + (w - gw * sx) / 2, oy = y + (h - gh * sy) / 2;
  return d.strokes.map((s) => s.pts.map(([px, py]) => [ox + (px - minx) * sx, oy + (py - miny) * sy]));
}

/**
 * chars — строка из 1–4 иероглифов (раскладка по столбцам справа налево).
 * style — "haku" (белые знаки) или "shu" (красные знаки в рамке).
 */
export function makeSeal(p, chars, size, { style = "haku", seed = 1, color = [176, 42, 30], column = false } = {}) {
  const R = rng(seed);
  // size — высота оттиска; столбец знаков — вытянутая вертикальная печать
  const n = [...chars].length;
  const S = Math.round(size);
  const SW = column ? Math.round(S / n * 1.08) : S;
  const pad = Math.round(S * 0.08);
  const cv = document.createElement("canvas");
  cv.width = SW + pad * 2; cv.height = S + pad * 2;
  const c = cv.getContext("2d");
  const [r, g, b] = color;

  // форма оттиска: слегка неровный квадрат
  const shape = new Path2D();
  const jit = () => (R() - 0.5) * S * 0.012;
  shape.moveTo(pad + jit(), pad + jit());
  shape.lineTo(pad + SW + jit(), pad + jit());
  shape.lineTo(pad + SW + jit(), pad + S + jit());
  shape.lineTo(pad + jit(), pad + S + jit());
  shape.closePath();

  const glyphs = [];
  // 1 знак — во всё поле; столбец — сверху вниз; иначе — два столбца справа налево
  const cols = column || n <= 1 ? 1 : 2, rows = Math.ceil(n / cols);
  const inner = Math.min(SW, S) * (style === "haku" ? 0.14 : 0.17);
  const cw = (SW - inner * 2) / cols, chh = (S - inner * 2) / rows;
  [...chars].forEach((ch, i) => {
    const col = cols - 1 - Math.floor(i / rows); // справа налево
    const row = i % rows;
    const gx = pad + inner + col * cw + cw * 0.06, gy = pad + inner + row * chh + chh * 0.04;
    glyphs.push(...glyphStrokes(ch, gx, gy, cw * 0.88, chh * 0.92));
  });
  const lw = Math.min(SW, S) * (n <= 1 ? 0.07 : column ? 0.075 : 0.052);

  c.lineCap = "square"; c.lineJoin = "miter";
  if (style === "haku") {
    c.fillStyle = `rgb(${r},${g},${b})`;
    c.fill(shape);
    c.globalCompositeOperation = "destination-out";
    c.strokeStyle = "#000"; c.lineWidth = lw;
    for (const st of glyphs) { c.beginPath(); st.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
  } else {
    c.strokeStyle = `rgb(${r},${g},${b})`;
    c.lineWidth = Math.min(SW, S) * 0.06;
    c.stroke(shape);
    c.lineWidth = lw;
    for (const st of glyphs) { c.beginPath(); st.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
  }
  c.globalCompositeOperation = "source-over";

  // фактура: неравномерная краска, пятна непропечатки, выщербины по краю
  const img = c.getImageData(0, 0, cv.width, cv.height);
  const d = img.data, w = cv.width, h = cv.height;
  const cell = Math.max(3, Math.round(S / 70));
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const grid = new Float32Array(gw * gh).map(() => R());
  const big = Math.max(8, Math.round(S / 9));
  const bgw = Math.ceil(w / big) + 2, bgh = Math.ceil(h / big) + 2;
  const bgrid = new Float32Array(bgw * bgh).map(() => R());
  const sample = (gr, gwid, cs, x, y) => {
    const fx = x / cs, fy = y / cs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = gr[iy * gwid + ix], b2 = gr[iy * gwid + ix + 1], c2 = gr[(iy + 1) * gwid + ix], d2 = gr[(iy + 1) * gwid + ix + 1];
    return (a * (1 - sx) + b2 * sx) * (1 - sy) + (c2 * (1 - sx) + d2 * sx) * sy;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    if (d[i + 3] === 0) continue;
    const fine = sample(grid, gw, cell, x, y);
    const coarse = sample(bgrid, bgw, big, x, y);
    const speck = R();
    let a = 1;
    // непропечатка: белые проплешины в местах слабого давления
    if (coarse < 0.28 && fine < 0.45) a *= 0.15 + fine;
    if (speck < 0.035) a *= 0.3 + R() * 0.4;
    a *= 0.82 + 0.18 * fine;
    d[i + 3] = Math.round(d[i + 3] * Math.max(0, Math.min(1, a)));
    // плотность пигмента
    const k = 0.9 + 0.2 * coarse;
    d[i] = Math.min(255, r * k); d[i + 1] = g * k; d[i + 2] = b * k;
  }
  c.putImageData(img, 0, 0);

  const pg = p.createGraphics(cv.width, cv.height);
  pg.pixelDensity(1);
  pg.drawingContext.drawImage(cv, 0, 0);
  return { img: pg, size: S, pad };
}

/** Рисует печать с центром в (cx, cy); alpha 0..1, scale для «оттиска». */
export function drawSeal(p, seal, cx, cy, { alpha = 1, scale = 1, rot = 0 } = {}) {
  if (alpha <= 0) return;
  const w = seal.img.width * scale, h = seal.img.height * scale;
  p.push();
  p.translate(cx, cy);
  p.rotate(rot);
  p.tint(255, 255 * alpha);
  p.image(seal.img, -w / 2, -h / 2, w, h);
  p.pop();
}
