// Снимки отдельных кадров с отладочными флагами (без рендера всего ролика).
//   npm run snap -- --frames 120,240 [--dir build/snap] [--nocap] [--nograin] [--noclean] [--q "имя=значение"]
// --q — параметр страницы для вариантов сцены (globalThis.__PARAMS в сценах).
// --nocap: кадр без подписей — чтобы мерить тушь сцены под рамкой подписи.
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";
import puppeteer from "puppeteer";
import { ROOT, parseArgs } from "./lib/tools.mjs";

const a = parseArgs();
const dir = path.resolve(ROOT, a.dir || "build/snap");
fs.mkdirSync(dir, { recursive: true });
const server = await createServer({ root: ROOT, logLevel: "error", server: { port: 0, hmr: false, watch: null } });
await server.listen();
const b = await puppeteer.launch({ headless: true, protocolTimeout: 0, args: ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-webgl", "--enable-unsafe-swiftshader"] });
const pg = await b.newPage();
pg.on("pageerror", (e) => console.error("[page]", e.message));
await pg.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
await pg.goto(server.resolvedUrls.local[0] + "?render=1" + (a.q ? "&" + a.q : ""), { waitUntil: "load" });
await pg.waitForFunction("window.__ready === true", { timeout: 180000 });
await pg.evaluate((o) => { if (o.nocap) window.__noCaptions = true; if (o.nograin) window.__noGrain = true; if (o.noclean) window.__noClean = true; }, { nocap: !!a.nocap, nograin: !!a.nograin, noclean: !!a.noclean });
for (const n of String(a.frames).split(",").map(Number)) {
  const b64 = await pg.evaluate(async (n) => { await window.__renderFrame(n); return document.getElementById("main").toDataURL("image/png").split(",")[1]; }, n);
  const f = path.join(dir, `f_${String(n).padStart(6, "0")}.png`);
  fs.writeFileSync(f, Buffer.from(b64, "base64"));
  console.log(path.relative(ROOT, f));
}
await b.close();
await server.close();
