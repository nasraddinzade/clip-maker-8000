# Зоны интерфейса для ЭЛЕМЕНТОВ (не только подписей): знаки глав (рамка туши), печати и всё, что называет голос.
#   python checks/check_ui_elements.py out/geometry.json [--config config.json] [--bad-shift 300]
# Рамки — из выгрузки рендера (npm run geometry: keep по кадрам, с учётом камеры). Проверяются элементы, чьё имя
# начинается с одного из config.json → checks.zoneElements; фон и продолжение картинки в список не входят.
# Зоны Reels (reference/platforms.md в clip-maker-8000): верх 14 %, низ 35 %, по 6 % с боков, колонка кнопок справа
# от 45 % высоты (x > 86 %). Элемент считается с t0 своей рамки. Кадры переезда между главами (элемент уезжает
# за край) печатаются отдельно и в итог не входят. Сначала прогон на плохом входе: самый нижний элемент сдвинут
# вниз на --bad-shift px — проверка обязана его поймать. Код 1, если есть нарушения в покое.
import sys, json, argparse
sys.stdout.reconfigure(encoding="utf-8")

ap = argparse.ArgumentParser()
ap.add_argument("geometry"); ap.add_argument("--config", default="config.json"); ap.add_argument("--bad-shift", type=float, default=300)
a = ap.parse_args()
cfg = json.load(open(a.config, encoding="utf-8"))
W, H, FPS = cfg["video"]["width"], cfg["video"]["height"], cfg["video"]["fps"]
TRAVEL, PRE = cfg["timing"].get("travel", 1.0), cfg["timing"].get("travelPre", 0.6)
PREFIX = tuple(cfg.get("checks", {}).get("zoneElements", ["иероглиф", "печать"]))
ZONES = [("верх 14 %", 0, 0, W, 0.14 * H), ("низ 35 %", 0, 0.65 * H, W, H), ("лево 6 %", 0, 0, 0.06 * W, H),
         ("право 6 %", 0.94 * W, 0, W, H), ("колонка кнопок", 0.86 * W, 0.45 * H, W, H)]


def hits(b):
    return [z[0] for z in ZONES if b["x0"] < z[3] and b["x1"] > z[1] and b["y0"] < z[4] and b["y1"] > z[2]]


def wanted(nm):
    # знак главы проверяется по рамке туши («иероглиф X (тушь)»), а не по квадрату
    if nm.startswith("иероглиф") and "тушь" not in nm: return False
    return nm.startswith(PREFIX)


def run(d, label):
    sc = d["timeline"]["scenes"]
    rest, travel = {}, {}
    for f in d["frames"]:
        n = f["frame"]
        for b in f["keep"]:
            nm = b["name"]
            if not wanted(nm): continue
            if b["x1"] <= 0 or b["x0"] >= W or b["y1"] <= 0 or b["y0"] >= H: continue  # вне кадра
            s0 = sc[b["scene"]]
            s = (n - s0["startFrame"]) / FPS
            z = hits(b)
            if not z: continue
            moving = s < TRAVEL - PRE or s > s0["duration"] - PRE or n >= s0["startFrame"] + s0["frames"]
            dst = travel if moving else rest
            r = dst.setdefault(nm, dict(frames=[], zones=set(), box=None))
            r["frames"].append(n); r["zones"].update(z); r["box"] = r["box"] or [round(b[k]) for k in ("x0", "y0", "x1", "y1")]
    print(f"== {label}")
    for nm, r in rest.items():
        print(f"  НАРУШЕНИЕ в покое: {nm}: {len(r['frames'])} кадров ({r['frames'][0]}–{r['frames'][-1]}), зоны: {', '.join(sorted(r['zones']))}, рамка {r['box']}")
    for nm, r in travel.items():
        print(f"  в переезде (элемент уезжает за край): {nm}: {len(r['frames'])} кадров ({r['frames'][0]}–{r['frames'][-1]}), зоны: {', '.join(sorted(r['zones']))}")
    print(f"  итого нарушений в покое: {sum(len(r['frames']) for r in rest.values())}")
    return rest


d = json.load(open(a.geometry, encoding="utf-8"))
# плохой вход: самый нижний из проверяемых элементов опущен на bad-shift px
names = {}
for f in d["frames"]:
    for b in f["keep"]:
        if wanted(b["name"]): names[b["name"]] = max(names.get(b["name"], 0), b["y1"])
victim = max(names, key=names.get) if names else None
bad = json.loads(json.dumps(d))
for f in bad["frames"]:
    for b in f["keep"]:
        if b["name"] == victim: b["y0"] += a.bad_shift; b["y1"] += a.bad_shift
bad_rest = run(bad, f"плохой вход: «{victim}» опущен на {a.bad_shift:.0f} px")
if victim and not bad_rest: print("  ВНИМАНИЕ: плохой вход не пойман — проверка ничего не доказывает")
rest = run(d, "проверяемая версия")
sys.exit(1 if rest else 0)
