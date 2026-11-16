"""Кропы 3×3 в 100 % (без масштабирования) — ищите мусор, плавающие штрихи,
прямоугольные края размывок, обрезанный текст. Общий план дефекты прячет.

  python crops3x3.py FRAME.png [FRAME2.png ...] --out out/check/crops
  python crops3x3.py --video VIDEO --at 12.5,40 --out out/check/crops

Для каждой картинки: 9 клеток cell_RC.png и 3 строки row_R.png (клетки рядом)
и один лист с сеткой (клетки разделены тёмными линиями).
"""
import argparse, os
from PIL import Image
from _common import extract_frames

ap = argparse.ArgumentParser()
ap.add_argument("images", nargs="*")
ap.add_argument("--video")
ap.add_argument("--at", help="времена в секундах через запятую")
ap.add_argument("--out", default="crops")
a = ap.parse_args()

imgs = list(a.images)
if a.video and a.at:
    imgs += extract_frames(a.video, [float(x) for x in a.at.split(",")], os.path.join(a.out, "_frames"))
if not imgs:
    ap.error("нужны картинки или --video с --at")

for path in imgs:
    im = Image.open(path).convert("RGB")
    W, H = im.size
    base = os.path.join(a.out, os.path.splitext(os.path.basename(path))[0])
    os.makedirs(base, exist_ok=True)
    grid = Image.new("RGB", (W + 20, H + 20), (20, 20, 20))
    for r in range(3):
        y0, y1 = r * H // 3, (r + 1) * H // 3
        im.crop((0, y0, W, y1)).save(os.path.join(base, f"row_{r}.png"))
        for c in range(3):
            x0, x1 = c * W // 3, (c + 1) * W // 3
            cell = im.crop((x0, y0, x1, y1))
            cell.save(os.path.join(base, f"cell_{r}{c}.png"))
            grid.paste(cell, (x0 + c * 10, y0 + r * 10))
    grid.save(os.path.join(base, "grid_3x3.png"))
    print(f"{path} → {base} (9 клеток, 3 строки, grid_3x3.png)")
