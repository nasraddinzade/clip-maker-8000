// The template's scenes and storyboard (from Scent Harbor look16) (no React; shared with the box export), by the template reference/ad-template-site-order.md.
// Two tables of the same dark wood, seen from above, nothing on them but the devices (decision of the person, look14):
//   the owner's: his phone lying screen up; the buyer's: the tablet and the buyer's phone side by side.
// One order on both devices: the tablet places №1048, the same order (same time) reaches the owner's phone. The buyer
// sees «Заказ №1048 оформлен», status «Новый»; «Принят» only after the owner taps «Принять».
//   0-2.3 s    hook: the owner's phone large, «Сайт, который принимает заказы»; at 0.3 s the notice, then the row
//   2.3-6.65   the buyer: phone under «Клиент заказывает сам», wide on both devices, the cart under «Закажут и с
//              планшета», the tap, the filled form, «Заказ №1048 оформлен»
//   6.65-10.2  the owner: «Вы видите каждый заказ» over the phone, then closer and from another angle he taps
//              «Принять»: «Новый» -> «ПРИНЯТ», held 0.9 s
import { Spec } from "./devices";
import { BH, BW, FCam, FDev, camLook, mixCam } from "./flatgeo";
import { CM } from "./setgeo";
import { CFG } from "./cfg";
const LY = CFG.layout;

const env = (k: string, d: number) => Number(process.env[k] || d);
const PB = 0.5, TB = 0.585; // world px per CSS px: phone body 15 x 7.2 cm, tablet body 25.3 x 17.9 cm (11-inch tablet)
export const PHONE: Spec = { id: "phone", dir: "dev/phone", dsf: 4, sw: 390, sh: 844, bez: [13, 13, 13, 13], radius: 0.125, depth: 0.095, header: 65, base: PB, world: [0, 0, 0] };
export const OWNER_SPEC: Spec = { ...PHONE, dir: "dev/tablet", dsf: 3 }; // the owner's phone is captured in the tablet run (one order on both) // the owner's phone: captured in the tablet's run
export const TABLET: Spec = { id: "tablet", dir: "dev/tablet", dsf: 3, sw: 820, sh: 1180, bez: [26, 26, 26, 26], radius: 0.06, depth: 0.03, header: 81, base: TB, world: [0, 0, 0] };

// ---------- the owner's table ----------
export const OWN: FDev = { spec: OWNER_SPEC, x: 0, z: 1150, yaw: env("OYAW", -0.5), thick: 0.8 * CM };
// the wood under each table: where the photo's top-left corner lies (world x, far z); the photo (2260 x 1507 world px)
// lies under the devices at full resolution; the owner's phone lies on another part of it than the buyer's devices
export const OWN_WOOD = { x: env("OWX", -1600), z: 1150 + 760 };
export const BUY_WOOD = { x: env("BWX", -900), z: 1150 + 800 };
// look15 (decision): the offer says who makes it; 50 px: its capitals 12.3 px at 360 (measured on the mask)
export const HOOK_CAPTION = { lines: CFG.captions.hook.lines, x: 70, y: 272, size: env("CAPS", CFG.captions.size), accent: CFG.captions.hook.accent as [number, number][] };
export const FIN_CAPTION = { lines: CFG.captions.owner.lines, x: 70, y: 272, size: env("CAPS", CFG.captions.size), accent: CFG.captions.owner.accent as [number, number][] };
// the hook: the notice (CSS y 90) just under the caption, the row №1048 and its button above 65 % of the frame
export const HOOK_CAM = (push = 0): FCam => camLook(OWN, LY.ownerHookAnchor[0], LY.ownerHookAnchor[1], env("HX", 508), env("HY", 740) + env("HPY", -12) * push, env("HS", 2.3) + env("HPS", 0.03) * push, env("HP", 72));
// the finale: the phone small under «Вы видите каждый заказ»; then straight above the row №1048 (80 degrees, the hook
// looks at the top of the screen from 72), the tap on «Принять», «ПРИНЯТ» read for 0.9 s, then the card (look15: no
// pull-back, decision)
export const FIN_WIDE: FCam = camLook(OWN, LY.ownerWideAnchor[0], LY.ownerWideAnchor[1], env("FWX", 470), env("FWY", 1180), env("FWS", 1.25), env("FWP", 60));
export const FIN_CLOSE: FCam = camLook(OWN, LY.ownerTapAnchor[0], LY.ownerTapAnchor[1], env("FCX", 546), env("FCY", 588), env("FCS", 2.42), env("FCP", 80));
export const FIN_END: FCam = camLook(OWN, LY.ownerWideAnchor[0], LY.ownerWideAnchor[1], env("FEX", 560), env("FEY", 980), env("FES", 1.45), env("FEP", 64));
export const ACCEPT_AT: [number, number] = [LY.acceptBox[0] + LY.acceptBox[2] / 2, LY.acceptBox[1] + LY.acceptBox[3] / 2];
export const ACCEPT_BOX = LY.acceptBox; // the owner's «accept» button (CSS px of the capture)

// ---------- the buyer's table ----------
export const TAB: FDev = { spec: TABLET, x: 0, z: 1150, yaw: env("TYAW", 2.5), thick: 0.6 * CM };
const tw = BW(TABLET) * TB, pw = BW(PHONE) * PB, th = BH(TABLET) * TB, phh = BH(PHONE) * PB;
export const BPH: FDev = { spec: PHONE, x: tw / 2 + env("PGAP", 8) * CM + pw / 2, z: 1150 - (th - phh) / 2 + env("PDZ", 6) * CM, yaw: env("PYAW", -7), thick: 0.8 * CM };
// camera keys (local time of the buyer part)
const K0 = camLook(BPH, LY.phoneAnchor[0], LY.phoneAnchor[1], env("K0X", 500), env("K0Y", 905), env("K0S", 0.95), env("K0P", 66)); // the product: title and price
// look15 (review: the caption stood over a still card): the shot starts wider and the camera moves in on the phone
const K0W = camLook(BPH, LY.phoneAnchor[0], LY.phoneAnchor[1], env("K0WX", 470), env("K0WY", 930), env("K0WS", 0.85), env("K0WP", 62));
const K1 = camLook(TAB, 410, 590, env("K1X", 280), env("K1Y", 1000), env("K1S", 0.64), 60); // wide: both devices
// look15 (review: an empty lower third): the cart closer, the tablet runs out under the platform's lower band
const K2 = camLook(TAB, LY.cartAnchor[0], LY.cartAnchor[1], env("K2X", 600), env("K2Y", 1192), env("K2S", 0.82), env("K2P", 64)); // the cart: total and «Оформить заказ»
const K3 = camLook(TAB, LY.orderTitleAnchor[0], LY.orderTitleAnchor[1], env("K3X", 110), env("K3Y", 740), env("K3S", 1.52), env("K3P", 64)); // «Заказ №1048 оформлен», the whole width
// look16 (decision): the result held 1.8 s with a slow push from the title down to «Итого»
const K3B = camLook(TAB, LY.orderTotalAnchor[0], LY.orderTotalAnchor[1], env("K3BX", 115), env("K3BY", 1000), env("K3BS", 1.62), env("K3P", 64));
// look16: on the beats of the track (T = 0.4917 s): the push-in on the phone 0-1T, back to the wide plan 1T-2T, the
// wide plan holds 2T-3T, into the cart 3T-3T+0.6 (decision 0.6 s), the tap on beat 5T, the form 5T+0.07..6T, the
// order page on beat 6T, held 1.8 s with a slow push to «Итого» (decision)
export const BEAT = 60 / CFG.music.bpm;
export const TL = { push1: BEAT, back0: BEAT, back1: 2 * BEAT, into0: 3 * BEAT, into1: 3 * BEAT + 0.6, tap: 5 * BEAT, form: 5 * BEAT + 0.12, page: 6 * BEAT, res1: 6 * BEAT + 1.8, end: 6 * BEAT + 1.8 };
export const BUY_DUR = Math.round(TL.end * 30);
export const TABLET_TAP: [number, number] = LY.checkoutTap as [number, number];
export const TABLET_KEY = LY.cartKey; // the cart's total and the checkout button
// look15 (decision): one caption over the whole client path, to the end of the tap on «Оформить заказ»
// look16: the caption stays over the order page until 1.27 s before the owner's caption (no stretch over 1.5 s)
export const BUY_CAPTIONS = [{ lines: CFG.captions.client.lines, x: 70, y: 272, size: env("CAPS", CFG.captions.size), accent: CFG.captions.client.accent as [number, number][], at0: -0.2, at1: 3.333 }]; // look16 review: on from the cut
export const BUY_CAPTION = BUY_CAPTIONS[0];
// look15 (rule: no linear curves): every ramp below is eased; smooth: 0 -> 1 with zero speed at both ends
// look16 block E: captions come in with a fast start and a calm end (ease-out), 250 ms
export const easeOut = (u: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, u)), 3);
export const smooth = (u: number) => { const v = Math.min(1, Math.max(0, u)); return v * v * (3 - 2 * v); };
const glide = (t: number, t0: number, t1: number) => { const u = Math.min(1, Math.max(0, (t - t0) / (t1 - t0))); return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
export function buyerAt(t: number) {
  let cam = mixCam(mixCam(K0W, K0, glide(t, 0, TL.push1)), K1, glide(t, TL.back0, TL.back1));
  cam = mixCam(cam, K2, glide(t, TL.into0, TL.into1));
  if (t >= TL.page) cam = mixCam(K3, K3B, glide(t, TL.page, TL.res1)); // the cut to the page, then the slow push to «Итого»
  const tabletShot = t >= TL.page ? "order" : t >= TL.form ? "contacts_filled" : "drawer";
  const ring = smooth((t - (TL.tap - 0.14)) / 0.14), out = smooth((t - (TL.tap + 0.02)) / 0.08); // gone before the form (look16: the form from tap + 0.12)
  const captions = BUY_CAPTIONS.map((c) => {
    const u = easeOut((t - c.at0) / 0.25), o = smooth((t - c.at1) / 0.15);
    return { c, opacity: u * (1 - o), rise: (1 - u) * 0.3 * c.size };
  });
  return { cam, tabletShot, phoneShot: "product", tap: { ring, out }, captions };
}

// ---------- the storyboard ----------
// look16 timeline (reel seconds, beats of 0.4917 s): hook 0-4T (1.967); client 4T-6.717; owner 6.717: «Вы видите
// каждый заказ» 6.75-8.75 over the tap (decision), the tap on «Принять» on the downbeat 16T (7.867), then the row
// №1048 across the whole width (8.75-9.15); the card on the phrase change 20T (9.833), the end 26T (12.783)
export const BUYER_FROM = CFG.music.hookEndBeat * BEAT, FIN_FROM = 4 * BEAT + TL.end, FIN_CAP = { at0: 6.75, at1: 8.75 }, TAP_OWNER = CFG.music.tapOwnerBeat * BEAT, ROW0 = 8.75, ROW1 = 9.15, CARD_AT = CFG.music.cardBeat * BEAT, END = CFG.music.endBeat * BEAT;
// the tap framing: the phone smaller, its top under «Вы видите каждый заказ»; the row framing: №1048 across the frame
export const FIN_TAP: FCam = camLook(OWN, LY.ownerTapAnchor[0], LY.ownerTapAnchor[1], env("FTX", 540), env("FTY", 1075), env("FTS", 1.9), env("FTP", 72));
export const FIN_ROW: FCam = camLook(OWN, LY.ownerRowAnchor[0], LY.ownerRowAnchor[1], env("FRX", 540), env("FRY", 610), env("FRS", 2.75), env("FRP", 76));
export const TABLET_BTN = LY.checkoutBox; // the tap outline, the same form as on the owner's button
export const TIMELINE = {
  beat: BEAT, end: END, card: CARD_AT,
  captions: [{ text: CFG.captions.hook.lines.join(" "), at0: 0, at1: BUYER_FROM }, { text: CFG.captions.client.lines.join(" "), at0: BUYER_FROM, at1: BUYER_FROM + 3.333 + 0.15 }, { text: CFG.captions.owner.lines.join(" "), at0: FIN_CAP.at0, at1: FIN_CAP.at1 + 0.15 }, { text: "карточка", at0: CARD_AT, at1: END }],
  events: [{ name: "уведомление", t: 0 }, { name: "склейка на клиента", t: BUYER_FROM }, { name: "касание «Оформить заказ»", t: BUYER_FROM + TL.tap }, { name: "страница заказа", t: BUYER_FROM + TL.page }, { name: "касание «Принять»", t: TAP_OWNER }, { name: "карточка", t: CARD_AT }],
};
export const ARRIVAL = 0.0; // look15: the notice starts on frame 0 (rule: an event in frame 0)
export const ownerShotAt = (t: number) => { const k = Math.round((t - ARRIVAL) * 30); return k < 0 ? "owner_before" : "owner_m_" + String(Math.min(60, k)).padStart(2, "0"); };
export type Still13 = { id: string; t: number; kind: "owner" | "buyer"; label: string; shot?: string; cam?: FCam; caption?: typeof HOOK_CAPTION; tap?: { ring: number; out: number }; blur?: number };
export const STILLS13: Still13[] = [
  { id: "01", t: 0.0, kind: "owner", shot: ownerShotAt(0.0), cam: HOOK_CAM(0), caption: HOOK_CAPTION, label: "кадр 0: подпись, уведомление въезжает" },
  { id: "02", t: 0.3, kind: "owner", shot: ownerShotAt(0.3), cam: HOOK_CAM(0.05), caption: HOOK_CAPTION, label: "уведомление «Новый заказ · 298 ₼»" },
  { id: "03", t: 1.0, kind: "owner", shot: ownerShotAt(1.0), cam: HOOK_CAM(0.45), caption: HOOK_CAPTION, label: "строка №{N}, вспышка, «Новые: 1»" },
  { id: "04", t: 2.2, kind: "buyer", label: "наезд на телефон клиента" },
  { id: "05", t: 3.2, kind: "buyer", label: "общий план 2,95–3,44 с" },
  { id: "06", t: 4.2, kind: "buyer", label: "корзина, телефон за кадром" },
  { id: "07", t: 4.45, kind: "buyer", label: "касание «Оформить заказ» на доле" },
  { id: "08a", t: 4.7, kind: "buyer", label: "мелькает форма" },
  { id: "08", t: 5.0, kind: "buyer", label: "итог клиента: заказ оформлен, статус «новый»" },
  { id: "08c", t: 6.68, kind: "buyer", label: "наезд дошёл до суммы «Итого»" },
  { id: "09", t: 7.6, kind: "owner", shot: "owner_orders", cam: FIN_TAP, caption: FIN_CAPTION, label: "«Вы видите каждый заказ» над касанием" },
  { id: "10a", t: 8.39, kind: "owner", shot: "owner_acc_01", cam: FIN_TAP, caption: FIN_CAPTION, tap: { ring: 1, out: 0 }, label: "касание «Принять» на сильной доле" },
  { id: "10", t: 9.4, kind: "owner", shot: "owner_accepted", cam: FIN_ROW, tap: { ring: 1, out: 1 }, label: "строка №{N} на всю ширину, «ПРИНЯТ»" },
];
export const localT = (t: number) => t - BUYER_FROM;
