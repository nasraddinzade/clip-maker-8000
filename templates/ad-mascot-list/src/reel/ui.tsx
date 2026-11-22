// Общие элементы кадра: бумага со столом, метка шага и точки, заголовок с проявлением слов, карточка, наклейка, касание.
import React from "react";
import { INK } from "../mascot/config";
import { TERRACOTTA, THEME } from "../theme";
import { BACK_OUT, EASE_OUT, ramp, rng } from "./data";

export const C = {
  // палитра из темы (src/theme.ts); имена ключей остались от прошлых кругов
  paper: THEME.bg,
  grid: "#E3EAF4",
  ink: THEME.ink,
  accent: THEME.ink, // ключевое слово тёмное с цветной чертой снизу
  orange: THEME.line, // черта под словом, кайма наклеек, отметки, полоса стола
  orangeSoft: THEME.soft,
  card: THEME.card,
  brass: THEME.fill, // нажатые кнопки и отметки прогресса
  sky: THEME.soft,
  sage: THEME.button, // кнопки до нажатия, белый текст
  desk: THEME.desk,
  deskLine: "#D6E2F3",
  mute: THEME.mute,
  terra: TERRACOTTA, // логотип ramex и маскот
  logo: TERRACOTTA,
};
export const HEAD = "Rubik";
export const UI = "Inter";
export const TABLE_Y = 1311; // низ подставки звонка (y 922 + 526 × 0,74)

// Ровный фон без клетки (решение Рамина) и стол (фон уходит под интерфейс Reels, нижняя треть не пустая).
export const Backdrop: React.FC = () => (
  <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
    <rect width={1080} height={1920} fill={C.paper} />
    <rect x={0} y={TABLE_Y} width={1080} height={1920 - TABLE_Y} fill={C.desk} />
    <rect x={0} y={TABLE_Y} width={1080} height={14} fill={THEME.deskEdge} />
  </svg>
);

// Стол владельца: блокнот заказов и чашка вечернего чая с паром (знак «вечер ваш»). Фон, уходит под интерфейс Reels.
export const DeskProps: React.FC<{ t: number }> = ({ t }) => {
  const steam = (k: number) => {
    const ph = (t * 0.55 + k * 0.33) % 1;
    const y0 = 1452 - ph * 70, op = Math.sin(ph * Math.PI) * 0.8;
    const sw = Math.sin(t * 2.1 + k * 1.7) * 8;
    return <path key={k} d={`M${818 + k * 30},${y0 + 40} C${806 + k * 30 + sw},${y0 + 20} ${830 + k * 30 - sw},${y0} ${818 + k * 30},${y0 - 20}`} fill="none" stroke={THEME.deskInk} strokeWidth={6} strokeLinecap="round" opacity={op} />;
  };
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
      {/* блокнот в клетку с карандашом */}
      <g transform="rotate(-4 520 1440)">
        <rect x={392} y={1372} width={290} height={170} rx={12} fill={INK} opacity={0.18} transform="translate(10 10)" />
        <rect x={392} y={1372} width={290} height={170} rx={12} fill="#FFFFFF" stroke={INK} strokeWidth={6} />
        {[0, 1, 2].map((k) => <line key={k} x1={420} y1={1420 + k * 36} x2={650} y2={1420 + k * 36} stroke={C.grid} strokeWidth={5} />)}
        <rect x={392} y={1372} width={36} height={170} fill={C.terra} stroke={INK} strokeWidth={6} />
        <g transform="rotate(28 600 1470)">
          <rect x={540} y={1458} width={160} height={24} rx={6} fill={C.terra} stroke={INK} strokeWidth={5} />
          <path d="M700,1458 L728,1470 L700,1482 Z" fill="#FFFFFF" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        </g>
      </g>
      {/* чашка чая */}
      <rect x={772} y={1480} width={150} height={20} rx={10} fill="#FFFFFF" stroke={INK} strokeWidth={6} />
      <path d="M786,1394 H908 V1450 Q908,1484 874,1484 H820 Q786,1484 786,1450 Z" fill="#FFFFFF" stroke={INK} strokeWidth={6} strokeLinejoin="round" />
      <rect x={796} y={1404} width={102} height={20} rx={6} fill={C.terra} />
      <path d="M908,1414 Q946,1414 946,1440 Q946,1464 906,1464" fill="none" stroke={INK} strokeWidth={8} />
      {[0, 1, 2].map(steam)}
    </svg>
  );
};

// Метка шага: крупная цифра в плашке (заглавные подписи не мельче 20 px в 360, значит кегль Rubik от 86) и три точки прогресса.
export const StepLabel: React.FC<{ step: number; total?: number; t: number; t0: number }> = ({ step, total = 3, t, t0 }) => {
  const a = ramp(t, t0, 0.35);
  return (
    <div style={{ position: "absolute", left: 72, top: 276, height: 104, width: 880, opacity: a, transform: `translateY(${(1 - a) * 12}px)` }}>
      <div data-role="caption" style={{ position: "absolute", left: 0, top: 0, width: 104, height: 104, borderRadius: 22, background: INK, color: "#FFFFFF", fontFamily: HEAD, fontWeight: 900, fontSize: 88, lineHeight: "108px", textAlign: "center" }}>{step}</div>
      <div style={{ position: "absolute", left: 136, top: 40, display: "flex", gap: 16 }}>
        {Array.from({ length: total }, (_, i) => i + 1).map((k) => {
          const on = k < step ? 1 : k === step ? ramp(t, t0 + 0.15, 0.3) : 0;
          return <div key={k} style={{ width: k === step ? 52 : 26, height: 26, borderRadius: 13, border: `5px solid ${INK}`, background: on > 0.5 ? C.brass : C.card, boxSizing: "border-box" }} />;
        })}
      </div>
    </div>
  );
};

// Заголовок: слова из бледного в тёмный по меткам голоса, ключевое слово в акцент и наклон.
export const Title: React.FC<{ words: string[]; times?: number[]; accent: number; t: number; size?: number; top?: number; staticOn?: boolean; lines?: number[] }> = ({ words, times, accent, t, size = 96, top = 352, staticOn, lines }) => {
  const rows: string[][] = [];
  const br = lines ?? [words.length];
  let k = 0;
  for (const n of br) { rows.push(words.slice(k, k + n)); k += n; }
  let idx = 0;
  return (
    <div data-role="caption" style={{ position: "absolute", left: 72, top, width: 900, fontFamily: HEAD, fontWeight: 900, fontSize: size, lineHeight: 1.06, letterSpacing: -1 }}>
      {rows.map((row, r) => (
        <div key={r} style={{ whiteSpace: "nowrap" }}>
          {row.map((w) => {
            const i = idx++;
            const p = staticOn ? 1 : times ? ramp(t, times[i] - 0.05, 0.28) : 1;
            const isAcc = i === accent;
            const accP = isAcc ? (staticOn ? 1 : ramp(t, (times?.[i] ?? 0) + 0.12, 0.3)) : 0;
            const on = isAcc && accP > 0.5;
            return (
              <span key={i} style={{ display: "inline-block", marginRight: size * 0.24, color: INK, opacity: 0.3 + 0.7 * p, fontStyle: on ? "italic" : "normal",
                background: isAcc ? `linear-gradient(${C.orange}, ${C.orange}) left bottom / ${accP * 100}% ${size * 0.13}px no-repeat` : undefined,
                paddingBottom: isAcc ? size * 0.1 : undefined, transform: `skewX(${isAcc ? -6 * accP : 0}deg)` }}>{w}</span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

// Карточка экрана: толстый контур, жёсткая тень со сдвигом, появление от 0,95 и прозрачности.
export const Card: React.FC<{ x: number; y: number; w: number; h: number; p?: number; rot?: number; children?: React.ReactNode; bg?: string; z?: number; role?: string }> = ({ x, y, w, h, p = 1, rot = 0, children, bg = C.card, z, role }) => {
  const soft = THEME.cardStyle === "soft";
  return (
    <div data-role={role} style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: p, zIndex: z, transform: `translateY(${(1 - p) * 24}px) scale(${0.95 + 0.05 * p}) rotate(${rot}deg)`, transformOrigin: "50% 60%" }}>
      {!soft && <div style={{ position: "absolute", left: 14, top: 14, width: w, height: h, borderRadius: 34, background: INK }} />}
      <div style={{ position: "absolute", inset: 0, borderRadius: 34, background: bg, border: soft ? `3px solid ${THEME.cardBorder}` : `7px solid ${INK}`, boxShadow: soft ? "0 22px 48px rgba(10,26,51,0.14), 0 4px 10px rgba(10,26,51,0.06)" : undefined, boxSizing: "border-box", overflow: "hidden" }}>{children}</div>
    </div>
  );
};

// Наклейка-штамп: вырезанная бумага с неровной белой каймой, наискосок, удар с отскоком.
export const Sticker: React.FC<{ text: string; x: number; y: number; t: number; t0: number; color?: string; rot?: number; size?: number; seed?: number; textColor?: string }> = ({ text, x, y, t, t0, color = "#FFFFFF", rot = -7, size = 88, seed = 7, textColor = INK }) => {
  if (t < t0) return null;
  const p = ramp(t, t0, 0.32, BACK_OUT);
  const a = ramp(t, t0, 0.08, EASE_OUT);
  const w = text.length * size * 0.66 + size * 0.9, h = size * 1.55;
  const r = rng(seed);
  const pts: string[] = [];
  const edge = (x0: number, y0: number, x1: number, y1: number, n: number) => {
    for (let i = 0; i < n; i++) {
      const u = i / n;
      pts.push(`${x0 + (x1 - x0) * u + (r() - 0.5) * 7},${y0 + (y1 - y0) * u + (r() - 0.5) * 7}`);
    }
  };
  const m = 4;
  edge(m, m, w - m, m, 14); edge(w - m, m, w - m, h - m, 4); edge(w - m, h - m, m, h - m, 14); edge(m, h - m, m, m, 4);
  const poly = pts.join(" ");
  return (
    <div data-role="sticker" style={{ position: "absolute", left: x, top: y, width: w, height: h, opacity: a, transform: `rotate(${rot}deg) scale(${1.15 - 0.15 * p})`, transformOrigin: "50% 50%", zIndex: 30 }}>
      <svg width={w + 16} height={h + 16} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        <polygon points={poly} transform="translate(9 9)" fill={INK} />
        <polygon points={poly} fill={C.orange} stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <rect x={14} y={14} width={w - 28} height={h - 28} rx={12} fill={color} stroke={INK} strokeWidth={4} />
      </svg>
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: HEAD, fontWeight: 900, fontSize: size, color: textColor, letterSpacing: 1, paddingTop: 4 }}>{text}</div>
    </div>
  );
};

// Касание: кольцо сходится на цель, нажатие сжимает кнопку (0,97 за 0,13 с), волна расходится.
export function pressScale(t: number, tap: number) {
  if (t < tap || t > tap + 0.26) return 1;
  const u = (t - tap) / 0.13;
  return u < 1 ? 1 - 0.03 * u : 0.97 + 0.03 * (u - 1);
}
export const TapRing: React.FC<{ x: number; y: number; t: number; tap: number }> = ({ x, y, t, tap }) => {
  if (t < tap - 0.45 || t > tap + 0.6) return null;
  const come = ramp(t, tap - 0.45, 0.4);
  const wave = ramp(t, tap, 0.5);
  const r = 46 - 8 * come + (t >= tap ? 6 * Math.min(1, (t - tap) / 0.13) : 0);
  return (
    <svg width={300} height={300} style={{ position: "absolute", left: x - 150, top: y - 150, overflow: "visible", zIndex: 40 }}>
      <circle cx={150} cy={150 + (1 - come) * 60} r={r} fill="none" stroke={INK} strokeWidth={5} opacity={come * (1 - ramp(t, tap + 0.3, 0.3))} />
      {t >= tap && <circle cx={150} cy={150} r={46 + wave * 70} fill="none" stroke={INK} strokeWidth={6 * (1 - wave)} opacity={1 - wave} />}
    </svg>
  );
};
