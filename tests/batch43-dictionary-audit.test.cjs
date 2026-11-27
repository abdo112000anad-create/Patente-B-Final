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
  prescrizione: {
    questionTokens: 38, questionRecords: 38, uniqueItalianTexts: 13, uniquePairedTexts: 29,
    questionIdFingerprint: 'a5bea411810a87bf5dae3224d3814b30aba09f6e3f08b705f8f7ad2a0b5091be',
    lessonTokensPerFile: 7,
  },
  danni: {
    questionTokens: 45, questionRecords: 42, uniqueItalianTexts: 42, uniquePairedTexts: 42,
    questionIdFingerprint: 'c09ef0424a632bbb6b02c1db2265598258323589f0c3fd6123857de7829ff411',
    lessonTokensPerFile: 1,
  },
  intralcio: {
    questionTokens: 38, questionRecords: 38, uniqueItalianTexts: 38, uniquePairedTexts: 38,
    questionIdFingerprint: 'bcea78b037201ef028b12532479eb0ce592c56180ce6c275559359544b540fdd',
    lessonTokensPerFile: 0,
  },
  infortunato: {
    questionTokens: 39, questionRecords: 38, uniqueItalianTexts: 38, uniquePairedTexts: 38,
    questionIdFingerprint: '081a55bb4015dc84756d2347281ecf4cd150c1857d35a7f35c83dd9d0722026b',
    lessonTokensPerFile: 0,
  },
  posizione: {
    questionTokens: 44, questionRecords: 44, uniqueItalianTexts: 44, uniquePairedTexts: 44,
    questionIdFingerprint: 'f84a210f7902eed35edcc2847d24920815213f4c41af5ecd93a487f3cee474b7',
    lessonTokensPerFile: 6,
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

const priorForms = {
  prescrizione: ['prescrizione', 'prescrizioni'],
  danni: ['danno', 'danni'],
  intralcio: ['intralcio', 'intralci', 'intralciare', 'intralciato', 'intralciata', 'intralciati', 'intralciate'],
  infortunato: ['infortunato', 'infortunata', 'infortunati', 'infortunate', 'infortunarsi', 'infortuni'],
  posizione: ['posizione', 'posizioni'],
};

test('batch 43 terms and stated inflections were not covered by earlier audit notes or tests', () => {
  const noteDir = path.join(ROOT, 'docs');
  const testDir = path.join(ROOT, 'tests');
  const previousNotes = fs.readdirSync(noteDir).filter(name => {
    const match = name.match(/batch[-_]?(\d+)/iu);
    return name.endsWith('.md') && match && Number(match[1]) < 43;
  });
  const previousTests = fs.readdirSync(testDir).filter(name => {
    const match = name.match(/^batch(\d+)-.*\.test\.cjs$/u);
    return match && Number(match[1]) < 43;
  });
  previousTests.push('v40-dictionary-app.test.cjs');
  const files = [...previousNotes.map(name => path.join(noteDir, name)), ...previousTests.map(name => path.join(testDir, name))];
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

test('batch 43 pins question-token totals and pairs Arabic questions by ID', () => {
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

test('batch 43 counts all Italian-designated lesson fields in current and legacy files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons-v2.json', 'data/lessons.json']) {
      const matches = [];
      const occurrences = italianFieldMatches(json(relative), term, [], false, matches);
      assert.equal(occurrences, expectedTerm.lessonTokensPerFile, `${term} lesson-field occurrences in ${relative}`);
      assert.equal(matches.reduce((total, item) => total + item.count, 0), expectedTerm.lessonTokensPerFile, `${term} exact Italian lesson paths in ${relative}`);
    }
  }
});

test('batch 43 applies only two source-supported corrections, confirms one gloss, and leaves two ambiguous entries flagged', () => {
  const resolved = {
    prescrizione: 'وصفة طبية؛ تعليمات أو قيود مرورية ملزمة',
    danni: 'أضرار',
    infortunato: 'مصاب',
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
  assert.match(entries.get('prescrizione').source, /Treccani.*ACI Codice della Strada, art\. 39/u);
  assert.match(entries.get('danni').source, /Arabita.*Reverso Italian-Arabic/u);
  assert.match(entries.get('infortunato').source, /Treccani.*Arabdict.*Reverso Context/u);
  assert.match(entries.get('prescrizione').note, /medical prescriptions.*traffic use/u);
  assert.match(entries.get('danni').note, /singular machine gloss/u);
  assert.match(entries.get('infortunato').note, /injured road user/u);

  const unresolved = { intralcio: 'عرقلة', posizione: 'الموقع' };
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

test('batch 43 audit note cites the opened sources and records the two unresolved sense gaps', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch43-2026-11-27.md'), 'utf8');
  for (const source of [
    'https://www.treccani.it/vocabolario/prescrizione/',
    'https://aci.gov.it/codice-della-strada/art-39/',
    'https://www.treccani.it/vocabolario/danno/',
    'https://arabita.news/dizionario/1663',
    'https://dizionario.reverso.net/italiano-arabo/danno',
    'https://www.treccani.it/vocabolario/intralcio/',
    'https://www.normattiva.it/uri/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285~art157!vig=',
    'https://www.treccani.it/vocabolario/infortunato_%28Sinonimi-e-Contrari%29/',
    'https://www.arabdict.com/en/italian-arabic/infortunato',
    'https://context.reverso.net/traduzione/italiano-arabo/infortunato',
    'https://www.treccani.it/vocabolario/posizione/',
    'https://dizionario.internazionale.it/parola/posizione',
    'https://aci.gov.it/codice-della-strada/art-143/',
    'https://aci.gov.it/codice-della-strada/art-153/',
  ]) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /معلّمين/u);
  assert.match(note, /ليست موافقة مالك التطبيق/u);
  assert.match(note, /لم يُجر اختبار Android على جهاز/u);
});

test('batch 43 pins cumulative dictionary counts and unchanged question/lesson inputs', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5071);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 88);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 94);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5029,
    reviewed_override: 265,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5071);
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
