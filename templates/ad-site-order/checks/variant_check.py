"""The variant (config.json «variant») is what the captures and the scene show.
capture: from src/states/states_tablet.json and the owner's first capture
 - enterFrom: the notice and the new row come in from that side (their boxes over owner_m_00..60: left / right when x
   travels more than 20 CSS px towards its end place from that side, top when x stays and the row opens from its top);
 - palette: the screen's dominant colour within 24 (RGB distance) of the palette's ink (the site took capture.cssVars).
scene: from the box export (BOARD_variant.json, export-boxes.ts) and two storyboard stills
 - drift: the client's camera at every key (phone 1T, wide 2T, cart 3T+0.6, tap 5T, page 6T, result) within 1 world px
   of «push»; between the keys «sweep» departs from «push» by at least 30 world px, «push» by none;
 - mirror: in the wide still the buyer's phone stands right of the tablet, left of it when mirrored;
 - light: in the owner's still the table band at the source's side is brighter than the other by at least 10 %;
 - screens are never mirrored: no negative scale in src/*.ts(x).
python variant_check.py capture [--bad]
python variant_check.py scene BOARD_variant.json WIDE.png OWNER.png [--bad]
  --bad: a known bad input, the opposite variant expected (other side, other palette, other drift, mirror, light)"""
import glob, json, os, re, sys
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
C = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf8"))
V = dict(C["variant"]); bad = "--bad" in sys.argv; mode = sys.argv[1]; fails = []
if bad:
    V["enterFrom"] = {"top": "left", "left": "right", "right": "top"}[V["enterFrom"]]
    V["palettePreset"] = [k for k in C["palettes"] if not k.startswith("_") and k != V["palettePreset"]][0]
    V["drift"] = "push" if V["drift"] == "sweep" else "sweep"; V["mirror"] = not V["mirror"]; V["light"] = "right" if V["light"] == "left" else "left"
def side(boxes):
    xs = [b[0] for b in boxes if b]
    if len(xs) < 2: return "none"
    end, first = xs[-1], xs[0]
    if abs(first - end) <= 20: return "top"
    return "left" if first < end else "right"
if mode == "capture":
    st = json.load(open(os.path.join(ROOT, "src", "states", "states_tablet.json"), encoding="utf8"))
    frames = [st[k] for k in sorted(k for k in st if k.startswith("owner_m_"))]
    n_rows = max(len(f["el"].get("rows") or []) for f in frames)  # the first row is the new one only once it is there
    toast = side([f["el"].get("toast") for f in frames]); row = side([f["el"]["rows"][0] for f in frames if len(f["el"].get("rows") or []) == n_rows])
    print(f"   enterFrom {V['enterFrom']}: the notice comes in from {toast}, the row from {row}")
    for n, s_ in (("notice", toast), ("row", row)):
        if s_ != V["enterFrom"]: fails.append(f"the {n} enters from {s_}, not {V['enterFrom']}")
    a = np.asarray(Image.open(os.path.join(ROOT, "public", "dev", "tablet", "owner_before.png")).convert("RGB")).reshape(-1, 3)
    q = (a // 8).astype(np.int32); key = q[:, 0] * 1024 + q[:, 1] * 32 + q[:, 2]; mode_ = np.bincount(key).argmax()
    dom = a[key == mode_].mean(0); ink = np.array([int(C["palettes"][V["palettePreset"]]["ink"][i:i + 2], 16) for i in (1, 3, 5)])
    dist = float(np.linalg.norm(dom - ink))
    print(f"   palette {V['palettePreset']}: screen colour {dom.round().astype(int).tolist()}, ink {ink.tolist()}, distance {dist:.0f}")
    if dist > 24: fails.append(f"the screen is not the palette {V['palettePreset']} (distance {dist:.0f} > 24)")
elif mode == "scene":
    var = json.load(open(sys.argv[2], encoding="utf8"))
    worst = max(k["world"] for k in var["keyDiff"][1:]); between = var["between"]["world"]
    print(f"   drift {V['drift']}: at the keys off «push» by {worst} world px at most, between them by {between} (at {var['between']['t']} s)")
    if worst > 1: fails.append(f"a key is off «push» by {worst} world px")
    if V["drift"] == "sweep" and between < 30: fails.append(f"sweep departs from push by {between} world px only (< 30)")
    if V["drift"] == "push" and between > 1: fails.append(f"push departs from push by {between}")
    w = var["wide"]; right = w["phoneX"] > w["tabletX"]
    print(f"   mirror {V['mirror']}: the phone at x {w['phoneX']}, the tablet at x {w['tabletX']} in the wide still")
    if right == V["mirror"]: fails.append(f"the phone stands {'right' if right else 'left'} of the tablet with mirror {V['mirror']}")
    L = np.asarray(Image.open(sys.argv[4]).convert("L")).astype(float)
    lb, rb = L[1300:1900, 0:140].mean(), L[1300:1900, 940:1080].mean(); lit = "left" if lb > rb else "right"
    ratio = max(lb, rb) / max(1.0, min(lb, rb))
    print(f"   light {V['light']}: table band left {lb:.0f}, right {rb:.0f} (the {lit} side brighter by {100 * (ratio - 1):.0f} %)")
    if lit != V["light"] or ratio < 1.1: fails.append(f"the brighter table side is {lit} by {100 * (ratio - 1):.0f} %, light {V['light']}")
    neg = [f"{os.path.basename(f)}:{i + 1}" for f in glob.glob(os.path.join(ROOT, "src", "*.ts*")) for i, l in enumerate(open(f, encoding="utf8")) if re.search(r"scale[XY]?\(\s*-|rotateY\(\s*180", l)]
    if bad: neg.append("bad.tsx:1")  # the known bad input: a mirrored screen
    print(f"   mirrored transforms in src: {neg or 'none'}")
    if neg: fails.append(f"a negative scale in {neg}")
for f in fails: print("   FAIL", f)
print("OK" if not fails else f"FAIL: {len(fails)} {fails}")
sys.exit(0 if not fails else 1)
