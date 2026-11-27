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
  carico: {
    questionTokens: 145, questionRecords: 142, uniqueItalianTexts: 140, uniquePairedTexts: 142,
    questionIdFingerprint: 'ab46328f9d7884459be3c66d976c110b2b2b10ffed1401ddb82d2bf1eba21613',
    lessonTokensPerFile: 15,
    currentLessonPaths: [
      'modules.6.lessons.3.titleIt', 'modules.6.lessons.3.summaryIt', 'modules.6.lessons.3.keyPoints.0.it',
      'modules.6.lessons.3.quickChecks.0.qIt', 'modules.6.lessons.3.quickChecks.1.qIt', 'modules.6.lessons.3.quickChecks.2.qIt',
      'modules.10.sources.3.title_it', 'modules.10.lessons.4.titleIt', 'modules.10.lessons.4.summaryIt',
      'modules.10.lessons.4.keyPoints.1.it', 'modules.10.lessons.4.quickChecks.0.qIt', 'modules.10.lessons.4.quickChecks.1.qIt',
      'official_syllabus.items.11.title_it', 'official_syllabus.items.20.title_it',
    ],
  },
  margine: {
    questionTokens: 63, questionRecords: 63, uniqueItalianTexts: 63, uniquePairedTexts: 63,
    questionIdFingerprint: 'c6a60f5944a22b4d079f985eadcb41c1c7154a4d847606c9c935b1d89b438372',
    lessonTokensPerFile: 0, currentLessonPaths: [],
  },
  rosso: {
    questionTokens: 63, questionRecords: 63, uniqueItalianTexts: 58, uniquePairedTexts: 62,
    questionIdFingerprint: '4de835155654a80937084f643b4f4585200f5b9e0b3aaf7399e135596d128ea9',
    lessonTokensPerFile: 1, currentLessonPaths: ['modules.2.lessons.1.summaryIt'],
  },
  diminuire: {
    questionTokens: 60, questionRecords: 60, uniqueItalianTexts: 59, uniquePairedTexts: 60,
    questionIdFingerprint: '445bc014ac5dddbdaa1ff830332e351dde198ccd21390c1db8fec14597f324de',
    lessonTokensPerFile: 2,
    currentLessonPaths: ['modules.5.lessons.0.quickChecks.1.qIt', 'modules.8.lessons.2.quickChecks.0.qIt'],
  },
  attendere: {
    questionTokens: 59, questionRecords: 59, uniqueItalianTexts: 58, uniquePairedTexts: 59,
    questionIdFingerprint: '727e1cc9004140ea9870341221c1943cd475fce2b1f6d3461d92960dd61ee6a8',
    lessonTokensPerFile: 0, currentLessonPaths: [],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 38 counts all exact question contexts, pins ID sets, and matches paired text and answers', () => {
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

test('batch 38 scans every matching Italian lesson field in current and legacy lesson files', () => {
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

test('batch 38 applies only source-supported dictionary decisions and retains carico as flagged', () => {
  const corrections = {
    margine: { translation: 'حافة', sources: ['https://www.treccani.it/vocabolario/margine/', 'https://aci.gov.it/codice-della-strada/art-143/', 'https://www.aci.it/fileadmin/cds/art-3.php', 'https://context.reverso.net/traduzione/italiano-arabo/margine'] },
    diminuire: { translation: 'يُقَلِّل؛ يَقِلّ / ينخفض', sources: ['https://www.treccani.it/vocabolario/diminuire/', 'https://dizionario.internazionale.it/parola/diminuire', 'https://context.reverso.net/traduzione/italiano-arabo/diminuire'] },
  };
  for (const [term, expectedTerm] of Object.entries(corrections)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, expectedTerm.translation, `${term} reviewed gloss`);
    assert.equal(row.ui_fallback_ar, expectedTerm.translation, `${term} reviewed UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation');
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.equal(row.provider, 'project-contextual-audit');
    assert.match(row.source, /^question-bank-context-audit-2026-11;/u);
    for (const source of expectedTerm.sources) assert.ok(row.source.includes(source), `${term} row cites ${source}`);
  }

  const confirmations = {
    rosso: { translation: 'أحمر', sources: ['https://www.treccani.it/vocabolario/rosso/', 'https://ar.glosbe.com/it/ar/rosso'] },
    attendere: { translation: 'انتظر', sources: ['https://www.treccani.it/vocabolario/attendere/', 'https://dizionario.reverso.net/italiano-arabo/attendere'] },
  };
  for (const [term, expectedTerm] of Object.entries(confirmations)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, expectedTerm.translation, `${term} confirmed gloss`);
    assert.equal(row.ui_fallback_ar, expectedTerm.translation, `${term} confirmed UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation');
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.equal(row.provider, 'project-contextual-audit');
    assert.match(row.source, /^question-bank-context-confirmation-2026-11;/u);
    for (const source of expectedTerm.sources) assert.ok(row.source.includes(source), `${term} row cites ${source}`);
  }

  const carico = entries.get('carico');
  assert.ok(carico);
  assert.equal(carico.translation_ar, 'تحميل');
  assert.equal(carico.ui_fallback_ar, '');
  assert.equal(carico.status, 'machine_draft_needs_review');
  assert.equal(carico.review_required, 1);
});

test('batch 38 memo records the direct sources, ambiguous carico contexts, and no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch38-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://it.glosbe.com/it/ar/carico',
    'https://aci.gov.it/codice-della-strada/art-164/',
    'https://www.treccani.it/vocabolario/margine/',
    'https://aci.gov.it/codice-della-strada/art-143/',
    'https://www.aci.it/fileadmin/cds/art-3.php',
    'https://context.reverso.net/traduzione/italiano-arabo/margine',
    'https://www.treccani.it/vocabolario/rosso/',
    'https://ar.glosbe.com/it/ar/rosso',
    'https://www.treccani.it/vocabolario/diminuire/',
    'https://dizionario.internazionale.it/parola/diminuire',
    'https://context.reverso.net/traduzione/italiano-arabo/diminuire',
    'https://www.treccani.it/vocabolario/attendere/',
    'https://dizionario.reverso.net/italiano-arabo/attendere',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /`carico`.*بقي معلّمًا/u);
  assert.match(note, /`margine`.*«حافة»/u);
  assert.match(note, /`rosso`.*«أحمر»/u);
  assert.match(note, /`diminuire`.*«يُقَلِّل؛ يَقِلّ \/ ينخفض»/u);
  assert.match(note, /`attendere`.*«انتظر»/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 38 pins aggregate dictionary counts and proves unchanged question and lesson sources', () => {
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
  const database = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/dictionary.db'));
  const dictionaryBytes = fs.readFileSync(path.join(ROOT, 'data/italian_arabic_dictionary_lookup.json'));
  const bundle = fs.readFileSync(path.join(ROOT, 'public/app.bundle.js'));
  const releaseBytes = fs.readFileSync(path.join(ROOT, 'public/release.json'));
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(sha256(database), '9fc28a74593c0cf87a9882f271dd0125382b2c2fe6d8145d9659289219b5e3e3');
  assert.equal(sha256(dictionaryBytes), '2fc2d1d37a6acd41de5f569985b888d4c5d265774c04e90b1018f74218477dd1');
  assert.equal(sha256(bundle), 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685');
  assert.equal(sha256(releaseBytes), '012c5fb49258184a00571acc25316b5885a99c1ebf0b89450cb653e68cc2ca3a');
  assert.equal(release.dictionarySha256, sha256(dictionaryBytes));
  assert.equal(release.bundleSha256, sha256(bundle));
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
});
