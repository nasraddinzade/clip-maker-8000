"""Общие функции инструментов: поиск ffmpeg/ffprobe, кадры, темнота области."""
import os, shutil, subprocess, sys

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def tool(name):
    """ffmpeg/ffprobe: переменная окружения FFMPEG/FFPROBE, иначе из PATH."""
    p = os.environ.get(name.upper()) or shutil.which(name)
    if not p:
        sys.exit(f"не найден {name}: поставьте его в PATH или задайте переменную {name.upper()}")
    return p


def run(args, check=True):
    return subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", check=check)


def probe_duration(path):
    r = run([tool("ffprobe"), "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path])
    return float(r.stdout.strip())


def extract_frames(video, times, out_dir):
    """Кадры по временам (с) в out_dir/t_XXXX.XXs.png; возвращает список путей."""
    os.makedirs(out_dir, exist_ok=True)
    paths = []
    for t in times:
        p = os.path.join(out_dir, f"t_{t:08.2f}s.png")
        run([tool("ffmpeg"), "-y", "-loglevel", "error", "-ss", f"{t:.3f}", "-i", video, "-frames:v", "1", p])
        paths.append(p)
    return paths


def darkness(img_l, box, paper=225, sample=(60, 60)):
    """Средняя темнота (paper - L, только где L < paper) внутри box=(x0,y0,x1,y1)."""
    from PIL import Image  # noqa
    x0, y0, x1, y1 = [int(round(v)) for v in box]
    W, H = img_l.size
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
    if x1 - x0 < 4 or y1 - y0 < 4:
        return None
    px = list(img_l.crop((x0, y0, x1, y1)).resize(sample).getdata())
    return sum(max(0, paper - v) for v in px) / len(px)
