export function splitSpeechText(text, maxLength = 120) {
  maxLength = Math.max(1, Math.floor(maxLength));
  const clean = String(text || '').trim();
  if (!clean) return [];
  const sentences = clean.split(/(?<=[.!?؟])\s+|\n+/u).map(part => part.trim()).filter(Boolean);
  const chunks = [];
  let current = '';
  for (const sentence of sentences) {
    let remainder = sentence;
    while (remainder.length > maxLength) {
      const space = remainder.lastIndexOf(' ', maxLength);
      const cut = space > 0 ? space + 1 : maxLength;
      const piece = remainder.slice(0, cut).trim();
      if (current) { chunks.push(current); current = ''; }
      if (piece) chunks.push(piece);
      remainder = remainder.slice(cut).trimStart();
    }
    if (!remainder) continue;
    if (!current) current = remainder;
    else if (current.length + 1 + remainder.length <= maxLength) current += ` ${remainder}`;
    else { chunks.push(current); current = remainder; }
  }
  if (current) chunks.push(current);
  return chunks;
}

export const ITALIAN_TTS_LOCALE = 'it-IT';
const ITALIAN_TTS_RATE = 0.8;
const ITALIAN_TTS_PITCH = 1.0;
const DEFAULT_TTS_INITIALIZATION_TIMEOUT_MS = 15000;

function normalizeTtsLocale(locale) {
  const requested = String(locale || ITALIAN_TTS_LOCALE).trim();
  try { return Intl.getCanonicalLocales(requested)[0] || ''; } catch { return ''; }
}

function withTimeout(promise, timeoutMs, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), Math.max(1, Number(timeoutMs) || DEFAULT_TTS_INITIALIZATION_TIMEOUT_MS));
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

export function buildLessonSpeechTexts(lesson = {}) {
  const headingIt = String(lesson.titleIt || lesson.heading_it || '').trim();
  const bodyIt = String(lesson.summaryIt || lesson.body_it || '').trim();
  return {italian: [headingIt, bodyIt].filter(Boolean).join('\n\n')};
}

function serviceMessage() {
  return 'خدمة النطق الأصلية غير متاحة. افتح التطبيق على Android وتأكد من تفعيل محرك تحويل النص إلى كلام في إعدادات الهاتف.';
}

function languageMessage(locale = ITALIAN_TTS_LOCALE) {
  const requested = String(locale || ITALIAN_TTS_LOCALE);
  if (requested.toLowerCase() === ITALIAN_TTS_LOCALE.toLowerCase()) {
    return 'لا توجد حزمة صوت إيطالية it-IT على محرك الهاتف. نزّل الصوت الإيطالي من إعدادات تحويل النص إلى كلام، ثم أعد المحاولة.';
  }
  return `لا توجد حزمة صوت ${requested} على محرك الهاتف. نزّل الصوت المطابق من إعدادات تحويل النص إلى كلام، ثم أعد المحاولة.`;
}

export function createSpeechController({
  nativeTts = null,
  isAndroidNative = () => false,
  getRate = () => ITALIAN_TTS_RATE,
  initializationTimeoutMs = DEFAULT_TTS_INITIALIZATION_TIMEOUT_MS,
  onStateChange = () => {},
  onProgress = () => {},
  onWordProgress = () => {}
} = {}) {
  let sequence = 0;
  let activeTask = null;
  let errorTimer = null;
  let nativeReadyPromise = null;
  let nativeReadyLocale = '';
  let progressListenerPromise = null;

  const notify = (status, task = activeTask, error = '', extra = {}) => {
    try {
      onStateChange({
        status,
        button: task?.button || null,
        locale: task?.locale || '',
        kind: task?.kind || 'speech',
        progress: task?.progress || 0,
        voiceName: task?.voiceName || 'Android system voice',
        voiceSource: 'android-native',
        qualityHint: 'system-native-tts',
        error,
        ...extra
      });
    } catch {}
  };
  const setButtonState = (button, state) => {
    if (!button?.classList) return;
    button.classList.toggle?.('speaking', state === 'playing');
    button.classList.toggle?.('speech-paused', state === 'paused');
    button.classList.toggle?.('speech-error', state === 'error');
  };
  const reportProgress = (task, value) => {
    task.progress = Math.max(0, Math.min(1, Number(value) || 0));
    try {
      onProgress({progress: task.progress, locale: task.locale, voiceName: task.voiceName, voiceSource: 'android-native'});
    } catch {}
  };
  const reportWordProgress = (task, index, charLength = 0) => {
    if (task.token !== sequence) return;
    const text = String(task.currentSegmentText || '');
    const charIndex = Math.max(0, Math.min(Math.max(0, text.length - 1), Math.floor(Number(index) || 0)));
    try {
      onWordProgress({button: task.button, locale: task.locale, kind: task.kind, text, charIndex,
        charLength: Math.max(0, Number(charLength) || 0), progress: task.progress,
        source: 'android-range', approximate: false});
    } catch {}
  };
  const rateFor = () => {
    let selected = ITALIAN_TTS_RATE;
    try { selected = Number(getRate()) || ITALIAN_TTS_RATE; } catch {}
    return Math.max(.70, Math.min(1.30, selected));
  };

  function ensureProgressListener() {
    if (progressListenerPromise) return progressListenerPromise;
    if (typeof nativeTts?.addListener !== 'function') return Promise.resolve();
    progressListenerPromise = withTimeout(Promise.resolve().then(() => nativeTts.addListener('progress', event => {
      const task = activeTask;
      if (!task || task.token !== sequence || task.paused || event?.locale !== task.locale) return;
      const localIndex = Number(event?.start);
      if (!Number.isFinite(localIndex)) return;
      reportWordProgress(task, task.currentChunkOffset + localIndex, Number(event?.end) - localIndex);
    })), initializationTimeoutMs, 'tts-progress-listener-timeout').catch(error => {
      progressListenerPromise = null;
      throw error;
    });
    return progressListenerPromise;
  }

  async function ensureNativeEngine(task) {
    if (!nativeTts || typeof nativeTts.initialize !== 'function' || typeof nativeTts.speak !== 'function') {
      throw new Error('native-tts-plugin-unavailable');
    }
    if (typeof isAndroidNative !== 'function' || !isAndroidNative()) throw new Error('android-native-runtime-required');
    if (!nativeReadyPromise || nativeReadyLocale !== task.locale) {
      const requestedLocale = task.locale;
      nativeReadyLocale = requestedLocale;
      nativeReadyPromise = withTimeout(Promise.resolve().then(() => nativeTts.initialize({locale: requestedLocale})), initializationTimeoutMs, 'tts-engine-initialization-timeout')
        .then(result => {
          if (result?.ready === false) {
            if (result?.languageAvailable === false || /language|locale|voice/iu.test(String(result?.error || ''))) throw new Error('language-unavailable');
            throw new Error(String(result?.error || 'native-tts-initialization-failed'));
          }
          if (result?.languageAvailable === false) throw new Error('language-unavailable');
          return result || {};
        }).catch(error => {
          if (nativeReadyLocale === requestedLocale) {
            nativeReadyPromise = null;
            nativeReadyLocale = '';
          }
          throw error;
        });
    }
    notify('preparing', task);
    await Promise.all([nativeReadyPromise, ensureProgressListener()]);
    return task.token === sequence;
  }

  async function stopNativeEngine() {
    try { await withTimeout(Promise.resolve(nativeTts?.stop?.()), 2000, 'tts-stop-timeout'); } catch {}
  }

  function stop() {
    sequence += 1;
    if (errorTimer) { clearTimeout(errorTimer); errorTimer = null; }
    const previous = activeTask;
    activeTask = null;
    if (previous) setButtonState(previous.button, 'idle');
    notify('idle', previous);
    return stopNativeEngine();
  }

  async function waitUntilResumed(task) {
    while (task.paused && task.token === sequence) {
      await new Promise(resolve => task.resumeWaiters.push(resolve));
    }
    return task.token === sequence;
  }

  function pause() {
    const task = activeTask;
    if (!task || task.failed || task.paused) return false;
    task.paused = true;
    task.pausePending = true;
    setButtonState(task.button, 'paused');
    void stopNativeEngine();
    notify('paused', task);
    return true;
  }

  function resume() {
    const task = activeTask;
    if (!task || task.failed || !task.paused) return false;
    task.paused = false;
    setButtonState(task.button, 'playing');
    for (const resolve of task.resumeWaiters.splice(0)) resolve();
    notify('playing', task);
    return true;
  }

  function toggle() { return activeTask?.paused ? resume() : pause(); }
  function isActive(button) { return !!activeTask && !activeTask.failed && activeTask.button === button; }

  function showError(task, error, userMessage = 'تعذّر تشغيل الصوت على هذا الجهاز.') {
    task.failed = true;
    const reason = String(error?.message || error || 'native-tts-unavailable');
    try { console.warn('Android Native TTS playback failed.', {locale: task.locale, reason}); } catch {}
    setButtonState(task.button, 'error');
    notify('error', task, userMessage);
    if (errorTimer) clearTimeout(errorTimer);
    errorTimer = setTimeout(() => {
      if (task.token !== sequence) return;
      activeTask = null;
      setButtonState(task.button, 'idle');
      notify('idle', task);
      errorTimer = null;
    }, 5000);
  }

  async function speakNative(task, text) {
    const result = await nativeTts.speak({text, locale: task.locale, rate: rateFor(), pitch: ITALIAN_TTS_PITCH});
    return result?.completed !== false && result?.cancelled !== true && task.token === sequence;
  }

  async function speakChunk(task, text) {
    while (task.token === sequence) {
      if (!(await waitUntilResumed(task))) return false;
      task.pausePending = false;
      const completed = await speakNative(task, text);
      if (completed) return true;
      if ((!task.paused && !task.pausePending) || task.token !== sequence) return false;
    }
    return false;
  }

  async function runSegments(segments, locale, button, onSegment = null, kind = 'speech') {
    const requestedLocale = normalizeTtsLocale(locale);
    if (!requestedLocale) {
      await stop();
      return false;
    }
    const stopping = stop();
    const token = sequence;
    await stopping;
    if (token !== sequence) return false;

    const prepared = (segments || []).map(segment => typeof segment === 'string' ? {text: segment} : segment)
      .filter(segment => String(segment?.text || '').trim());
    if (!prepared.length) return false;
    const chunksBySegment = prepared.map(segment => {
      let cursor = 0;
      return splitSpeechText(segment.text).map(text => {
        const found = String(segment.text).indexOf(text, cursor);
        const offset = found >= 0 ? found : cursor;
        cursor = offset + text.length;
        return {text, offset};
      });
    });
    const totalCharacters = chunksBySegment.flat().reduce((sum, chunk) => sum + chunk.text.length, 0);
    if (!totalCharacters) return false;
    const task = {
      token,
      locale: requestedLocale,
      button,
      kind,
      voiceName: 'Android system voice',
      paused: false,
      failed: false,
      resumeWaiters: [],
      progress: 0,
      totalCharacters,
      completedCharacters: 0,
      currentChunkOffset: 0,
      currentSegmentIndex: 0,
      currentSegmentText: '',
      enginePrepared: false
    };
    activeTask = task;
    try {
      if (!(await ensureNativeEngine(task)) || task.token !== sequence) return false;
      task.enginePrepared = true;
      setButtonState(task.button, task.paused ? 'paused' : 'playing');
      notify(task.paused ? 'paused' : 'playing', task);

      for (let segmentIndex = 0; segmentIndex < prepared.length; segmentIndex += 1) {
        if (task.token !== sequence || !(await waitUntilResumed(task))) return false;
        task.currentSegmentIndex = segmentIndex;
        task.currentSegmentText = String(prepared[segmentIndex].text || '');
        try { onSegment?.(segmentIndex, prepared[segmentIndex]); } catch {}
        for (const chunk of chunksBySegment[segmentIndex]) {
          if (task.token !== sequence || !(await waitUntilResumed(task))) return false;
          task.currentChunkOffset = chunk.offset;
          try {
            const completed = await speakChunk(task, chunk.text);
            if (!completed || task.token !== sequence) return false;
          } catch (error) {
            if (task.token !== sequence) return false;
            const languageUnavailable = /language-unavailable|voice-unavailable|language not available|missing language data/iu.test(String(error?.message || error));
            showError(task, error, languageUnavailable ? languageMessage(task.locale) : serviceMessage());
            return false;
          }
          if (task.token !== sequence) return false;
          task.completedCharacters += chunk.text.length;
          reportProgress(task, task.completedCharacters / task.totalCharacters);
        }
      }
      reportProgress(task, 1);
      return true;
    } catch (error) {
      if (task.token !== sequence) return false;
      const languageUnavailable = /language-unavailable|voice-unavailable|language not available|missing language data/iu.test(String(error?.message || error));
      showError(task, error, languageUnavailable ? languageMessage(task.locale) : serviceMessage());
      return false;
    } finally {
      if (task.token === sequence && !task.failed) {
        activeTask = null;
        setButtonState(button, 'idle');
        notify('idle', task);
      }
    }
  }

  function speak(text, locale = ITALIAN_TTS_LOCALE, button) {
    return runSegments([{text: String(text || '')}], locale, button);
  }
  function speakSequence(segments, locale = ITALIAN_TTS_LOCALE, button, onSegment) {
    return runSegments(segments, locale, button, onSegment, 'lesson-explainer');
  }

  return {
    speak,
    speakSequence,
    pause,
    resume,
    toggle,
    stop,
    isActive,
    get state() { return activeTask ? (activeTask.failed ? 'error' : activeTask.paused ? 'paused' : 'playing') : 'idle'; }
  };
}
