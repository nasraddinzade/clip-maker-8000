// Boxes of the look13 storyboard stills for the checks (checks/board13_check.py, caption_margins --elements):
//  - keys per still (zones by beat, video-qa), device bodies;
//  - event texts with the height of their letters at a 360 px wide view (glyph height from the capture's font metrics,
//    projected at the text's own place: the camera looks down, the far end of a screen is smaller);
//  - every word on every screen in view that the frame edge cuts, or that a scene object half covers (video-qa
//    «Обрезанные слова», look12: under a scene object too; 6 px of line box past an edge is leading, not a letter);
//  - tablet to phone size on the frame (решение look13: from 1.6), the phone's frame in the last still.
import { writeFileSync } from "fs";
import { BH, FCam, FDev, bodyBoxF, bodyQuad, letterPx, scrBox } from "./flatgeo";
import { CFG, exact, fmt } from "./cfg";
const LB = CFG.labels, NUM = exact(CFG.order.number), TOTAL = exact(CFG.order.totalText);
import { BPH, BUYER_FROM, OWN, STILLS13, TAB, TABLET_KEY, TIMELINE, buyerAt, ownerShotAt, HOOK_CAM, ACCEPT_AT } from "./scenes";
import tab from "./states/states_tablet.json";
import ph from "./states/states_phone.json";

type T = { t: string; box: number[]; fs: number; letter: number; kind: string };
type St = { el: Record<string, unknown>; texts: T[]; words: (number | string)[][]; vw: number; vh: number };
const S = (o: unknown, k: string) => { const s = (o as Record<string, St>)[k]; if (!s) throw new Error("no state " + k); return s; };
const r = (b: number[]) => b.map((v) => Math.round(v));
const SKIPW = (txt: string) => txt === "К" || txt === "содержимому";
const out: unknown[] = [], elements: { frame: number; name: string; x0: number; y0: number; x1: number; y1: number }[] = [];

type View = { d: FDev; st: St; name: string };
function cutWords(views: View[], cam: FCam, _obj: { x: number; z: number } | null) {
  // nothing stands on the table (template decision); the occlusion test stays ready for a scene object
  const sh = { inside: (_x: number, _y: number) => false }, cut: string[] = [], under: string[] = [];
  for (const v of views) for (const w of v.st.words) {
    const [x, y, ww, hh, txt] = w as [number, number, number, number, string];
    if (SKIPW(txt) || x < 0 || y < 0 || x + ww > v.st.vw || y + hh > v.st.vh) continue;
    const b = scrBox(v.d, cam, [x, y, ww, hh]);
    const inside = b[2] > 6 && b[0] < 1074 && b[3] > 6 && b[1] < 1914, whole = b[0] >= -6 && b[2] <= 1086 && b[1] >= -6 && b[3] <= 1926;
    if (inside && !whole) cut.push(`${v.name}:${txt}@${r(b).join(",")}`);
    // under a scene object: sample the word's box (inset by the leading) and count the covered points
    if (!inside) continue;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 6; i++) for (let j = 1; j <= 3; j++) pts.push([b[0] + ((b[2] - b[0]) * i) / 6, b[1] + ((b[3] - b[1]) * j) / 4]);
    const n = pts.filter(([px, py]) => sh.inside(px, py)).length;
    if (n > 0) under.push(`${v.name}:${txt}@${r(b).join(",")} (${n}/${pts.length} under a scene object)`);
  }
  return { cut, under };
}
const pick = (st: St, re: RegExp, last = false) => { const h = st.texts.filter((x) => re.test(x.t)); return last ? h[h.length - 1] : h[0]; };
function measure(d: FDev, cam: FCam, st: St, re: RegExp, last = false) {
  const t = pick(st, re, last);
  if (!t) return { text: re.source, missing: true };
  const b = scrBox(d, cam, t.box), L = letterPx(d, cam, t.box, t.letter);
  return { text: t.t, fontCss: t.fs, letterCss: t.letter, letterFrame: Math.round(L * 10) / 10, letterAt360: Math.round((L / 3) * 10) / 10, inFrame: b[0] >= 0 && b[2] <= 1080 && b[1] >= 0 && b[3] <= 1920 };
}

STILLS13.forEach((st, i) => {
  let cam: FCam, views: View[], keys: [string, number[]][] = [], events: { re: RegExp; last?: boolean }[] = [], info: { re: RegExp; last?: boolean }[] = [];
  let main: View;
  if (st.kind === "owner") {
    cam = st.cam!;
    main = { d: OWN, st: S(tab, st.shot!), name: "owner" }; views = [main];
    const e = main.st.el as { rows: number[][]; toast: number[] | null; accept: number[] | null; badge: number[] | null };
    const r0 = e.rows[0];
    if (st.id === "02") { keys.push(["toast", scrBox(OWN, cam, e.toast!)]); events = [{ re: exact(LB.toast) }, { re: TOTAL }]; }
    if (st.id === "03") {
      keys.push(["toast", scrBox(OWN, cam, e.toast!)], ["orderRow", scrBox(OWN, cam, [r0[0] + 8, r0[1] + 10, r0[2] - 16, 44])]); // look16 E: the key is the order line (№1048, НОВЫЙ, name)
      const c0 = pick(main.st, new RegExp("^" + LB.newCountPrefix)); keys.push(["count", scrBox(OWN, cam, c0.box)]);
      events = [{ re: exact(LB.toast) }, { re: TOTAL }, { re: NUM }, { re: exact(LB.statusNew) }, { re: new RegExp("^" + LB.newCountPrefix + " \\d$") }];
    }
    if (st.id === "10") { keys.push(["orderRow", scrBox(OWN, cam, [r0[0] + 12, r0[1] + 20, r0[2] - 24, r0[3] - 40])]); events = [{ re: exact(LB.statusAccepted) }, { re: NUM }, { re: TOTAL }]; }
    if (st.id === "10a") {
      keys.push(["orderRow", scrBox(OWN, cam, [r0[0] + 8, r0[1] + 10, r0[2] - 16, r0[3] - 20])]);
      // look14: the new-orders line fades out after the tap; in 10 it is gone
      info = [{ re: NUM }, { re: exact(LB.statusNew) }, { re: exact(LB.accept) }]; // the tap stays small (rule: the result must read, 10)
    }
  } else {
    const t = st.t - BUYER_FROM, s = buyerAt(t);
    cam = s.cam;
    const vT: View = { d: TAB, st: S(tab, s.tabletShot), name: "tablet" }, vP: View = { d: BPH, st: S(ph, s.phoneShot), name: "phone" };
    views = [vT, vP]; main = st.id === "04" ? vP : vT;
    if (st.id === "04") { const el = vP.st.el as Record<string, number[]>; keys.push(["title", scrBox(BPH, cam, el.h1)], ["price", scrBox(BPH, cam, el.productPrice)]); }
    if (st.id === "06" || st.id === "07") { keys.push(["total+button", scrBox(TAB, cam, TABLET_KEY)]); info = [{ re: exact(LB.checkoutButton) }, { re: TOTAL, last: true }]; }
    if (st.id === "08a") keys.push(["form", scrBox(TAB, cam, [24, 140, 772, 260])]);
    if (st.id === "08c") { const it = pick(vT.st, exact(LB.total)), sm = pick(vT.st, TOTAL, true); keys.push(["total", [scrBox(TAB, cam, it.box)[0], scrBox(TAB, cam, it.box)[1], scrBox(TAB, cam, sm.box)[2], scrBox(TAB, cam, sm.box)[3]]]); events = [{ re: exact(LB.total) }, { re: TOTAL, last: true }]; }
    if (st.id === "08") { const h = pick(vT.st, exact(fmt(LB.orderPlaced))); keys.push(["heading", scrBox(TAB, cam, h.box)]); const sx = pick(vT.st, exact(LB.statusNew)); keys.push(["status", scrBox(TAB, cam, sx.box)]); events = [{ re: exact(fmt(LB.orderPlaced)) }, { re: exact(LB.statusNew) }]; info = [{ re: exact(LB.total) }, { re: TOTAL, last: true }]; } // look16: the total is the key of 08c
  }
  const ev = events.map((e) => measure(main.d, cam, main.st, e.re, e.last)), inf = info.map((e) => measure(main.d, cam, main.st, e.re, e.last));
  const cw = cutWords(views, cam, null);
  const bodies: [string, number[]][] = views.map((v) => [v.name, bodyBoxF(v.d, cam)]);
  const bb = { all: [-9, -9, -9, -9], cap: [-9, -9, -9, -9] }; // no object on the table: the cap check is skipped
  for (const [n, b] of [...bodies, ...keys]) elements.push({ frame: i, name: n, x0: b[0], y0: b[1], x1: b[2], y1: b[3] });
  const bt = bodies.find((b) => b[0] === "tablet"), bp = bodies.find((b) => b[0] === "phone");
  // the size of a body on the frame: the length of its long edges as projected (rotation does not change it)
  const longEdge = (d: FDev) => { const q = bodyQuad(d, cam, d.thick); return (Math.hypot(q[3].x - q[0].x, q[3].y - q[0].y) + Math.hypot(q[2].x - q[1].x, q[2].y - q[1].y)) / 2; };
  const sizeRatio = bt && bp ? { longEdge: Math.round((longEdge(TAB) / longEdge(BPH)) * 100) / 100, height: Math.round(((bt[1][3] - bt[1][1]) / (bp[1][3] - bp[1][1])) * 100) / 100, width: Math.round(((bt[1][2] - bt[1][0]) / (bp[1][2] - bp[1][0])) * 100) / 100 } : null;
  const ob = bodies.find((b) => b[0] === "owner");
  // the owner's phone in the last stills: which body edges are in view (the bottom corners at the top face)
  const oq = ob ? bodyQuad(OWN, cam, OWN.thick) : null;
  const edges = oq ? { bottomLeft: [Math.round(oq[3].x), Math.round(oq[3].y)], bottomRight: [Math.round(oq[2].x), Math.round(oq[2].y)], topLeft: [Math.round(oq[0].x), Math.round(oq[0].y)], topRight: [Math.round(oq[1].x), Math.round(oq[1].y)] } : null;
  const shadowCm = 0; // nothing stands on the table
  out.push({ still: st.id, t: st.t, label: st.label, kind: st.kind, pitch: Math.round(cam.pitch), keys: Object.fromEntries(keys.map(([n, b]) => [n, r(b)])), events: ev, info: inf,
    cutWords: cw.cut, underBottle: cw.under, bodies: Object.fromEntries(bodies.map(([n, b]) => [n, r(b)])), bottle: r(bb.all), cap: r(bb.cap), sizeRatio,
    edges, shadowCm, phoneCm: Math.round((BH(OWN.spec) * OWN.spec.base / 29) * 10) / 10,
    phoneFrame: ob ? { top: ob[1][1] >= 0, left: ob[1][0] >= 0, right: ob[1][2] <= 1080, bottom: ob[1][3] <= 1920 } : null });
});
const dst = process.argv[2] || "board13.json";
writeFileSync(dst, JSON.stringify(out, null, 1));
writeFileSync(dst.replace(".json", "_elements.json"), JSON.stringify(elements));
writeFileSync(dst.replace(".json", "_timeline.json"), JSON.stringify(TIMELINE, null, 1));
for (const o of out as any[]) console.log(o.still, o.t, "pitch", o.pitch, JSON.stringify(o.bodies), "keys", JSON.stringify(o.keys), "cut", o.cutWords.length, o.cutWords.slice(0, 5).join(" "), "under", o.underBottle.length, o.underBottle.slice(0, 3).join(" "), o.sizeRatio ? "ratio " + JSON.stringify(o.sizeRatio) : "", "\n   ev", o.events.map((e: any) => `${e.text}:${e.letterAt360}`).join(" "), "| info", o.info.map((e: any) => `${e.text}:${e.letterAt360}`).join(" "));

// the hook's motion test frame by frame (0-2.0 s, the owner's phone): cut words and the event letters per frame
if (process.env.HOOKFRAMES) {
  const rows = [];
  for (let f = 0; f < 69; f++) {
    const t = f / 30, u = Math.min(1, t / 2.2), e = u * u * (3 - 2 * u), cam = HOOK_CAM(e), shot = ownerShotAt(t), st = S(tab, shot);
    const cw = cutWords([{ d: OWN, st, name: "owner" }], cam, null);
    const toast = st.texts.find((x) => exact(LB.toast).test(x.t)), row = st.texts.find((x) => exact(LB.statusNew).test(x.t));
    rows.push({ f, shot, cut: cw.cut, under: cw.under, toast360: toast ? Math.round((letterPx(OWN, cam, toast.box, toast.letter) / 3) * 10) / 10 : null, badge360: row ? Math.round((letterPx(OWN, cam, row.box, row.letter) / 3) * 10) / 10 : null });
  }
  writeFileSync("hook_frames13.json", JSON.stringify(rows));
  console.log("hook frames with cut words:", rows.filter((x) => x.cut.length || x.under.length).map((x) => `${x.f}:${[...x.cut, ...x.under].join(" ")}`).join(" | ") || "none");
}
void ACCEPT_AT; void LB;
