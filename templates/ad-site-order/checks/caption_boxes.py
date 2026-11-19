"""Caption boxes by pixels from the mask render (our texts only, white on black, quarter size), per frame and per line,
in the format of tools/caption_margins.py; plus how long each phrase is on screen against the norm words/2.5 + 0.4 s.
  python caption_boxes.py MASK_DIR out.json [--scale 4] [--bad]
--bad moves every box 400 px down first (a known bad input for caption_margins).
"""
import argparse, glob, json, sys
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
ap = argparse.ArgumentParser()
ap.add_argument("mask")
ap.add_argument("out")
ap.add_argument("--scale", type=float, default=4)
ap.add_argument("--bad", action="store_true")
ap.add_argument("--spans", help="look9: the phrases of a test clip, 'text|t0|t1|words;...' (seconds), instead of the reel's table")
a = ap.parse_args()
# what is on screen when (reel seconds) and how many words it has; from scene.ts
SPANS = []  # pass --spans "text|t0|t1|words;..." (seconds)
if a.spans:
    SPANS = [(x.split("|")[0], float(x.split("|")[1]), float(x.split("|")[2]), int(x.split("|")[3])) for x in a.spans.split(";")]
label = lambda t: next((s[0] for s in SPANS if s[1] <= t < s[2]), "?")
boxes, seen = [], {}
for f in sorted(glob.glob(a.mask + "/*.png")):
    n = int(f.split("-")[-1][:-4])
    m = np.asarray(Image.open(f).convert("L")) > 100
    if not m.any(): continue
    t = n / 30
    seen.setdefault(label(t), []).append(n)
    rows = np.where(m.any(axis=1))[0]
    # split into lines by empty row gaps
    groups, cur = [], [rows[0]]
    for r in rows[1:]:
        if r - cur[-1] > 2: groups.append(cur); cur = [r]
        else: cur.append(r)
    groups.append(cur)
    for g in groups:
        sub = m[g[0]:g[-1] + 1]
        cols = np.where(sub.any(axis=0))[0]
        x0, x1 = cols.min() * a.scale, (cols.max() + 1) * a.scale
        y0, y1 = g[0] * a.scale, (g[-1] + 1) * a.scale
        if a.bad: y0, y1 = y0 + 400, y1 + 400
        boxes.append({"frame": n, "x0": float(x0), "y0": float(y0), "x1": float(x1), "y1": float(y1), "text": label(t)})
json.dump(boxes, open(a.out, "w", encoding="utf-8"), ensure_ascii=False)
print(f"{len(boxes)} line boxes in {len({b['frame'] for b in boxes})} frames -> {a.out}")
ok = True
for name, t0, t1, words in SPANS:
    fr = seen.get(name, [])
    if not fr: print(f"  «{name}»: not seen"); ok = False; continue
    dur = (max(fr) - min(fr) + 1) / 30
    need = words / 2.5 + 0.4 if name != "карточка контакта" else 2.5
    flag = "ok" if dur >= need else "SHORT"
    if dur < need: ok = False
    print(f"  «{name}»: {min(fr) / 30:.2f}-{(max(fr) + 1) / 30:.2f} s, {dur:.2f} s on screen, norm {need:.2f} s -> {flag}")
sys.exit(0 if ok else 1)
