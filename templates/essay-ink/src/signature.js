// Подпись художника в финале: логотип, впечатанный в бумагу как печать, и строка рядом (например «Studio»).
// Из «Пяти колец» v14 (каркас эссе, раздел 5). Параметры — config.json, ключ "logo".
//
// Логотип лежит на листе и едет с камерой вместе с бумагой: зерно и волокна бумаги кадра читаются из кадра
// (readPixels) и проступают сквозь краску, плотность краски неровная (места слабого нажима, точки непропечатки).
// Цвет каждого пикселя логотипа и его форма не меняются, меняется только плотность (альфа). Края без каймы.
// Вызывается из screen(ctx) модуля финала: drawSignature(ctx, { t0 }) — t0 в секундах сцены (конец финальной фразы).
import { trackedText, trackedWidth } from "./type.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const hash = (x, y, k) => { let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const vnoise = (x, y, k) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, k), b = hash(ix + 1, iy, k), c = hash(ix, iy + 1, k), d = hash(ix + 1, iy + 1, k);
  return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
};

let src = null, printImg = null;
function logoPixels(logo) {
  if (src) return src;
  logo.loadPixels();
  const w = logo.width, h = logo.height, px = logo.pixels;
  return (src = { w, h, px });
}

// плотность краски в координатах логотипа (не меняется от кадра к кадру)
function density(u, v, press) {
  const big = vnoise(u / 34, v / 34, 5), coarse = vnoise(u / 16, v / 16, 3), mid = vnoise(u / 5, v / 5, 7);
  let d = (1 - 0.16 * press) + 0.16 * press * coarse;
  d *= 0.94 + 0.06 * mid;
  if (big < 0.3) d *= 1 - press * (0.38 - 1.2 * big); // крупные места слабого нажима
  if (coarse < 0.22 && mid < 0.4) d *= 0.8 + 0.5 * mid; // мелкие места слабого нажима
  const sp = hash(Math.floor(u / 1.6), Math.floor(v / 1.6), 11);
  if (sp < 0.035) d *= 0.45 + 6 * sp; // точки непропечатки
  return d;
}

export function signatureLayout(p, fonts, L) {
  const st = L.studio;
  let sw = 0;
  if (st?.text) {
    p.push(); p.textFont(fonts[st.font ?? "medium"]); p.textSize(st.size); sw = trackedWidth(p, st.text, (st.tracking ?? 0.12) * st.size); p.pop();
  }
  return { sw, total: L.width + (st?.text ? (L.gap ?? 18) + sw : 0) };
}

/** Рисует подпись. opts.t0 — секунда сцены, когда начинается проявление (обычно конец финальной фразы). */
export function drawSignature(ctx, { t0 }) {
  const { p, s, fonts, logo, logoCfg: L, cam, camAt, W, H } = ctx;
  if (!logo || !L) return;
  const fadeDur = L.fade ?? 0.5;
  const u0 = clamp01((s - t0) / fadeDur);
  const fade = u0 * u0 * (3 - 2 * u0); // smoothstep: видимая часть (альфа 0,02 → 0,98) ≈ 0,8 × fadeDur
  if (fade <= 0.002) return;
  const lw = L.width, lh = Math.round(logo.height * (lw / logo.width));
  const { total } = signatureLayout(p, fonts, L);
  // точка на бумаге: где подпись стоит (экранные px) в момент полной силы; дальше едет вместе с листом
  const ref = camAt(t0 + fadeDur);
  const sc = ctx.scene;
  const wx = (L.spot.x1 - total - W / 2) / ref.zoom + ref.cx, wy = (L.spot.y0 - H / 2) / ref.zoom + ref.cy - sc.top;
  const k = cam.zoom / ref.zoom;
  const X = (wx - cam.cx) * cam.zoom + W / 2, Y = (wy + sc.top - cam.cy) * cam.zoom + H / 2;
  const scale = (lw / logo.width) * k; // px экрана на px файла логотипа
  const S = logoPixels(logo);
  const bx = Math.floor(X) - 2, by = Math.floor(Y) - 2, bw = Math.ceil(lw * k) + 5, bh = Math.ceil(lh * k) + 5;
  // бумага под подписью из текущего кадра (строки readPixels идут снизу вверх)
  const gl = p.drawingContext, rp = new Uint8Array(bw * bh * 4);
  gl.readPixels(bx, H - by - bh, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, rp);
  const Lp = new Float32Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const q = ((bh - 1 - j) * bw + i) * 4;
    Lp[j * bw + i] = 0.3 * rp[q] + 0.59 * rp[q + 1] + 0.11 * rp[q + 2];
  }
  // местное среднее бумаги (окно 11×11): светлые волокна и бугорки берут меньше краски
  const I = new Float64Array((bw + 1) * (bh + 1));
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) I[(j + 1) * (bw + 1) + i + 1] = Lp[j * bw + i] + I[j * (bw + 1) + i + 1] + I[(j + 1) * (bw + 1) + i] - I[j * (bw + 1) + i];
  if (!printImg || printImg.width !== bw || printImg.height !== bh) printImg = p.createImage(bw, bh);
  printImg.loadPixels();
  const out = printImg.pixels, press = L.press ?? 1, grainK = L.grain ?? 0.06;
  const at = (x, y, c) => (x < 0 || y < 0 || x >= S.w || y >= S.h ? 0 : S.px[(y * S.w + x) * 4 + c]);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const o = (j * bw + i) * 4;
    const u = (bx + i + 0.5 - X) / scale - 0.5, v = (by + j + 0.5 - Y) / scale - 0.5;
    let a = 0, r = 0, g = 0, b = 0;
    if (u > -1 && v > -1 && u < S.w && v < S.h) {
      const iu = Math.floor(u), iv = Math.floor(v), fu = u - iu, fv = v - iv;
      const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
      const A = [at(iu, iv, 3) * w00, at(iu + 1, iv, 3) * w10, at(iu, iv + 1, 3) * w01, at(iu + 1, iv + 1, 3) * w11];
      a = (A[0] + A[1] + A[2] + A[3]) / 255;
      if (a > 0) {
        // цвет — среднее по альфе (без тёмной каймы от прозрачных пикселей)
        const sa = A[0] + A[1] + A[2] + A[3];
        const ch = (c) => (at(iu, iv, c) * A[0] + at(iu + 1, iv, c) * A[1] + at(iu, iv + 1, c) * A[2] + at(iu + 1, iv + 1, c) * A[3]) / sa;
        r = ch(0); g = ch(1); b = ch(2);
        const x0 = Math.max(0, i - 5), x1 = Math.min(bw, i + 6), y0 = Math.max(0, j - 5), y1 = Math.min(bh, j + 6);
        const mean = (I[y1 * (bw + 1) + x1] - I[y0 * (bw + 1) + x1] - I[y1 * (bw + 1) + x0] + I[y0 * (bw + 1) + x0]) / ((x1 - x0) * (y1 - y0));
        const grain = Math.max(0.55, Math.min(1, 1 - grainK * (Lp[j * bw + i] - mean)));
        // плотность в px логотипа на экране (масштаб пятен не зависит от размера файла)
        a *= Math.min(1, density(u * lw / S.w, v * lw / S.w, press) * grain);
      }
    }
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(255 * a * fade);
  }
  printImg.updatePixels();
  p.push(); p.imageMode(p.CORNER); p.noStroke(); p.noTint(); p.image(printImg, bx, by, bw, bh); p.pop();
  const st = L.studio;
  if (st?.text) {
    trackedText(p, st.text, X + total * k, Y + (L.baseline ?? lh * 0.91) * k, {
      font: fonts[st.font ?? "medium"], size: st.size * k, tracking: st.tracking ?? 0.12, align: "right", alpha: fade, color: st.color ?? [12, 10, 9],
    });
  }
}
