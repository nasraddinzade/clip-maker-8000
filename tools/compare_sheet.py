"""Лист сравнения версий: ряды = версии, столбцы = кадры (или сцены).

  python compare_sheet.py --rows v1/ v2/ v3/ --out compare.png [--w 300]
     (в каждой папке берутся *.png по алфавиту, одинаковое число)
  python compare_sheet.py --videos old.mp4 new.mp4 --at 2,10,25 --out compare.png

Подписи рядов — имена папок/файлов. Показывайте заказчику «было / стало» рядом.
"""
import argparse, glob, os
from PIL import Image, ImageDraw
from _common import extract_frames

ap = argparse.ArgumentParser()
ap.add_argument("--rows", nargs="*", default=[])
ap.add_argument("--videos", nargs="*", default=[])
ap.add_argument("--at", help="времена для --videos, через запятую")
ap.add_argument("--out", default="compare.png")
ap.add_argument("--w", type=int, default=300)
a = ap.parse_args()

rows = []
for d in a.rows:
    rows.append((os.path.basename(os.path.normpath(d)), sorted(glob.glob(os.path.join(d, "*.png")))))
if a.videos:
    ts = [float(x) for x in a.at.split(",")]
    for v in a.videos:
        rows.append((os.path.basename(v), extract_frames(v, ts, os.path.join(os.path.dirname(a.out) or ".", "_cmp_" + os.path.basename(v)))))
if not rows:
    ap.error("нужны --rows или --videos с --at")
cols = max(len(r[1]) for r in rows)
first = Image.open(rows[0][1][0])
w = a.w
h = round(w * first.height / first.width)
label = 28
sheet = Image.new("RGB", (cols * (w + 8) + 8, len(rows) * (h + label + 8) + 8), (30, 28, 26))
dr = ImageDraw.Draw(sheet)
for ri, (name, files) in enumerate(rows):
    y = 8 + ri * (h + label + 8)
    dr.text((10, y + 6), name, fill=(230, 225, 210))
    for ci, f in enumerate(files):
        sheet.paste(Image.open(f).convert("RGB").resize((w, h), Image.LANCZOS), (8 + ci * (w + 8), y + label))
sheet.save(a.out)
print(f"{len(rows)} версий × {cols} кадров → {a.out}")
