// Типографика: шрифт подписей из config.json (fonts), разрядка по буквам.
// p5 WEBGL не умеет letter-spacing — ставим буквы по одной.

export const TEXT_INK = [38, 33, 29];
export const IDEA_INK = [22, 19, 17];

// textWidth(" ") в WEBGL у p5 бывает 0 — ширину пробела задаём сами.
const cw = (p, ch) => (ch === " " ? p.textSize() * 0.3 : p.textWidth(ch));

export function trackedWidth(p, str, tracking) {
  let w = 0;
  for (const ch of str) w += cw(p, ch) + tracking;
  return w - tracking;
}

/**
 * Текст с разрядкой. tracking — в долях кегля (0.18 = широкая).
 * align: "left" | "center" | "right".
 */
export function trackedText(p, str, x, y, { font, size = 30, tracking = 0.2, align = "left", alpha = 1, color = TEXT_INK, reveal = 1, maxWidth = 0 } = {}) {
  if (alpha <= 0.002 || !str) return;
  p.push();
  p.noStroke();
  p.textFont(font);
  p.textSize(size);
  // строка должна поместиться в одну строку: при необходимости чуть уменьшаем кегль
  if (maxWidth > 0) {
    let w = trackedWidth(p, str, tracking * size);
    if (w > maxWidth) { size *= maxWidth / w; p.textSize(size); }
  }
  p.textAlign(p.LEFT, p.BASELINE);
  const tr = tracking * size;
  const total = trackedWidth(p, str, tr);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  // режим замера (проверка полей): только записываем рамку строки
  if (globalThis.__capMeasure) {
    globalThis.__capMeasure.push({ str, x0: cx, x1: cx + total, y0: y - size, y1: y + size * 0.3, alpha });
    p.pop();
    return;
  }
  const chars = [...str];
  chars.forEach((ch, i) => {
    // проявление по буквам слева направо, мягко
    const k = Math.max(0, Math.min(1, reveal * (chars.length + 4) - i)) ;
    const a = alpha * Math.min(1, k / 4 + (reveal >= 1 ? 1 : 0));
    if (a > 0.002) {
      p.fill(color[0], color[1], color[2], 255 * Math.min(1, a));
      p.text(ch, cx, y);
    }
    cx += cw(p, ch) + tr;
  });
  p.pop();
}

/** Вертикальная строка (по букве в столбик) — для подписи у иероглифа. */
export function verticalText(p, str, x, y, { font, size = 26, gap = 0.55, alpha = 1, color = TEXT_INK } = {}) {
  if (alpha <= 0.002) return;
  p.push();
  p.noStroke();
  p.textFont(font);
  p.textSize(size);
  p.textAlign(p.CENTER, p.BASELINE);
  p.fill(color[0], color[1], color[2], 255 * alpha);
  let yy = y;
  for (const ch of str) {
    if (ch === " ") { yy += size * 0.6; continue; }
    p.text(ch, x, yy);
    yy += size * (1 + gap);
  }
  p.pop();
}
