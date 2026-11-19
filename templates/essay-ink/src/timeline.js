// Общий таймлайн: собирает сцены из config/scenes.json и длительности из
// config/timing.json (его пишет scripts/timeline.mjs по длинам аудио).
// Если timing.json пустой, берутся fallbackDuration из конфига.

export function buildTimeline(config, timing) {
  const { fps } = config.video;
  const T = config.timing;
  const byId = new Map((timing?.scenes ?? []).map((s) => [s.id, s]));

  let start = 0;
  const scenes = config.scenes.map((sc, index) => {
    const tm = byId.get(sc.id);
    const voiceDelay = sc.voiceDelay ?? T.voiceDelay;
    const duration = tm?.duration ?? sc.fallbackDuration;
    const voiceDuration = tm?.audioDuration ?? Math.max(1, duration - voiceDelay - T.tail);
    // Сцена всегда целое число кадров — без дробных стыков.
    const frames = Math.round(duration * fps);
    const entry = {
      ...sc,
      index,
      startFrame: Math.round(start * fps),
      frames,
      duration: frames / fps,
      voiceDelay,
      voiceDuration,
      parts: tm?.parts ?? null,
    };
    start += frames / fps;
    return entry;
  });

  const totalFrames = scenes.reduce((a, s) => a + s.frames, 0);
  return { fps, scenes, totalFrames, duration: totalFrames / fps, timing: T };
}

// Кадр → сцена и локальное время. t ∈ [0, 1] внутри сцены.
export function locate(tl, frame) {
  const f = Math.max(0, Math.min(tl.totalFrames - 1, frame));
  let sc = tl.scenes[tl.scenes.length - 1];
  for (const s of tl.scenes) {
    if (f < s.startFrame + s.frames) { sc = s; break; }
  }
  const localFrame = f - sc.startFrame;
  const sec = localFrame / tl.fps;
  const t = sc.frames > 1 ? localFrame / (sc.frames - 1) : 0;
  return { scene: sc, localFrame, sec, t };
}
