#!/usr/bin/env bash
# Рендер ролика: out/<имя>.mp4, H.264 + AAC 192k, CRF 16. Порт задан явно: на 3000 часто висит чужой dev-сервер,
# и Remotion открывает его вместо своего («not a valid Remotion project»).
# bash scripts/render.sh имя [A|B]
set -e
cd "$(dirname "$0")/.."
NAME=${1:-reel}; MIX=${2:-A}
mkdir -p out
npx remotion render --port=3417 src/index.ts Reel "out/$NAME.mp4" --codec=h264 --crf=16 --audio-codec=aac --audio-bitrate=192k --props="{\"mix\":\"$MIX\"}" --log=error
echo "out/$NAME.mp4"
