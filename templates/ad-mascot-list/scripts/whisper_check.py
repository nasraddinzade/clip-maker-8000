"""Whisper large-v3 (faster-whisper, CPU int8): слова озвучки с метками времени и сверка с текстом (пропуски, повторы,
оговорки). Пишет voice/take_whisper.json для build_timeline.py. Паузы печатает по огибающей, а не по меткам Whisper.
Запуск отдельным окружением: python -m venv .venv-whisper; .venv-whisper/Scripts/python -m pip install faster-whisper==1.2.1
.venv-whisper/Scripts/python scripts/whisper_check.py [файл]
С новым PyAV faster-whisper 1.2.1 падает на чтении mp3 (metadata_errors): звук подаётся массивом 16 кГц через wav-файл
(встроенный ffmpeg Remotion не отдаёт сырой звук в поток)."""
import difflib, json, os, re, subprocess, sys, wave
import numpy as np
from faster_whisper import WhisperModel
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FF = os.path.join(ROOT, 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')
CFG = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))['voice']
src = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else CFG['file'])
t16 = os.path.splitext(src)[0] + '_16k.wav'
subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', t16], check=True)
w = wave.open(t16); audio = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768; w.close(); os.remove(t16)
def norm(t): return re.findall(r'[а-яёa-z]+', re.sub(r'\[[^\]]*\]', '', t.lower()).replace('ё', 'е'))
segs, _ = WhisperModel('large-v3', device='cpu', compute_type='int8').transcribe(audio, language='ru', beam_size=5, word_timestamps=True, vad_filter=False)
segs = list(segs)
words = [{'w': x.word.strip(), 's': round(x.start, 3), 'e': round(x.end, 3), 'p': round(x.probability, 3)} for s in segs for x in s.words]
text = ' '.join(s.text.strip() for s in segs)
diff = [x for x in difflib.ndiff(norm(CFG['text']), norm(text)) if x[0] in '+-']
json.dump({'duration': len(audio) / 16000, 'asr': text, 'diff': diff, 'words': words},
          open(os.path.splitext(src)[0] + '_whisper.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('длина', round(len(audio) / 16000, 2), 'с; расхождения:', diff or 'нет')
print('Расхождение может быть произнесённой формой («Ватсап» → WhatsApp) или оговоркой: проверь на слух и при оговорке перегенерируй весь текст с другим seed.')
print(text)
