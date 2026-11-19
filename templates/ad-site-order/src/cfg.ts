// The template's variables (config.json at the template root) and small helpers.
import C from "../config.json";
export const CFG = C;
export type Accent = [number, number][];
/** the variant of motion and light (config.json «variant»); README «Варианты» lists the combinations checked */
export const V = C.variant as unknown as { enterFrom: "top" | "left" | "right"; mirror: boolean; light: "left" | "right"; drift: "push" | "sweep"; palettePreset: string; cam?: Record<string, number> };
type Pal = { mode: "dark" | "light"; ink: string; panel: string; text: string; accent: string; accentText: string; veil: string; halo?: number[]; table: { full: string; tile: string; photoPx: number[]; worldWidth: number; grade: string; shade?: number } };
export const PALETTE = (C.palettes as unknown as Record<string, Pal>)[V.palettePreset];
if (!PALETTE) throw new Error("config.json variant.palettePreset: no palette " + V.palettePreset);
/** a camera number: REMOTION_<k> or <k> from the environment (only REMOTION_* reach the render; for trying framings),
 *  then config.json variant.cam (the numbers a combination needs, written down), else the default in the code */
export const env = (k: string, d: number) => { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}; const c = V.cam?.[k]; return Number(e["REMOTION_" + k] || e[k] || (c ?? d)); };
/** «Заказ №{n} оформлен» with the order number filled in */
export const fmt = (s: string) => s.replace("{n}", CFG.order.number);
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const exact = (s: string) => new RegExp("^" + esc(s) + "$");
/** "#rrggbb" + alpha -> rgba() */
export const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
