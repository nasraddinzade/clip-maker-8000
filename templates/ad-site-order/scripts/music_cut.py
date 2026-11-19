"""Music for the reel (config.json «music»): the cut, fades, loudness.
The cut starts on a bar downbeat of the track (music.start) and is endBeat beats long, so the track's phrase change lands
on the card (cardBeat). A 20 ms fade-in (no click), a fade-out (music.fadeOut) to the end of the card (no cut-off). Gain
to music.lufs integrated; true peak at or under music.truePeakCeiling (4x oversampled), with a soft peak limiter only if
the gain alone would exceed it. Remotion's bundled ffmpeg has no afade/ebur128 filters and does not write float WAV:
decoding is ffmpeg's (16-bit PCM), the fades, the gain and the BS.1770 measure are here (numpy/scipy), cross-checked
with ffmpeg's loudnorm measurement. Run from anywhere; ffmpeg is called through `npx remotion ffmpeg` in the template.
python scripts/music_cut.py [OUT.wav] [--src TRACK] [--bad]   (default OUT public/audio/reel.wav; --bad: no gain)
python scripts/music_cut.py --measure FILE                     (integrated LUFS and true peak of any audio/video file)"""
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import lfilter, resample_poly
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CFG = json.load(open(os.path.join(ROOT, "config.json"), encoding="utf8"))["music"]
SRC = os.path.abspath(sys.argv[sys.argv.index("--src") + 1]) if "--src" in sys.argv else os.path.abspath(os.path.join(ROOT, CFG["file"]))
START, SR = CFG["start"], 48000
DUR = CFG["endBeat"] * 60 / CFG["bpm"]
REEL = ROOT
def ff(args):
    return subprocess.run("npx remotion ffmpeg -hide_banner " + args, cwd=REEL, shell=True, capture_output=True, text=True, encoding="utf8", errors="replace")
def k_weight(x, sr):
    # ITU-R BS.1770-4 K-weighting (coefficients for 48 kHz)
    b1, a1 = [1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585]
    b2, a2 = [1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621]
    return lfilter(b2, a2, lfilter(b1, a1, x, axis=0), axis=0)
def lufs(x, sr):
    y = k_weight(x, sr); blk, hop = int(0.4 * sr), int(0.1 * sr)
    z = np.array([np.sum(np.mean(y[i:i + blk] ** 2, axis=0)) for i in range(0, len(y) - blk + 1, hop)])
    l = -0.691 + 10 * np.log10(z + 1e-12)
    g = z[l > -70]; rel = -0.691 + 10 * np.log10(np.mean(g)) - 10
    g2 = z[(l > -70) & (l > rel)]
    return -0.691 + 10 * np.log10(np.mean(g2))
def true_peak(x):
    return 20 * np.log10(np.max(np.abs(resample_poly(x, 4, 1, axis=0))) + 1e-12)
def ff_loudnorm(path):
    r = ff(f'-i "{path}" -vn -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null -')
    j = r.stderr[r.stderr.rfind("{"): r.stderr.rfind("}") + 1]
    d = json.loads(j); return float(d["input_i"]), float(d["input_tp"])
def decode(path):
    tmp = path + ".measure.wav"; ff(f'-y -v error -i "{path}" -vn -ac 2 -ar {SR} -c:a pcm_s16le "{tmp}"')
    sr, x = wavfile.read(tmp); os.remove(tmp); return x.astype(np.float64) / (32768.0 if x.dtype == np.int16 else 1.0)
if len(sys.argv) > 2 and sys.argv[1] == "--measure":
    p = os.path.abspath(sys.argv[2]); x = decode(p)
    i_ff, tp_ff = ff_loudnorm(p)
    L, TP = lufs(x, SR), true_peak(x); ok = abs(L - CFG["lufs"]) <= 1 and TP <= -1 and abs(i_ff - CFG["lufs"]) <= 1 and tp_ff <= -1
    print(json.dumps({"file": os.path.basename(p), "seconds": round(len(x) / SR, 3), "lufs_bs1770": round(L, 2), "true_peak_dbtp": round(TP, 2), "lufs_ffmpeg": i_ff, "true_peak_ffmpeg": tp_ff, "verdict": "OK (-14 +-1 LUFS, TP <= -1 dBTP)" if ok else "FAIL"}, ensure_ascii=False))
    sys.exit(0)
args = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] != "--src"]
out = os.path.abspath(args[0] if args else os.path.join(ROOT, "public/audio/reel.wav")); os.makedirs(os.path.dirname(out), exist_ok=True); raw = out + ".raw.wav"
ff(f'-y -v error -ss {START} -t {DUR} -i "{SRC}" -ac 2 -ar {SR} -c:a pcm_s16le "{raw}"')
sr, x = wavfile.read(raw); os.remove(raw); x = x.astype(np.float64) / 32768.0
n = len(x); t = np.arange(n) / SR
env = np.minimum(1, t / 0.02) * np.clip((DUR - t) / CFG["fadeOut"], 0, 1) ** 1.5  # eased fade-out
x = x * env[:, None]
if "--bad" not in sys.argv:
    g = 10 ** ((CFG["lufs"] - lufs(x, SR)) / 20); x = x * g
    tp = true_peak(x)
    # a look-ahead peak limiter where the gain alone passes the ceiling: the gain each sample needs (4x oversampled peak),
    # spread back 5 ms (min filter: the gain is down before the peak) and smoothed 5 ms; no gain back up afterwards (that
    # would bring the peaks back); a loudness under the target after limiting is printed and judged by --measure
    from scipy.ndimage import minimum_filter1d, uniform_filter1d
    for _ in range(3):
        if true_peak(x) <= CFG["truePeakCeiling"]: break
        ceil = 10 ** ((CFG["truePeakCeiling"] - 0.2) / 20); k = int(0.005 * SR)
        up = np.abs(resample_poly(x, 4, 1, axis=0)).max(axis=1)[: 4 * n].reshape(-1, 4).max(axis=1)
        need = np.minimum(1, ceil / np.maximum(up, 1e-9))
        need = uniform_filter1d(minimum_filter1d(need, size=2 * k + 1, origin=-k // 2), size=k)
        x = x * np.minimum(need, 1)[:, None]
wavfile.write(out, SR, x.astype(np.float32))
print(json.dumps({"out": out, "seconds": round(n / SR, 3), "lufs": round(lufs(x, SR), 2), "true_peak_dbtp": round(true_peak(x), 2)}))
