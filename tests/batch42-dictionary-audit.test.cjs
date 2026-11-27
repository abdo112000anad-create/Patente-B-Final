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
  persone: {
    questionTokens: 89, questionRecords: 89, uniqueItalianTexts: 89, uniquePairedTexts: 89,
    questionIdFingerprint: '0d5935d051a309fa22dd2a3cc09dbb67feb204dfbb4fee5edcfd0e02dd07162d',
    lessonTokensPerFile: 10,
    currentLessonPaths: [
      'modules.10.sources.10.title_it', 'modules.10.sources.4.title_it',
      'modules.7.lessons.3.keyPoints.2.it', 'modules.7.lessons.3.quickChecks.0.qIt',
      'modules.7.lessons.3.summaryIt', 'modules.8.lessons.5.summaryIt',
      'modules.9.lessons.1.quickChecks.1.qIt', 'official_syllabus.items.11.title_it',
      'official_syllabus.items.20.title_it', 'official_syllabus.items.7.title_it',
    ],
  },
  simbolo: {
    questionTokens: 70, questionRecords: 70, uniqueItalianTexts: 61, uniquePairedTexts: 68,
    questionIdFingerprint: 'a0078285200b6327f220c92ea149cfaabdaa50e52d5148a443d7e0d40ecdab41',
    lessonTokensPerFile: 2,
    currentLessonPaths: ['modules.1.caveats_it.2', 'modules.6.objectives_it.4'],
  },
  intende: {
    questionTokens: 63, questionRecords: 63, uniqueItalianTexts: 63, uniquePairedTexts: 63,
    questionIdFingerprint: 'a2d2c70d321bced2f79b03957a5671d19df7860db173f9738aad995401dd3351',
    lessonTokensPerFile: 0, currentLessonPaths: [],
  },
  maggiore: {
    questionTokens: 61, questionRecords: 61, uniqueItalianTexts: 60, uniquePairedTexts: 61,
    questionIdFingerprint: '0f9d5dbdcf2a470ca2dfb93810f98145088d2873f5eea67a88c9194e469869ef',
    lessonTokensPerFile: 2,
    currentLessonPaths: ['modules.4.lessons.2.quickChecks.1.qIt', 'modules.8.lessons.4.quickChecks.1.qIt'],
  },
  situazione: {
    questionTokens: 56, questionRecords: 56, uniqueItalianTexts: 56, uniquePairedTexts: 56,
    questionIdFingerprint: 'f67ecf5c9c877dbdcc250ebe37cbbf7892e604467b0c4471920b8a2a893411d7',
    lessonTokensPerFile: 3,
    currentLessonPaths: ['modules.5.quiz.1.prompt_it', 'modules.7.lessons.3.quickChecks.1.qIt', 'modules.8.quiz.2.explanation_it'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 42 terms were not previously named in dictionary audit notes or tests', () => {
  const noteDir = path.join(ROOT, 'docs');
  const testDir = path.join(ROOT, 'tests');
  const previousNotes = fs.readdirSync(noteDir).filter(name => {
    const match = name.match(/batch[-_]?(\d+)/iu);
    return name.endsWith('.md') && match && Number(match[1]) < 42;
  });
  const previousTests = fs.readdirSync(testDir).filter(name => {
    const match = name.match(/^batch(\d+)-.*\.test\.cjs$/u);
    return match && Number(match[1]) < 42;
  });
  previousTests.push('v40-dictionary-app.test.cjs');
  for (const term of Object.keys(expected)) {
    const reference = new RegExp(`(?:\\b${escaped(term)}\\s*:|['"]${escaped(term)}['"]|\\x60${escaped(term)}\\x60)`, 'iu');
    for (const file of [...previousNotes.map(name => path.join(noteDir, name)), ...previousTests.map(name => path.join(testDir, name))]) {
      assert.ok(fs.existsSync(file), `prior audit file exists: ${file}`);
      assert.doesNotMatch(fs.readFileSync(file, 'utf8'), reference, `${term} must not repeat prior coverage in ${path.basename(file)}`);
    }
  }
});

test('batch 42 pins question occurrences and paired Arabic by ID', () => {
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

test('batch 42 scans all Italian-designated lesson fields in both schemas', () => {
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

test('batch 42 applies only the supported simbolo confirmation and keeps other four entries flagged', () => {
  const confirmed = entries.get('simbolo');
  assert.ok(confirmed, 'simbolo dictionary row exists');
  assert.equal(confirmed.translation_ar, 'رمز');
  assert.equal(confirmed.translation_kind, 'contextual_translation');
  assert.equal(confirmed.status, 'reviewed_override');
  assert.equal(confirmed.provider, 'project-contextual-audit');
  assert.equal(confirmed.review_required, 0);
  assert.equal(confirmed.ui_fallback_ar, 'رمز');
  assert.match(confirmed.source, /question-bank-context-confirmation-2026-11/u);
  assert.match(confirmed.source, /Treccani.*Reverso Context Italiano-Arabo.*ACI Codice della Strada/u);
  assert.match(confirmed.note, /Project-reviewed, not owner-approved\./u);
  assert.match(confirmed.note, /universal translation for legal signs/u);

  const unresolved = {
    persone: 'الناس',
    intende: 'تعني',
    maggiore: 'أكبر',
    situazione: 'الحالة',
  };
  for (const [term, translation] of Object.entries(unresolved)) {
    const row = entries.get(term);
    assert.ok(row, `${term} dictionary row exists`);
    assert.equal(row.translation_ar, translation, `${term} original gloss retained`);
    assert.equal(row.translation_kind, 'machine_translation', `${term} stays a machine draft`);
    assert.equal(row.status, 'machine_draft_needs_review', `${term} stays flagged`);
    assert.equal(row.provider, 'opus-mt-local');
    assert.equal(row.review_required, 1, `${term} review flag remains`);
    assert.equal(row.ui_fallback_ar, '');
  }
});

test('batch 42 memo cites directly opened sources, corrects the full lesson count, and disclaims device testing', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch42-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/persona/',
    'https://www.aci.it/fileadmin/cds/art-169.php',
    'https://dictionary.cambridge.org/translate/italian-arabic/',
    'https://www.treccani.it/vocabolario/simbolo/',
    'https://context.reverso.net/traduzione/italiano-arabo/simbolo',
    'https://aci.gov.it/codice-della-strada/art-38/',
    'https://www.treccani.it/vocabolario/intendere/',
    'https://context.reverso.net/translation/italian-arabic/intende',
    'https://aci.gov.it/codice-della-strada/art-154/',
    'https://www.treccani.it/vocabolario/maggiore/',
    'https://context.reverso.net/traduzione/italiano-arabo/maggiore',
    'https://www.treccani.it/vocabolario/situazione/',
    'https://context.reverso.net/translation/italian-arabic/situazione',
    'https://aci.gov.it/codice-della-strada/art-141/',
    'https://aci.gov.it/approfondimento/il-codice-della-strada/',
    'https://www.treccani.it/vocabolario/situazione_(Sinonimi-e-Contrari)/',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /خمسة مداخل/u);
  assert.match(note, /10 \/ 10/u);
  assert.match(note, /ليست موافقة مالك التطبيق/u);
  assert.match(note, /لم يُجر اختبار Android على جهاز/u);
});

test('batch 42 pins cumulative generated outputs and unchanged question/lesson inputs', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5067);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 91);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 95);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5025,
    reviewed_override: 269,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5067);
  const database = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/dictionary.db'));
  const dictionaryBytes = fs.readFileSync(path.join(ROOT, 'data/italian_arabic_dictionary_lookup.json'));
  const bundle = fs.readFileSync(path.join(ROOT, 'public/app.bundle.js'));
  const releaseBytes = fs.readFileSync(path.join(ROOT, 'public/release.json'));
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(sha256(database), 'd75c7cc21ad5d9e274504555864ad9eea27b0e7ddc43216f24c69abf44b0a2d7');
  assert.equal(sha256(dictionaryBytes), '18ed21680c7b67d92392467dd619aa434b583d26e566aab35e8c3f00d607ff30');
  assert.equal(sha256(bundle), 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685');
  assert.equal(sha256(releaseBytes), '11d3fd9970513e1c89590742faf16abdbbf0e88cf560fae8301e01263cdbbfb6');
  assert.equal(release.dictionarySha256, sha256(dictionaryBytes));
  assert.equal(release.bundleSha256, sha256(bundle));
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
});
