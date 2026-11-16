'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('Android manifest exposes the system TTS service to package visibility', () => {
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const queryAt = manifest.indexOf('<queries>');
  const applicationAt = manifest.indexOf('<application');
  assert.ok(queryAt >= 0 && queryAt < applicationAt);
  assert.match(manifest, /<queries>\s*<intent>\s*<action android:name="android\.intent\.action\.TTS_SERVICE"\s*\/>\s*<\/intent>\s*<\/queries>/u);
});

test('key points render as vertical bilingual cards without a two-column table', async () => {
  const { renderLessonSections } = await import(path.join(root, 'src/lesson-template.mjs'));
  const markup = renderLessonSections({
    body_it: 'La carreggiata è destinata ai veicoli.',
    body_ar: 'المسار مخصص للمركبات.',
    core_it: 'La carreggiata può contenere più corsie.',
    core_ar: 'قد يحتوي المسار على عدة حارات.',
    key_points: [{
      title_it: 'carreggiata', title_ar: 'المسار المخصص للمركبات',
      it: 'La parte della strada destinata ai veicoli.', ar: 'الجزء من الطريق المخصص للمركبات.'
    }]
  });
  assert.match(markup, /class="lesson-key-point-card"/u);
  assert.doesNotMatch(markup, /<table\b|<tr\b/u);
  const cardAt = markup.indexOf('class="lesson-key-point-card"');
  const italianAt = markup.indexOf('carreggiata', cardAt);
  const arabicAt = markup.indexOf('المسار المخصص للمركبات', cardAt);
  assert.ok(cardAt >= 0 && italianAt > cardAt && arabicAt > italianAt);
  assert.ok(markup.includes('La parte della strada destinata ai veicoli.'));
  assert.ok(markup.includes('الجزء من الطريق المخصص للمركبات.'));
  const css = read('src/rebuild.css');
  assert.match(css, /\.lesson-key-point-card\{[^}]*border:1px solid var\(--line\)[^}]*background:/u);
  assert.match(css, /\.lesson-key-point-card\{[^}]*box-shadow:0 2px 8px/u);
  assert.match(css, /\.lesson-key-point-title \[lang="it"\][^{]*\{[^}]*direction:ltr/u);
});

test('voice-loading state displays an Arabic progress message', () => {
  const app = read('src/app.js');
  assert.match(app, /status==='preparing'\?'جارٍ تجهيز الصوت\.\.\.'/u);
});

test('voice selection prefers a same-locale name hint or network voice and does not infer quality from names', async () => {
  const { createSpeechController } = await import(path.join(root, 'src/speech.mjs'));
  const utterances = [];
  class FakeUtterance { constructor(text) { this.text = text; } }
  const voices = [
    {name: 'Italian system voice', lang: 'it-IT', localService: true},
    {name: 'Google Italiano', lang: 'it-IT', localService: true},
    {name: 'Voce araba', lang: 'ar-EG', localService: true},
    {name: 'Arabic network voice', lang: 'ar-SA', localService: false}
  ];
  const webSpeech = {
    Utterance: FakeUtterance,
    synthesis: {getVoices: () => voices, speak: utterance => { utterances.push(utterance); queueMicrotask(() => utterance.onend?.()); }, cancel() {}}
  };
  const controller = createSpeechController({webSpeech});
  assert.equal(await controller.speak('Ciao.', 'it-IT'), true);
  assert.equal(await controller.speak('مرحبا.', 'ar-EG'), true);
  assert.equal(utterances[0].voice, voices[1]);
  assert.equal(utterances[1].voice, voices[3]);
  const speech = read('src/speech.mjs');
  assert.match(speech, /selectionEvidence:.*unverified-name-hint/u);
  assert.doesNotMatch(speech, /nameQualityHint:.*natural voice/u);
});

test('missing same-language voices report Arabic setup guidance without speaking or crashing', async () => {
  const { createSpeechController } = await import(path.join(root, 'src/speech.mjs'));
  const states = [];
  const utterances = [];
  class FakeUtterance { constructor(text) { this.text = text; } }
  const webSpeech = {
    Utterance: FakeUtterance,
    synthesis: {getVoices: () => [{name: 'Italian voice', lang: 'it-IT'}], speak: utterance => utterances.push(utterance), cancel() {}}
  };
  const controller = createSpeechController({webSpeech, onStateChange: state => states.push(state)});
  assert.equal(await controller.speak('مرحبا.', 'ar-EG'), false);
  assert.equal(utterances.length, 0);
  assert.ok(states.some(state => state.status === 'error' && /لا يتوفر صوت عربي مناسب/u.test(state.error)));
  assert.ok(states.some(state => state.status === 'error' && state.needsSpeechSettings === true));
  await controller.stop();
  assert.equal(controller.state, 'idle');
});

test('Android setup button uses only the standard TTS data installer, not a native speech engine', () => {
  const activity = read('android/app/src/main/java/it/patenteb/sideload/v29/MainActivity.java');
  const plugin = read('android/app/src/main/java/it/patenteb/sideload/v29/SpeechSettingsPlugin.java');
  assert.match(activity, /registerPlugin\(SpeechSettingsPlugin\.class\)/u);
  assert.match(plugin, /TextToSpeech\.Engine\.ACTION_INSTALL_TTS_DATA/u);
  assert.doesNotMatch(plugin, /new TextToSpeech\s*\(|synthesizeToFile|JNI|ONNX|Piper/u);
});
