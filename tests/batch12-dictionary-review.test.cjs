'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const exactCount = (text, word) => {
  const normalized = String(text || '').normalize('NFC');
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'giu');
  return (normalized.match(pattern) || []).length;
};

test('batch twelve confirms four supported glosses, corrects obbliga, and retains three ambiguous entries flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const lessons = json('data/lessons-v2.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  const questionOccurrences = word => questionsIt.questions.reduce((sum, question) => sum + exactCount(question.it, word), 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(question => exactCount(question.it, word) > 0).length;
  const lessonCounts = word => {
    let occurrences = 0;
    let records = 0;
    for (const module of lessons.modules) {
      for (const lesson of module.lessons || []) {
        const fields = [lesson.titleIt, lesson.summaryIt, lesson.trapWord];
        for (const point of lesson.keyPoints || []) fields.push(point?.it);
        for (const check of lesson.quickChecks || []) fields.push(check?.qIt);
        const hits = fields.reduce((sum, value) => sum + exactCount(value, word), 0);
        occurrences += hits;
        if (hits) records += 1;
      }
    }
    return {occurrences, records};
  };

  const expected = {
    superiore: {arabic: 'أعلى', questions: 131, contexts: 122, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['dictionary.reverso.net/italian-arabic/superiore', 'glosbe.com/it/ar/superiore']},
    ore: {arabic: 'ساعات', questions: 119, contexts: 94, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['glosbe.com/it/ar/ora', 'dizionario.reverso.net/italiano-arabo/alle+ore']},
    parte: {arabic: 'جزء', questions: 115, contexts: 115, lessons: 1, lessonRecords: 1, decision: 'retain', sources: []},
    centro: {arabic: 'وسط', questions: 107, contexts: 107, lessons: 0, lessonRecords: 0, decision: 'retain', sources: []},
    evitare: {arabic: 'تجنب', questions: 107, contexts: 106, lessons: 2, lessonRecords: 2, decision: 'confirmed', sources: ['arabita.news/dizionario/1265', 'context.reverso.net/traduzione/italiano-arabo/evitare']},
    autobus: {arabic: 'حافلة', questions: 106, contexts: 104, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['glosbe.com/it/ar/autobus', 'context.reverso.net/translation/italian-arabic/autobus']},
    obbliga: {arabic: 'يُلزم', questions: 102, contexts: 102, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['glosbe.com/it/ar/obbligare', 'context.reverso.net/traduzione/italiano-arabo/obbligare']},
    strisce: {arabic: 'خطوط', questions: 99, contexts: 97, lessons: 0, lessonRecords: 0, decision: 'retain', sources: []},
  };
  const representativeIds = {
    superiore: [20454, 19608, 22462, 24561, 24785],
    ore: [22243, 20955, 20004, 24829],
    parte: [21810, 21347, 18342, 22812, 23600, 22977],
    centro: [21358, 21378, 23161, 18961, 18326, 18688, 25155],
    evitare: [22123, 19202, 22159, 22647, 23975, 24865, 25078],
    autobus: [21909, 21591, 21723, 21760, 18639, 18811, 23550, 24548],
    obbliga: [21813, 21818, 21823, 22165, 22249],
    strisce: [18341, 20736, 20925, 18611, 18615, 21316],
  };

  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 82);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 86);
  assert.equal(dictionary.metadata.review_required_entries, 5085);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5085);

  for (const [word, item] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(questionOccurrences(word), item.questions, `${word} question-token occurrences`);
    assert.equal(distinctQuestionContexts(word), item.contexts, `${word} distinct paired contexts`);
    const lesson = lessonCounts(word);
    assert.equal(lesson.occurrences, item.lessons, `${word} lesson-text occurrences`);
    assert.equal(lesson.records, item.lessonRecords, `${word} matching lesson records`);
    for (const id of representativeIds[word]) {
      const italian = questionsIt.questions.find(question => question.id === id);
      const arabic = arabicById.get(id);
      assert.ok(italian?.it, `${word} Italian example ${id}`);
      assert.ok(arabic?.ar, `${word} paired Arabic example ${id}`);
      assert.ok(exactCount(italian.it, word) > 0, `${word} exact term in question ${id}`);
    }

    if (item.decision === 'confirmed' || item.decision === 'corrected') {
      assert.equal(row.translation_ar, item.arabic, `${word} reviewed Arabic gloss`);
      assert.equal(row.ui_fallback_ar, item.arabic, `${word} reviewed UI fallback`);
      assert.equal(row.translation_kind, 'contextual_translation', word);
      assert.equal(row.status, 'reviewed_override', word);
      assert.equal(row.review_required, 0, word);
      assert.equal(row.provider, 'project-contextual-audit', word);
      assert.equal(row.confidence, null, word);
      assert.match(row.note, new RegExp(`${item.questions} question-token occurrences`, 'u'), word);
      for (const source of item.sources) assert.ok(row.source.includes(source), `${word} opened bilingual source ${source}`);
      if (item.decision === 'confirmed') {
        assert.match(row.source, /question-bank-context-confirmation-2026-11;/u, word);
        assert.equal(item.arabic, expected[word].arabic, `${word} unchanged gloss`);
      } else {
        assert.match(row.source, /question-bank-context-audit-2026-11;/u, word);
        assert.match(row.note, /أجبر/u);
        assert.match(row.note, /يُلزم/u);
      }
    } else {
      assert.equal(row.translation_ar, item.arabic, `${word} original gloss retained`);
      assert.equal(row.ui_fallback_ar, '', `${word} no fallback while unreviewed`);
      assert.equal(row.status, 'machine_draft_needs_review', word);
      assert.equal(row.review_required, 1, word);
      assert.equal(row.provider, 'opus-mt-local', word);
    }
  }

  for (const id of [21818, 21823, 22165, 22249]) {
    assert.match(arabicById.get(id).ar, /يُلزم|تُلزم|تلزم|يلزم/u, `obbliga paired wording ${id}`);
  }
});
