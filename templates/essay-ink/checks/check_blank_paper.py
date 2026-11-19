# «Почти пустой лист»: доля пикселей темнее фона бумаги на 25 единиц яркости, по каждому кадру.
#   python checks/check_blank_paper.py FRAMES_DIR [--thr 6.0] [--min-len 0.5] [--step 1]
# Фон бумаги — медиана яркости кадра (бумага занимает большую часть листа).
# Порог подобран на заведомо пустых кадрах v3 (10, 24, 38, 50 с: 0,02 / 0,06 / 0,67 / 5,62 %) —
# порог 6 % их находит. Выводит интервалы, где доля ниже порога дольше min-len секунд. Код 1, если есть.
import sys, os, json, argparse
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("frames"); ap.add_argument("--thr", type=float, default=6.0)
ap.add_argument("--min-len", type=float, default=0.5); ap.add_argument("--step", type=int, default=1)
ap.add_argument("--n", type=int, default=0); ap.add_argument("--out")
a = ap.parse_args()
FPS = 30
fr = {}
if not a.n: a.n = len([f for f in os.listdir(a.frames) if f.startswith("f_") and f.endswith(".png")])  # 0 — все кадры папки
for n in range(0, a.n, a.step):
    p = os.path.join(a.frames, f"f_{n:06d}.png")
    if not os.path.exists(p): continue
    g = np.asarray(Image.open(p).convert("L").resize((540, 960)), dtype=np.int16)
    bg = int(np.median(g))
    fr[n] = float((g < bg - 25).mean() * 100)
low = [n for n in sorted(fr) if fr[n] < a.thr]
runs, cur = [], []
for n in low:
    if cur and n - cur[-1] > a.step: runs.append(cur); cur = []
    cur.append(n)
if cur: runs.append(cur)
bad = [(r[0], r[-1], (r[-1] - r[0] + a.step) / FPS, min(fr[n] for n in r)) for r in runs if (r[-1] - r[0] + a.step) / FPS > a.min_len]
print(f"кадров: {len(fr)}, порог {a.thr} %, интервалов ниже порога дольше {a.min_len} с: {len(bad)}")
for f0, f1, L, mn in bad:
    print(f"  кадры {f0}–{f1} ({f0/FPS:.2f}–{(f1+1)/FPS:.2f} с, {L:.2f} с), минимум {mn:.2f} %")
if a.out:
    json.dump(dict(frac=fr, bad=bad), open(a.out, "w", encoding="utf-8"))
sys.exit(1 if bad else 0)
