"""Детектор вспышек при растворениях и исчезновениях: элемент должен
исчезать МОНОТОННО. Ловит «тает → снова проступает → тает» (класс ошибок:
два противоположных процесса с разными кривыми, например туман sin(π·f)
поверх выцветания туши).

Области:
  A) неподвижные: --box "имя:x0,y0,x1,y1" (можно несколько) + --range FROM:TO кадров;
  B) движущиеся с камерой: --regions regions.json, где на каждый кадр список
     [{"name":..,"x0":..,"y0":..,"x1":..,"y1":..}] (выгружает рендерер).

  python flash_detector.py --frames DIR --box "kanji:250,600,830,1200" --range 2025:2094
  python flash_detector.py --frames DIR --regions regions.json [--from-peak]

Метрика: средняя темнота (225 − L) в области. Вспышка = после падения
≥ max(2, 10 % пика) рост ≥ max(1, 15 % падения, 3 % пика), державшийся
≥ 3 кадров, и затем снова падение ≥ половины роста. Рост без возврата
печатается отдельно — это может быть появление нового элемента (проверьте глазами).
Для честного замера рендерьте без зерна и, если можно, с неподвижной камерой:
наезд камеры меняет темноту в неподвижной рамке.
"""
import argparse, glob, json, os, sys
from PIL import Image
from _common import darkness

ap = argparse.ArgumentParser()
ap.add_argument("--frames", required=True, help="папка с PNG по номеру кадра (f_000123.png или любые, по алфавиту)")
ap.add_argument("--box", action="append", default=[])
ap.add_argument("--range", help="FROM:TO для --box")
ap.add_argument("--regions")
ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--from-peak", action="store_true", help="анализировать только после максимума темноты элемента")
ap.add_argument("--win", type=float, default=2.0)
a = ap.parse_args()

files = sorted(glob.glob(os.path.join(a.frames, "*.png")))
series = {}
if a.box:
    f0, f1 = (map(int, a.range.split(":")) if a.range else (0, len(files)))
    for spec in a.box:
        name, coords = spec.split(":", 1)
        box = tuple(float(v) for v in coords.split(","))
        series[name] = {}
        for n in range(f0, min(f1, len(files))):
            series[name][n] = darkness(Image.open(files[n]).convert("L"), box)
if a.regions:
    per = json.load(open(a.regions, encoding="utf8"))
    for n, regs in enumerate(per):
        if n >= len(files):
            break
        im = None
        for r in regs:
            im = im or Image.open(files[n]).convert("L")
            series.setdefault(r["name"], {})[n] = darkness(im, (r["x0"], r["y0"], r["x1"], r["y1"]))

w = int(a.win * a.fps)
flashes, appear = [], []
for name, s in series.items():
    idx = sorted(i for i, v in s.items() if v is not None)
    if len(idx) < 10:
        continue
    peak = max(idx, key=lambda i: s[i])
    P = s[peak]
    scan = [i for i in idx if (i >= peak or not a.from_peak)]
    for i in scan:
        v = s[i]
        before = [s[j] for j in scan if i - w <= j < i]
        after = [j for j in scan if i < j <= i + w]
        if len(before) < 3 or len(after) < 3:
            continue
        if any(s.get(j) is not None and s[j] < v for j in range(i - 3, i + 4) if j != i):
            continue
        fall = max(before) - v
        if fall < max(2.0, 0.10 * P):
            continue
        jm = max(after, key=lambda j: s[j])
        rise = s[jm] - v
        if rise < max(1.0, 0.15 * fall, 0.03 * P) or sum(1 for j in after if s[j] - v >= 0.6 * rise) < 3:
            continue
        rest = [s[j] for j in scan if jm <= j < jm + w]
        refall = s[jm] - min(rest)
        (flashes if refall >= 0.5 * rise else appear).append((name, i, v, fall, jm, rise, refall))


def show(e):
    n, i, v, fall, jm, rise, refall = e
    return f"  {n}: минимум {v:.2f} на {i / a.fps:.2f} с после падения на {fall:.2f}; рост на {rise:.2f} к {jm / a.fps:.2f} с; затем падение на {refall:.2f}"


print(f"областей: {len(series)}")
print(f"ВСПЫШКИ: {len(flashes)}")
for e in flashes:
    print(show(e))
print(f"рост без возврата (появление? проверьте глазами): {len(appear)}")
for e in appear:
    print(show(e))
sys.exit(1 if flashes else 0)
