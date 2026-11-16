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
export const ARABIC_TTS_LOCALE = 'ar-EG';
const VOICE_WAIT_TIMEOUT_MS = 10_000;
const VOICE_POLL_INTERVAL_MS = 250;

export function buildLessonSpeechTexts(lesson = {}) {
  const headingIt = String(lesson.heading_it || '').trim();
  const bodyIt = String(lesson.body_it || '').trim();
  const headingAr = String(lesson.heading_ar || '').trim();
  const bodyAr = String(lesson.body_ar || '').trim();
  return {
    italian: [headingIt, bodyIt].filter(Boolean).join('\n\n'),
    arabic: [headingAr, bodyAr].filter(Boolean).join('\n\n')
  };
}

function voiceNameFor(locale) {
  return String(locale || '').toLowerCase().startsWith('it')
    ? 'Italiano · voce del dispositivo'
    : 'العربية · صوت الجهاز';
}

function normalizedLocale(locale) {
  return String(locale || '').toLowerCase().startsWith('it') ? ITALIAN_TTS_LOCALE : ARABIC_TTS_LOCALE;
}

function resolveWebSpeech(injected) {
  try {
    const synthesis = injected?.synthesis ?? globalThis.speechSynthesis ?? globalThis.window?.speechSynthesis;
    const Utterance = injected?.Utterance ?? globalThis.SpeechSynthesisUtterance ?? globalThis.window?.SpeechSynthesisUtterance;
    return synthesis && typeof synthesis.speak === 'function' && typeof Utterance === 'function'
      ? {synthesis, Utterance}
      : null;
  } catch {
    return null;
  }
}

function readAvailableVoices(synthesis) {
  if (typeof synthesis?.getVoices !== 'function') {
    throw new Error('The system speech voice list is unavailable on this device.');
  }
  return Array.from(synthesis.getVoices() || []);
}

function waitForVoices(synthesis, task, isCurrent, onWaiting) {
  const initialVoices = readAvailableVoices(synthesis);
  if (initialVoices.length) return Promise.resolve(initialVoices);

  try {
    console.log('[TTS] جارٍ تجهيز الصوت... انتظار تحميل أصوات النظام.');
    onWaiting?.();
  } catch {}

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout = null;
    let poll = null;
    const cleanups = [];

    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (poll) clearInterval(poll);
      for (const removeListener of cleanups.splice(0)) {
        try { removeListener(); } catch {}
      }
      if (task.cancelVoiceWait === cancel) task.cancelVoiceWait = null;
    };
    const finish = (voices, error = null) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(voices);
    };
    const check = () => {
      if (!isCurrent()) { finish([]); return; }
      try {
        const voices = readAvailableVoices(synthesis);
        if (voices.length) finish(voices);
      } catch (error) {
        finish(null, error);
      }
    };
    const cancel = () => finish([]);
    task.cancelVoiceWait = cancel;
    timeout = setTimeout(() => finish(null, new Error('Timed out waiting for system speech voices.')), VOICE_WAIT_TIMEOUT_MS);
    poll = setInterval(check, VOICE_POLL_INTERVAL_MS);

    try {
      if (typeof synthesis.addEventListener === 'function' && typeof synthesis.removeEventListener === 'function') {
        const remove = () => synthesis.removeEventListener('voiceschanged', check);
        cleanups.push(remove);
        synthesis.addEventListener('voiceschanged', check);
      } else {
        const previousHandler = synthesis.onvoiceschanged;
        const chainedHandler = event => {
          try { if (typeof previousHandler === 'function') previousHandler.call(synthesis, event); } catch {}
          check();
        };
        synthesis.onvoiceschanged = chainedHandler;
        cleanups.push(() => {
          if (synthesis.onvoiceschanged === chainedHandler) synthesis.onvoiceschanged = previousHandler;
        });
      }
    } catch {}
    check();
  });
}

function hasExplicitVoiceQuality(voice) {
  if (voice?.natural === true || voice?.isNatural === true || voice?.enhanced === true || voice?.isEnhanced === true) return true;
  return [voice?.quality, voice?.voiceType].some(value => ['natural', 'enhanced', 'neural', 'premium'].includes(String(value || '').toLowerCase()));
}

function hasVoiceNameQualityHint(voice) {
  return /\b(?:google|natural|premium|neural)\b/iu.test(String(voice?.name || ''));
}

function voiceRank(voice) {
  if (hasExplicitVoiceQuality(voice)) return 0;
  if (voice?.localService === false) return 1;
  if (hasVoiceNameQualityHint(voice)) return 2;
  if (voice?.default === true) return 3;
  return 4;
}

function bestVoice(voices) {
  return [...voices].sort((left, right) => voiceRank(left) - voiceRank(right))[0] || null;
}

function chooseVoice(voices, locale) {
  try {
    const desired = String(locale || '').toLowerCase().replace(/_/gu, '-');
    const language = desired.split('-')[0];
    const matching = Array.from(voices || []).filter(voice => String(voice?.lang || '').toLowerCase().replace(/_/gu, '-').split('-')[0] === language);
    if (!matching.length) return null;
    const exact = matching.filter(voice => String(voice?.lang || '').toLowerCase().replace(/_/gu, '-') === desired);
    const preferred = candidates => candidates.filter(voice => voiceRank(voice) <= 2);
    const exactPreferred = bestVoice(preferred(exact));
    if (exactPreferred) return exactPreferred;
    if (language === 'ar') {
      const requestedArabicVariants = matching.filter(voice => ['ar-eg', 'ar-sa'].includes(String(voice?.lang || '').toLowerCase().replace(/_/gu, '-')));
      const preferredArabic = bestVoice(preferred(requestedArabicVariants));
      if (preferredArabic) return preferredArabic;
      if (requestedArabicVariants.length) return bestVoice(requestedArabicVariants);
    }
    return bestVoice(exact) || bestVoice(preferred(matching)) || bestVoice(matching);
  } catch {
    return null;
  }
}

function voiceInstallMessage(locale) {
  const language = String(locale || '').toLowerCase().startsWith('it') ? 'إيطالي' : 'عربي';
  return `لا يتوفر صوت ${language} مناسب على هذا الجهاز. ثبّت حزمة النطق من إعدادات الهاتف.`;
}

function voiceMetadataForLog(voice) {
  const explicitQuality = hasExplicitVoiceQuality(voice);
  return {
    name: String(voice?.name || ''),
    lang: String(voice?.lang || ''),
    voiceURI: String(voice?.voiceURI || ''),
    localService: typeof voice?.localService === 'boolean' ? voice.localService : 'unknown',
    default: voice?.default === true,
    qualityMetadata: String(voice?.quality || voice?.voiceType || 'not reported'),
    nameQualityHint: hasVoiceNameQualityHint(voice),
    selectionEvidence: explicitQuality ? 'engine-reported-quality' : voice?.localService === false ? 'network-service' : hasVoiceNameQualityHint(voice) ? 'unverified-name-hint' : 'language-match'
  };
}

export function createSpeechController({
  webSpeech = null,
  getRate = () => 1,
  onStateChange = () => {},
  onProgress = () => {}
} = {}) {
  let sequence = 0;
  let activeTask = null;
  let errorTimer = null;

  const notify = (status, task = activeTask, error = '', extra = {}) => {
    try {
      onStateChange({
        status,
        button: task?.button || null,
        locale: task?.locale || '',
        kind: task?.kind || 'speech',
        progress: task?.progress || 0,
        voiceName: task?.voiceName || '',
        voiceSource: 'browser',
        qualityHint: 'device-speech',
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
      onProgress({progress: task.progress, locale: task.locale, voiceName: task.voiceName, voiceSource: 'browser'});
    } catch {}
  };
  const rateFor = () => {
    const base = 0.90;
    let selected = 1;
    try { selected = Number(getRate()) || 1; } catch {}
    return Math.max(0.60, Math.min(1.35, base * Math.max(.70, Math.min(1.30, selected))));
  };

  function stopBrowserSpeech() {
    try { resolveWebSpeech(webSpeech)?.synthesis.cancel?.(); } catch {}
  }

  function stop() {
    sequence += 1;
    if (errorTimer) { clearTimeout(errorTimer); errorTimer = null; }
    const previous = activeTask;
    activeTask = null;
    previous?.cancelVoiceWait?.();
    if (previous) setButtonState(previous.button, 'idle');
    stopBrowserSpeech();
    notify('idle', previous);
    return Promise.resolve();
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
    setButtonState(task.button, 'paused');
    try { resolveWebSpeech(webSpeech)?.synthesis.pause?.(); } catch {}
    notify('paused', task);
    return true;
  }

  function resume() {
    const task = activeTask;
    if (!task || task.failed || !task.paused) return false;
    task.paused = false;
    setButtonState(task.button, 'playing');
    try { resolveWebSpeech(webSpeech)?.synthesis.resume?.(); } catch {}
    for (const resolve of task.resumeWaiters.splice(0)) resolve();
    notify('playing', task);
    return true;
  }

  function toggle() { return activeTask?.paused ? resume() : pause(); }
  function isActive(button) { return !!activeTask && !activeTask.failed && activeTask.button === button; }

  function showError(task, error, userMessage = 'تعذّر تشغيل الصوت على هذا الجهاز.', needsSpeechSettings = false) {
    task.failed = true;
    const reason = String(error?.message || error || 'speech-engine-unavailable');
    try { console.warn('Web Speech playback failed on this device.', {locale: task.locale, reason}); } catch {}
    setButtonState(task.button, 'error');
    notify('error', task, userMessage, {needsSpeechSettings});
    if (errorTimer) clearTimeout(errorTimer);
    if (needsSpeechSettings) return;
    errorTimer = setTimeout(() => {
      if (task.token !== sequence) return;
      activeTask = null;
      setButtonState(task.button, 'idle');
      notify('idle', task);
      errorTimer = null;
    }, 5000);
  }

  function speakWithWebSpeech(task, text, rate) {
    const api = resolveWebSpeech(webSpeech);
    if (!api) return Promise.reject(new Error('Web Speech API is unavailable on this device.'));
    return new Promise((resolve, reject) => {
      let utterance = null;
      let timeout = null;
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (utterance) { utterance.onend = null; utterance.onerror = null; }
        callback(value);
      };
      try {
        utterance = new api.Utterance(text);
        utterance.lang = task.locale;
        utterance.rate = rate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        if (!task.selectedVoice) throw new Error('No matching system voice was selected.');
        utterance.voice = task.selectedVoice;
        utterance.onend = () => finish(resolve, task.token === sequence);
        utterance.onerror = event => {
          if (task.token !== sequence) finish(resolve, false);
          else finish(reject, new Error(`Web Speech API failed: ${String(event?.error || 'unknown error')}`));
        };
        timeout = setTimeout(() => finish(reject, new Error('Web Speech API timed out.')), Math.max(20000, Math.min(120000, text.length * 350)));
        api.synthesis.speak(utterance);
      } catch (error) {
        finish(reject, error);
      }
    });
  }

  async function speakChunk(task, text) {
    await speakWithWebSpeech(task, text, rateFor(task.locale));
    return task.token === sequence;
  }

  async function runSegments(segments, locale, button, onSegment = null, kind = 'speech') {
    const stopping = stop();
    const token = sequence;
    await stopping;
    if (token !== sequence) return false;

    const normalized = normalizedLocale(locale);
    const prepared = (segments || []).map(segment => typeof segment === 'string' ? {text: segment} : segment)
      .filter(segment => String(segment?.text || '').trim());
    if (!prepared.length) return false;
    const api = resolveWebSpeech(webSpeech);
    const chunksBySegment = prepared.map(segment => splitSpeechText(segment.text));
    const totalCharacters = chunksBySegment.flat().reduce((sum, chunk) => sum + chunk.length, 0);
    if (!totalCharacters) return false;
    const task = {
      token,
      locale: normalized,
      button,
      kind,
      voiceName: voiceNameFor(normalized),
      paused: false,
      failed: false,
      resumeWaiters: [],
      progress: 0,
      totalCharacters,
      completedCharacters: 0,
      currentChunkCharacters: 0
    };
    activeTask = task;
    if (!api) {
      showError(task, 'web-speech-api-unavailable', voiceInstallMessage(task.locale), true);
      return false;
    }
    try {
      const voices = await waitForVoices(api.synthesis, task, () => task.token === sequence, () => notify('preparing', task));
      if (task.token !== sequence) return false;
      if (!voices.length) throw new Error('No system speech voices were available.');
      const selectedVoice = chooseVoice(voices, task.locale);
      if (!selectedVoice) {
        showError(task, 'no-matching-language-voice', voiceInstallMessage(task.locale), true);
        return false;
      }
      task.selectedVoice = selectedVoice;
      try { console.log('[TTS] selected system voice metadata:', voiceMetadataForLog(selectedVoice)); } catch {}
      setButtonState(button, 'playing');
      notify('playing', task);

      for (let segmentIndex = 0; segmentIndex < prepared.length; segmentIndex += 1) {
        if (task.token !== sequence || !(await waitUntilResumed(task))) return false;
        try { onSegment?.(segmentIndex, prepared[segmentIndex]); } catch {}
        for (const chunk of chunksBySegment[segmentIndex]) {
          if (task.token !== sequence || !(await waitUntilResumed(task))) return false;
          task.currentChunkCharacters = chunk.length;
          try {
            const completed = await speakChunk(task, chunk);
            if (!completed || task.token !== sequence) return false;
          } catch (error) {
            if (task.token !== sequence) return false;
            showError(task, error);
            return false;
          }
          if (task.token !== sequence) return false;
          task.completedCharacters += chunk.length;
          task.currentChunkCharacters = 0;
          reportProgress(task, task.completedCharacters / task.totalCharacters);
        }
      }
      reportProgress(task, 1);
      return true;
    } catch (error) {
      if (task.token !== sequence) return false;
      const voiceUnavailable = /speech voice list is unavailable|timed out waiting for system speech voices|no system speech voices/iu.test(String(error?.message || error));
      showError(task, error, voiceUnavailable ? voiceInstallMessage(task.locale) : 'تعذّر تشغيل الصوت على هذا الجهاز.', voiceUnavailable);
      return false;
    } finally {
      if (task.token === sequence && !task.failed) {
        activeTask = null;
        setButtonState(button, 'idle');
        notify('idle', task);
      }
    }
  }

  function speak(text, locale, button) {
    return runSegments([{text: String(text || '')}], locale, button);
  }
  function speakSequence(segments, locale, button, onSegment) {
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
