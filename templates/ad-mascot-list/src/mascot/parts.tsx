// Слои лица и рук. Всё рисуется в единицах холста персонажа (400×560), контур толстый и тёплый.
import React from "react";
import { Arm, Brow, Eye, INK, MOUTH_IN, MouthShape, OUTLINE, TONGUE, WHITE } from "./config";

const rad = (d: number) => (d * Math.PI) / 180;
const pt = (x: number, y: number, ang: number, len: number): [number, number] => [x + Math.cos(rad(ang)) * len, y + Math.sin(rad(ang)) * len];

// ---------- глаза ----------
// style "bead": тёмный овал без белка с двумя бликами (как отражение на металле), "sclera": белок и зрачок.
export const EyeLayer: React.FC<{ x: number; y: number; r: number; eye: Eye; lid?: number; id: string; style?: "sclera" | "bead" }> = ({ x, y, r, eye, lid = 0, id, style = "sclera" }) => {
  const w = OUTLINE;
  if (style === "bead" && (eye.shape === "open" || eye.shape === "wide")) {
    const wide = eye.shape === "wide";
    const rx = r * (wide ? 0.62 : 0.5), ry = r * (wide ? 1.0 : 0.82) * Math.max(0.08, 1 - lid);
    const bx = x + (eye.dx ?? 0) * r * 0.22, by = y + (eye.dy ?? 0) * r * 0.22;
    // блики смещаются против взгляда, глаз «смотрит» направлением бликов и сдвигом
    const hx = bx - rx * 0.3 - (eye.dx ?? 0) * rx * 0.15, hy = by - ry * 0.42 - (eye.dy ?? 0) * ry * 0.1;
    return (
      <g>
        <ellipse cx={bx} cy={by} rx={rx} ry={ry} fill={INK} />
        {lid < 0.6 && <ellipse cx={hx} cy={hy} rx={rx * 0.34} ry={ry * 0.24} fill={WHITE} />}
        {lid < 0.6 && <circle cx={bx + rx * 0.32} cy={by + ry * 0.38} r={rx * 0.14} fill={WHITE} opacity={0.85} />}
      </g>
    );
  }
  if (eye.shape === "happy") {
    return <path d={`M${x - r * 0.85},${y + r * 0.25} Q${x},${y - r * 1.05} ${x + r * 0.85},${y + r * 0.25}`} fill="none" stroke={INK} strokeWidth={w * 1.25} strokeLinecap="round" />;
  }
  if (eye.shape === "shut") {
    return <path d={`M${x - r * 0.85},${y - r * 0.05} Q${x},${y + r * 0.7} ${x + r * 0.85},${y - r * 0.05}`} fill="none" stroke={INK} strokeWidth={w * 1.25} strokeLinecap="round" />;
  }
  const wide = eye.shape === "wide";
  const rx = r * (wide ? 1.02 : 0.84), ry = r * (wide ? 1.18 : 1) * Math.max(0.06, 1 - lid);
  const pr = r * (wide ? 0.34 : 0.52);
  const px = x + (eye.dx ?? 0) * (rx - pr) * 0.75, py = y + (eye.dy ?? 0) * (ry - pr) * 0.7;
  return (
    <g>
      <clipPath id={`eyeclip-${id}`}><ellipse cx={x} cy={y} rx={rx} ry={ry} /></clipPath>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={WHITE} stroke={INK} strokeWidth={w} />
      <g clipPath={`url(#eyeclip-${id})`}>
        <circle cx={px} cy={py} r={pr} fill={INK} />
        <circle cx={px - pr * 0.35} cy={py - pr * 0.38} r={pr * 0.3} fill={WHITE} />
      </g>
    </g>
  );
};

// ---------- брови ----------
// side = -1 левая сторона кадра, +1 правая. tilt > 0 поднимает внешний край.
export const BrowLayer: React.FC<{ x: number; y: number; r: number; brow: Brow; side: -1 | 1 }> = ({ x, y, r, brow, side }) => {
  const b = r * 0.72, cy = y - r * 1.5 - brow.lift * r;
  const ang = side < 0 ? brow.tilt : -brow.tilt;
  return (
    <g transform={`rotate(${ang} ${x} ${cy})`}>
      <line x1={x - b} y1={cy} x2={x + b} y2={cy} stroke={INK} strokeWidth={OUTLINE * 1.35} strokeLinecap="round" />
    </g>
  );
};

// ---------- рот ----------
export const MouthLayer: React.FC<{ x: number; y: number; w: number; shape: MouthShape; id: string }> = ({ x, y, w, shape, id }) => {
  const s = OUTLINE;
  switch (shape) {
    case "smile":
      return <path d={`M${x - w / 2},${y} Q${x},${y + w * 0.42} ${x + w / 2},${y}`} fill="none" stroke={INK} strokeWidth={s} strokeLinecap="round" />;
    case "talk": {
      const d = `M${x - w * 0.45},${y} Q${x},${y + w * 0.75} ${x + w * 0.45},${y} Q${x},${y + w * 0.12} ${x - w * 0.45},${y} Z`;
      return <path d={d} fill={MOUTH_IN} stroke={INK} strokeWidth={s * 0.85} strokeLinejoin="round" />;
    }
    case "grin": {
      const d = `M${x - w * 0.62},${y - 4} Q${x},${y + w * 1.05} ${x + w * 0.62},${y - 4} Q${x},${y + w * 0.08} ${x - w * 0.62},${y - 4} Z`;
      return (
        <g>
          <clipPath id={`m-${id}`}><path d={d} /></clipPath>
          <path d={d} fill={MOUTH_IN} />
          <ellipse cx={x + w * 0.05} cy={y + w * 0.62} rx={w * 0.34} ry={w * 0.22} fill={TONGUE} clipPath={`url(#m-${id})`} />
          <path d={d} fill="none" stroke={INK} strokeWidth={s * 0.9} strokeLinejoin="round" />
        </g>
      );
    }
    case "o":
      return <ellipse cx={x} cy={y + w * 0.18} rx={w * 0.2} ry={w * 0.27} fill={MOUTH_IN} stroke={INK} strokeWidth={s * 0.9} />;
    case "hmm":
      return <path d={`M${x - w * 0.2},${y + w * 0.12} Q${x + w * 0.12},${y + w * 0.02} ${x + w * 0.45},${y + w * 0.14}`} fill="none" stroke={INK} strokeWidth={s} strokeLinecap="round" />;
    case "smirk":
      return <path d={`M${x - w * 0.42},${y + w * 0.04} Q${x + w * 0.05},${y + w * 0.36} ${x + w * 0.5},${y - w * 0.1}`} fill="none" stroke={INK} strokeWidth={s} strokeLinecap="round" />;
  }
};

// ---------- руки ----------
export type ArmGeo = { sx: number; sy: number; upper: number; fore: number; t: number; hand: number };

export function armPoints(g: ArmGeo, a: Arm) {
  const e = pt(g.sx, g.sy, a.upper, g.upper);
  const w = pt(e[0], e[1], a.fore, g.fore);
  return { e, w };
}

// Кисть: варежка (круг), раскрытая (три пальца), указательный палец, большой палец вверх.
const Finger: React.FC<{ x: number; y: number; ang: number; len: number; t: number; fill: string; pass: "ink" | "fill" }> = ({ x, y, ang, len, t, fill, pass }) => {
  const [x2, y2] = pt(x, y, ang, len);
  return <line x1={x} y1={y} x2={x2} y2={y2} stroke={pass === "ink" ? INK : fill} strokeWidth={pass === "ink" ? t + OUTLINE * 2 : t} strokeLinecap="round" />;
};

// side: с какой стороны кулака палец (по направлению руки от тела), чтобы жест не читался как средний палец.
function handParts(a: Arm, wx: number, wy: number, h: number) {
  const ang = a.handAngle ?? a.fore;
  const out = Math.cos(rad(a.upper)) >= 0 ? 1 : -1; // рука уходит вправо (+1) или влево (-1)
  const fingers: { ang: number; len: number; t: number; from: [number, number] }[] = [];
  if (a.hand === "point") {
    // указательный у края кулака, большой палец прижат с другой стороны
    const base = pt(wx, wy, ang + 90 * out, h * 0.42);
    fingers.push({ ang, len: h * 1.45, t: h * 0.6, from: pt(base[0], base[1], ang, h * 0.2) });
    const tb = pt(wx, wy, ang - 90 * out, h * 0.55);
    fingers.push({ ang: ang - 60 * out, len: h * 0.45, t: h * 0.5, from: tb });
  }
  if (a.hand === "thumb") {
    // большой палец вверх у края кулака, кулак повернут поперёк
    const base = pt(wx, wy, ang - 90 * out, h * 0.45);
    fingers.push({ ang, len: h * 1.15, t: h * 0.62, from: pt(base[0], base[1], ang, h * 0.3) });
    for (const k of [0.1, 0.6]) fingers.push({ ang: ang + 90 * out, len: h * 0.55, t: h * 0.55, from: pt(...pt(wx, wy, ang + 180, h * (k - 0.2)), ang + 90 * out, h * 0.45) });
  }
  if (a.hand === "open") for (const d of [-32, 0, 32]) fingers.push({ ang: ang + d, len: h * 0.95, t: h * 0.5, from: pt(wx, wy, ang + d, h * 0.45) });
  return fingers;
}

// Рука в два прохода: контур под всем (ink), заливка сверху (fill). Корень руки у плеча прячется маской,
// поэтому рука выходит из тела без шва, а там, где рука проходит перед лицом, контур виден.
export const ArmLayer: React.FC<{ g: ArmGeo; a: Arm; fill: string; pass: "ink" | "fill" }> = ({ g, a, fill, pass }) => {
  const { e, w } = armPoints(g, a);
  const d = `M${g.sx},${g.sy} L${e[0]},${e[1]} L${w[0]},${w[1]}`;
  const fingers = handParts(a, w[0], w[1], g.hand);
  if (pass === "ink") {
    return (
      <g>
        <path d={d} fill="none" stroke={INK} strokeWidth={g.t + OUTLINE * 2} strokeLinecap="round" strokeLinejoin="round" />
        {fingers.map((f, i) => <Finger key={i} x={f.from[0]} y={f.from[1]} ang={f.ang} len={f.len} t={f.t} fill={fill} pass="ink" />)}
        <circle cx={w[0]} cy={w[1]} r={g.hand + OUTLINE} fill={INK} />
      </g>
    );
  }
  return (
    <g>
      <path d={d} fill="none" stroke={fill} strokeWidth={g.t} strokeLinecap="round" strokeLinejoin="round" />
      {fingers.map((f, i) => <Finger key={i} x={f.from[0]} y={f.from[1]} ang={f.ang} len={f.len} t={f.t} fill={fill} pass="fill" />)}
      <circle cx={w[0]} cy={w[1]} r={g.hand} fill={fill} />
    </g>
  );
};
