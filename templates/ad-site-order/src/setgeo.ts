// Scene constants and the palette (config.json «palette», from the site's CSS).
import { CFG } from "./cfg";
export const PAL = { ink: CFG.palette.ink, panel: CFG.palette.panel, cream: CFG.palette.cream, brass: CFG.palette.brass, brass2: CFG.palette.brass2 };
export const KEY: [number, number, number] = [217, 192, 138]; // the soft key light's tint on device edges
export const TABLE_Y = 1200; // the table top, world y grows downwards
export const CM = 29; // world px per cm: the phone body is 435 world px = 15 cm
