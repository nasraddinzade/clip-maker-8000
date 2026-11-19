# «Под подписью бумага без волокон»: на кадрах БЕЗ подписей внутри рамок строк считается доля пикселей,
# где полосовой фильтр (размытие 1,5 px минус размытие 6 px) больше 2 по яркости. Пиксельное зерно бумаги
# фильтр гасит, вытянутые волокна оставляет. Калибровка на одних и тех же кадрах: с маской ≤ 0,02 %,
# без маски 0,11–0,63 % → порог 0,05 %.
#   python checks/check_paper_clean.py GEOMETRY.json FRAMES_NOCAP [--bad DIR_NOCAP_БЕЗ_МАСКИ] [--max 0.05] [--step 15]
import sys, json, os, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument("geometry"); ap.add_argument("nocap")
ap.add_argument("--bad", help="кадры без подписей, отрисованные без маски (плохой вход)")
ap.add_argument("--max", type=float, default=0.05, help="допустимая доля, проценты")
ap.add_argument("--step", type=int, default=15)
a = ap.parse_args()
d = json.load(open(a.geometry, encoding="utf-8"))
byf = {f["frame"]: f for f in d["frames"]}


def fiber_share(path, boxes):
    im = Image.open(path).convert("L")
    bp = np.asarray(im.filter(ImageFilter.GaussianBlur(1.5)), np.float32) - np.asarray(im.filter(ImageFilter.GaussianBlur(6)), np.float32)
    v = np.concatenate([bp[max(0, int(c["y0"])):int(c["y1"]), max(0, int(c["x0"])):int(c["x1"])].ravel() for c in boxes])
    return 100 * float((np.abs(v) > 2).mean())


def boxes_of(n): return [c for c in byf[n]["caps"] if c["alpha"] >= 0.9]


if a.bad:
    bad = {}
    for fn in sorted(os.listdir(a.bad)):
        n = int(fn[2:8])
        if n in byf and boxes_of(n): bad[n] = round(fiber_share(os.path.join(a.bad, fn), boxes_of(n)), 2)
    print(f"плохой вход (без маски): {bad} → выше {a.max} %: {sum(v > a.max for v in bad.values())} из {len(bad)}")
res = []
for f in d["frames"][::a.step]:
    if not boxes_of(f["frame"]): continue
    p = os.path.join(a.nocap, f"f_{f['frame']:06d}.png")
    if os.path.exists(p): res.append((f["frame"], fiber_share(p, boxes_of(f["frame"]))))
viol = [(n, round(v, 2)) for n, v in res if v > a.max]
print(f"кадров с подписью проверено: {len(res)}; доля волокон под подписью: медиана {np.median([v for _, v in res]):.3f} %, "
      f"максимум {max(v for _, v in res):.3f} %; выше {a.max} %: {len(viol)} {viol[:8]}")
sys.exit(1 if viol else 0)
