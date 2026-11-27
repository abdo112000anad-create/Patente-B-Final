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
const italianById = new Map(questionsIt.map(row => [String(row.id), row]));
const lessons = json('data/lessons-v2.json');
const similarGroups = json('data/similar-groups.json');

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
  const contexts = [];
  for (const question of questionsIt) {
    const count = tokenMatches(question.it, term);
    if (!count) continue;
    tokenOccurrences += count;
    const paired = arabicById.get(String(question.id));
    assert.ok(paired, `Missing paired Arabic question ${question.id} for ${term}`);
    assert.equal(paired.it, question.it, `Italian text differs for question ${question.id}`);
    assert.equal(paired.answer, question.answer, `Answer differs for question ${question.id}`);
    assert.equal(paired.ar, question.ar, `Arabic translation differs for question ${question.id}`);
    contexts.push(question);
  }
  return { tokenOccurrences, contexts };
}

function lessonCounts(term) {
  let occurrences = 0;
  let records = 0;
  for (const module of lessons.modules) {
    for (const lesson of module.lessons || []) {
      const fields = [lesson.titleIt, lesson.summaryIt, lesson.trapWord?.word];
      for (const point of lesson.keyPoints || []) fields.push(point?.it);
      for (const check of lesson.quickChecks || []) fields.push(check?.qIt);
      const hits = fields.reduce((sum, value) => sum + tokenMatches(value, term), 0);
      occurrences += hits;
      if (hits) records += 1;
    }
  }
  return { occurrences, records };
}

const reviewedTerms = {
  abitato: { tokens: 47, contexts: 47, lessons: 0, lessonRecords: 0 },
  spazi: { tokens: 19, contexts: 18, lessons: 0, lessonRecords: 0 },
  sorpassato: { tokens: 13, contexts: 13, lessons: 0, lessonRecords: 0 },
  possono: { tokens: 203, contexts: 202, lessons: 18, lessonRecords: 13 },
  devono: { tokens: 133, contexts: 132, lessons: 6, lessonRecords: 5 },
  autovetture: { tokens: 76, contexts: 76, lessons: 1, lessonRecords: 1 },
  comporta: { tokens: 74, contexts: 72, lessons: 0, lessonRecords: 0 },
  massima: { tokens: 69, contexts: 67, lessons: 4, lessonRecords: 1 },
  norma: { tokens: 67, contexts: 67, lessons: 1, lessonRecords: 1 },
  passare: { tokens: 66, contexts: 66, lessons: 1, lessonRecords: 1 },
  prossimità: { tokens: 66, contexts: 66, lessons: 1, lessonRecords: 1 },
  delineatore: { tokens: 57, contexts: 57, lessons: 0, lessonRecords: 0 },
};

const expectedCorrections = {
  spazi: 'أماكن، مساحات',
  sorpassato: 'المركبة التي تمّ تجاوزها؛ قديم / متقادِم (للوصف)',
  possono: 'يمكن / قد',
  devono: 'يجب أن / يجب على',
  autovetture: 'سيارات الركوب',
  comporta: 'ينطوي على؛ يستلزم / يقتضي؛ يترتب عليه / يؤدي إلى',
  massima: 'أقصى / قصوى؛ الحدّ الأقصى',
  norma: 'قاعدة؛ عادةً (في di norma)',
  passare: 'يمرّ / يعبر (بحسب السياق)',
  prossimità: 'قُرب؛ بالقرب من',
};

const expectedQuestionFixes = {
  '23722': { answer: 'VERO', ar: 'في المناطق التي تُحدَّد فيها أماكن الوقوف بعلامات أفقية، يجب على السائق دائمًا وضع مركبته داخل أحد المواقف المخصصة، دون أن يشغل المواقف المجاورة' },
  '23725': { answer: 'FALSO', ar: 'في المناطق التي تُحدَّد فيها أماكن الوقوف بعلامات أفقية، يمكن للسائق وضع مركبته خارج الموقف المخصص لها، بشرط أن تكون مدة الوقوف قصيرة جدًا' },
  '23481': { answer: 'FALSO', ar: 'لا يجوز لسائق المركبة التي يجري تجاوزها أن يتسابق في السرعة مع سائق المركبة التي تتجاوزها' },
  '23524': { answer: 'VERO', ar: 'قبل العودة إلى المسار الأيمن بعد التجاوز، يجب التحقق من موقع المركبة التي يجري تجاوزها عبر المرايا الخلفية' },
  '23570': { answer: 'VERO', ar: 'في مرحلة التجاوز، يجب على السائق تجنّب التضييق على المركبة التي يجري تجاوزها أو قطع الطريق أمامها' },
  '23573': { answer: 'VERO', ar: 'تتحدد خطورة التجاوز بخطر الاصطدام بالمركبة التي يجري تجاوزها عند العودة إلى المسار' },
  '23578': { answer: 'FALSO', ar: 'في مرحلة التجاوز، يجب على السائق الحفاظ على سرعة لا تقل عن ضعف سرعة المركبة التي يجري تجاوزها' },
  '23583': { answer: 'FALSO', ar: 'عند العودة إلى المسار بعد التجاوز على الطريق السريع، يجب على السائق الابتعاد مسافة لا تقل عن 100 متر عن المركبة التي جرى تجاوزها' },
  '23584': { answer: 'FALSO', ar: 'عند العودة إلى المسار بعد التجاوز، يجب على السائق تنبيه المركبة التي جرى تجاوزها إلى المناورة بإشارة صوتية' },
  '23968': { answer: 'FALSO', ar: 'يمكن لراكبي الدراجات السير بأمان تام في حركة المرور خارج المناطق المأهولة بالسكان، لأن سائقي المركبات ذات المحرك قادرون دائمًا على توقّع سقوطهم المحتمل أو انحرافاتهم الخطرة بسبب عدم استواء سطح الطريق' },
  '24012': { answer: 'FALSO', ar: 'يمكن أن تكون السترة أو الأشرطة العاكسة عالية الوضوح صفراء اللون فقط' },
  '24471': { answer: 'VERO', ar: 'يجب ألا تكون لوحات المركبات متسخة' },
  '24472': { answer: 'VERO', ar: 'يجب عدم العبث بلوحات المركبات أو تزويرها' },
  '22512': { answer: 'FALSO', ar: 'في حالة تصادم خلفي بين مركبات عند معبر سكة حديد، يجب عدم تحريك المركبات عن القضبان إذا كان هناك مصابون' },
  '24800': { answer: 'VERO', ar: 'يجب على سائقي السيارات، عمومًا، إيلاء اهتمام خاص للمركبات ذات العجلتين المزودة بمحرك، لأن رؤيتها أصعب' },
  '24801': { answer: 'VERO', ar: 'على سائقي السيارات، عند فتح الأبواب، إيلاء اهتمام خاص بالمركبات ذات العجلتين المزودة بمحرك، لأن رؤيتها أصعب' },
};

// Historical provenance for the v45 question bank; the current PWA uses a separate fingerprint.
const historicalDictionarySourceSha256 = '0b092118291a1e2d08f8a6c39cc2d80bb4cd3341830b09a359e07a698f7bd45d';
const preBatch20ItalianAnswerProjectionSha256 = '11a4b7a72f3a1a18887434c947cc6090e4de34d4b8f67132377f89d918546e4d';

test('batch 20 counts all exact-token paired question and lesson contexts', () => {
  for (const [term, expected] of Object.entries(reviewedTerms)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expected.tokens, `${term} question-token occurrences`);
    assert.equal(actual.contexts.length, expected.contexts, `${term} distinct question contexts`);
    assert.deepEqual(lessonCounts(term), { occurrences: expected.lessons, records: expected.lessonRecords }, `${term} lesson contexts`);
  }
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
});

test('batch 20 corrections, unresolved flags, and current dictionary totals are explicit', () => {
  for (const [term, translation] of Object.entries(expectedCorrections)) {
    const row = entries.get(term);
    assert.ok(row, `Missing dictionary row ${term}`);
    assert.equal(row.translation_ar, translation, `${term} translation`);
    assert.equal(row.ui_fallback_ar, translation, `${term} UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation');
    assert.equal(row.provider, 'project-contextual-audit');
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.match(row.source, /^question-bank-context-audit-2026-11;/);
  }

  const abitato = entries.get('abitato');
  assert.ok(abitato, 'abitato dictionary row exists');
  assert.equal(abitato.translation_ar, 'مأهول', 'the exact-form reviewed gloss is unchanged');
  assert.equal(abitato.review_required, 1, 'abitato stays flagged because 98 additional abitati contexts remain unreviewed');
  const abitatiContexts = questionCounts('abitati');
  assert.equal(abitatiContexts.tokenOccurrences, 98);
  assert.equal(abitatiContexts.contexts.length, 98);

  const delineatore = entries.get('delineatore');
  assert.ok(delineatore, 'delineatore dictionary row exists');
  assert.equal(delineatore.translation_ar, 'المُعَيِّن');
  assert.equal(delineatore.review_required, 1, 'no direct bilingual evidence supports a replacement or full confirmation');

  const metadata = dictionary.metadata;
  assert.equal(metadata.total_entries, 5336);
  assert.equal(metadata.review_required_entries, 5097);
  assert.equal(metadata.question_bank_verified_contextual_corrections, 73);
  assert.equal(metadata.question_bank_verified_contextual_gloss_confirmations, 83);
  assert.deepEqual(metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 33,
    machine_draft_needs_review: 5053,
    reviewed_override: 239,
  });
  assert.equal(metadata.source_sha256, historicalDictionarySourceSha256);
  assert.equal(metadata.source_question_count, 7020);
});

test('batch 20 Arabic question fixes preserve Italian text, answers, and paired-data parity', () => {
  for (const [id, expected] of Object.entries(expectedQuestionFixes)) {
    const arabic = arabicById.get(id);
    const italian = italianById.get(id);
    assert.ok(arabic && italian, `Question pair ${id} exists`);
    assert.equal(arabic.answer, expected.answer, `Arabic dataset answer ${id}`);
    assert.equal(italian.answer, expected.answer, `Italian dataset answer ${id}`);
    assert.equal(arabic.it, italian.it, `Italian wording remains paired for ${id}`);
    assert.equal(arabic.ar, expected.ar, `Corrected Arabic wording ${id}`);
    assert.equal(italian.ar, expected.ar, `Corrected Arabic wording is duplicated in the paired dataset for ${id}`);
  }
  assert.equal(Object.keys(expectedQuestionFixes).length, 16);

  const italianAnswerProjection = questionsIt.map(question => ({ id: question.id, it: question.it, answer: question.answer }));
  assert.equal(sha256(JSON.stringify(italianAnswerProjection)), preBatch20ItalianAnswerProjectionSha256,
    'all Italian question text and VERO/FALSO answers remain unchanged across the full question bank');
});

test('question similarity index and PWA release fingerprint track the updated Arabic question bank', () => {
  const questionsRaw = fs.readFileSync(path.join(ROOT, 'data/questions.json'));
  const expectedHash = sha256(questionsRaw);
  assert.equal(similarGroups.question_bank_sha256, expectedHash);
  const release = json('public/release.json');
  assert.equal(release.questionBankSha256, expectedHash);
});
