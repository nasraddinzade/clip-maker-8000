"""Перекрытие текста маскотом: кадр рендерится второй раз без маскота (--props hideHost), разница пикселей
внутри рамки каждого видимого текста (кроме наклеек, они над маскотом) значит, что маскот заходит на текст.
python checks/occlusion.py ../stop2   (нужны NAME.png, NAME.audit.json и NAME.nohost.png)"""
import json, sys, glob, os
import numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
total = 0
for f in sorted(glob.glob(os.path.join(sys.argv[1], '*.audit.json'))):
    name = f.replace('.audit.json', '')
    if not os.path.exists(name + '.nohost.png'): continue
    a = np.asarray(Image.open(name + '.png').convert('RGB')).astype(int); b = np.asarray(Image.open(name + '.nohost.png').convert('RGB')).astype(int)
    diff = np.abs(a - b).sum(axis=2) > 40
    bad = []
    for n in json.load(open(f, encoding='utf-8'))['nodes']:
        if n.get('role') in ('attr', 'sticker', 'mascot') or n.get('op', 1) < 0.05: continue
        x0, y0, x1, y1 = [max(0, v) for v in n['box']]
        k = int(diff[y0:y1, x0:x1].sum())
        if k > 20: bad.append(f"«{n['text']}» {n['box']}: {k} px перекрыто")
    print(os.path.basename(name), 'перекрытий', len(bad)); [print('  НЕ ПРОШЛО', x) for x in bad]; total += len(bad)
print('ИТОГО перекрытий', total)
