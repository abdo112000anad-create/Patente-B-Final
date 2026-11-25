'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('key points render as vertical bilingual cards without a two-column table', async () => {
  const { renderLessonSections } = await import(path.join(root, 'src/lesson-template.mjs'));
  const markup = renderLessonSections({
    summaryIt: 'La carreggiata è destinata ai veicoli.',
    summaryAr: 'المسار مخصص للمركبات.',
    keyPoints: [{it: 'La parte della strada destinata ai veicoli.', ar: 'الجزء من الطريق المخصص للمركبات.'}]
  });
  assert.match(markup, /class="lesson-key-point-card key-point-card"/u);
  assert.doesNotMatch(markup, /<table\b|<tr\b/u);
  const cardAt = markup.indexOf('class="lesson-key-point-card key-point-card"');
  const italianAt = markup.indexOf('La parte della strada destinata ai veicoli.', cardAt);
  const arabicAt = markup.indexOf('الجزء من الطريق المخصص للمركبات.', cardAt);
  assert.ok(cardAt >= 0 && italianAt > cardAt && arabicAt > italianAt);
  assert.ok(markup.includes('La parte della strada destinata ai veicoli.'));
  assert.ok(markup.includes('الجزء من الطريق المخصص للمركبات.'));
  const css = read('src/rebuild.css');
  assert.match(css, /\.lesson-key-point-card,\.key-point-card\{[^}]*border:1px solid var\(--line\)[^}]*background:/u);
  assert.match(css, /\.lesson-key-point-card,\.key-point-card\{[^}]*box-shadow:0 2px 8px/u);
  assert.match(css, /\.lesson-key-point-title \[lang="it"\][^{]*\{[^}]*direction:ltr/u);
});

test('lesson detail renders the short Italian then Arabic summary and keeps it spoken and tappable', async () => {
  const { renderLessonSections } = await import(path.join(root, 'src/lesson-template.mjs'));
  const markup = renderLessonSections({
    summaryIt: 'La strada è destinata alla circolazione pubblica.',
    summaryAr: 'الطريق مخصص لحركة المرور العامة.',
    keyPoints: [],
    body_it: 'LEGACY_LONG_ITALIAN_BODY',
    body_ar: 'LEGACY_LONG_ARABIC_BODY'
  });
  const italianAt = markup.indexOf('La strada è destinata alla circolazione pubblica.');
  const arabicAt = markup.indexOf('الطريق مخصص لحركة المرور العامة.');
  assert.ok(italianAt >= 0 && arabicAt > italianAt);
  assert.match(markup, /class="lesson-it-text"/u);
  assert.doesNotMatch(markup, /LEGACY_LONG_/u);
  const app = read('src/app.js');
  assert.match(app, /node\.dataset\.translationTappable='true'/u);
  assert.match(read('src/speech.mjs'), /lesson\.summaryIt/u);
});
