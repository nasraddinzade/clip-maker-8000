#!/usr/bin/env bash
# Все проверки готового ролика одной командой (один раз в конце, а не после каждой правки).
#  1. текст по DOM каждого кадра: запреты, зона Reels, размер, срезанный текст, маскот в кадре;
#  2. каждые 0,5 с: контраст с фоном из кадра и перекрытие текста маскотом (кадр без маскота);
#  3. участки без подписи (не длиннее 1,5 с);
#  4. длины, громкость, движение (tools/ из корня репозитория правил, рядом с проектом).
# bash checks/run_checks.sh out/имя.mp4 [путь к tools, по умолчанию ../tools]
set -e
cd "$(dirname "$0")/.."
VIDEO=${1:?видео}; TOOLS=${2:-../tools}
export FFMPEG="$(pwd)/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe" FFPROBE="$(pwd)/node_modules/@remotion/compositor-win32-x64-msvc/ffprobe.exe"
rm -rf check/audit check/audit_all
node checks/audit_all.mjs check/audit 0.5 --nohost
node checks/audit_all.mjs check/audit_all 0.0333 --nopng
rm -f check/audit_all/_tmp.png
echo "== каждые 0,5 с: зона, размер, контраст";        python checks/stills_check.py check/audit --quiet
echo "== перекрытия маскотом";                        python checks/occlusion.py check/audit | grep -E "НЕ ПРОШЛО|ИТОГО"
echo "== каждый кадр: зона, размер, срез, маскот";     python checks/stills_check.py check/audit_all --quiet
echo "== участки без подписи";                        python checks/caption_gaps.py check/audit_all | tail -1
echo "== длины";                                      PYTHONIOENCODING=utf-8 python "$TOOLS/audio_check.py" lengths "$VIDEO" | tail -1
echo "== громкость";                                  PYTHONIOENCODING=utf-8 python "$TOOLS/audio_check.py" loud "$VIDEO"
echo "== движение (реклама: неподвижно не дольше 0,7 с)"; PYTHONIOENCODING=utf-8 python "$TOOLS/motion.py" --video "$VIDEO" | tail -3 | head -1
