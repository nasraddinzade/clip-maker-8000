// Маскот студии Ramex. Эмоции и цвета в конфиге, тело в characters/, слои в parts.tsx.
// Эмоция = состояние: глаза, брови, рот, руки. Переключение эмоции не перерисовывает тело.

export type EmotionId = "calm" | "pointUp" | "joy" | "surprise" | "think" | "wink";

export const EMOTION_ORDER: EmotionId[] = ["calm", "pointUp", "joy", "surprise", "think", "wink"];

export const EMOTION_LABEL: Record<EmotionId, string> = {
  calm: "спокойный",
  pointUp: "указывает вверх",
  joy: "радость",
  surprise: "удивление",
  think: "думает",
  wink: "подмигивает",
};

// Глаз: open (зрачок смотрит в dx, dy от -1 до 1), happy (дуга ^), wide (крупный, зрачок мелкий), shut (закрыт дугой вниз)
export type EyeShape = "open" | "happy" | "wide" | "shut";
export type Eye = { shape: EyeShape; dx?: number; dy?: number };
// Бровь: подъём в долях радиуса глаза, наклон в градусах (+ внешний край вверх)
export type Brow = { lift: number; tilt: number };
export type MouthShape = "smile" | "talk" | "grin" | "o" | "hmm" | "smirk";
export type HandShape = "mitt" | "open" | "point" | "thumb";
// Рука: угол плеча и предплечья в градусах (0 вправо, 90 вниз, -90 вверх), кисть и её угол
export type Arm = { upper: number; fore: number; hand: HandShape; handAngle?: number };

export type Face = {
  eyeL: Eye;
  eyeR: Eye;
  browL: Brow;
  browR: Brow;
  mouth: MouthShape;
  cheeks: number; // 0..1 яркость румянца
  armL: Arm;
  armR: Arm;
  tilt: number; // наклон всего тела, градусы
};

// L и R это левая и правая сторона кадра (не персонажа).
const restL: Arm = { upper: 108, fore: 48, hand: "mitt" };
const restR: Arm = { upper: 72, fore: 132, hand: "mitt" };

export const EMOTIONS: Record<EmotionId, Face> = {
  calm: {
    eyeL: { shape: "open", dx: 0, dy: 0.05 }, eyeR: { shape: "open", dx: 0, dy: 0.05 },
    browL: { lift: 0, tilt: 0 }, browR: { lift: 0, tilt: 0 },
    mouth: "smile", cheeks: 0.5, armL: restL, armR: restR, tilt: 0,
  },
  pointUp: {
    eyeL: { shape: "open", dx: 0.35, dy: -0.55 }, eyeR: { shape: "open", dx: 0.35, dy: -0.55 },
    browL: { lift: 0.25, tilt: 6 }, browR: { lift: 0.35, tilt: 10 },
    mouth: "talk", cheeks: 0.6, armL: restL,
    armR: { upper: -35, fore: -88, hand: "point", handAngle: -90 }, tilt: -3,
  },
  joy: {
    eyeL: { shape: "happy" }, eyeR: { shape: "happy" },
    browL: { lift: 0.45, tilt: 8 }, browR: { lift: 0.45, tilt: 8 },
    mouth: "grin", cheeks: 1, armL: { upper: -145, fore: -110, hand: "open", handAngle: -110 },
    armR: { upper: -35, fore: -70, hand: "open", handAngle: -70 }, tilt: 0,
  },
  surprise: {
    eyeL: { shape: "wide", dx: 0, dy: 0 }, eyeR: { shape: "wide", dx: 0, dy: 0 },
    browL: { lift: 0.8, tilt: 4 }, browR: { lift: 0.8, tilt: 4 },
    mouth: "o", cheeks: 0.4, armL: { upper: 160, fore: -150, hand: "open", handAngle: -135 },
    armR: { upper: 20, fore: -30, hand: "open", handAngle: -45 }, tilt: 0,
  },
  think: {
    eyeL: { shape: "open", dx: -0.45, dy: -0.6 }, eyeR: { shape: "open", dx: -0.45, dy: -0.6 },
    browL: { lift: 0.55, tilt: 12 }, browR: { lift: -0.05, tilt: -6 },
    mouth: "hmm", cheeks: 0.3, armL: restL,
    armR: { upper: 118, fore: -150, hand: "mitt" }, tilt: 3,
  },
  wink: {
    eyeL: { shape: "open", dx: 0.1, dy: 0 }, eyeR: { shape: "shut" },
    browL: { lift: 0.3, tilt: 6 }, browR: { lift: -0.1, tilt: -8 },
    mouth: "smirk", cheeks: 0.8, armL: restL,
    armR: { upper: 25, fore: -75, hand: "thumb", handAngle: -90 }, tilt: -4,
  },
};

// Общие цвета роликов Ramex (студийная палитра). Терракота #BE4522 только у логотипа, в маскоте её нет.
import { THEME } from "../theme";
export const INK = THEME.ink; // контур и зрачки, из темы проекта (src/theme.ts)
export const PAPER = THEME.bg; // фон
export const MOUTH_IN = THEME.ink; // рот изнутри
export const TONGUE = "#E8957A";
export const WHITE = "#FFFFFF";

export type Palette = { body: string; shade: string; light: string; cheek: string; detail: string; gap?: string; wood?: string; woodLight?: string };

export type CharacterId = "r" | "bell" | "bubble";

export const PALETTES: Record<CharacterId, Palette> = {
  // буква r: горчично-пшеничная, рядом с брендом по теплу, но не терракота
  r: { body: "#EFB144", shade: "#D7952B", light: "#F8D27E", cheek: "#E9805F", detail: "#C77F1F" },
  // настольный звонок: латунный купол с бликом, деревянная подставка (бирюзовый звонок не опознавался)
  bell: { body: "#BE4522", shade: "#963515", light: "#E0835F", cheek: "#F2B39A", detail: THEME.ink, wood: THEME.baseFill, woodLight: "#E3EAF4" },
  // облачко сообщения: небесно-голубое (сливочное сливалось с бумагой)
  bubble: { body: "#A9D3EE", shade: "#82B8DC", light: "#E3F3FC", cheek: "#F08A78", detail: "#5E9CC6" },
};

export const CHARACTER_LABEL: Record<CharacterId, string> = {
  r: "«Эр», живая буква r из логотипа",
  bell: "«Дзинь», настольный звонок приёма",
  bubble: "«Пиши», облачко сообщения",
};

export const OUTLINE = 9; // толщина контура в единицах персонажа (холст персонажа 400×560)
