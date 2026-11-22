// Ролик «маскот плюс подборка»: хук, N шагов с карточками экранов, финал, карточка контакта.
// Все тексты и привязки к голосу в config.json. Кадр = чистая функция номера кадра.
import React from "react";
import { AbsoluteFill, Audio, Img, continueRender, delayRender, getInputProps, staticFile, useCurrentFrame } from "remotion";
import { audit } from "./audit";
import { fontsReady } from "../fonts";
import { EmotionId } from "../mascot/config";
import { Mascot } from "../mascot/Mascot";
import { CFG, EASE_IO, FPS, ScreenCfg, StickerCfg, at, life, ramp, scene, snapBeat, speaking, wordAt } from "./data";
import { CardBack, ChatScreen, Msg, OrderScreen, PostScreen } from "./screens";
import { Backdrop, C, Card, DeskProps, HEAD, StepLabel, Sticker, TapRing, Title } from "./ui";

const N = CFG.steps.length;
const STEPS = CFG.steps.map((_, i) => scene(`step${i + 1}`));
const HOOK = scene("hook"), FIN = scene("final"), CARDS = scene("card");
const STEP_WORD = CFG.steps.map((s, i) => wordAt(s.marker, i === 0 ? 0 : STEPS[i - 1].start).s);
const CARD = CFG.layout.card;
const STICK = CFG.layout.sticker;

// ---------- маскот ----------
const MOOD: [number, EmotionId][] = CFG.mood.map(([a, e]) => [at(a), e as EmotionId]);
MOOD.sort((x, y) => x[0] - y[0]);
const moodAt = (t: number) => (MOOD.filter(([s]) => s <= t).pop() ?? MOOD[0])[1];
const RINGS = CFG.rings.map(at);
const ringAt = (t: number) => Math.max(0, ...RINGS.map((r) => (t >= r ? 1 - ramp(t, r + 0.5, 0.6) : 0)));
const PRESS = CFG.press ? at(CFG.press) : -1;

const Host: React.FC<{ t: number }> = ({ t }) => {
  const emo = moodAt(t);
  const blinkPhase = (t + 0.7) % 3.3;
  const blink = blinkPhase < 0.14 ? Math.sin((blinkPhase / 0.14) * Math.PI) : 0;
  const talk = speaking(t) && Math.floor(t * 9) % 2 === 0 && (emo === "calm" || emo === "think");
  const s = CFG.mascot.scale, y = 1248 - 440 * s; // лицо (до рта) не ниже 1248
  return (
    <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, zIndex: 20, overflow: "visible" }}>
      <g data-role="mascot"><Mascot character={CFG.mascot.character} emotion={emo} x={CFG.mascot.x} y={y} scale={s} blink={blink} ring={ringAt(t)} press={t >= PRESS && t < PRESS + 0.2 ? 1 : 0} face={talk ? { mouth: "talk" } : undefined} uid="host" /></g>
    </svg>
  );
};

// ---------- наклейки ----------
const StickerAt: React.FC<{ s: StickerCfg; t: number; dx?: number }> = ({ s, t }) => {
  const until = s.until ? at(s.until) : Infinity;
  return <Sticker text={s.text} x={STICK.x + (s.dx ?? 0)} y={STICK.y} t={t < until ? t : -1} t0={snapBeat(at(s.at))} seed={s.seed ?? 7} rot={s.rot ?? -7}
    color={s.dark ? C.ink : undefined} textColor={s.dark ? "#FFFFFF" : undefined} />;
};

// ---------- веер карточек «1 2 3» (хук и финал рифмуются) ----------
const Fan: React.FC<{ t: number; hopAt?: number; inAt?: number }> = ({ t, hopAt, inAt }) => {
  const icons = CFG.hook.fan?.icons ?? ["chat", "order", "post"];
  return (
    <>
      {icons.map((icon, i) => {
        const hop = hopAt === undefined ? 0 : ramp(t, hopAt + i * 0.13 - i * i * 0.02, 0.18) - ramp(t, hopAt + i * 0.13 + 0.2, 0.3, EASE_IO);
        const p = inAt === undefined ? 1 : ramp(t, inAt + 0.1 + i * 0.12 - i * i * 0.02, 0.35);
        const x0 = 410 + i * 175 - (icons.length - 3) * 88;
        return (
          <Card key={i} x={x0} y={650 + Math.abs(i - (icons.length - 1) / 2) * 26 - hop * 46} w={250} h={330} p={p} rot={(i - (icons.length - 1) / 2) * 9} z={i === Math.floor(icons.length / 2) ? 2 : 1}>
            <CardBack n={i + 1} icon={icon} />
          </Card>
        );
      })}
    </>
  );
};

const Hook: React.FC<{ t: number }> = ({ t }) => {
  const out = 1 - ramp(t, HOOK.end - 0.3, 0.3, EASE_IO);
  const h = CFG.hook, sw = h.swap;
  const swapAt = sw ? at(sw.at) : Infinity;
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      {/* кадр 0 обложка: заголовок-хук стоит без появления; на swap.at уходит, встаёт второй заголовок по словам голоса */}
      <div style={{ opacity: 1 - ramp(t, swapAt - 0.05, 0.2, EASE_IO) }}>
        <Title words={h.title.words} accent={h.title.accent} t={t} staticOn size={h.title.size ?? 124} top={h.title.top ?? 300} lines={h.title.lines} />
      </div>
      {sw && t >= swapAt - 0.05 && (
        <Title words={sw.words} times={sw.voice!.map((w, i) => wordAt(w, i === 0 ? swapAt - 0.3 : 0).s)} accent={sw.accent} t={t} size={sw.size ?? 108} top={sw.top ?? h.title.top ?? 300} lines={sw.lines} />
      )}
      {h.fan && <Fan t={t} hopAt={at(h.fan.at)} />}
      {(h.stickers ?? []).map((s, i) => <StickerAt key={i} s={s} t={t} />)}
    </div>
  );
};

// Экран в карточке: появление растворением со сдвигом до 60 px внутрь зоны, уход растворением с масштабом до 4 %
// (выезд за край выводит текст из зоны Reels: ai-helper-01, кадры 723–725).
const ScreenAt: React.FC<{ sc: ScreenCfg; t: number }> = ({ sc, t }) => {
  const enter = at(sc.enter), exit = sc.exit ? at(sc.exit) : 1e6; // без exit экран держится до конца шагов (Infinity ломает interpolate)
  if (sc.type === "chat") {
    const p = life(t, enter, exit, 0.4, 0.4);
    if (p <= 0.01) return null;
    const back = sc.back ? ramp(t, at(sc.back), 0.45, EASE_IO) : 0;
    const old = sc.scroll ? 1 - ramp(t, at(sc.scroll.fadeAt), 0.25, EASE_IO) : 1;
    const scroll = sc.scroll ? sc.scroll.px * ramp(t, at(sc.scroll.at), 0.4, EASE_IO) : 0;
    const msgs: Msg[] = sc.messages.map((m) => ({ from: m.from, text: m.text, at: at(m.at), typing: m.typing }));
    return (
      <div style={{ position: "absolute", inset: 0, transform: `translate(${-60 * back}px, ${-30 * back}px) scale(${1 - 0.08 * back})`, transformOrigin: "20% 50%", opacity: 1 - 0.55 * back }}>
        <Card x={CARD.x} y={CARD.y} w={CARD.w} h={sc.h ?? CARD.h} p={p} role="ui">
          <ChatScreen msgs={msgs} t={t} scroll={scroll} old={sc.scroll?.old ?? 0} oldFade={old} header={sc.header} />
        </Card>
      </div>
    );
  }
  const pin = ramp(t, enter, 0.45), pout = ramp(t, exit, 0.4, EASE_IO);
  if (pin <= 0 || pout >= 1) return null;
  const tap = at(sc.tap);
  const tapX = CARD.x + CARD.w - 34 - (sc.type === "order" ? 200 : 180), tapY = CARD.y + CARD.h - 26 - 56;
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - pin) * 60}px) scale(${1 - 0.04 * pout})`, transformOrigin: "50% 45%", opacity: pin * (1 - pout) }}>
      <Card x={CARD.x} y={CARD.y} w={CARD.w} h={CARD.h} role="ui">
        {sc.type === "order"
          ? <OrderScreen t={t} tap={tap} accepted={tap + 0.14} rows={sc.rows.map((r) => ({ text: r.text, at: at(r.at) }))} header={sc.header} headerRight={sc.headerRight} button={sc.button} done={sc.done} />
          : <PostScreen t={t} imgAt={at(sc.image)} textAt={at(sc.text)} tap={tap} approved={tap + 0.14} header={sc.header} caption={sc.caption} button={sc.button} done={sc.done} picture={sc.picture} />}
      </Card>
      <TapRing x={tapX} y={tapY} t={t} tap={tap} />
    </div>
  );
};

const Steps: React.FC<{ t: number }> = ({ t }) => {
  let k = 0;
  while (k < N - 1 && t >= STEPS[k + 1].start) k++;
  const cur = STEPS[k], cfg = CFG.steps[k];
  const fadeOut = 1 - ramp(t, STEPS[N - 1].end - 0.3, 0.3, EASE_IO);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: fadeOut }}>
      <StepLabel key={k} step={k + 1} total={N} t={t} t0={STEP_WORD[k]} />
      <Title key={`t${k}`} words={cur.title!.words} times={cur.title!.times} accent={cur.title!.accent} t={t} lines={cfg.title.lines} top={384} />
      {CFG.screens.map((sc, i) => <ScreenAt key={i} sc={sc} t={t} />)}
      {CFG.stickers.map((s, i) => <StickerAt key={i} s={s} t={t} />)}
    </div>
  );
};

const Final: React.FC<{ t: number }> = ({ t }) => {
  const out = 1 - ramp(t, CARDS.start - 0.25, 0.25, EASE_IO); // экран гаснет полностью до карточки
  const f = CFG.final;
  const times = f.title.voice!.map((w) => wordAt(w, FIN.start - 0.5).s);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <Title words={f.title.words} times={times} accent={f.title.accent} t={t} lines={f.title.lines} top={f.title.top ?? 300} />
      {f.fan && <Fan t={t} inAt={FIN.start} />}
    </div>
  );
};

// Карточка контакта: тонкий Rubik 400, каналы 500 с чертой, воздух между строками, номер с цифрами одной ширины.
// Кегль не меньше 86 (заглавные 20 px в 360). Строк текста до трёх плюс номер.
const ContactCard: React.FC<{ t: number }> = ({ t }) => {
  const p = ramp(t, CARDS.start, 0.4);
  const line: React.CSSProperties = { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: HEAD, fontWeight: 400, fontSize: 86, color: C.ink, lineHeight: 1.1, letterSpacing: 0.5 };
  const mark: React.CSSProperties = { fontWeight: 500, background: `linear-gradient(${C.orange}, ${C.orange}) left bottom / 100% 8px no-repeat`, paddingBottom: 10 };
  const lines = CFG.card.lines;
  return (
    <div data-role="caption" style={{ position: "absolute", inset: 0, opacity: p }}>
      <Card x={72} y={290} w={888} h={750} p={p}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", justifyContent: "center" }}>
          <Img src={staticFile(CFG.card.logo)} style={{ width: 380 }} />
        </div>
        {lines.map((ln, i) => (
          <div key={i} style={{ ...line, top: 214 + i * 108 }}>
            {ln.map((part, j) => (typeof part === "string" ? <React.Fragment key={j}>{part}</React.Fragment> : <span key={j} style={mark}>{part.mark}</span>))}
          </div>
        ))}
        <div style={{ position: "absolute", left: 300, right: 300, top: 578, height: 3, borderRadius: 2, background: "#D6E2F3" }} />
        <div style={{ ...line, top: 614, fontVariantNumeric: "tabular-nums", letterSpacing: 1 }}>{CFG.card.contact}</div>
      </Card>
    </div>
  );
};

export const Reel: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  // аудит текста кадра (только при --props='{"audit":true}'): печатает все текстовые узлы с рамками в лог
  const [h] = React.useState(() => (getInputProps().audit ? delayRender("audit") : null));
  React.useEffect(() => {
    if (h === null) return;
    // ждём загрузки шрифтов ролика (общий промис из src/fonts.ts) и два кадра раскладки
    fontsReady.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))).then(() => { audit(frame); continueRender(h); });
  }, [h, frame]);
  const mix = (getInputProps() as { mix?: string }).mix ?? CFG.music.mix;
  return (
    <AbsoluteFill style={{ background: C.paper }}>
      <Backdrop />
      <DeskProps t={t} />
      {t < HOOK.end && <Hook t={t} />}
      {t >= STEPS[0].start && t < STEPS[N - 1].end && <Steps t={t} />}
      {t >= FIN.start && t < CARDS.start && <Final t={t} />}
      {t >= CARDS.start && <ContactCard t={t} />}
      {!getInputProps().hideHost && <Host t={t} />}
      {!getInputProps().audit && !getInputProps().silent && <Audio src={staticFile(`audio/mix_${mix}.wav`)} />}
    </AbsoluteFill>
  );
};
