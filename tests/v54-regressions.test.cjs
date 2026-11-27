'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('v54 removes the assistant UI, route, source module and server API', () => {
  const app = read('src/app.js');
  const server = read('server.js');
  assert.equal(fs.existsSync(path.join(root, 'src/assistant.mjs')), false);
  assert.doesNotMatch(app, /assistantPage|requestAssistantAnswer|resolveAssistantPrompt|data-ask-lesson|data-ask-question|data-assistant-prompt/u);
  assert.doesNotMatch(server, /\/api\/assistant|SYSTEM_PROMPT|async function assistant/u);
});

test('v54 removes the dedicated lesson search but retains question-bank and glossary search', () => {
  const app = read('src/app.js');
  assert.doesNotMatch(app, /courseFinder|courseSearch|course-finder|course-search-box|data-course-lesson-row|Cerca una lezione|ابحث عن درس/u);
  assert.match(app, /id="searchForm"/u);
  assert.match(app, /id="glossarySearch"/u);
});

test('v54 dictionary includes contextual translations for the three words in the video', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const words = new Map(dictionary.entries.map(row => [row.word, row]));
  const expected = {forme: 'أشكال', offrono: 'توفّر / تقدّم', concreto: 'المحدّد / الملموس'};
  for (const [word, arabic] of Object.entries(expected)) {
    assert.equal(words.get(word)?.translation_ar, arabic);
    assert.equal(words.get(word)?.translation_kind, 'contextual_translation');
    assert.equal(words.get(word)?.source, 'video-lesson-context-v54');
    assert.equal(words.get(word)?.review_required, 0);
  }
});

test('v68 release metadata agrees across the PWA and Android package', () => {
  assert.equal(json('package.json').version, '68.0.0');
  assert.equal(json('package-lock.json').version, '68.0.0');
  assert.equal(json('public/release.json').version, 68);
  assert.match(read('android/app/build.gradle'), /versionCode 68/u);
  assert.match(read('android/app/build.gradle'), /versionName "68\.0\.0"/u);
  assert.match(read('.github/workflows/build.yml'), /patente-b-v68-debug-apk/u);
});
