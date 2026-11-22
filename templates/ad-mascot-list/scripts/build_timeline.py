"""Таймлайн ролика от голоса: слова Whisper large-v3 (scripts/whisper_check.py пишет voice/take_whisper.json), начала фраз
после тишины уточнены по огибающей (Whisper и ElevenLabs после пауз ставят начало слова раньше). Сцены режутся по середине
тишины перед маркером: шаг N начинается перед steps[N].marker, финал перед final.marker, карточка на card.marker.
Пишет src/timeline.json. python scripts/build_timeline.py"""
import json, os, subprocess, sys, wave
import numpy as np
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')
CFG = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))
V = CFG['video']; OFF = V['voiceOffset']; HOLD = V['cardHold']; FPS = V['fps']
voice = os.path.join(ROOT, CFG['voice']['file'])
W = json.load(open(os.path.splitext(voice)[0] + '_whisper.json', encoding='utf-8'))['words']

tmp = os.path.join(ROOT, 'voice', '_t.wav')
subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', voice, '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', tmp], check=True)
w = wave.open(tmp); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768; w.close(); os.remove(tmp)
hop = sr // 100
db = np.array([20 * np.log10(np.sqrt(np.mean(x[i:i + hop] ** 2)) + 1e-9) for i in range(0, len(x) - hop, hop)])
voice_len = len(x) / sr
q = db < -42; sil = []; i = 0
while i < len(q):
    if q[i]:
        j = i
        while j < len(q) and q[j]: j += 1
        if j - i >= 20: sil.append((i / 100, j / 100))
        i = j
    else: i += 1
for wd in W:  # слово сразу после тишины начинается не раньше её конца
    for a, b in sil:
        if wd['s'] < b < wd['e']: wd['s'] = b

def clean(s): return s.lower().strip('.,?!«»…').replace('ё', 'е')
def find(spec, after=0.0):
    """слово[@после] в секундах голоса (без voiceOffset)"""
    word, _, aft = spec.partition('@')
    after = max(after, float(aft) - OFF if aft else 0.0)
    for wd in W:
        if wd['s'] >= after - 0.05 and clean(wd['w']).startswith(clean(word)): return wd
    raise SystemExit(f'нет слова «{spec}» после {after:.2f} с голоса: проверь маркеры в config.json')
def mid_sil(t):
    for a, b in sil:
        if abs(b - t) < 0.06: return (a + b) / 2
    return t - 0.15

marks = []; after = 0.0
for st in CFG['steps']:
    wd = find(st['marker'], after); marks.append(wd); after = wd['s']
fin = find(CFG['final']['marker'], after); card = find(CFG['card']['marker'], fin['s'])
bounds = [0.0] + [mid_sil(m['s']) + OFF for m in marks] + [mid_sil(fin['s']) + OFF, card['s'] + OFF, card['s'] + OFF + HOLD]
ids = ['hook'] + [f'step{i + 1}' for i in range(len(marks))] + ['final', 'card']
scenes = [{'id': ids[k], 'start': round(bounds[k], 3), 'end': round(bounds[k + 1], 3)} for k in range(len(ids))]
for k, st in enumerate(CFG['steps']):
    sc = scenes[k + 1]; t = st['title']; times = []; a = sc['start'] - OFF
    for vw in t['voice']:
        wd = find(vw, a); times.append(round(wd['s'] + OFF, 3)); a = wd['s']
    sc['title'] = {'words': t['words'], 'accent': t['accent'], 'times': times}
total = scenes[-1]['end']
out = {'fps': FPS, 'voiceOffset': OFF, 'voiceFile': CFG['voice']['file'], 'voiceLen': round(voice_len, 3), 'duration': round(total, 3),
       'frames': int(round(total * FPS)), 'scenes': scenes,
       'words': [{'w': wd['w'], 's': round(wd['s'] + OFF, 3), 'e': round(wd['e'] + OFF, 3)} for wd in W],
       'silences': [(round(a + OFF, 2), round(b + OFF, 2)) for a, b in sil]}
json.dump(out, open(os.path.join(ROOT, 'src', 'timeline.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for s in scenes:
    flag = '  короче 8 с' if s['id'].startswith('step') and s['end'] - s['start'] < 8 else ''
    print(f"{s['id']:6s} {s['start']:6.2f}–{s['end']:6.2f} ({s['end'] - s['start']:.2f} с){flag}", s.get('title', {}).get('times', ''))
print('ролик', out['duration'], 'с,', out['frames'], 'кадров; голос кончается на', round(voice_len + OFF, 2), 'с')
