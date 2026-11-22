import React, { useState } from "react";
import { AbsoluteFill, Composition, continueRender, delayRender, staticFile } from "remotion";
import { CHARACTER_LABEL, CharacterId, EMOTION_LABEL, EMOTION_ORDER, EmotionId, INK, PAPER } from "./mascot/config";
import { MASCOT_H, MASCOT_W, Mascot } from "./mascot/Mascot";
import { CHARACTERS } from "./mascot/characters";
import { fontsReady } from "./fonts";
import { Reel } from "./reel/Reel";
import { DURATION } from "./reel/data";

// Шрифты грузятся один раз при загрузке модуля; их ждут FontGate и аудит текста (src/fonts.ts).
const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender("fonts"));
  React.useEffect(() => { fontsReady.then(() => continueRender(handle)); }, [handle]);
  return <>{children}</>;
};

// Тёплая бумага с еле заметной сеткой (приём образца).
export const Paper: React.FC<{ w: number; h: number; step?: number }> = ({ w, h, step = 54 }) => (
  <svg width={w} height={h} style={{ position: "absolute", inset: 0 }}>
    <rect width={w} height={h} fill={PAPER} />
    {Array.from({ length: Math.ceil(w / step) + 1 }, (_, i) => <line key={`v${i}`} x1={i * step + 0.5} y1={0} x2={i * step + 0.5} y2={h} stroke="#E4D6BF" strokeWidth={1.5} />)}
    {Array.from({ length: Math.ceil(h / step) + 1 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * step + 0.5} x2={w} y2={i * step + 0.5} stroke="#E4D6BF" strokeWidth={1.5} />)}
  </svg>
);

const label: React.CSSProperties = { fontFamily: "Inter", fontWeight: 700, color: INK };

// Стоп-кадр персонажа 1080×1920: маскот по пояс внизу, лицо в полосе 14–65 % высоты.
const MascotStill: React.FC<{ character: CharacterId; emotion: EmotionId }> = ({ character, emotion }) => {
  // глаза на y 1060 (55 % высоты): лицо целиком в полосе 14–65 %
  const s = 1.72, x = (1080 - MASCOT_W * s) / 2 - 30, y = 1060 - CHARACTERS[character].face.eyeY * s;
  return (
    <AbsoluteFill>
      <Paper w={1080} h={1920} />
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}>
        <Mascot character={character} emotion={emotion} x={x} y={y} scale={s} uid="still" />
      </svg>
    </AbsoluteFill>
  );
};

// Лист эмоций 1800×1320: шесть плиток 3×2.
const MascotSheet: React.FC<{ character: CharacterId }> = ({ character }) => {
  const tw = 560, th = 560, gx = 40, top = 150;
  return (
    <AbsoluteFill>
      <Paper w={1800} h={1320} />
      <div style={{ ...label, position: "absolute", left: 60, top: 46, fontSize: 52 }}>{CHARACTER_LABEL[character]}</div>
      <svg width={1800} height={1320} style={{ position: "absolute", inset: 0 }}>
        {EMOTION_ORDER.map((e, i) => {
          const cx = 60 + (i % 3) * (tw + gx), cy = top + Math.floor(i / 3) * (th + 20);
          const s = 0.84;
          return (
            <g key={e}>
              <rect x={cx} y={cy} width={tw} height={th} rx={22} fill="#FBF5EA" stroke="#D9C9AE" strokeWidth={3} />
              <svg x={cx} y={cy} width={tw} height={th - 64} overflow="hidden">
                <Mascot character={character} emotion={e} x={(tw - MASCOT_W * s) / 2} y={44} scale={s} uid={`s${i}`} />
              </svg>
            </g>
          );
        })}
      </svg>
      {EMOTION_ORDER.map((e, i) => (
        <div key={e} style={{ ...label, fontWeight: 500, position: "absolute", fontSize: 34, left: 60 + (i % 3) * (tw + gx), width: tw, textAlign: "center", top: top + Math.floor(i / 3) * (th + 20) + th - 56 }}>{EMOTION_LABEL[e]}</div>
      ))}
    </AbsoluteFill>
  );
};

// Три эскиза рядом, спокойные, без подписей: для проверки похожести свежим субагентом.
const MascotLineup: React.FC = () => (
  <AbsoluteFill>
    <Paper w={1800} h={760} />
    <svg width={1800} height={760} style={{ position: "absolute", inset: 0 }}>
      {(["r", "bell", "bubble"] as CharacterId[]).map((c, i) => (
        <svg key={c} x={60 + i * 580} y={40} width={520} height={700} overflow="hidden">
          <Mascot character={c} emotion="calm" x={(520 - MASCOT_W * 1.15) / 2} y={30} scale={1.15} uid={`l${i}`} />
        </svg>
      ))}
    </svg>
  </AbsoluteFill>
);

const g = (el: React.FC<any>) => (props: any) => <FontGate>{React.createElement(el, props)}</FontGate>;

export const Root: React.FC = () => (
  <>
    <Composition id="Reel" component={g(Reel)} width={1080} height={1920} fps={30} durationInFrames={DURATION} />
    <Composition id="MascotStill" component={g(MascotStill)} width={1080} height={1920} fps={30} durationInFrames={1} defaultProps={{ character: "r", emotion: "joy" }} />
    <Composition id="MascotSheet" component={g(MascotSheet)} width={1800} height={1320} fps={30} durationInFrames={1} defaultProps={{ character: "r" }} />
    <Composition id="MascotLineup" component={g(MascotLineup)} width={1800} height={760} fps={30} durationInFrames={1} />
  </>
);
