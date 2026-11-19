"""Placeholder inputs for checking that the template builds without a real site, photo, logo or track.
Writes (all ignored by git): public/dev/tablet/*.png, public/dev/phone/*.png (synthetic screens drawn from config.json),
src/states/states_tablet.json and states_phone.json (boxes and texts in the capture's format), the palette's table images
(a noise texture, not a photo, dark or light by the palette), public/brand/logo_alpha.png (the word «studio»), music/track.wav
(a metronome at the config's BPM). For a real reel replace all of them: capture/capture.js, scripts/table_photo.py,
scripts/logo_alpha.py and a real track (README, step 2).
python scripts/make_placeholders.py [--font PATH_TO_TTF_WITH_CYRILLIC]"""
import json, math, os, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
C = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf8"))
FONT = sys.argv[sys.argv.index("--font") + 1] if "--font" in sys.argv else None
for cand in [FONT, "C:/Windows/Fonts/arial.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
    if cand and os.path.exists(cand): FONT = cand; break
def font(px): return ImageFont.truetype(FONT, int(px)) if FONT else ImageFont.load_default()
V = C["variant"]; P = C["palettes"][V["palettePreset"]]
INK, PANEL, CREAM, BRASS = P["ink"], P["panel"], P["text"], P["accent"]  # the site's colours as the palette sets them (capture.cssVars)
ENTER = V["enterFrom"]  # the ad build of the site slides the notice and the new row in from this side (capture.enterParam)

def text_entry(t, box, fs):
    cap = any(ch.isupper() or ch.isdigit() for ch in t)
    return {"t": t, "box": box, "fs": fs, "letter": round(fs * (0.72 if cap else 0.52), 1), "kind": "cap" if cap else "x"}
def words_of(entries):
    out = []
    for e in entries:
        x, y, w, h = e["box"]; parts = e["t"].split(); tot = sum(len(p) for p in parts) + len(parts) - 1
        cx = x
        for p in parts:
            pw = w * len(p) / max(1, tot); out.append([round(cx, 1), y, round(pw, 1), h, p]); cx += pw + w / max(1, tot)
    return out
def paint(im, entries, rects):
    d = ImageDraw.Draw(im)
    for (x, y, w, h, fill, outline) in rects: d.rectangle([x, y, x + w, y + h], fill=fill, outline=outline, width=2)
    for e in entries:
        x, y, w, h = e["box"]; d.text((x, y + (h - e["fs"]) / 2), e["t"], fill=e.get("color", CREAM), font=font(e["fs"]))
def draw(size, entries, rects, path, layer=None):
    im = Image.new("RGB", size, INK); paint(im, entries, rects)
    if layer:  # the new row sliding in from a side: drawn whole, shifted, and clipped to its opening slot
        le, lr, (cx, cy, cw, ch) = layer
        if ch > 0:
            lay = Image.new("RGB", size, INK); paint(lay, le, lr)
            box = (int(cx), int(cy), int(cx + cw), int(cy + ch)); im.paste(lay.crop(box), box[:2])
    os.makedirs(os.path.dirname(path), exist_ok=True); im.save(path)
def state(entries, el, vw, vh):
    return {"el": el, "texts": [{k: v for k, v in e.items() if k != "color"} for e in entries], "words": words_of(entries), "vw": vw, "vh": vh, "scrollY": 0}

O, L = C["order"], C["labels"]
states_t, states_p = {}, {}
# ---------- the owner's phone (390 x 844 CSS px), captured in the tablet run
def shift(e, dx): return dict(e, box=[round(e["box"][0] + dx, 1)] + e["box"][1:])
def owner(k=None, accepted=False):
    # k: frames since the order arrived (None: before); the notice first, the row opens over frames 9-25. enterFrom top:
    # the notice appears and the row opens from its top; left / right: both slide in from that side (the row's slot
    # still opens, the rows below move down as captured)
    entries, rects = [], [(0, 0, 390, 82, PANEL, None)]
    entries += [text_entry(C["business"]["name"], [16, 14, 150, 26], 22), text_entry("Кабинет · Заказы", [180, 18, 160, 18], 12)]
    arrived = k is not None
    toast = arrived and not accepted
    side = {"left": -1, "right": 1}.get(ENTER, 0)
    pt = 1 - (1 - min(1.0, ((k if k is not None else 99) + 1) / 9)) ** 3  # the notice slides in over frames 0-8 (ease-out)
    dxt = side * (1 - pt) * 374
    if toast:
        rects.append((16 + dxt, 90, 358, 56, PANEL, BRASS))
        entries += [shift(text_entry(L["toast"], [33, 100, 140, 35], 24), dxt), shift(dict(text_entry(O["totalText"], [280, 102, 78, 32], 24), color=BRASS), dxt)]
    ins = 0 if not arrived else max(0.0, min(1.0, ((k if k is not None else 99) - 9) / 16))
    new_count = 1 if arrived and ins >= 0.5 and not accepted else 0
    entries += [text_entry("Заказы", [16, 165, 99, 40], 30), text_entry(f'{L["newCountPrefix"]} {new_count}', [16, 204, 94, 35], 24)]
    h = 163.8 * (1 - (1 - ins) ** 2.2) if arrived else 0
    rows, layer = [], None
    def row_content(hh, dx):
        re_, rr = [], []
        if hh > 60:
            re_ += [text_entry("№", [28, 282.8, 23, 32], 24), text_entry(O["number"], [51, 282.8, 47, 32], 24),
                    dict(text_entry(L["statusAccepted"] if accepted else L["statusNew"], [117.6, 280.8, 99.6, 35], 24), color=INK), text_entry(O["customerShort"], [290, 286, 70, 24], 17)]
            rr.append((112, 280, 104, 36, CREAM if accepted else BRASS, None))
        if hh > 110: re_.append(text_entry(O["product"], [28, 322.8, 300, 26], 18))
        if hh > 150:
            re_ += [text_entry(O["totalText"], [28, 368.5, 60, 27], 20)]
            if not accepted: re_.append(dict(text_entry(L["accept"], [254, 364.5, 91, 35], 24), color=INK)); rr.append((237, 360.5, 125, 44, BRASS, None))
        return [shift(e, dx) for e in re_], [(x + dx, y, w, hh_, f, o) for (x, y, w, hh_, f, o) in rr]
    if arrived and h > 1:
        if side == 0:
            rows.append([16, 261.8, 358, round(h, 1)])
            re_, rr = row_content(h, 0); entries += re_; rects += rr
        else:
            dxr = side * (1 - ins) ** 2.2 * 374  # the row slides in while its slot opens
            rows.append([round(16 + dxr, 1), 261.8, 358, round(h, 1)])
            re_, rr = row_content(163.8, dxr)
            vis = [e for e in re_ if e["box"][1] + e["box"][3] <= 261.8 + h and e["box"][0] < 390 and e["box"][0] + e["box"][2] > 0]
            entries += vis; layer = (re_, rr, (0, 261.8, 390, h))
    y = 261.8 + h
    for num, nm in (("2050", "Олег Н."), ("2049", "Ирина К.")):
        rows.append([16, round(y, 1), 358, 145.8])
        entries += [text_entry("№" + num, [28, y + 20, 80, 32], 24), text_entry("Доставлен", [110, y + 25, 70, 22], 15), text_entry(nm, [290, y + 24, 70, 24], 17)]
        y += 145.8
    el = {"rows": rows, "toast": [round(16 + dxt, 1), 90, 358, 56] if toast else None, "accept": [237, 360.5, 125, 44] if arrived and not accepted and h > 150 else None, "header": [0, 0, 390, 82]}
    return entries, rects, el, layer
def put_owner(name, k=None, accepted=False):
    e, r, el, layer = owner(k, accepted); draw((390, 844), e, r, os.path.join(ROOT, "public/dev/tablet", name + ".png"), layer); states_t[name] = state(e, el, 390, 844)
put_owner("owner_before")
for k in range(0, 61): put_owner(f"owner_m_{k:02d}", k)
put_owner("owner_orders", 60); put_owner("owner_accept_pre", 60)
for k in range(0, 22): put_owner(f"owner_acc_{k:02d}", 60, accepted=k >= 8)
put_owner("owner_accepted", 60, accepted=True)
# ---------- the tablet (820 x 1180): the cart, the filled form, the order page
def tablet(kind):
    entries, rects = [text_entry(C["business"]["name"], [24, 25, 150, 26], 24)], [(0, 0, 820, 82, PANEL, None)]
    if kind == "drawer":
        rects += [(380, 82, 440, 1098, PANEL, None), (393, 1052, 407, 48, CREAM, None)]
        entries += [text_entry(O["product"], [400, 140, 300, 24], 18), text_entry(L["total"], [400, 990, 60, 23], 16), text_entry(O["totalText"], [720, 990, 76, 23], 16), dict(text_entry(L["checkoutButton"], [470, 1064, 200, 24], 13), color=INK)]
    elif kind == "form":
        entries += [text_entry("Оформление", [24, 150, 300, 40], 32), text_entry(O["customer"], [24, 260, 300, 24], 16), text_entry(O["customerPhone"], [420, 260, 300, 24], 16)]
        rects.append((24, 500, 200, 44, CREAM, None))
    else:
        entries += [text_entry(L["orderPlaced"].replace("{n}", O["number"]), [24, 170.6, 520, 64], 48), text_entry("Статус", [24, 307.2, 96, 53], 36),
                    dict(text_entry(L["statusNew"], [140.9, 307.2, 149.4, 53], 36), color=BRASS), text_entry(O["product"], [24, 462, 300, 24], 18),
                    text_entry(L["total"], [24, 636, 88, 53], 36), text_entry(O["totalText"], [340, 636, 132, 48], 36)]
    return entries, rects
for name, kind in (("drawer", "drawer"), ("contacts_filled", "form"), ("order", "order")):
    e, r = tablet(kind); draw((820, 1180), e, r, os.path.join(ROOT, "public/dev/tablet", name + ".png")); states_t[name] = state(e, {}, 820, 1180)
# ---------- the client's phone (390 x 844): the product card
e = [text_entry(C["business"]["name"], [120, 20, 150, 22], 18), text_entry(O["product"], [24, 680, 300, 36], 28), text_entry(O["totalText"], [24, 790, 90, 32], 24)]
draw((390, 844), e, [(16, 140, 358, 447, "#d8d0c4", None)], os.path.join(ROOT, "public/dev/phone/product.png"))
states_p["product"] = state(e, {"h1": [24, 680, 300, 36], "productPrice": [24, 790, 90, 32]}, 390, 844)
os.makedirs(os.path.join(ROOT, "src/states"), exist_ok=True)
json.dump(states_t, open(os.path.join(ROOT, "src/states/states_tablet.json"), "w", encoding="utf8"), ensure_ascii=False)
json.dump(states_p, open(os.path.join(ROOT, "src/states/states_phone.json"), "w", encoding="utf8"), ensure_ascii=False)
# ---------- the table, the logo, the track
rng = np.random.default_rng(7); w, h = 1500, 1000
grain = np.cumsum(rng.normal(0, 1, (h, 1)), axis=0) * 3 + rng.normal(0, 6, (h, w))
tone, amp = ((62, 40, 28), 1.0) if P["mode"] == "dark" else ((214, 196, 168), 0.25)  # dark wood or pale oak, by the palette
grain = (grain - grain.mean()) * amp + (grain.mean() if amp == 1.0 else 0)
base = np.stack([tone[0] + grain, tone[1] + grain * 0.7, tone[2] + grain * 0.5], -1).clip(0, 255).astype(np.uint8)
TF, TT = os.path.join(ROOT, "public", P["table"]["full"]), os.path.join(ROOT, "public", P["table"]["tile"])
os.makedirs(os.path.dirname(TF), exist_ok=True)
Image.fromarray(base).save(TF, quality=88)
t = Image.new("RGB", (w * 2, h * 2)); im = Image.fromarray(base); from PIL import ImageOps
t.paste(im.resize((w, h)), (0, 0)); t.paste(ImageOps.mirror(im), (w, 0)); t.paste(ImageOps.flip(im), (0, h)); t.paste(ImageOps.flip(ImageOps.mirror(im)), (w, h))
t.resize((w, h)).save(TT, quality=85)
# the word fills the canvas to 8 px from each edge, as scripts/logo_alpha.py crops a real logo (the card sizes it by that)
lw, lh = C["card"]["logoPx"]; big = Image.new("RGBA", (2400, 600), (0, 0, 0, 0)); ImageDraw.Draw(big).text((20, 20), "studio", fill=(190, 69, 34, 255), font=font(400))
logo = Image.new("RGBA", (lw, lh), (0, 0, 0, 0)); logo.paste(big.crop(big.getbbox()).resize((lw - 16, lh - 16)), (8, 8))
os.makedirs(os.path.join(ROOT, "public/brand"), exist_ok=True); logo.save(os.path.join(ROOT, "public", C["card"]["logo"]))
M = C["music"]; sr = 48000; dur = M["start"] + M["endBeat"] * 60 / M["bpm"] + 2; n = int(sr * dur); tt = np.arange(n) / sr
beat = 60 / M["bpm"]; ph = (tt % beat); x = 0.5 * np.sin(2 * math.pi * 60 * tt) * np.exp(-ph * 18) + 0.08 * np.sin(2 * math.pi * 220 * tt)
os.makedirs(os.path.join(ROOT, "music"), exist_ok=True)
with wave.open(os.path.join(ROOT, "music/track.wav"), "w") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes((x * 0.6 * 32767).astype(np.int16).tobytes())
print(f"placeholders: {len(states_t)} tablet states, {len(states_p)} phone state, table, logo, music/track.wav ({dur:.1f} s)")
