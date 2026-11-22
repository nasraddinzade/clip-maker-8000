// Палитры ролика. Выбор темы: --props='{"theme":"dexter"}' (sky, white). Варианты для Рамина, 22.11.2026:
// фон без клетки, стол не чёрный, цифровые синие из интерфейса Dexter (CSS dexter-consulting-demo.vercel.app)
// плюс терракота логотипа ramex #BE4522 как тёплое пятно (маскот, акценты).
import { getInputProps } from "remotion";
import CONFIG from "../config.json";

export type Theme = {
  id: string;
  label: string;
  bg: string; // фон кадра, без клетки
  ink: string; // контуры и текст подписей
  line: string; // черта под ключевым словом, кайма наклеек, отметки прогресса
  fill: string; // нажатые кнопки «Принято», «Одобрено» (белый текст)
  soft: string; // сообщения клиента, фон картинки поста
  card: string;
  cardStyle: "hard" | "soft"; // толстый контур и жёсткая тень или тонкая рамка и мягкая тень, как в Dexter
  cardBorder: string;
  headerBg: string;
  mute: string; // служебный текст экранов
  button: string; // кнопки до нажатия (белый текст)
  desk: string;
  deskEdge: string;
  deskInk: string; // пар и ручка чашки на столе
  baseFill: string; // подставка звонка
};

const NAVY = "#0A1A33"; // текст Dexter
const BLUE = "#3374D2"; // действие Dexter
const TERRA = "#BE4522"; // логотип ramex

export const THEMES: Record<string, Theme> = {
  // 1. Как Dexter: холодный бледно-голубой фон, белые карточки с тонкой рамкой и мягкой тенью, синие действия, терракотовый маскот
  dexter: {
    id: "dexter", label: "Как Dexter", bg: "#EDF2F9", ink: NAVY, line: BLUE, fill: "#2A61B4", // нажатые кнопки темнее (белый 6,2:1 с запасом на растворение)
     soft: "#E1ECFB", card: "#FFFFFF",
    cardStyle: "soft", cardBorder: "#D6E2F3", headerBg: "#F2F6FB", mute: "#4A5B78", button: NAVY,
    desk: "#D6E2F3", deskEdge: "#B5CCF5", deskInk: NAVY, baseFill: "#FFFFFF",
  },
  // 2. Небо и терракота: голубой фон, мультяшный тёмно-синий контур, терракотовые акценты под цвет логотипа
  sky: {
    id: "sky", label: "Небо и терракота", bg: "#DCEAFA", ink: NAVY, line: TERRA, fill: TERRA, soft: "#E1ECFB", card: "#FFFFFF",
    cardStyle: "hard", cardBorder: NAVY, headerBg: "#F2F6FB", mute: "#4A5B78", button: NAVY,
    desk: "#FFFFFF", deskEdge: TERRA, deskInk: NAVY, baseFill: "#FFFFFF",
  },
  // 3. Белый и синий: белый фон, синий стол и синие акценты, терракотовый маскот
  white: {
    id: "white", label: "Белый и синий", bg: "#FFFFFF", ink: NAVY, line: BLUE, fill: BLUE, soft: "#E1ECFB", card: "#FFFFFF",
    cardStyle: "hard", cardBorder: NAVY, headerBg: "#F2F6FB", mute: "#4A5B78", button: NAVY,
    desk: BLUE, deskEdge: "#2A61B4", deskInk: "#FFFFFF", baseFill: "#FFFFFF",
  },
};

// тема из config.json, для сравнения палитр её можно подменить: --props='{"theme":"sky"}'
export const THEME: Theme = THEMES[(getInputProps() as { theme?: string }).theme ?? (CONFIG as { theme: string }).theme] ?? THEMES.dexter;
export const TERRACOTTA = TERRA;
