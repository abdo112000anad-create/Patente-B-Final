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
const entries = new Map(dictionary.entries.map(row => [row.word.toLocaleLowerCase('it'), row]));
const questionsAr = json('data/questions.json').questions;
const questionsIt = json('data/questions.it.json').questions;
const arabicById = new Map(questionsAr.map(row => [String(row.id), row]));
const terms = ['figura', 'senso', 'solo', 'secondo', 'corsie'];

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenMatches(text, term) {
  const normalized = String(text || '').normalize('NFC');
  const expression = new RegExp(`(?<![\\p{L}\\p{M}])${escaped(term.normalize('NFC'))}(?![\\p{L}\\p{M}])`, 'giu');
  return [...normalized.matchAll(expression)].length;
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
    assert.equal(paired.ar, question.ar, `Arabic text differs for question ${question.id}`);
    ids.push(String(question.id));
    italianTexts.add(question.it);
    pairedTexts.add(`${question.it}\u0000${question.ar}`);
  }
  return {
    tokenOccurrences,
    ids: ids.sort(),
    uniqueItalianTexts: italianTexts.size,
    uniquePairedTexts: pairedTexts.size,
  };
}

function lessonCounts(relative, term) {
  const root = json(relative);
  let occurrences = 0;
  const ids = [];

  function scan(value, count) {
    if (Array.isArray(value)) {
      for (const item of value) scan(item, count);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) {
        if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
          count.value += tokenMatches(child, term);
        } else {
          scan(child, count);
        }
      }
    }
  }

  for (const module of root.modules || []) {
    for (const lesson of module.lessons || []) {
      const count = { value: 0 };
      scan(lesson, count);
      occurrences += count.value;
      if (count.value) ids.push(String(lesson.id));
    }
  }
  return { occurrences, ids: ids.sort() };
}

const expected = {
  figura: {
    questionTokens: 1014,
    questionRecords: 1012,
    uniqueItalianTexts: 997,
    uniquePairedTexts: 1006,
    questionIdFingerprint: '0eea7f52b7c57c585eff29b559165a0d7792bec5eb62c17a21e6ff8b34b4a840',
    lessonTokens: 0,
    lessonIds: [],
  },
  senso: {
    questionTokens: 333,
    questionRecords: 317,
    uniqueItalianTexts: 310,
    uniquePairedTexts: 315,
    questionIdFingerprint: '0fd5179cb77ba738e5924f7fc28f6871712539cc8c0a82f8242a736dcba5f66d',
    lessonTokens: 1,
    lessonIds: ['u6-l4'],
  },
  solo: {
    questionTokens: 240,
    questionRecords: 240,
    uniqueItalianTexts: 236,
    uniquePairedTexts: 239,
    questionIdFingerprint: '0113049efaf1f7aa820f2351e9bfc6a8c591085469a59ecaec1eec6c90df1b23',
    lessonTokens: 8,
    lessonIds: ['u4-l1', 'u4-l2', 'u5-l1', 'u5-l2', 'u5-l4', 'u6-l5'],
  },
  secondo: {
    questionTokens: 156,
    questionRecords: 154,
    uniqueItalianTexts: 150,
    uniquePairedTexts: 154,
    questionIdFingerprint: '5d96afdb2a03435284c61c7ea9f8e41b401192079eb24932d0b353a4c335ccbb',
    lessonTokens: 2,
    lessonIds: ['u7-l4', 'u7-l5'],
  },
  corsie: {
    questionTokens: 156,
    questionRecords: 153,
    uniqueItalianTexts: 151,
    uniquePairedTexts: 151,
    questionIdFingerprint: '008f8e79f32e45c36097afc649e48e2dcdc4bd05251eb2c095899e65492058d8',
    lessonTokens: 8,
    lessonIds: ['u1-l1', 'u4-l4', 'u6-l4', 'u6-l5'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 29 pins all exact question occurrences and validates every Arabic pair and answer key', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} distinct paired question records`);
    assert.equal(actual.uniqueItalianTexts, expectedTerm.uniqueItalianTexts, `${term} unique Italian contexts`);
    assert.equal(actual.uniquePairedTexts, expectedTerm.uniquePairedTexts, `${term} unique Italian-Arabic context pairs`);
    assert.equal(sha256(actual.ids.join('\n')), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 29 pins complete Italian lesson coverage in current and legacy files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons.json', 'data/lessons-v2.json']) {
      const actual = lessonCounts(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokens, `${term} lesson-token count in ${relative}`);
      assert.deepEqual(actual.ids, expectedTerm.lessonIds, `${term} exact lesson IDs in ${relative}`);
    }
  }
});

test('batch 29 keeps all five unresolved dictionary entries flagged without promoting a fallback', () => {
  const expectedDrafts = {
    figura: 'صورة',
    senso: 'معنى',
    solo: 'فقط',
    secondo: 'ثانية',
    corsie: 'المسارات',
  };
  for (const [term, translation] of Object.entries(expectedDrafts)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} machine-draft gloss remains unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no promoted UI fallback`);
    assert.equal(row.translation_kind, 'machine_translation', `${term} retains machine-translation kind`);
    assert.equal(row.status, 'machine_draft_needs_review', `${term} remains a draft`);
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local', `${term} retains provider provenance`);
    assert.equal(row.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4', `${term} retains source provenance`);
  }
});

test('batch 29 audit note records the directly opened sources, ambiguity decisions, and coverage discrepancy', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch29-2026-11-27.md'), 'utf8');
  const sources = [
    'https://dizionario.reverso.net/italiano-arabo/figura',
    'https://www.treccani.it/vocabolario/figura/',
    'https://aci.gov.it/codice-della-strada/art-39/',
    'https://it.glosbe.com/it/ar/senso',
    'https://www.treccani.it/vocabolario/senso/',
    'https://aci.gov.it/codice-della-strada/art-157/',
    'https://dizionario.internazionale.it/parola/senso-unico',
    'https://context.reverso.net/traduzione/italiano-arabo/a+senso+unico',
    'https://dizionario.reverso.net/italiano-arabo/solo',
    'https://it.glosbe.com/it/ar/solo',
    'https://www.treccani.it/vocabolario/solo/',
    'https://accademiadellacrusca.it/it/consulenza/solo-e-soltanto-e-solamente-nellitaliano-contemporaneo/48004',
    'https://aci.gov.it/codice-della-strada/art-7/',
    'https://dizionario.reverso.net/italiano-arabo/secondo',
    'https://dizionario.reverso.net/italiano-arabo/secondo+incrocio',
    'https://www.treccani.it/vocabolario/secondo1/',
    'https://aci.gov.it/codice-della-strada/art-145/',
    'https://aci.gov.it/codice-della-strada/art-141/',
    'https://context.reverso.net/traduzione/italiano-arabo/corsia',
    'https://aci.gov.it/codice-della-strada/art-3/',
    'https://www.treccani.it/vocabolario/corsia/',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /Q24962/u);
  assert.match(note, /Q22268/u);
  assert.match(note, /159\/156/u);
  assert.match(note, /لم يُجرَ اختبار Android/u);
});

test('batch 29 pins unchanged question/lesson inputs and dictionary entry count', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5079);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
