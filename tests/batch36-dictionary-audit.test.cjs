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
  return value.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&');
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
  striscia: {
    questionTokens: 128, questionRecords: 128, uniqueItalianTexts: 127, uniquePairedTexts: 127,
    questionIdFingerprint: 'f93f7a2efac7d96a31f7584c928f52215c477fe0574c066e2affe2b73b20fa9d',
    lessonTokensPerFile: 3,
    currentLessonPaths: ['modules.2.quiz.0.explanation_it', 'modules.2.quiz.0.prompt_it'],
    legacyLessonPaths: ['modules.2.quiz.0.explanation_it', 'modules.2.quiz.0.prompt_it'],
  },
  vietato: {
    questionTokens: 121, questionRecords: 121, uniqueItalianTexts: 121, uniquePairedTexts: 121,
    questionIdFingerprint: 'd33bc0e9feab68204f92593a6cc2899a2012bec68342e22cf5da267e3b7ef853',
    lessonTokensPerFile: 0, currentLessonPaths: [], legacyLessonPaths: [],
  },
  circolare: {
    questionTokens: 120, questionRecords: 119, uniqueItalianTexts: 118, uniquePairedTexts: 119,
    questionIdFingerprint: '8d14f79b68358cc0bd62819e6df6e4ffd40d96059fcb22021f0d36d214fd9a6a',
    lessonTokensPerFile: 3,
    currentLessonPaths: ['modules.3.lessons.1.quickChecks.2.qIt', 'modules.9.intro_it', 'official_syllabus.source_name'],
    legacyLessonPaths: ['modules.3.lessons.1.quickCheck.2.qIt', 'modules.9.intro_it', 'official_syllabus.source_name'],
  },
  corrispondenza: {
    questionTokens: 117, questionRecords: 117, uniqueItalianTexts: 114, uniquePairedTexts: 115,
    questionIdFingerprint: '07d8eabe5510861c9c477e69054192284c04d61ad20ebcc8d599cbc56cd740e8',
    lessonTokensPerFile: 2,
    currentLessonPaths: ['modules.5.lessons.2.quickChecks.0.qIt', 'modules.5.lessons.2.summaryIt'],
    legacyLessonPaths: ['modules.5.lessons.2.quickCheck.0.qIt', 'modules.5.lessons.2.summaryIt'],
  },
  doppio: {
    questionTokens: 116, questionRecords: 116, uniqueItalianTexts: 115, uniquePairedTexts: 116,
    questionIdFingerprint: '333f32fb7e168a90f6a51c7b787e699c53b82bb118ae065f620f29e97862a16b',
    lessonTokensPerFile: 0, currentLessonPaths: [], legacyLessonPaths: [],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

const generatedHashes = {
  'android/app/src/main/assets/dictionary.db': '9fc28a74593c0cf87a9882f271dd0125382b2c2fe6d8145d9659289219b5e3e3',
  'public/app.bundle.js': 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685',
  'public/release.json': '3329d62d2eb6b47776ae5b5929c8469d0e751b43872197ffb17deb54d7cde5c2',
};

test('batch 36 counts complete question contexts and exact paired IDs', () => {
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

test('batch 36 scans all relevant Italian fields in current and legacy lessons', () => {
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

test('batch 36 applies the supported corrispondenza correction, confirms vietato, and keeps three drafts flagged', () => {
  const corrispondenza = entries.get('corrispondenza');
  assert.ok(corrispondenza);
  assert.equal(corrispondenza.translation_ar, 'عند');
  assert.equal(corrispondenza.ui_fallback_ar, 'عند');
  assert.equal(corrispondenza.translation_kind, 'contextual_translation');
  assert.equal(corrispondenza.status, 'reviewed_override');
  assert.equal(corrispondenza.review_required, 0);
  assert.equal(corrispondenza.provider, 'project-contextual-audit');
  assert.match(corrispondenza.source, /^question-bank-context-audit-2026-11;/u);

  const vietato = entries.get('vietato');
  assert.ok(vietato);
  assert.equal(vietato.translation_ar, 'ممنوع');
  assert.equal(vietato.ui_fallback_ar, 'ممنوع');
  assert.equal(vietato.translation_kind, 'contextual_translation');
  assert.equal(vietato.status, 'reviewed_override');
  assert.equal(vietato.review_required, 0);
  assert.equal(vietato.provider, 'project-contextual-audit');
  assert.match(vietato.source, /^question-bank-context-confirmation-2026-11;/u);

  const retainedDrafts = {striscia: 'شريط', circolare: 'دائري', doppio: 'مزدوج'};
  for (const [term, translation] of Object.entries(retainedDrafts)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} original draft is unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no unreviewed UI fallback`);
    assert.equal(row.translation_kind, 'machine_translation');
    assert.equal(row.status, 'machine_draft_needs_review');
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local');
    assert.equal(row.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
  }
});

test('batch 36 memo cites direct sources, records ambiguity limits, and makes no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch36-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/striscia/',
    'https://aci.gov.it/codice-della-strada/art-40/',
    'https://www.treccani.it/vocabolario/vietare/',
    'https://aci.gov.it/codice-della-strada/art-39/',
    'https://www.treccani.it/vocabolario/circolare1/',
    'https://www.treccani.it/vocabolario/circolare2/',
    'https://www.treccani.it/vocabolario/corrispondenza/',
    'https://context.reverso.net/traduzione/italiano-arabo/in+corrispondenza+di',
    'https://www.treccani.it/vocabolario/doppio/',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /`corrispondenza`.*«عند»/u);
  assert.match(note, /`vietato`.*«ممنوع»/u);
  for (const term of ['striscia', 'circolare', 'doppio']) assert.ok(note.includes(`\`${term}\``));
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 36 pins dictionary totals and proves source and generated artifact fingerprints', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5085);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 82);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 86);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5043,
    reviewed_override: 251,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5085);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
  for (const [relative, digest] of Object.entries(generatedHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} generated fingerprint`);
  }
});
