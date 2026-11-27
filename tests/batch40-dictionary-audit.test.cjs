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

const expected = {
  carburante: {
    questionTokens: 45, questionRecords: 45, uniqueItalianTexts: 45, uniquePairedTexts: 45,
    questionIdFingerprint: '119ecf6d6d65618a61d6b2f5be82e964317f824fc3bb9068241d4d4bd822133b',
    lessonTokensPerFile: 1,
    currentLessonPaths: ['modules.9.lessons.3.quickChecks.1.qIt'],
  },
  condizioni: {
    questionTokens: 48, questionRecords: 48, uniqueItalianTexts: 47, uniquePairedTexts: 48,
    questionIdFingerprint: '4959c35068ab67cfe37a5ad5bcfaebe2e75c7aaa5fca473da6c114fef021920b',
    lessonTokensPerFile: 39,
    currentLessonPaths: [
      'modules.0.lessons.2.quickChecks.1.qIt', 'modules.0.quiz.1.explanation_it',
      'modules.0.objectives_it.2', 'modules.1.caveats_it.3', 'modules.2.quiz.1.options_it.2',
      'modules.3.caveats_it.2', 'modules.4.lessons.2.summaryIt', 'modules.4.lessons.2.keyPoints.2.it',
      'modules.4.quiz.2.explanation_it', 'modules.4.quiz.2.options_it.1', 'modules.4.objectives_it.2',
      'modules.4.objectives_it.3', 'modules.4.caveats_it.3', 'modules.5.lessons.0.keyPoints.3.it',
      'modules.5.sources.8.title_it', 'modules.5.objectives_it.0', 'modules.6.objectives_it.0',
      'modules.6.objectives_it.1', 'modules.6.caveats_it.3', 'modules.7.lessons.0.summaryIt',
      'modules.7.quiz.0.explanation_it', 'modules.7.quiz.1.explanation_it', 'modules.7.caveats_it.2',
      'modules.8.quiz.2.explanation_it', 'modules.8.quiz.2.options_it.2', 'modules.8.title_it',
      'modules.8.intro_it', 'modules.9.intro_it', 'modules.9.lessons.1.summaryIt',
      'modules.9.lessons.3.summaryIt', 'modules.9.lessons.3.quickChecks.1.qIt',
      'modules.10.sources.12.title_it', 'modules.10.lessons.0.summaryIt',
      'modules.10.lessons.0.quickChecks.2.qIt', 'modules.10.lessons.3.summaryIt',
      'official_syllabus.items.3.title_it', 'official_syllabus.items.4.title_it',
    ],
  },
  attenzione: {
    questionTokens: 82, questionRecords: 82, uniqueItalianTexts: 81, uniquePairedTexts: 82,
    questionIdFingerprint: '6ebb63151af31df39cc82a12efa4ee9ec888c4b41517c51426de17f00e8525e2',
    lessonTokensPerFile: 16,
    currentLessonPaths: [
      'modules.2.lessons.2.quickChecks.2.qIt', 'modules.3.lessons.2.summaryIt',
      'modules.3.lessons.2.quickChecks.0.qIt', 'modules.8.lessons.0.summaryIt',
      'modules.8.lessons.0.keyPoints.1.it', 'modules.8.lessons.1.summaryIt',
      'modules.8.lessons.2.summaryIt', 'modules.8.lessons.2.quickChecks.0.qIt',
      'modules.8.lessons.3.summaryIt', 'modules.8.lessons.3.keyPoints.2.it',
      'modules.8.lessons.3.quickChecks.1.qIt', 'modules.8.lessons.3.quickChecks.2.qIt',
      'modules.8.lessons.5.quickChecks.0.qIt', 'modules.9.title_it',
      'modules.9.lessons.2.summaryIt', 'modules.10.lessons.1.summaryIt',
    ],
  },
  mantenere: {
    questionTokens: 46, questionRecords: 46, uniqueItalianTexts: 45, uniquePairedTexts: 46,
    questionIdFingerprint: 'bff0057d02f42835e783b5db564baf59c97d6ae0cd939e3e518a62226ee74cb4',
    lessonTokensPerFile: 9,
    currentLessonPaths: [
      'modules.0.lessons.2.summaryIt', 'modules.0.lessons.2.quickChecks.2.qIt',
      'modules.4.lessons.1.quickChecks.1.qIt', 'modules.4.caveats_it.1',
      'modules.5.lessons.3.quickChecks.1.qIt', 'modules.6.lessons.0.summaryIt',
      'modules.8.lessons.3.quickChecks.2.qIt', 'modules.8.quiz.2.explanation_it',
      'modules.8.quiz.2.options_it.1',
    ],
  },
  superare: {
    questionTokens: 50, questionRecords: 50, uniqueItalianTexts: 49, uniquePairedTexts: 50,
    questionIdFingerprint: 'c71365641d10a03c09e83ed4f42eb6dc47571e465bf28ce57b4c09610853ae1e',
    lessonTokensPerFile: 1,
    currentLessonPaths: ['modules.0.quiz.1.options_it.0'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 40 pins exact question occurrences and matched Arabic/Italian records by ID', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
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
    assert.equal(tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(ids.length, expectedTerm.questionRecords, `${term} paired question records`);
    assert.equal(italianTexts.size, expectedTerm.uniqueItalianTexts, `${term} unique Italian contexts`);
    assert.equal(pairedTexts.size, expectedTerm.uniquePairedTexts, `${term} unique Italian-Arabic pairs`);
    assert.equal(sha256(ids.join(String.fromCharCode(10))), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 40 scans Italian lesson fields and list elements in both lesson files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const legacyPaths = expectedTerm.currentLessonPaths.map(value => value.replaceAll('.quickChecks.', '.quickCheck.')).sort();
    for (const [relative, expectedPaths] of [
      ['data/lessons-v2.json', expectedTerm.currentLessonPaths],
      ['data/lessons.json', legacyPaths],
    ]) {
      const matches = [];
      const occurrences = italianFieldMatches(json(relative), term, [], false, matches);
      assert.equal(occurrences, expectedTerm.lessonTokensPerFile, `${term} lesson-field occurrences in ${relative}`);
      assert.deepEqual(matches.map(item => item.path).sort(), expectedPaths.slice().sort(), `${term} exact lesson-field paths in ${relative}`);
    }
  }
});

test('batch 40 confirms only carburante and leaves polysemous or insufficiently reviewed entries flagged', () => {
  const expectedRows = {
    carburante: { translation: 'الوقود', kind: 'contextual_translation', status: 'reviewed_override', provider: 'project-contextual-audit', review: 0, fallback: 'الوقود' },
    condizioni: { translation: 'شروط', kind: 'machine_translation', status: 'machine_draft_needs_review', provider: 'opus-mt-local', review: 1, fallback: '' },
    attenzione: { translation: 'انتباه', kind: 'machine_translation', status: 'machine_draft_needs_review', provider: 'opus-mt-local', review: 1, fallback: '' },
    mantenere: { translation: 'حافظ على', kind: 'machine_translation', status: 'machine_draft_needs_review', provider: 'opus-mt-local', review: 1, fallback: '' },
    superare: { translation: 'تخطّي', kind: 'machine_translation', status: 'machine_draft_needs_review', provider: 'opus-mt-local', review: 1, fallback: '' },
  };
  for (const [term, expectedRow] of Object.entries(expectedRows)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, expectedRow.translation, `${term} translation`);
    assert.equal(row.translation_kind, expectedRow.kind, `${term} translation kind`);
    assert.equal(row.status, expectedRow.status, `${term} status`);
    assert.equal(row.provider, expectedRow.provider, `${term} provider`);
    assert.equal(row.review_required, expectedRow.review, `${term} review flag`);
    assert.equal(row.ui_fallback_ar, expectedRow.fallback, `${term} UI fallback`);
  }
  assert.match(entries.get('carburante').source, /Treccani, carburante.*Reverso Italian-Arabic, carburante/u);
  assert.match(entries.get('carburante').note, /45 exact question-token occurrences/u);
  assert.equal(entries.get('condizioni').source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
  assert.equal(entries.get('condizioni').note, '');
});

test('batch 40 memo cites direct sources, records ambiguous conditions, and makes no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch40-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/carburante/',
    'https://dizionario.reverso.net/italiano-arabo/carburante',
    'https://www.treccani.it/vocabolario/condizione/',
    'https://ar.glosbe.com/it/ar/condizioni',
    'https://context.reverso.net/traduzione/italiano-arabo/condizioni',
    'https://www.treccani.it/vocabolario/attenzione/',
    'https://dictionary.ksaa.gov.sa/result/',
    'https://aci.gov.it/attivita-e-progetti/educazione-e-sicurezza-stradale/guida-sicura-su-strada/regole-alla-guida/',
    'https://www.treccani.it/vocabolario/mantenere/',
    'https://www.lautomobile.aci.it/attualita/guida-sicura-le-10-regole-doro-da-seguire/',
    'https://www.treccani.it/vocabolario/superare/',
    'https://www.aci.it/fileadmin/cds/art-148.php',
    'https://www.almaany.com/en/dict/ar-en/overtake/',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /بقيت علامته `review_required=1`/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 40 pins aggregate counts, generated assets, and unchanged question/lesson sources', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5078);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 83);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 92);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5036,
    reviewed_override: 258,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5078);
  const database = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/dictionary.db'));
  const dictionaryBytes = fs.readFileSync(path.join(ROOT, 'data/italian_arabic_dictionary_lookup.json'));
  const bundle = fs.readFileSync(path.join(ROOT, 'public/app.bundle.js'));
  const releaseBytes = fs.readFileSync(path.join(ROOT, 'public/release.json'));
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(sha256(database), 'dfea4c47abe39ed15998e4e849be365c6746a4365d6a16a017f58c4c92fc8ad7');
  assert.equal(sha256(dictionaryBytes), '6677c941a618b9e9a251a76dabbff2280840d3fae7fc8402ea1afa52fb8b31e4');
  assert.equal(sha256(bundle), 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685');
  assert.equal(sha256(releaseBytes), 'cb1a89497909d94811a57ce7a02473a7e885a8010cf45804ed65953171c7eba4');
  assert.equal(release.dictionarySha256, sha256(dictionaryBytes));
  assert.equal(release.bundleSha256, sha256(bundle));
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
});
