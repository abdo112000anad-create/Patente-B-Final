'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('question figure markup has a bilingual source-linked note and no broken-image icon copy', async () => {
  const {questionFigureMarkup, hasQuestionVisualReference} = await import(path.join(root, 'src/question-figures.mjs'));
  const sourceMarkup = '<a href="https://example.org/quiz.pdf#page=18">Fonte ufficiale · مصدر رسمي</a>';
  const withoutLocalImage = {id: 82, it: 'Come indicato nella figura, quale strada è corretta?', ar: 'وفق الرسم، ما الطريق الصحيح؟', hasFigureRef: true, page: 18};
  const fallback = questionFigureMarkup(withoutLocalImage, {sourceMarkup});
  assert.equal(hasQuestionVisualReference(withoutLocalImage), true);
  assert.match(fallback, /data-figure-fallback/u);
  assert.match(fallback, /Per la figura di questo quesito, consulta il PDF ufficiale/u);
  assert.match(fallback, /لرؤية رسم هذا السؤال، راجع ملف الوزارة الرسمي/u);
  assert.match(fallback, /href="https:\/\/example\.org\/quiz\.pdf#page=18"/u);
  assert.match(fallback, /صفحة (?:١٨|18)/u);
  assert.doesNotMatch(fallback, /Quiz #|marked as having|no local image is available|record is marked/u);

  const withImage = questionFigureMarkup({...withoutLocalImage, image: '/quiz-images/82.webp'}, {sourceMarkup});
  assert.match(withImage, /class="question-figure-img" data-question-figure/u);
  assert.match(withImage, /<aside hidden[^>]*data-figure-fallback/u);
  assert.match(withImage, /data-question-id="82"/u);
  assert.equal(hasQuestionVisualReference({it: 'Nella patente figura il numero del documento.'}), false);
  assert.equal(questionFigureMarkup({id: 83, it: 'La strada è urbana.'}), '');
});

test('question bank controls use Italian and Arabic rather than mixed English UI copy', () => {
  const app = read('src/app.js');
  const bank = app.slice(app.indexOf('function bankIndexPage(){'), app.indexOf('\nfunction sourceAnchor(q){'));
  for (const staleLabel of [/Browse the Patente AB source questions/u, /Final exam simulation/u, /Personalized practice/u, /Quick practice/u, /Build a focused study set/u, /This app uses the Ministry-linked/u, /Ready\? Start a timed final simulation/u]) {
    assert.doesNotMatch(bank, staleLabel);
  }
  assert.match(bank, /BANCA DATI UFFICIALE · PATENTE AB/u);
  assert.match(bank, /ARGOMENTI NELL’ORDINE DEL CORSO/u);
  assert.match(bank, /Sfoglia tutti i quesiti/u);
});

test('quiz image error handler hides the broken image and reveals the fallback without touching progress', () => {
  const app = read('src/app.js');
  const handler = app.slice(app.indexOf("main.addEventListener('error'"), app.indexOf('const sourceDialog'));
  assert.match(handler, /image\.hidden=true/u);
  assert.match(handler, /caption\.hidden=true/u);
  assert.match(handler, /fallback\.hidden=false/u);
  assert.match(handler, /data-question-figure/u);
  assert.match(handler, /data-figure-fallback/u);
  assert.match(app, /questionFigureMarkup\(q,\{sourceMarkup:sourceAnchor\(q\)\}\)/u);
  assert.match(app, /<article class="quiz-card" data-question-id="\$\{esc\(q\.id\)\}">/u);
  assert.doesNotMatch(app, /<span class="quiz-id">#\$\{q\.id\}<\/span>/u);
  assert.match(read('src/v64-ui-fixes.css'), /#main\s+\[hidden\]\s*\{\s*display:\s*none\s*!important;/u);
});

test('versioned build accepts already-current asset URLs and service worker never falls back across caches', () => {
  const build = read('scripts/build-pwa.cjs');
  const sw = read('public/sw.js');
  const index = read('index.html');
  assert.match(build, /if \(!pattern\.test\(index\)\) throw new Error/u);
  assert.doesNotMatch(build, /next === index/u);
  assert.match(index, /href="\/manifest\.webmanifest\?v=66"/u);
  assert.match(sw, /const CACHE_NAME = 'patente-ar-v66-/u);
  assert.match(sw, /const cached = await cachedResponse\(cache, request\)/u);
  assert.doesNotMatch(sw, /caches\.match\(\s*request/u);
  assert.match(sw, /key\.startsWith\('patente-ar-'\)\s*&&\s*key !== CACHE_NAME/u);
});

test('phone UI stylesheet and Cairo font are served directly with correct types alongside lesson data', async t => {
  const {server, resolveStaticFile} = require('../server.js');
  assert.equal(resolveStaticFile('/src/v64-ui-fixes.css'), path.join(root, 'src/v64-ui-fixes.css'));
  assert.equal(resolveStaticFile('/fonts/Cairo-Variable.ttf'), path.join(root, 'public/fonts/Cairo-Variable.ttf'));
  assert.equal(resolveStaticFile('/data/lessons.json'), path.join(root, 'data/lessons.json'));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const css = await fetch(`${base}/src/v64-ui-fixes.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type') || '', /^text\/css/u);
  assert.match(await css.text(), /question-figure|quiz-card/u);
  const font = await fetch(`${base}/fonts/Cairo-Variable.ttf`);
  assert.equal(font.status, 200);
  assert.match(font.headers.get('content-type') || '', /^font\/ttf/u);
  assert.ok(Number(font.headers.get('content-length')) > 300_000);
  const lessons = await fetch(`${base}/data/lessons.json`);
  assert.equal(lessons.status, 200);
  const payload = await lessons.json();
  assert.equal(payload.modules.length, 11);
  assert.equal(payload.modules.reduce((n, unit) => n + unit.lessons.length, 0), 50);
});
