"""Final checks of the finished reel (look16). Each one has a known bad input (--bad-*).
  timeline TIMELINE.json [--bad]      stretches without any text on screen (captions and the card) <= 1.5 s, from the
                                      timeline exported by the code; events on the beat grid (taps, card) within 1 frame
  linear SRC...                       no linear curves: interpolate( without easing, linearTiming, Easing.linear, raw
                                      ramps "(t - a) / b" not wrapped in smooth/glide/ease
  cover COVER.png MASK.png [--bad]    the cover's title: whole inside the 1:1 and 3:4 centre crops, cap height at a
                                      120 px wide tile >= 7 px, and the cover not dark (mean luminance of the title band)
  av VIDEO.mp4                        1080x1920, 30 fps, h264 + aac, video and audio length within one frame
"""
import json, re, subprocess, sys
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding="utf-8")
import os
REEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
mode = sys.argv[1]; fails = []
if mode == "timeline":
    T = json.load(open(sys.argv[2], encoding="utf8"))
    caps = sorted([(c["at0"], c["at1"], c["text"]) for c in T["captions"]])
    if "--bad" in sys.argv: caps = [c for c in caps if c is not caps[1]]  # a known bad input: the client caption removed
    t, gaps = 0.0, []
    for a0, a1, txt in caps:
        if a0 - t > 0: gaps.append((t, a0))
        t = max(t, a1)
    if T["end"] - t > 0: gaps.append((t, T["end"]))
    for g0, g1 in gaps:
        bad = g1 - g0 > 1.5
        print(f"   {g0:.2f}-{g1:.2f} s without text: {g1 - g0:.2f} s{'  FAIL > 1.5 s' if bad else ''}")
        if bad: fails.append(f"gap {g0:.2f}-{g1:.2f}")
    B = T["beat"]
    for e in T["events"]:
        k = e["t"] / B; off = abs(k - round(k)) * B
        strong = round(k) % 4 == 0
        print(f"   {e['name']}: {e['t']:.3f} s, beat {round(k)}{' (bar downbeat)' if strong else ''}, off the grid {off * 1000:.0f} ms")
        if e["name"] in ("касание «Оформить заказ»", "касание «Принять»", "карточка", "уведомление") and off > 1 / 30: fails.append(f"{e['name']} off the beat")
elif mode == "linear":
    files = sys.argv[2:]
    for f in files:
        for i, line in enumerate(open(f, encoding="utf8"), 1):
            hits = []
            if "interpolate(" in line and "easing" not in line: hits.append("interpolate without easing")
            if "linearTiming" in line: hits.append("linearTiming")
            if "Easing.linear" in line: hits.append("Easing.linear")
            for m in re.finditer(r"\(\s*(?:t|el|ae)\s*-[^()]*\)\s*/\s*[\w.]+", line):
                if not re.search(r"(smooth|glide|ease\w*|bez|Easing\.\w+|k)\(\s*$", line[: m.start()]): hits.append("raw ramp " + m.group(0))
            for h in hits: fails.append(f"{f.split(chr(92))[-1]}:{i} {h}"); print(f"   FAIL {f.split(chr(92))[-1]}:{i} {h}")
    print("   files:", ", ".join(x.split("\\")[-1].split("/")[-1] for x in files))
elif mode == "cover":
    img = Image.open(sys.argv[2]).convert("L"); m = np.asarray(Image.open(sys.argv[3]).convert("L")) > 128
    if "--bad" in sys.argv:  # a known bad input: the title moved to the top of the frame and dimmed
        m = np.roll(m, -520, axis=0); img = Image.fromarray((np.asarray(img) * 0.2).astype(np.uint8))
    ys, xs = np.where(m); y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    for name, (a, b) in {"1:1": (420, 1500), "3:4": (240, 1680)}.items():
        ok = y0 >= a and y1 <= b
        print(f"   title y {y0}-{y1} inside the {name} crop (y {a}-{b}): {'ok' if ok else 'FAIL'}")
        if not ok: fails.append(f"title outside {name}")
    rows = np.where(m.any(1))[0]; first = rows[0]; lines = []
    start = first
    for r0, r1 in zip(rows, rows[1:]):
        if r1 - r0 > 8: lines.append((start, r0)); start = r1
    lines.append((start, rows[-1]))
    l0 = lines[0]; cols = np.where(m[l0[0]:l0[1] + 1].any(0))[0]; gap = np.where(np.diff(cols) > 1)[0]
    gx1 = cols[gap[0]] if len(gap) else cols[-1]; g = np.where(m[l0[0]:l0[1] + 1, cols[0]:gx1 + 1].any(1))[0]
    cap = (g[-1] - g[0] + 1) * 120 / 1080
    print(f"   first capital at a 120 px tile: {cap:.1f} px {'ok' if cap >= 7 else 'FAIL (< 7)'}")
    if cap < 7: fails.append("title too small at 120 px")
    a = np.asarray(img).astype(np.float32); band = a[max(0, y0 - 40):y1 + 40]
    # light title on a dark veil or dark title on a light one (a light palette): the difference either way
    print(f"   title band mean luminance {band.mean():.0f}, title pixels mean {a[m].mean():.0f} (contrast {abs(a[m].mean() - band.mean()):.0f})")
    if abs(a[m].mean() - band.mean()) < 60: fails.append("title contrast")
    for name, (a0, b0) in {"1x1": (420, 1500), "3x4": (240, 1680)}.items():
        Image.open(sys.argv[2]).convert("RGB").crop((0, a0, 1080, b0)).resize((120, int(120 * (b0 - a0) / 1080)), Image.LANCZOS).save(sys.argv[2].replace(".png", f"_tile_{name}_120.png"))
elif mode == "av":
    import os; r = subprocess.run(f"npx remotion ffprobe -v error -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames,duration,sample_rate -of json \"{os.path.abspath(sys.argv[2])}\"", cwd=REEL, shell=True, capture_output=True, text=True)
    st = json.loads(r.stdout)["streams"]; v = [s for s in st if s["codec_type"] == "video"][0]; au = [s for s in st if s["codec_type"] == "audio"][0]
    dv, da = float(v["duration"]), float(au["duration"])
    print(f"   video {v['codec_name']} {v['width']}x{v['height']} {v['r_frame_rate']} {v.get('nb_frames')} frames {dv:.3f} s; audio {au['codec_name']} {au['sample_rate']} Hz {da:.3f} s; difference {abs(dv - da) * 1000:.0f} ms")
    if not (v["codec_name"] == "h264" and au["codec_name"] == "aac" and v["width"] == 1080 and v["height"] == 1920 and v["r_frame_rate"] == "30/1"): fails.append("format")
    if abs(dv - da) > 1 / 30: fails.append("audio and video differ by more than a frame")
print("OK" if not fails else f"FAIL: {len(fails)} {fails}")
sys.exit(0 if not fails else 1)
