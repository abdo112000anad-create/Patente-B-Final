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
  ridurre: {
    questionTokens: 46, questionRecords: 46, uniqueItalianTexts: 46, uniquePairedTexts: 46,
    questionIdFingerprint: 'da85a6d8992d685811c3e2d1ec21dba5f661cd95da259e41c4bf0c8310ba69ef',
    lessonTokensPerFile: 8,
  },
  aumenta: {
    questionTokens: 44, questionRecords: 43, uniqueItalianTexts: 41, uniquePairedTexts: 41,
    questionIdFingerprint: '1fb89d58a0cb4a7e1e97be0aa5a9e87963e78cc89b4b351826c2fa2e7d972bab',
    lessonTokensPerFile: 2,
  },
  principali: {
    questionTokens: 80, questionRecords: 80, uniqueItalianTexts: 80, uniquePairedTexts: 80,
    questionIdFingerprint: '4bae752d1c957b999eaf4be456509738b4571179eb5aa0a1753ebf12d432f0da',
    lessonTokensPerFile: 9,
  },
  provenienti: {
    questionTokens: 47, questionRecords: 46, uniqueItalianTexts: 45, uniquePairedTexts: 46,
    questionIdFingerprint: 'a1b8191835613761de838bb8bd98a55146ddca972bd5bd2a63baeaa9a0528192',
    lessonTokensPerFile: 0,
  },
  forte: {
    questionTokens: 44, questionRecords: 44, uniqueItalianTexts: 43, uniquePairedTexts: 43,
    questionIdFingerprint: '999bc8a70c2d8d4f9de1377d32baf97aa941710c051efed0eb9b851a22656e8c',
    lessonTokensPerFile: 1,
  },
};

const priorForms = {
  ridurre: ['ridurre', 'riduce', 'riducono', 'ridotto', 'ridotta', 'ridotti', 'ridotte', 'riducendo'],
  aumenta: ['aumenta', 'aumentano', 'aumentare', 'aumentato', 'aumentata', 'aumentati', 'aumentate', 'aumentando', 'aumento'],
  principali: ['principale', 'principali'],
  provenienti: ['proveniente', 'provenienti', 'proveniva', 'proviene', 'provengono', 'provenire', 'provenienza'],
  forte: ['forte', 'forti'],
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 44 terms and stated inflections are not repeated in earlier audit notes or tests', () => {
  const noteDir = path.join(ROOT, 'docs');
  const testDir = path.join(ROOT, 'tests');
  const previousNotes = fs.readdirSync(noteDir).filter(name => {
    const match = name.match(/batch[-_]?([0-9]+)/iu);
    return name.endsWith('.md') && match && Number(match[1]) < 44;
  });
  const previousTests = fs.readdirSync(testDir).filter(name => {
    const match = name.match(/^batch([0-9]+)-.*\.test\.cjs$/u);
    return match && Number(match[1]) < 44;
  });
  previousTests.push('v40-dictionary-app.test.cjs');
  const files = [...new Set([...previousNotes.map(name => path.join(noteDir, name)), ...previousTests.map(name => path.join(testDir, name))])];
  assert.equal(files.length, 58, 'all 58 earlier audit notes/tests are included');
  for (const [term, forms] of Object.entries(priorForms)) {
    for (const file of files) {
      assert.ok(fs.existsSync(file), `prior audit file exists: ${file}`);
      const contents = fs.readFileSync(file, 'utf8').normalize('NFC');
      for (const form of forms) {
        const reference = new RegExp(`(?<![\\p{L}\\p{M}])${escaped(form)}(?![\\p{L}\\p{M}])`, 'iu');
        assert.doesNotMatch(contents, reference, `${term}/${form} must not repeat coverage in ${path.basename(file)}`);
      }
    }
  }
});

test('batch 44 pins exact question-token totals and verifies Arabic pairs by ID', () => {
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

test('batch 44 counts all Italian-designated lesson fields in current and legacy files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons-v2.json', 'data/lessons.json']) {
      const matches = [];
      const occurrences = italianFieldMatches(json(relative), term, [], false, matches);
      assert.equal(occurrences, expectedTerm.lessonTokensPerFile, `${term} lesson-field occurrences in ${relative}`);
      assert.equal(matches.reduce((total, item) => total + item.count, 0), expectedTerm.lessonTokensPerFile, `${term} exact Italian lesson paths in ${relative}`);
    }
  }
});

test('batch 44 applies three supported corrections, confirms one gloss, and leaves forte flagged', () => {
  const resolved = {
    ridurre: 'يقلّل / يخفض',
    aumenta: 'يزيد / تزداد (بحسب الفاعل)',
    principali: 'رئيسية',
    provenienti: 'قادم',
  };
  for (const [term, translation] of Object.entries(resolved)) {
    const row = entries.get(term);
    assert.ok(row, `${term} dictionary row exists`);
    assert.equal(row.translation_ar, translation, `${term} translation`);
    assert.equal(row.translation_kind, 'contextual_translation', `${term} translation kind`);
    assert.equal(row.status, 'reviewed_override', `${term} status`);
    assert.equal(row.provider, 'project-contextual-audit', `${term} provenance`);
    assert.equal(row.review_required, 0, `${term} review flag`);
    assert.equal(row.ui_fallback_ar, translation, `${term} fallback`);
    assert.match(row.source, /question-bank-context-(?:audit|confirmation)-2026-11/u);
    assert.match(row.note, /Project-reviewed, not owner-approved\./u);
  }
  for (const term of ['ridurre', 'aumenta', 'principali']) {
    assert.match(entries.get(term).source, /question-bank-context-audit-2026-11;/u, `${term} correction source prefix`);
  }
  assert.match(entries.get('ridurre').source, /Treccani.*De Mauro.*Arabdict/u);
  assert.match(entries.get('aumenta').source, /Treccani.*Reverso.*Cambridge/u);
  assert.match(entries.get('principali').source, /Treccani.*ACI Codice della Strada, art\. 2.*Glosbe.*Arabdict/u);
  assert.match(entries.get('provenienti').source, /question-bank-context-confirmation-2026-11;/u);
  assert.match(entries.get('provenienti').source, /Treccani.*De Mauro.*Reverso/u);
  assert.match(entries.get('provenienti').note, /gender and number.*القادمة/u);

  const forte = entries.get('forte');
  assert.ok(forte, 'forte dictionary row exists');
  assert.equal(forte.translation_ar, 'قوي', 'forte machine gloss retained');
  assert.equal(forte.translation_kind, 'machine_translation');
  assert.equal(forte.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
  assert.equal(forte.provider, 'opus-mt-local');
  assert.equal(forte.status, 'machine_draft_needs_review');
  assert.equal(forte.review_required, 1);
  assert.equal(forte.ui_fallback_ar, '');
});

test('batch 44 audit note includes all opened-source links and documents scope limits', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch44-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/ridurre/',
    'https://dizionario.internazionale.it/parola/ridurre',
    'https://www.arabdict.com/it/italian-arabic/ridurre',
    'https://www.treccani.it/vocabolario/aumentare/',
    'https://dizionario.reverso.net/arabo-italiano/%D9%8A%D8%B2%D9%8A%D8%AF',
    'https://dictionary.cambridge.org/dictionary/english-arabic/increase',
    'https://www.treccani.it/vocabolario/principale/',
    'https://aci.gov.it/codice-della-strada/art-2/',
    'https://it.glosbe.com/arz/it/%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A',
    'https://www.arabdict.com/it/italian-arabic/%D9%85%D9%81%D8%AA%D8%A7%D8%AD%20%D8%A7%D9%84%D8%A5%D8%B6%D8%A7%D8%A1%D8%A9%20%D8%A7%D9%84%D8%B1%D8%A6%D9%8A%D8%B3%D9%8A',
    'https://www.treccani.it/vocabolario/provenire/',
    'https://dizionario.internazionale.it/parola/provenienza',
    'https://context.reverso.net/traduzione/italiano-arabo/proveniente',
    'https://www.treccani.it/vocabolario/forte1/',
    'https://dizionario.internazionale.it/parola/forte',
    'https://ar.glosbe.com/it/ar/forte',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /لا تدعي هذه المراجعة معيارًا عربيًا قانونيًا/u);
  assert.match(note, /بقي `forte` معلّمًا للمراجعة/u);
  assert.match(note, /ليست موافقة مالك التطبيق/u);
  assert.match(note, /لم يُجر اختبار Android على جهاز/u);
});

test('batch 44 pins cumulative dictionary metadata and protects question/lesson sources', () => {
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
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
  const dictionaryBytes = fs.readFileSync(path.join(ROOT, 'data/italian_arabic_dictionary_lookup.json'));
  const bundle = fs.readFileSync(path.join(ROOT, 'public/app.bundle.js'));
  const releaseBytes = fs.readFileSync(path.join(ROOT, 'public/release.json'));
  const release = JSON.parse(releaseBytes.toString('utf8'));
  assert.equal(release.dictionarySha256, sha256(dictionaryBytes));
  assert.equal(release.bundleSha256, sha256(bundle));
});
