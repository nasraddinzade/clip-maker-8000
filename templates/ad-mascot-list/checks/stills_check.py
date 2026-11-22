"""Проверка стоп-кадров по аудиту DOM (src/reel/audit.ts) и пикселям кадра.
Запрет: «демо», «пример», «тестов», 500, жаргон; тире и двоеточия в подписях и наклейках.
Зона Reels: всё видимое читаемое в x 65–1015, y 269–1248; правее x 960 предупреждение (колонка кнопок).
Размер: подписи и наклейки (Rubik, высота заглавных 0,70 кегля) от 60 px в 1080 (20 в 360); текст экранов (Inter, 0,727) от 36 px (12 в 360).
Контраст: фон берётся из кадра (самый частый цвет в рамке текста, далёкий от цвета текста). Подписи от 7:1, экраны от 4,5:1.
python checks/stills_check.py ../stop2 [--bad]  (--bad: заведомо плохой вход, проверка должна упасть)"""
import json, sys, glob, os, re
from collections import Counter
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
FORBID = [r'демо', r'пример', r'тестов', r'\b500\b', r'чат-?бот', r'интеграц', r'автоматизац']
CAPS = {'Rubik': 0.70, 'Inter': 0.727}
def lum(c):
    c = [x / 255 for x in c]; c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def cr(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def rgb(s): return tuple(int(v) for v in re.findall(r'\d+', s)[:3])
def check(nodes, img, name):
    bad, warn = [], []
    for n in nodes:
        if n.get('role') == 'mascot':
            x0, y0, x1, y1 = n['box']
            # 6 px запаса на контур, которого нет в геометрической рамке SVG
            if x0 < 6 or x1 > 1074 or y0 < 6: bad.append(f"{name}: маскот выходит за кадр {n['box']}")
            continue
        if n.get('role') == 'attr':
            if any(re.search(f, (n['text'] or '').lower()) for f in FORBID): bad.append(f"{name}: атрибут {n['attr']} «{n['text']}»")
            continue
        txt = n['text']; low = txt.lower()
        for f in FORBID:
            if re.search(f, low): bad.append(f"{name}: запрет «{f}» в «{txt}»")
        if n['op'] < 0.05: continue
        x0, y0, x1, y1 = n['box']; role = n['role']
        if role in ('caption', 'sticker') and re.search(r'[—–:]|(?<=\s)-(?=\s)', txt): bad.append(f"{name}: тире или двоеточие в подписи «{txt}»")
        cl = n.get('clip')
        if cl and (x0 < cl[0] - 2 or y0 < cl[1] - 2 or x1 > cl[2] + 2 or y1 > cl[3] + 2): bad.append(f"{name}: текст срезан краем контейнера {cl} рамка {n['box']} «{txt}»")
        if role == 'none': warn.append(f"{name}: текст без роли «{txt}»")
        if x0 < 65 or x1 > 1015 or y0 < 269 or y1 > 1248: bad.append(f"{name}: вне зоны {n['box']} «{txt}»")
        elif x1 > 960: warn.append(f"{name}: правее 960 ({x1}) «{txt}»")
        fam = n['ff'].split(',')[0].strip('"'); cap = n['fs'] * CAPS.get(fam, 0.7)
        need = 60 if role in ('caption', 'sticker') else 36
        if cap < need - 0.5: bad.append(f"{name}: мелко {cap:.1f} px < {need} ({cap / 3:.1f} в 360) «{txt}» [{role}]")
        if img is not None and n['op'] > 0.9:
            tc = rgb(n['color'])
            px = img.crop((max(0, x0), max(0, y0), min(1080, x1), min(1920, y1))).get_flattened_data()
            cands = [p[:3] for p in px if sum(abs(a - b) for a, b in zip(p[:3], tc)) > 120]
            if cands:
                bg = Counter((p[0] // 8 * 8, p[1] // 8 * 8, p[2] // 8 * 8) for p in cands).most_common(1)[0][0]
                c = cr(tc, bg); need_c = 7 if role in ('caption', 'sticker') else 4.5
                if c < need_c: bad.append(f"{name}: контраст {c:.1f} < {need_c} «{txt}» текст {tc} фон {bg}")
    return bad, warn
d = sys.argv[1]
if '--bad' in sys.argv:
    nodes = [{'text': 'Шаг 1: демо', 'box': [40, 200, 500, 260], 'fs': 34, 'ff': 'Rubik', 'color': 'rgb(200,190,180)', 'op': 1, 'role': 'caption'},
             {'text': 'Скидка 500', 'clip': [80, 600, 900, 720], 'box': [100, 700, 400, 740], 'fs': 30, 'ff': 'Inter', 'color': 'rgb(40,30,20)', 'op': 1, 'role': 'ui'},
             {'text': 'x', 'attr': 'alt', 'role': 'attr'}, {'text': 'пример', 'attr': 'title', 'role': 'attr'}]
    img = Image.new('RGB', (1080, 1920), (243, 234, 218))
    bad, warn = check(nodes, img, 'ПЛОХОЙ')
    print('\n'.join(bad)); print('найдено нарушений на плохом входе:', len(bad)); sys.exit(0 if len(bad) >= 9 else 1)
total = 0
for f in sorted(glob.glob(os.path.join(d, '*.audit.json'))):
    name = os.path.basename(f).replace('.audit.json', '')
    a = json.load(open(f, encoding='utf-8')); png = f.replace('.audit.json', '.png')
    img = Image.open(png).convert('RGB') if os.path.exists(png) else None  # без PNG контраст не проверяется
    bad, warn = check(a['nodes'], img, name)
    vis = [n for n in a['nodes'] if n.get('op', 1) > 0.05 and n.get('role') != 'attr']
    if '--quiet' in sys.argv and not bad: total += 0; continue
    print(f"{name}: кадр {a['frame']}, текстовых узлов {len(a['nodes'])} (видимых {len(vis)}), нарушений {len(bad)}, предупреждений {len(warn)}")
    for b in bad: print('  НЕ ПРОШЛО', b)
    for w in warn: print('  внимание', w)
    total += len(bad)
print('ИТОГО нарушений', total)
