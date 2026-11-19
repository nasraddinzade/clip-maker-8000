// Обёртки для GL-слоёв: бумага, размывки по маске, туман, пост-обработка.
import { VERT, PAPER_FRAG, WASH_FRAG, MIST_FRAG, POST_FRAG, CUT_FRAG } from "./shaders.js";

let S = null;      // скомпилированные шейдеры
let WHITE = null;  // тон по умолчанию
let CAM = { cx: 540, cy: 960, zoom: 1 };
let RES = [1080, 1920];
let TIME = 0;
export function setTime(t) { TIME = t; }

export function initGL(p, W, H) {
  RES = [W, H];
  S = {
    paper: p.createShader(VERT, PAPER_FRAG),
    wash: p.createShader(VERT, WASH_FRAG),
    mist: p.createShader(VERT, MIST_FRAG),
    post: p.createShader(VERT, POST_FRAG),
    cut: p.createShader(VERT, CUT_FRAG),
  };
  WHITE = p.createGraphics(4, 4);
  WHITE.background(255);
}

export function setCamera(cam) { CAM = cam; }

// рамки подписей текущего кадра: под ними бумага без волокон (setCleanRects из main.js)
let CLEAN = { r: new Array(32).fill(0), a: new Array(8).fill(0), n: 0 };
export function setCleanRects(rects) {
  const r = new Array(32).fill(0), a = new Array(8).fill(0);
  rects.slice(0, 8).forEach((b, i) => { r.splice(i * 4, 4, b.x0 - 10, b.y0 - 10, b.x1 + 10, b.y1 + 10); a[i] = Math.min(1, b.alpha * 1.5); });
  CLEAN = { r, a, n: Math.min(8, rects.length) };
}
function common(sh) {
  sh.setUniform("uClean", CLEAN.r);
  sh.setUniform("uCleanA", CLEAN.a);
  sh.setUniform("uCleanN", CLEAN.n);
  sh.setUniform("uRes", RES);
  sh.setUniform("uCamX", CAM.cx);
  sh.setUniform("uCamY", CAM.cy);
  sh.setUniform("uZoom", CAM.zoom);
  sh.setUniform("uTime", TIME);
}

/** Бумага на весь кадр (в экранных координатах, без трансформаций). */
export function drawPaper(p) {
  p.push();
  p.resetMatrix();
  p.noStroke();
  p.shader(S.paper);
  common(S.paper);
  p.rect(-RES[0] / 2, -RES[1] / 2, RES[0], RES[1]);
  p.resetShader();
  p.pop();
}

export function drawPost(p, frame, { vignette = 0.16, grain = 0.05 } = {}) {
  p.push();
  p.resetMatrix();
  p.noStroke();
  p.shader(S.post);
  common(S.post);
  S.post.setUniform("uFrame", frame % 997);
  S.post.setUniform("uVignette", vignette);
  S.post.setUniform("uGrain", grain);
  p.rect(-RES[0] / 2, -RES[1] / 2, RES[0], RES[1]);
  p.resetShader();
  p.pop();
}

/**
 * Маска для размывки. draw(ctx) рисует белым по чёрному в px элемента.
 * scale — разрешение маски относительно элемента, blur — размытие в px элемента.
 */
export function makeMask(p, w, h, draw, { scale = 0.5, blur = 10 } = {}) {
  const mw = Math.max(4, Math.round(w * scale)), mh = Math.max(4, Math.round(h * scale));
  const tmp = document.createElement("canvas");
  tmp.width = mw; tmp.height = mh;
  const t = tmp.getContext("2d");
  t.fillStyle = "#000"; t.fillRect(0, 0, mw, mh);
  t.save(); t.scale(scale, scale);
  t.fillStyle = "#fff"; t.strokeStyle = "#fff";
  draw(t);
  t.restore();
  const pg = p.createGraphics(mw, mh);
  pg.pixelDensity(1);
  const c = pg.drawingContext;
  c.fillStyle = "#000"; c.fillRect(0, 0, mw, mh);
  c.filter = blur > 0 ? `blur(${blur * scale}px)` : "none";
  c.drawImage(tmp, 0, 0);
  c.filter = "none";
  return pg;
}

/** Элемент размывки: { w, h, mask, tone }. */
export function washElement(p, w, h, drawCov, drawTone, opts = {}) {
  return {
    w, h,
    mask: makeMask(p, w, h, drawCov, opts),
    tone: drawTone ? makeMask(p, w, h, drawTone, { scale: opts.toneScale ?? 0.25, blur: opts.toneBlur ?? 30 }) : null,
  };
}

const WASH_DEF = {
  ink: [0.075, 0.068, 0.062], opacity: 1, seed: 1, thr: 0.5, soft: 0.05, edge: 0.35,
  gran: 0.45, bleed: 10, halo: 0.12, haloW: 0.22, body: 1, fibGran: 0, streak: 0, streakAng: 0, reveal: 1,
  cut: [0, 0, 1, 1], cutW: 0, cutProg: 0, split: [0, 0, 1, 1], splitP: 0, splitY: 0, char: [0, 0, 0], charCut: [0, 0, 0, 0], charSeg: [0, 0, 0.6],
};

/** Рисует размывку el в (x, y) текущей системы координат. */
export function wash(p, el, x, y, o = {}) {
  const q = { ...WASH_DEF, ...o };
  if (q.opacity <= 0 || q.reveal <= 0) return;
  p.push();
  p.noStroke();
  p.shader(S.wash);
  common(S.wash);
  S.wash.setUniform("uMask", el.mask);
  S.wash.setUniform("uTone", el.tone ?? WHITE);
  S.wash.setUniform("uSize", [el.w, el.h]);
  S.wash.setUniform("uInk", q.ink);
  S.wash.setUniform("uOpacity", q.opacity);
  S.wash.setUniform("uSeed", q.seed);
  S.wash.setUniform("uThr", q.thr);
  S.wash.setUniform("uSoft", q.soft);
  S.wash.setUniform("uEdge", q.edge);
  S.wash.setUniform("uGran", q.gran);
  S.wash.setUniform("uBleed", q.bleed);
  S.wash.setUniform("uHalo", q.halo);
  S.wash.setUniform("uHaloW", q.haloW);
  S.wash.setUniform("uBody", q.body);
  S.wash.setUniform("uFibGran", q.fibGran);
  S.wash.setUniform("uStreak", q.streak);
  S.wash.setUniform("uStreakAng", q.streakAng);
  S.wash.setUniform("uReveal", q.reveal);
  S.wash.setUniform("uCut", q.cut);
  S.wash.setUniform("uCutW", [q.cutW, q.cutProg]);
  S.wash.setUniform("uSplit", q.split);
  S.wash.setUniform("uSplitP", q.splitP);
  S.wash.setUniform("uSplitY", q.splitY);
  S.wash.setUniform("uChar", q.char);
  S.wash.setUniform("uCharCut", q.charCut);
  S.wash.setUniform("uCharSeg", q.charSeg);
  p.rect(x, y, el.w, el.h);
  p.resetShader();
  p.pop();
}

/** Полоса тумана (x, y, w, h) — бумага поверх изображения. */
export function mist(p, x, y, w, h, o = {}) {
  const q = { seed: 1, density: 0.9, drift: 0, scaleX: 1, topSoft: 0.35, ...o };
  if (q.density <= 0) return;
  p.push();
  p.noStroke();
  p.shader(S.mist);
  common(S.mist);
  S.mist.setUniform("uSize", [w, h]);
  S.mist.setUniform("uSeed", q.seed);
  S.mist.setUniform("uDensity", q.density);
  S.mist.setUniform("uDrift", q.drift);
  S.mist.setUniform("uScaleX", q.scaleX);
  S.mist.setUniform("uTopSoft", q.topSoft);
  p.rect(x, y, w, h);
  p.resetShader();
  p.pop();
}

/** Разрез бумагой поверх всего: x1,y1 → x2,y2 (в текущих координатах), ширина, прогресс. */
export function paperCut(p, x1, y1, x2, y2, width, prog) {
  if (prog <= 0) return;
  const pad = width * 2.5;
  const x = Math.min(x1, x2) - pad, y = Math.min(y1, y2) - pad;
  const w = Math.abs(x2 - x1) + pad * 2, h = Math.abs(y2 - y1) + pad * 2;
  p.push();
  p.noStroke();
  p.shader(S.cut);
  common(S.cut);
  S.cut.setUniform("uSize", [w, h]);
  S.cut.setUniform("uCut", [x1 - x, y1 - y, x2 - x, y2 - y]);
  S.cut.setUniform("uCutW", [width, prog]);
  p.rect(x, y, w, h);
  p.resetShader();
  p.pop();
}
