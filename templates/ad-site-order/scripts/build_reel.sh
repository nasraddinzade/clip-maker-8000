#!/bin/sh
# The reel, rendered by beats into separate files and joined: a beat is re-rendered only if listed in $BEATS (default:
# all), the rest is reused from out/seg/ (the cache). Then the music (public/audio/reel.wav from scripts/music_cut.py)
# is muxed as AAC and cut to the video's length. Output: out/reel.mp4 (or $OUT), 1080x1920, 30 fps, H.264 + AAC.
#   sh scripts/build_reel.sh                 everything
#   BEATS="card" sh scripts/build_reel.sh    only the card, the other beats from the cache
set -e
cd "$(dirname "$0")/.."
OUT=${OUT:-out/reel.mp4}
BEATS=${BEATS:-"hook client owner card"}
mkdir -p out/seg
# beat boundaries in frames, from config.json (the same formulas as src/scenes.ts)
eval "$(python -c "
import json; m = json.load(open('config.json', encoding='utf8'))['music']; B = 60 / m['bpm']; f = lambda t: round(t * 30)
h = f(m['hookEndBeat'] * B); o = f(m['hookEndBeat'] * B + 6 * B + 1.8); c = f(m['cardBeat'] * B); e = f(m['endBeat'] * B)
print(f'HOOK=0-{h - 1}; CLIENT={h}-{o - 1}; OWNER={o}-{c - 1}; CARD={c}-{e - 1}; SECONDS={e / 30:.4f}')
")"
npx remotion bundle src/index.ts --out-dir build/bundle > /dev/null 2>&1
for b in $BEATS; do
  case $b in hook) R=$HOOK;; client) R=$CLIENT;; owner) R=$OWNER;; card) R=$CARD;; esac
  npx remotion render build/bundle ReelSilent out/seg/$b.mp4 --frames=$R --codec=h264 --crf=16 --pixel-format=yuv420p --muted > /dev/null 2>&1
  echo "rendered $b ($R)"
done
printf "file 'hook.mp4'\nfile 'client.mp4'\nfile 'owner.mp4'\nfile 'card.mp4'\n" > out/seg/list.txt
npx remotion ffmpeg -hide_banner -y -v error -f concat -safe 0 -i out/seg/list.txt -c copy out/seg/video.mp4
npx remotion ffmpeg -hide_banner -y -v error -i out/seg/video.mp4 -i public/audio/reel.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 192k -ar 48000 -t $SECONDS -movflags +faststart $OUT
npx remotion ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,nb_frames,duration -of compact $OUT
