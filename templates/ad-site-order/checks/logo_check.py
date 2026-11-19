"""Logo on the card (block D): measured on a rendered card frame and its white-on-black mask.
 - the word's ink width >= 40 % of the frame (432 px), inside the Reels zone (y 14-65 %, x >= 6 % from each side);
 - the thinnest stroke at a 360 px wide view >= 1 px (distance transform of the ink, 5th percentile of the ridge);
 - contrast of the logo colour against the background right around it >= 3:1 (WCAG relative luminance);
 - the logo colour as given (--color #RRGGBB, the colour logo_alpha.py printed) within 6 per channel on the opaque core.
python logo_check.py FRAME.png MASK.png [--color #RRGGBB] [--bad]   (--bad: the background around the logo painted mid-brown #7A4A30)"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.stdout.reconfigure(encoding="utf-8")
img = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float64)
mask = np.asarray(Image.open(sys.argv[2]).convert("L")) > 128
# the logo is the topmost text block of the card mask; take the connected rows from the first ink row to the first gap
rows = np.where(mask.any(1))[0]; top = rows[0]; end = top
for r0, r1 in zip(rows, rows[1:]):
    if r1 - r0 > 12: end = r0; break
lm = np.zeros_like(mask); lm[top:end + 1] = mask[top:end + 1]
ys, xs = np.where(lm); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
if "--bad" in sys.argv:
    ring = np.zeros_like(lm); ring[max(0, y0 - 40):y1 + 40, max(0, x0 - 40):x1 + 40] = True; ring &= ~ndimage.binary_dilation(lm, iterations=3)
    img[ring] = [0x7A, 0x4A, 0x30]
fails = []
w = x1 - x0 + 1
print(f"logo ink x {x0}-{x1} ({w} px = {w / 1080 * 100:.0f} % of the width), y {y0}-{y1}")
if w < 432: fails.append("narrower than 40 %")
if not (y0 >= 269 and y1 <= 1248 and x0 >= 65 and x1 <= 1015): fails.append("outside the Reels zone"); print("   FAIL outside the zone")
core = ndimage.binary_erosion(lm, iterations=3)
dt = ndimage.distance_transform_edt(lm); ridge = (dt == ndimage.maximum_filter(dt, 5)) & (dt > 1)
stroke = np.percentile(2 * dt[ridge], 5) / 3
print(f"thinnest stroke at 360 px: {stroke:.1f} px")
if stroke < 1: fails.append("stroke under 1 px at 360")
def lum(c):
    c = c / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
fg = img[core].mean(0)
ring = np.zeros_like(lm); ring[max(0, y0 - 40):y1 + 40, max(0, x0 - 40):x1 + 40] = True; ring &= ~ndimage.binary_dilation(lm, iterations=6)
bg = img[ring].mean(0); Lf, Lb = lum(fg), lum(bg)
ratio = (max(Lf, Lb) + 0.05) / (min(Lf, Lb) + 0.05)
print(f"logo colour {fg.round().astype(int).tolist()}, background around it {bg.round().astype(int).tolist()}, contrast {ratio:.2f}:1")
if ratio < 3: fails.append(f"contrast {ratio:.2f}:1")
if "--color" in sys.argv:
    hx = sys.argv[sys.argv.index("--color") + 1].lstrip("#"); want = [int(hx[i:i + 2], 16) for i in (0, 2, 4)]
    if np.abs(fg - want).max() > 6: fails.append("logo colour changed")
print("OK" if not fails else f"FAIL: {fails}")
sys.exit(0 if not fails else 1)
