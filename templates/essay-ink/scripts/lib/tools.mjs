// Общие утилиты для скриптов: пути к ffmpeg/ffprobe, запуск процессов.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Системный ffmpeg, если есть в PATH, иначе бинарники из npm.
export const FFMPEG = process.env.FFMPEG || require("ffmpeg-static");
export const FFPROBE = process.env.FFPROBE || require("@ffprobe-installer/ffprobe").path;

export function run(cmd, args, { quiet = false, cwd = ROOT, input } = {}) {
  return new Promise((resolve, reject) => {
    const ch = spawn(cmd, args, { cwd, stdio: [input ? "pipe" : "ignore", "pipe", "pipe"] });
    let out = "", err = "";
    ch.stdout.on("data", (d) => { out += d; });
    ch.stderr.on("data", (d) => { err += d; if (!quiet) process.stderr.write(d); });
    if (input) { ch.stdin.write(input); ch.stdin.end(); }
    ch.on("error", reject);
    ch.on("close", (code) =>
      code === 0 ? resolve({ out, err }) : reject(new Error(`${path.basename(cmd)} exited ${code}\n${err.slice(-2000)}`)),
    );
  });
}

export async function probeDuration(file) {
  const { out } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { quiet: true });
  return parseFloat(out.trim());
}

export function readJSON(p) { return JSON.parse(fs.readFileSync(p, "utf8")); }
export function writeJSON(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); }

export function parseArgs(argv = process.argv.slice(2)) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith("--")) continue;
    const key = k.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) a[key] = true;
    else { a[key] = next; i++; }
  }
  return a;
}
