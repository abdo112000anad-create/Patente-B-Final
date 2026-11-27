'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.env.PATENTEB_ROOT || path.resolve(__dirname, '..');
const json = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const dictionary = json('data/italian_arabic_dictionary_lookup.json');
const entries = new Map(dictionary.entries.map(row => [row.word.normalize('NFC').toLocaleLowerCase('it'), row]));
const questionsAr = json('data/questions.json').questions;
const questionsIt = json('data/questions.it.json').questions;
const arabicById = new Map(questionsAr.map(row => [String(row.id), row]));

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
}

function tokenMatches(text, term) {
  const normalized = String(text || '').normalize('NFC');
  const expression = new RegExp(`(?<![\\p{L}\\p{M}])${escaped(term.normalize('NFC'))}(?![\\p{L}\\p{M}])`, 'giu');
  return [...normalized.matchAll(expression)].length;
}

function isItalianTextField(key) {
  return key === 'it' || key === 'qIt' || key.endsWith('It') || /(?:^|_)it$/iu.test(key);
}

function italianFieldMatches(value, term, pathParts = [], matches = []) {
  let occurrences = 0;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      occurrences += italianFieldMatches(item, term, [...pathParts, String(index)], matches);
    });
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      const childPath = [...pathParts, childKey];
      if (typeof child === 'string' && isItalianTextField(childKey)) {
        const count = tokenMatches(child, term);
        occurrences += count;
        if (count) matches.push({ path: childPath.join('.'), count });
      } else if (child && typeof child === 'object') {
        occurrences += italianFieldMatches(child, term, childPath, matches);
      }
    }
  }
  return occurrences;
}

function questionCounts(term) {
  let tokenOccurrences = 0;
  const ids = [];
  const italianTexts = new Set();
  const pairedTexts = new Set();
  for (const question of questionsIt) {
    const count = tokenMatches(question.it, term);
    if (!count) continue;
    tokenOccurrences += count;
    const paired = arabicById.get(String(question.id));
    assert.ok(paired, `Missing paired Arabic question ${question.id} for ${term}`);
    assert.equal(paired.it, question.it, `Italian text differs for question ${question.id}`);
    assert.equal(paired.answer, question.answer, `Answer differs for question ${question.id}`);
    assert.equal(paired.ar, question.ar, `Arabic text differs for question ${question.id}`);
    ids.push(String(question.id));
    italianTexts.add(question.it);
    pairedTexts.add(`${question.it}\u0000${question.ar}`);
  }
  return {
    tokenOccurrences,
    ids: ids.sort(),
    uniqueItalianTexts: italianTexts.size,
    uniquePairedTexts: pairedTexts.size,
  };
}

function lessonCoverage(relative, term) {
  const root = json(relative);
  const matches = [];
  const occurrences = italianFieldMatches(root, term, [], matches);
  return { occurrences, paths: matches.map(match => match.path).sort() };
}

const expected = {
  inizio: {
    questionTokens: 78,
    questionRecords: 78,
    uniqueItalianTexts: 74,
    uniquePairedTexts: 76,
    questionIdFingerprint: '5e9e377f9fca878b46b59eb39b571d77bf5e7d73935639b3ce9593b67462ccaf',
    lessonTokens: 1,
    currentLessonPaths: ['modules.5.lessons.4.keyPoints.0.it'],
    legacyLessonPaths: ['modules.5.lessons.4.keyPoints.0.it'],
  },
  bianca: {
    questionTokens: 61,
    questionRecords: 61,
    uniqueItalianTexts: 61,
    uniquePairedTexts: 61,
    questionIdFingerprint: '4c7cddea713cb4fd9812bcba8518fad5aa4a8e966fc5df700d19a48589fa304f',
    lessonTokens: 0,
    currentLessonPaths: [],
    legacyLessonPaths: [],
  },
  pedonali: {
    questionTokens: 45,
    questionRecords: 45,
    uniqueItalianTexts: 45,
    uniquePairedTexts: 45,
    questionIdFingerprint: '4182806eabf7dc235eb370abff9f8eecdf44a7c6ad9b3382858c2ed20ebbe3bc',
    lessonTokens: 1,
    currentLessonPaths: ['modules.3.lessons.2.quickChecks.0.qIt'],
    legacyLessonPaths: ['modules.3.lessons.2.quickCheck.0.qIt'],
  },
  'purché': {
    questionTokens: 60,
    questionRecords: 60,
    uniqueItalianTexts: 60,
    uniquePairedTexts: 60,
    questionIdFingerprint: '7b287414d89126f036ae959153ba02007bc66fb970bd5a9ee2c9e5168d9d26aa',
    lessonTokens: 0,
    currentLessonPaths: [],
    legacyLessonPaths: [],
  },
  'perché': {
    questionTokens: 61,
    questionRecords: 61,
    uniqueItalianTexts: 61,
    uniquePairedTexts: 61,
    questionIdFingerprint: 'a68407e3b025b361b4507f03452994e4b5c0e768f8a2c321b4fff87a7be71cc7',
    lessonTokens: 1,
    currentLessonPaths: ['modules.5.quiz.1.prompt_it'],
    legacyLessonPaths: ['modules.5.quiz.1.prompt_it'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
  'android/app/src/main/assets/dictionary.db': 'c966eb69dbeb183e6070e2d7a79733e585c6df6dd359e3efc6f8cf295c221e36',
};

test('batch 31 pins all question contexts and verifies paired Arabic text and answer keys', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} paired question records`);
    assert.equal(actual.uniqueItalianTexts, expectedTerm.uniqueItalianTexts, `${term} unique Italian contexts`);
    assert.equal(actual.uniquePairedTexts, expectedTerm.uniquePairedTexts, `${term} unique Italian-Arabic pairs`);
    assert.equal(sha256(actual.ids.join('\n')), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 31 scans every Italian field in current and legacy lesson files, including prompt_it', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const [relative, expectedPaths] of [
      ['data/lessons-v2.json', expectedTerm.currentLessonPaths],
      ['data/lessons.json', expectedTerm.legacyLessonPaths],
    ]) {
      const actual = lessonCoverage(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokens, `${term} Italian lesson-field occurrences in ${relative}`);
      assert.deepEqual(actual.paths, expectedPaths, `${term} exact Italian lesson-field paths in ${relative}`);
    }
  }
});

test('batch 31 applies four supported corrections and keeps polysemous perché flagged', () => {
  const corrections = {
    inizio: 'بداية',
    bianca: 'أبيض / بيضاء',
    pedonali: 'للمشاة / خاص بالمشاة',
    'purché': 'بشرط أن',
  };
  for (const [term, translation] of Object.entries(corrections)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} corrected gloss`);
    assert.equal(row.ui_fallback_ar, translation, `${term} reviewed gloss is the UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation', `${term} translation kind`);
    assert.equal(row.status, 'reviewed_override', `${term} reviewed status`);
    assert.equal(row.review_required, 0, `${term} no longer flagged`);
    assert.equal(row.provider, 'project-contextual-audit');
    assert.match(row.source, /^question-bank-context-audit-2026-11;/u);
  }

  const unresolved = entries.get('perché');
  assert.ok(unresolved);
  assert.equal(unresolved.translation_ar, 'لماذا؟', 'perché draft remains unchanged');
  assert.equal(unresolved.ui_fallback_ar, '', 'perché has no promoted UI fallback');
  assert.equal(unresolved.translation_kind, 'machine_translation');
  assert.equal(unresolved.status, 'machine_draft_needs_review');
  assert.equal(unresolved.review_required, 1, 'perché remains flagged due to causal and final senses');
  assert.equal(unresolved.provider, 'opus-mt-local');
  assert.equal(unresolved.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
});

test('batch 31 audit note records opened sources, the perché lesson-field correction, and limitations', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch31-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/inizio/',
    'https://ar.glosbe.com/it/ar/inizio',
    'https://www.treccani.it/vocabolario/bianco/',
    'https://glosbe.com/it/ar/bianco',
    'https://www.treccani.it/vocabolario/pedonale/',
    'https://dizionario.internazionale.it/parola/pedonale',
    'https://www.almaany.com/en/dict/ar-en/pedestrian/',
    'https://www.treccani.it/vocabolario/purche/',
    'https://context.reverso.net/translation/italian-arabic/purch%C3%A9',
    'https://www.treccani.it/vocabolario/perche/',
    'https://ar.glosbe.com/it/ar/perch%C3%A9',
    'https://context.reverso.net/translation/italian-arabic/perché',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /208\/208/u);
  assert.match(note, /e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685/u);
  assert.match(note, /git diff --check/u);
  assert.match(note, /modules\.5\.quiz\.1\.prompt_it/u);
  assert.match(note, /Q22733/u);
  assert.match(note, /معيار/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 31 pins dictionary counts and preserves the full question and lesson source files', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5090);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 79);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 84);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
