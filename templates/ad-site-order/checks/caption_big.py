"""Large captions (block E): for every caption on the given frames
 - the capital height of its first line (first glyph of the first line, a capital in each of our captions) at a 360 px
   wide view >= 20 px;
 - at most two lines; inside x 65..1015 and y 269..1248;
 - contrast >= 7:1 of the cream text and of the brass-2 key words against the background right around the text.
python caption_big.py MASK.png FRAME.png [MASK.png FRAME.png ...] [--bad]
  --bad: a known bad input: the background around the text painted a mid brown #8A6A4E"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
sys.stdout.reconfigure(encoding="utf-8")
args = [a for a in sys.argv[1:] if a != "--bad"]; bad = "--bad" in sys.argv
def lum(c):
    c = np.asarray(c, float) / 255; c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4); return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]
def ratio(a, b):
    la, lb = lum(a), lum(b); return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
fails = []
for mpath, fpath in zip(args[0::2], args[1::2]):
    m = np.asarray(Image.open(mpath).convert("L")) > 128; img = np.asarray(Image.open(fpath).convert("RGB")).astype(float)
    m[1250:] = False  # the caption block only (the card has more lines below: checked as the card)
    rows = np.where(m.any(1))[0]
    if not len(rows): continue
    lines, s = [], rows[0]
    for a, b in zip(rows, rows[1:]):
        if b - a > 14: lines.append((s, a)); s = b
    lines.append((s, rows[-1]))
    y0, y1 = lines[0]; cols = np.where(m[y0:y1 + 1].any(0))[0]; gap = np.where(np.diff(cols) > 1)[0]
    g = np.where(m[y0:y1 + 1, cols[0]:(cols[gap[0]] if len(gap) else cols[-1]) + 1].any(1))[0]
    run = np.split(g, np.where(np.diff(g) > 1)[0] + 1)[0]  # the first glyph only (not a glyph of the next line below it)
    cap = (run[-1] - run[0] + 1) / 3
    ys, xs = np.where(m); bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()
    text = ndimage.binary_erosion(m, iterations=1)
    ring = np.zeros_like(m); ring[max(0, by0 - 24):by1 + 24, max(0, bx0 - 24):bx1 + 24] = True; ring &= ~ndimage.binary_dilation(m, iterations=6)
    if bad: img[ring] = [0x8A, 0x6A, 0x4E]
    px = img[text]; warm = (px[:, 0] - px[:, 2] > 60)  # brass-2 key words vs cream
    bg = img[ring].mean(0)
    rc = ratio(px[~warm].mean(0), bg) if (~warm).any() else None; rb = ratio(px[warm].mean(0), bg) if warm.any() else None
    ok_zone = by0 >= 269 and by1 <= 1248 and bx0 >= 65 and bx1 <= 1015
    msg = f"{fpath.split('/')[-1]}: {len(lines)} lines, capital {cap:.1f} px at 360, box x {bx0}-{bx1} y {by0}-{by1}, contrast cream {rc:.1f}:1" + (f", key words {rb:.1f}:1" if rb else "")
    bads = []
    if cap < 20: bads.append("capital < 20 px")
    if len(lines) > 2: bads.append("more than two lines")
    if not ok_zone: bads.append("outside the zone")
    if rc is not None and rc < 7: bads.append("cream contrast < 7")
    if rb is not None and rb < 7: bads.append("key words contrast < 7")
    print(("   FAIL " if bads else "   ok   ") + msg + (f"  {bads}" if bads else ""))
    fails += bads
print("OK" if not fails else f"FAIL: {len(fails)}")
sys.exit(0 if not fails else 1)
