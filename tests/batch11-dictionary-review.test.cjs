'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const exactCount = (text, word) => {
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'giu');
  return (String(text || '').match(pattern) || []).length;
};

test('batch eleven confirms five supported glosses and retains three uncertain terms flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const lessons = json('data/lessons-v2.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const italianQuestions = new Map(questionsIt.questions.map(row => [row.id, row]));
  const arabicQuestions = new Map(questionsAr.questions.map(row => [row.id, row]));
  const questionOccurrences = word => questionsIt.questions.reduce((sum, q) => sum + exactCount(q.it, word), 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(q => exactCount(q.it, word) > 0).length;
  const lessonCounts = word => {
    let occurrences = 0;
    let records = 0;
    for (const module of lessons.modules) {
      for (const lesson of module.lessons || []) {
        const fields = [lesson.titleIt, lesson.summaryIt, lesson.trapWord];
        for (const item of lesson.keyPoints || []) fields.push(item?.it);
        for (const item of lesson.quickChecks || []) fields.push(item?.qIt);
        const hits = fields.reduce((sum, value) => sum + exactCount(value, word), 0);
        occurrences += hits;
        if (hits) records += 1;
      }
    }
    return {occurrences, records};
  };
  const expected = {
    possibile: {arabic: 'ممكن', questions: 154, contexts: 153, lessons: 3, lessonRecords: 2, decision: 'retain'},
    necessario: {arabic: 'ضروري', questions: 129, contexts: 128, lessons: 9, lessonRecords: 8, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/necessario', 'ar.glosbe.com/it/ar/necessario']},
    massimo: {arabic: 'الأقصى', questions: 128, contexts: 128, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['context.reverso.net/traduzione/italiano-arabo/massimo', 'it.glosbe.com/it/ar/massimo']},
    metri: {arabic: 'متر', questions: 127, contexts: 127, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['context.reverso.net/traduzione/italiano-arabo/metri', 'ar.glosbe.com/it/ar/Metro']},
    categoria: {arabic: 'الفئة', questions: 125, contexts: 110, lessons: 1, lessonRecords: 1, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/categoria', 'glosbe.com/it/ar/categoria%20colore']},
    attraversamento: {arabic: 'العبور', questions: 117, contexts: 114, lessons: 3, lessonRecords: 2, decision: 'retain'},
    doppio: {arabic: 'مزدوج', questions: 116, contexts: 116, lessons: 0, lessonRecords: 0, decision: 'retain'},
    luci: {arabic: 'الأضواء', questions: 112, contexts: 112, lessons: 9, lessonRecords: 3, decision: 'confirmed', sources: ['context.reverso.net/translation/italian-arabic/luci', 'glosbe.com/it/ar/luce']},
  };
  const examples = {
    possibile: [21897, 21405, 20815],
    necessario: [21503, 23372, 24568],
    massimo: [21532, 20955, 25136],
    metri: [21900, 21463, 19580],
    categoria: [21837, 24537, 24981],
    attraversamento: [22111, 23102, 20950],
    doppio: [21460, 24500, 24643],
    luci: [22123, 21139, 24660],
  };

  assert.equal(questionsIt.count, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 82);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 86);
  assert.equal(dictionary.metadata.review_required_entries, 5085);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5085);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5043);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 251);

  for (const [word, item] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(questionOccurrences(word), item.questions, `${word} question-token occurrences`);
    assert.equal(distinctQuestionContexts(word), item.contexts, `${word} distinct paired contexts`);
    const lessonsFound = lessonCounts(word);
    assert.equal(lessonsFound.occurrences, item.lessons, `${word} lesson-text occurrences`);
    assert.equal(lessonsFound.records, item.lessonRecords, `${word} matching lesson records`);
    assert.equal(row.translation_ar, item.arabic, `${word} Arabic gloss unchanged`);
    for (const id of examples[word]) {
      assert.ok(italianQuestions.get(id)?.it, `${word} Italian example ${id}`);
      assert.ok(arabicQuestions.get(id)?.ar, `${word} paired Arabic example ${id}`);
      assert.ok(exactCount(italianQuestions.get(id).it, word) > 0, `${word} exact term in question ${id}`);
    }
    if (item.decision === 'confirmed') {
      assert.equal(row.ui_fallback_ar, item.arabic, word);
      assert.equal(row.translation_kind, 'contextual_translation', word);
      assert.equal(row.status, 'reviewed_override', word);
      assert.equal(row.review_required, 0, word);
      assert.equal(row.provider, 'project-contextual-audit', word);
      assert.equal(row.confidence, null, word);
      assert.match(row.source, /question-bank-context-confirmation-2026-11;/u, word);
      assert.match(row.note, new RegExp(`${item.questions} question-token occurrences`, 'u'), word);
      for (const source of item.sources) assert.ok(row.source.includes(source), `${word} source ${source}`);
    } else {
      assert.equal(row.ui_fallback_ar, '', word);
      assert.equal(row.status, 'machine_draft_needs_review', word);
      assert.equal(row.review_required, 1, word);
    }
  }
});
