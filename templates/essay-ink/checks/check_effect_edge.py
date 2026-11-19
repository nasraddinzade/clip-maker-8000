# Эффект по краю массы (тлеет, светится, растекается) — сплошная обводка или живая кромка с разрывами.
# Метрика по разнице с рендером без эффекта, а не по цвету (video-qa): из «Пяти колец» (тлеющий край ночи Огня).
#   python checks/check_effect_edge.py --on ON.png --off OFF.png [--label имя] [--lo 30 --hi 50]
# ON — кадр с эффектом, OFF — тот же кадр без эффекта (сцена выключает эффект по параметру страницы,
# например npm run snap -- --frames N --q "edge=none"), всё прочее одинаково.
# Кромка = пиксели, где кадры различаются больше порога T по любому каналу (T = 8 / 15 / 25).
# Искры вне 40 px от контура не мешают: оба способа смотрят только у границы массы.
# Масса = кадр без огня темнее 205, крупнейшая связная область, дыры залиты.
#  A. Лучи: 720 лучей из центра массы; на луче берётся последний пиксель массы; кромка есть, если в окне
#     −14…+6 px вдоль луча есть пиксель кромки. Разрывы = доля лучей без кромки.
#  B. Куски контура: граница массы (масса минус эрозия 2 px) делится на 72 куска по углу; кусок покрыт,
#     если больше половины его пикселей лежит в 8 px от кромки. Разрывы = доля непокрытых кусков.
# v12: то же отдельно по четырём сторонам (по углу от центра: право −45…45°, низ 45…135°, лево 135…225°, верх 225…315°);
# в итог идёт худшая сторона. Код 1, если хоть одна цифра (по сторонам) вне [lo, hi].
import sys, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np, cv2
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser(); ap.add_argument("--on", required=True); ap.add_argument("--off", required=True)
ap.add_argument("--label", default=""); ap.add_argument("--lo", type=float, default=30); ap.add_argument("--hi", type=float, default=50)
a = ap.parse_args()
on = np.asarray(Image.open(a.on).convert("RGB"), np.int16); off = np.asarray(Image.open(a.off).convert("RGB"), np.int16)
L = off.mean(2)
m = L < 205
lab, n = ndimage.label(m); sizes = ndimage.sum(m, lab, range(1, n + 1)); m = ndimage.binary_fill_holes(lab == 1 + int(np.argmax(sizes)))
m = ndimage.binary_opening(m, iterations=2)
ys, xs = np.nonzero(m); cy, cx = ys.mean(), xs.mean()
diff = np.abs(on - off).max(2)
border = m & ~ndimage.binary_erosion(m, iterations=2)
by, bx = np.nonzero(border); bang = np.arctan2(by - cy, bx - cx)
SIDES = {"право": (-45, 45), "низ": (45, 135), "лево": (135, 225), "верх": (225, 315)}
def side_of(deg):
    d = (deg + 360) % 360
    for k, (a0, a1) in SIDES.items():
        if (a0 % 360 <= d < a1 % 360) if a0 >= 0 else (d >= 315 or d < 45): return k
    return "право"
res = []; per = {k: [] for k in SIDES}
for T in (8, 15, 25):
    rim = diff > T
    # A: лучи
    hit = tot = 0; sh = {k: [0, 0] for k in SIDES}
    for ang in np.linspace(-np.pi, np.pi, 720, endpoint=False):
        r = np.arange(40, 900); px = (cx + np.cos(ang) * r).astype(int); py = (cy + np.sin(ang) * r).astype(int)
        ok = (px >= 0) & (px < m.shape[1]) & (py >= 0) & (py < m.shape[0]); px, py = px[ok], py[ok]
        inside = np.nonzero(m[py, px])[0]
        if not len(inside): continue
        e = inside[-1]; sl = slice(max(0, e - 14), min(len(px), e + 7))
        h_ = int(rim[py[sl], px[sl]].any()); tot += 1; hit += h_
        k_ = side_of(np.degrees(ang)); sh[k_][0] += h_; sh[k_][1] += 1
    gA = 100 - 100 * hit / tot
    # B: куски контура
    near = cv2.dilate(rim.astype(np.uint8), np.ones((17, 17), np.uint8)) > 0
    cov = near[by, bx]
    pieces = np.floor((bang + np.pi) / (2 * np.pi) * 72).astype(int)
    covered = [cov[pieces == k].mean() > 0.5 for k in range(72) if (pieces == k).any()]
    gB = 100 - 100 * np.mean(covered)
    res.append((T, gA, gB))
    pdeg = np.degrees(bang)
    for k_ in SIDES:
        msk = np.array([side_of(d) == k_ for d in pdeg])
        pk = pieces[msk]; cv = cov[msk]
        cb = [cv[pk == q].mean() > 0.5 for q in np.unique(pk)]
        per[k_].append((T, 100 - 100 * sh[k_][0] / max(1, sh[k_][1]), 100 - 100 * np.mean(cb) if cb else 100))
ok = all(a.lo <= g <= a.hi for k_ in per for _, gA, gB in per[k_] for g in (gA, gB))
worst = max(((abs(g - (a.lo + a.hi) / 2), k_, T, g) for k_ in per for T, gA, gB in per[k_] for g in (gA, gB)))
for k_ in per:
    print(f"   {k_:5s}: " + "; ".join(f"п{T}: лучи {gA:.0f}, куски {gB:.0f}" for T, gA, gB in per[k_]))
print(f"   худшая сторона: {worst[1]}, порог {worst[2]}, разрывы {worst[3]:.0f} %")
print(f"{a.label or a.on}: разрывы кромки, % контура — " + "; ".join(f"порог {T}: лучи {gA:.0f}, куски {gB:.0f}" for T, gA, gB in res)
      + f" → {'в диапазоне' if ok else 'ВНЕ диапазона'} {a.lo:.0f}–{a.hi:.0f}")
sys.exit(0 if ok else 1)
