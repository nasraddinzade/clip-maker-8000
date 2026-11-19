import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Cap, FlatDevice, FlatShadows, FlatTable, TapRing, vpLayer } from "./Flat";
import { scaleAt } from "./flatgeo";
import { ACCEPT_AT, ACCEPT_BOX, BPH, BUY_WOOD, OWN_WOOD, BUYER_FROM, HOOK_CAM, HOOK_CAPTION, OWN, STILLS13, Still13, TAB, TABLET_BTN, TABLET_TAP, buyerAt, ownerShotAt, smooth } from "./scenes";

// look13 storyboard and hook test: devices lying on the stone table, the camera above. Every screen is a real capture
// of the mock-up (AD_CAPTURE build); nothing is drawn on a screen except the tap ring.
export const OwnerView: React.FC<{ st: Still13; capOpacity?: number; capRise?: number; mask?: boolean }> = ({ st, capOpacity = 1, capRise = 0, mask }) => {
  const cam = st.cam!;
  const cap = st.caption ? <Cap c={st.caption} opacity={capOpacity} rise={capRise} mask={mask} /> : null;
  if (mask) return <AbsoluteFill style={{ background: "#000" }}>{cap}</AbsoluteFill>;
  const R = scaleAt(OWN, cam);
  const ring = st.tap ? <TapRing at={ACCEPT_AT} ring={st.tap.ring} out={st.tap.out} R={40} ps={R} box={ACCEPT_BOX} /> : null;
  return (
    <AbsoluteFill>
      <FlatTable cam={cam} origin={OWN_WOOD} />
      <FlatShadows cam={cam} devs={[OWN]} />
      <FlatDevice d={OWN} cam={cam} layers={vpLayer("dev/tablet", st.shot!, 844)} overlay={ring} />
      {cap}
    </AbsoluteFill>
  );
};

export const BuyerView: React.FC<{ t: number; mask?: boolean }> = ({ t, mask }) => {
  const s = buyerAt(t);
  const cap = <>{s.captions.map((k, i) => (k.opacity > 0.001 ? <Cap key={i} c={k.c} opacity={k.opacity} rise={k.rise} mask={mask} /> : null))}</>;
  if (mask) return <AbsoluteFill style={{ background: "#000" }}>{cap}</AbsoluteFill>;
  const R = scaleAt(TAB, s.cam);
  return (
    <AbsoluteFill>
      <FlatTable cam={s.cam} origin={BUY_WOOD} />
      <FlatShadows cam={s.cam} devs={[TAB, BPH]} />
      <FlatDevice d={TAB} cam={s.cam} layers={vpLayer("dev/tablet", s.tabletShot, 1180)} overlay={<TapRing at={TABLET_TAP} ring={s.tap.ring} out={s.tap.out} R={46} ps={R} box={TABLET_BTN} />} />
      <FlatDevice d={BPH} cam={s.cam} layers={vpLayer("dev/phone", s.phoneShot, 844)} />
      {cap}
    </AbsoluteFill>
  );
};

export const Board13: React.FC<{ mask?: boolean }> = ({ mask }) => {
  const st = STILLS13[Math.min(STILLS13.length - 1, useCurrentFrame())];
  return st.kind === "owner" ? <OwnerView st={st} mask={mask} /> : <BuyerView t={st.t - BUYER_FROM} mask={mask} />;
};

// the hook's motion test (0-2.3 s, no sound): one real capture of the owner's dashboard per reel frame from the moment
// the order reaches the phone (0.3 s), a slow push; at 2.0 s the cut to the buyer's phone
export const Hook13: React.FC<{ mask?: boolean }> = ({ mask }) => {
  const f = useCurrentFrame(), t = f / 30;
  if (t >= BUYER_FROM) return <BuyerView t={t - BUYER_FROM} mask={mask} />;
  const u = Math.min(1, t / 2.2), e = u * u * (3 - 2 * u);
  const capOpacity = 1 - smooth((t - 2.15) / 0.15); // look15: eased, no linear fade
  return <OwnerView st={{ id: "h", t, kind: "owner", label: "", shot: ownerShotAt(t), cam: HOOK_CAM(e), caption: HOOK_CAPTION }} capOpacity={capOpacity} mask={mask} />;
};
