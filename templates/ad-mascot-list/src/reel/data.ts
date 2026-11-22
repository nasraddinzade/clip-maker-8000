// Таймлайн от голоса (scripts/build_timeline.py пишет src/timeline.json), конфиг ролика и разбор якорей.
// Всё от времени t в секундах, t = кадр / fps.
import { Easing, interpolate } from "remotion";
import TL from "../timeline.json";
import CONFIG from "../../config.json";

export const CFG = CONFIG as unknown as Config;
export const FPS = TL.fps;
export const DURATION = TL.frames;
export const timeline = TL;

export type Word = { w: string; s: number; e: number };
export const WORDS: Word[] = TL.words;

export type TitleCfg = { words: string[]; voice?: string[]; lines?: number[]; accent: number; size?: number; top?: number };
export type Config = {
  video: { fps: number; voiceOffset: number; cardHold: number };
  theme: string;
  music: { file: string; bpm: number; beat: number; phase: number; start: number; mix: string };
  mascot: { character: "r" | "bell" | "bubble"; x: number; scale: number };
  layout: { card: { x: number; y: number; w: number; h: number }; sticker: { x: number; y: number } };
  hook: { title: TitleCfg; swap?: TitleCfg & { at: string }; fan?: { at: string; icons: ("chat" | "order" | "post")[] }; stickers?: StickerCfg[] };
  steps: { marker: string; title: TitleCfg }[];
  screens: ScreenCfg[];
  stickers: StickerCfg[];
  mood: [string, string][];
  rings: string[];
  press?: string;
  final: { marker: string; title: TitleCfg; fan?: boolean };
  card: { marker: string; logo: string; lines: (string | { mark: string })[][]; contact: string };
};
export type StickerCfg = { text: string; at: string; until?: string; dx?: number; seed?: number; rot?: number; dark?: boolean };
export type ScreenCfg =
  | { type: "chat"; enter: string; exit?: string; back?: string; h?: number; header: { name: string; channel: string; time: string };
      messages: { from: "client" | "helper"; text: string; at: string; typing?: number }[]; scroll?: { fadeAt: string; at: string; px: number; old: number } }
  | { type: "order"; enter: string; exit?: string; header: string; headerRight: string; rows: { text: string; at: string }[]; button: string; done: string; tap: string }
  | { type: "post"; enter: string; exit?: string; header: string; caption: string; image: string; text: string; button: string; done: string; tap: string; picture?: string };

const clean = (w: string) => w.toLowerCase().replace(/[.,?!«»]/g, "").replace("ё", "е");
// слово голоса (первое после after, по началу слова)
export function wordAt(word: string, after = 0): Word {
  const k = clean(word);
  const f = WORDS.find((x) => x.s >= after - 0.05 && clean(x.w).startsWith(k));
  if (!f) throw new Error(`нет слова «${word}» после ${after} с: проверь config.json и voice`);
  return f;
}
type Scene = (typeof TL.scenes)[number] & { title?: { words: string[]; accent: number; lines?: number[]; times?: number[]; static?: boolean } };
export const scene = (id: string): Scene => {
  const s = TL.scenes.find((x) => x.id === id);
  if (!s) throw new Error(`нет сцены ${id}`);
  return s as Scene;
};

// Якорь: «слово[@после][:e][±сдвиг]», «#сцена[.titleN][±сдвиг]» или число секунд.
export function at(a: string): number {
  const m = a.trim().match(/^(.*?)([+-]\d+(?:\.\d+)?)?$/)!;
  const base = m[1], d = m[2] ? Number(m[2]) : 0;
  if (/^-?\d+(\.\d+)?$/.test(a.trim())) return Number(a);
  if (base.startsWith("#")) {
    const [id, sub] = base.slice(1).split(".");
    const sc = scene(id);
    if (!sub) return sc.start + d;
    const n = Number(sub.replace("title", ""));
    return sc.title!.times![n] + d;
  }
  const [wpart, end] = base.split(":");
  const [w, after] = wpart.split("@");
  const word = wordAt(w, after ? Number(after) : 0);
  return (end === "e" ? word.e : word.s) + d;
}
export const speaking = (t: number) => WORDS.some((x) => t >= x.s && t <= x.e);

// Кривые по reference/motion-craft.md, раздел 11. Линейных нет.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
export const EASE_IO = Easing.bezier(0.77, 0, 0.175, 1);
export const BACK_OUT = Easing.bezier(0.34, 1.45, 0.64, 1); // удар наклейки с коротким отскоком

export function ramp(t: number, t0: number, dur: number, easing = EASE_OUT) {
  return interpolate(t, [t0, t0 + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing });
}
// появился в t0, ушёл в t1 (уход быстрее прихода)
export function life(t: number, t0: number, t1: number, inDur = 0.35, outDur = 0.22) {
  return Math.min(ramp(t, t0, inDur), 1 - ramp(t, t1 - outDur, outDur, EASE_IO));
}

// Сетка долей трека (scripts/beat.py), секунда трека в кадре 0 (scripts/mix.py).
export const BEAT = CFG.music.beat;
export const MUSIC_START = CFG.music.start;
export const BEAT_PHASE = CFG.music.phase;
// ближайшая доля к t (не раньше t − 0,12 с)
export function snapBeat(t: number) {
  const tt = t + MUSIC_START - BEAT_PHASE;
  const k = Math.round(tt / BEAT);
  let b = k * BEAT + BEAT_PHASE - MUSIC_START;
  if (b < t - 0.12) b += BEAT;
  return b;
}

// детерминированный генератор для неровного края наклеек
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
