"""Звук: громкость и пики, длины дорожек, стыки.

  python audio_check.py loud    FILE                  интегральная громкость (LUFS), true peak
  python audio_check.py lengths VIDEO                 длины видео- и аудиодорожки (ffprobe), равны ли
  python audio_check.py joints  MIX --voice VOICE --at 11.17,25.53 [--out joints/] [--pad 1.5]
        вырезает по 3 с вокруг каждого стыка из итоговой дорожки (для прослушивания)
        и проверяет по ГОЛОСОВОЙ дорожке (без музыки), что на стыке тишина,
        т. е. фразы не обрезаны и не наезжают друг на друга.

Цели по умолчанию: −14 LUFS ± 1, true peak ≤ −1 dBTP, разница длин ≤ 1 кадр.
"""
import argparse, json, os, re, sys
from _common import run, tool

ap = argparse.ArgumentParser()
ap.add_argument("cmd", choices=["loud", "lengths", "joints"])
ap.add_argument("file")
ap.add_argument("--voice")
ap.add_argument("--at")
ap.add_argument("--out", default="joints")
ap.add_argument("--pad", type=float, default=1.5)
ap.add_argument("--target", type=float, default=-14.0)
ap.add_argument("--fps", type=float, default=30)
a = ap.parse_args()
ok = True

if a.cmd == "loud":
    r = run([tool("ffmpeg"), "-hide_banner", "-i", a.file, "-vn", "-af", "loudnorm=print_format=json", "-f", "null", "-"])
    e = r.stderr
    m = json.loads(e[e.rindex("{"):e.rindex("}") + 1])
    I, TP = float(m["input_i"]), float(m["input_tp"])
    ok = abs(I - a.target) <= 1.0 and TP <= -1.0
    print(f"громкость {I:.1f} LUFS (цель {a.target}), true peak {TP:.1f} dBTP, LRA {m['input_lra']} — {'ок' if ok else 'ВНЕ НОРМЫ'}")

elif a.cmd == "lengths":
    r = run([tool("ffprobe"), "-v", "error", "-show_entries", "stream=codec_type,codec_name,duration,nb_frames,width,height,r_frame_rate,sample_rate", "-of", "json", a.file])
    st = json.loads(r.stdout)["streams"]
    v = [s for s in st if s["codec_type"] == "video"]
    au = [s for s in st if s["codec_type"] == "audio"]
    for s in st:
        print({k: s.get(k) for k in ("codec_type", "codec_name", "width", "height", "r_frame_rate", "nb_frames", "sample_rate", "duration")})
    if v and au:
        dv, da = float(v[0]["duration"]), float(au[0]["duration"])
        ok = abs(dv - da) <= 1.0 / a.fps
        print(f"видео {dv:.3f} с, звук {da:.3f} с, разница {abs(dv - da) * 1000:.0f} мс — {'ок' if ok else 'РАЗНЫЕ ДЛИНЫ'}")

else:
    if not (a.voice and a.at):
        ap.error("joints требует --voice (голос без музыки) и --at (времена стыков)")
    os.makedirs(a.out, exist_ok=True)
    r = run([tool("ffmpeg"), "-hide_banner", "-i", a.voice, "-af", "silencedetect=noise=-45dB:d=0.25", "-f", "null", "-"])
    ss = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    se = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", r.stderr)]
    sil = list(zip(ss, se + [1e9] * (len(ss) - len(se))))
    for k, t in enumerate(float(x) for x in a.at.split(",")):
        clip = os.path.join(a.out, f"joint_{k:02d}_{t:.2f}s.wav")
        run([tool("ffmpeg"), "-y", "-loglevel", "error", "-ss", f"{max(0, t - a.pad):.3f}", "-t", f"{2 * a.pad:.3f}", "-i", a.file, "-vn", clip])
        hit = [x for x in sil if x[0] <= t <= x[1]]
        good = bool(hit) and hit[0][0] < t - 0.1 and hit[0][1] > t + 0.1
        ok &= good
        print(f"стык {t:.2f} с: " + (f"тишина голоса {hit[0][0]:.2f}–{hit[0][1]:.2f} — ок" if good else "НА СТЫКЕ ЗВУЧИТ ГОЛОС") + f"  → {clip}")
sys.exit(0 if ok else 1)
