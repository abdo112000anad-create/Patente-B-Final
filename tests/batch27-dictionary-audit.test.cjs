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
const terms = ['segnale', 'raffigurato', 'rappresentato', 'posto', 'strade'];

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
  }
  return { tokenOccurrences, ids: ids.sort() };
}

function lessonCounts(relative, term) {
  const root = json(relative);
  let occurrences = 0;
  const ids = [];

  function scan(value, key, count) {
    if (Array.isArray(value)) {
      for (const item of value) scan(item, '', count);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) {
        if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
          count.value += tokenMatches(child, term);
        } else {
          scan(child, childKey, count);
        }
      }
    }
  }

  for (const module of root.modules || []) {
    for (const lesson of module.lessons || []) {
      const count = { value: 0 };
      scan(lesson, '', count);
      occurrences += count.value;
      if (count.value) ids.push(String(lesson.id));
    }
  }
  return { occurrences, ids: ids.sort() };
}

const expected = {
  segnale: {
    questionTokens: 2845,
    questionRecords: 2678,
    questionIdFingerprint: '77ef3a36761216dfe73ed11f16cbecf7bd66ebd93df0cc5e55f345b627d0b723',
    lessonTokens: 19,
    lessonIds: ['u11-l4', 'u2-l2', 'u2-l3', 'u2-l4', 'u3-l3', 'u4-l1'],
  },
  raffigurato: {
    questionTokens: 2779,
    questionRecords: 2779,
    questionIdFingerprint: '6a7e676bc55ff2e5d4b0ca7889972f04bf90f8879af861c8704dd9f8456226e0',
    lessonTokens: 0,
    lessonIds: [],
  },
  rappresentato: {
    questionTokens: 336,
    questionRecords: 336,
    questionIdFingerprint: 'ee94de63e32686d4c6e9b12503567a0f0067c83140815949a08744e9c554b75c',
    lessonTokens: 0,
    lessonIds: [],
  },
  posto: {
    questionTokens: 328,
    questionRecords: 328,
    questionIdFingerprint: 'c51dd4095777d6691bd850ce22e3f9e6a6ac0d3849d96826016d0ed4cc19f9ea',
    lessonTokens: 0,
    lessonIds: [],
  },
  strade: {
    questionTokens: 290,
    questionRecords: 290,
    questionIdFingerprint: 'fbb996afbb7095ec92f1703b859f36ed9b2df51a60e24b065cf670a9a3aa6416',
    lessonTokens: 3,
    lessonIds: ['u6-l5'],
  },
};

const unresolved = {
  segnale: 'إشارة',
  raffigurato: 'مُصوّر',
  rappresentato: 'ممثّل',
  posto: 'المكان',
  strade: 'الشوارع',
};

const questionHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
};

const lessonHashes = {
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

const untouchedOutputHashes = {
  'data/italian_arabic_dictionary_lookup.json': '71e4f3ee67d5184bc539107de45822e8dd84e211b767c7d1e2d21208a1d78390',
  'android/app/src/main/assets/dictionary.db': 'bc8bd73b86a4c12c8ae55b679095c1470c5d82c654feb3f91db9832ebfc4a98e',
};

test('batch 27 pins every exact question context, token count, and paired record', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} distinct question contexts`);
    assert.equal(sha256(actual.ids.join('\n')), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 27 exhaustively scans Italian lesson text in legacy and canonical files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons.json', 'data/lessons-v2.json']) {
      const actual = lessonCounts(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokens, `${term} tokens in ${relative}`);
      assert.deepEqual(actual.ids, expectedTerm.lessonIds, `${term} exact lesson records in ${relative}`);
    }
  }
});

test('batch 27 keeps all five ambiguous entries as unchanged machine drafts', () => {
  assert.deepEqual(Object.keys(unresolved).sort(), terms.slice().sort());
  for (const [term, translation] of Object.entries(unresolved)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} draft remains unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no promoted UI fallback`);
    assert.equal(row.translation_kind, 'machine_translation', `${term} stays machine-generated`);
    assert.equal(row.status, 'machine_draft_needs_review', `${term} remains a draft`);
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local', `${term} retains original provider provenance`);
    assert.equal(row.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4', `${term} retains original source provenance`);
  }
});

test('batch 27 audit note records directly opened sources and explains the evidence limits', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch27-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/segnale/',
    'https://www.almaany.com/ar/dict/ar-ar/%D8%A7%D8%B4%D8%A7%D8%B1%D8%A9-%D8%A7%D9%84%D9%85%D8%B1%D9%88%D8%B1/',
    'https://www.almaany.com/ar/dict/ar-ar/%D8%A3%D8%B4%D8%A7%D8%B1-%D8%A5%D8%B4%D8%A7%D8%B1%D8%A9/',
    'https://www.treccani.it/vocabolario/raffigurare/',
    'https://www.almaany.com/ar/dict/ar-ar/%D8%A7%D9%84%D9%85%D8%B5%D9%88%D8%B1/',
    'https://www.treccani.it/vocabolario/rappresentare/',
    'https://www.almaany.com/ar/dict/ar-ar/%D9%85%D9%85%D8%AB%D9%84/',
    'https://www.treccani.it/vocabolario/posto1/',
    'https://www.treccani.it/vocabolario/posto2/',
    'https://ar.glosbe.com/it/ar/posto',
    'https://www.treccani.it/vocabolario/strada/',
    'https://context.reverso.net/translation/italian-arabic/strade',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /machine_draft_needs_review/u);
  assert.match(note, /لا يوجد هنا مصدر مباشر/u);
  assert.match(note, /لم تتغير الترجمات أو بيانات الأسئلة/u);
});

test('batch 27 pins unchanged source corpora, dictionary JSON, and SQLite outputs', () => {
  for (const [relative, digest] of Object.entries(questionHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
  for (const [relative, digest] of Object.entries(lessonHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
  for (const [relative, digest] of Object.entries(untouchedOutputHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} unchanged output fingerprint`);
  }
});
