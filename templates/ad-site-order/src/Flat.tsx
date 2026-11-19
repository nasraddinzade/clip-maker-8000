import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { LSIDE, PAL, TABLE, TABLE_Y } from "./setgeo";
import { BH, BW, FCam, FDev, LIGHT, bodyOutline, bodyQuad, FL, project, quadMatrix, scaleAt } from "./flatgeo";
import { Spec } from "./devices";
import { rgba } from "./cfg";

/** one screen state: a real viewport capture of the site (public/dev/<device>/<state>.png) */
export type Layer = { id: string; segs: { src: string; y0: number; clipTop: number; h: number }[]; scroll: number; header: string | null; opacity: number };
const ScreenLayer: React.FC<{ l: Layer; spec: Spec; ps: number }> = ({ l, spec, ps }) => (
  <AbsoluteFill style={{ opacity: l.opacity }}>
    {l.segs.map((sg, i) => (
      <div key={i} style={{ position: "absolute", left: 0, top: (sg.y0 + sg.clipTop - l.scroll) * ps, width: spec.sw * ps, height: (sg.h - sg.clipTop) * ps, overflow: "hidden" }}>
        <Img src={staticFile(sg.src)} style={{ position: "absolute", left: 0, top: -sg.clipTop * ps, width: spec.sw * ps, display: "block" }} />
      </div>
    ))}
  </AbsoluteFill>
);

// The scene: a matte wooden table seen from above (no wall), one soft source at the side of variant.light (LSIDE: +1
// left, -1 right), devices lying screen up with their real thickness, nothing else on the table.
const poly = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

// look14 (decision of the person): a dark wooden table, a real photo (Nathan Dumlao, Unsplash License, CREDITS.md), one
// photo = 2260 world px (78 cm: boards about 13 cm wide). The visible table is found by casting the frame's corners onto
// it; the photo itself is drawn at full resolution (wood_full.jpg) where it lies, and around it its mirrored copies at
// half resolution (wood_tile.jpg) continue without a seam. Darkened a little, matte. origin: the world point of the
// photo's top-left corner (x, far z).
const WOOD = { full: TABLE.full, tile: TABLE.tile, aspect: TABLE.photoPx[1] / TABLE.photoPx[0], px: TABLE.photoPx[0] }; // the palette's table (config.json)
const GRADE = TABLE.grade, SH = TABLE.shade ?? 1;
/** where the frame point (X, Y) meets the table (world x, z) */
function onTable(cam: FCam, X: number, Y: number) {
  const F = cam.f ?? FL, p = (cam.pitch * Math.PI) / 180, dx = (X - 540) / F, dy = (Y - 960) / F;
  const t = (TABLE_Y - cam.y) / (dy * Math.cos(p) + Math.sin(p));
  return { x: cam.x + t * dx, z: cam.z + t * (Math.cos(p) - dy * Math.sin(p)) };
}
export const FlatTable: React.FC<{ cam: FCam; blur?: number; origin: { x: number; z: number }; photoW?: number }> = ({ cam, blur = 0, origin, photoW = TABLE.worldWidth }) => {
  const c = [onTable(cam, -60, -60), onTable(cam, 1140, -60), onTable(cam, 1140, 1980), onTable(cam, -60, 1980)];
  const x0 = Math.min(...c.map((v) => v.x)), x1 = Math.max(...c.map((v) => v.x)), z0 = Math.min(...c.map((v) => v.z)), z1 = Math.max(...c.map((v) => v.z));
  const P = (x: number, z: number) => { const r = project(cam, x, TABLE_Y, z); return { x: r.x, y: r.y }; };
  const photoH = photoW * WOOD.aspect;
  const layer = (rx0: number, rx1: number, rz0: number, rz1: number, q: number, src: string, size: [number, number], key: string) => {
    if (rx1 <= rx0 || rz1 <= rz0) return null;
    const w = (rx1 - rx0) * q, h = (rz1 - rz0) * q;
    return (
      <div key={key} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, transformOrigin: "0 0", transform: quadMatrix(w, h, [P(rx0, rz1), P(rx1, rz1), P(rx1, rz0), P(rx0, rz0)]),
        backgroundImage: `url(${staticFile(src)})`, backgroundSize: `${size[0] * q}px ${size[1] * q}px`,
        backgroundPosition: `${((origin.x - rx0) * q).toFixed(1)}px ${((rz1 - origin.z) * q).toFixed(1)}px`,
        filter: `${GRADE}${blur > 0.3 ? ` blur(${blur.toFixed(1)}px)` : ""}` }} />
    );
  };
  const qt = Math.min(1.4, (WOOD.px / 2) / photoW), qf = WOOD.px / photoW;
  return (
    <AbsoluteFill style={{ background: PAL.ink, overflow: "hidden" }}>
      {layer(x0, x1, z0, z1, qt, WOOD.tile, [2 * photoW, 2 * photoH], "tile")}
      {layer(Math.max(x0, origin.x), Math.min(x1, origin.x + photoW), Math.max(z0, origin.z - photoH), Math.min(z1, origin.z), qf, WOOD.full, [photoW, photoH], "full")}
      {/* the source's falloff: lit at the source's side, darker away from it; the far table (top of the frame) a little darker */}
      {/* the palette's shade scales the darkening (a light table under dark captions keeps light) */}
      <AbsoluteFill style={{ background: `linear-gradient(${LSIDE > 0 ? 90 : 270}deg, rgba(255,214,168,0.06) 0%, rgba(0,0,0,${0.08 * SH}) 45%, rgba(0,0,0,${0.38 * SH}) 100%)` }} />
      <AbsoluteFill style={{ background: `linear-gradient(180deg, rgba(0,0,0,${0.28 * SH}) 0%, rgba(0,0,0,${0.05 * SH}) 35%, rgba(0,0,0,0) 60%, rgba(0,0,0,${0.16 * SH}) 100%)` }} />
    </AbsoluteFill>
  );
};

/** shadows on the table: devices (contact, a short soft shadow away from the source, a wide ambient one) */
export const FlatShadows: React.FC<{ cam: FCam; devs: FDev[] }> = ({ cam, devs }) => {
  const P = (x: number, z: number) => { const r = project(cam, x, TABLE_Y, z); return { x: r.x, y: r.y }; };
  const sAt = (x: number, z: number) => project(cam, x, TABLE_Y, z).s;
  const id = (k: string) => `f_${k}`;
  const items: React.ReactNode[] = [];
  const defs: React.ReactNode[] = [];
  devs.forEach((d, i) => {
    const s = sAt(d.x, d.z), off = d.thick * LIGHT.cot;
    const f = (n: string, sd: number) => { defs.push(<filter key={id(`d${i}${n}`)} id={id(`d${i}${n}`)} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation={Math.max(0.6, sd).toFixed(2)} /></filter>); return `url(#${id(`d${i}${n}`)})`; };
    // look13 (review): rounded like the body, and only away from the source (right): a soft ambient spill, the short
    // shadow of the body's thickness, a thin contact line; nothing sticks out to the left or towards the camera
    items.push(<polygon key={`da${i}`} points={poly(bodyOutline(d, cam, 0, 0.3 * 29, 0.45 * 29, 0.06 * 29))} fill="#000" opacity={0.22} filter={f("a", 0.7 * 29 * s)} />);
    items.push(<polygon key={`ds${i}`} points={poly(bodyOutline(d, cam, 0, 0.06 * 29, off * LIGHT.dx * LSIDE * 0.9, off * LIGHT.dz * 0.9))} fill="#000" opacity={0.5} filter={f("s", 0.25 * 29 * s)} />);
    items.push(<polygon key={`dc${i}`} points={poly(bodyOutline(d, cam, 0, 0.02 * 29))} fill="#070605" opacity={0.75} filter={f("c", 0.06 * 29 * s)} />);
  });
  return <svg width={1080} height={1920} style={{ position: "absolute", inset: 0 }}><defs>{defs}</defs>{items}</svg>;
};

/** a device lying on the table: stacked layers for the thickness (metal, lit at the left), the top face with the screen */
export const FlatDevice: React.FC<{ d: FDev; cam: FCam; layers: Layer[]; overlay?: React.ReactNode; blur?: number }> = ({ d, cam, layers, overlay, blur = 0 }) => {
  const spec = d.spec, R = Math.max(0.6, Math.min(3.2, scaleAt(d, cam))); // local px per CSS px
  const w = BW(spec) * R, h = BH(spec) * R, rad = spec.radius * BW(spec) * R;
  const N = Math.max(6, Math.min(26, Math.round(d.thick * project(cam, d.x, TABLE_Y, d.z).s * 0.8)));
  const face = (hgt: number) => quadMatrix(w, h, bodyQuad(d, cam, hgt));
  const filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : undefined;
  return (
    <AbsoluteFill style={{ filter }}>
      {Array.from({ length: N }).map((_, i) => {
        const k = i / (N - 1); // 0 at the table, 1 just under the top face
        // the metal band: darker near the table, a bright line where the rounded upper edge catches the source
        const l = Math.round(40 + 34 * Math.pow(k, 1.4) + (k > 0.88 ? 18 * (k - 0.88) / 0.12 : 0));
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, borderRadius: rad, transformOrigin: "0 0", transform: face(d.thick * k * 0.985),
            background: `linear-gradient(${(LSIDE > 0 ? 90 : 270) + d.yaw}deg, rgb(${l + 34},${l + 25},${l + 14}) 0%, rgb(${Math.round(l * 0.62)},${Math.round(l * 0.58)},${Math.round(l * 0.55)}) 45%, rgb(${Math.round(l * 0.36)},${Math.round(l * 0.34)},${Math.round(l * 0.32)}) 100%)` }} />
        );
      })}
      <div style={{ position: "absolute", left: 0, top: 0, width: w, height: h, borderRadius: rad, transformOrigin: "0 0", transform: face(d.thick), overflow: "hidden",
        background: "#0b0a09" }}>
        <div style={{ position: "absolute", left: spec.bez[3] * R, top: spec.bez[0] * R, width: spec.sw * R, height: spec.sh * R, borderRadius: Math.max(0, rad - spec.bez[3] * R), overflow: "hidden", background: PAL.ink }}>
          {layers.map((l) => <ScreenLayer key={l.id} l={l} spec={spec} ps={R} />)}
          {overlay}
          {spec.id === "phone" ? <div style={{ position: "absolute", left: (spec.sw / 2 - 5.5) * R, top: 7 * R, width: 11 * R, height: 11 * R, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #1d2a3a 0%, #050505 60%)" }} /> : null}
          {/* the glass: a faint broad sheen of the source at the left, nothing over the text */}
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(${(LSIDE > 0 ? 100 : 260) + d.yaw}deg, rgba(255,240,220,0.09) 0%, rgba(255,240,220,0.03) 30%, rgba(255,240,220,0) 55%)` }} />
        </div>
        {/* look14 (decision: the rim on close-ups is no even outline): the rounded metal rim lit from the left. A bright
            bevel along the left edge, softer along the top, the right and bottom edges in shade; on the left edge a
            longer specular streak where the soft source reflects, fading towards both corners. Within the bezel only. */}
        <div style={{ position: "absolute", inset: 0, borderRadius: rad, pointerEvents: "none",
          boxShadow: `inset ${2.0 * R * LSIDE}px 0 ${1.6 * R}px -${0.6 * R}px rgba(255,232,200,0.34), inset 0 ${1.4 * R}px ${1.4 * R}px -${0.6 * R}px rgba(255,232,200,0.16), inset ${-2.2 * R * LSIDE}px 0 ${1.8 * R}px -${0.6 * R}px rgba(0,0,0,0.6), inset 0 -${2.2 * R}px ${1.8 * R}px -${0.6 * R}px rgba(0,0,0,0.5)` }} />
        <div style={{ position: "absolute", left: LSIDE > 0 ? 0.4 * R : w - 2.2 * R, top: h * 0.12, width: 1.8 * R, height: h * 0.62, borderRadius: R, pointerEvents: "none",
          background: "linear-gradient(180deg, rgba(255,240,222,0) 0%, rgba(255,240,222,0.42) 38%, rgba(255,240,222,0.55) 50%, rgba(255,240,222,0.3) 70%, rgba(255,240,222,0) 100%)", filter: `blur(${(0.5 * R).toFixed(1)}px)` }} />
      </div>
    </AbsoluteFill>
  );
};

// look16 block E (decision): the main captions large: capitals about 60 px in 1080 (20 px at 360), bold, at most two
// lines, one key phrase in the palette's accentText, a soft ellipse of the palette's veil behind for 7:1 contrast
export type CapCfg = { lines: string[]; x: number; y: number; size: number; accent?: [number, number] | [number, number][]; font?: "serif" | "sans" };
const isAccent = (c: CapCfg, i: number, j: number) => { const a = c.accent; if (!a) return false; const list = (Array.isArray(a[0]) ? a : [a]) as [number, number][]; return list.some(([li, wi]) => li === i && wi === j); };
export const Cap: React.FC<{ c: CapCfg; opacity?: number; rise?: number; mask?: boolean }> = ({ c, opacity = 1, rise = 0, mask }) => {
  const lh = 1.04, h = c.lines.length * c.size * lh;
  return (
    <>
      {mask ? null : (
        <div style={{ position: "absolute", left: c.x - 0.9 * c.size, top: c.y - 0.75 * c.size, width: 1080 - c.x + 0.4 * c.size, height: h + 1.5 * c.size, opacity,
          background: `radial-gradient(ellipse 60% 55% at 42% 50%, ${rgba(PAL.veil, PAL.halo[0])} 0%, ${rgba(PAL.veil, PAL.halo[1])} 45%, ${rgba(PAL.veil, 0)} 100%)`, pointerEvents: "none" }} />
      )}
      <div style={{ position: "absolute", left: c.x, top: c.y, fontFamily: c.font === "sans" ? "Jost" : "Playfair Display", fontWeight: c.font === "sans" ? 600 : 700, fontSize: c.size, lineHeight: lh, whiteSpace: "nowrap", opacity,
        transform: rise ? `translateY(${rise.toFixed(2)}px)` : undefined, color: mask ? "#fff" : PAL.capText, textShadow: mask ? undefined : PAL.capShadow }}>
        {c.lines.map((l, i) => (
          <div key={i}>{l.split(" ").map((wd, j) => <React.Fragment key={j}>{j ? " " : ""}<span style={{ color: !mask && isAccent(c, i, j) ? PAL.capAccent : undefined }}>{wd}</span></React.Fragment>)}</div>
        ))}
      </div>
    </>
  );
};

/** the tap: a ring closes on the point, the press, then it fades (screen CSS px, drawn inside the screen). With box, the
 *  ring is the button's own outline 7 CSS px out (a round ring around a small button would cross the line above it or the label itself) */
export const TapRing: React.FC<{ at: [number, number]; ring: number; out: number; R: number; ps: number; box?: number[] }> = ({ at, ring, out, R, ps, box }) => {
  if (!(ring > 0 && out < 1)) return null;
  const pad = 7, g = box ? [box[0] - pad, box[1] - pad, box[2] + 2 * pad, box[3] + 2 * pad] : [at[0] - R, at[1] - R, 2 * R, 2 * R];
  return (
    <div style={{ position: "absolute", left: g[0] * ps, top: g[1] * ps, width: g[2] * ps, height: g[3] * ps, borderRadius: box ? 9 * ps : "50%",
      border: `${(box ? 6 : 3.5) * ps}px solid ${rgba(PAL.capAccent, +(0.95 * (1 - out)).toFixed(3))}`, background: box ? undefined : `rgba(14,12,10,${(0.3 * ring * (1 - out)).toFixed(3)})`,
      boxShadow: box ? `0 0 ${14 * ps}px rgba(255,214,150,${(0.55 * ring * (1 - out)).toFixed(3)})` : undefined,
      transform: `scale(${((box ? 1.25 - 0.25 * ring : 1.7 - 0.7 * ring)).toFixed(3)})`, opacity: Math.min(1, ring * 2) }} />
  );
};

export const vpLayer = (dir: string, shot: string, sh: number): Layer[] => [{ id: shot, segs: [{ src: `${dir}/${shot}.png`, y0: 0, clipTop: 0, h: sh }], scroll: 0, header: null, opacity: 1 }];
