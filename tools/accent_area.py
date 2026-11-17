"""Бюджет площади акцентного цвета: какая доля кадра занята акцентом.

  python accent_area.py КАДР_ИЛИ_ПАПКА --hex C9A24B --max 6 [--tol 40]
  python accent_area.py --selftest

Для каждого кадра (png или jpg) считает долю пикселей, близких к акценту
(евклидово расстояние в RGB не больше --tol). Код 1, если хоть один кадр
больше --max процентов. Бюджет берётся из манифеста стиля или direction.md.
Не проверяет: уместность акцента, его место в кадре, вкус.
"""
import argparse, pathlib, sys, tempfile

import numpy as np
from PIL import Image

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def share(path, rgb, tol):
    a = np.asarray(Image.open(path).convert("RGB"), dtype=np.int32)
    d = np.sqrt(((a - np.array(rgb, dtype=np.int32)) ** 2).sum(axis=2))
    return float((d <= tol).mean() * 100)


def parse_hex(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def files(target):
    p = pathlib.Path(target)
    if p.is_dir():
        return sorted(x for x in p.iterdir() if x.suffix.lower() in (".png", ".jpg", ".jpeg"))
    return [p]


def run(target, hexcolor, mx, tol):
    rgb = parse_hex(hexcolor)
    bad = 0
    for f in files(target):
        s = share(f, rgb, tol)
        over = s > mx
        bad += over
        print(f"{f.name}: акцент {s:.2f} %{'  БОЛЬШЕ БЮДЖЕТА ' + str(mx) + ' %' if over else ''}")
    print(f"кадров сверх бюджета: {bad}")
    return 1 if bad else 0


def selftest():
    d = pathlib.Path(tempfile.mkdtemp())
    good = Image.new("RGB", (100, 100), (20, 20, 20))
    good.paste((201, 162, 75), (0, 0, 10, 30))  # 3 %
    bad = Image.new("RGB", (100, 100), (20, 20, 20))
    bad.paste((201, 162, 75), (0, 0, 40, 50))  # 20 %
    good.save(d / "good.png")
    bad.save(d / "bad.png")
    g = run(d / "good.png", "C9A24B", 6, 40)
    b = run(d / "bad.png", "C9A24B", 6, 40)
    ok = g == 0 and b == 1
    print("selftest:", "ок" if ok else "ПРОВАЛ")
    return 0 if ok else 1


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("target", nargs="?")
    ap.add_argument("--hex")
    ap.add_argument("--max", type=float, help="бюджет, процент площади кадра")
    ap.add_argument("--tol", type=float, default=40)
    ap.add_argument("--selftest", action="store_true")
    a = ap.parse_args()
    if a.selftest:
        sys.exit(selftest())
    if not (a.target and a.hex and a.max is not None):
        ap.error("укажи кадр или папку, --hex и --max, или --selftest")
    sys.exit(run(a.target, a.hex, a.max, a.tol))
