# Подпись художника в финале (каркас эссе, раздел 5): место, размер, время, бюджет красного, штрих строки рядом.
#   python checks/check_signature.py --geom out/geometry.json --hex BE4522 [--frames build/frames] [--seal "печать 空"]
#        [--line "линия кистью"] [--first N] [--last N] [--min-width 220 --max-width 280] [--studio right|below] [--label имя]
# Логотип ищется сам: пиксели в допуске 40 от --hex (основной цвет логотипа) вне рамки печати на кадре --last
# (последний кадр до смешения петли; по умолчанию кадров всего − loopFrames − 1). Строка рядом («Studio») — тёмные
# пиксели справа от логотипа в его полосе высоты (--studio below — под логотипом).
# Логотип лежит на бумаге и едет с камерой: маска сердцевины букв с кадра --last ищется в каждом кадре со сдвигом.
# Требования (проверь, что они записаны в brief.md, «Решения по сценам»):
#  - ширина логотипа --min-width…--max-width px;
#  - вся подпись вне зон Reels: верх 14 %, низ 35 %, 6 % с боков, колонка кнопок справа от 45 % высоты;
#  - не в рамке подписи финала; не ближе 40 px к рамкам --seal и --line;
#  - проявление 0,4–0,6 с (альфа 0,02 → 0,98), в полную силу (альфа ≥ 0,98) подряд ≥ 1,8 с до кадра --last включительно;
#  - красное (--seal-hex, допуск 40) печать + логотип ≤ --budget % кадра на каждом кадре --first…--last; у печати больше, чем у логотипа;
#  - штрих строки рядом в 360 px: медиана ≥ 1 px (check_stroke_360.py; делай с запасом, около 1,5 px).
import sys, json, argparse, os
sys.stdout.reconfigure(encoding="utf-8")
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("--frames", default="build/frames"); ap.add_argument("--geom", required=True); ap.add_argument("--label", default="")
ap.add_argument("--first", type=int); ap.add_argument("--last", type=int)
ap.add_argument("--hex", default="BE4522"); ap.add_argument("--seal-hex", default="B73D31"); ap.add_argument("--budget", type=float, default=3.5)
ap.add_argument("--seal"); ap.add_argument("--line", default="линия кистью")
ap.add_argument("--min-width", type=int, default=220); ap.add_argument("--max-width", type=int, default=280)
ap.add_argument("--studio", default="right", choices=["right", "below"])
a = ap.parse_args()
hexc = lambda h: np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)])
LOGO = hexc(a.hex); SEAL = hexc(a.seal_hex)
fr = lambda n: np.asarray(Image.open(os.path.join(a.frames, f"f_{n:06d}.png")).convert("RGB"), np.int32)
g = json.load(open(a.geom, encoding="utf-8"))
W, H, FPS = g["timeline"]["width"], g["timeline"]["height"], g["timeline"]["fps"]
if a.last is None:
    cfgp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")
    L = json.load(open(cfgp, encoding="utf-8"))["timing"].get("loopFrames", 0) if os.path.exists(cfgp) else 0
    a.last = g["timeline"]["totalFrames"] - L - 1
if a.first is None: a.first = a.last - 3 * FPS
gf = {f["frame"]: f for f in g["frames"]}
near = min(gf, key=lambda n: abs(n - a.last))
keep = {b["name"]: b for b in gf[near]["keep"]}
sname = a.seal or next((k for k in keep if k.startswith("печать") and keep[k]["scene"] == len(g["timeline"]["scenes"]) - 1), None)
if not sname or sname not in keep: print(f"{a.label}: нет рамки печати финала (--seal)"); sys.exit(1)
seal = keep[sname]; line = keep.get(a.line, dict(x0=-1e6, y0=-1e6, x1=-1e6, y1=-1e6))
caps = [c for c in gf[near]["caps"] if c.get("alpha", 1) > 0.05]
errs = []

full = fr(a.last); paper = fr(a.first)
red = np.sqrt(((full - LOGO) ** 2).sum(2)) <= 40
sx = (np.arange(W)[None, :] >= seal["x0"] - 2) & (np.arange(W)[None, :] <= seal["x1"] + 2)
sy = (np.arange(H)[:, None] >= seal["y0"] - 2) & (np.arange(H)[:, None] <= seal["y1"] + 2)
red &= ~(sx & sy)
ys, xs = np.nonzero(red)
if len(xs) < 500: print(f"{a.label}: логотип не найден"); sys.exit(1)
# крупнейшая плотная группа: отбрасываем одиночные пиксели вне логотипа
cx, cy = np.median(xs), np.median(ys); k = (np.abs(xs - cx) < 200) & (np.abs(ys - cy) < 80); xs, ys = xs[k], ys[k]
rx0, ry0, rx1, ry1 = xs.min(), ys.min(), xs.max(), ys.max()
wr = rx1 - rx0 + 1
dark = full.mean(2) < 120
if a.studio == "below":
    st = dark[ry1 + 3: ry1 + 60, rx0: rx1 + 1]; ox, oy = rx0, ry1 + 3
else:
    st = dark[max(0, ry0 - 12): ry1 + 8, rx1 + 3: min(W, rx1 + 260)]; ox, oy = rx1 + 3, max(0, ry0 - 12)
sy_, sx_ = np.nonzero(st)
bx0, by0, bx1, by1 = rx0, ry0, rx1, ry1
if len(sx_):
    bx0, bx1 = min(bx0, ox + sx_.min()), max(bx1, ox + sx_.max()); by0, by1 = min(by0, oy + sy_.min()), max(by1, oy + sy_.max())
    sbox = (ox + sx_.min() - 3, oy + sy_.min() - 3, ox + sx_.max() + 4, oy + sy_.max() + 4)
print(f"{a.label}: логотип x {rx0}–{rx1}, y {ry0}–{ry1}, ширина {wr} px, высота {ry1 - ry0 + 1} px; "
      f"строка рядом высота {sy_.max() - sy_.min() + 1 if len(sy_) else 0} px; вся подпись x {bx0}–{bx1}, y {by0}–{by1}")
if not a.min_width <= wr <= a.max_width: errs.append(f"ширина логотипа {wr} px вне {a.min_width}–{a.max_width}")
if len(sx_):
    import subprocess
    r = subprocess.run([sys.executable, os.path.join(os.path.dirname(os.path.abspath(__file__)), "check_stroke_360.py"), "--image", os.path.join(a.frames, f"f_{a.last:06d}.png"),
                        "--box", ",".join(str(int(v)) for v in sbox), "--label", "   строка рядом, штрих"], capture_output=True, text=True, encoding="utf-8")
    print(r.stdout.strip())
    if r.returncode: errs.append("штрих строки рядом тоньше 1 px в 360 px")
else: errs.append("строка рядом с логотипом не найдена")
zones = []
if by0 < 0.14 * H: zones.append("верх 14 %")
if by1 > 0.65 * H: zones.append("низ 35 %")
if bx0 < 0.06 * W or bx1 > 0.94 * W: zones.append("6 % с боков")
if bx1 > 0.86 * W and by1 > 0.45 * H: zones.append("колонка кнопок")
if zones: errs.append("в зонах Reels: " + ", ".join(zones))
def gap(b):
    dx = max(b["x0"] - bx1, bx0 - b["x1"], 0); dy = max(b["y0"] - by1, by0 - b["y1"], 0)
    return (dx * dx + dy * dy) ** 0.5 if dx and dy else max(dx, dy)
for nm, b in ((sname, seal), (a.line, line)):
    d = gap(b); print(f"   до рамки «{nm}»: {d:.0f} px")
    if d < 40: errs.append(f"ближе 40 px к «{nm}» ({d:.0f} px)")
for c in caps:
    if gap(c) == 0: errs.append(f"в рамке подписи «{c.get('str', '')[:20]}»")
    else: print(f"   до рамки подписи: {gap(c):.0f} px")

# альфа по кадрам (v14: логотип едет вместе с бумагой). Маска логотипа с кадра --last сдвигается на сдвиг логотипа
# в этом кадре (поиск по красноте R−G, сдвиг ±4 px по x, −6…+30 px по y: раньше логотип ниже, он поднимается с бумагой);
# альфа = (краснота R−G внутри маски − краснота бумаги) / то же на кадре --last; бумага — медиана R−G окна дальше 10 px от букв.
# Краснота линейна по альфе: BE4522 даёт R−G 121, бумага ≈ 10.
# Шум сжатия и сдвиг бумаги усредняются по тысячам пикселей маски (сумма по окну с бумагой кадра --first давала ±2 %).
wx0, wx1, wy0, wy1 = max(0, rx0 - 14), min(W, rx1 + 14), max(0, ry0 - 40), min(H, ry1 + 40)
M0 = np.zeros((H, W), bool); M0[ry0:ry1 + 1, rx0:rx1 + 1] = red[ry0:ry1 + 1, rx0:rx1 + 1]
from scipy.ndimage import binary_dilation, binary_erosion
M0 = binary_erosion(M0, iterations=2)  # сердцевина штрихов: сдвиг на доли пикселя не задевает края
def measure(im, prev=(0, 0)):
    rd = im[..., 0] - im[..., 1]
    best, bs = -1e18, (0, 0)
    ys_, xs_ = np.nonzero(M0)
    for dy in range(-6, 31):
        for dx in range(-4, 5):
            v = rd[ys_ + dy, xs_ + dx].sum()
            if v > best: best, bs = v, (dx, dy)
    dx, dy = bs
    M = np.zeros_like(M0); M[ys_ + dy, xs_ + dx] = True
    far = ~binary_dilation(M, iterations=10)
    far[:wy0] = far[wy1:] = False; far[:, :wx0] = far[:, wx1:] = False
    return float(rd[M].mean() - np.median(rd[far])), bs
Fv, _ = measure(full)
alpha = {}
shares = {}
for n in range(a.first, a.last + 1):
    im = fr(n)
    v, sh = measure(im)
    alpha[n] = float(min(1.05, max(0.0, v / max(Fv, 1))))
    rr = np.sqrt(((im - SEAL) ** 2).sum(2)) <= 40
    lg = rr[wy0:wy1, wx0:wx1].sum()
    shares[n] = (rr.mean() * 100, lg / rr.size * 100, (rr.sum() - lg) / rr.size * 100)
on = [n for n in alpha if alpha[n] > 0.02]; fullf = [n for n in alpha if alpha[n] >= 0.98]
if not on or not fullf: errs.append("логотип не проявляется"); t0 = t1 = None
else:
    t0, t1 = on[0], fullf[0]
    run = 0
    for n in range(a.last, a.first - 1, -1):
        if alpha[n] >= 0.98: run += 1
        else: break
    fade = (t1 - t0) / FPS
    print(f"   проявление: кадры {t0}–{t1} ({t0 / FPS:.2f}–{t1 / FPS:.2f} с), {fade:.2f} с; "
          f"в полную силу подряд кадры {a.last - run + 1}–{a.last} = {run} кадров = {run / FPS:.2f} с до смешения петли")
    if not 0.35 <= fade <= 0.62: errs.append(f"проявление {fade:.2f} с вне 0,4–0,6 с")
    if run / FPS < 1.8: errs.append(f"в полную силу {run / FPS:.2f} с < 1,8 с")
    mono = all(alpha[n + 1] >= alpha[n] - 0.02 for n in range(t0, t1))
    if not mono: errs.append("проявление не монотонно")
worst = max(shares, key=lambda n: shares[n][0])
tot, lg, rest = shares[worst]
print(f"   красное {a.seal_hex}±40, худший кадр {worst}: всего {tot:.2f} % (логотип {lg:.2f} %, печать и прочее {rest:.2f} %), бюджет {a.budget} %")
if tot > a.budget: errs.append(f"красного {tot:.2f} % > {a.budget} % (кадр {worst})")
if lg >= rest: errs.append("у логотипа красного не меньше, чем у печати")
print(f"{a.label}: " + ("ок" if not errs else "НЕ ПРОШЛО — " + "; ".join(errs)))
sys.exit(0 if not errs else 1)
