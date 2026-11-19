// Кисти и хелперы «рисования кистью» на p5.brush.
//
// Почему не просто brush.line(x1, y1, lerp(...)): нажим встроенных кистей
// считается от полной длины штриха, поэтому растущая линия «дышит» от кадра
// к кадру. Поэтому:
//  - прямые штрихи рисуются целиком и открываются прямоугольным brush.clip()
//    в повёрнутой системе координат (revealLine);
//  - кривые рисуются кистями с постоянным собственным нажимом, а форма нажима
//    задаётся в контрольных точках пути по абсолютной длине (drawPath).
//    Тогда уже нарисованная часть штриха не меняется, пока он растёт.

export const INK = "#151311";
export const INK_SOFT = "#2b2824";
export const GREY = "#56524c";
export const GREY_LIGHT = "#8a847b";
export const SEAL_RED = "#b3261e";

// Постоянный собственный нажим кисти, без случайных вариаций по длине.
const FLAT = {
  type: "custom",
  curve: () => 1,
  min_max: [1, 1],
  variation: { offset: 0, warp: 0, scale: 0, tilt: 0 },
};

export function setupBrushes(brush) {
  // Основная тушь: плотная, со слегка рваным краем.
  brush.add("sumi", {
    type: "default", weight: 9, scatter: 0.9, sharpness: 0.55, grain: 4,
    opacity: 230, spacing: 0.06, pressure: FLAT, rotate: "none", noise: 0.15,
  });
  // Ореол влажной туши под основным штрихом.
  brush.add("sumi-halo", {
    type: "default", weight: 12, scatter: 1.6, sharpness: 0.1, grain: 2.5,
    opacity: 16, spacing: 0.08, pressure: FLAT, rotate: "none", noise: 0.2,
  });
  // Сухая кисть: разрывы, «касурэ».
  brush.add("sumi-dry", {
    type: "default", weight: 9, scatter: 3.2, sharpness: 0.8, grain: 0.9,
    opacity: 170, spacing: 0.1, pressure: FLAT, rotate: "none", noise: 0.3,
  });
  // Отдельный волосок кисти (для makeInkStroke).
  brush.add("sumi-hair", {
    type: "default", weight: 2.2, scatter: 0.4, sharpness: 0.55, grain: 3,
    opacity: 200, spacing: 0.06, pressure: FLAT, rotate: "none", noise: 0.25,
  });
  // Фудэ: плоский кончик под 45° (как наклонная кисть каллиграфа).
  // Горизонтали выходят тоньше вертикалей, входы черт — косые.
  // Кончик растеризуется один раз; случайность — свой ГПСЧ, чтобы
  // во всех вкладках рендера кончик был одинаковым.
  brush.add("fude", {
    type: "custom", weight: 10, scatter: 0.04, opacity: 150, spacing: 1.1,
    pressure: FLAT, rotate: "none", markerTip: false, noise: 0.15,
    tip: (m) => {
      let a = 12345;
      const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      m.noStroke();
      const ang = -Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
      // кончик-«стамеска»: плотный прямоугольник 92×30 под 45° с рваной кромкой
      for (let i = 0; i < 520; i++) {
        const ex = (r() * 2 - 1) * 46, ey = (r() * 2 - 1) * 15;
        const edge = Math.abs(ex) > 40 || Math.abs(ey) > 12;
        const x = ex * ca - ey * sa, y = ex * sa + ey * ca;
        m.fill(0, edge ? 180 + r() * 75 : 255);
        m.circle(x, y, edge ? 2 + r() * 3.5 : 7 + r() * 7);
      }
    },
  });
  // Пункт Б: на тонком кончике (крючок 水) отпечатки «стамески» с шагом 1,1 расходились в серую лесенку —
  // для сухого конца v2 тот же кончик с частым шагом.
  brush.add("fude-dense", {
    type: "custom", weight: 10, scatter: 0.04, opacity: 150, spacing: 0.35,
    pressure: FLAT, rotate: "none", markerTip: false, noise: 0.15,
    tip: (m) => {
      let a = 12345;
      const r = () => ((a = (a * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
      m.noStroke();
      const ang = -Math.PI / 4, ca = Math.cos(ang), sa = Math.sin(ang);
      // кончик-«стамеска»: плотный прямоугольник 92×30 под 45° с рваной кромкой
      for (let i = 0; i < 520; i++) {
        const ex = (r() * 2 - 1) * 46, ey = (r() * 2 - 1) * 15;
        const edge = Math.abs(ex) > 40 || Math.abs(ey) > 12;
        const x = ex * ca - ey * sa, y = ex * sa + ey * ca;
        m.fill(0, edge ? 180 + r() * 75 : 255);
        m.circle(x, y, edge ? 2 + r() * 3.5 : 7 + r() * 7);
      }
    },
  });
  // Тонкое перо для мелких линий.
  brush.add("sumi-fine", {
    type: "default", weight: 2.4, scatter: 0.35, sharpness: 0.6, grain: 5,
    opacity: 220, spacing: 0.06, pressure: FLAT, rotate: "none", noise: 0.15,
  });
}

// ---------- время ----------

export const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Прогресс внутри окна [a, b] (в долях сцены или в секундах).
export const seg = (t, a, b) => clamp01((t - a) / (b - a));
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOut = (x) => 1 - Math.pow(1 - x, 3);
export const easeIn = (x) => x * x * x;
// «Движение кисти»: быстрый старт, мягкая остановка.
export const brushEase = (x) => 1 - Math.pow(1 - clamp01(x), 2.2);
export const lerp = (a, b, k) => a + (b - a) * k;

// ---------- прямые штрихи ----------

/**
 * Прямой штрих, открывающийся от (x1,y1) к (x2,y2) по prog ∈ [0,1].
 * pad — запас клипа поперёк штриха (толщина + разброс кисти).
 */
export function revealLine(p, brush, x1, y1, x2, y2, prog, pad = 80) {
  if (prog <= 0) return;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ang = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  p.push();
  p.translate(x1, y1);
  p.rotate(ang); // angleMode(DEGREES)
  if (prog < 1) brush.clip([-pad, -pad, len * prog, pad]);
  brush.line(0, 0, len, 0);
  brush.noClip();
  p.pop();
}

// ---------- кривые штрихи ----------

/**
 * Готовит путь: points — массив [x, y], pressure(s, L) — нажим
 * по абсолютной длине s. Точки лучше давать с шагом 6–20 px.
 */
export function makePath(points, pressure = () => 1) {
  const n = points.length;
  const cum = [0];
  for (let i = 1; i < n; i++) {
    const [ax, ay] = points[i - 1], [bx, by] = points[i];
    cum.push(cum[i - 1] + Math.hypot(bx - ax, by - ay));
  }
  const L = cum[n - 1];
  // Касательные (в градусах, ось y вверх — как в brush.move).
  const tan = points.map((_, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(n - 1, i + 1)];
    return -Math.atan2(b[1] - a[1], b[0] - a[0]) * (180 / Math.PI);
  });
  // Разворачиваем углы, чтобы не было скачков через 360.
  for (let i = 1; i < n; i++) {
    while (tan[i] - tan[i - 1] > 180) tan[i] -= 360;
    while (tan[i] - tan[i - 1] < -180) tan[i] += 360;
  }
  // У кистей p5.brush диаметр точки ~ нажим², поэтому передаём √нажима:
  // ширина мазка получается линейной по нажиму.
  const pres = cum.map((s) => Math.sqrt(Math.max(0, pressure(s, L))));
  return { points, cum, L, tan, pres };
}

/** Рисует префикс пути длиной prog·L текущей кистью. */
export function drawPath(brush, path, prog) {
  if (prog <= 0) return;
  const { points, cum, L, tan, pres } = path;
  const target = Math.min(1, prog) * L;
  if (target < 1.5) return;
  const n = points.length;
  let k = 0;
  while (k + 1 < n && cum[k + 1] <= target) k++;
  brush.beginStroke(path.type ?? "segments", points[0][0], points[0][1]);
  for (let i = 0; i < k; i++) brush.move(tan[i], cum[i + 1] - cum[i], pres[i]);
  let endA = tan[k], endP = pres[k];
  const rest = target - cum[k];
  if (k < n - 1 && rest > 0.5) {
    const f = rest / (cum[k + 1] - cum[k]);
    brush.move(tan[k], rest, pres[k]);
    endA = lerp(tan[k], tan[k + 1], f);
    endP = lerp(pres[k], pres[k + 1], f);
  }
  brush.endStroke(endA, endP);
}

/** Сэмплирует функцию f(u) → [x, y] на step-px шаг. */
export function sampleCurve(f, approxLen, step = 8) {
  const n = Math.max(2, Math.ceil(approxLen / step));
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(f(i / n));
  return pts;
}

// ---------- мазок суми-э: тело + волоски кисти ----------

// Детерминированный 1D-шум значений.
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u);
}
const smooth = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };

/**
 * Мазок широкой кистью по точкам pts:
 *  - ореол влажной туши (широкий, светлый);
 *  - «тело» мазка;
 *  - N волосков поперёк ширины; к концу мазка тушь кончается,
 *    тело истончается, а волоски рвутся — получается сухая кисть (касурэ).
 * Все пути префиксно-стабильны: растущий мазок не дрожит.
 */
export function makeInkStroke(pts, {
  width = 22, pressure = strokePressure(), bristles = 14, dryStart = 0.6,
  dryness = 0.85, seed = 1, halo = false, fude = false, hairsDryOnly = false, grey = false, gapVar = false, dryV1 = false,
} = {}) {
  const base = makePath(pts, pressure);
  const n = pts.length;
  // нормали
  const nrm = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [-dy / l, dx / l];
  });
  const L = base.L;
  const u = base.cum.map((s) => s / L);
  const dry = u.map((x) => smooth(dryStart, 1, x)); // 0 — мокро, 1 — сухо

  const body = makePath(pts, (s, LL) => {
    const k = s / LL;
    return pressure(s, LL) * (1 - 0.97 * smooth(dryStart - 0.1, 0.92, k));
  });
  // Ореол — только там, где тушь ещё влажная.
  const wet = makePath(pts, (s, LL) => pressure(s, LL) * (1 - smooth(dryStart - 0.2, dryStart + 0.2, s / LL)));

  const hairs = [];
  // Пункт Б («гребёнка»): раньше волоски шли через равные промежутки поперёк кисти (off = (b+0,5)/n),
  // с одним периодом разрывов и одинаковой длиной — на сухом конце получались ровные параллельные зубья.
  // DRY_V2: у каждой черты своё число волосков, волоски стоят неравномерно, у каждого своя толщина,
  // свой период разрывов (два масштаба шума) и своя длина — сухой конец рвётся по-разному.
  const DRY_V2 = (globalThis.__DRY_V2 ?? true) && !dryV1; // dryV1 — старая сухая кисть для отдельного мазка
  const nb = DRY_V2 ? Math.max(3, Math.round(bristles * (0.55 + 0.8 * hash(seed * 1.37 + 3)))) : bristles;
  if (DRY_V2) { gapVar = true; }
  for (let b = 0; b < nb; b++) {
    const off = DRY_V2 ? (hash(b * 3.17 + seed * 0.71) * 2 - 1) * 0.92 : (b + 0.5) / bristles * 2 - 1; // -1..1 поперёк кисти
    const jitter = (hash(b * 7.7 + seed) - 0.5) * (DRY_V2 ? 0.08 : 0.18);
    const thick = DRY_V2 ? 0.45 + 1.0 * hash(b * 5.3 + seed * 2.1) : 1;   // своя толщина волоска
    const uEnd = DRY_V2 ? 0.78 + 0.22 * hash(b * 9.1 + seed * 0.3) : 1;   // своя длина: волоски кончаются вразнобой
    const hp = pts.map((pt, i) => {
      const w = (width / 2) * base.pres[i] ** 2 * (off + jitter) * (1 + 0.25 * dry[i]); // к концу волоски расходятся
      return [pt[0] + nrm[i][0] * w, pt[1] + nrm[i][1] * w];
    });
    // на крутом повороте (крючок) волосок с внутренней стороны складывается: путь идёт назад
    // и кисть оставляет серую «лесенку». Там, где путь волоска пошёл против черты, волосок гаснет.
    const fold = hp.map((q, i) => {
      if (!DRY_V2) return 1;
      const j = Math.min(i, hp.length - 2);
      const hx = hp[j + 1][0] - hp[j][0], hy = hp[j + 1][1] - hp[j][1];
      const bx = pts[j + 1][0] - pts[j][0], by = pts[j + 1][1] - pts[j][1];
      const bl = bx * bx + by * by;
      return bl < 1e-6 ? 1 : smooth(0.15, 0.45, (hx * bx + hy * by) / bl);
    });
    for (let k = 0; k < 2 && DRY_V2; k++) for (let i = fold.length - 2; i > 0; i--) fold[i] = Math.min(fold[i - 1], fold[i], fold[i + 1]);
    const hairPres = base.cum.map((s, i) => {
      const edge = 1 - 0.35 * Math.abs(off);            // по краям кисти туши меньше
      // gapVar: у каждого волоска свой период разрывов (8–80 px) и два масштаба шума —
      // разрывы разной длины, а не ровный пунктир
      const per = gapVar ? 8 + 72 * hash(b * 3.3 + seed) : 18 + 14 * hash(b + seed);
      const gap = gapVar ? 0.65 * noise1(s / per, b * 3.1 + seed) + 0.35 * noise1(s / (per * 0.23), b * 5.7 + seed + 7) : noise1(s / per, b * 3.1 + seed);
      const thr = dry[i] * dryness * (gapVar ? 0.75 + 0.5 * hash(b * 5.1 + seed) : 1); // чем суше, тем больше разрывов
      const on = smooth(thr - 0.08, thr + 0.08, gap);
      const gate = hairsDryOnly ? smooth(dryStart - 0.25, dryStart, u[i]) : 1;
      const tail = DRY_V2 ? 1 - smooth(uEnd - 0.04, uEnd, u[i]) : 1;
      return gate * tail * fold[i] * thick * base.pres[i] ** 2 * edge * (0.75 + 0.5 * noise1(s / 60, b + seed * 9)) * on;
    });
    hairs.push(makePathRaw(hp, hairPres));
  }
  return { base, body, wet, hairs, halo, width, fude, grey, dryV1 };
}

// Путь с готовым массивом нажима (по точкам).
function makePathRaw(points, presArr) {
  const path = makePath(points, () => 1);
  path.pres = presArr.map((v) => Math.sqrt(Math.max(0.0001, v)));
  return path;
}

/** Рисует мазок до prog. reseed(k) — пересидирование по элементу. */
export function drawInkStroke(brush, st, prog, { color = INK, reseed = () => {}, id = 0, haloColor = GREY } = {}) {
  if (prog <= 0) return;
  const w = st.width;
  if (st.halo) {
    reseed(id * 100 + 1);
    brush.set("sumi-halo", haloColor, (w * 1.05) / 12);
    drawPath(brush, st.wet, prog);
  }
  reseed(id * 100 + 2);
  if (st.fude) brush.set((globalThis.__DRY_V2 ?? true) && !st.dryV1 ? "fude-dense" : "fude", color, w / 10 / 0.92);
  else brush.set("sumi", color, (w * 0.6) / 9);
  drawPath(brush, st.body, prog);
  // Волосок обычной кисти рисуется в 1 px при любой ширине мазка, поэтому у тонкого мазка волосков меньше:
  // у почти нулевой дуги 7 волосков по 1 px складываются в тёмную чёрточку («Пять колец» v14, pipeline.md, раздел 3).
  const nHairs = st.fude ? st.hairs.length : Math.min(st.hairs.length, Math.floor(w / 2.5));
  st.hairs.forEach((h, i) => {
    if (i >= nHairs) return;
    reseed(id * 100 + 10 + i);
    brush.set("sumi-hair", color, st.fude ? w / 26 : 1);
    drawPath(brush, h, prog);
  });
}

/**
 * «Живая линия» для контуров пейзажа: нажим всё время меняется
 * (утолщения и истончения), местами кисть рвётся и пропадает,
 * к концу сохнет. Постоянной толщины не бывает.
 *  breaks — доля разрывов (0..1), dry — насколько сухой хвост.
 */
export function liveStroke(pts, { width = 10, seed = 1, breaks = 0.35, dry = 0.6, taperIn = 0.1, taperOut = 0.3, bristles = 7, fude = false, swell = 0.55 } = {}) {
  const pressure = (s, L) => {
    const u = s / L;
    const env = Math.min(1, u / taperIn) * (u > 1 - taperOut ? Math.max(0, (1 - u) / taperOut) ** 0.8 : 1);
    const mod = 1 - swell * 0.5 + swell * noise1(s / 70, seed) + 0.25 * (noise1(s / 23, seed + 5) - 0.5);
    // разрывы: шум ниже порога — кисть отрывается от бумаги
    const g = noise1(s / 48, seed + 11);
    const cut = breaks > 0 && u > 0.08 ? smooth(breaks * 0.42 - 0.03, breaks * 0.42 + 0.03, g) : 1;
    return Math.max(0, (0.25 + 0.75 * env) * mod * cut * (env > 0 ? 1 : 0));
  };
  return makeInkStroke(pts, { width, pressure, bristles, dryStart: 1 - dry * 0.7, dryness: 0.6 + dry * 0.35, seed, fude, hairsDryOnly: false });
}

/** Типичный нажим мазка: нарастание, тело, сход на нет. */
export function strokePressure({ start = 0.35, body = 1, end = 0.25, attack = 0.08, release = 0.25, wobble = 0.08, seed = 1 } = {}) {
  return (s, L) => {
    const u = s / L;
    let v = body;
    if (u < attack) v = lerp(start, body, easeOut(u / attack));
    else if (u > 1 - release) v = lerp(body, end, easeIn((u - (1 - release)) / release));
    // медленная «дрожь руки», детерминированная по seed
    v *= 1 + wobble * Math.sin(u * 17.3 + seed) * Math.sin(u * 5.1 + seed * 2.7);
    return v;
  };
}
