// look13 (decision of the person): no stands, no wall. Phone and tablet lie on the table screen up, the camera looks
// down at 55-78 degrees, as a phone lies on a table when an order comes in. Everything on the table is one plane seen by
// one camera (devices.ts project): the stone, the shadows, the device bodies and their screens are mapped onto that
// plane with a homography, so a screen lies exactly where its body lies and the body's thickness is real (stacked
// layers between the table and the top face). No React here: the box export for the checks uses the same math.
import { CamW, Spec } from "./devices";
import { CM, TABLE_Y } from "./setgeo";

export type FDev = { spec: Spec; x: number; z: number; yaw: number; thick: number }; // body centre on the table, yaw in degrees (counter-clockwise seen from above)
export type FCam = CamW & { pitch: number; f?: number };
// look13: a long lens (focal length 4000 px on the 1080 x 1920 frame, a short telephoto) instead of the scene's 1000:
// with 1000 a phone filling the frame is 7 cm from the camera and its far end shrinks like a fish-eye
export const FL = Number(process.env.FL || 4000);
/** a world point to the frame for a flat-lay camera (as devices.ts project, with the camera's own focal length) */
export function project(cam: CamW & { f?: number }, wx: number, wy: number, wz: number) {
  const F = cam.f ?? FL;
  const dx = wx - cam.x, dy = wy - cam.y, dz = wz - cam.z;
  const pt = ((cam.pitch ?? 14) * Math.PI) / 180;
  const depth = Math.max(1, dy * Math.sin(pt) + dz * Math.cos(pt));
  const yv = dy * Math.cos(pt) - dz * Math.sin(pt);
  const s = F / depth;
  return { x: 540 + dx * s, y: 960 + yv * s, s, depth };
}
export const BW = (s: Spec) => s.sw + s.bez[1] + s.bez[3];
export const BH = (s: Spec) => s.sh + s.bez[0] + s.bez[2];
type Pt = { x: number; y: number };

/** a point of the body (body CSS px from its top-left corner) at height h above the table, in the world. The screen's
 *  top edge points away from the camera (+z). */
export function worldOf(d: FDev, bx: number, by: number, h: number): [number, number, number] {
  const ux = (bx - BW(d.spec) / 2) * d.spec.base, uz = -(by - BH(d.spec) / 2) * d.spec.base;
  const a = (d.yaw * Math.PI) / 180;
  return [d.x + ux * Math.cos(a) - uz * Math.sin(a), TABLE_Y - h, d.z + ux * Math.sin(a) + uz * Math.cos(a)];
}
const P = (cam: CamW, w: [number, number, number]): Pt => { const p = project(cam, w[0], w[1], w[2]); return { x: p.x, y: p.y }; };
/** a screen point (screen CSS px) on the frame */
export const scr = (d: FDev, cam: CamW, sx: number, sy: number): [number, number] => { const p = P(cam, worldOf(d, d.spec.bez[3] + sx, d.spec.bez[0] + sy, d.thick)); return [p.x, p.y]; };
export const scrQuad = (d: FDev, cam: CamW, b: number[]): [number, number][] => [scr(d, cam, b[0], b[1]), scr(d, cam, b[0] + b[2], b[1]), scr(d, cam, b[0] + b[2], b[1] + b[3]), scr(d, cam, b[0], b[1] + b[3])];
export const qbox = (q: [number, number][]) => { const xs = q.map((p) => p[0]), ys = q.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
export const scrBox = (d: FDev, cam: CamW, b: number[]) => qbox(scrQuad(d, cam, b));
/** the body's outline at height h (corners, clockwise from the top-left) */
export const bodyQuad = (d: FDev, cam: CamW, h: number, grow = 0, dx = 0, dz = 0): Pt[] => {
  const g = grow / d.spec.base, w = BW(d.spec), hh = BH(d.spec);
  return ([[-g, -g], [w + g, -g], [w + g, hh + g], [-g, hh + g]] as [number, number][]).map(([bx, by]) => { const p = worldOf(d, bx, by, h); return P(cam, [p[0] + dx, p[1], p[2] + dz]); });
};
/** the body's rounded outline at height h (corner radius from the spec), grown and shifted on the table (world px) */
export const bodyOutline = (d: FDev, cam: CamW, h: number, grow = 0, dx = 0, dz = 0): Pt[] => {
  const g = grow / d.spec.base, w = BW(d.spec), hh = BH(d.spec), r = d.spec.radius * w + g;
  const cs: [number, number, number][] = [[w - r + g, r - g, -90], [w - r + g, hh - r + g, 0], [r - g, hh - r + g, 90], [r - g, r - g, 180]];
  const pts: Pt[] = [];
  for (const [cx, cy, a0] of cs) for (let k = 0; k <= 6; k++) {
    const a = ((a0 + (k * 90) / 6) * Math.PI) / 180, p = worldOf(d, cx + r * Math.cos(a), cy + r * Math.sin(a), h);
    pts.push(P(cam, [p[0] + dx, p[1], p[2] + dz]));
  }
  return pts;
};
/** the frame box of the whole body (table level to the top face) */
export const bodyBoxF = (d: FDev, cam: CamW) => qbox([...bodyQuad(d, cam, 0), ...bodyQuad(d, cam, d.thick)].map((p) => [p.x, p.y] as [number, number]));
/** frame px per screen CSS px near the body's centre (for raster resolution) */
export const scaleAt = (d: FDev, cam: CamW) => project(cam, d.x, TABLE_Y - d.thick, d.z).s * d.spec.base;
/** the height of a text's letters on the frame: a box of the letter height at the text's place, as projected */
export const letterPx = (d: FDev, cam: CamW, box: number[], letter: number) => { const q = scrBox(d, cam, [box[0], box[1] + (box[3] - letter) / 2, Math.min(box[2], 20), letter]); return q[3] - q[1]; };

/** CSS matrix3d mapping the rectangle (0,0)-(w,h) onto the quad q (homography, transform-origin 0 0) */
export function quadMatrix(w: number, h: number, q: Pt[]) {
  const src = [[0, 0], [w, 0], [w, h], [0, h]];
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], X = q[i].x, Y = q[i].y;
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) { if (r === c) continue; const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const [a, bb, c, d, e, f, g, hh] = b.map((v, i) => v / A[i][i]);
  return `matrix3d(${[a, d, 0, g, bb, e, 0, hh, 0, 0, 1, 0, c, f, 0, 1].map((v) => +v.toFixed(9)).join(",")})`;
}

/** the camera (pitch in degrees, no yaw) that puts screen point (sx, sy) of d at frame (X, Y) with ps frame px per CSS px */
export function camLook(d: FDev, sx: number, sy: number, X: number, Y: number, ps: number, pitch: number): FCam {
  const [px, py, pz] = worldOf(d, d.spec.bez[3] + sx, d.spec.bez[0] + sy, d.thick);
  const s = ps / d.spec.base, p = (pitch * Math.PI) / 180, depth = FL / s, yv = (Y - 960) / s;
  const dy = yv * Math.cos(p) + depth * Math.sin(p), dz = depth * Math.cos(p) - yv * Math.sin(p);
  return { x: px - (X - 540) / s, y: py - dy, z: pz - dz, pitch };
}
export const mixCam = (a: FCam, b: FCam, k: number): FCam => ({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k, pitch: a.pitch + (b.pitch - a.pitch) * k, f: FL });

// light: one soft source at the left, a little towards the far side, about 50 degrees above the table
export const LIGHT = { dx: 0.99, dz: 0.14, cot: 0.84 };
export const CMW = CM;
