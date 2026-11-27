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
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
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
    pairedTexts.add(`${question.it}\\u0000${paired.ar}`);
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
  norme: {
    questionTokens: 143,
    questionRecords: 143,
    uniqueItalianTexts: 139,
    uniquePairedTexts: 143,
    questionIdFingerprint: '4e955bfa6d551e3a261353c1def1ae7e00f91f3c59b933f2e0a38f08a3d1416d',
    lessonTokensPerFile: 6,
    currentLessonPaths: [
      'modules.2.quiz.0.explanation_it',
      'modules.2.quiz.2.explanation_it',
      'modules.3.lessons.2.summaryIt',
      'modules.3.intro_it',
      'modules.7.lessons.4.summaryIt',
      'official_syllabus.items.5.title_it',
    ],
    legacyLessonPaths: [
      'modules.2.quiz.0.explanation_it',
      'modules.2.quiz.2.explanation_it',
      'modules.3.lessons.2.summaryIt',
      'modules.3.intro_it',
      'modules.7.lessons.4.summaryIt',
      'official_syllabus.items.5.title_it',
    ],
  },
  manovra: {
    questionTokens: 112,
    questionRecords: 111,
    uniqueItalianTexts: 111,
    uniquePairedTexts: 111,
    questionIdFingerprint: '9140d6839fdedee33712ffad91a2908c08eefb3f145bf23823ef7d9c868a08dd',
    lessonTokensPerFile: 8,
    currentLessonPaths: [
      'modules.2.lessons.0.quickChecks.1.qIt',
      'modules.3.lessons.1.quickChecks.0.qIt',
      'modules.3.lessons.2.keyPoints.3.it',
      'modules.4.lessons.0.summaryIt',
      'modules.4.lessons.0.quickChecks.2.qIt',
      'modules.4.lessons.3.summaryIt',
      'modules.4.quiz.1.explanation_it',
      'official_syllabus.items.8.title_it',
    ],
    legacyLessonPaths: [
      'modules.2.lessons.0.quickCheck.1.qIt',
      'modules.3.lessons.1.quickCheck.0.qIt',
      'modules.3.lessons.2.keyPoints.3.it',
      'modules.4.lessons.0.summaryIt',
      'modules.4.lessons.0.quickCheck.2.qIt',
      'modules.4.lessons.3.summaryIt',
      'modules.4.quiz.1.explanation_it',
      'official_syllabus.items.8.title_it',
    ],
  },
  diritto: {
    questionTokens: 120,
    questionRecords: 120,
    uniqueItalianTexts: 105,
    uniquePairedTexts: 116,
    questionIdFingerprint: 'e2c20614b5a62aa47e31f7ea4bcf99c692e9190e60d824ba0632e2c21b02c2c0',
    lessonTokensPerFile: 3,
    currentLessonPaths: [
      'modules.3.lessons.0.summaryIt',
      'modules.7.quiz.0.explanation_it',
      'modules.7.intro_it',
    ],
    legacyLessonPaths: [
      'modules.3.lessons.0.summaryIt',
      'modules.7.quiz.0.explanation_it',
      'modules.7.intro_it',
    ],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 34 pins all paired question contexts, Arabic text, and answer keys', () => {
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

test('batch 34 scans every matching Italian field in current and legacy lesson files', () => {
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

test('batch 34 applies only the two source-backed sense-qualified glosses and keeps manovra flagged', () => {
  for (const [term, translation] of Object.entries({ norme: 'قواعد؛ معايير', diritto: 'حق؛ مستقيم/مباشرة' })) {
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

  const manovra = entries.get('manovra');
  assert.ok(manovra, 'dictionary row exists for manovra');
  assert.equal(manovra.translation_ar, 'المناورة', 'manovra machine draft stays unchanged');
  assert.equal(manovra.ui_fallback_ar, '', 'manovra remains unavailable as a reviewed UI fallback');
  assert.equal(manovra.translation_kind, 'machine_translation');
  assert.equal(manovra.status, 'machine_draft_needs_review');
  assert.equal(manovra.review_required, 1, 'manovra remains flagged because the app spans distinct operational senses');
  assert.equal(manovra.provider, 'opus-mt-local');
  assert.equal(manovra.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
});

test('batch 34 memo cites opened Italian and bilingual sources for each decision', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch34-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/norma/',
    'https://glosbe.com/it/ar/norme',
    'https://dizionario.reverso.net/italiano-arabo/norme+di+sicurezza',
    'https://www.treccani.it/vocabolario/manovra/',
    'https://dizionario.internazionale.it/parola/manovra',
    'https://dizionario.reverso.net/italiano-arabo/manovra',
    'https://www.treccani.it/vocabolario/diritto1/',
    'https://www.treccani.it/vocabolario/diritto2/',
    'https://accademiadellacrusca.it/it/consulenza/diritto-di-o-diritto-a-e-si-pu%C3%B2-andare-a-dritto/2907',
    'https://context.reverso.net/traduzione/italiano-arabo/proseguire+diritto',
    'https://dizionario.reverso.net/italiano-arabo/diritto+di+precedenza',
    'https://aci.gov.it/codice-della-strada/art-145/',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /`manovra`.*معلّم|معلّم.*`manovra`/u);
  assert.match(note, /223\/223/u);
  assert.match(note, /e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685/u);
  assert.match(note, /cb9e197d37a31621661a6c23509f6afb5156e358db780df19bb467468fab86da/u);
  assert.match(note, /60fcd938e62567b56d9dfe0dc017800073716de7b849a7de423ad64170bd4cb0/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 34 pins dictionary totals and proves questions/lessons stayed unchanged', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5092);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 78);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 83);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5050,
    reviewed_override: 244,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5092);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
