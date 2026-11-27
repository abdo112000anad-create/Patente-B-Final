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
const terms = ['guida', 'abitato', 'abitati', 'delineatore', 'transitino'];

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
  guida: {
    questionTokens: 269,
    questionRecords: 261,
    questionIdFingerprint: '9f7b8e8d417cee9479789c56e536cfc3a9de34b011c88d5e9b2b879bedfff603',
    lessonTokens: 22,
    lessonIds: ['u10-l1', 'u10-l4', 'u11-l3', 'u11-l5', 'u7-l5', 'u8-l1', 'u9-l1', 'u9-l2', 'u9-l3', 'u9-l4', 'u9-l5'],
    lessonIdFingerprint: '1b11d11a8566025d97c74daff104a843867a83467bfeabb6fea46fc2478d932d',
  },
  abitato: {
    questionTokens: 47,
    questionRecords: 47,
    questionIdFingerprint: '2801a689d5026b74a3058a0676245a5b9c1784aa8b5264b1a264e4c442d04d2b',
    lessonTokens: 0,
    lessonIds: [],
    lessonIdFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  abitati: {
    questionTokens: 98,
    questionRecords: 98,
    questionIdFingerprint: '86f12a08b4f732c709ee76ca939359d21ba71a72f7016f637687423f548966b4',
    lessonTokens: 0,
    lessonIds: [],
    lessonIdFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  delineatore: {
    questionTokens: 57,
    questionRecords: 57,
    questionIdFingerprint: '1e2d8ffca4547990fdce8846ab4b521ad42a3b526ff475ef1261707587e86231',
    lessonTokens: 0,
    lessonIds: [],
    lessonIdFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
  transitino: {
    questionTokens: 3,
    questionRecords: 3,
    questionIdFingerprint: 'fd2e4de75231bf58408a0a9379487660665b3fc16457c8b1b189f43ce62a441e',
    lessonTokens: 0,
    lessonIds: [],
    lessonIdFingerprint: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  },
};

const unresolved = {
  guida: 'مرشد',
  abitato: 'مأهول',
  abitati: 'مأهولة بالسكان',
  delineatore: 'المُعَيِّن',
  transitino: 'نقل',
};

const questionHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
};

const lessonHashes = {
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 26 pins every exact question context, token count, and paired record', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} distinct question contexts`);
    assert.equal(sha256(actual.ids.join('\n')), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 26 exhaustively scans Italian lesson text in both legacy and canonical files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons.json', 'data/lessons-v2.json']) {
      const actual = lessonCounts(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokens, `${term} tokens in ${relative}`);
      assert.deepEqual(actual.ids, expectedTerm.lessonIds, `${term} exact lesson records in ${relative}`);
      assert.equal(sha256(actual.ids.join('\n')), expectedTerm.lessonIdFingerprint, `${term} lesson-ID set in ${relative}`);
    }
  }
});

test('batch 26 keeps all five unresolved entries as unchanged machine drafts', () => {
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

test('batch 26 audit note retains directly consulted source provenance and limitations', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch26-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/guida/',
    'https://www.treccani.it/vocabolario/guidare/',
    'https://www.almaany.com/ar/dict/ar-ar/%D9%82%D9%8A%D8%A7%D8%AF%D8%A9/',
    'https://unece.org/texts-and-status-0',
    'https://unece.org/DAM/trans/conventn/Conv_road_traffic_AR.pdf',
    'https://www.ogb.gov.ps/public/files/server/inter_agrees/100.pdf',
    'https://aci.gov.it/codice-della-strada/art-3/',
    'https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1992-12-16;495~art173',
    'https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto:1992-12-16;495~art174',
    'https://aci.gov.it/codice-della-strada/art-42/',
    'https://istitlaa.scbc.gov.sa/ar/transportation/mot/saudihighwaycode/Documents/',
    'https://www.treccani.it/vocabolario/transitare/',
    'https://www.arabicacademy.gov.eg/ar/',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /machine_draft_needs_review/u);
  assert.match(note, /لا توجد حجة كافية/u);
  assert.match(note, /لم أغيّر نص الأسئلة الإيطالي أو العربي أو مفاتيح الإجابة/u);
});

test('batch 26 preserves the paired question and lesson source files byte-for-byte', () => {
  for (const [relative, digest] of Object.entries(questionHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
  for (const [relative, digest] of Object.entries(lessonHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }
  assert.equal(questionsAr.length, 7020);
  assert.equal(questionsIt.length, 7020);
  assert.equal(arabicById.size, 7020);
  for (const italian of questionsIt) {
    const arabic = arabicById.get(String(italian.id));
    assert.ok(arabic, `paired Arabic record exists for ${italian.id}`);
    assert.equal(arabic.it, italian.it, `Italian wording remains paired for ${italian.id}`);
    assert.equal(arabic.answer, italian.answer, `answer key remains paired for ${italian.id}`);
    assert.equal(arabic.ar, italian.ar, `Arabic wording remains paired for ${italian.id}`);
  }
});
