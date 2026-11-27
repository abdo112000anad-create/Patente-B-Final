'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.PATENTEB_ROOT || path.resolve(__dirname, '..');
const json = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const dictionary = json('data/italian_arabic_dictionary_lookup.json');
const entries = new Map(dictionary.entries.map(row => [row.word.toLocaleLowerCase('it'), row]));
const arabicQuestions = json('data/questions.json').questions;
const italianQuestions = json('data/questions.it.json').questions;
const lessons = json('data/lessons-v2.json');
const arabicById = new Map(arabicQuestions.map(row => [String(row.id), row]));

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenMatches(text, term) {
  const expression = new RegExp(`(?<![\\p{L}\\p{M}])${escaped(term)}(?![\\p{L}\\p{M}])`, 'giu');
  return [...String(text || '').matchAll(expression)].length;
}

function questionCounts(term) {
  let tokenOccurrences = 0;
  const contexts = [];
  for (const question of italianQuestions) {
    const count = tokenMatches(question.it, term);
    if (!count) continue;
    tokenOccurrences += count;
    const paired = arabicById.get(String(question.id));
    assert.ok(paired, `Missing paired Arabic question ${question.id} for ${term}`);
    assert.equal(paired.ar, question.ar, `Paired Arabic text differs for question ${question.id}`);
    contexts.push({ question, paired, count });
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
  trova: { tokens: 108, contexts: 107, lessons: 0, lessonRecords: 0 },
  unico: { tokens: 106, contexts: 106, lessons: 0, lessonRecords: 0 },
  fine: { tokens: 104, contexts: 104, lessons: 0, lessonRecords: 0 },
  vietata: { tokens: 91, contexts: 90, lessons: 0, lessonRecords: 0 },
  rappresentata: { tokens: 90, contexts: 90, lessons: 0, lessonRecords: 0 },
  proseguire: { tokens: 88, contexts: 88, lessons: 2, lessonRecords: 2 },
  preavvisa: { tokens: 84, contexts: 84, lessons: 0, lessonRecords: 0 },
  usare: { tokens: 84, contexts: 84, lessons: 5, lessonRecords: 5 },
  svolta: { tokens: 83, contexts: 81, lessons: 0, lessonRecords: 0 },
  tonnellate: { tokens: 80, contexts: 79, lessons: 0, lessonRecords: 0 },
};

const expectedCorrections = {
  trova: 'يوجد؛ يقع (في صيغة si trova)',
  preavvisa: 'يُنبّه مسبقًا / يُشير مسبقًا إلى',
  indossare: 'ارتداء',
};
const expectedConfirmations = {
  vietata: 'ممنوع',
  proseguire: 'تابع',
  tonnellate: 'أطنان',
};
const expectedStillFlagged = ['unico', 'fine', 'rappresentata', 'usare', 'svolta'];
const indossareFamily = /(?<![\\p{L}\\p{M}])indoss[a-zà-ÿ]*(?![\\p{L}\\p{M}])/giu;

// This is historical provenance for the v45 question bank; the PWA has its own current-build hash.
const historicalDictionarySourceSha256 = '0b092118291a1e2d08f8a6c39cc2d80bb4cd3341830b09a359e07a698f7bd45d';

test('batch 19 counts complete paired question and lesson contexts for the ten original terms', () => {
  for (const [term, expected] of Object.entries(reviewedTerms)) {
    const actual = questionCounts(term);
    assert.equal(actual.tokenOccurrences, expected.tokens, `${term} question-token occurrences`);
    assert.equal(actual.contexts.length, expected.contexts, `${term} distinct question contexts`);
    assert.deepEqual(lessonCounts(term), { occurrences: expected.lessons, records: expected.lessonRecords }, `${term} lesson contexts`);
  }
});

test('indossare lemma-family contexts and inflections remain fully paired', () => {
  const forms = new Map();
  let occurrences = 0;
  let contexts = 0;
  for (const question of italianQuestions) {
    const matches = [...String(question.it || '').matchAll(indossareFamily)].map(match => match[0].toLocaleLowerCase('it'));
    if (!matches.length) continue;
    const paired = arabicById.get(String(question.id));
    assert.ok(paired, `Missing paired Arabic question ${question.id}`);
    assert.equal(paired.ar, question.ar, `Paired Arabic text differs for question ${question.id}`);
    contexts += 1;
    occurrences += matches.length;
    for (const form of matches) forms.set(form, (forms.get(form) || 0) + 1);
  }
  assert.equal(occurrences, 18);
  assert.equal(contexts, 17);
  assert.deepEqual(Object.fromEntries([...forms.entries()].sort()), {
    indossa: 2,
    indossando: 1,
    indossare: 10,
    indossate: 2,
    indossato: 3,
  });
});

test('canonical lessons preserve all 11 units and 50 lesson IDs and contain the two indossato contexts', () => {
  assert.equal(lessons.module_count, 11);
  assert.equal(lessons.modules.length, 11);
  const flat = lessons.modules.flatMap(module => module.lessons);
  assert.equal(flat.length, 50);
  assert.equal(new Set(flat.map(lesson => lesson.id)).size, 50);

  const hits = [];
  for (const module of lessons.modules) {
    for (const lesson of module.lessons || []) {
      const fields = [
        ['titleIt', lesson.titleIt],
        ['summaryIt', lesson.summaryIt],
        ...(lesson.keyPoints || []).map((point, index) => [`keyPoints[${index}].it`, point?.it]),
        ...((lesson.trapWord?.word) ? [['trapWord.word', lesson.trapWord.word]] : []),
        ...(lesson.quickChecks || []).map((check, index) => [`quickChecks[${index}].qIt`, check?.qIt]),
      ];
      for (const [field, value] of fields) {
        const forms = [...String(value || '').matchAll(indossareFamily)].map(match => match[0].toLocaleLowerCase('it'));
        if (forms.length) hits.push({ id: lesson.id, field, forms });
      }
    }
  }
  assert.deepEqual(hits, [
    { id: 'u7-l5', field: 'summaryIt', forms: ['indossato'] },
    { id: 'u7-l5', field: 'quickChecks[2].qIt', forms: ['indossato'] },
  ]);
});

test('dictionary decisions, conservative flags, and reconciled counts are explicit', () => {
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
  for (const [term, translation] of Object.entries(expectedConfirmations)) {
    const row = entries.get(term);
    assert.ok(row, `Missing dictionary row ${term}`);
    assert.equal(row.translation_ar, translation, `${term} unchanged gloss`);
    assert.equal(row.ui_fallback_ar, translation, `${term} UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation');
    assert.equal(row.provider, 'project-contextual-audit');
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.match(row.source, /^question-bank-context-confirmation-2026-11;/);
  }
  for (const term of expectedStillFlagged) {
    const row = entries.get(term);
    assert.ok(row, `Missing dictionary row ${term}`);
    assert.equal(row.review_required, 1, `${term} must remain flagged`);
  }
  const abitato = entries.get('abitato');
  assert.ok(abitato, 'abitato dictionary row exists');
  assert.equal(abitato.review_required, 1, 'abitato remains flagged because 145 contexts have not been fully reviewed');

  const metadata = dictionary.metadata;
  assert.equal(metadata.total_entries, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5078);
  assert.equal(metadata.question_bank_verified_contextual_corrections, 83);
  assert.equal(metadata.question_bank_verified_contextual_gloss_confirmations, 92);
  assert.deepEqual(metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5036,
    reviewed_override: 258,
  });
  assert.equal(metadata.source_sha256, historicalDictionarySourceSha256);
  assert.equal(metadata.source_question_count, 7020);
});

test('Arabic question fixes preserve official Italian wording and VERO/FALSO answers', () => {
  const expected = {
    '21582': {
      answer: 'VERO',
      arabic: 'الإشارة الموضحة خارج المراكز المأهولة توجد بعد إشارة التحذير بوجود معبر للمشاة',
      italian: 'Il segnale raffigurato fuori dei centri abitati si trova dopo il segnale di pericolo ATTRAVERSAMENTO PEDONALE',
    },
    '23850': {
      answer: 'FALSO',
      arabic: 'أثناء عمليات التنبيه بالمثلث المتحرك للخطر لا يجب على السائق ارتداء السترة عالية الرؤية إذا كان على مسارات الطوارئ أو في مناطق الانتظار',
      italian: 'Durante le operazioni di presegnalazione con il segnale mobile di pericolo il conducente non deve indossare il giubbotto ad alta visibilità se si trova sulle corsie di emergenza o sulle piazzole di sosta',
    },
    '24015': {
      answer: 'FALSO',
      arabic: 'يكون ارتداء السترة عالية الوضوح إلزاميًا عند التوقف خارج المناطق المأهولة بالسكان، بينما يجب ارتداء الأحزمة العاكسة في المناطق الحضرية.',
      italian: 'L\'obbligo di indossare il giubbotto ad alta visibilità si ha quando si sosta fuori dai centri abitati, mentre le bretelle retroriflettenti vanno indossate nelle aree urbane',
    },
  };
  for (const [id, value] of Object.entries(expected)) {
    const italian = italianQuestions.find(question => String(question.id) === id);
    const arabic = arabicById.get(id);
    assert.ok(italian && arabic, `Question pair ${id} exists`);
    assert.equal(italian.answer, value.answer);
    assert.equal(arabic.answer, value.answer);
    assert.equal(italian.it, value.italian);
    assert.equal(arabic.it, value.italian);
    assert.equal(italian.ar, value.arabic);
    assert.equal(arabic.ar, value.arabic);
  }
  assert.doesNotMatch(arabicById.get('21582').ar, /ATTRAVERSAMENTO PEDONALE/);
  assert.doesNotMatch(arabicById.get('24015').ar, /abitati/);
});
