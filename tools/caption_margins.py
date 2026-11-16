"""Проверка полей подписей: ни одна строка не ближе SAFE px к краю кадра
и не попадает в зоны интерфейса площадки.

Рамки строк должен выгрузить ваш рендерер (он один знает, где текст):
  JSON: [{"frame": n, "text": "...", "x0":..,"y0":..,"x1":..,"y1":..}, ...]

  python caption_margins.py boxes.json --w 1080 --h 1920 --safe 80 [--ui reels]

--ui: дополнительно проверить попадание в зоны, где интерфейс закрывает кадр
(значения ниже — ориентир, сверяйте с 04_platforms.md перед публикацией).
Код возврата 1, если есть нарушения.
"""
import argparse, json, sys

UI = {  # (x0, y0, x1, y1) в долях кадра — где обычно лежат кнопки/подпись/ник
    "reels": [(0.0, 0.78, 1.0, 1.0), (0.86, 0.45, 1.0, 1.0), (0.0, 0.0, 1.0, 0.08)],
    "shorts": [(0.0, 0.80, 1.0, 1.0), (0.86, 0.45, 1.0, 1.0), (0.0, 0.0, 1.0, 0.07)],
    "tiktok": [(0.0, 0.80, 1.0, 1.0), (0.85, 0.40, 1.0, 1.0), (0.0, 0.0, 1.0, 0.07)],
}

ap = argparse.ArgumentParser()
ap.add_argument("boxes")
ap.add_argument("--w", type=int, default=1080)
ap.add_argument("--h", type=int, default=1920)
ap.add_argument("--safe", type=int, default=80)
ap.add_argument("--ui", choices=sorted(UI))
a = ap.parse_args()

boxes = json.load(open(a.boxes, encoding="utf8"))
bad, worst = [], (1e9, None)
for b in boxes:
    d = min(b["x0"], a.w - b["x1"], b["y0"], a.h - b["y1"])
    if d < worst[0]:
        worst = (d, b)
    if d < a.safe:
        bad.append(("поле", b, d))
    if a.ui:
        for z in UI[a.ui]:
            zx0, zy0, zx1, zy1 = z[0] * a.w, z[1] * a.h, z[2] * a.w, z[3] * a.h
            if b["x0"] < zx1 and b["x1"] > zx0 and b["y0"] < zy1 and b["y1"] > zy0:
                bad.append(("зона UI " + a.ui, b, 0))
                break
frames = len({b["frame"] for b in boxes})
print(f"кадров с подписями: {frames}, строк: {len(boxes)}, нарушений: {len(bad)}")
if worst[1]:
    print(f"минимум до края: {worst[0]:.1f} px (кадр {worst[1]['frame']}, «{worst[1]['text'][:30]}»)")
for kind, b, d in bad[:20]:
    print(f"  {kind}: кадр {b['frame']} «{b['text'][:30]}» ({d:.0f} px)")
sys.exit(1 if bad else 0)
