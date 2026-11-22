"""Сведение: голос (config.voice.file) + отрезок трека (config.music.file).
1. Отрезок трека длиной ролика с самой ровной громкостью (разброс RMS по 0,5 с), начало на доле (103,34 BPM).
2. Музыка: нарастание 1,5 с, затухание 3,5 с, срез около 2,8 кГц на 4 дБ и мягкий срез низа около 500 Гц (место голосу),
   мягкий компрессор 2:1. Без автоприглушения под голос (video-voice).
3. Уровень: медиана «музыка минус голос» в окнах речи по 0,5 с = −22 дБ (вариант A) и −18 дБ (вариант B, на 4 дБ громче).
4. Итог loudnorm в два прохода до −14 LUFS, true peak −1,5 dBTP. Длина ровно как у ролика.
python scripts/mix.py   (пишет public/audio/mix_A.wav, mix_B.wav, voice_stem.wav, music/mix_report.json и music.start в config.json)"""
import json, os, subprocess, sys, wave
import numpy as np
from scipy.signal import lfilter
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')
TL = json.load(open(os.path.join(ROOT, 'src', 'timeline.json'), encoding='utf-8'))
CFGP = os.path.join(ROOT, 'config.json'); CFG = json.load(open(CFGP, encoding='utf-8'))
BEAT = {'phase_s': CFG['music']['phase'], 'beat_s': CFG['music']['beat']}
SR = 48000
DUR = TL['frames'] / TL['fps']
OFF = TL['voiceOffset']
OUT = os.path.join(ROOT, 'public', 'audio'); os.makedirs(OUT, exist_ok=True)

def decode(src, ch):
    tmp = os.path.join(ROOT, 'music', '_dec.wav')
    subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ac', str(ch), '-ar', str(SR), '-c:a', 'pcm_s16le', tmp], check=True)
    w = wave.open(tmp); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768; w.close(); os.remove(tmp)
    return x.reshape(-1, ch)
def write(path, x):
    y = np.clip(x, -1, 1); w = wave.open(path, 'wb'); w.setnchannels(y.shape[1]); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767).astype(np.int16).tobytes()); w.close()
def loudnorm(src, dst, I=-14, TP=-1.5):
    r = subprocess.run([FF, '-hide_banner', '-i', src, '-af', f'loudnorm=I={I}:TP={TP}:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True, encoding='utf-8', errors='replace')
    m = json.loads(r.stderr[r.stderr.rfind('{'):r.stderr.rfind('}') + 1])
    subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af',
                    f"loudnorm=I={I}:TP={TP}:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample={SR}",
                    '-ar', str(SR), '-c:a', 'pcm_s16le', dst], check=True)
    return m
def biquad_peak(f0, gain_db, q):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / SR; al = np.sin(w0) / (2 * q)
    b = [1 + al * A, -2 * np.cos(w0), 1 - al * A]; a = [1 + al / A, -2 * np.cos(w0), 1 - al / A]
    return np.array(b) / a[0], np.array(a) / a[0]
def biquad_lowshelf(f0, gain_db, s=0.7):
    A = 10 ** (gain_db / 40); w0 = 2 * np.pi * f0 / SR; al = np.sin(w0) / 2 * np.sqrt((A + 1 / A) * (1 / s - 1) + 2); c = np.cos(w0)
    b = [A * ((A + 1) - (A - 1) * c + 2 * np.sqrt(A) * al), 2 * A * ((A - 1) - (A + 1) * c), A * ((A + 1) - (A - 1) * c - 2 * np.sqrt(A) * al)]
    a = [(A + 1) + (A - 1) * c + 2 * np.sqrt(A) * al, -2 * ((A - 1) + (A + 1) * c), (A + 1) + (A - 1) * c - 2 * np.sqrt(A) * al]
    return np.array(b) / a[0], np.array(a) / a[0]
def rms_db(x, win):
    n = len(x) // win; x = x[:n * win].reshape(n, win, -1)
    return 20 * np.log10(np.sqrt((x ** 2).mean(axis=(1, 2))) + 1e-9)

# ---------- 1. отрезок трека ----------
track = decode(os.path.join(ROOT, CFG['music']['file']), 2)
L = int(round(DUR * SR)); win = SR // 2
best = None
k = 0
while True:
    s0 = BEAT['phase_s'] + k * BEAT['beat_s']; k += 1
    i0 = int(round(s0 * SR))
    if i0 + L > len(track): break
    if s0 < 4: continue  # не со вступления
    db = rms_db(track[i0:i0 + L], win)
    score = float(np.std(db)) + max(0.0, -18 - float(np.median(db))) * 0.5  # ровно и не тихо
    if best is None or score < best[0]: best = (score, s0, float(np.std(db)), float(np.median(db)), float(db.min()), float(db.max()))
_, S0, sd, med, mn, mx = best
print(f'отрезок трека с {S0:.3f} с: разброс RMS {sd:.2f} дБ, медиана {med:.1f}, от {mn:.1f} до {mx:.1f} дБ')
mus = track[int(round(S0 * SR)):int(round(S0 * SR)) + L].copy()

# ---------- 2. обработка музыки ----------
for b, a in [biquad_peak(2800, -4, 1.0), biquad_lowshelf(500, -3)]:
    mus = lfilter(b, a, mus, axis=0)
env = np.sqrt(np.convolve((mus ** 2).mean(axis=1), np.ones(2400) / 2400, mode='same')) + 1e-9
lvl = 20 * np.log10(env); thr = -20.0
gain = np.where(lvl > thr, -(lvl - thr) * 0.5, 0.0)  # 2:1 выше −20 dBFS
mus *= (10 ** (gain / 20))[:, None]
t = np.arange(L) / SR
fade = np.minimum(np.clip(t / 1.5, 0, 1), np.clip((DUR - t) / 3.5, 0, 1))
fade = 0.5 - 0.5 * np.cos(np.pi * fade)  # плавные края, не линейные
mus *= fade[:, None]

# ---------- 3. голос ----------
vraw = decode(os.path.join(ROOT, CFG['voice']['file']), 1)
voice = np.zeros((L, 1)); i0 = int(round(OFF * SR)); n = min(len(vraw), L - i0); voice[i0:i0 + n] = vraw[:n]
vraw_path = os.path.join(OUT, '_voice_raw.wav'); write(vraw_path, voice)
vpath = os.path.join(OUT, 'voice_stem.wav')
vm = loudnorm(vraw_path, vpath, I=-16, TP=-1.5); os.remove(vraw_path)
w = wave.open(vpath); voice = (np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768).reshape(-1, 1); w.close()
voice = np.pad(voice, ((0, max(0, L - len(voice))), (0, 0)))[:L]

# медиана «музыка минус голос» в окнах речи
vdb = rms_db(voice, win); mdb = rms_db(mus, win)
speech = vdb > -40
diff0 = float(np.median(mdb[speech] - vdb[speech]))
report = {'music_start_s': round(S0, 3), 'music_rms_sd_db': round(sd, 2), 'duration_s': DUR, 'voice_offset_s': OFF, 'mixes': {}}
for name, target in [('A', -22.0), ('B', -18.0)]:
    g = 10 ** ((target - diff0) / 20)
    mix = voice.repeat(2, axis=1) + mus * g
    raw = os.path.join(OUT, f'_mix_{name}_raw.wav'); write(raw, mix / max(1.0, np.abs(mix).max() / 0.98))
    dst = os.path.join(OUT, f'mix_{name}.wav'); m = loudnorm(raw, dst, I=-14, TP=-1.5); os.remove(raw)
    md = rms_db(mus * g, win); check = float(np.median(md[speech] - vdb[speech]))
    w = wave.open(dst); ln = w.getnframes() / SR; w.close()
    report['mixes'][name] = {'music_minus_voice_db': round(check, 2), 'file': f'public/audio/mix_{name}.wav', 'length_s': round(ln, 4)}
    print(f'вариант {name}: музыка минус голос в речи {check:.1f} дБ, файл {ln:.3f} с (ролик {DUR:.3f} с)')
json.dump(report, open(os.path.join(ROOT, 'music', 'mix_report.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
CFG['music']['start'] = round(S0, 3); json.dump(CFG, open(CFGP, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('music.start в config.json:', round(S0, 3), '(наклейки встают на доли этого отрезка)')
