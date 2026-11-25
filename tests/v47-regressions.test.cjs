'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('dictionary resolves riconoscere directly and the attached pronoun in riconoscerlo', async () => {
  const payload = json('data/italian_arabic_dictionary_lookup.json');
  const lemma = payload.entries.find(row => row.word === 'riconoscere');
  assert.ok(lemma);
  assert.equal(lemma.translation_ar, 'يتعرف على');
  assert.equal(lemma.status, 'reviewed_override');

  const translation = await import(path.join(root, 'src/lesson-translation.mjs'));
  translation.setGeneratedDictionary(payload.entries);
  const direct = translation.translateTappedWord('riconoscere');
  assert.equal(direct.italian, 'riconoscere');
  assert.equal(direct.arabic, 'يتعرف على');
  const attached = translation.translateTappedWord('riconoscerlo');
  assert.equal(attached.word, 'riconoscerlo');
  assert.equal(attached.italian, 'riconoscere');
  assert.equal(attached.arabic, 'يتعرف على');
});

test('attached-pronoun lookup accepts only dictionary-backed roots and gives exact forms priority', async () => {
  const translation = await import(path.join(root, 'src/lesson-translation.mjs'));
  translation.setGeneratedDictionary([
    {word: 'porta', translation_ar: 'باب', status: 'reviewed_override'},
    {word: 'portare', translation_ar: 'يحمل', status: 'reviewed_override'},
  ]);
  assert.equal(translation.translateTappedWord('portala').italian, 'porta');

  translation.setGeneratedDictionary([
    {word: 'portare', translation_ar: 'يحمل', status: 'reviewed_override'},
    {word: 'portarlo', translation_ar: 'خذه', status: 'reviewed_override'},
  ]);
  const exact = translation.translateTappedWord('portarlo');
  assert.equal(exact.italian, 'portarlo');
  assert.equal(exact.arabic, 'خذه');

  translation.setGeneratedDictionary([{word: 'pare', translation_ar: 'يبدو'}]);
  const ambiguous = translation.translateTappedWord('parlo');
  assert.equal(ambiguous.status, 'missing');
  assert.equal(ambiguous.arabic, '');
});
