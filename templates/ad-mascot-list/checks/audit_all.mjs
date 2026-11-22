// Аудит текста по всему ролику: одна сборка, кадр каждые STEP секунд. Для каждого кадра: PNG, PNG без маскота
// (hideHost) и JSON обхода текстовых узлов (src/reel/audit.ts). Дальше checks/stills_check.py и checks/occlusion.py.
// node checks/audit_all.mjs ../check/audit 0.5 [--nohost] [--nopng]  (шаг в секундах; 0.0333 = каждый кадр)
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, openBrowser } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "../check/audit");
const step = Number(process.argv[3] ?? 0.5);
const withHost = process.argv.includes("--nohost");
const savePng = !process.argv.includes("--nopng");
fs.mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const browser = await openBrowser("chrome");
const comp = await selectComposition({ serveUrl, id: "Reel", inputProps: { audit: true }, puppeteerInstance: browser, port: 3418 });
const frames = [];
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? Number(process.argv[i + 1]) : d; };
const F0 = arg("--from", 0), F1 = arg("--to", comp.durationInFrames - 1);
for (let f = F0; f <= F1; f += Math.max(1, Math.round(step * comp.fps))) frames.push(f);
if (frames[frames.length - 1] !== F1) frames.push(F1);
for (const f of frames) {
  const name = `f${String(f).padStart(4, "0")}`;
  const nodes = []; let end = null;
  await renderStill({
    serveUrl, composition: comp, frame: f, output: savePng ? path.join(out, `${name}.png`) : path.join(out, `_tmp.png`), inputProps: { audit: true }, puppeteerInstance: browser, port: 3418,
    onBrowserLog: (l) => {
      if (l.text.startsWith("AUDITN")) nodes.push(JSON.parse(l.text.slice(6)));
      else if (l.text.startsWith("AUDITEND")) end = JSON.parse(l.text.slice(8));
    },
  });
  if (!end || end.count !== nodes.length) throw new Error(`аудит кадра ${f} неполный: ${nodes.length} из ${end?.count}`);
  fs.writeFileSync(path.join(out, `${name}.audit.json`), JSON.stringify({ frame: f, nodes }));
  if (withHost) await renderStill({ serveUrl, composition: comp, frame: f, output: path.join(out, `${name}.nohost.png`), inputProps: { hideHost: true, silent: true }, puppeteerInstance: browser, port: 3418 });
  process.stdout.write(`${f} `);
}
await browser.close({ silent: true });
console.log(`\nкадров ${frames.length}`);
