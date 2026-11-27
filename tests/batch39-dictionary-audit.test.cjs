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

function italianFieldMatches(value, term, pathParts = [], inheritedItalian = false, matches = []) {
  let occurrences = 0;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      occurrences += italianFieldMatches(item, term, [...pathParts, String(index)], inheritedItalian, matches);
    });
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      const childPath = [...pathParts, childKey];
      const childIsItalian = isItalianTextField(childKey);
      if (typeof child === 'string' && childIsItalian) {
        const count = tokenMatches(child, term);
        occurrences += count;
        if (count) matches.push({ path: childPath.join('.'), count });
      } else if (child && typeof child === 'object') {
        occurrences += italianFieldMatches(child, term, childPath, childIsItalian, matches);
      }
    }
  } else if (typeof value === 'string' && inheritedItalian) {
    const count = tokenMatches(value, term);
    occurrences += count;
    if (count) matches.push({ path: pathParts.join('.'), count });
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
  return { tokenOccurrences, ids, uniqueItalianTexts: italianTexts.size, uniquePairedTexts: pairedTexts.size };
}

function lessonCoverage(relative, term) {
  const matches = [];
  const occurrences = italianFieldMatches(json(relative), term, [], false, matches);
  return { occurrences, paths: matches.map(item => item.path).sort() };
}

const expected = {
  regolare: {
    questionTokens: 61, questionRecords: 61, uniqueItalianTexts: 59, uniquePairedTexts: 60,
    questionIdFingerprint: '3c0d7c222bf2ce2b9f437224fa9d43309fdb1a2123406ce8f586efff25eb4fb1',
    lessonTokensPerFile: 6,
    currentLessonPaths: [
      'modules.0.objectives_it.2', 'modules.2.lessons.3.quickChecks.2.qIt',
      'modules.8.quiz.2.options_it.1', 'modules.9.lessons.0.keyPoints.2.it',
      'modules.9.lessons.0.quickChecks.0.qIt', 'modules.9.lessons.0.summaryIt',
    ],
  },
  barriere: {
    questionTokens: 52, questionRecords: 50, uniqueItalianTexts: 48, uniquePairedTexts: 50,
    questionIdFingerprint: '9f0145c6f02a2d705c154ec8514eed8345e16926336cd07bc1d59ff37e6a4c45',
    lessonTokensPerFile: 2,
    currentLessonPaths: ['modules.2.lessons.3.quickChecks.1.qIt', 'modules.2.lessons.3.summaryIt'],
  },
  percorso: {
    questionTokens: 51, questionRecords: 46, uniqueItalianTexts: 45, uniquePairedTexts: 45,
    questionIdFingerprint: '6367891d93414694ae24397b30c5abf401655c6efe61985dc29456e0fe08fc2b',
    lessonTokensPerFile: 8,
    currentLessonPaths: [
      'modules.2.lessons.3.keyPoints.2.it', 'modules.2.lessons.3.quickChecks.0.qIt',
      'modules.2.lessons.3.summaryIt', 'modules.4.lessons.3.summaryIt',
      'modules.4.quiz.1.prompt_it', 'modules.9.lessons.3.keyPoints.0.it',
      'modules.9.lessons.3.quickChecks.0.qIt', 'modules.9.lessons.3.summaryIt',
    ],
  },
  servizio: {
    questionTokens: 65, questionRecords: 65, uniqueItalianTexts: 65, uniquePairedTexts: 65,
    questionIdFingerprint: '8a5b923ee89a8e161131ff41512af2cccac86236fb7bc4e27c51d82b048919b4',
    lessonTokensPerFile: 1, currentLessonPaths: ['modules.3.lessons.3.summaryIt'],
  },
  tenere: {
    questionTokens: 62, questionRecords: 62, uniqueItalianTexts: 61, uniquePairedTexts: 62,
    questionIdFingerprint: 'be8db7af03bebc691efe325f056c89c426749c399c6c8519ccd083cabb35ad84',
    lessonTokensPerFile: 1, currentLessonPaths: ['modules.4.quiz.1.options_it.1'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 39 counts exact question contexts, pins ID sets, and matches paired Italian text and answers', () => {
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

test('batch 39 scans Italian lesson text fields and arrays in both current and legacy files', () => {
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

test('batch 39 preserves all five source glosses as flagged machine drafts', () => {
  const expectedGlosses = {
    regolare: 'عادي',
    barriere: 'الحواجز',
    percorso: 'المسار',
    servizio: 'الخدمة',
    tenere: 'احتفظ',
  };
  for (const [term, translation] of Object.entries(expectedGlosses)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} existing draft gloss`);
    assert.equal(row.ui_fallback_ar, '', `${term} remains without an unverified fallback`);
    assert.equal(row.translation_kind, 'machine_translation');
    assert.equal(row.status, 'machine_draft_needs_review');
    assert.equal(row.review_required, 1);
    assert.equal(row.provider, 'opus-mt-local');
  }
});

test('batch 39 memo records direct Italian sources, ambiguous contexts, and no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch39-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/regolare2/',
    'https://www.treccani.it/vocabolario/regolare1/',
    'https://aci.gov.it/codice-della-strada/art-141/',
    'https://www.treccani.it/vocabolario/barriera/',
    'https://aci.gov.it/codice-della-strada/art-147/',
    'https://www.treccani.it/vocabolario/percorso2/',
    'https://www.mit.gov.it/normativa/decreto-ministeriale-numero-557-del-30111999',
    'https://www.treccani.it/vocabolario/servizio/',
    'https://aci.gov.it/codice-della-strada/art-177/',
    'https://www.treccani.it/vocabolario/tenere/',
    'https://aci.gov.it/codice-della-strada/art-143/',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /لم أغيّر أي ترجمة، ولم أزل أي علامة مراجعة/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 39 pins aggregate dictionary counts, source files, SQLite, PWA, and release manifest', () => {
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
  const database = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/dictionary.db'));
  const dictionaryBytes = fs.readFileSync(path.join(ROOT, 'data/italian_arabic_dictionary_lookup.json'));
  const bundle = fs.readFileSync(path.join(ROOT, 'public/app.bundle.js'));
  const releaseBytes = fs.readFileSync(path.join(ROOT, 'public/release.json'));
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(sha256(database), '6ff22561e3322f12cf61c122b20f47b140551ade36e0a0a56f0120af58321d2f');
  assert.equal(sha256(dictionaryBytes), '01a439fca1fc074c5eb0f4655694193dfb1613e0ca8d3a77fa3cf8d4944ebf7d');
  assert.equal(sha256(bundle), 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685');
  assert.equal(sha256(releaseBytes), 'b5abdaf1a52afd092c1db289e4554fac722d642dd0068763a96ec020aeaf10e5');
  assert.equal(release.dictionarySha256, sha256(dictionaryBytes));
  assert.equal(release.bundleSha256, sha256(bundle));
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
});
