// Рендер: headless Chrome (Puppeteer, WebGL) → PNG-кадры по номеру → ffmpeg.
//
//   npm run render                       полный ролик со звуком → config.output (out/essay.mp4)
//   npm run render -- --scenes 0,1 --no-audio --out out/test.mp4
//   npm run render -- --from 300 --to 450      диапазон кадров [from, to)
//   --workers 3        число параллельных вкладок (по умолчанию 3)
//   --reuse            не перерисовывать уже существующие PNG
//   --no-voice         не запускать озвучку перед рендером
//   --snap 10,200      только снимки отдельных кадров в build/snap/ (--snap-dir, --freeze SEC)
//   --stills [0,2]     стоп-кадры глав в out/stills/
//   --measure          кадры без зерна в build/frames_measure (замер движения)
//   --nocap            кадры без подписей в build/frames_nocap (тушь сцены под рамками подписей)
//   --frames-only      только PNG, без сборки mp4
// Полный ролик: последние config.timing.loopFrames кадров плавно (smoothstep) переходят в кадр 0 — петля без скачка.
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import puppeteer from "puppeteer";
import { ROOT, FFMPEG, run, parseArgs, probeDuration, readJSON } from "./lib/tools.mjs";

const args = parseArgs();
// --nocap: кадры без подписей в build/frames_nocap (замер туши сцены под рамками подписей)
const FRAMES_DIR = path.join(ROOT, "build", args.measure ? "frames_measure" : args.nocap ? "frames_nocap" : "frames");
const NARRATION = path.join(ROOT, "build", "audio", "narration.wav");
const CONFIG = readJSON(path.join(ROOT, "config.json"));
const OUT = path.resolve(ROOT, args.out || CONFIG.output || "out/essay.mp4");
const WORKERS = Number(args.workers || 3);
const withAudio = !args["no-audio"];

async function main() {
  // Озвучка и таймлайн строятся до рендера: длительности сцен берутся из аудио.
  if (withAudio && !args["no-voice"]) {
    await run(process.execPath, [path.join(ROOT, "scripts", "voice.mjs")]);
  }

  // hmr и watch выключены: правки исходников во время рендера не перезагружают вкладки
  const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 0, strictPort: false, hmr: false, watch: null } });
  await server.listen();
  const url = server.resolvedUrls.local[0];

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 0,
    args: [
      "--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl",
      "--enable-unsafe-swiftshader", "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
    ],
  });

  const open = async () => {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("[page]", e.message));
    page.on("console", (m) => { if (m.type() === "error" || m.text().startsWith("DBG")) console.error("[console]", m.text()); });
    await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
    await page.goto(url + "?render=1" + (args.q ? "&" + args.q : ""), { waitUntil: "load" }); // --q "имя=значение" — параметр страницы для вариантов сцены
    await page.waitForFunction("window.__ready === true", { timeout: 120000 });
    // --measure: кадры без зерна плёнки в build/frames_measure (для check_motion.py)
    if (args.measure) await page.evaluate(() => { window.__noGrain = true; });
    if (args.nocap) await page.evaluate(() => { window.__noCaptions = true; });
    return page;
  };

  const first = await open();
  const tl = await first.evaluate(() => window.__timeline);
  const gpu = await first.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl && gl.getExtension("WEBGL_debug_renderer_info");
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  console.log(`WebGL: ${gpu}`);

  let from = 0, to = tl.totalFrames;
  if (args.scenes) {
    const ids = String(args.scenes).split(",").map(Number).sort((a, b) => a - b);
    const sc = ids.map((i) => tl.scenes[i]);
    from = sc[0].startFrame;
    to = sc[sc.length - 1].startFrame + sc[sc.length - 1].frames;
  }
  if (args.from !== undefined) from = Number(args.from);
  if (args.to !== undefined) to = Number(args.to);
  const count = to - from;
  console.log(`Кадры ${from}..${to - 1} (${count}), ${(count / tl.fps).toFixed(2)} с, ${tl.width}x${tl.height}@${tl.fps}`);

  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  const framePath = (n) => path.join(FRAMES_DIR, `f_${String(n).padStart(6, "0")}.png`);

  // Быстрые снимки отдельных кадров: --snap 10,200,450 → build/snap/*.png
  if (args.snap) {
    const dir = path.join(ROOT, "build", args["snap-dir"] || "snap");
    // --freeze SEC: содержимое кадра замирает, камера только «дышит» (замер движения)
    if (args.freeze !== undefined) await first.evaluate((f) => { window.__freeze = f; }, Number(args.freeze));
    if (args.measure) await first.evaluate(() => { window.__noGrain = true; });
    fs.mkdirSync(dir, { recursive: true });
    for (const n of String(args.snap).split(",").map(Number)) {
      const t1 = Date.now();
      const b64 = await first.evaluate(async (n) => {
        await window.__renderFrame(n);
        return document.getElementById("main").toDataURL("image/png").split(",")[1];
      }, n);
      const f = path.join(dir, `snap_${String(n).padStart(6, "0")}.png`);
      fs.writeFileSync(f, Buffer.from(b64, "base64"));
      console.log(`  ${path.relative(ROOT, f)} (${Date.now() - t1} мс)`);
    }
    await browser.close();
    await server.close();
    return;
  }

  // Стоп-кадры всех глав: --stills → out/stills/scene_N.png + сетка
  if (args.stills) {
    const dir = path.join(ROOT, "out", "stills");
    fs.mkdirSync(dir, { recursive: true });
    const only = args.stills === true ? null : String(args.stills).split(",").map(Number);
    for (const sc of tl.scenes) {
      if (only && !only.includes(sc.index)) continue;
      const t1 = Date.now();
      const b64 = await first.evaluate(async (n) => {
        await window.__renderFrame(n);
        return document.getElementById("main").toDataURL("image/png").split(",")[1];
      }, sc.stillFrame);
      const f = path.join(dir, `scene_${sc.index}.png`);
      fs.writeFileSync(f, Buffer.from(b64, "base64"));
      console.log(`  ${path.relative(ROOT, f)} кадр ${sc.stillFrame} (${Date.now() - t1} мс)`);
    }
    await browser.close();
    await server.close();
    return;
  }

  const pages = [first];
  for (let i = 1; i < WORKERS; i++) pages.push(await open());

  let next = from, done = 0;
  const t0 = Date.now();
  const worker = async (page) => {
    while (next < to) {
      const n = next++;
      if (args.reuse && fs.existsSync(framePath(n))) { done++; continue; }
      const b64 = await page.evaluate(async (n) => {
        await window.__renderFrame(n);
        return document.getElementById("main").toDataURL("image/png").split(",")[1];
      }, n);
      fs.writeFileSync(framePath(n), Buffer.from(b64, "base64"));
      done++;
      if (done % 30 === 0 || done === count) {
        const el = (Date.now() - t0) / 1000;
        process.stdout.write(`\r  ${done}/${count} кадров, ${(done / el).toFixed(1)} к/с, осталось ~${Math.round(((count - done) * el) / done)} с   `);
      }
    }
  };
  await Promise.all(pages.map(worker));
  process.stdout.write("\n");
  await browser.close();
  await server.close();

  if (args["frames-only"]) return;

  // Сборка mp4: H.264 yuv420p + AAC.
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const duration = count / tl.fps;
  const ff = ["-y", "-hide_banner", "-loglevel", "error",
    "-framerate", String(tl.fps), "-start_number", String(from), "-i", path.join(FRAMES_DIR, "f_%06d.png")];
  const useAudio = withAudio && fs.existsSync(NARRATION);
  if (useAudio) {
    // Звук обрезается/дополняется тишиной ровно до длины видео.
    ff.push("-ss", (from / tl.fps).toFixed(3), "-i", NARRATION);
  }
  // петля: последние L кадров смешиваются с кадром 0 по smoothstep (на последнем кадре вес 1 — тон как у первого)
  const L = CONFIG.timing?.loopFrames ?? 0;
  const loop = L > 0 && from === 0 && to === tl.totalFrames && !args["no-loop"];
  if (loop) {
    const s0 = tl.totalFrames - L - 1, w = `clip((N-${s0})/${L},0,1)`; // запятые внутри '…' фильтра экранировать не нужно
    ff.push("-loop", "1", "-framerate", String(tl.fps), "-i", framePath(0));
    ff.push("-filter_complex", `[0:v]format=gbrp[a];[${useAudio ? 2 : 1}:v]format=gbrp,trim=end_frame=${tl.totalFrames},setpts=PTS-STARTPTS[b];[a][b]blend=all_expr='A+(B-A)*(${w}*${w}*(3-2*${w}))',format=yuv420p[v]`, "-map", "[v]");
    if (useAudio) ff.push("-map", "1:a");
  }
  ff.push("-frames:v", String(count),
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-r", String(tl.fps), "-movflags", "+faststart");
  if (useAudio) {
    ff.push("-af", `apad=whole_dur=${duration.toFixed(3)}`, "-t", duration.toFixed(3),
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000");
  }
  ff.push(OUT);
  console.log(`ffmpeg → ${path.relative(ROOT, OUT)}${useAudio ? " (со звуком)" : " (без звука)"}`);
  await run(FFMPEG, ff);
  console.log(`Готово: ${OUT}, ${(await probeDuration(OUT)).toFixed(3)} с`);
}

main().catch((e) => { console.error(e); process.exit(1); });
