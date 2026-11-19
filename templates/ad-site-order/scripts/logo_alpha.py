"""The studio's logo for the card: a transparent PNG from a logo on white (or any flat background colour).
Every pixel p = a*L + (1-a)*W (L: the logo's colour, W: the background), a solved by least squares over RGB, so the shape
and the colour stay exactly as given and only the background goes; cropped to the ink + 8 px. A logo that already has
transparency is only cropped. Prints the size to put into config.json card.logoPx.
python scripts/logo_alpha.py LOGO.png [--color #RRGGBB] [--out public/brand/logo_alpha.png]"""
import os, sys
import numpy as np
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
src = sys.argv[1]
out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else os.path.join(ROOT, "public/brand/logo_alpha.png")
im = Image.open(src)
if im.mode == "RGBA" and np.asarray(im)[..., 3].min() < 250:
    a = np.asarray(im).astype(np.float64) / 255; al = a[..., 3]; rgb = a[..., :3]
    L = rgb[al > 0.9].mean(0)
else:
    rgb = np.asarray(im.convert("RGB")).astype(np.float64) / 255
    W = np.median(np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]]), axis=0)  # the background from the border
    if "--color" in sys.argv:
        hx = sys.argv[sys.argv.index("--color") + 1].lstrip("#"); L = np.array([int(hx[i:i + 2], 16) for i in (0, 2, 4)]) / 255
    else:
        far = np.abs(rgb - W).sum(-1); L = rgb[far > np.percentile(far, 99.5)].mean(0)
    d = L - W; al = np.clip(((rgb - W) @ d) / (d @ d), 0, 1); al[al < 0.02] = 0
ys, xs = np.where(al > 0.02); y0, y1, x0, x1 = max(0, ys.min() - 8), ys.max() + 9, max(0, xs.min() - 8), xs.max() + 9
o = np.zeros((y1 - y0, x1 - x0, 4), np.uint8); o[..., :3] = (L * 255).round().astype(np.uint8); o[..., 3] = (al[y0:y1, x0:x1] * 255).round().astype(np.uint8)
os.makedirs(os.path.dirname(out), exist_ok=True); Image.fromarray(o, "RGBA").save(out)
print(f"{out}: {o.shape[1]} x {o.shape[0]} px (config.json card.logoPx: [{o.shape[1]}, {o.shape[0]}]), colour #{''.join(f'{int(round(c * 255)):02X}' for c in L)}")
