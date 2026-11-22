// Маскот: <Mascot character="r" emotion="joy" /> внутри любого <svg>. Чистая функция пропсов, без таймеров.
import React from "react";
import { CharacterId, EMOTIONS, EmotionId, Face, PALETTES, Palette } from "./config";
import { CHARACTERS } from "./characters";
import { ArmLayer, BrowLayer, EyeLayer, MouthLayer } from "./parts";

export type MascotProps = {
  character: CharacterId;
  emotion?: EmotionId;
  face?: Partial<Face>; // переопределение отдельных слоёв поверх эмоции
  blink?: number; // 0 открыты, 1 закрыты
  x?: number; // левый верх холста персонажа в координатах родителя
  y?: number;
  scale?: number;
  palette?: Partial<Palette>;
  uid?: string; // уникальный префикс id для clipPath/mask, если маскотов несколько
  ring?: number; // 0..1 дуги «дзинь» (у звонка)
  press?: number; // 0..1 нажатие кнопки на макушке (у звонка)
};

export const MASCOT_W = 400;
export const MASCOT_H = 560;

export const Mascot: React.FC<MascotProps> = ({ character, emotion = "calm", face, blink = 0, x = 0, y = 0, scale = 1, palette, uid = "m", ring, press = 0 }) => {
  const c = CHARACTERS[character];
  const p: Palette = { ...PALETTES[character], ...palette };
  const f: Face = { ...EMOTIONS[emotion], ...face };
  const id = `${uid}-${character}`;
  const fg = c.face;
  const maskId = `armroot-${id}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${c.level ? 0 : f.tilt} 200 ${MASCOT_H})`}>
      <defs>
        <clipPath id={`sil-${id}`}><path d={c.silhouette} /></clipPath>
        {/* маска: прячет контур руки только там, где корень руки внутри тела */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-400} y={-400} width={1200} height={1400}>
          <rect x={-400} y={-400} width={1200} height={1400} fill="white" />
          <g clipPath={`url(#sil-${id})`}>
            <circle cx={c.armL.sx} cy={c.armL.sy} r={c.armL.t * 1.15} fill="black" />
            <circle cx={c.armR.sx} cy={c.armR.sy} r={c.armR.t * 1.15} fill="black" />
          </g>
        </mask>
      </defs>
      {c.Back && <c.Back p={p} press={press} />}
      <c.Body p={p} />
      {/* щёки под глазами */}
      {[-1, 1].map((s) => (
        <ellipse key={s} cx={fg.cx + s * (fg.gap + fg.r * 0.55)} cy={fg.eyeY + fg.r * 1.35} rx={fg.r * 0.6} ry={fg.r * 0.34} fill={p.cheek} opacity={0.85 * f.cheeks} />
      ))}
      <EyeLayer id={`${id}-l`} x={fg.cx - fg.gap} y={fg.eyeY} r={fg.r} eye={f.eyeL} lid={blink} style={c.eyeStyle} />
      <EyeLayer id={`${id}-r`} x={fg.cx + fg.gap} y={fg.eyeY} r={fg.r} eye={f.eyeR} lid={blink} style={c.eyeStyle} />
      <BrowLayer x={fg.cx - fg.gap} y={fg.eyeY} r={fg.r} brow={f.browL} side={-1} />
      <BrowLayer x={fg.cx + fg.gap} y={fg.eyeY} r={fg.r} brow={f.browR} side={1} />
      <MouthLayer id={id} x={fg.cx} y={fg.mouthY} w={fg.mouthW} shape={f.mouth} />
      {/* руки: контур (с маской у корня), потом заливка */}
      <g mask={`url(#${maskId})`}>
        <ArmLayer g={c.armL} a={f.armL} fill={p.body} pass="ink" />
        <ArmLayer g={c.armR} a={f.armR} fill={p.body} pass="ink" />
      </g>
      <ArmLayer g={c.armL} a={f.armL} fill={p.body} pass="fill" />
      <ArmLayer g={c.armR} a={f.armR} fill={p.body} pass="fill" />
      {c.Front && <c.Front p={p} ring={ring ?? (emotion === "joy" ? 1 : 0)} />}
    </g>
  );
};
