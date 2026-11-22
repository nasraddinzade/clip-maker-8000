// Тела трёх маскотов. Холст персонажа 400×560, низ (y 560) это линия «по пояс», тело может уходить ниже.
import React from "react";
import { CharacterId, INK, OUTLINE, Palette } from "./config";
import { ArmGeo } from "./parts";

export type FaceGeo = { cx: number; eyeY: number; gap: number; r: number; mouthY: number; mouthW: number };

export type Character = {
  id: CharacterId;
  silhouette: string; // главный контур тела, по нему маска корня руки
  face: FaceGeo;
  armL: ArmGeo;
  armR: ArmGeo;
  eyeStyle?: "sclera" | "bead";
  level?: boolean; // стоит на столе: наклон эмоции не применяется, основание всегда ровное
  Back?: React.FC<{ p: Palette; press: number }>; // за телом; press 0..1 нажатие кнопки (звонок)
  Body: React.FC<{ p: Palette }>; // тело с контуром и деталями
  Front?: React.FC<{ p: Palette; ring: number }>; // поверх всего; ring 0..1 сила «дзинь»
};

const o = OUTLINE;

// ---------- 1. «Эр»: буква r из логотипа ramex ----------
// Широкий короткий стебель (тело с лицом) и плечо буквы вправо с круглым концом, как в логотипе.
// Верх плоский, левый верхний угол почти прямой, между стеблем и плечом прорезь логотипа цвета фона:
// так силуэт читается буквой, а не столбом (замечание проверки похожести, круг 1).
const R_SIL = "M44,960 L44,150 Q44,104 92,104 L352,104 Q414,104 414,162 Q414,222 356,222 L322,222 Q290,222 276,250 L276,960 Z";
const rChar: Character = {
  id: "r",
  silhouette: R_SIL,
  face: { cx: 160, eyeY: 300, gap: 50, r: 31, mouthY: 382, mouthW: 72 },
  armL: { sx: 52, sy: 450, upper: 80, fore: 72, t: 30, hand: 23 },
  armR: { sx: 268, sy: 450, upper: 80, fore: 72, t: 30, hand: 23 },
  Body: ({ p }) => (
    <g>
      <path d={R_SIL} fill={p.body} stroke={INK} strokeWidth={o} strokeLinejoin="round" />
      {/* блик стебля */}
      <rect x={62} y={150} width={16} height={430} rx={8} fill={p.light} />
      {/* прорезь логотипа: серп цвета фона от плеча к верху стебля */}
      <path d="M280,236 Q246,176 196,104 L222,104 Q262,162 300,222 Z" fill={p.gap ?? "#F3EADA"} stroke={INK} strokeWidth={o * 0.75} strokeLinejoin="round" />
    </g>
  ),
};

// ---------- 2. «Дзинь»: настольный звонок приёма. Купол это голова и тело ----------
const BELL_SIL = "M42,448 C42,262 118,196 200,196 C282,196 358,262 358,448 Z";
const bellChar: Character = {
  id: "bell",
  silhouette: BELL_SIL,
  face: { cx: 200, eyeY: 322, gap: 56, r: 33, mouthY: 398, mouthW: 78 },
  // глаза-бусины без белка: на латуни читаются как отражение, лицо не стикерное
  eyeStyle: "bead",
  level: true,
  armL: { sx: 66, sy: 372, upper: 66, fore: 60, t: 30, hand: 27 },
  armR: { sx: 334, sy: 372, upper: 66, fore: 60, t: 30, hand: 27 },
  Back: ({ p, press }) => (
    <g transform={`translate(0 ${press * 30})`}>
      {/* шток и кнопка; при нажатии уходят в купол */}
      <rect x={185} y={150} width={30} height={56} rx={6} fill={p.detail} stroke={INK} strokeWidth={o} />
      <ellipse cx={200} cy={148} rx={44} ry={17} fill={p.detail} stroke={INK} strokeWidth={o} />
      <ellipse cx={188} cy={143} rx={16} ry={5} fill="#FFFFFF" opacity={0.7} />
    </g>
  ),
  // фирменный знак: две дуги «дзинь» по сторонам кнопки
  Front: ({ ring }) => ring <= 0 ? null : (
    <g opacity={Math.min(1, ring * 1.4)} stroke={INK} strokeWidth={o * 0.9} strokeLinecap="round" fill="none">
      {[-1, 1].map((sd) => [0, 1].map((k) => {
        const rr = 52 + k * 24 + ring * 8;
        const a0 = -90 + sd * 28, a1 = -90 + sd * 62;
        const P = (a: number) => [200 + Math.cos((a * Math.PI) / 180) * rr, 160 + Math.sin((a * Math.PI) / 180) * rr];
        const [x0, y0] = P(a0), [x1, y1] = P(a1);
        return <path key={`${sd}${k}`} d={`M${x0},${y0} A${rr},${rr} 0 0 ${sd > 0 ? 1 : 0} ${x1},${y1}`} />;
      }))}
    </g>
  ),
  Body: ({ p }) => (
    <g>
      <path d={BELL_SIL} fill={p.body} stroke={INK} strokeWidth={o} strokeLinejoin="round" />
      {/* металл: широкий блик слева, тень справа */}
      <path d="M86,420 C84,330 116,272 164,246" fill="none" stroke={p.light} strokeWidth={18} strokeLinecap="round" />
      <path d="M318,430 C318,350 300,300 268,262" fill="none" stroke={p.shade} strokeWidth={14} strokeLinecap="round" />
      {/* юбка купола и деревянная подставка с ровными краями */}
      <rect x={30} y={436} width={340} height={22} rx={8} fill={p.shade} stroke={INK} strokeWidth={o} />
      <rect x={12} y={456} width={376} height={70} rx={10} fill={p.wood ?? "#6A4632"} stroke={INK} strokeWidth={o} />
      <rect x={24} y={466} width={352} height={10} rx={5} fill={p.woodLight ?? "#8C6247"} />
    </g>
  ),
};

// ---------- 3. «Пиши»: облачко сообщения с хвостиком, небесно-голубое, чтобы не сливаться с бумагой ----------
const BUB_SIL = "M122,112 H278 Q360,112 360,194 V346 Q360,428 278,428 H176 L104,506 L120,426 Q40,420 40,346 V194 Q40,112 122,112 Z";
const bubbleChar: Character = {
  id: "bubble",
  silhouette: BUB_SIL,
  face: { cx: 200, eyeY: 262, gap: 54, r: 31, mouthY: 340, mouthW: 76 },
  armL: { sx: 48, sy: 340, upper: 74, fore: 66, t: 28, hand: 22 },
  armR: { sx: 352, sy: 340, upper: 74, fore: 66, t: 28, hand: 22 },
  Body: ({ p }) => (
    <g>
      <path d={BUB_SIL} fill={p.body} stroke={INK} strokeWidth={o} strokeLinejoin="round" />
      <path d="M68,330 V206 Q68,142 128,140" fill="none" stroke={p.light} strokeWidth={13} strokeLinecap="round" />
      <path d="M300,402 Q338,396 340,356" fill="none" stroke={p.shade} strokeWidth={12} strokeLinecap="round" />
    </g>
  ),
};

export const CHARACTERS: Record<CharacterId, Character> = { r: rChar, bell: bellChar, bubble: bubbleChar };
