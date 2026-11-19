# «Пока подпись видна, ни один элемент не заходит в её рамку» — по реальным пикселям.
#   python checks/check_caption_ink.py GEOMETRY.json FRAMES_NOCAP_DIR [--frames a:b]
# Рамки строк — из выгрузки рендера (geometry_*.json, кадры с видимой подписью, прозрачность ≥ 0,05).
# Кадры отрисованы БЕЗ подписей: всё, что темнее бумаги внутри рамки, — изображение сцены.
# Порог: яркость < 200 (бумага ≈ 225–235; бледные размывки гор ≈ 165–200; тушь < 150).
# Зерно и волокна бумаги дают единичные тёмные точки, поэтому находка — больше 40 пикселей в рамке строки.
import sys, json, os, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("geometry"); ap.add_argument("frames")
ap.add_argument("--frames-range", dest="rng")
ap.add_argument("--thr", type=int, default=200)
ap.add_argument("--min-px", type=int, default=40)
a = ap.parse_args()
d = json.load(open(a.geometry, encoding="utf-8"))
lo, hi = (int(v) for v in a.rng.split(":")) if a.rng else (0, 10 ** 9)
bad, checked, worst = [], 0, {}
for f in d["frames"]:
    n = f["frame"]
    if not lo <= n < hi: continue
    p = os.path.join(a.frames, f"f_{n:06d}.png")
    if not os.path.exists(p): continue
    caps = [c for c in f["caps"] if c["alpha"] >= 0.05]
    if not caps: continue
    im = np.asarray(Image.open(p).convert("L"))
    checked += 1
    for c in caps:
        x0, y0, x1, y1 = (int(round(c[k])) for k in ("x0", "y0", "x1", "y1"))
        r = im[max(0, y0):y1 + 1, max(0, x0):x1 + 1]
        k = int((r < a.thr).sum())
        if k > worst.get(c["str"], (0, 0))[0]: worst[c["str"]] = (k, n)
        if k > a.min_px: bad.append((n, c["str"], k, int(r.min())))
print(f"кадров с подписью проверено: {checked}; строк с изображением в рамке (> {a.min_px} px темнее {a.thr}): {len(bad)}")
by = {}
for n, s, k, mn in bad: by.setdefault(s, []).append((n, k, mn))
for s, v in by.items():
    print(f"  «{s[:34]}»: кадры {v[0][0]}–{v[-1][0]} ({len(v)}), до {max(x[1] for x in v)} px, мин. яркость {min(x[2] for x in v)}")
print("наибольшее по строкам (px, кадр):", {s[:20]: v for s, v in sorted(worst.items(), key=lambda t: -t[1][0])[:6]})
sys.exit(1 if bad else 0)
