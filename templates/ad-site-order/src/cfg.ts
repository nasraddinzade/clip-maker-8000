// The template's variables (config.json at the template root) and small helpers.
import C from "../config.json";
export const CFG = C;
export type Accent = [number, number][];
/** «Заказ №{n} оформлен» with the order number filled in */
export const fmt = (s: string) => s.replace("{n}", CFG.order.number);
export const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const exact = (s: string) => new RegExp("^" + esc(s) + "$");
