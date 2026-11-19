import React from "react";
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from "remotion";
import { Cap, CapCfg } from "./Flat";
import { BuyerView, OwnerView } from "./Views";
import { CFG, rgba } from "./cfg";
import { PAL } from "./setgeo";
import { easeOut, ACCEPT_BOX, BUYER_FROM, CARD_AT, END, FIN_CAP, FIN_CAPTION, FIN_FROM, FIN_ROW, FIN_TAP, FIN_WIDE, HOOK_CAM, HOOK_CAPTION, ROW0, ROW1, TAP_OWNER, ownerShotAt, smooth } from "./scenes";
import { FCam, mixCam } from "./flatgeo";

// The finished reel (the template, from Scent Harbor look16): hook, the client's path, the owner accepts the order, the card on the track's phrase change.
// Music: config.json «music», cut and normalised by scripts/music_cut.py (-14 LUFS) into public/audio/reel.wav.
// Every ramp is eased (smooth / glide); nothing linear. Screens are real captures of the AD_CAPTURE mock-up.
const glide = (t: number, t0: number, t1: number) => { const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
/** a line with one phrase in the accent colour */
const accentIn = (line: string, phrase: string, color: string) => {
  const i = phrase ? line.indexOf(phrase) : -1;
  return i < 0 ? line : <>{line.slice(0, i)}<span style={{ color }}>{phrase}</span>{line.slice(i + phrase.length)}</>;
};
export const END_FRAMES = Math.round(END * 30);

/** the owner's finale: the phone on the table under the owner's caption, the tap on the accept button on a beat,
 *  then the order's row across the frame (the accepted status filled) until the card */
const OwnerFinal: React.FC<{ t: number; mask?: boolean }> = ({ t, mask }) => {
  let cam: FCam = mixCam(FIN_WIDE, FIN_TAP, glide(t, FIN_FROM + 0.08, FIN_FROM + 0.75));
  cam = mixCam(cam, FIN_ROW, glide(t, ROW0, ROW1));
  const k = Math.round((t - TAP_OWNER) * 30);
  const shot = t < TAP_OWNER ? "owner_orders" : k <= 21 ? "owner_acc_" + String(k).padStart(2, "0") : "owner_accepted";
  const ring = smooth((t - (TAP_OWNER - 0.14)) / 0.14), out = smooth((t - (TAP_OWNER + 0.06)) / 0.14);
  const cin = easeOut((t - FIN_CAP.at0) / 0.25), capOp = cin * (1 - smooth((t - FIN_CAP.at1) / 0.15));
  return <OwnerView st={{ id: "f", t, kind: "owner", label: "", shot, cam, caption: FIN_CAPTION, tap: { ring, out } }} capOpacity={capOp} capRise={(1 - cin) * 0.3 * FIN_CAPTION.size} mask={mask} />;
};

const LOGO_W = CFG.card.logoPx[0] * (CFG.card.logoInkWidth / (CFG.card.logoPx[0] - 16)); // the word (ink) logoInkWidth px wide
const CARD_LINES = { tagline: CFG.card.tagline, action: CFG.card.action, phone: CFG.card.contact };
/** the card: the scene behind dims under the palette's veil, the logo lands on the phrase change, the lines rise on half
 *  beats. Texts, places and timing are the same in every variant; colours follow the palette. */
export const Card16: React.FC<{ t: number; mask?: boolean }> = ({ t, mask }) => {
  const dim = smooth((t - (CARD_AT - 0.25)) / 0.25);
  if (dim <= 0) return null;
  const B = 60 / 122.033, k = (d: number) => easeOut((t - CARD_AT - d) / 0.25); void B; // look16 review: the number from the first beat
  const line = (d: number, el: React.ReactNode) => <div style={{ opacity: k(d), transform: `translateY(${((1 - k(d)) * 24).toFixed(1)}px)` }}>{el}</div>;
  const white = (c: string) => (mask ? "#fff" : c);
  return (
    <AbsoluteFill style={{ background: mask ? "#000" : rgba(PAL.veil, +(0.58 * dim).toFixed(3)) }}>
      <div style={{ position: "absolute", left: 80, top: 380, width: 920 }}>
        <div style={{ opacity: k(0), transform: `scale(${(0.94 + 0.06 * k(0)).toFixed(3)})`, transformOrigin: "0 100%" }}>
          {/* the studio's logo (config.json card.logo, a transparent PNG made by scripts/logo_alpha.py): shape and colour as given, on the card only */}
          <Img src={staticFile(CFG.card.logo)} style={{ display: "block", width: LOGO_W, height: LOGO_W * (CFG.card.logoPx[1] / CFG.card.logoPx[0]), marginLeft: -8 * (LOGO_W / CFG.card.logoPx[0]), filter: mask ? "brightness(0) invert(1)" : undefined }} />
        </div>
        <div style={{ height: 44 }} />
        {line(0.04, <div style={{ fontFamily: "Jost", fontWeight: 600, fontSize: 84, lineHeight: 1.04, color: white(PAL.capText) }}>{CARD_LINES.tagline.map((l, i) => <div key={i}>{accentIn(l, CFG.card.taglineAccent, white(PAL.capAccent))}</div>)}</div>)}
        <div style={{ height: 56 }} />
        {line(0.08, <div style={{ fontFamily: "Playfair Display", fontWeight: 500, fontSize: 72, lineHeight: 1.15, color: white(PAL.capText) }}>{CARD_LINES.action}</div>)}
        <div style={{ height: 18 }} />
        {line(0.12, <div style={{ fontFamily: "Jost", fontWeight: 600, fontSize: 84, lineHeight: 1.1, letterSpacing: 1, color: white(PAL.capAccent) }}>{CARD_LINES.phone}</div>)}
      </div>
    </AbsoluteFill>
  );
};

export const Reel16: React.FC<{ mask?: boolean; audio?: boolean }> = ({ mask, audio = true }) => {
  const f = useCurrentFrame(), t = f / 30;
  let scene: React.ReactNode;
  if (t < BUYER_FROM) {
    const u = Math.min(1, t / 1.9), e = u * u * (3 - 2 * u);
    const capOpacity = 1 - smooth((t - (BUYER_FROM - 0.12)) / 0.12);
    scene = <OwnerView st={{ id: "h", t, kind: "owner", label: "", shot: ownerShotAt(t), cam: HOOK_CAM(e), caption: HOOK_CAPTION }} capOpacity={capOpacity} mask={mask} />;
  } else if (t < FIN_FROM) scene = <BuyerView t={t - BUYER_FROM} mask={mask} />;
  else scene = <OwnerFinal t={t} mask={mask} />;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {/* look16 review: no black slide; the scene stays behind the card, blurred and darkened by depth */}
      <AbsoluteFill style={{ filter: t >= CARD_AT - 0.25 && !mask ? `blur(${(26 * smooth((t - (CARD_AT - 0.25)) / 0.25)).toFixed(1)}px) brightness(${(1 - (PAL.dark ? 0.35 : 0) * smooth((t - (CARD_AT - 0.25)) / 0.25)).toFixed(3)})` : undefined }}>{scene}</AbsoluteFill>
      <Card16 t={t} mask={mask} />
      {audio && !mask ? <Audio src={staticFile("audio/reel.wav")} /> : null}
    </AbsoluteFill>
  );
};

/** the cover: the owner's phone with the new order, dimmed, and the offer large enough for a 120 px tile */
export const COVER_TITLE: CapCfg = { lines: CFG.cover.lines, x: 90, y: 600, size: 128 };
export const Cover16: React.FC<{ mask?: boolean }> = ({ mask }) => (
  <AbsoluteFill style={{ background: "#000" }}>
    {mask ? null : <OwnerView st={{ id: "c", t: 1.2, kind: "owner", label: "", shot: ownerShotAt(1.2), cam: HOOK_CAM(0.5) }} />}
    {mask ? null : <AbsoluteFill style={{ background: `linear-gradient(180deg, ${rgba(PAL.veil, 0.55)} 0%, ${rgba(PAL.veil, 0.78)} 30%, ${rgba(PAL.veil, 0.78)} 66%, ${rgba(PAL.veil, 0.35)} 100%)` }} />}
    <Cap c={COVER_TITLE} mask={mask} />
    <Img src={staticFile(CFG.card.logo)} style={{ position: "absolute", left: 90, top: 1240, width: 320, height: 320 * (CFG.card.logoPx[1] / CFG.card.logoPx[0]), filter: mask ? "brightness(0) invert(1)" : undefined }} />
  </AbsoluteFill>
);
