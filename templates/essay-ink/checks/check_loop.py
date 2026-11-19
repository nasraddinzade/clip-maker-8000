# Петля: последние 0,3 с должны плавно прийти к тону первого кадра.
#   python checks/check_loop.py VIDEO.mp4 [--max-jump 4] [--max-end 8]
# Декодирует кадр 0 и последние --tail кадров (по умолчанию 15) и считает среднюю разницу яркости (0–255, кадр уменьшен до 270×480) с кадром 0.
# Требования: разница последнего кадра с первым ≤ max-end; между соседними кадрами хвоста нет скачка > max-jump
# (плавность). Без перехода (v3) разница последнего и первого кадра большая — это плохой вход.
import sys, subprocess, argparse, json
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
ap = argparse.ArgumentParser(); ap.add_argument("video"); ap.add_argument("--max-jump", type=float, default=4); ap.add_argument("--max-end", type=float, default=8); ap.add_argument("--tail", type=int, default=15)
a = ap.parse_args()
import os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def tool(env, js):
    # FFMPEG / FFPROBE из окружения, иначе бинарники из npm-пакетов шаблона (ffmpeg-static, @ffprobe-installer)
    if os.environ.get(env): return os.environ[env]
    out = subprocess.run(["node", "-e", f"console.log({js})"], cwd=ROOT, capture_output=True, text=True).stdout.strip()
    return out or env.lower()
FF = tool("FFMPEG", "require('ffmpeg-static')")
FP = tool("FFPROBE", "require('@ffprobe-installer/ffprobe').path")
N = int(subprocess.run([FP, "-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", a.video], capture_output=True, check=True, text=True).stdout.strip())
W, H = 270, 480
raw = subprocess.run([FF, "-v", "error", "-i", a.video, "-vf", f"select='eq(n,0)+gte(n,{N - a.tail})',scale={W}:{H},format=gray", "-vsync", "0", "-f", "rawvideo", "-"], capture_output=True, check=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W).astype(np.float32)
f0, tail = fr[0], fr[1:]
d0 = [float(np.abs(t - f0).mean()) for t in tail]
jumps = [float(np.abs(tail[i + 1] - tail[i]).mean()) for i in range(len(tail) - 1)]
print(f"кадров хвоста: {len(tail)}; разница с кадром 0: " + " ".join(f"{v:.1f}" for v in d0))
print(f"скачки между соседними кадрами хвоста: " + " ".join(f"{v:.1f}" for v in jumps))
ok = d0[-1] <= a.max_end and max(jumps) <= a.max_jump
print(f"последний кадр против первого: {d0[-1]:.1f} (порог {a.max_end}); наибольший скачок {max(jumps):.1f} (порог {a.max_jump}) → {'ок' if ok else 'НЕ ПРОШЛО'}")
sys.exit(0 if ok else 1)
