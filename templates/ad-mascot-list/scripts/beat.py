"""Темп и сетка долей трека: огибающая начал звука сворачивается по периоду кандидата (48 корзин), острота = доля энергии в
лучшей корзине с соседями против равномерного (1.0 = сетки нет). Грубый перебор 70–180 BPM шагом 0,1, уточнение ±1 BPM
шагом 0,01, проверка по половинам трека (сетка не должна уплывать) и контроль заведомо чужого темпа. Автокорреляция
одна ошибается в 4/3 и 1/2 (ai-helper-01: дала 77 при настоящих 103,34). Пишет music.bpm/beat/phase в config.json.
python scripts/beat.py music/track.mp3"""
import json, os, subprocess, sys, wave
import numpy as np
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')
src = os.path.join(ROOT, sys.argv[1]); tmp = os.path.join(ROOT, 'music', '_b.wav')
subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '22050', '-c:a', 'pcm_s16le', tmp], check=True)
w = wave.open(tmp); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768; w.close(); os.remove(tmp)
hop = 128; fr = sr / hop; n = len(x) // hop
spec = np.abs(np.fft.rfft(x[:n * hop].reshape(n, hop) * np.hanning(hop), axis=1))
on = np.maximum(0, np.diff(np.log1p(spec * 100), axis=0)).sum(axis=1); t = np.arange(len(on)) / fr
def sharp(bpm, sel=slice(None)):
    T = 60 / bpm; h = np.bincount(((t[sel] % T) / T * 48).astype(int) % 48, weights=on[sel], minlength=48)
    k = int(np.argmax(h)); return (h[k] + h[k - 1] + h[(k + 1) % 48]) / h.sum() * 16, k / 48 * T
coarse = np.arange(70, 180, 0.1); sc = [sharp(b)[0] for b in coarse]
b0 = coarse[int(np.argmax(sc))]
fine = np.arange(b0 - 1, b0 + 1, 0.01); sf = [sharp(b)[0] for b in fine]
bpm = float(fine[int(np.argmax(sf))]); val, ph = sharp(bpm); half = len(t) // 2
h1, h2 = sharp(bpm, slice(0, half)), sharp(bpm, slice(half, None))
ctrl = sharp(bpm * 0.887)[0]
print(f'BPM {bpm:.2f}, острота {val:.2f} (контроль чужого темпа {ctrl:.2f}), фаза {ph:.3f} с; половины: {h1[0]:.2f}/{h1[1]:.3f} и {h2[0]:.2f}/{h2[1]:.3f}')
if val < 1.2 or abs(h1[1] - h2[1]) > 0.03: print('ВНИМАНИЕ: сетка слабая или уплывает, проверь темп на слух')
p = os.path.join(ROOT, 'config.json'); cfg = json.load(open(p, encoding='utf-8'))
cfg['music'].update({'bpm': round(bpm, 2), 'beat': round(60 / bpm, 5), 'phase': round(ph, 3)})
json.dump(cfg, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print('записано в config.json: music.bpm, beat, phase')
