// Inter для экранов, Rubik для заголовков и наклеек (SIL OFL 1.1, @fontsource 5.3.0). Загрузка на уровне модуля:
// эффекты дочерних компонентов идут раньше эффекта FontGate, поэтому промис должен существовать до первого рендера.
import { staticFile } from "remotion";

const CYR = "U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116";
const LAT = "U+0000-00FF,U+2000-206F";
type FontRow = [string, string, string, string, string];
const FONTS: FontRow[] = [
  ...[400, 500, 600, 700].flatMap((w) => [
    ["Inter", `fonts/inter-cyrillic-${w}-normal.woff2`, CYR, String(w), "normal"] as FontRow,
    ["Inter", `fonts/inter-latin-${w}-normal.woff2`, LAT, String(w), "normal"] as FontRow,
  ]),
  ...[400, 500].flatMap((w) => [
    ["Rubik", `fonts/rubik-cyrillic-${w}-normal.woff2`, CYR, String(w), "normal"] as FontRow,
    ["Rubik", `fonts/rubik-latin-${w}-normal.woff2`, LAT, String(w), "normal"] as FontRow,
  ]),
  ...[700, 800, 900].flatMap((w) => (["normal", "italic"] as const).flatMap((st) => [
    ["Rubik", `fonts/rubik-cyrillic-${w}-${st}.woff2`, CYR, String(w), st] as FontRow,
    ["Rubik", `fonts/rubik-latin-${w}-${st}.woff2`, LAT, String(w), st] as FontRow,
  ])),
];

export const fontsReady: Promise<void> = Promise.all(
  FONTS.map(([fam, file, range, weight, style]) =>
    new FontFace(fam, `url(${staticFile(file)}) format("woff2")`, { weight, style, unicodeRange: range }).load().then((f) => { document.fonts.add(f); })),
).then(() => document.fonts.ready).then(() => undefined);
