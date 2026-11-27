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
const terms = ['prima', 'accesa', 'responsabilità', 'laterale', 'salvo'];

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
  prima: {
    questionTokens: 206,
    questionRecords: 205,
    uniqueItalianTexts: 202,
    uniquePairedTexts: 205,
    questionIdFingerprint: 'e6bd34f19e70a187a3e659d75c34b887c085d055e1d669a3a84f722a65e63e11',
    lessonTokens: 12,
    lessonIds: ['u11-l1', 'u4-l2', 'u5-l1', 'u5-l4', 'u7-l5'],
  },
  accesa: {
    questionTokens: 71,
    questionRecords: 71,
    uniqueItalianTexts: 71,
    uniquePairedTexts: 71,
    questionIdFingerprint: '01c4065164aed4b030309ca4e81536b48eaa08dfead479b7bc3181b25434f82e',
    lessonTokens: 0,
    lessonIds: [],
  },
  'responsabilità': {
    questionTokens: 66,
    questionRecords: 59,
    uniqueItalianTexts: 59,
    uniquePairedTexts: 59,
    questionIdFingerprint: 'bb4f0240b2b19dc56f82bac86cba9d1bf018d8d04c21414d0ce56ca59e84b709',
    lessonTokens: 4,
    lessonIds: ['u8-l3'],
  },
  laterale: {
    questionTokens: 64,
    questionRecords: 61,
    uniqueItalianTexts: 61,
    uniquePairedTexts: 61,
    questionIdFingerprint: '7eebd87aadf3abc181934b93ec939f7375b6a60183f82add595918c6dd5d5162',
    lessonTokens: 2,
    lessonIds: ['u5-l2', 'u9-l6'],
  },
  salvo: {
    questionTokens: 59,
    questionRecords: 48,
    uniqueItalianTexts: 47,
    uniquePairedTexts: 48,
    questionIdFingerprint: '78ca2d29377ef4903a04ebd0617bcb4dbc723480326e53b442e1dcfd746126d6',
    lessonTokens: 3,
    lessonIds: ['u4-l1', 'u6-l4', 'u7-l5'],
  },
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
  'android/app/src/main/assets/dictionary.db': '90257434f90de831da2b21f977e5381bb84e1e6cd888439cf86da0696dee9563',
};

test('batch 30 pins all occurrences and validates every paired Arabic context and answer key', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(actual.ids.length, expectedTerm.questionRecords, `${term} paired question records`);
    assert.equal(actual.uniqueItalianTexts, expectedTerm.uniqueItalianTexts, `${term} unique Italian contexts`);
    assert.equal(actual.uniquePairedTexts, expectedTerm.uniquePairedTexts, `${term} unique Italian-Arabic context pairs`);
    assert.equal(sha256(actual.ids.join('\n')), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 30 pins complete Italian lesson coverage in current and legacy files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const relative of ['data/lessons.json', 'data/lessons-v2.json']) {
      const actual = lessonCounts(relative, term);
      assert.equal(actual.occurrences, expectedTerm.lessonTokens, `${term} lesson-token count in ${relative}`);
      assert.deepEqual(actual.ids, expectedTerm.lessonIds, `${term} exact lesson IDs in ${relative}`);
    }
  }
});

test('batch 30 applies only the supported accesa correction and two unchanged-gloss confirmations', () => {
  const accesa = entries.get('accesa');
  assert.ok(accesa);
  assert.equal(accesa.translation_ar, 'مُضاء / مُضاءة');
  assert.equal(accesa.ui_fallback_ar, 'مُضاء / مُضاءة');
  assert.equal(accesa.translation_kind, 'contextual_translation');
  assert.equal(accesa.status, 'reviewed_override');
  assert.equal(accesa.review_required, 0);
  assert.equal(accesa.provider, 'project-contextual-audit');
  assert.match(accesa.source, /^question-bank-context-audit-2026-11;/u);

  for (const [term, translation] of [['responsabilità', 'المسؤولية'], ['laterale', 'جانبي']]) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} original gloss is confirmed unchanged`);
    assert.equal(row.ui_fallback_ar, translation, `${term} reviewed gloss is used as the UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation', `${term} contextual-translation kind`);
    assert.equal(row.status, 'reviewed_override', `${term} marked as contextually reviewed`);
    assert.equal(row.review_required, 0, `${term} no longer needs review`);
    assert.equal(row.provider, 'project-contextual-audit');
    assert.match(row.source, /^question-bank-context-confirmation-2026-11;/u);
  }
});

test('batch 30 leaves prima and salvo flagged because one gloss cannot cover their app senses', () => {
  for (const [term, translation] of [['prima', 'قبل'], ['salvo', 'احفظ']]) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} machine-draft gloss remains unchanged`);
    assert.equal(row.ui_fallback_ar, '', `${term} has no promoted UI fallback`);
    assert.equal(row.translation_kind, 'machine_translation', `${term} retains machine-translation kind`);
    assert.equal(row.status, 'machine_draft_needs_review', `${term} remains a draft`);
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local', `${term} retains model provenance`);
    assert.equal(row.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4', `${term} retains source provenance`);
  }
});

test('batch 30 note records source evidence, ambiguity, coverage limits, and no device-test claim', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch30-2026-11-27.md'), 'utf8');
  const sources = [
    'https://www.treccani.it/vocabolario/acceso/',
    'https://dizionario.internazionale.it/parola/acceso',
    'https://aci.gov.it/codice-della-strada/art-41/',
    'https://context.reverso.net/traduzione/italiano-arabo/accesa',
    'https://www.treccani.it/vocabolario/responsabilita/',
    'https://aci.gov.it/codice-della-strada/art-193/',
    'https://context.reverso.net/traduzione/italiano-arabo/responsabilit%C3%A0',
    'https://www.treccani.it/vocabolario/laterale/',
    'https://dizionario.internazionale.it/parola/laterale',
    'https://www.aci.it/fileadmin/cds/art-148.php',
    'https://dizionario.reverso.net/italiano-arabo/laterale',
    'https://dizionario.internazionale.it/parola/prima',
    'https://accademiadellacrusca.it/it/consulenza/presto-pi%C3%B9-presto-il-prima-possibile/344',
    'https://www.treccani.it/vocabolario/salvo/',
    'https://aci.gov.it/codice-della-strada/art-142/',
    'https://aci.gov.it/codice-della-strada/art-157/',
  ];
  for (const source of sources) assert.ok(note.includes(source), `audit note cites ${source}`);
  assert.match(note, /Q22502/u);
  assert.match(note, /prima/u);
  assert.match(note, /salvo/u);
  assert.match(note, /لم يُجرَ اختبار Android على جهاز/u);
});

test('batch 30 preserves question and lesson inputs and pins the regenerated SQLite artifact', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5089);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 80);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 84);
  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} fingerprint`);
  }
});
