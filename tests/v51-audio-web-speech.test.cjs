'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const expectedItalianFunction = String.raw`let isAudioUnlocked = false;

export function playItalianAudio(text) {
    if (!('speechSynthesis' in window)) {
        console.log("TTS not supported");
        return;
    }

    // حيلة تفعيل الصوت (إجباري في أندرويد)
    if (!isAudioUnlocked) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
        isAudioUnlocked = true;
    }

    window.speechSynthesis.cancel(); // إيقاف أي صوت سابق

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    utterance.rate = 0.8; // إبطاء السرعة
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // انتظار تحميل الأصوات في أندرويد
    let voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
            voices = window.speechSynthesis.getVoices();
            const itVoice = voices.find(v => v.lang.includes('it'));
            if (itVoice) utterance.voice = itVoice;
            window.speechSynthesis.speak(utterance);
        };
    } else {
        const itVoice = voices.find(v => v.lang.includes('it'));
        if (itVoice) utterance.voice = itVoice;
        window.speechSynthesis.speak(utterance);
    }
}`;

test('v52 lesson playback matches the requested Android unlock and waits for Italian voices', () => {
  const app = read('src/app.js');
  const speech = read('src/speech.mjs');
  const start = speech.indexOf('let isAudioUnlocked = false;');
  const end = speech.indexOf('\n\nexport const ITALIAN_TTS_LOCALE', start);
  assert.ok(start >= 0 && end > start);
  const implementation = speech.slice(start, end).replace(/[ \t]+$/gmu, '');
  assert.equal(implementation, expectedItalianFunction);
  assert.ok(app.includes("playItalianAudio} from './speech.mjs'"));
  assert.doesNotMatch(app, /function playItalianAudio\(text\)/u);
  assert.match(app, /playItalianAudio\(lessonItalianAudio\.dataset\.ttsText/u);

  const spoken = [];
  let voices = [];
  let cancelled = 0;
  const italianVoice = {name: 'Italian system voice', lang: 'it-IT'};
  class FakeUtterance { constructor(text) { this.text = text; } }
  const synthesis = {
    cancel() { cancelled += 1; },
    getVoices() { return voices; },
    speak(utterance) { spoken.push(utterance); },
  };
  const context = {
    window: {speechSynthesis: synthesis},
    SpeechSynthesisUtterance: FakeUtterance,
    console: {log() {}},
  };
  const executable = implementation.replace(/^export /mu, '');
  vm.runInNewContext(`${executable}\nglobalThis.__playItalianAudio = playItalianAudio;`, context);
  context.__playItalianAudio('Ciao, prudenza.');
  assert.equal(cancelled, 1);
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].text, '');

  voices = [italianVoice];
  synthesis.onvoiceschanged();
  assert.equal(spoken.length, 2);
  assert.equal(spoken[1].text, 'Ciao, prudenza.');
  assert.equal(spoken[1].lang, 'it-IT');
  assert.equal(spoken[1].rate, 0.8);
  assert.equal(spoken[1].pitch, 1.0);
  assert.equal(spoken[1].volume, 1.0);
  assert.equal(spoken[1].voice, italianVoice);

  context.__playItalianAudio('Dopo.');
  assert.equal(cancelled, 2);
  assert.equal(spoken.length, 3);
  assert.equal(spoken[2].text, 'Dopo.');
});

test('lesson interface exposes only Italian playback and the explainer narrates Italian text', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function lessonDetailPage(');
  const end = app.indexOf('function reviewIndexPage(', start);
  assert.ok(start >= 0 && end > start);
  const lessonPage = app.slice(start, end);
  assert.match(lessonPage, /data-lesson-italian-audio="true"/u);
  assert.doesNotMatch(lessonPage, /data-tts-locale="\$\{ARABIC_TTS_LOCALE\}"|lessonTextAr/u);
  assert.match(app, /lessonItalianAudio\.dataset\.ttsText\|\|''\);return;/u);
  assert.match(app, /speakSequence\(segments,ITALIAN_TTS_LOCALE/u);
  assert.match(app, /stages\[index\]\?\.text_it\|\|fallback\[index\]/u);
});

test('v52 speech controller remains browser Web Speech only and defaults Italian to rate 0.8', async () => {
  const app = read('src/app.js');
  const speech = read('src/speech.mjs');
  assert.match(app, /createSpeechController\(\{getRate:\(\)=>speechRate/u);
  assert.doesNotMatch(`${app}\n${speech}`, /nativeTts|NativePiperTts|nativeEngineDisabled|piper-medium|piperAlpha|ONNX/u);

  const {createSpeechController} = await import(path.join(root, 'src/speech.mjs'));
  const utterances = [];
  const italianVoice = {name: 'Italian system voice', lang: 'it-IT'};
  class FakeUtterance { constructor(text) { this.text = text; } }
  const webSpeech = {
    Utterance: FakeUtterance,
    synthesis: {
      getVoices: () => [italianVoice],
      speak: utterance => { utterances.push(utterance); queueMicrotask(() => utterance.onend?.()); },
      cancel() {}, pause() {}, resume() {},
    },
  };
  const states = [];
  const controller = createSpeechController({webSpeech, onStateChange: state => states.push(state)});
  assert.equal(await controller.speak('Ciao, prudenza.', 'it-IT'), true);
  assert.equal(utterances[0].lang, 'it-IT');
  assert.equal(utterances[0].rate, 0.8);
  assert.equal(utterances[0].voice, italianVoice);
  assert.ok(states.some(state => state.status === 'playing' && state.voiceSource === 'browser'));
});

test('Android source and dependency configuration contain no local speech model or Piper runtime', () => {
  const gradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const activity = read('android/app/src/main/java/it/patenteb/sideload/v29/MainActivity.java');
  const androidBuild = read('scripts/build-android.sh');
  const workflow = read('.github/workflows/build.yml');
  assert.doesNotMatch(`${gradle}\n${manifest}\n${activity}\n${androidBuild}\n${workflow}`, /Piper|piperAlpha|sherpa-onnx|piper-phonemize|ONNX|PATENTE_PIPER/u);
  for (const rel of [
    'android/app/src/piperAlpha',
    'android/app/src/main/assets/piper',
    'android/app/src/main/java/it/patenteb/sideload/v29/PiperTtsPlugin.java',
    'native/android/src/main/java/it/patenteb/sideload/v29/PiperTtsPlugin.java',
    'scripts/build-piper-alpha.sh',
    'scripts/download_piper_runtime.sh',
  ]) assert.equal(fs.existsSync(path.join(root, rel)), false, `${rel} must be absent`);
  assert.match(activity, /registerPlugin\(SpeechSettingsPlugin\.class\)/u);
  assert.match(activity, /registerPlugin\(RewardedAdsPlugin\.class\)/u);
});

test('requested CSS fixes protect the top bar and speed control', () => {
  const css = read('src/v50-contrast.css');
  assert.match(css, /\.topbar\s*\{\s*display:\s*flex !important;\s*align-items:\s*center !important;\s*justify-content:\s*space-between !important;\s*padding:\s*12px 16px !important;\s*gap:\s*10px !important;/u);
  assert.match(css, /\.speech-rate-control\s*\{\s*position:\s*relative !important;\s*z-index:\s*99 !important;\s*margin-bottom:\s*20px !important;\s*display:\s*flex !important;\s*justify-content:\s*center !important;/u);
});
