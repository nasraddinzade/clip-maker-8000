"""Участки без подписи (реклама: ни один не длиннее 1,5 с, video-qa). По покадровому аудиту DOM: кадр с подписью, если виден
хотя бы один узел роли caption или sticker с непрозрачностью от 0,5. python checks/caption_gaps.py ../check/audit_all [--bad]"""
import json, glob, os, sys
sys.stdout.reconfigure(encoding='utf-8')
FPS = 30
def gaps(flags):
    out, start = [], None
    for i, f in enumerate(flags + [True]):
        if not f and start is None: start = i
        if f and start is not None: out.append((start, i - 1)); start = None
    return out
if '--bad' in sys.argv:
    flags = [True] * 30 + [False] * 60 + [True] * 30  # 2 с без подписи
    g = gaps(flags); worst = max((b - a + 1) / FPS for a, b in g)
    print('плохой вход: худший участок', worst, 'с'); sys.exit(0 if worst > 1.5 else 1)
files = sorted(glob.glob(os.path.join(sys.argv[1], '*.audit.json')))
flags, frames = [], []
for f in files:
    a = json.load(open(f, encoding='utf-8'))
    frames.append(a['frame'])
    flags.append(any(n.get('role') in ('caption', 'sticker') and n.get('op', 0) >= 0.5 for n in a['nodes']))
assert frames == list(range(frames[0], frames[0] + len(frames))), 'нужен покадровый аудит без пропусков'
g = gaps(flags)
for a, b in g: print(f'без подписи кадры {frames[a]}–{frames[b]} ({(b - a + 1) / FPS:.2f} с)')
worst = max([(b - a + 1) / FPS for a, b in g] or [0])
print(f'кадров {len(frames)}, участков без подписи {len(g)}, худший {worst:.2f} с —', 'ок' if worst <= 1.5 else 'НЕ ПРОШЛО')
