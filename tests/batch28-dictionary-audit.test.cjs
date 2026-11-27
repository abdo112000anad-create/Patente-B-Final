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
const terms = ['pannello', 'caso', 'dare', 'più', 'durante'];

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
  pannello: {
    questionTokens: 281,
    questionRecords: 280,
    questionIdFingerprint: '25763f347eaa7b75bbea50b5db090b1e88ed66fbfb756fe5a0e89c926bade79d',
    lessonTokens: 3,
    lessonIds: ['u2-l4'],
  },
  caso: {
    questionTokens: 276,
    questionRecords: 273,
    questionIdFingerprint: '56f82cbfa6b80c2b833c8b6dd5196030df241a226630599547a267b068876a30',
    lessonTokens: 3,
    lessonIds: ['u11-l4', 'u5-l3', 'u8-l4'],
  },
  dare: {
    questionTokens: 207,
    questionRecords: 206,
    questionIdFingerprint: '16f11db3f3d8f8614844dbc14b67df998c149436b2dbdb2550ac3ca1e307d4ff',
    lessonTokens: 0,
    lessonIds: [],
  },
  'più': {
    questionTokens: 177,
    questionRecords: 170,
    questionIdFingerprint: 'b52f61eba55c1045071830b161f7c36e7790d2adfc74d9fbcb7e12106a9b8d71',
    lessonTokens: 9,
    lessonIds: ['u10-l4', 'u5-l4', 'u6-l1', 'u6-l4', 'u9-l1', 'u9-l6'],
  },
  durante: {
    questionTokens: 174,
    questionRecords: 174,
    questionIdFingerprint: '8bf1cf69d7a1fc50032d636e50251ce346499e92f96856929673238b1f671b31',
    lessonTokens: 8,
    lessonIds: ['u5-l2', 'u5-l4', 'u6-l2', 'u7-l2', 'u9-l3', 'u9-l4'],
  },
};

const unresolved = { pannello: 'لوحة', caso: 'الحالة', dare: 'أعط', 'più': 'زائد' };
const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

test('batch 28 pins exact question counts, ID fingerprints, and every paired Arabic record', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} distinct paired contexts`);
    assert.equal(sha256(actual.ids.join('\n')), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 28 scans complete Italian lesson text in both legacy and canonical corpora', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons.json', 'data/lessons-v2.json']) {
      const actual = lessonCounts(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokens, `${term} tokens in ${relative}`);
      assert.deepEqual(actual.ids, expectedTerm.lessonIds, `${term} exact lesson records in ${relative}`);
    }
  }
});

test('batch 28 preserves four unresolved drafts and confirms only the unchanged temporal gloss durante', () => {
  assert.deepEqual(Object.keys(unresolved).sort(), ['caso', 'dare', 'pannello', 'più'].sort());
  for (const [term, translation] of Object.entries(unresolved)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} machine-draft gloss is unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no promoted UI fallback`);
    assert.equal(row.translation_kind, 'machine_translation', `${term} remains machine-generated`);
    assert.equal(row.status, 'machine_draft_needs_review', `${term} remains a draft`);
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local', `${term} retains original provider provenance`);
    assert.equal(row.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4', `${term} retains original source provenance`);
  }
  const durante = entries.get('durante');
  assert.ok(durante);
  assert.equal(durante.translation_ar, 'خلال', 'the Arabic gloss itself is unchanged');
  assert.equal(durante.ui_fallback_ar, 'خلال');
  assert.equal(durante.translation_kind, 'contextual_translation');
  assert.equal(durante.status, 'reviewed_override');
  assert.equal(durante.review_required, 0);
  assert.equal(durante.provider, 'project-contextual-audit');
  assert.match(durante.source, /Treccani.*vocabolario\/durante/u);
  assert.match(durante.source, /almaany\.com\/ar\/dict\/ar-en\/during/u);
  assert.match(durante.note, /174 question-token occurrences in 174 distinct paired contexts/u);
  assert.match(durante.note, /English-Arabic rather than a direct Italian-Arabic entry/u);
});

test('batch 28 records sources, ambiguity decisions, and source limitations in its audit note', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch28-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/pannello/',
    'https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=1&art.idGruppo=12&art.flagTipoArticolo=0&art.codiceRedazionale=092G0531&art.idArticolo=83&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=1992-12-28&art.progressivo=0',
    'https://www.treccani.it/vocabolario/caso/',
    'https://www.treccani.it/vocabolario/dare/',
    'https://aci.gov.it/codice-della-strada/art-145/',
    'https://www.treccani.it/vocabolario/piu/',
    'https://www.almaany.com/ar/dict/ar-ar/%D8%B2%D8%A7%D8%A6%D8%AF/',
    'https://www.treccani.it/vocabolario/durante/',
    'https://www.almaany.com/ar/dict/ar-en/during/',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /أبقيت `pannello` و`caso` و`dare` و`più` معلّمة/u);
  assert.match(note, /إنجليزي–عربي وليس ثنائيًا/u);
  assert.match(note, /zero mismatches|لم يظهر أي سجل مفقود/u);
  assert.match(note, /لم يُجرَ اختبار Android/u);
});

test('batch 28 pins its reviewed terms, current dictionary totals, and unchanged question/lesson inputs', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5099);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 71);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 83);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 33,
    machine_draft_needs_review: 5055,
    reviewed_override: 237,
  });
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
