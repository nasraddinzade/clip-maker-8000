"""Замер движения: «не стоит ли картинка». С ОГОВОРКАМИ — см. ниже.

  python motion.py --frames DIR --from 0 --to 630 [--fps 30] [--baseline DIR_DYHANIE]
  python motion.py --video VIDEO [--fps 30]          (сам распакует кадры во временную папку)

Считает две метрики по уменьшенным кадрам (блоки ~10×10 px, зерно усредняется):
  1) разница соседних кадров по секундам и самый длинный участок, где она
     не выше 1,25 × «дыхания» (эталон);
  2) разница кадра n и n+fps (изменение за 1 с) — медленный дрейф копится.
Эталон (--baseline): кадры той же сцены, где содержимое заморожено, а камера
только «дышит». Без эталона порог = 20-й перцентиль разниц (грубо).

ОГОВОРКИ (проверено на практике):
  * Метрика ≠ ощущение. Медленный наезд камеры и дрейф тумана проходят порог,
    хотя глазом картинка «стоит». Проходной замер — не доказательство живой паузы:
    смотрите видео целиком и ищите СОБЫТИЕ хотя бы раз в 1,5–2 с (кроме задуманной паузы эссе из brief.md).
  * Зерно плёнки меняется каждый кадр — рендерьте кадры для замера без зерна
    или с зерном, привязанным к номеру кадра.
  * Туман «бумагой поверх» на пустом листе не виден и движения не даёт.
"""
import argparse, glob, os, tempfile
from PIL import Image, ImageChops, ImageFilter, ImageStat
from _common import run, tool

ap = argparse.ArgumentParser()
ap.add_argument("--frames")
ap.add_argument("--video")
ap.add_argument("--from", dest="f0", type=int, default=0)
ap.add_argument("--to", dest="f1", type=int)
ap.add_argument("--fps", type=float, default=30)
ap.add_argument("--baseline", nargs="*", default=[])
ap.add_argument("--max-hold", type=float, default=1.5, help="допустимый участок «только дыхание», с")
a = ap.parse_args()

if a.video:
    tmp = tempfile.mkdtemp(prefix="motion_")
    run([tool("ffmpeg"), "-loglevel", "error", "-i", a.video, "-vf", "scale=108:192", os.path.join(tmp, "f_%06d.png")])
    a.frames, start_number = tmp, 1
files = sorted(glob.glob(os.path.join(a.frames, "*.png")))
if a.f1 is None:
    a.f1 = len(files)
files = files[a.f0:a.f1]


def load(p):
    return Image.open(p).convert("L").resize((108, 192), Image.BOX).filter(ImageFilter.GaussianBlur(0.8))


def diff(x, y):
    return ImageStat.Stat(ImageChops.difference(x, y)).mean[0]


ims = [load(p) for p in files]
per = [diff(ims[i], ims[i + 1]) for i in range(len(ims) - 1)]
base = []
for d in a.baseline:
    b = [load(p) for p in sorted(glob.glob(os.path.join(d, "*.png")))]
    base += [diff(b[i], b[i + 1]) for i in range(len(b) - 1)]
B = max(base) if base else sorted(per)[max(0, len(per) // 5)]
thr = B * 1.25
fps = int(round(a.fps))
print(f"эталон «дыхания»: {B:.4f} ({'по замороженным кадрам' if base else '20-й перцентиль — грубо'})")
print("сек  движение  ×эталон")
for s in range(0, len(per) // fps + 1):
    v = per[s * fps:(s + 1) * fps]
    if v:
        m = sum(v) / len(v)
        print(f"{s:4d}  {m:.4f}   ×{m / B if B else 0:.1f}")
run_len, worst, end = 0, 0, 0
for i, v in enumerate(per):
    run_len = run_len + 1 if v <= thr else 0
    if run_len > worst:
        worst, end = run_len, i
w1 = [diff(ims[i], ims[i + fps]) for i in range(0, len(ims) - fps, max(1, fps // 2))]
B1 = (sorted(w1)[len(w1) // 10] if w1 else 0)
print(f"\nсамый длинный участок на уровне дыхания (соседние кадры): {worst / fps:.2f} с, кончается на {(a.f0 + end) / fps:.2f} с")
print(f"{'ПРЕВЫШЕНИЕ' if worst / fps > a.max_hold else 'ок'}: допустимо {a.max_hold} с")
print("ПОМНИТЕ: проходной замер не доказывает живую паузу — посмотрите видео глазами.")
