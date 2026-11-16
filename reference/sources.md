# 02. Внешние источники (40, по убыванию полезности)

Проверено 2026-11-16. Субагенты только читали страницы и ничего не устанавливали. Одна пометка «(группа)» объединяет близкие страницы одного издателя.

Полные выписки с цитатами лежат в `_research/`:
- `design_and_skills.md` — дизайн, вкус, навыки;
- `video_motion.md` — видео и моушн;
- `tts.md` — голос;
- `music_platforms.md` — музыка и площадки.

Колонка «Наши ошибки» — какие ошибки «Пяти колец» источник предотвратил бы:

| Код | Ошибка |
|---|---|
| Л | буквальные образы |
| С | анимация до утверждения стоп-кадров |
| П | слабые самопроверки и «исправлено» без доказательств |
| З | застывшие паузы |
| Т | подписи налезают на изображение или зоны интерфейса |
| Р | вспышка при растворении |
| У | ударения |
| Д | недетерминированные кадры |
| Ю | лицензии |

| # | Источник | Что это | Лицензия | Что взять | Что не брать | Наши ошибки |
|---|---|---|---|---|---|---|
| 1 | platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices | официальное руководство по написанию Agent Skills | не указана (документация) | frontmatter (`name` ≤ 64, `description` ≤ 1024, в 3-м лице «что и когда»); SKILL.md ≤ 500 строк, ссылки на один уровень; чек-лист шагов; «валидатор → исправить → повторить»; план в машинно проверяемом файле; сначала оценочные сценарии по реальным провалам | советы по упаковке для claude.ai/API | П, С |
| 2 | github.com/Leonxlnx/taste-skill | навык «вкуса» для сайтов, есть finish gate | MIT | Stop-хук со скриптом-гейтом `GATE: PASS/FAIL`, FAIL блокирует «готово»; не больше 3 раундов правок; отчёт начинается строкой гейта и списком непроверенного; `waivers.json` с причиной; «гейт вооружается до работы» | веб-специфику, «раздачу» стиля случайным seed | П, Т |
| 3 | github.com/iart-ai/explainer-video-skills | пакет видео-навыков (explainer, diagram, whiteboard…) | MIT | `seek-shot` (заморозить моменты), `contact-sheet`, `probe-mp4`; стоп-кадры до кодирования; кадр в середине паузы каждой сцены; подписи ≤ 2×42 символа, ≥ 1 с; длина сцены = слова ÷ 2,3 + 0,4 с | привязку к Remotion без лицензии | С, П, Д |
| 4 | github.com/Vincentwei1021/video-shotcraft | промо-видео из реальных скриншотов на Remotion | Apache-2.0 (звуки — по файлам, CC BY) | guided-ворота с 1–3 вопросами; полная раскадровка до ассетов; **финальное ревью свежим субагентом со ссылками на номера кадров**; бюджет пауз в таймлайне; seed из индекса шота | экспорт в JianYing, публикацию | П, С, Д |
| 5 | github.com/Barty-Bart/motion-graphics (explainer-high-energy) | HTML с `seek(t)` + Playwright + ffmpeg | MIT (шрифты OFL, иконки ISC, SFX CC0) | кадр — чистая функция t; seed-генератор; **симуляции «запекать» с шагом 1/240 с**; предупреждать о незагруженном шрифте; черновик 30 fps → утверждение → финал; переходы формой, а не кросс-фейдом | HUD-стилистику жанра | Д, С, Р |
| 6 | github.com/pbakaus/impeccable | дизайн-словарь из 24 команд и детектор шаблонности | Apache-2.0 | критика двумя изолированными агентами (арт-директор и детектор), находки P0–P3 с конкретным исправлением; первый вердикт: «специфичен ли образ или подошёл бы любому»; список «рефлексов-отказов»; не заявлять того, что не отрендерилось | live-режим (по README запускает CLI с отключёнными подтверждениями), телеметрию | Л, П |
| 7 | github.com/snakers4/silero-models | локальный TTS, `v5_6_ru` (aidar, baya, kseniya, xenia, eugene) | **CC BY-NC-SA 4.0** (файл LICENSE; README и бейдж расходятся) | авто-ударение, омографы, вопросы, эмфаза; ручной `+`; SSML (`break`, `prosody`) | коммерческое использование | У, Ю |
| 8 | support.google.com/youtube/answer/15424877 (группа: Shorts 10059070) | правила Shorts | правила платформы | Shorts до 3 мин; **Short длиннее 60 с с любой заявкой Content ID блокируется во всём мире** | лимит 90 с аудиобиблиотеки к нашей вшитой музыке не относится | Ю |
| 9 | facebook.com/business/ads-guide/update/video/instagram-reels | спецификация рекламы в Reels | правила | **безопасная зона: верх 14 %, низ 35 %, бока по 6 %**; H.264, CFR, AAC ≥ 128 кбит/с | 1440×2560 как обязательное требование | Т |
| 10 | code.claude.com/docs/en/skills | навыки в Claude Code | не указана | `.claude/skills/`; описание + `when_to_use` обрезается на 1536 символах, ключевое ставить первым; после компакции живут первые ~5000 токенов навыка; «всегда выполняемое» — в hook; `context: fork` для независимого критика | синхронизацию с claude.ai | П |
| 11 | github.com/anthropics/skills: algorithmic-art, canvas-design | официальные творческие навыки (p5.js, статика) | по README вероятно Apache-2.0; LICENSE.txt не открывали | **сначала манифест стиля (4–6 абзацев), потом код**; скрытая концептуальная отсылка; seed-воспроизводимость; refinement pass без новых элементов; «ничего не перекрывается» | брендинг их шаблона, гиперболы вместо критериев | Л, С, Т |
| 12 | huggingface.co/ESpeech/ESpeech-TTS-1_RL-V2 | русский файнтюн F5-TTS | apache-2.0 (карточка); лицензия датасета-вебинаров не проверена | ударение `+`, клонирование по референсу ≤ 12 с, авторасстановка через RUAccent | скрипт с карточки без исправления бага `hf_token` | У |
| 13 | github.com/Den4ikAI/ruaccent | автоматическая расстановка ударений | MIT | `process_all`, свой словарь `{'слово':'сл+ово'}`, омографы; вывод `+` совместим с Silero, F5 и Яндексом | слепое доверие без вычитки | У |
| 14 | github.com/OHF-Voice/piper1-gpl (+ huggingface.co/rhasspy/piper-voices) | локальный TTS (rhasspy/piper в архиве с 06.10.2025) | движок GPL-3.0; голоса: dmitri и denis — CC0, ruslan — CC BY-NC-SA, irina — unknown | IPA в `[[ ]]`, ударение `ˈ`; `--sentence-silence`; **проверка ударения по фонемам** | ruslan и irina для коммерции | У, Ю |
| 15 | facebook.com/sound/collection/terms/ | условия Meta Sound Collection (16.03.2022) | правила | коммерческое использование только в контенте на продуктах Meta | вшивать в общий мастер | Ю |
| 16 | facebook.com/help/instagram/402084904469945 | музыка в Instagram | правила | «certain business accounts» не имеют доступа к библиотеке → Sound Collection или своя лицензия | утверждение «все бизнес-аккаунты» (не подтверждено) | Ю |
| 17 | ads.tiktok.com/help/article/commercial-music-library | Commercial Music Library | правила | бизнесу — только CML (около 1 млн треков), в том числе для обычных постов | использование вне TikTok (не подтверждено) | Ю |
| 18 | support.google.com/youtube/answer/3376882 | Аудиобиблиотека YouTube | правила | треки не заявляются Content ID; фильтр «Attribution not required» | перенос на другие площадки (не подтверждено) | Ю |
| 19 | support.google.com/youtube/answer/1722171 | рекомендуемое кодирование | правила | H.264 High, 8 Мбит/с для 1080p 30, AAC-LC 48 кГц, Fast Start | — | — |
| 20 | ads.tiktok.com/help/article/creative-best-practices | креативные практики (реклама) | правила | ценность — в первые 3 с, хук — до 6 с; 5–10 слов в секунду на экране | перенос рекламных норм в эссе без оговорок | З |
| 21 | remotion.dev/docs (license, using-randomness, flickering) + github.com/remotion-dev/skills | видео на React | **своя Remotion License, не OSI**: бесплатно до 3 человек; skills — лицензия не найдена | `random(seed)`, `delayRender` (ждать шрифты и ассеты); рендер только по команде, живое превью | для кистевой генеративки; команды больше 3 человек без оплаты | Д, Ю |
| 22 | github.com/acamposuribe/p5.brush (README, llms.txt) | кисти, акварель, штриховка | MIT | две несовместимые сборки; seed каждый кадр; текст — после кистей; llms.txt целиком в контекст | смешивать API p5 и standalone | Д |
| 23 | aistudio.yandex.ru/docs/en/speechkit/tts/markup | Яндекс SpeechKit (платный) | ToS не проверялись | ударение `+`, `sil<[мс]>`, `**эмфаза**`, `[[фонемы]]`; около $11 за 1 млн символов (API v1) | — | У |
| 24 | github.com/snakers4/silero-models/wiki/SSML | SSML Silero | (как у Silero) | `break time/strength`, `prosody rate/pitch` — шкала дискретная, плюс проценты (у нас `90%` сработало) | — | У |
| 25 | habr.com/ru/articles/961930 | анонс Silero v5 (31.10.2025) | не указана | быстрее v4 в 1,5–2 раза; флаги `put_accent`, `put_yo`, `put_stress_homo` | — | У |
| 26 | pixabay.com/service/license-summary/ + /faq/ | лицензия Pixabay | Pixabay License | без атрибуции; **щит = трек в Content ID** | треки со щитом для Shorts длиннее 60 с | Ю |
| 27 | freemusicarchive.org/License_Guide | гид по CC | — | для бизнеса — только CC BY или CC0 | NC, ND (запрет синхронизации), SA | Ю |
| 28 | code.claude.com/docs/en/memory | CLAUDE.md | не указана | ≤ 200 строк, проверяемые формулировки; блокировать — hook, а не текст; корневой CLAUDE.md переживает компакцию | managed policy | П |
| 29 | anthropics/skills: skill-creator | навык для создания навыков | по README вероятно Apache-2.0 | структура `scripts/ references/ assets/`; evals.json; «настойчивые» описания; объяснять «почему» | упаковку `.skill` | П |
| 30 | anthropics/skills: frontend-design | навык фронтенд-дизайна | Apache-2.0 | план (4–6 цветов hex, роли шрифтов) → ревизия плана на банальность → сборка; «Spend your boldness in one place.» | веб-специфику | Л |
| 31 | docs.manim.community (installation, output_and_config, LICENSE) | математическая анимация | MIT | `-ql` + `-s` для стоп-кадров; `--format=png-sequence` | рисованный и органичный стиль | С |
| 32 | github.com/tungs/timecut, github.com/spite/ccapture.js | захват веб-анимации в виртуальном времени | BSD-3 / MIT | запасной путь для «живых» сайтов, которые нельзя переписать на seek | основа нового проекта; CSS-анимации «drift during a capture» | Д |
| 33 | motioncanvas.io/docs (+ rendering) | анимация на генераторах TypeScript | MIT | редактор с превью, рендер диапазона и `/still` | — | С |
| 34 | gsap.com/licensing, gsap.com/docs/v3/GSAP/Timeline/seek() | твины и таймлайны | **проприетарная Webflow**, бесплатна, может быть отозвана | paused-таймлайн + `seek(frame/fps)` для кинетической типографики | продукт — визуальный no-code инструмент анимации | Д, Ю |
| 35 | docs.blender.org/manual/.../command_line/arguments.html | headless-рендер Blender | лицензию не проверяли | `-b`, `-f`/`-a`, `-o …#`, `-P script.py`; порядок аргументов важен | Blender для 2D и типографики | С |
| 36 | huggingface.co/Misha24-10/F5-TTS_RUSSIAN | русский F5 | CC-BY-NC-4.0 | `+`, чекпойнт accent_tune | коммерцию | У, Ю |
| 37 | huggingface.co/coqui/XTTS-v2 + github.com/idiap/coqui-ai-TTS | клонирование голоса | **CPML**: некоммерческая, распространяется и на результат | — | монетизацию; управление ударением не документировано | Ю |
| 38 | learn.microsoft.com/…/speech-synthesis-markup-pronunciation + github.com/rany2/edge-tts | Azure SSML и edge-tts | Azure — платный; edge-tts — без собственного SSML | Azure: `<phoneme alphabet="ipa">`, свой лексикон; edge-tts **не пропускает собственный SSML** — поэтому ударение в нём не управляется | edge-tts там, где важно ударение | У |
| 39 | support.google.com/google-ads/answer/16041697 | реклама в Shorts | правила | в ленте играют первые 60 с; справа колонка кнопок; звук поднимает конверсии более чем на 20 % | рекламные нормы как правила для обычных роликов | Т |
| 40 | facebook.com/business/news/updated-features-for-video-ads + facebook IQ «Sight, sound and mobilisation» (2017) | Meta о просмотре без звука | — | субтитры дают +12 % времени просмотра (внутренние тесты); «понятно без звука, со звуком лучше» | цифру «85 % без звука» (не найдена) | Т |

## Прочитано, но вне 40 (кратко, чтобы не потерялось)

- **Видео-навыки:**
  - `bluzir/claude-code-design` (animated-video, MIT) — полезен протокол seek через postMessage, но детерминизм и паузы там не обсуждаются;
  - `OneWave-AI/claude-skills/animate` (MIT) — анимация в реальном времени без покадрового рендера, **не брать**;
  - `iart-ai/motion-skills` — индекс 19 пакетов (MIT), его MCP-вариант отправляет данные во внешний сервис.
- **Lottie:** lottie-web и dotlottie-web (MIT) — `goToAndStop(frame, true)` для вставок.
- **Шейдеры:**
  - The Book of Shaders — **«All rights reserved»**, код в ролики не копировать;
  - Shadertoy — условия **недоступны (HTTP 403)**; по вторичным источникам по умолчанию CC BY-NC-SA 3.0.
- **Прочее:**
  - p5.js — LGPL-2.1;
  - Three.js manual — **недоступен (404)**.
- **Платные и прочие TTS:**
  - SaluteSpeech: ударение апострофом **после** гласной;
  - Google Cloud TTS: `<phoneme>` IPA и X-SAMPA, ru-RU есть;
  - ElevenLabs: Starter $6 в месяц с коммерческой лицензией, русское ударение не документировано;
  - Fish Speech: FACL, коммерция до $500 тыс. в год;
  - CosyVoice 3: Apache-2.0, русского ударения нет;
  - Kokoro: русский не заявлен.
- **Музыка:**
  - Incompetech — нужна атрибуция;
  - Uppbeat — **недоступно (HTTP 429)**;
  - Epidemic Sound Pro — по сниппетам;
  - Instagram Creators — Reels до 3 мин рекомендуются неподписчикам, запуск был в США.
- **Аудиообработка:** Sound On Sound — «The less EQ you use, the more natural the sound will be» (P. White).

## Чего не дал ни один источник

- Шага «проверка образа на буквальность» в видео-навыках нет. Ближе всех — impeccable (вердикт специфичности) и algorithmic-art (скрытая отсылка). Шаг нужно добавить самим.
- Официальных цифр безопасной зоны для **обычных** роликов в Shorts и TikTok нет.
- Детектора немонотонных растворений нет ни у кого. Наш `../tools/flash_detector.py` — свой.
