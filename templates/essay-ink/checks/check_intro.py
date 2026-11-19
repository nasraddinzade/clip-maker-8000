# Начала глав: (1) первая ВИДИМАЯ тушь иероглифа после смены сцены (по пикселям кадров без подписей,
# внутри рамки туши знака: > 60 пикселей темнее 90); (2) подпись главы — когда её строки наполовину видны
# (прозрачность ≥ 0,5) относительно начала первой фразы голоса (timing.json: voiceDelay + parts[0].start).
#   python checks/check_intro.py GEOMETRY_ALL.json FRAMES_NOCAP [--ink-max 0.3] [--cap-max 0.3]
import sys, json, os, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("geometry"); ap.add_argument("nocap")
ap.add_argument("--ink-max", type=float, default=0.3); ap.add_argument("--cap-max", type=float, default=0.3)
ap.add_argument("--timing", default="timing.json"); ap.add_argument("--config", default="config.json")
a = ap.parse_args()
d = json.load(open(a.geometry, encoding="utf-8")); sc = d["timeline"]["scenes"]; fr = {f["frame"]: f for f in d["frames"]}
tm = json.load(open(a.timing, encoding="utf-8"))["scenes"]
CFG = json.load(open(a.config, encoding="utf-8")); cfg = CFG["scenes"]; FPS = CFG["video"]["fps"]; VW, VH = CFG["video"]["width"], CFG["video"]["height"]
ok = True
for i, s in enumerate(sc):
    S = s["startFrame"]
    # (1) первая видимая тушь знака
    first = None
    if i > 0:
        for n in range(S, S + 45):
            if n not in fr: continue
            box = [b for b in fr[n]["keep"] if b["scene"] == i and b["name"].startswith("иероглиф") and "тушь" in b["name"]]
            p = os.path.join(a.nocap, f"f_{n:06d}.png")
            if not box or not os.path.exists(p): continue
            b = box[0]
            x0, y0 = int(max(0, b["x0"])), int(max(0, b["y0"])); x1, y1 = int(min(VW, b["x1"])), int(min(VH, b["y1"]))
            if x1 - x0 < 5 or y1 - y0 < 5: continue
            g = np.asarray(Image.open(p).convert("L"))[y0:y1, x0:x1]
            if (g < 90).sum() > 60: first = n; break
    # (2) подпись: первая строка идеи с прозрачностью ≥ 0,5
    title, idea = cfg[i]["caption"]["title"].upper(), cfg[i]["caption"]["text"]
    cap = None
    for n in range(S, S + s["frames"]):
        if n in fr and any(c["alpha"] >= 0.5 and c["str"] != title and c["str"] in idea for c in fr[n]["caps"]): cap = n; break
    v0 = tm[i]["voiceDelay"] + tm[i]["parts"][0]["start"]
    if i == len(sc) - 1:  # финал: подпись — последняя фраза голоса (финальная фраза)
        v0 = tm[i]["voiceDelay"] + tm[i]["parts"][-1]["start"]
    ink = (first - S) / FPS if first is not None else None
    capd = (cap - S) / FPS - v0 if cap is not None else None
    ink_ok = i == 0 or i == len(sc) - 1 or (ink is not None and ink <= a.ink_max)
    cap_ok = capd is not None and capd <= a.cap_max
    ok &= ink_ok and cap_ok
    print(f"{i} {s['id']:9s} первая тушь знака: {('+%.2f с' % ink) if ink is not None else '—':9s} {'ок' if ink_ok else 'НЕ ПРОШЛО'} | "
          f"фраза голоса с {v0:.2f} с, подпись наполовину видна {('%+.2f с' % capd) if capd is not None else '—'} от неё — {'ок' if cap_ok else 'НЕ ПРОШЛО'}")
sys.exit(0 if ok else 1)
