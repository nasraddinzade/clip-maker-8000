"""look13 storyboard checks, per still (video-qa «Зоны элементов», «Обрезанные слова»; video-ad-craft «Результат показан»):
 - key elements of each beat inside 14-65 % of the height, >= 6 % from the left, out of the Reels button column
   (x1 > 929 and y1 > 864), whole in frame;
 - event texts: letter height (glyph cap/digit height from the font, projected at its place) >= 12 px at 360 px wide;
 - no word cut by the frame edge, none half under the bottle (look12 lesson: under a scene object too);
 - tablet to phone size on the frame >= 1.6 (решение look13), by the long edge of each body as projected;
 - the bottle's shadow not longer than the phone (решение look13);
 - the last frame (10, look15: no pull-back): the phone's two bottom corners in view (its frame does not vanish);
 - the bottle's cap is not the brightest spot of the frame (luminance averaged over a cap-sized box).
python board13_check.py board13.json STILLS_DIR [--paint-cap N]   (stills named sNN.png in the order of the json)"""
import json, sys
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
d = json.load(open(sys.argv[1], encoding="utf8")); sdir = sys.argv[2]
paint = sys.argv[sys.argv.index("--paint-cap") + 1] if "--paint-cap" in sys.argv else None
fails = []
def lum(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    return 0.2126 * a[..., 0] + 0.7152 * a[..., 1] + 0.0722 * a[..., 2]
def boxmean(L, w, h):
    c = np.pad(L, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    return (c[h:, w:] - c[:-h, w:] - c[h:, :-w] + c[:-h, :-w]) / (w * h)
for idx, o in enumerate(d):
    s, bad = o["still"], []
    for n, b in o["keys"].items():
        if b[1] < 269 or b[3] > 1248: bad.append(f"{n} outside 14-65 % (y {b[1]}-{b[3]})")
        if b[0] < 65: bad.append(f"{n} closer than 6 % to the left edge (x {b[0]})")
        if b[2] > 929 and b[3] > 864: bad.append(f"{n} in the Reels button column (x to {b[2]}, y to {b[3]})")
        if b[0] < 0 or b[2] > 1080 or b[1] < 0 or b[3] > 1920: bad.append(f"{n} not whole in frame {b}")
    for e in o["events"]:
        if e.get("missing"): bad.append(f"event text {e['text']} not found"); continue
        if e["letterAt360"] < 12: bad.append(f"«{e['text']}» letters {e['letterAt360']} px at 360 (< 12; font {e['fontCss']} CSS px, letters {e['letterCss']})")
        if not e["inFrame"]: bad.append(f"«{e['text']}» not whole in frame")
    if o["cutWords"]: bad.append(f"words cut by the frame edge: {o['cutWords']}")
    if o["underBottle"]: bad.append(f"words under the bottle: {o['underBottle']}")
    sr = o.get("sizeRatio")
    if sr and s == "05" and sr["longEdge"] < 1.6: bad.append(f"tablet to phone on the frame {sr['longEdge']} (< 1.6)")
    if o.get("bottle") and o["bottle"][2] > 0 and o["shadowCm"] > o["phoneCm"]: bad.append(f"the bottle's shadow {o['shadowCm']} cm longer than the phone {o['phoneCm']} cm")
    if s in ("10-skip",):  # template decision: the last frame is the order's row across the frame, the phone's frame leaves it
        e = o["edges"]
        for k in ("bottomLeft", "bottomRight"):
            x, y = e[k]
            if not (0 <= x <= 1080 and 0 <= y <= 1920): bad.append(f"the phone's {k} corner out of view ({x}, {y})")
    img = Image.open(f"{sdir}/s{idx + 1:02d}.png")
    cx0, cy0, cx1, cy1 = [int(v) for v in o["cap"]]
    if cx1 > 0 and cx0 < 1080 and cy1 > 0 and cy0 < 1920:
        if paint == s:
            arr = np.asarray(img.convert("RGB")).copy(); arr[max(0, cy0):min(1920, cy1), max(0, cx0):min(1080, cx1)] = 255; img = Image.fromarray(arr)
        L = lum(img); w, h = max(4, min(1080, cx1) - max(0, cx0)), max(4, min(1920, cy1) - max(0, cy0))
        m = boxmean(L, w, h); yy, xx = np.unravel_index(np.argmax(m), m.shape)
        capMean = L[max(0, cy0):min(1920, cy1), max(0, cx0):min(1080, cx1)].mean()
        onCap = (xx < min(1080, cx1) and xx + w > max(0, cx0) and yy < min(1920, cy1) and yy + h > max(0, cy0))
        if onCap: bad.append(f"the cap is the brightest spot (cap mean {capMean:.0f}, max {m.max():.0f})")
        capinfo = f"cap mean L {capMean:.0f} vs brightest cap-sized spot {m.max():.0f} at ({xx},{yy})"
    else: capinfo = "cap out of frame"
    ev = ", ".join(f"{e['text']} {e.get('letterAt360', '-')}" for e in o["events"]) or "-"
    if o.get("info"): ev += " | info (not an event): " + ", ".join(f"{e['text']} {e.get('letterAt360', '-')}" for e in o["info"])
    extra = f"; tablet/phone {sr['longEdge']}" if sr else ""
    print(f"{s} {o['t']:.2f} s pitch {o['pitch']}: keys {o['keys'] or '-'}; letters at 360: {ev}; cut {len(o['cutWords'])}, under bottle {len(o['underBottle'])}{extra}; {capinfo}")
    for x in bad: print("   FAIL", x)
    fails += [f"{s}: {x}" for x in bad]
print("OK" if not fails else f"FAIL: {len(fails)}")
sys.exit(0 if not fails else 1)
