// GLSL-шейдеры поверх p5.brush: бумага васи, размывки туши по маске,
// туман, зерно с виньеткой. Линии и мазки остаются на p5.brush.
// Все шейдеры выводят premultiplied alpha (как ожидает смешивание p5 WEBGL).

export const VERT = `
precision highp float;
attribute vec3 aPosition;
attribute vec2 aTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec2 vUv;
void main() {
  vUv = aTexCoord;
  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aPosition, 1.0);
}`;

const NOISE = `
float hash(vec2 p) {
  p = mod(p, 2048.0);
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}
float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * vnoise(p); p = p * 2.07 + vec2(5.3, 1.7); a *= 0.5; }
  return v;
}
`;

// Бумага васи в мировых координатах свитка (не зависит от камеры).
const PAPER = `
float cleanAt(vec2 w) {
  vec2 s = (w - vec2(uCamX, uCamY)) * uZoom + uRes * 0.5;
  float m = 0.0;
  for (int i = 0; i < 8; i++) {
    if (float(i) >= uCleanN) break;
    vec4 r = uClean[i];
    vec2 d = max(vec2(r.x - s.x, r.y - s.y), vec2(s.x - r.z, s.y - r.w));
    float out_ = max(d.x, d.y);
    // v5: край не по прямой рамке — рваный (шум 20–60 px) и мягкий (переход 50 px), начинается внутри рамки
    float rag = (fbm3(s * 0.018 + float(i) * 7.3) - 0.5) * 80.0 + (vnoise(s * 0.07 + 3.0) - 0.5) * 20.0;
    m = max(m, uCleanA[i] * (1.0 - smoothstep(-24.0, 26.0, out_ + rag)));
  }
  return m;
}
vec3 paperColor(vec2 w) {
  float clean = cleanAt(w);
  vec3 base = vec3(0.925, 0.886, 0.808);
  // крупная неравномерность тона и «облачность» массы волокон
  float lo = fbm3(w * 0.0009);
  float mid = fbm(w * 0.0045 + 3.1);
  float floc = fbm(w * 0.018 + 7.0);
  float tone = (lo - 0.5) * 0.055 + (mid - 0.5) * 0.03 + (floc - 0.5) * 0.028;
  vec3 c = base + tone * vec3(1.0, 0.97, 0.9);
  // длинные волокны кодзо: изолинии растянутого, искривлённого шума
  vec2 warp = vec2(fbm3(w * 0.003), fbm3(w * 0.003 + 11.0)) * 6.0;
  float n1 = vnoise(w * vec2(0.0035, 0.011) + warp);
  float n2 = vnoise(w * vec2(0.012, 0.004) + warp.yx + 40.0);
  float n3 = vnoise(w * vec2(0.02, 0.02) + warp * 1.7 + 80.0);
  float f1 = 1.0 - smoothstep(0.0, 0.018, abs(n1 - 0.5));
  float f2 = 1.0 - smoothstep(0.0, 0.014, abs(n2 - 0.5));
  float f3 = 1.0 - smoothstep(0.0, 0.03, abs(n3 - 0.5));
  float sel1 = smoothstep(0.45, 0.7, fbm3(w * 0.01 + 3.0));
  float sel2 = smoothstep(0.5, 0.72, fbm3(w * 0.008 + 9.0));
  c += f1 * sel1 * 0.045 * vec3(1.0, 0.99, 0.96) * (1.0 - clean);   // светлые волокна (не под подписью)
  c -= f2 * sel2 * 0.035 * vec3(0.9, 0.95, 1.1) * (1.0 - clean);    // тёмные волокна
  c += f3 * 0.012 * (1.0 - clean);
  // вкрапления коры
  float speck = smoothstep(0.985, 1.0, hash(floor(w / 3.0) + 7.0)) * smoothstep(0.6, 0.8, fbm3(w * 0.02));
  c -= speck * vec3(0.18, 0.2, 0.22) * (1.0 - clean);
  // мелкое зерно
  // зерно привязано к целым координатам свитка: при дыхании камеры не «кипит»
  c += (hash(floor(w)) - 0.5) * 0.02;
  return c;
}
`;

const HEAD = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;      // размер холста, px
uniform float uCamY;    // мировая Y верхнего края кадра при zoom=1
uniform float uCamX;
uniform float uZoom;
uniform float uTime;     // секунды ролика: медленное оседание туши, дрейф
uniform vec4 uClean[8];  // рамки подписей (x0,y0,x1,y1, экранные px): под ними бумага без волокон
uniform float uCleanA[8];
uniform float uCleanN;
${NOISE}
${PAPER}
// экранные px → мировые координаты свитка
vec2 screenPx() { return vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y); }
vec2 toWorld(vec2 s) { return (s - uRes * 0.5) / uZoom + vec2(uCamX, uCamY); }
`;

export const PAPER_FRAG = `${HEAD}
void main() {
  vec3 c = paperColor(toWorld(screenPx()));
  gl_FragColor = vec4(c, 1.0);
}`;

// Размывка туши по маске. uMask — покрытие (R, размыто), uTone — тон (R).
// Порог с шумом → неровный край; у края — пигментная кайма; внутри —
// грануляция и «облака» плотности; снаружи — лёгкое растекание (нидзими).
export const WASH_FRAG = `${HEAD}
uniform sampler2D uMask;
uniform sampler2D uTone;
uniform vec2 uSize;       // размер элемента, px
uniform vec3 uInk;
uniform float uOpacity;
uniform float uSeed;
uniform float uThr;
uniform float uSoft;
uniform float uEdge;
uniform float uGran;
uniform float uBleed;
uniform float uHalo;
uniform float uStreak;    // вертикальные/диагональные полосы сухой кисти
uniform float uStreakAng;
uniform float uReveal;    // 0..1 — проявление (растекание от тёмного к светлому)
uniform float uBody;      // 0 — только растекание за краем, 1 — заливка целиком
uniform float uFibGran;   // оседание пигмента по волокнам (для цветных размывок)
uniform float uHaloW;     // ширина зоны растекания (в долях покрытия маски)
uniform vec4 uCut;        // разрез сухой кистью: отрезок (x1,y1,x2,y2) в px элемента
uniform vec2 uCutW;       // (ширина, прогресс 0..1)
uniform vec4 uSplit;      // v7: раскол массы — линия (x1,y1,x2,y2) в px элемента
uniform float uSplitP;    // прогресс раскола 0..1 (0 — нет)
uniform float uSplitY;    // y земли в px элемента: ниже щели нет
uniform vec3 uChar;      // v9 A: тлеющий край (сила, «ползёт наружу» 0..1, вздрагивание)
uniform vec4 uCharCut;   // прямоугольник без тления (px элемента): печать, верх щели
uniform vec3 uCharSeg;   // v12: центр массы (px элемента) и доля кромки в каждом угловом куске
float segDist(vec2 p, vec2 a, vec2 b, out float h) {
  vec2 pa = p - a, ba = b - a;
  h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec2 px = vUv * uSize;
  // край размывки очень медленно ползёт (~1 px/с): тушь оседает в волокна
  vec2 creep = vec2(uTime * 0.012, -uTime * 0.008);
  vec2 warp = (vec2(fbm(px * 0.018 + uSeed + creep), fbm(px * 0.018 + uSeed + 9.0 - creep)) - 0.5) * uBleed;
  vec2 uv = vUv + warp / uSize;
  float cov = texture2D(uMask, uv).r;
  float tone = texture2D(uTone, uv).r;
  float edgeN = fbm(px * 0.035 + uSeed * 2.0 + vec2(uTime * 0.02, 0.0));
  float thr = uThr + (edgeN - 0.5) * 0.22;
  // проявление: сначала самые плотные места
  float thrF = thr; // v10: порог готовой массы — для тлеющего края (не ползёт вместе с проявлением)
  thr = mix(1.02, thr, uReveal);
  float a = smoothstep(thr - uSoft, thr + uSoft, cov);
  float band = a * (1.0 - smoothstep(thr + uSoft, thr + uSoft + 0.22, cov));
  // волокна бумаги (для растекания и оседания пигмента)
  vec2 wpx = px + uSeed * 37.0;
  float fa = fbm3(wpx * 0.006) * 6.2831;
  vec2 fd = vec2(cos(fa), sin(fa));
  float along = dot(wpx, fd), acrs = dot(wpx, vec2(-fd.y, fd.x));
  float fib = smoothstep(0.58, 0.82, vnoise(vec2(along * 0.06, acrs * 0.85)));
  float fib2 = smoothstep(0.62, 0.86, vnoise(vec2(along * 0.11 + 7.0, acrs * 1.4)));
  // пигмент: мелкие гранулы, неравномерная влажность, крупные «облака»
  float fine = vnoise(px * 0.55 + uSeed * 3.0);
  float midw = fbm3(px * 0.028 + uSeed * 1.7);
  float cloud = fbm3(px * 0.0055 + uSeed);
  float gran = uGran, fibGran = uFibGran; // v5: зерно размывок под подписью не трогаем
  float dens = 1.0 - gran * (0.22 * (1.0 - fine) + 0.4 * (1.0 - midw)) + gran * 0.5 * (cloud - 0.5);
  // оседание пигмента: гуще в волокнах и в мелких гранулах, светлее между ними
  if (fibGran > 0.0) {
    float gr = vnoise(px * 1.25 + uSeed * 5.0);
    float settle = clamp(fib * 0.9 + fib2 * 0.7 + smoothstep(0.55, 0.85, gr) * 0.6, 0.0, 1.0);
    dens *= 1.0 - fibGran * 0.55 + fibGran * 0.95 * settle;
  }
  // v7: раскол — рваная диагональ, шум низкой частоты (без частых одинаковых зубцов)
  float sm = 1.0;
  if (uSplitP > 0.0) {
    vec2 sa = uSplit.xy, sd = uSplit.zw - uSplit.xy; float sl = length(sd); vec2 sdir = sd / sl;
    vec2 snr = vec2(-sdir.y, sdir.x);
    float t = dot(px - sa, sdir);
    // ось щели — рваная линия с шумом низкой частоты
    float off = (fbm3(vec2(t * 0.004, 7.0)) - 0.5) * 44.0 + (fbm3(vec2(t * 0.016, 3.0)) - 0.5) * 12.0;
    float across = dot(px - sa, snr) - off;
    // ширина 4–24 px, неравномерно по длине; край — рваная фактура (двумерный шум разных масштабов)
    float w = mix(3.0, 21.0, smoothstep(0.38, 0.62, fbm3(vec2(t * 0.011, 1.3))));
    // v11: у верха щель только расширяется вниз (не шире 2 + 0,15·t px): без «капли» на входе
    w = min(w, 2.0 + 0.15 * max(t, 0.0));
    // щель бежит сверху вниз и кончается у линии земли
    float tEnd = (uSplitY - sa.y) / sdir.y;
    // v12: фронт бегущей щели рваный (шум поперёк), а не ровная горизонталь
    float front = uSplitP * tEnd + (vnoise(vec2(across * 0.15, 3.0)) - 0.5) * 18.0 * (1.0 - uSplitP);
    // v12: у низа и у бегущего фронта щель только сужается (без «бусины» и тупого конца)
    w = min(w, 2.0 + 0.12 * max(tEnd - t, 0.0));
    w = min(w, 1.5 + 0.35 * max(front - t, 0.0));
    float rag = (fbm(px * 0.07 + 5.0) - 0.5) * 4.0 * smoothstep(0.0, 50.0, t) * smoothstep(0.0, 50.0, tEnd - t);
    float hw = 0.5 * w + rag;
    float open = (1.0 - smoothstep(front - 4.0, front, t)) * step(0.0, t);
    float ground = 1.0 - smoothstep(uSplitY - 9.0, uSplitY, px.y);
    hw *= ground * smoothstep(0.0, 25.0, t); // верхний конец внутри массы — щель начинается тонкой (v10: 25 px)
    hw *= clamp((tEnd - t) / 30.0, 0.0, 1.0);  // v10: низ острым концом за 30 px — до самой линии земли
    // v8: кромка — неровность 1–3 px с зерном массы (мелкий шум порога), без одинаковых зубцов
    float grain = (vnoise(px * 0.9 + 21.0) - 0.5) * 2.4 + (vnoise(px * 0.37 + 4.0) - 0.5) * 1.6;
    float g = (1.0 - smoothstep(hw - 1.0, hw + 1.0, abs(across) + grain)) * open * step(0.3, hw);
    // одна короткая боковая трещина (верхняя): сужается от щели к концу
    for (int i = 0; i < 1; i++) {
      float tb = tEnd * 0.5; // v8: боковая трещина ниже верхней трети щели
      float ob = (fbm3(vec2(tb * 0.004, 7.0)) - 0.5) * 44.0 + (fbm3(vec2(tb * 0.016, 3.0)) - 0.5) * 12.0;
      vec2 pb = sa + sdir * tb + snr * ob;
      float ang = 0.62; float len = 48.0; // v8: короче (было 85)
      vec2 bd = vec2(sdir.x * cos(ang) - sdir.y * sin(ang), sdir.x * sin(ang) + sdir.y * cos(ang));
      // v12: трещина с изгибом — ломаная из 4 звеньев вдоль дуги, а не прямая по линейке
      vec2 bn = vec2(-bd.y, bd.x);
      float db = 1e9, hb = 0.0;
      for (int q = 0; q < 4; q++) {
        float u0 = float(q) / 4.0, u1 = float(q + 1) / 4.0;
        vec2 p0 = pb + bd * len * u0 + bn * 9.0 * sin(3.14159 * u0) * (1.0 + 0.4 * u0);
        vec2 p1 = pb + bd * len * u1 + bn * 9.0 * sin(3.14159 * u1) * (1.0 + 0.4 * u1);
        float hq; float dq = segDist(px, p0, p1, hq);
        if (dq < db) { db = dq; hb = mix(u0, u1, hq); }
      }
      float bw = mix(3.5, 0.0, hb) + (vnoise(px * 0.3 + 9.0) - 0.5) * 1.5;
      g = max(g, (1.0 - smoothstep(bw - 0.6, bw + 0.6, db)) * step(hb * len, front - tb) * step(0.02, 1.0 - hb));
    }
    sm = 1.0 - g;
  }
  // v9 A: край обугливается — сдвиг порога наружу (кромка ползёт), ширина кромки неровная
  float charOn = 0.0, vein = 0.0;
  if (uChar.x > 0.0) {
    // v9: у печати кромка сходит на нет на ~50 px, без резкого обрыва
    float cut = smoothstep(uCharCut.x - 50.0, uCharCut.x, px.x) * (1.0 - smoothstep(uCharCut.z, uCharCut.z + 50.0, px.x)) * (1.0 - smoothstep(uCharCut.w, uCharCut.w + 50.0, px.y));
    float wN = fbm3(wpx * 0.006 + 31.0);
    float wc = 0.34 * smoothstep(0.32, 0.70, wN) * (1.0 + 0.4 * uChar.z);
    // v10: кромка считается от порога готовой массы и только там, где масса уже проявилась (a):
    // пока масса растекается, внутри неё нет бурых разводов
    // v11: разрывы кромки (≈40 % контура) — общая маска и для бурой полосы, и для «ползущего» края:
    // в разрыве край массы остаётся обычным, без обугливания
    // v12: разрывы по углу вокруг центра массы — 16 кусков по 22,5°, в каждом кромка на своей доле
    // (около uCharSeg.z), начало куска сдвинуто: разрывы разной длины, равномерно по всем сторонам
    vec2 dc = px - uCharSeg.xy;
    float th = atan(dc.y, dc.x) / 6.2831853 + 0.5 + (vnoise(px * 0.02 + 11.0) - 0.5) * 0.012;
    float sp = th * 16.0, sid = floor(sp), sf = fract(sp);
    float h1 = fract(sin(sid * 127.1 + 31.7) * 43758.5453), h2 = fract(sin(sid * 311.7 + 7.3) * 43758.5453);
    // верх (−135…−45°) частично уже без кромки под печатью — там кусков кромки больше
    float topB = step(0.125, (sid + 0.5) / 16.0) * step((sid + 0.5) / 16.0, 0.375) * 0.12;
    float rgtB = step(0.375, (sid + 0.5) / 16.0) * step((sid + 0.5) / 16.0, 0.625) * 0.08; // правый бок — разрывов чуть больше
    float onF = clamp(uCharSeg.z + topB - rgtB + (h1 - 0.5) * 0.3, 0.2, 0.95), st = h2 * (1.0 - onF);
    float gap = smoothstep(st - 0.03, st + 0.03, sf) * (1.0 - smoothstep(st + onF - 0.03, st + onF + 0.03, sf));
    float aC = smoothstep(thrF - uSoft - 0.03 * uChar.y, thrF + uSoft, cov) * smoothstep(0.0, 0.5, a);
    a = max(a, aC * uChar.x * (1.0 - cut) * gap);
    // v9: кромка начинается там же, где масса (тот же альфа-край), и уходит внутрь на wc —
    // вплотную к массе, без светлой полоски; местами прерывается
    // v10: разрывы на ~40 % контура (отдельный шум), ширина своя (wN)
    float band = a * (1.0 - smoothstep(thrF + uSoft * 0.3, thrF + uSoft + wc + 0.001, cov)) * (1.0 - cut) * gap;
    charOn = band * uChar.x;
    // тонкая жилка киновари внутри кромки: местами, мерцает ~12 раз в секунду
    float mid = 1.0 - abs((cov - thrF - uSoft * 0.3) / max(wc + uSoft * 0.7, 0.001) * 2.0 - 1.0);
    float vN = fbm3(wpx * 0.011 + 7.0 + floor(uTime * 12.0) * 0.07);
    vein = smoothstep(0.6, 0.92, mid) * smoothstep(0.48, 0.62, vN) * band * uChar.x * (1.0 + 0.6 * uChar.z);
  }
  float d = a * tone * dens;
  d += band * uEdge * (0.6 + 0.6 * edgeN) * max(tone, 0.35);
  // сухая кисть: полосы вдоль направления мазка
  if (uStreak > 0.0) {
    vec2 dir = vec2(cos(uStreakAng), sin(uStreakAng));
    float acr2 = dot(px, vec2(-dir.y, dir.x));
    float alg2 = dot(px, dir);
    float s = vnoise(vec2(acr2 * 0.22, alg2 * 0.004 + uSeed));
    d *= 1.0 - uStreak * smoothstep(0.45, 0.75, s) * (0.5 + 0.5 * (1.0 - tone));
  }
  // нидзими: не ровный ореол, а подтёки вдоль волокон бумаги.
  // Волокна — вытянутый шум в случайном направлении; растекание есть
  // только местами (gate) и только в узкой полосе за краем.
  float gate = smoothstep(0.42, 0.68, fbm3(wpx * 0.012 + 3.0));
  float ring = smoothstep(thr - uHaloW, thr, cov) * (1.0 - a);
  float halo = ring * (fib * 0.9 + fib2 * 0.5) * gate * uHalo * tone;
  d = clamp((d * uBody + halo) * uOpacity, 0.0, 1.0) * sm;
  // разрез: бумага проступает сквозь тушь рваной полосой сухой кисти
  if (uCutW.y > 0.0) {
    float h;
    float dist = segDist(px, uCut.xy, uCut.zw, h);
    float wv = uCutW.x * (0.35 + 0.65 * sin(3.14159 * clamp(h, 0.0, 1.0))) * (0.8 + 0.4 * vnoise(vec2(h * 30.0, 2.0)));
    vec2 dir = normalize(uCut.zw - uCut.xy);
    float across = dot(px - uCut.xy, vec2(-dir.y, dir.x));
    float hairs = vnoise(vec2(across * 0.5, h * 9.0 + 4.0));
    float hairs2 = vnoise(vec2(across * 1.3, h * 30.0 + 9.0));
    float body = 1.0 - smoothstep(wv * 0.45, wv, dist + (hairs - 0.5) * wv * 0.7);
    // к концу разреза кисть сохнет: остаются только отдельные волоски
    float dry = smoothstep(0.55, 1.0, h);
    float strand = smoothstep(0.35 + 0.4 * dry, 0.6 + 0.3 * dry, hairs2);
    float cut = body * mix(1.0, strand, 0.35 + 0.65 * dry) * step(h, uCutW.y);
    cut *= smoothstep(0.0, 0.02, uCutW.y - h + 0.02);
    d *= 1.0 - cut * 0.97;
  }
  // мягкое затухание к границам элемента — никаких прямых срезов
  vec2 bb = smoothstep(vec2(0.0), vec2(0.035), vUv) * smoothstep(vec2(0.0), vec2(0.035), 1.0 - vUv);
  d *= bb.x * bb.y;
  // v9: бурая кромка и жилки кладутся ПОВЕРХ массы (premultiplied «over»): тон от массы к кромке
  // меняется монотонно, без светлой полоски между ними
  float cA = clamp(charOn * 0.95, 0.0, 1.0) * bb.x * bb.y * sm;
  vec3 pre = uInk * d * (1.0 - cA) + vec3(0.27, 0.12, 0.05) * cA;
  float dT = d * (1.0 - cA) + cA;
  float dv = clamp(vein, 0.0, 1.0) * bb.x * bb.y * sm * 0.9;
  pre = pre * (1.0 - dv) + vec3(0.66, 0.25, 0.14) * dv;
  dT = dT * (1.0 - dv) + dv;
  gl_FragColor = vec4(pre, dT);
}`;

// Туман: бумага, проступающая поверх изображения (цвет = цвет бумаги в этой
// точке, поэтому туман неотличим от чистого листа). Полоса по Y с fbm.
export const MIST_FRAG = `${HEAD}
uniform vec2 uSize;
uniform float uSeed;
uniform float uDensity;
uniform float uDrift;     // смещение во времени
uniform float uScaleX;
uniform float uTopSoft;   // мягкость верха/низа полосы (доля)
void main() {
  vec2 px = vUv * uSize;
  vec2 q = px * vec2(0.0022 / uScaleX, 0.006) + vec2(uDrift, 0.0) + uSeed;
  float n = fbm(q + vec2(fbm3(q * 0.7 + 3.0), 0.0) * 1.2);
  float v = vUv.y;
  float band = smoothstep(0.0, uTopSoft, v) * (1.0 - smoothstep(1.0 - uTopSoft, 1.0, v));
  float a = clamp(band * uDensity * smoothstep(0.25, 0.75, n + (band - 0.5) * 0.6), 0.0, 1.0);
  vec3 c = paperColor(toWorld(screenPx()));
  gl_FragColor = vec4(c * a, a);
}`;

// Финальный проход: мягкая виньетка + зерно (детерминированное по кадру).
export const POST_FRAG = `${HEAD}
uniform float uFrame;
uniform float uVignette;
uniform float uGrain;
void main() {
  vec2 s = screenPx();
  vec2 uv = s / uRes;
  vec2 d = (uv - 0.5) * vec2(1.0, uRes.y / uRes.x * 0.62);
  float vig = smoothstep(0.25, 0.95, length(d)) * uVignette;
  float g = hash(s + vec2(uFrame * 37.0, uFrame * 91.0)) - 0.5;
  float g2 = vnoise(s * 0.5 + uFrame * 13.0) - 0.5;
  float grain = (g * 0.7 + g2 * 0.6) * uGrain;
  // затемнение: чёрный с альфой; зерно: светлое или тёмное
  float a = clamp(vig + max(-grain, 0.0), 0.0, 1.0);
  vec4 dark = vec4(vec3(0.08, 0.06, 0.05) * a, a);
  float l = max(grain, 0.0);
  gl_FragColor = dark + vec4(vec3(l), l) * (1.0 - a);
}`;

// Разрез: полоса чистой бумаги с рваными краями сухой кисти поверх всего
// (иероглифа, ночи, фигур). uCut — отрезок в px элемента, uCutW — (ширина, прогресс).
export const CUT_FRAG = `${HEAD}
uniform vec2 uSize;
uniform vec4 uCut;
uniform vec2 uCutW;
void main() {
  vec2 px = vUv * uSize;
  vec2 a = uCut.xy, b = uCut.zw, pa = px - a, ba = b - a;
  float L = length(ba);
  vec2 dir = ba / L, nrm = vec2(-dir.y, dir.x);
  float h = clamp(dot(pa, dir) / L, 0.0, 1.0);
  float acr = dot(pa, nrm);
  // v6: разрез бумаги. Ширина меняется по длине и сходит к нулю у обоих концов; лёгкий изгиб
  float ap = h * L; // расстояние вдоль разреза, px
  float prof = pow(sin(3.14159 * h), 0.6) * (0.75 + 0.5 * (fbm3(vec2(ap * 0.004, 2.0)) - 0.5) * 2.0);
  acr -= sin(h * 3.14159) * uCutW.x * 0.6;
  float wv = uCutW.x * max(prof, 0.0);
  // рваный край: крупная волна вдоль кромки + неправильный 2D-шум (без регулярных зубцов)
  float rag = (fbm3(vec2(ap * 0.006, sign(acr) * 3.0)) - 0.5) * 0.5
            + (fbm(px * 0.045 + 11.0) - 0.5) * 0.4;
  // волокна бумаги торчат из кромки поперёк неё: редкие короткие нити разной длины (до 7 px)
  float fibN = vnoise(vec2(ap * 0.42, sign(acr) * 5.0 + 1.0));
  float fibers = smoothstep(0.68, 0.95, fibN) * (3.0 + 4.0 * vnoise(vec2(ap * 0.13, 9.0)));
  float edge = wv * (0.88 + rag) + fibers * step(0.5, wv);
  float body = 1.0 - smoothstep(edge - 1.2, edge + 1.2, abs(acr));
  // нулевая ширина у концов и за ними — нет волосяной линии по оси
  float along = dot(pa, dir);
  body *= smoothstep(0.3, 1.5, wv) * step(0.0, along) * step(along, L);
  float k = body * step(h, uCutW.y) * smoothstep(0.0, 0.015, uCutW.y - h + 0.015);
  vec3 c = paperColor(toWorld(screenPx()));
  gl_FragColor = vec4(c * k, k);
}`;
