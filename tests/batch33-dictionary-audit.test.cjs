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
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    ids.push(String(question.id));
    italianTexts.add(question.it);
    pairedTexts.add(`${question.it}\u0000${paired.ar}`);
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
  senso: {
    questionTokens: 333,
    questionRecords: 317,
    uniqueItalianTexts: 310,
    uniquePairedTexts: 315,
    questionIdFingerprint: '0fd5179cb77ba738e5924f7fc28f6871712539cc8c0a82f8242a736dcba5f66d',
    lessonTokensPerFile: 2,
    currentLessonPaths: ['modules.2.quiz.0.prompt_it', 'modules.5.lessons.3.quickChecks.2.qIt'],
    legacyLessonPaths: ['modules.2.quiz.0.prompt_it', 'modules.5.lessons.3.quickCheck.2.qIt'],
  },
  sosta: {
    questionTokens: 313,
    questionRecords: 300,
    uniqueItalianTexts: 297,
    uniquePairedTexts: 300,
    questionIdFingerprint: '63f659e5e70d7b826c02f04015c23115970804b6bac98178d0ffba2bb27bae98',
    lessonTokensPerFile: 16,
    currentLessonPaths: [
      'modules.5.lessons.1.titleIt',
      'modules.5.lessons.1.summaryIt',
      'modules.5.lessons.1.keyPoints.2.it',
      'modules.5.lessons.1.keyPoints.3.it',
      'modules.5.lessons.1.quickChecks.2.qIt',
      'modules.5.lessons.2.titleIt',
      'modules.5.lessons.2.summaryIt',
      'modules.5.lessons.2.quickChecks.0.qIt',
      'modules.5.lessons.2.quickChecks.2.qIt',
      'modules.5.lessons.4.keyPoints.3.it',
      'modules.5.quiz.1.explanation_it',
      'modules.5.sources.4.title_it',
      'modules.5.intro_it',
      'modules.10.sources.2.title_it',
    ],
    legacyLessonPaths: [
      'modules.5.lessons.1.titleIt',
      'modules.5.lessons.1.summaryIt',
      'modules.5.lessons.1.keyPoints.2.it',
      'modules.5.lessons.1.keyPoints.3.it',
      'modules.5.lessons.1.quickCheck.2.qIt',
      'modules.5.lessons.2.titleIt',
      'modules.5.lessons.2.summaryIt',
      'modules.5.lessons.2.quickCheck.0.qIt',
      'modules.5.lessons.2.quickCheck.2.qIt',
      'modules.5.lessons.4.keyPoints.3.it',
      'modules.5.quiz.1.explanation_it',
      'modules.5.sources.4.title_it',
      'modules.5.intro_it',
      'modules.10.sources.2.title_it',
    ],
  },
  fermata: {
    questionTokens: 145,
    questionRecords: 143,
    uniqueItalianTexts: 141,
    uniquePairedTexts: 142,
    questionIdFingerprint: 'c4362d98ee887fbd99fdef0c31f27adee52227ca9aaa7116eabc92924e8f081f',
    lessonTokensPerFile: 13,
    currentLessonPaths: [
      'modules.5.lessons.1.titleIt',
      'modules.5.lessons.1.summaryIt',
      'modules.5.lessons.1.keyPoints.1.it',
      'modules.5.lessons.1.quickChecks.1.qIt',
      'modules.5.lessons.2.titleIt',
      'modules.5.lessons.2.summaryIt',
      'modules.5.lessons.2.quickChecks.0.qIt',
      'modules.5.quiz.1.explanation_it',
      'modules.5.quiz.2.explanation_it',
      'modules.5.sources.4.title_it',
      'modules.5.title_it',
      'modules.5.intro_it',
      'modules.10.sources.2.title_it',
    ],
    legacyLessonPaths: [
      'modules.5.lessons.1.titleIt',
      'modules.5.lessons.1.summaryIt',
      'modules.5.lessons.1.keyPoints.1.it',
      'modules.5.lessons.1.quickCheck.1.qIt',
      'modules.5.lessons.2.titleIt',
      'modules.5.lessons.2.summaryIt',
      'modules.5.lessons.2.quickCheck.0.qIt',
      'modules.5.quiz.1.explanation_it',
      'modules.5.quiz.2.explanation_it',
      'modules.5.sources.4.title_it',
      'modules.5.title_it',
      'modules.5.intro_it',
      'modules.10.sources.2.title_it',
    ],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
  'android/app/src/main/assets/dictionary.db': '6ff22561e3322f12cf61c122b20f47b140551ade36e0a0a56f0120af58321d2f',
};

test('batch 33 pins complete paired question contexts, Arabic text, and answer keys', () => {
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

test('batch 33 scans every matching Italian field in current and legacy lesson files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const [relative, expectedPaths] of [
      ['data/lessons-v2.json', expectedTerm.currentLessonPaths],
      ['data/lessons.json', expectedTerm.legacyLessonPaths],
    ]) {
      const actual = lessonCoverage(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokensPerFile, `${term} Italian lesson-field occurrences in ${relative}`);
      assert.deepEqual(actual.paths, expectedPaths.slice().sort(), `${term} exact Italian lesson-field paths in ${relative}`);
    }
  }
});

test('batch 33 applies only the two supported broad glosses and leaves senso flagged', () => {
  const corrections = {
    sosta: 'توقف / وقوف',
    fermata: 'توقف مؤقت / موقف',
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

  const senso = entries.get('senso');
  assert.ok(senso, 'dictionary row exists for senso');
  assert.equal(senso.translation_ar, 'معنى', 'senso draft stays unchanged');
  assert.equal(senso.ui_fallback_ar, '', 'senso remains unavailable as a reviewed UI fallback');
  assert.equal(senso.translation_kind, 'machine_translation');
  assert.equal(senso.status, 'machine_draft_needs_review');
  assert.equal(senso.review_required, 1, 'senso remains flagged because its app contexts include different senses');
  assert.equal(senso.provider, 'opus-mt-local');
  assert.equal(senso.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
});

test('batch 33 memo cites opened legal and bilingual sources and records the unresolved sense split', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch33-2026-11-27.md'), 'utf8');
  const sources = [
    'https://aci.gov.it/codice-della-strada/art-157/',
    'https://www.treccani.it/vocabolario/sosta/',
    'https://www.treccani.it/vocabolario/fermata/',
    'https://dizionario.reverso.net/italiano-arabo/sosta',
    'https://dizionario.reverso.net/italiano-arabo/fermata',
    'https://glosbe.com/it/ar/fermata%20dell\'autobus',
    'https://dizionario.reverso.net/italiano-arabo/senso',
    'https://it.glosbe.com/it/ar/senso',
    'https://www.treccani.it/vocabolario/senso/',
    'https://context.reverso.net/traduzione/italiano-arabo/senso+di+marcia',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /`senso`.*معلّم|معلّم.*`senso`/u);
  assert.match(note, /`sosta`.*`fermata`/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 33 pins dictionary totals and proves questions/lessons remained unchanged', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5075);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 85);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 93);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5033,
    reviewed_override: 261,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5075);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
