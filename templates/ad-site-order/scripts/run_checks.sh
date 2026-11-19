#!/bin/sh
# All checks of the reel from the CURRENT code (boxes rebuilt each run: video-qa «Рамки для проверок»). Each new check
# was first run on a known bad input; the bad inputs stay here so a broken check shows at once.
# Needs: src/states/*.json (capture or placeholders), public/*, out/reel.mp4 (scripts/build_reel.sh). Log: out/checks.log
cd "$(dirname "$0")/.."
export PYTHONIOENCODING=utf8
REPO=${CLIP_MAKER:-$(cd ../.. && pwd)}   # clip-maker-8000 root (tools/caption_margins.py); set CLIP_MAKER if the template was copied elsewhere
mkdir -p out
npx remotion bundle src/index.ts --out-dir build/bundle > /dev/null 2>&1
node node_modules/.bin/esbuild src/export-boxes.ts --bundle --platform=node --format=cjs --outfile=build/export-boxes.cjs --log-level=error 2>/dev/null || npx esbuild src/export-boxes.ts --bundle --platform=node --format=cjs --outfile=build/export-boxes.cjs --log-level=error
rm -rf out/stills out/mask
npx remotion render build/bundle Board out/stills --sequence --image-format=png > /dev/null 2>&1
npx remotion render build/bundle BoardCaptions out/mask --sequence --image-format=png > /dev/null 2>&1
npx remotion still build/bundle Cover out/cover.png > /dev/null 2>&1
npx remotion still build/bundle CoverMask out/cover_mask.png > /dev/null 2>&1
python -c "
import glob, os
for i, f in enumerate(sorted(glob.glob('out/stills/element-*.png'))): os.replace(f, f'out/stills/s{i + 1:02d}.png')"
CARD=$(python -c "import json; m=json.load(open('config.json',encoding='utf8'))['music']; print(round((m['cardBeat'] + 2) * 60 / m['bpm'] * 30))")
npx remotion still build/bundle Reel out/card.png --frame=$CARD > /dev/null 2>&1
npx remotion still build/bundle ReelCaptions out/card_mask.png --frame=$CARD > /dev/null 2>&1
cd out
{
echo "== boxes on a known bad input (the hook 70 px lower, the row 120 px right), then the storyboard"
HY=700 FRX=660 node ../build/export-boxes.cjs bad.json > /dev/null; python ../checks/board_check.py bad.json stills | grep -E "FAIL" | head -4
HOOKFRAMES=1 node ../build/export-boxes.cjs board.json > export.log; python ../checks/board_check.py board.json stills; echo "exit $?"
echo "== caption_margins: selftest, a known bad input, the storyboard (6 % fields)"
python "$REPO/tools/caption_margins.py" --selftest
python ../checks/caption_boxes.py mask cap.json --scale 1 --spans "x|0|30|6" > /dev/null
python -c "import json; b=json.load(open('cap.json',encoding='utf8')); b[0]['x0']=20; json.dump(b,open('cap_bad.json','w',encoding='utf8'),ensure_ascii=False)"
python "$REPO/tools/caption_margins.py" cap_bad.json --w 1080 --h 1920 --safe 65 --ui reels --elements board_elements.json | head -1
python "$REPO/tools/caption_margins.py" cap.json --w 1080 --h 1920 --safe 65 --ui reels --elements board_elements.json; echo "exit $?"
echo "== large captions: a known bad input, then each caption still and the card's tagline"
python ../checks/caption_big.py mask/element-00.png stills/s01.png --bad | tail -1
python ../checks/caption_big.py mask/element-00.png stills/s01.png mask/element-03.png stills/s04.png mask/element-10.png stills/s11.png; echo "exit $?"
echo "== stretches without text and beats (timeline from the code): a known bad input, then the reel"
python ../checks/final_check.py timeline board_timeline.json --bad | tail -1
python ../checks/final_check.py timeline board_timeline.json; echo "exit $?"
echo "== linear curves: a known bad input, then the sources"
printf 'const a = interpolate(f, [0, 10], [0, 1]);\nconst r = (t - 0.5) / 0.2;\n' > bad_src.ts
python ../checks/final_check.py linear bad_src.ts | tail -1
python ../checks/final_check.py linear ../src/Reel.tsx ../src/scenes.ts ../src/Views.tsx ../src/Flat.tsx ../src/flatgeo.ts; echo "exit $?"
echo "== logo on the card: a known bad input, then the card"
python ../checks/logo_check.py card.png card_mask.png --bad | tail -1
python ../checks/logo_check.py card.png card_mask.png; echo "exit $?"
echo "== cover: a known bad input, then the cover"
python ../checks/final_check.py cover cover.png cover_mask.png --bad | tail -1
python ../checks/final_check.py cover cover.png cover_mask.png; echo "exit $?"
if [ -f reel.mp4 ]; then
echo "== sound and format of out/reel.mp4"
python ../scripts/music_cut.py --measure reel.mp4
python ../checks/final_check.py av reel.mp4; echo "exit $?"
fi
} > checks.log 2>&1
grep -E "^exit|^OK|^FAIL|   FAIL|нарушений|without text|verdict|video h264" checks.log
