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
  const matches = [];
  const occurrences = italianFieldMatches(json(relative), term, [], matches);
  return { occurrences, paths: matches.map(match => match.path).sort() };
}

const expected = {
  condurre: {
    questionTokens: 53,
    questionRecords: 53,
    uniqueItalianTexts: 53,
    uniquePairedTexts: 53,
    questionIdFingerprint: '98d47efb75a6cad1964dd572644c08efe1c7043a531a7168f18195cbde34df6d',
    lessonTokensPerFile: 0,
    currentLessonPaths: [],
    legacyLessonPaths: [],
  },
  transita: {
    questionTokens: 50,
    questionRecords: 50,
    uniqueItalianTexts: 49,
    uniquePairedTexts: 50,
    questionIdFingerprint: '4bf39b1d237796f95936c93029a4a6bc62bc55a9c42d48ad9263d78ef370d2b4',
    lessonTokensPerFile: 0,
    currentLessonPaths: [],
    legacyLessonPaths: [],
  },
  discesa: {
    questionTokens: 47,
    questionRecords: 47,
    uniqueItalianTexts: 44,
    uniquePairedTexts: 46,
    questionIdFingerprint: 'f7ff9b3cbd333468772d47fe727d7018f553181b6eaf4b852b0cccaca196d3d7',
    lessonTokensPerFile: 3,
    currentLessonPaths: [
      'modules.5.lessons.2.titleIt',
      'modules.5.lessons.2.summaryIt',
      'modules.5.lessons.2.quickChecks.2.qIt',
    ],
    legacyLessonPaths: [
      'modules.5.lessons.2.titleIt',
      'modules.5.lessons.2.summaryIt',
      'modules.5.lessons.2.quickCheck.2.qIt',
    ],
  },
  proiettori: {
    questionTokens: 45,
    questionRecords: 44,
    uniqueItalianTexts: 42,
    uniquePairedTexts: 43,
    questionIdFingerprint: 'f0d6a19d9e1bb37af75c355a5fb3779ad3fa62a21129d51554e6f30730775463',
    lessonTokensPerFile: 0,
    currentLessonPaths: [],
    legacyLessonPaths: [],
  },
  binari: {
    questionTokens: 47,
    questionRecords: 44,
    uniqueItalianTexts: 44,
    uniquePairedTexts: 44,
    questionIdFingerprint: 'b223d506083cfae87751993ab2739f49fcbf5f0d3f62c360f6c96ed9192bac3e',
    lessonTokensPerFile: 1,
    currentLessonPaths: ['official_syllabus.items.18.title_it'],
    legacyLessonPaths: ['official_syllabus.items.18.title_it'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

const generatedHashes = {
  'android/app/src/main/assets/dictionary.db': '2701026f43adb73d2f01de465b2a3ca21105c1d63544486c9657aa0c5c83c4b5',
  'public/app.bundle.js': 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685',
  'public/release.json': 'c3312bebb43c54421a80fcaf15cafa1c64dddf5efe3b0d814327dcf5bb3dfcc6',
};

test('batch 35 pins paired question contexts, Arabic text, answers, and exact ID sets', () => {
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

test('batch 35 scans all matching Italian fields in current and legacy lessons', () => {
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

test('batch 35 applies only the supported transita gloss and keeps four unresolved drafts flagged', () => {
  const transita = entries.get('transita');
  assert.ok(transita, 'dictionary row exists for transita');
  assert.equal(transita.translation_ar, 'يمرّ؛ يعبر (بحسب السياق)');
  assert.equal(transita.ui_fallback_ar, transita.translation_ar);
  assert.equal(transita.translation_kind, 'contextual_translation');
  assert.equal(transita.status, 'reviewed_override');
  assert.equal(transita.review_required, 0);
  assert.equal(transita.provider, 'project-contextual-audit');
  assert.match(transita.source, /^question-bank-context-audit-2026-11;/u);

  const retainedDrafts = {
    condurre: 'قُم بذلك',
    discesa: 'أسفل',
    proiettori: 'المستقبلات',
    binari: 'سكك حديدية',
  };
  for (const [term, translation] of Object.entries(retainedDrafts)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} original machine draft is unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no unreviewed UI fallback`);
    assert.equal(row.translation_kind, 'machine_translation');
    assert.equal(row.status, 'machine_draft_needs_review');
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local');
    assert.equal(row.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
  }
});

test('batch 35 audit memo cites opened lexical and road-code sources and records the retained flags', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch35-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/transitare/',
    'https://dizionario.reverso.net/italiano-arabo/transitare',
    'https://aci.gov.it/codice-della-strada/art-145/',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /`transita`.*يمرّ؛ يعبر/u);
  for (const term of ['condurre', 'discesa', 'proiettori', 'binari']) {
    assert.match(note, new RegExp(`\\b${term}\\b`, 'u'));
  }
  assert.match(note, /45 ظهورًا \/ 44 سؤالًا/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 35 pins dictionary totals and proves source question/lesson files stayed unchanged', () => {
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
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
  for (const [relative, digest] of Object.entries(generatedHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
