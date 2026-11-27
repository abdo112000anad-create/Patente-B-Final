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
  return key === 'it' || key === 'qIt' || key === 'source_name' || key.endsWith('It') || /(?:^|_)it$/iu.test(key);
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
    ids,
    uniqueItalianTexts: italianTexts.size,
    uniquePairedTexts: pairedTexts.size,
  };
}

function lessonCoverage(relative, term) {
  const matches = [];
  const occurrences = italianFieldMatches(json(relative), term, [], matches);
  return { occurrences, paths: matches.map(item => item.path).sort() };
}

const expected = {
  circolazione: {
    questionTokens: 320, questionRecords: 312, uniqueItalianTexts: 311, uniquePairedTexts: 312,
    questionIdFingerprint: '73633c52d667473ac87ee36010d7e1301e5338ede16d58d6cf39df38e1832f24',
    lessonTokensPerFile: 25,
    currentLessonPaths: [
      'modules.0.lessons.0.quickChecks.0.qIt', 'modules.0.sources.3.title_it', 'modules.10.intro_it',
      'modules.10.sources.0.title_it', 'modules.10.sources.12.title_it', 'modules.10.sources.6.title_it',
      'modules.2.lessons.0.quickChecks.2.qIt', 'modules.2.lessons.0.summaryIt', 'modules.2.quiz.2.explanation_it',
      'modules.3.lessons.1.summaryIt', 'modules.4.quiz.2.explanation_it', 'modules.4.title_it',
      'modules.5.lessons.1.keyPoints.0.it', 'modules.5.lessons.1.quickChecks.0.qIt', 'modules.5.lessons.1.summaryIt',
      'modules.5.sources.7.title_it', 'modules.5.sources.8.title_it', 'modules.6.sources.0.title_it',
      'modules.7.lessons.2.summaryIt', 'modules.7.quiz.1.explanation_it', 'modules.7.sources.2.title_it',
      'modules.7.sources.5.title_it', 'modules.8.sources.3.title_it', 'modules.9.sources.2.title_it',
      'official_syllabus.items.9.title_it',
    ],
  },
  marcia: {
    questionTokens: 271, questionRecords: 262, uniqueItalianTexts: 262, uniquePairedTexts: 262,
    questionIdFingerprint: '584c77074dc1d47e25e6e9f6302411e06a534c1288ff7910ba8c64a8b2672289',
    lessonTokensPerFile: 9,
    currentLessonPaths: [
      'modules.4.quiz.0.explanation_it', 'modules.4.quiz.0.prompt_it', 'modules.5.lessons.1.summaryIt',
      'modules.5.lessons.3.quickChecks.2.qIt', 'modules.5.lessons.3.summaryIt',
      'modules.5.lessons.4.keyPoints.3.it', 'modules.5.lessons.4.quickChecks.0.qIt',
      'modules.5.quiz.1.explanation_it', 'modules.6.quiz.2.explanation_it',
    ],
  },
  strade: {
    questionTokens: 290, questionRecords: 290, uniqueItalianTexts: 285, uniquePairedTexts: 287,
    questionIdFingerprint: '953a8943ea6e419735bb27af2c593f986ff2eda3cea22861558dc99c9b8e798d',
    lessonTokensPerFile: 8,
    currentLessonPaths: [
      'modules.10.sources.12.title_it', 'modules.5.lessons.4.keyPoints.1.it',
      'modules.5.lessons.4.quickChecks.1.qIt', 'modules.5.lessons.4.summaryIt',
      'modules.5.sources.7.title_it', 'modules.5.sources.8.title_it', 'modules.9.sources.2.title_it',
      'official_syllabus.items.20.title_it',
    ],
  },
  passaggio: {
    questionTokens: 122, questionRecords: 122, uniqueItalianTexts: 120, uniquePairedTexts: 121,
    questionIdFingerprint: '87ad25f28603bb9fe240de8c2657536355202603595aaead0862d53d97ca0902',
    lessonTokensPerFile: 8,
    currentLessonPaths: [
      'modules.0.quiz.0.explanation_it', 'modules.1.lessons.2.summaryIt',
      'modules.3.lessons.3.keyPoints.3.it', 'modules.3.lessons.3.quickChecks.1.qIt',
      'modules.3.lessons.3.summaryIt', 'modules.4.quiz.0.explanation_it', 'official_syllabus.items.4.title_it',
    ],
  },
  attraversamento: {
    questionTokens: 117, questionRecords: 114, uniqueItalianTexts: 110, uniquePairedTexts: 114,
    questionIdFingerprint: 'f0c4b8a475ce54f1e7af8fe5813f98037190f48775f7b702e41e389e38ccfced',
    lessonTokensPerFile: 4,
    currentLessonPaths: [
      'modules.2.lessons.0.keyPoints.3.it', 'modules.2.quiz.0.explanation_it',
      'modules.3.lessons.2.keyPoints.0.it', 'modules.3.lessons.2.quickChecks.1.qIt',
    ],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 37 counts every question context and verifies paired Italian text and answer keys', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} paired question records`);
    assert.equal(actual.uniqueItalianTexts, expectedTerm.uniqueItalianTexts, `${term} unique Italian contexts`);
    assert.equal(actual.uniquePairedTexts, expectedTerm.uniquePairedTexts, `${term} unique Italian-Arabic pairs`);
    assert.equal(sha256(actual.ids.join(String.fromCharCode(10))), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 37 scans all Italian lesson fields in current and legacy data', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const legacyPaths = expectedTerm.currentLessonPaths.map(value => value.replaceAll('.quickChecks.', '.quickCheck.')).sort();
    for (const [relative, expectedPaths] of [
      ['data/lessons-v2.json', expectedTerm.currentLessonPaths],
      ['data/lessons.json', legacyPaths],
    ]) {
      const actual = lessonCoverage(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokensPerFile, `${term} Italian lesson-field occurrences in ${relative}`);
      assert.deepEqual(actual.paths, expectedPaths.slice().sort(), `${term} exact Italian lesson-field paths in ${relative}`);
    }
  }
});

test('batch 37 changes only strade to the supported traffic-road gloss and leaves four ambiguous drafts flagged', () => {
  const strade = entries.get('strade');
  assert.ok(strade);
  assert.equal(strade.translation_ar, 'الطرق');
  assert.equal(strade.ui_fallback_ar, 'الطرق');
  assert.equal(strade.translation_kind, 'contextual_translation');
  assert.equal(strade.status, 'reviewed_override');
  assert.equal(strade.review_required, 0);
  assert.equal(strade.provider, 'project-contextual-audit');
  assert.match(strade.source, /^question-bank-context-audit-2026-11;/u);

  const retainedDrafts = {
    circolazione: {translation: 'حركة المرور', status: 'legacy_glossary_needs_review'},
    marcia: {translation: 'السير', status: 'legacy_glossary_needs_review'},
    passaggio: {translation: 'تمرير', status: 'machine_draft_needs_review'},
    attraversamento: {translation: 'العبور', status: 'machine_draft_needs_review'},
  };
  for (const [term, expectedTerm] of Object.entries(retainedDrafts)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, expectedTerm.translation, `${term} original draft is unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no unreviewed UI fallback`);
    assert.equal(row.status, expectedTerm.status, `${term} retains its unreviewed status`);
    assert.equal(row.review_required, 1, `${term} remains flagged`);
  }
});

test('batch 37 memo cites direct sources, records remaining ambiguity, and makes no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch37-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/strada/',
    'https://glosbe.com/it/ar/strada',
    'https://www.aci.it/fileadmin/cds/art-3.php',
    'https://www.treccani.it/vocabolario/circolazione_res-3631ee33-de6f-11eb-94e0-00271042e8d9/',
    'https://www.treccani.it/vocabolario/marcia2/',
    'https://dizionario.internazionale.it/parola/marcia',
    'https://www.aci.it/fileadmin/cds/art-140.php',
    'https://www.treccani.it/vocabolario/passaggio/',
    'https://dizionario.internazionale.it/parola/passaggio',
    'https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285~art147',
    'https://www.treccani.it/vocabolario/attraversamento/',
    'https://www.aci.it/fileadmin/cds/art-40.php',
    'https://context.reverso.net/traduzione/italiano-arabo/attraversamento',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /`strade`.*«الطرق»/u);
  for (const term of ['circolazione', 'marcia', 'passaggio', 'attraversamento']) assert.ok(note.includes(`\`${term}\``));
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 37 pins aggregate counts and proves source and generated asset fingerprints', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5084);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 82);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 87);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5042,
    reviewed_override: 252,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5084);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
});
