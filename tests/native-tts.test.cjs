'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Android Native TTS is the sole production playback backend and is fully registered', () => {
  const app = read('src/app.js');
  const speech = read('src/speech.mjs');
  const index = read('index.html');
  const java = read('native/android/src/main/java/it/patenteb/sideload/v29/NativeTtsPlugin.java');
  const activity = read('native/android/src/main/java/it/patenteb/sideload/v29/MainActivity.java');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(index, /data-audio-backend="android-native"/u);
  assert.match(app, /registerPlugin\('NativeTts'\)/u);
  assert.match(app, /isAndroidNative:.*Capacitor\.getPlatform\(\)==='android'/u);
  assert.match(activity, /registerPlugin\(NativeTtsPlugin\.class\)/u);
  assert.match(java, /@CapacitorPlugin\(name = "NativeTts"\)/u);
  assert.match(manifest, /android\.intent\.action\.TTS_SERVICE/u);
  assert.match(java, /TextToSpeech\(context,/u);
  assert.doesNotMatch(`${app}\n${speech}\n${index}`, /speechSynthesis|SpeechSynthesisUtterance|web speech/iu);
});

test('Native controller requests Italian system TTS at rate 0.8 and pitch 1.0', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const requests = [];
  let initializations = 0;
  const progressHandlers = [];
  const nativeTts = {
    async initialize(options) { initializations += 1; assert.equal(options.locale, 'it-IT'); return {ready: true, languageAvailable: true, locale: 'it-IT'}; },
    async addListener(name, handler) { assert.equal(name, 'progress'); progressHandlers.push(handler); return {remove() {}}; },
    async speak(options) { requests.push(options); return {completed: true, cancelled: false}; },
    async stop() { return {stopped: true}; }
  };
  const states = [];
  const progress = [];
  const controller = createSpeechController({nativeTts, isAndroidNative: () => true, onStateChange: state => states.push(state), onProgress: event => progress.push(event)});
  assert.equal(await controller.speak('Riconoscere i segnali stradali.', undefined), true);
  assert.equal(await controller.speak('La precedenza cambia secondo la situazione.', 'it-IT'), true);
  assert.equal(initializations, 1);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(item => item.locale === 'it-IT' && item.rate === 0.8 && item.pitch === 1.0));
  assert.ok(states.some(state => state.status === 'playing' && state.voiceSource === 'android-native'));
  assert.equal(progress.at(-1).progress, 1);
  assert.equal(progressHandlers.length, 1);
  assert.equal(controller.state, 'idle');
});

test('Controller forwards requested locale and reports missing voice data without crashing', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  let spoken = 0;
  let initialized = 0;
  const requestedLocales = [];
  const nativeTts = {
    async initialize(options) { initialized += 1; requestedLocales.push(options.locale); return {ready: false, languageAvailable: false, error: 'language-unavailable'}; },
    async addListener() { return {remove() {}}; },
    async speak() { spoken += 1; return {completed: true}; },
    async stop() {}
  };
  const states = [];
  const controller = createSpeechController({nativeTts, isAndroidNative: () => true, onStateChange: state => states.push(state)});
  assert.equal(await controller.speak('القيادة بحذر.', 'ar-EG'), false);
  assert.equal(initialized, 1);
  assert.deepEqual(requestedLocales, ['ar-EG']);
  assert.equal(spoken, 0);
  assert.equal(controller.state, 'error');
  assert.match(states.find(state => state.status === 'error').error, /حزمة صوت ar-EG/u);
  await controller.stop();
  assert.equal(controller.state, 'idle');
});

test('Controller speaks using the requested locale while retaining the calm rate and neutral pitch', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const requests = [];
  const nativeTts = {
    async initialize(options) { assert.equal(options.locale, 'en-US'); return {ready: true, languageAvailable: true, locale: options.locale}; },
    async addListener() { return {remove() {}}; },
    async speak(options) { requests.push(options); return {completed: true, cancelled: false}; },
    async stop() { return {stopped: true}; }
  };
  const controller = createSpeechController({nativeTts, isAndroidNative: () => true});
  assert.equal(await controller.speak('Keep left at the next junction.', 'en-us'), true);
  assert.deepEqual(requests, [{text: 'Keep left at the next junction.', locale: 'en-US', rate: 0.8, pitch: 1.0}]);
});

test('Pausing stops the native utterance and resume safely restarts its current short chunk', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const calls = [];
  let activeResolver = null;
  const nativeTts = {
    async initialize() { return {ready: true, languageAvailable: true}; },
    async addListener() { return {remove() {}}; },
    speak(options) {
      calls.push(options);
      return new Promise(resolve => { activeResolver = resolve; });
    },
    async stop() {
      if (activeResolver) {
        const resolve = activeResolver;
        activeResolver = null;
        resolve({completed: false, cancelled: true});
      }
      return {stopped: true};
    }
  };
  const controller = createSpeechController({nativeTts, isAndroidNative: () => true});
  const playback = controller.speak('Una frase breve per mettere alla prova la pausa.', 'it-IT');
  const waitFor = async predicate => {
    const deadline = Date.now() + 1000;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(predicate(), 'timed out waiting for native speech state');
  };
  await waitFor(() => calls.length === 1);
  assert.equal(controller.pause(), true);
  await waitFor(() => controller.state === 'paused');
  assert.equal(controller.resume(), true);
  await waitFor(() => calls.length === 2);
  const resolveSecond = activeResolver;
  activeResolver = null;
  resolveSecond({completed: true});
  assert.equal(await playback, true);
  assert.equal(calls[0].text, calls[1].text);
  assert.equal(controller.state, 'idle');
});

test('Pausing while the native engine prepares remains paused and does not start speech early', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  let resolveInitialization;
  let spoken = 0;
  const states = [];
  const nativeTts = {
    initialize() { return new Promise(resolve => { resolveInitialization = resolve; }); },
    async addListener() { return {remove() {}}; },
    async speak() { spoken += 1; return {completed: true}; },
    async stop() { return {stopped: true}; }
  };
  const controller = createSpeechController({nativeTts, isAndroidNative: () => true, onStateChange: state => states.push(state)});
  const waitFor = async predicate => {
    const deadline = Date.now() + 1000;
    while (!predicate() && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(predicate(), 'timed out waiting for native initialization');
  };
  const playback = controller.speak('Una frase per attendere la preparazione.', 'it-IT');
  await waitFor(() => typeof resolveInitialization === 'function');
  assert.equal(controller.pause(), true);
  resolveInitialization({ready: true, languageAvailable: true, locale: 'it-IT'});
  await waitFor(() => states.some(state => state.status === 'paused'));
  assert.equal(spoken, 0);
  assert.equal(controller.resume(), true);
  assert.equal(await playback, true);
  assert.equal(spoken, 1);
});

test('A native initialization that never resolves produces a bounded error instead of a stuck preparing state', async () => {
  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const states = [];
  const nativeTts = {
    initialize() { return new Promise(() => {}); },
    async addListener() { return {remove() {}}; },
    async speak() { throw new Error('must not speak before initialization'); },
    async stop() { return {stopped: true}; }
  };
  const controller = createSpeechController({nativeTts, isAndroidNative: () => true, initializationTimeoutMs: 15, onStateChange: state => states.push(state)});
  assert.equal(await controller.speak('Una prova di attesa.', 'it-IT'), false);
  assert.equal(controller.state, 'error');
  assert.ok(states.some(state => state.status === 'error'));
  await controller.stop();
  assert.equal(controller.state, 'idle');
});

test('Native Android engine enforces locale, rate, pitch, progress, cancellation, timeout and release', () => {
  const java = read('native/android/src/main/java/it/patenteb/sideload/v29/NativeTtsPlugin.java');
  assert.match(java, /ITALIAN_LOCALE = NativeTtsPolicy\.ITALIAN_LOCALE/u);
  assert.match(java, /ITALIAN_RATE = 0\.8f/u);
  assert.match(java, /ITALIAN_PITCH = 1\.0f/u);
  assert.match(java, /setLanguage\(Locale\.forLanguageTag\(locale\)\)/u);
  assert.match(java, /tts-engine-initialization-timeout/u);
  assert.match(java, /setSpeechRate\(ITALIAN_RATE\)/u);
  assert.match(java, /setPitch\(ITALIAN_PITCH\)/u);
  assert.match(java, /onRangeStart\(/u);
  assert.match(java, /tts-playback-timeout/u);
  assert.match(java, /textToSpeech\.shutdown\(\)/u);
});
