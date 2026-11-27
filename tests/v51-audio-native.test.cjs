'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('lesson and quiz audio stay Italian while the shared Android Native TTS controller honors requested locales', () => {
  const app = read('src/app.js');
  const speech = read('src/speech.mjs');
  assert.match(app, /registerPlugin\('NativeTts'\)/u);
  assert.match(app, /nativeTts:NativeTts/u);
  assert.match(app, /Capacitor\.getPlatform\(\)==='android'/u);
  assert.match(app, /speak\(lessonItalianAudio\.dataset\.ttsText\|\|''\s*,\s*ITALIAN_TTS_LOCALE\s*,\s*lessonItalianAudio\)/u);
  assert.match(app, /speakSequence\(segments,ITALIAN_TTS_LOCALE/u);
  assert.match(speech, /nativeTts\.speak\(\{text, locale: task\.locale, rate: rateFor\(\), pitch: ITALIAN_TTS_PITCH\}\)/u);
  assert.doesNotMatch(`${app}\n${speech}`, /speechSynthesis|SpeechSynthesisUtterance/iu);
});

test('Italian lesson interface retains playback and the visual explainer speaks staged Italian text', () => {
  const app = read('src/app.js');
  const start = app.indexOf('function lessonDetailPage(');
  const end = app.indexOf('function reviewIndexPage(', start);
  assert.ok(start >= 0 && end > start);
  const lessonPage = app.slice(start, end);
  assert.match(lessonPage, /data-lesson-italian-audio="true"/u);
  assert.doesNotMatch(lessonPage, /data-tts-locale="\$\{ARABIC_TTS_LOCALE\}"|lessonTextAr/u);
  assert.match(app, /stages\[index\]\?\.text_it\|\|fallback\[index\]/u);
});

test('Android TTS is system-provided, dependency-free, cancellable, and explicitly queried by the manifest', () => {
  const activity = read('android/app/src/main/java/it/patenteb/sideload/v29/MainActivity.java');
  const plugin = read('native/android/src/main/java/it/patenteb/sideload/v29/NativeTtsPlugin.java');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  const gradle = read('android/app/build.gradle');
  assert.match(activity, /registerPlugin\(NativeTtsPlugin\.class\)/u);
  assert.match(plugin, /new TextToSpeech\(context,/u);
  assert.match(plugin, /setSpeechRate\(ITALIAN_RATE\)/u);
  assert.match(plugin, /TextToSpeech\.QUEUE_FLUSH/u);
  assert.match(plugin, /public void stop\(PluginCall call\)/u);
  assert.match(manifest, /android\.intent\.action\.TTS_SERVICE/u);
  assert.doesNotMatch(`${plugin}\n${gradle}`, /Piper|sherpa-onnx|piper-phonemize|ONNX/u);
});
