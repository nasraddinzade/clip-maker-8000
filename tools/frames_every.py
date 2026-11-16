"""Кадры каждые N секунд + лист-сетка.

  python frames_every.py VIDEO --every 2 --out out/check/every2s [--cols 8 --w 180]

Смотрите лист целиком, потом — подозрительные кадры по отдельности в 100 %.
"""
import argparse, os
from PIL import Image
from _common import extract_frames, probe_duration

ap = argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("--every", type=float, default=2.0)
ap.add_argument("--out", default="check_every")
ap.add_argument("--cols", type=int, default=8)
ap.add_argument("--w", type=int, default=180, help="ширина миниатюры на листе")
a = ap.parse_args()

dur = probe_duration(a.video)
times, t = [], 0.0
while t < dur - 0.05:
    times.append(t)
    t += a.every
times.append(max(0, dur - 0.05))  # последний кадр тоже
paths = extract_frames(a.video, times, a.out)
ims = [Image.open(p).convert("RGB") for p in paths]
w = a.w
h = round(w * ims[0].height / ims[0].width)
rows = (len(ims) + a.cols - 1) // a.cols
sheet = Image.new("RGB", (a.cols * (w + 6) + 6, rows * (h + 6) + 6), (30, 28, 26))
for i, im in enumerate(ims):
    sheet.paste(im.resize((w, h), Image.LANCZOS), (6 + (i % a.cols) * (w + 6), 6 + (i // a.cols) * (h + 6)))
sp = os.path.join(a.out, "sheet.png")
sheet.save(sp)
print(f"{len(ims)} кадров → {a.out}; лист: {sp}")
