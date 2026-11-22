# Пробы голоса: одни и те же две фразы (хук и начало шага 1) разными голосами и моделями, плюс вариант с аудиотегами v3.
# Тексты, голоса и список проб правь в начале файла. Ключ из .env (путь первым аргументом), в файлы не пишется.
# python scripts/voice_probes.py путь/.env ; потом probes/*.mp3 слушает человек, темп в словах в секунду меряй (video-voice).
import json, urllib.request, base64, os, sys, subprocess
sys.stdout.reconfigure(encoding='utf-8')
ENV = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('ENV_FILE', '.env')
KEY = [l.split('=',1)[1].strip() for l in open(ENV, encoding='utf-8') if l.startswith('ELEVENLABS_API_KEY=')][0]
HOOK = 'Хотите вернуть себе вечера? Вот три дела, которые наш помощник сделает за вас.'
STEP1 = 'Первое. Отвечает клиентам. Человек пишет вечером, а ответ приходит сразу.'
TAGGED = '[cheerfully] Хотите вернуть себе вечера? [excited] Вот три дела, которые наш помощник сделает за вас. [cheerfully] Первое. Отвечает клиентам. Человек пишет вечером, а ответ приходит сразу.'
PLAIN = HOOK + ' ' + STEP1
MAXIM, STAN, ANTON = 'HcaxAsrhw4ByUo4CBCBN', 'ogi2DyUAKJb7CEdqqvlU', 'KPyKdfzer27gKjDngSS9'
SEED = 4207
PROBES = [
  ('1_maxim_v3_plain',      MAXIM, 'eleven_v3',              PLAIN,  1.0),
  ('2_maxim_v3_tags',       MAXIM, 'eleven_v3',              TAGGED, 1.0),
  ('2b_maxim_v3_tags_s05',  MAXIM, 'eleven_v3',              TAGGED, 0.5),
  ('3_stanislav_v2',        STAN,  'eleven_multilingual_v2', PLAIN,  1.0),
  ('4_anton_v2',            ANTON, 'eleven_multilingual_v2', PLAIN,  1.0),
]
os.chdir(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'voice')); os.makedirs('probes', exist_ok=True)
for name, vid, model, text, stab in PROBES:
    mp3 = f'probes/{name}.mp3'
    js = f'probes/{name}.json'
    if not os.path.exists(mp3):
        body = {'text': text, 'model_id': model, 'seed': SEED,
                'voice_settings': {'stability': stab, 'similarity_boost': 0.75, 'style': 0.0, 'use_speaker_boost': True}}
        if model != 'eleven_v3':
            body['voice_settings']['speed'] = 1.0
        req = urllib.request.Request(f'https://api.elevenlabs.io/v1/text-to-speech/{vid}/with-timestamps?output_format=mp3_44100_128',
              data=json.dumps(body).encode(), headers={'xi-api-key': KEY, 'Content-Type': 'application/json'})
        try:
            d = json.load(urllib.request.urlopen(req))
        except urllib.error.HTTPError as e:
            print(name, 'HTTP', e.code, e.read()[:300].decode('utf-8', 'replace')); continue
        open(mp3, 'wb').write(base64.b64decode(d['audio_base64']))
        al = d.get('alignment') or {}
        json.dump({'text': text, 'model': model, 'voice_id': vid, 'stability': stab, 'seed': SEED, 'alignment': al}, open(js, 'w', encoding='utf-8'), ensure_ascii=False)
    print('ok', name)
