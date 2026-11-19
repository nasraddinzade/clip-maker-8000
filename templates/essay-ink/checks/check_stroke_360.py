# Толщина штриха букв в масштабе 360 px по ширине (CLAUDE.md, «Подписи»: штрих не тоньше 1 px).
#   python checks/check_stroke_360.py --font public/fonts/CormorantGaramond-Medium.ttf --size 30 --text Studio
#   python checks/check_stroke_360.py --image кадр.png --box x0,y0,x1,y1 [--ink 0,0,0]
# Буквы рисуются (или берутся из кадра) в 1080 px, тушь = покрытие ≥ 0,5. По каждой строке пикселей
# покрытие усредняется блоками 3×3 (1080 → 360), по строкам и столбцам меряются отрезки туши; толщина отрезка —
# сумма покрытия в нём (подпиксельно), толщина штриха в точке — меньший из двух отрезков.
# Сводка: медиана и 25-й процентиль толщины по точкам туши. Требование: медиана ≥ 1,0 px в 360 px
# (основной штрих; волосные линии и засечки Гарамона тоньше, у принятой подписи финала 66 px 25-й процентиль 0,88). Код 1 — иначе.
import sys, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument("--font"); ap.add_argument("--size", type=float); ap.add_argument("--text", default="Studio")
ap.add_argument("--tracking", type=float, default=0.0)
ap.add_argument("--image"); ap.add_argument("--box"); ap.add_argument("--paper", type=float, default=0)
ap.add_argument("--label", default="")
a = ap.parse_args()
if a.image:
    x0, y0, x1, y1 = map(int, a.box.split(","))
    im = np.asarray(Image.open(a.image).convert("L"), float)[y0:y1, x0:x1]
    paper = a.paper or np.percentile(im, 90)
    cov = np.clip((paper - im) / max(paper - im.min(), 1), 0, 1)
else:
    f = ImageFont.truetype(a.font, int(round(a.size * 4)))  # 4× для точного покрытия
    W = int(a.size * 4 * (len(a.text) + 2)); H = int(a.size * 4 * 2)
    img = Image.new("L", (W, H), 0); d = ImageDraw.Draw(img)
    x = a.size * 4 * 0.5
    for ch in a.text:
        d.text((x, a.size * 4 * 0.3), ch, font=f, fill=255); x += f.getlength(ch) + a.tracking * a.size * 4
    img = img.resize((W // 4, H // 4), Image.LANCZOS)
    cov = np.asarray(img, float) / 255
# в масштаб 360 px: среднее по блокам 3×3 (покрытие сохраняется)
hh, ww = cov.shape[0] // 3 * 3, cov.shape[1] // 3 * 3
c3 = cov[:hh, :ww].reshape(hh // 3, 3, ww // 3, 3).mean((1, 3))
def runs(m):
    # отрезок = подряд идущие пиксели с покрытием > 0,08; толщина отрезка = сумма покрытия в нём (подпиксельно)
    out = np.zeros(m.shape)
    for i, row in enumerate(m):
        j = 0; n = len(row)
        while j < n:
            if row[j] > 0.08:
                k = j
                while k < n and row[k] > 0.08: k += 1
                out[i, j:k] = row[j:k].sum(); j = k
            else: j += 1
    return out
core = c3 >= 0.35
t = np.minimum(runs(c3), runs(c3.T).T)[core]
ys = np.nonzero((cov >= 0.5).any(1))[0]
height = (ys.max() - ys.min() + 1) if len(ys) else 0
p25, med = (np.percentile(t, 25), np.median(t)) if len(t) else (0, 0)
ok = med >= 1.0
print(f"{a.label}: высота букв {height} px (в 360 px {height / 3:.1f}); штрих в 360 px: медиана {med:.2f}, 25-й процентиль {p25:.2f} — "
      + ("ок (медиана ≥ 1 px)" if ok else "НЕ ПРОШЛО (медиана < 1 px)"))
sys.exit(0 if ok else 1)
