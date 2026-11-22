"""Полная озвучка одним запросом (video-voice): текст, голос, модель, stability, seed из config.json → voice/take.mp3 и
voice/take.json (таймкоды символов). Ключ ElevenLabs из .env (ELEVENLABS_API_KEY), путь к .env первым аргументом
или переменной ENV_FILE; в файлы и вывод ключ не пишется. Показанное и произнесённое могут отличаться: в config.voice.text
пиши так, как движок читает верно («Ватсап»), на экране своё.
python scripts/voice_full.py [путь/.env] [seed]"""
import base64, json, os, sys, urllib.request
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = json.load(open(os.path.join(ROOT, 'config.json'), encoding='utf-8'))['voice']
env = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('ENV_FILE', os.path.join(ROOT, '.env'))
KEY = [l.split('=', 1)[1].strip() for l in open(env, encoding='utf-8') if l.startswith('ELEVENLABS_API_KEY=')][0]
seed = int(sys.argv[2]) if len(sys.argv) > 2 else CFG['seed']
body = {'text': CFG['text'], 'model_id': CFG['model'], 'seed': seed,
        'voice_settings': {'stability': CFG['stability'], 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True}}
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{CFG['voiceId']}/with-timestamps?output_format=mp3_44100_128",
                             data=json.dumps(body).encode(), headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
d = json.load(urllib.request.urlopen(req))
out = os.path.join(ROOT, CFG['file']); os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'wb').write(base64.b64decode(d['audio_base64']))
json.dump({**{k: CFG[k] for k in ('voiceId', 'model', 'stability', 'text')}, 'seed': seed, 'alignment': d.get('alignment')},
          open(os.path.splitext(out)[0] + '.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('озвучено:', CFG['file'], 'seed', seed)
