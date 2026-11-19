// Кадр по номеру: таймлайн из config.json + timing.json, свиток глав (src/scroll.js), проходы рисования
// сцен (src/scenes/*.js), экранные подписи, подпись художника, пост. Шаблон templates/essay-ink.
import p5 from "./p5global.js";
import * as brush from "p5.brush";
import config from "../config.json";
import timing from "../timing.json"; // пишет npm run voice; пустой — длительности из fallbackDuration
import { buildTimeline, locate } from "./timeline.js";
import { layoutScroll, cameraAt, GAP, TRAVEL, PRE, setTravel } from "./scroll.js";
import { drawCaption, REGIONS, KEEPOUT, setRegionScene, setHeaderStart } from "./kit.js";
import { initGL, setCamera, setTime, drawPaper, drawPost, setCleanRects } from "./gl/layers.js";
import { setupBrushes, clamp01, easeInOut } from "./ink.js";

const modules = import.meta.glob("./scenes/*.js", { eager: true });

const params = new URLSearchParams(location.search);
const RENDER = params.has("render");
// Параметры страницы для сцен проекта: globalThis.__PARAMS.get("имя") (варианты на стоп-кадрах до решения человека).
globalThis.__PARAMS = params;
globalThis.__DRY_V2 = !params.has("dry1"); // сухой конец мазка без «гребёнки»; ?dry1 — старая кисть
if (RENDER) document.body.classList.add("render");

const { width: W, height: H } = config.video;
setTravel(config.timing.travel, config.timing.travelPre ?? 0);
setHeaderStart(config.timing.headerStart);
const tl = buildTimeline(config, timing);
layoutScroll(tl, (sc) => {
  const m = modules[`./scenes/${sc.module}.js`];
  if (!m) throw new Error(`нет модуля сцены src/scenes/${sc.module}.js (сцена ${sc.id})`);
  return m;
});

const PASSES = 5; // проходы глав: в каждом сначала GL, затем p5.brush
let currentFrame = 0;
let fonts, logo = null; // logo — config.logo.file (public/), рисует src/signature.js
let P5 = null;

// Номер кадра стоп-кадра главы (глава сама говорит, на какой секунде).
function stillFrame(sc) {
  const s = sc.mod.still ? sc.mod.still(sc.duration) : sc.duration * 0.8;
  return sc.startFrame + Math.min(sc.frames - 1, Math.round(s * tl.fps));
}
if (params.has("still")) currentFrame = stillFrame(tl.scenes[Number(params.get("still"))]);
else currentFrame = Number(params.get("frame") ?? 0) || 0;

// ---------------- кадр ----------------

let frameState = null;

function prepareFrame(frame) {
  // Отладка (проверка движения): window.__freeze = секунда ролика — содержимое
  // кадра замирает на этой секунде, а камера продолжает только «дышать».
  const real = frame / tl.fps;
  const fz = typeof window.__freeze === "number" ? window.__freeze : null;
  const cf = fz === null ? frame : Math.round(fz * tl.fps);
  const { scene, sec } = locate(tl, cf);
  const g = cf / tl.fps;
  // отладка: window.__fixCam = {cx, cy, zoom} — неподвижная камера (замеры содержимого)
  const cam = window.__fixCam ?? cameraAt(tl, scene.index, sec, real);
  setCamera(cam);
  setTime(g);
  const viewTop = cam.cy - H / 2 / cam.zoom, viewBot = cam.cy + H / 2 / cam.zoom;
  const visible = tl.scenes.filter((sc) => sc.top + sc.height + 700 > viewTop && sc.top - GAP - 700 < viewBot);
  frameState = { frame, g, cam, current: scene, visible };
  // рамки подписей этого кадра — в шейдер бумаги (под буквами бумага без волокон)
  if (P5 && fonts && !globalThis.__capMeasure) {
    globalThis.__capMeasure = [];
    drawCaptions(P5);
    // отладка: window.__noClean — без маски (для проверки «бумага без волокон» на плохом входе)
    setCleanRects(window.__noClean ? [] : globalThis.__capMeasure.filter((b) => b.alpha > 0.01));
    globalThis.__capMeasure = null;
  }
}

// Якоря голоса сцены (секунды сцены). Если в timing.json есть разметка слов
// (parts[].words), время слова берётся из неё; иначе — по доле букв в фразе.
function anchors(sc) {
  const word = (n, w) => sc.parts?.[n - 1]?.words?.find((x) => x.w === w || x.w.toLowerCase() === w.toLowerCase());
  const a = {
    dur: sc.duration, voiceDelay: sc.voiceDelay, voiceDuration: sc.voiceDuration, scene: sc,
    // начало / конец фразы n (с 1) голоса этой сцены, в секундах сцены
    phrase(n) {
      const pt = sc.parts?.[n - 1];
      return pt ? sc.voiceDelay + pt.start : sc.voiceDelay + (n - 1) * 2.5;
    },
    // время слова в фразе n: по разметке слов, иначе по доле букв до него
    wordAt(n, w) {
      const x = word(n, w);
      if (x) return sc.voiceDelay + x.start;
      const sents = (sc.narration ?? "").split(/(?<=[.!?…])\s+/);
      const text = sents[n - 1] ?? "";
      const i = text.indexOf(w);
      const pt = sc.parts?.[n - 1];
      const frac = i < 0 ? 0 : i / Math.max(1, text.length);
      return pt ? sc.voiceDelay + pt.start + pt.duration * frac : sc.voiceDelay + frac * 6;
    },
    wordEnd(n, w) {
      const x = word(n, w);
      return x ? sc.voiceDelay + x.end : a.wordAt(n, w) + 0.4;
    },
    phraseEnd(n) {
      const pt = sc.parts?.[n - 1];
      return pt ? sc.voiceDelay + pt.start + pt.duration : sc.voiceDelay + n * 2.5 - 0.4;
    },
  };
  return a;
}

function chapterCtx(p, sc) {
  const { frame, g, cam, current } = frameState;
  const s = g - sc.startFrame / tl.fps;
  return {
    ...anchors(sc),
    p, brush, W, H, frame, g, cam, fonts,
    s, t: clamp01(s / sc.duration),
    active: sc === current, top: sc.top,
    reseed(n) {
      const v = sc.seed * 1000 + n;
      p.randomSeed(v); p.noiseSeed(v); brush.seed(v);
    },
    // слой с параллаксом: f<1 — дальний план, f>1 — ближний
    par(f, fn) {
      const focus = sc.top + (sc.mod.focus ?? sc.height / 2);
      p.push();
      // сдвиг слоя насыщается (±140 px): слои не разъезжаются,
      // когда камера далеко от главы (переезд по свитку)
      const d = (cam.cy - focus) * (1 - f);
      p.translate(0, 140 * Math.tanh(d / 140));
      fn();
      p.pop();
    },
  };
}

function withChapter(p, sc, fn) {
  const { cam } = frameState;
  p.push();
  p.scale(cam.zoom);
  p.translate(-cam.cx, -cam.cy + sc.top);
  fn(chapterCtx(p, sc));
  p.pop();
}

function drawPass(p, k) {
  if (k === 0) drawPaper(p);
  for (const sc of frameState.visible) {
    if (!sc.mod.pass) continue;
    withChapter(p, sc, (ctx) => {
      ctx.reseed(k * 100000);
      sc.mod.pass(k, ctx);
    });
  }
}

// Подписи — в экранных координатах, поверх кадра, без камеры.
// Проявляются, когда камера главы остановилась (captionAt), и гаснут
// в начале переезда к следующей главе.
function captionAlpha(sc, g) {
  const s = g - sc.startFrame / tl.fps;
  const at = sc.mod.captionAt ? sc.mod.captionAt(sc.duration, sc) : sc.voiceDelay;
  const seg = (x, a, b) => clamp01((x - a) / (b - a));
  let k = 1;
  const next = tl.scenes[sc.index + 1];
  // подпись гаснет за 0,45 с до начала переезда (он начинается за PRE до конца сцены),
  // пока камера ещё стоит — иначе изображение проплывало бы сквозь текст
  if (next) k = 1 - easeInOut(seg(g - next.startFrame / tl.fps, -PRE - 0.45, -PRE));
  // подпись проявляется вместе с первой фразой: название наполовину видно в at+0,05 с,
  // идея — в at+0,2 с (не позже 0,3 с после начала голоса)
  // первая сцена: название и подзаголовок стоят на кадре 0 без появления (CLAUDE.md, «Темп»)
  if (sc.index === 0) return { title: k, idea: k };
  return {
    title: easeInOut(seg(s, at - 0.2, at + 0.3)) * k,
    idea: easeInOut(seg(s, at - 0.1, at + 0.5)) * k,
  };
}

function drawCaptions(p) {
  if (window.__noCaptions && !globalThis.__capMeasure) return; // отладка: кадр без подписей (замер чернил под подписью)
  const { g } = frameState;
  for (const sc of tl.scenes) {
    if (!sc.caption || !(sc.captionLayout ?? sc.mod.caption)) continue;
    const a = captionAlpha(sc, g);
    if (a.title <= 0.002 && a.idea <= 0.002) continue;
    p.push();
    p.resetMatrix();
    p.translate(-W / 2, -H / 2);
    // раскладка подписи: config.json (scenes[].captionLayout), иначе caption модуля сцены
    const spec = sc.captionLayout ?? sc.mod.caption;
    drawCaption(p, fonts, sc.caption, spec, a.title, a.idea, W);
    p.pop();
  }
}

function drawOverlay(p) {
  for (const sc of frameState.visible) {
    if (sc.mod.overlay) withChapter(p, sc, (ctx) => sc.mod.overlay(ctx));
  }
  drawCaptions(p);
  // экранные элементы сцен (подпись художника в финале, src/signature.js) — без камеры, поверх подписей, под зерном бумаги
  for (const sc of frameState.visible) {
    if (!sc.mod.screen || globalThis.__capMeasure) continue;
    p.push(); p.resetMatrix(); p.translate(-W / 2, -H / 2);
    sc.mod.screen({ ...chapterCtx(p, sc), logo, logoCfg: config.logo, camAt: (t) => cameraAt(tl, sc.index, t, sc.startFrame / tl.fps + t) }); // camAt: логотип лежит на бумаге и едет с камерой
    p.pop();
  }
  // window.__noGrain — только для замеров движения (зерно меняется каждый кадр)
  drawPost(p, frameState.frame, window.__noGrain ? { grain: 0 } : undefined);
}

let pass = 0;
async function renderFrame(p, n) {
  currentFrame = n;
  prepareFrame(n);
  // Каждый проход — отдельный draw(): p5.brush досводит штрихи в конце draw(),
  // поэтому GL-слои следующего прохода ложатся поверх готовых штрихов.
  for (pass = 0; pass <= PASSES; pass++) await p.redraw();
}

new p5((p) => {
  brush.instance(p);

  p.setup = async () => {
    P5 = p;
    p.pixelDensity(1);
    const c = p.createCanvas(W, H, p.WEBGL);
    c.parent("stage");
    c.id("main");
    p.angleMode(p.DEGREES);
    // шрифты подписей: config.fonts — пути внутри public/ (light, regular, medium, italic)
    fonts = {};
    for (const [k, f] of Object.entries(config.fonts)) if (!k.startsWith("_")) fonts[k] = await p.loadFont("/" + f);
    if (config.logo?.file) {
      try { logo = await p.loadImage("/" + config.logo.file); }
      catch { console.error(`нет логотипа public/${config.logo.file} — финал без подписи художника`); }
    }
    initGL(p, W, H);
    brush.scaleBrushes(5);
    setupBrushes(brush);
    for (const sc of tl.scenes) {
      p.randomSeed(sc.seed); p.noiseSeed(sc.seed);
      setRegionScene(sc.index);
      await sc.mod.setup?.({ p, brush, W, H, scene: sc, fonts, config });
    }
    p.noLoop();
    window.__timeline = {
      fps: tl.fps, totalFrames: tl.totalFrames, duration: tl.duration, width: W, height: H,
      scenes: tl.scenes.map((s) => ({
        id: s.id, index: s.index, startFrame: s.startFrame, frames: s.frames, duration: s.duration,
        voiceDelay: s.voiceDelay, stillFrame: stillFrame(s), top: s.top,
      })),
    };
    window.__renderFrame = async (n) => { await renderFrame(p, n); return true; };
    // области для детектора вспышек в кадре n: экранные прямоугольники
    window.__regions = (n) => {
      prepareFrame(n);
      const { cam } = frameState;
      const out = [];
      for (const r of REGIONS) {
        const sc = tl.scenes[r.scene];
        if (r.space === "screen") { out.push({ name: r.name, scene: r.scene, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h }); continue; }
        const X = (x) => (x - cam.cx) * cam.zoom + W / 2, Y = (y) => (y + sc.top - cam.cy) * cam.zoom + H / 2;
        out.push({ name: r.name, scene: r.scene, x0: X(r.x), y0: Y(r.y), x1: X(r.x + r.w), y1: Y(r.y + r.h) });
      }
      globalThis.__capMeasure = [];
      drawCaptions(p);
      for (const b of globalThis.__capMeasure) out.push({ name: `подпись «${b.str.slice(0, 18)}»`, scene: -1, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
      globalThis.__capMeasure = null;
      return out;
    };
    // рамки подписей в кадре n (без отрисовки) — для проверки полей 80 px
    window.__captionBoxes = (n) => {
      prepareFrame(n);
      globalThis.__capMeasure = [];
      drawCaptions(p);
      const r = globalThis.__capMeasure;
      globalThis.__capMeasure = null;
      return r.filter((b) => b.alpha > 0.01);
    };
    // События глав для таблицы событий (scripts/export_geometry.mjs): [{name, t0, t1, anchor}]
    // в секундах сцены. Главы отдают свои события (events), сюда же добавляются
    // движения камеры (без медленного дрейфа lin), переезд и подписи.
    window.__events = () => tl.scenes.map((sc) => {
      const A = anchors(sc);
      const ev = (sc.mod.events?.(A) ?? []).map((e) => ({ ...e, kind: e.kind ?? "картинка" }));
      if (sc.index > 0) ev.push({ name: "переезд камеры от прошлой главы", t0: 0, t1: Math.min(TRAVEL - PRE, sc.duration), anchor: "начало сцены", kind: "камера" });
      if (sc.index < tl.scenes.length - 1 && PRE > 0) ev.push({ name: "переезд камеры к следующей главе", t0: sc.duration - PRE, t1: sc.duration, anchor: "конец сцены − 0,8 с", kind: "камера" });
      const keys = sc.mod.camera ? sc.mod.camera(sc.duration, sc) : [];
      for (let i = 0; i < keys.length - 1; i++) {
        const a = keys[i], b = keys[i + 1];
        const moved = Math.hypot((b.x ?? 540) - (a.x ?? 540), b.y - a.y) > 20 || Math.abs((b.z ?? 1) - (a.z ?? 1)) > 0.03;
        if (!b.lin && moved && b.s > a.s) ev.push({ name: "движение камеры", t0: a.s, t1: b.s, anchor: "ключи камеры", kind: "камера" });
      }
      if (sc.caption && (sc.captionLayout ?? sc.mod.caption)) {
        const at = sc.mod.captionAt ? sc.mod.captionAt(sc.duration, sc) : sc.voiceDelay;
        if (sc.caption.title) ev.push({ name: "подпись: название", t0: at, t1: at + 1.3, anchor: sc.mod.captionAt ? "captionAt" : "вступление 1,5 с", kind: "подпись" });
        ev.push({ name: "подпись: идея", t0: at + 0.6, t1: at + 2.0, anchor: sc.mod.captionAt ? "captionAt" : "вступление 1,5 с", kind: "подпись" });
        if (sc.index < tl.scenes.length - 1) ev.push({ name: "подпись гаснет", t0: sc.duration - PRE - 0.45, t1: sc.duration - PRE, anchor: "до начала переезда", kind: "подпись" });
      }
      return { id: sc.id, index: sc.index, dur: sc.duration, voiceDelay: sc.voiceDelay, voiceDuration: sc.voiceDuration,
        parts: sc.parts, events: ev.sort((x, y) => x.t0 - y.t0) };
    });
    // Ключевые элементы в экранных координатах кадра n: зарегистрированные области
    // (иероглифы, печати, брызги) и keepout глав — для проверки «ничего не входит в рамку подписи».
    window.__keepout = (n) => {
      prepareFrame(n);
      const { cam, current } = frameState;
      const out = [];
      const X = (x) => (x - cam.cx) * cam.zoom + W / 2;
      // иероглифы — по рамке туши (KEEPOUT), а не по квадрату; экранные элементы — только в своей сцене
      for (const r of [...REGIONS.filter((q) => !q.name.startsWith("иероглиф")), ...KEEPOUT]) {
        const sc = tl.scenes[r.scene];
        if (r.t0 !== undefined && frameState.g - sc.startFrame / tl.fps < r.t0) continue; // ещё не начат
        if (r.space === "screen") {
          if (r.scene === current.index) out.push({ name: r.name, scene: r.scene, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h });
          continue;
        }
        const Y = (y) => (y + sc.top - cam.cy) * cam.zoom + H / 2;
        out.push({ name: r.name, scene: r.scene, x0: X(r.x), y0: Y(r.y), x1: X(r.x + r.w), y1: Y(r.y + r.h) });
      }
      // keepout глав: массив или функция от якорей; t0/t1 — когда элемент виден (секунды сцены)
      for (const sc of tl.scenes) {
        const Y = (y) => (y + sc.top - cam.cy) * cam.zoom + H / 2;
        const s = frameState.g - sc.startFrame / tl.fps;
        const list = typeof sc.mod.keepout === "function" ? sc.mod.keepout(anchors(sc)) : (sc.mod.keepout ?? []);
        for (const r of list) {
          if (s < (r.t0 ?? -1e9) || s > (r.t1 ?? 1e9)) continue;
          out.push({ name: r.name, scene: sc.index, x0: X(r.x), y0: Y(r.y), x1: X(r.x + r.w), y1: Y(r.y + r.h) });
        }
      }
      return out.filter((b) => b.x1 > 0 && b.x0 < W && b.y1 > 0 && b.y0 < H);
    };
    window.__ready = true;
    if (!RENDER) initPreview(p);
    else await renderFrame(p, currentFrame);
  };

  p.draw = () => {
    if (!frameState) return;
    if (pass < PASSES) drawPass(p, pass);
    else drawOverlay(p);
  };
});

// ---------------- превью ----------------

function initPreview(p) {
  const scrub = document.getElementById("scrub");
  const sel = document.getElementById("scene");
  const playBtn = document.getElementById("play");
  const loop = document.getElementById("loop");
  const sound = document.getElementById("sound");
  const timeEl = document.getElementById("time");
  scrub.max = tl.totalFrames - 1;
  sel.innerHTML = tl.scenes
    .map((s) => `<option value="${s.index}">${s.index}. ${s.caption.title || s.caption.text} (${s.duration.toFixed(1)} с)</option>`)
    .join("");

  const audio = new Audio();
  let hasAudio = false;
  fetch("/audio/narration.wav", { method: "HEAD" }).then((r) => {
    if (r.ok) { audio.src = "/audio/narration.wav"; hasAudio = true; }
  }).catch(() => {});

  let playing = false, t0 = 0, f0 = 0, drawing = false;

  const show = async (f) => {
    currentFrame = Math.max(0, Math.min(tl.totalFrames - 1, Math.round(f)));
    scrub.value = currentFrame;
    const { scene, sec } = locate(tl, currentFrame);
    sel.value = scene.index;
    timeEl.textContent = `${(currentFrame / tl.fps).toFixed(2)} / ${tl.duration.toFixed(2)} с · кадр ${currentFrame} · сцена ${scene.index}: ${sec.toFixed(2)} с`;
    if (drawing) return;
    drawing = true;
    await renderFrame(p, currentFrame);
    drawing = false;
  };

  const stop = () => { playing = false; playBtn.textContent = "▶ Play"; audio.pause(); };
  const start = () => {
    playing = true; playBtn.textContent = "❚❚ Pause";
    t0 = performance.now(); f0 = currentFrame;
    if (hasAudio && sound.checked) { audio.currentTime = currentFrame / tl.fps; audio.play().catch(() => {}); }
    requestAnimationFrame(tick);
  };
  const tick = () => {
    if (!playing) return;
    let f = f0 + ((performance.now() - t0) / 1000) * tl.fps;
    if (loop.checked) {
      const sc = tl.scenes[Number(sel.value)];
      if (f >= sc.startFrame + sc.frames) { f0 = sc.startFrame; t0 = performance.now(); f = f0; if (hasAudio && sound.checked) audio.currentTime = f0 / tl.fps; }
    }
    if (f >= tl.totalFrames) { stop(); return; }
    show(f);
    requestAnimationFrame(tick);
  };

  playBtn.onclick = () => (playing ? stop() : start());
  scrub.oninput = () => { stop(); show(Number(scrub.value)); };
  sel.onchange = () => { stop(); show(tl.scenes[Number(sel.value)].startFrame); };
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); playing ? stop() : start(); }
    if (e.code === "ArrowRight") { stop(); show(currentFrame + (e.shiftKey ? tl.fps : 1)); }
    if (e.code === "ArrowLeft") { stop(); show(currentFrame - (e.shiftKey ? tl.fps : 1)); }
  });
  show(currentFrame);
}

// HMR: p5-скетч не умеет горячую замену — при правке перезагружаем страницу.
if (import.meta.hot) import.meta.hot.decline();
