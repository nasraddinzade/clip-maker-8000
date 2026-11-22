// Экраны внутри карточек, пересобранные в React: переписка, заявка с кнопкой, пост. Тексты из config.json (screens).
// Весь текст экранов не меньше 50 px (Inter, высота заглавных около 36 px = 12 px в масштабе 360).
import React from "react";
import { Img, staticFile } from "remotion";
import { INK } from "../mascot/config";
import { ramp } from "./data";
import { C, UI, pressScale } from "./ui";
import { THEME } from "../theme";

const FS = 50;

export const Header: React.FC<{ left: React.ReactNode; right?: React.ReactNode }> = ({ left, right }) => (
  <div style={{ position: "absolute", left: 0, top: 0, right: 0, height: 104, borderBottom: THEME.cardStyle === "soft" ? `3px solid ${THEME.cardBorder}` : `6px solid ${INK}`, background: THEME.headerBg, display: "flex", alignItems: "center", padding: "0 30px", boxSizing: "border-box", fontFamily: UI, fontSize: FS, fontWeight: 700, color: INK }}>
    <div style={{ flex: 1, whiteSpace: "nowrap" }}>{left}</div>
    {right && <div style={{ whiteSpace: "nowrap", fontWeight: 600, color: C.mute }}>{right}</div>}
  </div>
);

export type Msg = { from: "client" | "helper"; text: string; at: number; typing?: number }; // typing: сколько секунд до сообщения видны три точки

// Пузырь сообщения: въезжает снизу и раскрывается из угла, у помощника перед этим три точки «печатает».
const Bubble: React.FC<{ m: Msg; t: number; fade?: number }> = ({ m, t, fade = 1 }) => {
  const lead = m.typing ?? (m.from === "helper" ? 0.55 : 0);
  const typing = t >= m.at - lead && t < m.at;
  const p = ramp(t, m.at, 0.3);
  const mine = m.from === "helper";
  const style: React.CSSProperties = {
    alignSelf: mine ? "flex-end" : "flex-start", maxWidth: 760, padding: "10px 26px 12px", borderRadius: 30,
    borderBottomRightRadius: mine ? 8 : 30, borderBottomLeftRadius: mine ? 30 : 8,
    background: mine ? THEME.fill : C.sky, border: `5px solid ${mine ? THEME.fill : INK}`, fontFamily: UI, fontWeight: 600, fontSize: FS, lineHeight: 1.12, color: mine ? "#FFFFFF" : INK,
    transformOrigin: mine ? "100% 100%" : "0% 100%",
  };
  if (typing) {
    const k = Math.floor((t - (m.at - 0.55)) * 7) % 3;
    return (
      <div style={{ ...style, display: "flex", gap: 12, padding: "22px 30px" }}>
        {[0, 1, 2].map((i) => <div key={i} style={{ width: 18, height: 18, borderRadius: 9, background: mine ? "#FFFFFF" : INK, opacity: i === k ? 1 : 0.3 }} />)}
      </div>
    );
  }
  if (t < m.at) return null;
  return <div style={{ ...style, opacity: p * fade, transform: `scale(${0.92 + 0.08 * p}) translateY(${(1 - p) * 20}px)` }}>{m.text}</div>;
};

// Переписка: новые сообщения снизу, старые уезжают вверх (scroll задаётся снаружи числом пикселей).
// старые сообщения (old первых) гаснут до прокрутки, чтобы не срезаться под шапкой
export const ChatScreen: React.FC<{ msgs: Msg[]; t: number; scroll?: number; old?: number; oldFade?: number; header: { name: string; channel: string; time: string } }> = ({ msgs, t, scroll = 0, old = 0, oldFade = 1, header }) => (
  <>
    <div style={{ position: "absolute", left: 28, right: 28, top: 122 - scroll, display: "flex", flexDirection: "column", gap: 14 }}>
      {msgs.map((m, i) => <Bubble key={i} m={m} t={t} fade={i < old ? oldFade : 1} />)}
    </div>
    <Header left={<span>{header.name} <span style={{ color: C.mute, fontWeight: 600 }}>· {header.channel}</span></span>} right={header.time} />
  </>
);

// Заявка в кабинете владельца: строки по словам голоса, кнопка «Принять».
export const OrderScreen: React.FC<{ t: number; rows: { text: string; at: number }[]; tap: number; accepted: number; header: string; headerRight: string; button: string; done: string }> = ({ t, rows, tap, accepted, header, headerRight, button, done: doneText }) => {
  const done = t >= accepted;
  return (
    <>
      <Header left={header} right={headerRight} />
      <div style={{ position: "absolute", left: 34, top: 116, right: 34, fontFamily: UI, fontSize: FS, color: INK }}>
        {rows.map((r, i) => {
          const p = ramp(t, r.at, 0.3);
          return (
            <div key={i} style={{ height: 68, display: "flex", alignItems: "center", fontWeight: i === 0 ? 700 : 600, opacity: p, transform: `translateX(${(1 - p) * -24}px)`, borderBottom: i < rows.length - 1 ? `3px dashed ${C.deskLine}` : "none" }}>{r.text}</div>
          );
        })}
      </div>
      <div style={{ position: "absolute", right: 34, bottom: 26, width: 400, height: 108, borderRadius: 26, border: `6px solid ${INK}`, background: done ? C.brass : C.sage, color: "#FFFFFF", fontFamily: UI, fontWeight: 700, fontSize: 54, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pressScale(t, tap)})`, boxShadow: `0 8px 0 ${INK}`, boxSizing: "border-box" }}>
        {done ? doneText : button}
      </div>
    </>
  );
};

// Картинка поста по умолчанию (пример ai-helper-01): плоский медовик в цветах темы, нарисован в коде. Своя картинка: screens[].picture в config.json (PNG в public/).
export const CakeArt: React.FC<{ w: number; h: number }> = ({ w, h }) => (
  <svg width={w} height={h} viewBox="0 0 800 300" style={{ background: C.orangeSoft }}>
    <rect width={800} height={300} fill={C.orangeSoft} />
    {Array.from({ length: 9 }, (_, i) => <circle key={i} cx={60 + i * 90} cy={40 + (i % 2) * 210} r={10} fill="#FFFFFF" />)}
    <ellipse cx={400} cy={262} rx={250} ry={26} fill="#FFFFFF" stroke={INK} strokeWidth={7} />
    <g stroke={INK} strokeWidth={7} strokeLinejoin="round">
      <path d="M210,250 L210,120 L560,96 L590,120 L590,250 Z" fill={C.terra} />
      {[0, 1, 2, 3].map((k) => <path key={k} d={`M210,${136 + k * 30} L590,${136 + k * 30}`} stroke="#FFFFFF" strokeWidth={10} />)}
      <path d="M210,250 L210,120 L560,96 L590,120 L590,250 Z" fill="none" />
      <path d="M210,120 L560,96 L590,120 L240,144 Z" fill="#E0835F" />
    </g>
    {[300, 390, 480].map((x, i) => <circle key={x} cx={x} cy={104 - i * 6} r={14} fill="#FFFFFF" stroke={INK} strokeWidth={6} />)}
  </svg>
);

// Готовый пост: картинка встаёт на «соцсети», подпись печатается на «Готовит посты», «Одобрить» на «одобряете».
export const PostScreen: React.FC<{ t: number; imgAt: number; textAt: number; tap: number; approved: number; header: string; caption: string; button: string; done: string; picture?: string }> = ({ t, imgAt, textAt, tap, approved, header, caption, button, done: doneText, picture }) => {
  const img = ramp(t, imgAt, 0.4);
  const typed = Math.max(0, Math.min(caption.length, Math.floor((t - textAt) / 0.05)));
  const btn = ramp(t, textAt + caption.length * 0.05, 0.3);
  const done = t >= approved;
  return (
    <>
      <Header left={header} right={done ? "одобрен" : typed < caption.length ? "готовлю" : "готов"} />
      <div style={{ position: "absolute", left: 28, right: 28, top: 122, height: 180, borderRadius: 20, overflow: "hidden", border: `5px solid ${INK}`, opacity: img, transform: `scale(${0.96 + 0.04 * img})` }}>
        {picture ? <Img src={staticFile(picture)} style={{ width: 826, height: 180, objectFit: "cover" }} /> : <CakeArt w={826} h={180} />}
      </div>
      <div style={{ position: "absolute", left: 34, top: 316, fontFamily: UI, fontWeight: 700, fontSize: FS, color: INK, whiteSpace: "nowrap" }}>
        {caption.slice(0, typed)}{typed > 0 && typed < caption.length && <span style={{ display: "inline-block", width: 4, height: 50, marginLeft: 3, background: INK, verticalAlign: "-6px" }} />}
      </div>
      <div style={{ position: "absolute", right: 34, bottom: 26, width: 360, height: 108, borderRadius: 26, border: `6px solid ${INK}`, background: done ? C.brass : C.sage, color: "#FFFFFF", fontFamily: UI, fontWeight: 700, fontSize: 54, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${pressScale(t, tap)})`, boxShadow: `0 8px 0 ${INK}`, boxSizing: "border-box", opacity: btn }}>
        {done ? doneText : button}
      </div>
    </>
  );
};

// Рубашка карточки для хука: номер и знак дела.
export const CardBack: React.FC<{ n: number; icon: "chat" | "order" | "post" }> = ({ n, icon }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
    <svg width={150} height={130} viewBox="0 0 150 130">
      <g fill={C.card} stroke={INK} strokeWidth={8} strokeLinejoin="round">
        {icon === "chat" && <path d="M20,20 H130 Q140,20 140,30 V82 Q140,92 130,92 H62 L34,116 L40,92 H20 Q10,92 10,82 V30 Q10,20 20,20 Z" fill={C.sky} />}
        {icon === "order" && <><rect x={30} y={10} width={90} height={112} rx={10} fill="#FFFFFF" /><path d="M48,44 H102 M48,66 H102 M48,88 H84" /></>}
        {icon === "post" && <><rect x={12} y={18} width={126} height={96} rx={12} fill={C.orangeSoft} /><path d="M30,100 L62,62 L84,86 L100,70 L124,100 Z" fill={C.terra} /><circle cx={104} cy={44} r={11} fill={INK} /></>}
      </g>
    </svg>
    <div data-role="caption" style={{ fontFamily: "Rubik", fontWeight: 900, fontSize: 96, color: INK, lineHeight: 1 }}>{n}</div>
  </div>
);
