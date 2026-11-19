// Голос → таймлайн → дорожка (голос + музыка ровным слоем). Шаблон templates/essay-ink.
//   npm run voice
//
// config.voice.engine:
//   silence — тишина по числу букв фразы (charsPerSecond), паузы между фразами sentencePause или scenes[].pauses.
//             Нужна, чтобы собрать и проверить ролик до голоса. События по словам считаются по доле букв.
//   files   — готовый голос: voice/<id>.wav (или .mp3/.m4a/.flac) на каждую сцену, тишина по краям обрезается.
//             Рядом можно положить voice/<id>.json с фразами и словами (README, «Голос»): тогда ctx.phrase(n)
//             и ctx.wordAt(n, "слово") берут точные времена. Без json вся сцена — одна фраза.
// Длина сцены = voiceDelay + голос + tail (у сцены может быть свой tail). Пишет timing.json.
// Голос → −14 LUFS. Музыка (config.music.file): по длине ролика, фейды, громкость = голос + belowVoiceDb,
// без приглушения (CLAUDE.md, «Голос и звук»). Итог −14 LUFS, true peak −1,5 dBTP → build/audio/narration.wav
// и public/audio/narration.wav (для превью). build/audio/voice.wav — стем голоса для audio_check.py joints.
import fs from "node:fs";
import path from "node:path";
import { ROOT, FFMPEG, run, probeDuration, readJSON, writeJSON } from "./lib/tools.mjs";

const config = readJSON(path.join(ROOT, "config.json"));
const V = config.voice, T = config.timing, M = config.music ?? {};
const fps = config.video.fps;
const VOICE_DIR = path.join(ROOT, "build", "voice");
const USER_DIR = path.join(ROOT, V.dir ?? "voice");
const AUDIO = path.join(ROOT, "build", "audio");
fs.mkdirSync(AUDIO, { recursive: true });
fs.mkdirSync(VOICE_DIR, { recursive: true });

const ff = (a) => run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...a], { quiet: true });
const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse";
const sentences = (t) => (t ?? "").split(/(?<=[.!?…])\s+/).map((x) => x.trim()).filter(Boolean);

async function loudness(file) {
  const { err } = await run(FFMPEG, ["-hide_banner", "-i", file, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { quiet: true });
  return JSON.parse(err.slice(err.lastIndexOf("{"), err.lastIndexOf("}") + 1));
}
// двухпроходная нормализация до −14 LUFS
async function normalize(src, dst, extra = []) {
  const m = await loudness(src);
  if (!isFinite(Number(m.input_i))) { await ff(["-i", src, ...extra, "-ar", "48000", "-c:a", "pcm_s16le", dst]); return; } // тишина: нечего нормализовать
  const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  await ff(["-i", src, "-af", `${ln},aresample=48000`, ...extra, "-ar", "48000", "-c:a", "pcm_s16le", dst]);
}

function ownFile(sc, i) {
  for (const base of [sc.id, `scene${i}`]) for (const ext of ["wav", "mp3", "m4a", "ogg", "flac"]) {
    const f = path.join(USER_DIR, `${base}.${ext}`);
    if (fs.existsSync(f)) return f;
  }
  return null;
}

// Тишина по фразам: длина фразы = max(1 с, букв / charsPerSecond).
async function silenceScene(sc, i) {
  const cps = V.charsPerSecond ?? 14, parts = [];
  let t = 0;
  sentences(sc.narration).forEach((text, k, all) => {
    const d = Math.max(1, text.replace(/[^\p{L}]/gu, "").length / cps);
    parts.push({ start: +t.toFixed(3), duration: +d.toFixed(3), text });
    t += d + (k < all.length - 1 ? (sc.pauses?.[k] ?? V.sentencePause ?? 0.4) : 0);
  });
  const dst = path.join(VOICE_DIR, `scene${i}.wav`);
  await ff(["-f", "lavfi", "-t", t.toFixed(3), "-i", "anullsrc=r=48000:cl=mono", "-c:a", "pcm_s16le", dst]);
  return { duration: await probeDuration(dst), parts, source: "тишина по числу букв" };
}

async function fileScene(sc, i) {
  const own = ownFile(sc, i);
  if (!own) throw new Error(`нет файла голоса ${path.relative(ROOT, USER_DIR)}/${sc.id}.wav для сцены ${sc.id}`);
  const dst = path.join(VOICE_DIR, `scene${i}.wav`);
  await ff(["-i", own, "-af", TRIM, "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", dst]);
  const d = await probeDuration(dst);
  const js = path.join(USER_DIR, `${sc.id}.json`);
  const parts = fs.existsSync(js) ? readJSON(js).parts : [{ start: 0, duration: +d.toFixed(3), text: sc.narration ?? "" }];
  return { duration: d, parts, source: path.relative(ROOT, own) };
}

async function main() {
  const scenes = [];
  for (let i = 0; i < config.scenes.length; i++) {
    const sc = config.scenes[i];
    const a = V.engine === "files" ? await fileScene(sc, i) : await silenceScene(sc, i);
    const voiceDelay = sc.voiceDelay ?? T.voiceDelay, tail = sc.tail ?? T.tail;
    const duration = voiceDelay + a.duration + tail;
    scenes.push({ id: sc.id, audioDuration: +a.duration.toFixed(3), voiceDelay, tail, duration: +duration.toFixed(3), parts: a.parts, source: a.source });
    console.log(`  ${i} ${sc.id.padEnd(10)} голос ${a.duration.toFixed(2)} с (${a.parts.length} фраз) → сцена ${duration.toFixed(2)} с`);
  }
  let startFrame = 0;
  for (const s of scenes) { s.startFrame = startFrame; s.frames = Math.round(s.duration * fps); startFrame += s.frames; }
  const total = startFrame / fps;
  writeJSON(path.join(ROOT, "timing.json"), { generated: true, engine: V.engine, total: +total.toFixed(3), scenes });
  console.log(`Итого ${total.toFixed(2)} с, ${startFrame} кадров → timing.json`);

  // голосовая дорожка по таймлайну
  const ins = [], fl = [];
  scenes.forEach((s, i) => {
    ins.push("-i", path.join(VOICE_DIR, `scene${i}.wav`));
    fl.push(`[${i}:a]adelay=${Math.round((s.startFrame / fps + s.voiceDelay) * 1000)}:all=1[a${i}]`);
  });
  const rawVoice = path.join(AUDIO, "voice_raw.wav");
  await ff([...ins, "-filter_complex", `${fl.join(";")};${scenes.map((_, i) => `[a${i}]`).join("")}amix=inputs=${scenes.length}:normalize=0,apad=whole_dur=${total.toFixed(3)},atrim=0:${total.toFixed(3)}[m]`, "-map", "[m]", "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", rawVoice]);
  const voice = path.join(AUDIO, "voice.wav");
  await normalize(rawVoice, voice, ["-ac", "1"]);

  // музыка ровным слоем: без приглушения под голос
  const final = path.join(AUDIO, "narration.wav");
  const musicFile = M.file && fs.existsSync(path.join(ROOT, M.file)) ? path.join(ROOT, M.file) : null;
  const T0 = total.toFixed(3);
  if (musicFile) {
    const fit = path.join(AUDIO, "music_fit.wav");
    await ff(["-stream_loop", "-1", "-i", musicFile, "-t", T0, "-af",
      `afade=t=in:st=0:d=${M.fadeIn ?? 1.5},afade=t=out:st=${(total - (M.fadeOut ?? 3)).toFixed(3)}:d=${M.fadeOut ?? 3}`,
      "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", fit]);
    const vI = Number((await loudness(voice)).input_i), mI = Number((await loudness(fit)).input_i);
    const target = (isFinite(vI) ? vI : -14) + (M.belowVoiceDb ?? -22);
    const gain = target - mI;
    const mix = path.join(AUDIO, "mix_raw.wav");
    await ff(["-i", voice, "-i", fit, "-filter_complex", `[0:a]aformat=channel_layouts=stereo[v];[1:a]volume=${gain.toFixed(2)}dB[m];[v][m]amix=inputs=2:normalize=0,atrim=0:${T0}[out]`,
      "-map", "[out]", "-ar", "48000", "-c:a", "pcm_s16le", mix]);
    // голос — тишина (engine silence): уровень музыки задан от условного голоса −14 LUFS, общую нормализацию не делаем,
    // иначе музыка одна поднимется до −14 LUFS
    if (isFinite(vI)) await normalize(mix, final, ["-ac", "2", "-t", T0]);
    else await ff(["-i", mix, "-ac", "2", "-t", T0, "-ar", "48000", "-c:a", "pcm_s16le", final]);
    console.log(`Музыка: ${path.relative(ROOT, musicFile)}, ровный слой на ${(M.belowVoiceDb ?? -22)} дБ к голосу (${gain.toFixed(1)} дБ к исходной)`);
  } else {
    await ff(["-i", voice, "-ac", "2", "-ar", "48000", "-c:a", "pcm_s16le", final]);
    if (M.file) console.log(`Музыки нет (${M.file}) — дорожка только с голосом`);
  }
  const m2 = await loudness(final);
  console.log(`Дорожка: ${path.relative(ROOT, final)}, ${(await probeDuration(final)).toFixed(3)} с, ${m2.input_i} LUFS, пик ${m2.input_tp} dBTP`);
  fs.mkdirSync(path.join(ROOT, "public", "audio"), { recursive: true });
  fs.copyFileSync(final, path.join(ROOT, "public", "audio", "narration.wav"));
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
