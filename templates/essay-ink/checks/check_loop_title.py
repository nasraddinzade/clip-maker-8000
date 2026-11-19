# Петля: название первой сцены (кадр 0) не ложится поверх туши или красного финала.
#   python checks/check_loop_title.py --finale КАДР_ФИНАЛА.png --geom geometry.json [--label имя]
# КАДР_ФИНАЛА — кадр финала без смешения, последний перед петлёй (кадров всего − timing.loopFrames − 1).
# Рамки строк кадра 0 (название и подзаголовок) берутся из geometry (caps кадра 0), с запасом 12 px.
# Под рамкой в кадре финала считаются «тушь» — пиксели темнее бумаги больше чем на 15 (яркость 0–255;
# бумага = медиана яркости кадра) — и «красное» — пиксели в допуске 60 от цветов --red (печать, логотип).
# Требование: в каждой рамке тушь ≤ 0,5 % и красного 0. Код 1 — иначе.
import sys, json, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser(); ap.add_argument("--finale", required=True); ap.add_argument("--geom", required=True); ap.add_argument("--label", default=""); ap.add_argument("--red", default="BE4522,B73D31")
a = ap.parse_args()
im = np.asarray(Image.open(a.finale).convert("RGB"), np.int32)
L = im.mean(2); paper = np.median(L)
ink = L < paper - 15
RED = [[int(h[i:i + 2], 16) for i in (0, 2, 4)] for h in a.red.split(",")]
red = np.zeros(im.shape[:2], bool)
for c in RED: red |= np.sqrt(((im - c) ** 2).sum(2)) <= 60
g = json.load(open(a.geom, encoding="utf-8"))
f0 = min(g["frames"], key=lambda f: f["frame"])
boxes = [c for c in f0["caps"] if c.get("alpha", 1) > 0.05]
bad = []
for c in boxes:
    x0, y0, x1, y1 = (int(round(v)) for v in (c["x0"] - 12, c["y0"] - 12, c["x1"] + 12, c["y1"] + 12))
    x0, y0 = max(0, x0), max(0, y0)
    i = ink[y0:y1, x0:x1].mean() * 100; r = int(red[y0:y1, x0:x1].sum())
    print(f"   строка кадра 0 «{c.get('str', '')[:24]}» x {x0}–{x1}, y {y0}–{y1}: тушь финала под ней {i:.2f} %, красных пикселей {r}")
    if i > 0.5 or r: bad.append(c.get("str", "")[:24])
print(f"{a.label}: " + ("ок — название ложится на чистую бумагу" if not bad else "НЕ ПРОШЛО — под строками " + ", ".join(f"«{b}»" for b in bad)))
sys.exit(1 if bad else 0)
