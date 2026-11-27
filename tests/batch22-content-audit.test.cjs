'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = process.env.PATENTEB_ROOT || path.resolve(__dirname, '..');
const json = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const arabicQuestions = json('data/questions.json').questions;
const italianQuestions = json('data/questions.it.json').questions;
const targetRecords = {
  '22497': {
    it: 'Ai passaggi a livello occorre usare la massima prudenza e moderare la velocità, per evitare situazioni di pericolo che comportino il danneggiamento delle attrezzature',
    ar: 'عند معابر السكك الحديدية، يجب استخدام أقصى درجات الحذر وخفض السرعة لتجنّب مواقف خطرة قد تتسبب في تلف المعدات.',
    answer: 'VERO',
  },
  '22730': {
    it: 'In un centro abitato, quando un pedone, fuori delle strisce di attraversamento, non accenni a darci la precedenza, è opportuno rallentare e avvisarlo con un breve colpo di clacson, in caso di pericolo immediato',
    ar: 'في منطقة مأهولة، إذا لم يُبدِ أحد المشاة خارج ممرّات عبور المشاة أيَّ إشارة إلى أنه سيمنحنا أولوية المرور، فمن المناسب خفض السرعة وتنبيهه بضغطة قصيرة على البوق عند وجود خطر وشيك.',
    answer: 'VERO',
  },
  '22745': {
    it: 'Quando, in un centro abitato, il conducente di un veicolo si imbatte in un corteo, deve regolarsi in base alla sua densità, oltrepassandolo o interrompendolo qualora sia possibile',
    ar: 'عندما يصادف سائق مركبة موكبًا داخل منطقة مأهولة، يجب عليه أن يراعي كثافة الموكب، وأن يتجاوزه أو يقطع مساره إذا أمكن ذلك.',
    answer: 'FALSO',
  },
  '24666': {
    it: "Lasciare in sosta l'auto davanti a un passo carrabile comporta una perdita di punti sulla patente",
    ar: 'إن ترك السيارة متوقفة أمام مدخلٍ مخصّص لدخول المركبات إلى عقارٍ متصل بالطريق يؤدي إلى خسارة نقاط من رخصة القيادة.',
    answer: 'FALSO',
  },
};
const targetIds = new Set(Object.keys(targetRecords));

function nonArabicFingerprint(questions) {
  const projection = questions.map(question => Object.fromEntries(
    Object.entries(question).filter(([key]) => key !== 'ar'),
  ));
  return sha256(JSON.stringify(projection));
}

test('batch 22 corrects only the four reviewed Arabic fields in both paired datasets', () => {
  assert.equal(arabicQuestions.length, 7020);
  assert.equal(italianQuestions.length, 7020);
  assert.equal(nonArabicFingerprint(arabicQuestions), '77cadc9bd1352919a9b60c3bad0c381f9bce8f3b9b9ebfe6374e0e4e521fe7d7');
  assert.equal(nonArabicFingerprint(italianQuestions), '77cadc9bd1352919a9b60c3bad0c381f9bce8f3b9b9ebfe6374e0e4e521fe7d7');

  const arabicById = new Map(arabicQuestions.map(question => [String(question.id), question]));
  const italianById = new Map(italianQuestions.map(question => [String(question.id), question]));
  for (const [id, expected] of Object.entries(targetRecords)) {
    const ar = arabicById.get(id);
    const it = italianById.get(id);
    assert.ok(ar && it, `paired question ${id} exists`);
    assert.equal(ar.ar, expected.ar, `corrected Arabic in questions.json for ${id}`);
    assert.equal(it.ar, expected.ar, `corrected Arabic in questions.it.json for ${id}`);
    assert.equal(ar.it, expected.it, `Italian wording preserved for ${id}`);
    assert.equal(it.it, expected.it, `paired Italian wording preserved for ${id}`);
    assert.equal(ar.answer, expected.answer, `answer key preserved in questions.json for ${id}`);
    assert.equal(it.answer, expected.answer, `answer key preserved in questions.it.json for ${id}`);
  }

  const untouchedArabic = arabicQuestions
    .filter(question => !targetIds.has(String(question.id)))
    .map(question => [String(question.id), question.ar]);
  const untouchedItalian = italianQuestions
    .filter(question => !targetIds.has(String(question.id)))
    .map(question => [String(question.id), question.ar]);
  const expectedUntouchedHash = 'ee2e0ace452ee076ad7b3f1a982d71853e06c6f72c01f7bf4798f43370e8f53e';
  assert.equal(sha256(JSON.stringify(untouchedArabic)), expectedUntouchedHash);
  assert.equal(sha256(JSON.stringify(untouchedItalian)), expectedUntouchedHash);
});

test('abitato and delineatore remain explicitly flagged for human review', () => {
  const entries = json('data/italian_arabic_dictionary_lookup.json').entries;
  for (const [word, translation] of [['abitato', 'مأهول'], ['delineatore', 'المُعَيِّن']]) {
    const entry = entries.find(row => row.word === word);
    assert.ok(entry, `dictionary entry exists for ${word}`);
    assert.equal(entry.translation_ar, translation);
    assert.equal(entry.status, 'machine_draft_needs_review');
    assert.equal(entry.review_required, 1);
  }
});

test('question-bank fingerprint and existing similar-group counts are synchronized', () => {
  const questionSha = sha256(fs.readFileSync(path.join(ROOT, 'data/questions.json')));
  const similarGroups = json('data/similar-groups.json');
  const release = json('public/release.json');
  assert.equal(similarGroups.question_count, 7020);
  assert.equal(similarGroups.question_bank_sha256, questionSha);
  assert.equal(release.questionBankSha256, questionSha);
  assert.equal(similarGroups.group_count, 453);
  assert.equal(similarGroups.grouped_question_count, 1093);
  assert.equal(similarGroups.accepted_pair_count, 1251);
});
