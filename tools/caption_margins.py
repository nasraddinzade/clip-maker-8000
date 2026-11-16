"""Проверка полей подписей: ни одна строка не ближе SAFE px к краю кадра
и не попадает в зоны интерфейса площадки.

Рамки строк должен выгрузить ваш рендерер (он один знает, где текст):
  JSON: [{"frame": n, "text": "...", "x0":..,"y0":..,"x1":..,"y1":..}, ...]

  python caption_margins.py boxes.json --w 1080 --h 1920 --safe 80 [--ui reels] [--elements el.json]
  python caption_margins.py --selftest

--elements: рамки ключевых элементов (устройства, экраны, товар) по кадрам,
  [{"frame": n, "name": "phone", "x0":..,"y0":..,"x1":..,"y1":..}, ...].
  Подпись не должна пересекаться ни с одной рамкой того же кадра.
  Без этого флага проверка видит только края кадра и пропускает подпись,
  которую закрыло устройство (Scent Harbor, 17.11.2026).

--ui: дополнительно проверить попадание в зоны, где интерфейс закрывает кадр
(значения ниже — ориентир, сверяйте с reference/platforms.md перед публикацией).
Код возврата 1, если есть нарушения.
"""
import argparse, json, sys

UI = {  # (x0, y0, x1, y1) в долях кадра — где обычно лежат кнопки/подпись/ник
    "reels": [(0.0, 0.65, 1.0, 1.0), (0.86, 0.45, 1.0, 1.0), (0.0, 0.0, 1.0, 0.14)],  # Meta: верх 14 %, низ 35 %
    "shorts": [(0.0, 0.80, 1.0, 1.0), (0.86, 0.45, 1.0, 1.0), (0.0, 0.0, 1.0, 0.07)],
    "tiktok": [(0.0, 0.80, 1.0, 1.0), (0.85, 0.40, 1.0, 1.0), (0.0, 0.0, 1.0, 0.07)],
}

def overlap(b, e):
    return b["x0"] < e["x1"] and b["x1"] > e["x0"] and b["y0"] < e["y1"] and b["y1"] > e["y0"]


if "--selftest" in sys.argv:
    cap = [{"frame": 1, "text": "Хотите такие заказы?", "x0": 100, "y0": 400, "x1": 900, "y1": 480}]
    hit = [{"frame": 1, "name": "panel", "x0": 50, "y0": 450, "x1": 1000, "y1": 1100}]
    miss = [{"frame": 1, "name": "panel", "x0": 50, "y0": 520, "x1": 1000, "y1": 1100},
            {"frame": 2, "name": "phone", "x0": 0, "y0": 0, "x1": 1080, "y1": 1920}]
    ok = any(overlap(cap[0], e) for e in hit if e["frame"] == 1) and \
        not any(overlap(cap[0], e) for e in miss if e["frame"] == 1)
    print("перекрытие устройством поймано, соседний кадр не мешает:", "ок" if ok else "ОШИБКА")
    sys.exit(0 if ok else 1)

ap = argparse.ArgumentParser()
ap.add_argument("boxes")
ap.add_argument("--elements")
ap.add_argument("--w", type=int, default=1080)
ap.add_argument("--h", type=int, default=1920)
ap.add_argument("--safe", type=int, default=80)
ap.add_argument("--ui", choices=sorted(UI))
a = ap.parse_args()

boxes = json.load(open(a.boxes, encoding="utf8"))
els = {}
if a.elements:
    for e in json.load(open(a.elements, encoding="utf8")):
        els.setdefault(e["frame"], []).append(e)
bad, worst = [], (1e9, None)
for b in boxes:
    for e in els.get(b["frame"], []):
        if overlap(b, e):
            bad.append(("закрыта элементом " + e.get("name", "?"), b, 0))
            break
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
