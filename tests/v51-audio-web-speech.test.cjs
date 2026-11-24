'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('lesson Italian audio uses the shared voice-aware Web Speech controller', () => {
  const app = read('src/app.js');
  const speech = read('src/speech.mjs');
  assert.match(app, /speak\(lessonItalianAudio\.dataset\.ttsText\|\|''\s*,\s*ITALIAN_TTS_LOCALE\s*,\s*lessonItalianAudio\)/u);
  assert.doesNotMatch(`${app}\n${speech}`, /playItalianAudio|isAudioUnlocked/u);
  assert.match(speech, /function waitForVoices\(/u);
  assert.match(speech, /function prepareWebVoice\(/u);
  assert.match(speech, /VOICE_POLL_INTERVAL_MS = 200/u);
  assert.match(speech, /setInterval\(check, VOICE_POLL_INTERVAL_MS\)/u);
  assert.match(speech, /api\.synthesis\.speak\(warmup\)/u);
  assert.match(speech, /api\.synthesis\.cancel\?\.\(\)/u);
  assert.match(speech, /api\.synthesis\.speak\(utterance\)/u);
});

test('Web Speech performs and cancels one empty Italian warm-up per controller', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const utterances = [];
  let cancelCount = 0;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const italianVoice = {name: 'Italian system voice', lang: 'it-IT'};
  const synthesis = {
    getVoices: () => [italianVoice],
    speak(utterance) { utterances.push(utterance); queueMicrotask(() => utterance.onend?.()); },
    cancel() { cancelCount += 1; },
  };
  const controller = createSpeechController({webSpeech: {Utterance: FakeUtterance, synthesis}});
  assert.equal(await controller.speak('Prima prova.', 'it-IT'), true);
  assert.equal(await controller.speak('Seconda prova.', 'it-IT'), true);
  const warmups = utterances.filter(item => item.text === '');
  assert.equal(warmups.length, 1);
  assert.equal(warmups[0].lang, 'it-IT');
  assert.equal(warmups[0].rate, 0.8);
  assert.equal(warmups[0].pitch, 1.0);
  assert.equal(warmups[0].volume, 1.0);
  assert.deepEqual(utterances.filter(item => item.text).map(item => item.text), ['Prima prova.', 'Seconda prova.']);
  assert.equal(cancelCount, 3);
});

test('lesson interface exposes Italian playback and the explainer narrates Italian text', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function lessonDetailPage(');
  const end = app.indexOf('function reviewIndexPage(', start);
  assert.ok(start >= 0 && end > start);
  const lessonPage = app.slice(start, end);
  assert.match(lessonPage, /data-lesson-italian-audio="true"/u);
  assert.doesNotMatch(lessonPage, /data-tts-locale="\$\{ARABIC_TTS_LOCALE\}"|lessonTextAr/u);
  assert.match(app, /speak\(lessonItalianAudio\.dataset\.ttsText\|\|''/u);
  assert.match(app, /speakSequence\(segments,ITALIAN_TTS_LOCALE/u);
  assert.match(app, /stages\[index\]\?\.text_it\|\|fallback\[index\]/u);
});

test('Italian lesson explanation waits for delayed voices, then plays each segment', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const italianVoice = {name: 'Italian system voice', lang: 'it-IT', localService: true};
  let voices = [];
  const voiceListeners = new Set();
  const utterances = [];
  const segmentSteps = [];
  const states = [];
  let cancelCount = 0;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const synthesis = {
    getVoices: () => voices,
    addEventListener(name, handler) { if (name === 'voiceschanged') voiceListeners.add(handler); },
    removeEventListener(name, handler) { if (name === 'voiceschanged') voiceListeners.delete(handler); },
    speak(utterance) { utterances.push(utterance); queueMicrotask(() => utterance.onend?.()); },
    cancel() { cancelCount += 1; }, pause() {}, resume() {},
  };
  const controller = createSpeechController({
    webSpeech: {Utterance: FakeUtterance, synthesis},
    onStateChange: state => states.push(state),
  });
  const button = {classList: {toggle() {}}};
  const segments = [
    {text: 'Idea principale: prudenza.'},
    {text: 'Esempio: precedenza a destra.'},
    {text: 'Attenzione: controlla sempre i segnali.'},
  ];
  const playback = controller.speakSequence(segments, 'it-IT', button, index => segmentSteps.push(index));
  setTimeout(() => {
    voices = [italianVoice];
    for (const handler of [...voiceListeners]) handler();
  }, 0);
  assert.equal(await playback, true);
  assert.deepEqual(segmentSteps, [0, 1, 2]);
  assert.equal(utterances.length, 4);
  assert.equal(utterances[0].text, '');
  assert.ok(utterances.slice(1).every(item => item.lang === 'it-IT' && item.rate === 0.8 && item.voice === italianVoice));
  assert.equal(cancelCount, 2);
  assert.ok(states.some(state => state.status === 'preparing'));
  assert.ok(states.some(state => state.status === 'playing' && state.voiceSource === 'browser'));
  assert.equal(controller.state, 'idle');
});

test('Web Speech polling discovers late Italian voices without a voiceschanged event', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  let voices = [];
  const utterances = [];
  let cancelCount = 0;
  class FakeUtterance { constructor(text) { this.text = text; } }
  const italianVoice = {name: 'Italian system voice', lang: 'it-IT'};
  const synthesis = {
    getVoices: () => voices,
    speak(utterance) { utterances.push(utterance); queueMicrotask(() => utterance.onend?.()); },
    cancel() { cancelCount += 1; },
  };
  const controller = createSpeechController({webSpeech: {Utterance: FakeUtterance, synthesis}});
  const playback = controller.speak('Voce arrivata in ritardo.', 'it-IT');
  setTimeout(() => { voices = [italianVoice]; }, 25);
  let watchdog;
  const deadline = new Promise((_, reject) => {
    watchdog = setTimeout(() => reject(new Error('voice polling timed out')), 1000);
  });
  const completed = await Promise.race([playback, deadline]).finally(() => clearTimeout(watchdog));
  assert.equal(completed, true);
  assert.equal(utterances.length, 2);
  assert.equal(utterances[0].text, '');
  assert.equal(utterances[1].voice, italianVoice);
  assert.equal(cancelCount, 2);
});

test('Android source and dependencies remain Web Speech only with no bundled local model', () => {
  const gradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const activity = read('android/app/src/main/java/it/patenteb/sideload/v29/MainActivity.java');
  const androidBuild = read('scripts/build-android.sh');
  const workflow = read('.github/workflows/build.yml');
  const source = [gradle, manifest, activity, androidBuild, workflow, read('src/app.js'), read('src/speech.mjs')].join('\n');
  assert.doesNotMatch(source, /Piper|piperAlpha|sherpa-onnx|piper-phonemize|ONNX|PATENTE_PIPER|nativeTts/u);
  for (const rel of [
    'android/app/src/piperAlpha',
    'android/app/src/main/assets/piper',
    'android/app/src/main/java/it/patenteb/sideload/v29/PiperTtsPlugin.java',
    'native/android/src/main/java/it/patenteb/sideload/v29/PiperTtsPlugin.java',
    'scripts/build-piper-alpha.sh',
    'scripts/download_piper_runtime.sh',
  ]) assert.equal(fs.existsSync(path.join(root, rel)), false, `${rel} must be absent`);
  assert.doesNotMatch(activity, /SpeechSettingsPlugin/u);
  assert.equal(fs.existsSync(path.join(root, 'android/app/src/main/java/it/patenteb/sideload/v29/SpeechSettingsPlugin.java')), false);
  assert.match(activity, /registerPlugin\(RewardedAdsPlugin\.class\)/u);
});
