# Проверка «прямой край размывки»: ищет в размытых массах прямые отрезки длиннее 60 px.
#   python checks/check_straight_edges.py VIDEO.mp4 --frames 1800:2250:5 [--out DIR]
#   python checks/check_straight_edges.py --dir build/frames --frames 0:N:5
# Как работает (кадр уменьшается вдвое):
#  1) размытие σ=2 убирает зерно бумаги;
#  2) край размывки — мягкий перепад яркости: градиент от LO до HI на пиксель. Резкие края туши,
#     текста и печатей (градиент выше HI) и ровная бумага (ниже LO) не учитываются;
#  3) по пикселям мягкого края — преобразование Хафа; на сильных линиях ищется непрерывный отрезок,
#     вдоль которого направление градиента перпендикулярно линии (край действительно прямой);
#  4) отрезок длиннее 60 px полного кадра, горизонтальный или вертикальный (±8°), с устойчивым перепадом
#     яркости по сторонам — находка. Рваный шумовой край прямых отрезков не даёт.
#  Ограничение: наклонные прямые края не ловятся (их не отличить от плавных кривых на 60 px).
import sys, os, json, argparse, subprocess, tempfile
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("video", nargs="?")
ap.add_argument("--dir")
ap.add_argument("--frames", required=True, help="from:to:step")
ap.add_argument("--min-len", type=float, default=60)
ap.add_argument("--out")
a = ap.parse_args()
FF = os.environ.get("FFMPEG", "ffmpeg")
LO, HI = 0.35, 4.0          # мягкий край размывки, ед. яркости на пиксель (кадр 540×960)
SCALE = 0.5
RMS_MAX = float(os.environ.get('RMS_MAX', '99'))  # порог прямизны, px полного кадра
MINLEN = a.min_len * SCALE


def blur(x, s=2.0):
    r = int(3 * s); k = np.exp(-np.arange(-r, r + 1) ** 2 / (2 * s * s)); k /= k.sum()
    x = np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode="edge"), k, "valid"), 0, x)
    return np.apply_along_axis(lambda v: np.convolve(np.pad(v, r, mode="edge"), k, "valid"), 1, x)


def segments(gray):
    gray = gray.astype(np.float32)
    g = blur(gray)
    gy, gx = np.gradient(g)
    mag = np.hypot(gx, gy)
    soft = (mag > LO) & (mag < HI)
    # не края туши: рядом (±3 px) нет резкого перепада
    sharp = mag >= HI
    near = np.zeros_like(sharp)
    for dy in range(-3, 4):
        for dx in range(-3, 4):
            near |= np.roll(np.roll(sharp, dy, 0), dx, 1)
    soft &= ~near
    soft[:6] = soft[-6:] = False; soft[:, :6] = soft[:, -6:] = False  # край кадра и виньетка
    ys, xs = np.nonzero(soft)
    if len(xs) < MINLEN: return []
    th = np.deg2rad(np.arange(0, 180, 1.5))
    rho = np.round(xs[:, None] * np.cos(th) + ys[:, None] * np.sin(th)).astype(np.int32)
    out = []
    H, W = gray.shape
    rmax = int(np.hypot(H, W)) + 2
    for ti in range(len(th)):
        cnt = np.bincount(rho[:, ti] + rmax, minlength=2 * rmax + 1)
        for r in np.nonzero(cnt >= MINLEN)[0]:
            sel = rho[:, ti] == r - rmax
            px, py = xs[sel], ys[sel]
            # направление градиента должно быть перпендикулярно линии (вдоль нормали cos θ, sin θ)
            nx, ny = np.cos(th[ti]), np.sin(th[ti])
            ok = np.abs(gx[py, px] * nx + gy[py, px] * ny) > 0.9 * mag[py, px]
            px, py = px[ok], py[ok]
            if len(px) < MINLEN: continue
            t = px * -ny + py * nx  # координата вдоль линии
            o = np.argsort(t); t = t[o]
            # самый длинный непрерывный участок (разрывы до 3 px)
            best, s0 = (0, 0, 0), 0
            for i in range(1, len(t) + 1):
                if i == len(t) or t[i] - t[i - 1] > 3:
                    if t[i - 1] - t[s0] > best[0]: best = (t[i - 1] - t[s0], o[s0], o[i - 1])
                    s0 = i
            if best[0] >= MINLEN:
                i0, i1 = best[1], best[2]
                # край — граница двух масс разной яркости: по обе стороны (±6 px) яркость устойчиво
                # различается одним знаком (у тонкого волокна бумаги обе стороны одинаковые);
                # и край занят пикселями мягкого перепада не меньше чем на 70 % длины
                L = int(best[0]); ts = np.linspace(0, 1, max(8, L // 2))
                sx = px[i0] + (px[i1] - px[i0]) * ts; sy = py[i0] + (py[i1] - py[i0]) * ts
                ax_, ay_ = np.clip((sx + 6 * nx).astype(int), 0, W - 1), np.clip((sy + 6 * ny).astype(int), 0, H - 1)
                bx_, by_ = np.clip((sx - 6 * nx).astype(int), 0, W - 1), np.clip((sy - 6 * ny).astype(int), 0, H - 1)
                diff = g[ay_, ax_] - g[by_, bx_]
                side = max((diff > 2.5).mean(), (diff < -2.5).mean())
                # прямизна: точка края уточняется по максимуму градиента вдоль нормали (±3 px, с долей пикселя),
                # затем — отклонение этих точек от прямой (СКО). Машинный край прямой до долей пикселя,
                # край размывки тушью гуляет на 1–5 px
                offs = []
                for k in range(0, len(ts), 2):
                    x0_, y0_ = sx[k], sy[k]
                    prof = [mag[int(np.clip(round(y0_ + d * ny), 0, H - 1)), int(np.clip(round(x0_ + d * nx), 0, W - 1))] for d in range(-3, 4)]
                    j = int(np.argmax(prof))
                    if 0 < j < 6:
                        a_, b_, c_ = prof[j - 1], prof[j], prof[j + 1]; den = a_ - 2 * b_ + c_
                        offs.append(j - 3 + (0.5 * (a_ - c_) / den if den != 0 else 0))
                    else:
                        offs.append(j - 3)
                offs = np.array(offs)
                tt = np.arange(len(offs))
                res = offs - np.polyval(np.polyfit(tt, offs, 1), tt) if len(offs) > 3 else offs
                rms = float(np.sqrt(np.mean(res ** 2))) / SCALE
                # фактура вдоль края с тёмной стороны (на исходном кадре, без размытия): у размывки тушью
                # зерно и волокна, у машинного градиента масса ровная
                dk = np.where(np.median(diff) < 0, 1, -1)
                qx = np.clip((sx + dk * 10 * nx).astype(int), 0, W - 1); qy = np.clip((sy + dk * 10 * ny).astype(int), 0, H - 1)
                tex = float(np.std(gray[qy, qx] - np.convolve(gray[qy, qx], np.ones(9) / 9, mode="same"))) if len(qx) > 12 else 0
                if side >= 0.8 and np.median(np.abs(diff)) >= 3.0 and min(1.0, len(px) / max(1, L)) >= 0.7 and rms <= RMS_MAX:
                    out.append(dict(len=round(best[0] / SCALE), ang=round(float(np.rad2deg(th[ti])), 1), contrast=round(float(np.median(np.abs(diff))), 1), rms=round(rms, 2), tex=round(tex, 2),
                                    p0=[int(px[i0] / SCALE), int(py[i0] / SCALE)], p1=[int(px[i1] / SCALE), int(py[i1] / SCALE)]))
    # только горизонтальные и вертикальные края (±8°): так выглядят машинные края — обрез холста
    # размывки, градиентная полоса, прямоугольник. Плавные кривые (склоны, бока пятен) на 60 px тоже
    # почти прямые, но наклонены как угодно — по длине их от прямой не отличить, поэтому наклонные не считаем.
    out = [s for s in out if min(s["ang"] % 90, 90 - s["ang"] % 90) <= 8]
    # убрать дубли (соседние углы/расстояния одной и той же линии)
    out.sort(key=lambda s: -s["len"]); res = []
    for s in out:
        if all(np.hypot(s["p0"][0] - q["p0"][0], s["p0"][1] - q["p0"][1]) > 40 or abs(s["ang"] - q["ang"]) > 6 for q in res): res.append(s)
    return res


f0, f1, st = (int(v) for v in a.frames.split(":"))
frames = list(range(f0, f1, st))
tmp = tempfile.mkdtemp()
found = {}
for n in frames:
    if a.dir:
        p = os.path.join(a.dir, f"f_{n:06d}.png")
    else:
        p = os.path.join(tmp, f"{n}.png")
        subprocess.run([FF, "-v", "error", "-y", "-i", a.video, "-vf", f"select=eq(n\\,{n})", "-vsync", "0", "-frames:v", "1", p], check=True)
    im = Image.open(p).convert("L")
    gray = np.asarray(im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.BILINEAR), dtype=np.float32)
    segs = segments(gray)
    if segs: found[n] = segs
total = sum(len(v) for v in found.values())
print(f"кадров проверено: {len(frames)}, кадров с прямыми краями ≥ {a.min_len:.0f} px: {len(found)}, отрезков: {total}")
for n, segs in list(found.items())[:40]:
    print(f"  кадр {n}: " + "; ".join(f"{s['len']} px под {s['ang']}° от {tuple(s['p0'])} до {tuple(s['p1'])}" for s in segs[:4]))
if a.out:
    os.makedirs(a.out, exist_ok=True)
    json.dump(found, open(os.path.join(a.out, "straight_edges.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
sys.exit(1 if found else 0)
