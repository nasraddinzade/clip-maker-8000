// KanjiVG (CC BY-SA 3.0, © Ulrich Apel, https://kanjivg.tagaini.net) → src/data/kanji.json:
// для каждого знака из config.json (scenes[].kanji, scenes[].seal.char, kanjiExtra) черты по порядку,
// у каждой тип черты (kvg:type) и ломаная в координатах 0..109.
//   npm run kanji
// Исходники: SVG KanjiVG в assets/kanjivg/ — отдельные файлы или вся распакованная папка kanji/ из выпуска
// (имя файла — код знака в hex из 5 цифр: 水 → 06c34.svg). Варианты с суффиксом (-Kaisho и т. п.) не берутся.
// src/data/kanji.json — производное от KanjiVG и тоже под CC BY-SA 3.0: атрибуция обязательна (README, «Лицензии»).
import fs from "node:fs";
import path from "node:path";
import { ROOT, readJSON } from "./lib/tools.mjs";

const SRC = path.join(ROOT, "assets", "kanjivg");
const OUT = path.join(ROOT, "src", "data", "kanji.json");
const config = readJSON(path.join(ROOT, "config.json"));
const chars = [...new Set([
  ...config.scenes.flatMap((s) => [...(s.kanji ?? ""), ...(s.seal?.char ?? "")]),
  ...(config.kanjiExtra ?? []).flatMap((c) => [...c]),
])];

function tokenize(d) {
  return d.match(/[MmCcSsLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?/g);
}

// Разбор пути SVG и разбиение кривых Безье на точки с шагом ~step.
function parsePath(d, step = 0.6) {
  const tk = tokenize(d);
  let i = 0, cmd = null;
  let x = 0, y = 0, sx = 0, sy = 0, lcx = null, lcy = null;
  const pts = [];
  const num = () => parseFloat(tk[i++]);
  const push = (px, py) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(px - last[0], py - last[1]) > 1e-6) pts.push([px, py]);
  };
  const cubic = (x0, y0, x1, y1, x2, y2, x3, y3) => {
    const est = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const n = Math.max(2, Math.ceil(est / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      push(
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
      );
    }
  };
  while (i < tk.length) {
    if (/[A-Za-z]/.test(tk[i])) cmd = tk[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": x = ox + num(); y = oy + num(); sx = x; sy = y; push(x, y); cmd = rel ? "l" : "L"; lcx = null; break;
      case "L": { const nx = ox + num(), ny = oy + num(); cubic(x, y, x, y, nx, ny, nx, ny); x = nx; y = ny; lcx = null; break; }
      case "C": {
        const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), nx = ox + num(), ny = oy + num();
        cubic(x, y, x1, y1, x2, y2, nx, ny); lcx = x2; lcy = y2; x = nx; y = ny; break;
      }
      case "S": {
        const x1 = lcx === null ? x : 2 * x - lcx, y1 = lcy === null ? y : 2 * y - lcy;
        const x2 = ox + num(), y2 = oy + num(), nx = ox + num(), ny = oy + num();
        cubic(x, y, x1, y1, x2, y2, nx, ny); lcx = x2; lcy = y2; x = nx; y = ny; break;
      }
      case "Z": x = sx; y = sy; push(x, y); break;
      default: throw new Error("unsupported path command " + cmd);
    }
  }
  return pts.map(([a, b]) => [Math.round(a * 100) / 100, Math.round(b * 100) / 100]);
}

const out = {};
const missing = [];
for (const ch of chars) {
  const f = ch.codePointAt(0).toString(16).padStart(5, "0") + ".svg";
  const file = path.join(SRC, f);
  if (!fs.existsSync(file)) { missing.push(`${ch} (${f})`); continue; }
  const svg = fs.readFileSync(file, "utf8");
  const strokes = [...svg.matchAll(/<path[^>]*kvg:type="([^"]*)"[^>]*d="([^"]+)"/g)].map((m) => ({ type: m[1], pts: parsePath(m[2]) }));
  out[ch] = { code: f.replace(".svg", ""), strokes };
  console.log(ch, strokes.length, "черт:", strokes.map((s) => s.type).join(" "));
}
if (missing.length) { console.error(`нет SVG в assets/kanjivg/: ${missing.join(", ")} — скачай KanjiVG (README, «Что положить»)`); process.exit(1); }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log("→", path.relative(ROOT, OUT));
