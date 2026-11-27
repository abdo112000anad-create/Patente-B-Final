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
const targetArabic = {
  '22513': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب تقليل السرعة فوراً',
  '22514': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب التمهّل لتكون قادراً على التوقف إذا لزم الأمر',
  '22515': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب توقع احتمال عبور طفل للطريق',
  '22516': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب التمهّل تدريجياً لتجنّب أن تُصدم من المركبة التالية',
  '22517': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب الانعطاف بقوة',
  '22518': 'في طريق ذي اتجاهين للسير، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب تجنبها حتى لو استلزم ذلك اجتياح المسار المقابل',
  '22519': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، لا يلزم التمهّل لتجنب أن تُصدم من المركبة التالية',
  '22520': 'في منطقة مأهولة، إذا رأيت كرة تتدحرج على الجزء المخصص لسير المركبات من الطريق، يجب تشغيل إشارة الخطر الضوئية فوراً',
  '21876': 'الإشارة المرسومة تدل على الجهة التي يجب أن يتمّ من خلالها تجاوز المركبة التي وُضعت عليها',
  '24128': 'يجب ألا تحتوي أجهزة السحب في المركبة على خلوص ميكانيكي أو تشوّهات أو تشقّقات',
  '20288': 'الإشارة الممثلة تفرض إلزامية السير في دوّار على السيارات فقط',
  '22712': 'الاستخدام الصحيح للطريق يقتضي التوقف دائمًا عند ممرات المشاة، والانطلاق مجددًا فقط إذا لم يكن هناك مشاة يقتربون',
  '22829': 'على طريقٍ ذي اتجاهٍ واحد، يجب على المركبات التي تسلك منعطفًا إلى اليسار أن تبقى بالقرب من الهامش الأيسر للجزء المخصص لسير المركبات من الطريق',
  '21946': 'المحدد الظاهر موضوع في وسط الجزء المخصص لسير المركبات من الطريق للإشارة إلى عائق',
  '21947': 'المحدد الظاهر يقسم الجزء المخصص لسير المركبات من الطريق إلى مسارات',
};
const targetIds = new Set(Object.keys(targetArabic));
const subsequentBatchTargets = new Set(['22497', '22730', '22745', '24666']);
const auditedTargetsAcrossBatches = new Set([...targetIds, ...subsequentBatchTargets]);

function nonArabicFingerprint(questions) {
  const projection = questions.map(question => Object.fromEntries(
    Object.entries(question).filter(([key]) => key !== 'ar'),
  ));
  return sha256(JSON.stringify(projection));
}

function tokenMatches(text, term) {
  const escaped = term;
  const expression = new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, 'giu');
  return [...String(text || '').normalize('NFC').matchAll(expression)].length;
}

test('batch 21 changes only the 15 reviewed Arabic question fields in both paired datasets', () => {
  assert.equal(arabicQuestions.length, 7020);
  assert.equal(italianQuestions.length, 7020);
  assert.equal(nonArabicFingerprint(arabicQuestions), '77cadc9bd1352919a9b60c3bad0c381f9bce8f3b9b9ebfe6374e0e4e521fe7d7');
  assert.equal(nonArabicFingerprint(italianQuestions), '77cadc9bd1352919a9b60c3bad0c381f9bce8f3b9b9ebfe6374e0e4e521fe7d7');

  const arabicById = new Map(arabicQuestions.map(question => [String(question.id), question]));
  const italianById = new Map(italianQuestions.map(question => [String(question.id), question]));
  for (const [id, expectedArabic] of Object.entries(targetArabic)) {
    const ar = arabicById.get(id);
    const it = italianById.get(id);
    assert.ok(ar && it, `paired question ${id} exists`);
    assert.equal(ar.ar, expectedArabic, `Arabic text in questions.json for ${id}`);
    assert.equal(it.ar, expectedArabic, `Arabic text in questions.it.json for ${id}`);
    assert.equal(ar.it, it.it, `Italian text is preserved for ${id}`);
    assert.equal(ar.answer, it.answer, `answer key is preserved for ${id}`);
  }

  const untouchedArabic = arabicQuestions
    .filter(question => !auditedTargetsAcrossBatches.has(String(question.id)))
    .map(question => [String(question.id), question.ar]);
  const untouchedItalian = italianQuestions
    .filter(question => !auditedTargetsAcrossBatches.has(String(question.id)))
    .map(question => [String(question.id), question.ar]);
  const expectedUntouchedHash = 'f609f8feb45008b3807693b6444cdb40ca9c906e7f3c5f7fb0d8275327091a0e';
  assert.equal(sha256(JSON.stringify(untouchedArabic)), expectedUntouchedHash);
  assert.equal(sha256(JSON.stringify(untouchedItalian)), expectedUntouchedHash);

  for (const id of targetIds) {
    assert.doesNotMatch(arabicById.get(id).ar, /carreggiata|carriageggiata|sentido unico|ROTATORIA/i, `untranslated term remains in ${id}`);
  }
  assert.doesNotMatch(arabicById.get('21876').ar, /يجازف/);
  assert.doesNotMatch(arabicById.get('24128').ar, /طقوس/);
  assert.doesNotMatch(arabicById.get('22712').ar, /الانسحاب/);
});

test('all 145 abitato/abitati contexts were counted, but the dictionary flag remains open', () => {
  const forms = { abitato: new Set(), abitati: new Set() };
  for (const question of italianQuestions) {
    for (const term of Object.keys(forms)) {
      if (tokenMatches(question.it, term)) forms[term].add(String(question.id));
    }
  }
  assert.equal(forms.abitato.size, 47);
  assert.equal(forms.abitati.size, 98);
  const entry = json('data/italian_arabic_dictionary_lookup.json').entries.find(row => row.word === 'abitato');
  assert.ok(entry);
  assert.equal(entry.translation_ar, 'مأهول');
  assert.equal(entry.status, 'machine_draft_needs_review');
  assert.equal(entry.review_required, 1);
});

test('question-bank and PWA fingerprints match the regenerated source files', () => {
  const questionSha = sha256(fs.readFileSync(path.join(ROOT, 'data/questions.json')));
  const similarGroups = json('data/similar-groups.json');
  const release = json('public/release.json');
  assert.equal(similarGroups.question_count, 7020);
  assert.equal(similarGroups.question_bank_sha256, questionSha);
  assert.equal(release.questionBankSha256, questionSha);
});
