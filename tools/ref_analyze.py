"""Разбор референсных роликов: длина, склейки, движение, громкость, лист кадров.

  python ref_analyze.py ПАПКА_С_РОЛИКАМИ --out ref_report [--every 1]
  python ref_analyze.py --selftest

Что считает на каждый ролик (метрики по маленьким кадрам 160x284, 30 кадров/с):
  - размер, частота кадров, длина, есть ли звук;
  - жёсткие склейки (скачок разницы кадров); плавные переезды и растворения
    ЭТОЙ метрикой НЕ видны, смотрите лист кадров;
  - среднее движение и самый длинный «стоячий» участок (разница соседних кадров < 0,3);
  - громкость по EBU R128 (скачанные из соцсетей ролики часто уже нормализованы
    площадкой, это не обязательно выбор автора);
  - лист кадров раз в N секунд с подписью времени (смотреть глазами).

Чего НЕ делает: не слышит звук, не оценивает плавность, не знает охватов, не доказывает,
что приём работает. Это материал для сравнения чисел, а не оценка качества.
Зависимости: Python 3.10+, Pillow, numpy, ffmpeg/ffprobe в PATH.
Скачанные файлы это чужие данные: открывайте их только через ffmpeg, как здесь.
"""
import argparse, json, os, re, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
from _common import tool, run, extract_frames

W, H, FPS = 160, 284, 30


def probe(path):
    r = run([tool("ffprobe"), "-v", "error", "-show_entries",
             "stream=codec_type,width,height,r_frame_rate,duration", "-of", "json", path])
    j = json.loads(r.stdout)
    v = next(s for s in j["streams"] if s["codec_type"] == "video")
    num, den = v["r_frame_rate"].split("/")
    return dict(width=v["width"], height=v["height"], fps=round(int(num) / int(den), 2),
                has_audio=any(s["codec_type"] == "audio" for s in j["streams"]))


def small_frames(path):
    raw = subprocess.run([tool("ffmpeg"), "-v", "error", "-i", path, "-vf",
                          f"fps={FPS},scale={W}:{H},format=gray", "-f", "rawvideo", "-"],
                         capture_output=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(float)


def hard_cuts(d):
    """Индексы кадров, где разница соседних кадров резко выше окружения."""
    cuts = []
    for i in range(1, len(d) - 1):
        loc = np.median(d[max(0, i - 6): i + 7])
        if d[i] > 12 and d[i] > 4 * max(loc, 0.5):
            cuts.append(i + 1)
    out = []
    for c in cuts:
        if not out or c - out[-1] > 3:
            out.append(c)
    return out


def loudness(path):
    r = run([tool("ffmpeg"), "-nostats", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], check=False)
    tail = r.stderr.split("Summary:")[-1]
    m = re.search(r"I:\s+(-?[\d.]+) LUFS", tail)
    p = re.search(r"Peak:\s+(-?[\d.]+) dBFS", tail)
    return (float(m.group(1)) if m else None), (float(p.group(1)) if p else None)


def contact_sheet(path, dur, every, out_png, cols=8, tw=216):
    times, t = [], 0.0
    while t < dur - 0.05:
        times.append(t)
        t += every
    with tempfile.TemporaryDirectory() as tmp:
        paths = extract_frames(path, times, tmp)
        ims = [Image.open(p).convert("RGB") for p in paths]
    th = round(tw * ims[0].height / ims[0].width)
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + 2), rows * (th + 2)), (0, 0, 0))
    d = ImageDraw.Draw(sheet)
    for i, (im, tt) in enumerate(zip(ims, times)):
        x, y = (i % cols) * (tw + 2), (i // cols) * (th + 2)
        sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
        d.rectangle((x, y, x + 46, y + 14), fill=(0, 0, 0))
        d.text((x + 3, y + 2), f"{tt:.1f}s", fill=(255, 255, 0))
    sheet.save(out_png)


def analyze(path, out_dir, every):
    info = probe(path)
    f = small_frames(path)
    d = np.abs(np.diff(f, axis=0)).mean(axis=(1, 2))
    dur = len(f) / FPS
    cuts = hard_cuts(d)
    shots = np.diff([0] + cuts + [len(f)]) / FPS
    run_len = best = 0
    for x in d:
        run_len = run_len + 1 if x < 0.3 else 0
        best = max(best, run_len)
    lufs, peak = (loudness(path) if info["has_audio"] else (None, None))
    name = os.path.splitext(os.path.basename(path))[0]
    sheet = os.path.join(out_dir, f"{name[:40]}_sheet.png")
    contact_sheet(path, dur, every, sheet)
    return dict(file=os.path.basename(path), **info, duration=round(dur, 2),
                hard_cuts=len(cuts), cut_times=[round(c / FPS, 2) for c in cuts],
                shot_mean=round(float(shots.mean()), 2), shot_min=round(float(shots.min()), 2),
                first_cut=round(cuts[0] / FPS, 2) if cuts else None,
                motion_mean=round(float(d.mean()), 2), longest_quiet_s=round(best / FPS, 2),
                lufs=lufs, true_peak_dbfs=peak, sheet=os.path.basename(sheet))


def report(rows, out_dir):
    with open(os.path.join(out_dir, "metrics.json"), "w", encoding="utf-8") as fh:
        json.dump(rows, fh, ensure_ascii=False, indent=1)
    lines = ["| № | файл | размер | кадр/с | длина с | жёстких склеек | средний план с | движение | самый стоячий участок с | LUFS |",
             "|---|---|---|---|---|---|---|---|---|---|"]
    for i, r in enumerate(rows, 1):
        lines.append(f"| {i} | {r['file'][:14]} | {r['width']}x{r['height']} | {r['fps']} | {r['duration']} | "
                     f"{r['hard_cuts']} | {r['shot_mean']} | {r['motion_mean']} | {r['longest_quiet_s']} | {r['lufs']} |")
    lines += ["", "Жёсткие склейки считаются по скачку разницы кадров. Плавные переезды и растворения",
              "в эту метрику не попадают: ролик с нулём склеек может быть полон монтажа. Листы кадров рядом."]
    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    print("\n".join(lines))


def selftest():
    """Заведомо плохие входы: неподвижный плоский ролик и ролик с жёсткой склейкой каждые 0,5 с."""
    ff = tool("ffmpeg")
    with tempfile.TemporaryDirectory() as tmp:
        still = os.path.join(tmp, "still.mp4")
        run([ff, "-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x202020:s=270x480:r=30:d=4",
             "-pix_fmt", "yuv420p", still])
        cols = ["red", "blue", "green", "yellow", "white", "black", "red", "blue"]
        inputs = []
        for c in cols:
            inputs += ["-f", "lavfi", "-i", f"color=c={c}:s=270x480:r=30:d=0.5"]
        cuts = os.path.join(tmp, "cuts.mp4")
        run([ff, "-y", "-loglevel", "error", *inputs, "-filter_complex",
             f"concat=n={len(cols)}:v=1:a=0", "-pix_fmt", "yuv420p", cuts])
        a = analyze(still, tmp, 1)
        b = analyze(cuts, tmp, 1)
    ok1 = a["hard_cuts"] == 0 and a["longest_quiet_s"] >= 3.5
    ok2 = b["hard_cuts"] >= 6 and b["shot_mean"] < 0.7
    print(f"неподвижный: склеек {a['hard_cuts']}, стоячий участок {a['longest_quiet_s']} с -> {'ок' if ok1 else 'ОШИБКА'}")
    print(f"склейки каждые 0,5 с: склеек {b['hard_cuts']}, средний план {b['shot_mean']} с -> {'ок' if ok2 else 'ОШИБКА'}")
    sys.exit(0 if ok1 and ok2 else 1)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", nargs="?")
    ap.add_argument("--out", default="ref_report")
    ap.add_argument("--every", type=float, default=1.0, help="шаг листа кадров, с")
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        selftest()
    if not a.folder:
        ap.error("укажите папку с роликами или --selftest")
    os.makedirs(a.out, exist_ok=True)
    files = sorted(os.path.join(a.folder, f) for f in os.listdir(a.folder)
                   if f.lower().endswith((".mp4", ".mov", ".webm", ".mkv")))
    if not files:
        sys.exit("в папке нет видеофайлов")
    report([analyze(p, a.out, a.every) for p in files], a.out)
