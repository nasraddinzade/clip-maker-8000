# Бюджет киновари: доля площади красного в кадре и «печать — самый яркий красный».
#   python checks/check_cinnabar.py FRAME.png [FRAME.png ...] --seal x0,y0,x1,y1 [--bad]
# Красный пиксель: R > 110, R − G > 45, R − B > 45. Яркость красного — насыщенность R − max(G, B).
# Для печати берётся 95-й перцентиль насыщенности внутри её рамки, для остального кадра — 99,5-й
# (несколько случайных пикселей не решают). Печать должна быть ярче.
# --bad: заведомо плохой вход — в копию кадра вне печати дорисовывается яркое красное пятно 30 px.
import sys, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image, ImageDraw
ap = argparse.ArgumentParser(); ap.add_argument("frames", nargs="+"); ap.add_argument("--seal", required=True); ap.add_argument("--bad", action="store_true")
a = ap.parse_args()
x0, y0, x1, y1 = (int(v) for v in a.seal.split(","))
ok = True
for f in a.frames:
    im = Image.open(f).convert("RGB")
    if a.bad:
        ImageDraw.Draw(im).ellipse((200, 1500, 230, 1530), fill=(230, 40, 30))
    rgb = np.asarray(im, np.int16)
    R, G, B = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    red = (R > 110) & (R - G > 45) & (R - B > 45)
    sat = R - np.maximum(G, B)
    seal = np.zeros_like(red); seal[y0:y1, x0:x1] = True
    out = red & ~seal
    share = 100 * out.mean()
    s_seal = np.percentile(sat[red & seal], 95) if (red & seal).any() else 0
    s_out = np.percentile(sat[out], 99.5) if out.sum() > 20 else 0
    good = s_seal > s_out
    ok &= good
    print(f"{f}: киноварь вне печати {share:.3f} % кадра ({int(out.sum())} px); насыщенность печати {s_seal:.0f}, "
          f"самого яркого красного вне печати {s_out:.0f} → {'печать ярче' if good else 'НЕ ПРОШЛО: вне печати красный ярче'}")
sys.exit(0 if ok else 1)
