// Обход всех текстовых узлов кадра (TreeWalker), плюс title, aria-label, alt, placeholder.
// Для каждого: текст, рамка в кадре, кегль, шрифт, цвет, видимость (opacity по цепочке), роль ближайшего [data-role].
export function audit(frame: number) {
  const out: unknown[] = [];
  const root = document.body;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const text = (n.textContent ?? "").trim();
    if (!text) continue;
    const el = n.parentElement!;
    const r = document.createRange(); r.selectNodeContents(n);
    const rects = Array.from(r.getClientRects());
    if (!rects.length) continue;
    const x0 = Math.min(...rects.map((q) => q.left)), y0 = Math.min(...rects.map((q) => q.top));
    const x1 = Math.max(...rects.map((q) => q.right)), y1 = Math.max(...rects.map((q) => q.bottom));
    const cs = getComputedStyle(el);
    let op = 1; let e: HTMLElement | null = el;
    while (e) { op *= Number(getComputedStyle(e).opacity); e = e.parentElement; }
    const role = (el.closest("[data-role]") as HTMLElement | null)?.dataset.role ?? "none";
    // ближайший обрезающий предок: текст за его краем срезан
    let clip: number[] | null = null; let c: HTMLElement | null = el.parentElement;
    while (c && c !== document.body) {
      if (getComputedStyle(c).overflow === "hidden") { const q = c.getBoundingClientRect(); clip = [q.left, q.top, q.right, q.bottom].map((v) => Math.round(v)); break; }
      c = c.parentElement;
    }
    out.push({ text, clip, box: [x0, y0, x1, y1].map((v) => Math.round(v)), fs: parseFloat(cs.fontSize), ff: cs.fontFamily, fw: cs.fontWeight, color: cs.color, op: Math.round(op * 100) / 100, role });
  }
  // рамка маскота: все слои (руки, дуги «дзинь») должны быть в кадре
  document.querySelectorAll('[data-role="mascot"]').forEach((m) => {
    const q = (m as SVGGraphicsElement).getBoundingClientRect();
    out.push({ text: "#маскот", box: [q.left, q.top, q.right, q.bottom].map((v) => Math.round(v)), role: "mascot", op: 1 });
  });
  for (const a of ["title", "aria-label", "alt", "placeholder"]) {
    document.querySelectorAll(`[${a}]`).forEach((q) => out.push({ text: q.getAttribute(a), attr: a, role: "attr" }));
  }
  // лог Remotion обрезает длинные строки: по строке на узел, потом итог с числом узлов для сверки
  out.forEach((o) => console.log("AUDITN" + JSON.stringify(o)));
  console.log("AUDITEND" + JSON.stringify({ frame, count: out.length }));
}
