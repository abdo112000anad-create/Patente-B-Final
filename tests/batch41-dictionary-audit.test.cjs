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
  quadricicli: {
    questionTokens: 40, questionRecords: 40, uniqueItalianTexts: 38, uniquePairedTexts: 39,
    questionIdFingerprint: 'a968e35fb87078c57244cd261db725ce82a835f52b8d7743eb5eff6bfc06ba1e',
    lessonTokensPerFile: 0, currentLessonPaths: [],
  },
  tram: {
    questionTokens: 51, questionRecords: 50, uniqueItalianTexts: 50, uniquePairedTexts: 50,
    questionIdFingerprint: '7965ba5b3df1eb7e861c70501ceff8f9b209a9dfa3f297881c32f9c966b109e3',
    lessonTokensPerFile: 0, currentLessonPaths: [],
  },
  polizia: {
    questionTokens: 51, questionRecords: 50, uniqueItalianTexts: 49, uniquePairedTexts: 50,
    questionIdFingerprint: '6b7f735459bdf48c7e0d84739a4093fa8ef05f3fecdeb9fadc47baf1c113a52b',
    lessonTokensPerFile: 1, currentLessonPaths: ['modules.1.quiz.2.explanation_it'],
  },
  passeggeri: {
    questionTokens: 37, questionRecords: 37, uniqueItalianTexts: 37, uniquePairedTexts: 37,
    questionIdFingerprint: 'a5111b3c8a4de8b6fb854188f40cb4d924ba26dee0714bbda12a56531ef65295',
    lessonTokensPerFile: 6,
    currentLessonPaths: [
      'modules.6.lessons.4.quickChecks.2.qIt', 'modules.10.intro_it', 'modules.10.objectives_it.1',
      'modules.10.lessons.4.titleIt', 'modules.10.lessons.4.summaryIt', 'modules.10.lessons.4.quickChecks.2.qIt',
    ],
  },
  colore: {
    questionTokens: 70, questionRecords: 70, uniqueItalianTexts: 66, uniquePairedTexts: 69,
    questionIdFingerprint: '13edbadedeeefaeb16de1fb5ab9c79d3a355495cb8101f25fd66849440e7a301',
    lessonTokensPerFile: 0, currentLessonPaths: [],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 41 entries were not named in previous dictionary audit notes or tests', () => {
  const noteDir = path.join(ROOT, 'docs');
  const testDir = path.join(ROOT, 'tests');
  const previousNotes = fs.readdirSync(noteDir).filter(name => {
    const match = name.match(/batch[-_]?(\d+)/iu);
    return name.endsWith('.md') && match && Number(match[1]) < 41;
  });
  const previousTests = fs.readdirSync(testDir).filter(name => {
    const match = name.match(/^batch(\d+)-.*\.test\.cjs$/u);
    return match && Number(match[1]) < 41;
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

test('batch 41 pins question occurrences, unique contexts, and paired Arabic by ID', () => {
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

test('batch 41 scans all Italian-designated lesson fields and arrays in both schemas', () => {
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

test('batch 41 applies only source-supported contextual decisions and records the remaining quadricycle terminology gap', () => {
  const expectedRows = {
    quadricicli: { translation: 'مركبات رباعية العجلات', kind: 'contextual_translation', status: 'reviewed_override', provider: 'project-contextual-audit', review: 0, fallback: 'مركبات رباعية العجلات' },
    tram: { translation: 'الترام', kind: 'contextual_translation', status: 'reviewed_override', provider: 'project-contextual-audit', review: 0, fallback: 'الترام' },
    polizia: { translation: 'الشرطة', kind: 'contextual_translation', status: 'reviewed_override', provider: 'project-contextual-audit', review: 0, fallback: 'الشرطة' },
    passeggeri: { translation: 'الركاب', kind: 'contextual_translation', status: 'reviewed_override', provider: 'project-contextual-audit', review: 0, fallback: 'الركاب' },
    colore: { translation: 'اللون', kind: 'contextual_translation', status: 'reviewed_override', provider: 'project-contextual-audit', review: 0, fallback: 'اللون' },
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
    assert.match(row.note, /Project-reviewed, not owner-approved\./u, `${term} review provenance`);
  }
  assert.match(entries.get('quadricicli').source, /Treccani, quadriciclo.*ACI Codice della Strada, art\. 47.*Reverso/u);
  assert.match(entries.get('quadricicli').note, /no standardized official Arabic equivalent was established/u);
  for (const term of ['tram', 'polizia', 'passeggeri', 'colore']) assert.match(entries.get(term).source, /question-bank-context-confirmation-2026-11/u);
  assert.match(entries.get('colore').note, /not as a universal translation/u);
});

test('batch 41 memo cites direct sources, records source limitations, and makes no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch41-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/quadriciclo/',
    'https://aci.gov.it/codice-della-strada/art-47/',
    'https://dizionario.reverso.net/italiano-arabo/quadriciclo',
    'https://www.treccani.it/vocabolario/tram/',
    'https://aci.gov.it/codice-della-strada/art-148/',
    'https://www.unescwa.org/ar/sd-glossary/',
    'https://www.treccani.it/vocabolario/polizia/',
    'https://www.arabdict.com/it/italian-arabic/polizia',
    'https://aci.gov.it/codice-della-strada/art-38/',
    'https://www.treccani.it/vocabolario/passeggero/',
    'https://dizionario.reverso.net/italiano-arabo/passeggeri',
    'https://www.treccani.it/vocabolario/colore/',
    'https://aci.gov.it/codice-della-strada/art-39/',
    'https://glosbe.com/it/ar/colore',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /لم يُعثر على معيار عربي رسمي موحد/u);
  assert.match(note, /ليست موافقة من مالك التطبيق/u);
});

test('batch 41 pins aggregate counts, generated assets, and unchanged question/lesson sources', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5079);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 83);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 91);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5037,
    reviewed_override: 257,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5079);
  const database = fs.readFileSync(path.join(ROOT, 'android/app/src/main/assets/dictionary.db'));
  const dictionaryBytes = fs.readFileSync(path.join(ROOT, 'data/italian_arabic_dictionary_lookup.json'));
  const bundle = fs.readFileSync(path.join(ROOT, 'public/app.bundle.js'));
  const releaseBytes = fs.readFileSync(path.join(ROOT, 'public/release.json'));
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(sha256(database), '4e26121dc56a33ed42657eff774c6ab038c9209377935e763e20fdd8bb39dd38');
  assert.equal(sha256(dictionaryBytes), '8cdb7edeee6eeb1baacc258a056d3832f4022e76c872f717b709cbd1c3d0ff6d');
  assert.equal(sha256(bundle), 'e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685');
  assert.equal(sha256(releaseBytes), '2596edb3e1bda2498f237f918b9be18ea062cb0f9929f58f831f730e5495d81c');
  assert.equal(release.dictionarySha256, sha256(dictionaryBytes));
  assert.equal(release.bundleSha256, sha256(bundle));
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
});
