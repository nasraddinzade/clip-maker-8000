// Геометрия без рендера кадров: события глав, рамки подписей и ключевых элементов по кадрам.
//   npm run geometry                          → out/geometry.json (все кадры)
//   node scripts/export_geometry.mjs PATH.json [all]
// Берёт текущие config.json и timing.json. Пиксели не рисуются, считаются только рамки.
// Пересобирай после каждой правки сцены или голоса: устаревшие рамки дают ложные проходы (video-qa, «Рамки для проверок»).
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import puppeteer from "puppeteer";
import { ROOT } from "./lib/tools.mjs";

const out = path.resolve(ROOT, process.argv[2] || "out/geometry.json");
const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 0, hmr: false, watch: null } });
await server.listen();
const b = await puppeteer.launch({ headless: true, protocolTimeout: 0, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] });
const pg = await b.newPage();
pg.on("pageerror", (e) => console.error("[page]", e.message));
await pg.setViewport({ width: 1080, height: 1920 });
await pg.goto(server.resolvedUrls.local[0] + "?render=1", { waitUntil: "load" });
await pg.waitForFunction("window.__ready === true", { timeout: 180000 });
// третий аргумент «all» — рамки элементов во всех кадрах (проверка зон интерфейса для элементов)
const all = process.argv[3] === "all";
const data = await pg.evaluate((all) => {
  const tl = window.__timeline;
  const events = window.__events();
  const frames = [];
  for (let n = 0; n < tl.totalFrames; n++) {
    const caps = window.__captionBoxes(n);
    if (!caps.length && !all) continue;
    frames.push({ frame: n, caps, keep: window.__keepout(n) });
  }
  return { timeline: tl, events, frames };
}, all);
await b.close();
await server.close();
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
// те же рамки в формате tools/caption_margins.py (clip-maker-8000): подписи и элементы по кадрам
const dir = path.dirname(out);
fs.writeFileSync(path.join(dir, "captions.json"), JSON.stringify(data.frames.flatMap((f) => f.caps.filter((c) => (c.alpha ?? 1) > 0.05).map((c) => ({ frame: f.frame, text: c.str, x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1 })))));
fs.writeFileSync(path.join(dir, "elements.json"), JSON.stringify(data.frames.flatMap((f) => f.keep.map((b) => ({ frame: f.frame, name: b.name, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 })))));
console.log(`${path.relative(ROOT, out)}: ${data.timeline.totalFrames} кадров, ${data.timeline.duration.toFixed(2)} с, кадров с подписями ${data.frames.length}`);
