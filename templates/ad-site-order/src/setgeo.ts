// Scene constants and the palette (config.json «palettes», the one chosen in variant.palettePreset).
import { PALETTE, V } from "./cfg";
const dark = PALETTE.mode === "dark";
// screens: ink, panel, text, accent; captions, card and cover: capText / capAccent on the veil (dark text on a light veil
// in a light palette); capShadow: the soft halo around caption letters
export const PAL = { ink: PALETTE.ink, panel: PALETTE.panel, text: PALETTE.text, accent: PALETTE.accent, capText: PALETTE.text, capAccent: PALETTE.accentText, veil: PALETTE.veil, dark, halo: PALETTE.halo ?? [0.62, 0.38],
  capShadow: dark ? "0 2px 12px rgba(0,0,0,0.55)" : "0 2px 12px rgba(255,255,255,0.6)" };
export const TABLE = PALETTE.table;
/** +1: the source at the left of the frame, -1: at the right (variant.light; mirror does not change it) */
export const LSIDE = V.light === "right" ? -1 : 1;
/** +1 / -1: the world mirrored left-right (variant.mirror): device places and yaw, the wood under them; screens never */
export const MIR = V.mirror ? -1 : 1;
export const KEY: [number, number, number] = [217, 192, 138]; // the soft key light's tint on device edges
export const TABLE_Y = 1200; // the table top, world y grows downwards
export const CM = 29; // world px per cm: the phone body is 435 world px = 15 cm
