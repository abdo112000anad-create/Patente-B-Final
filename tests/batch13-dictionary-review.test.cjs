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

test('batch thirteen corrects four supported glosses and retains four uncertain entries flagged', () => {
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
    vicinanza: {old: 'اقترب', arabic: 'قُرب؛ بالقرب من', questions: 104, contexts: 104, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['glosbe.com/it/ar/vicinanza', 'context.reverso.net/traduzione/italiano-arabo/vicinanza']},
    abitati: {old: 'مأهولة بالسكان', arabic: 'مأهولة بالسكان', questions: 98, contexts: 98, lessons: 0, lessonRecords: 0, decision: 'retain', sources: []},
    attraversare: {old: 'عبر', arabic: 'عبر', questions: 97, contexts: 97, lessons: 0, lessonRecords: 0, decision: 'retain', sources: []},
    effettuare: {old: 'شغّل', arabic: 'يُجري؛ يقوم بـ', questions: 87, contexts: 87, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['dictionary.reverso.net/italian-arabic/effettuare', 'context.reverso.net/traduzione/italiano-arabo/effettuare']},
    autocarri: {old: 'السيارات', arabic: 'الشاحنات', questions: 83, contexts: 83, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['context.reverso.net/traduzione/italiano-arabo/autocarro', 'glosbe.com/ar/it/%D8%B4%D8%A7%D8%AD%D9%86%D8%A9', 'aci.gov.it/codice-della-strada/art-54/']},
    pedonale: {old: 'متحرّك', arabic: 'متحرّك', questions: 81, contexts: 80, lessons: 1, lessonRecords: 1, decision: 'retain', sources: []},
    autoveicoli: {old: 'السيارات', arabic: 'السيارات', questions: 74, contexts: 74, lessons: 0, lessonRecords: 0, decision: 'retain', sources: []},
    ciclomotori: {old: 'دورانات', arabic: 'دراجات نارية صغيرة', questions: 67, contexts: 67, lessons: 2, lessonRecords: 1, decision: 'corrected', sources: ['glosbe.com/it/ar/ciclomotore', 'normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285!vig=2026-11-22#art52']},
  };
  const representativeIds = {
    vicinanza: [21814, 22231],
    abitati: [21532, 21536],
    attraversare: [21593, 21594],
    effettuare: [21572, 21683],
    autocarri: [20454, 20455],
    pedonale: [22111, 21386],
    autoveicoli: [21340, 21899],
    ciclomotori: [21680, 21121],
  };

  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 64);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 80);
  assert.equal(dictionary.metadata.review_required_entries, 5109);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5109);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5066);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 227);

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
      assert.ok(arabic.id === id, `${word} Arabic question ID matches ${id}`);
    }

    if (item.decision === 'corrected') {
      assert.equal(row.translation_ar, item.arabic, `${word} corrected Arabic gloss`);
      assert.equal(row.ui_fallback_ar, item.arabic, `${word} reviewed UI fallback`);
      assert.equal(row.translation_kind, 'contextual_translation', word);
      assert.equal(row.status, 'reviewed_override', word);
      assert.equal(row.review_required, 0, word);
      assert.equal(row.provider, 'project-contextual-audit', word);
      assert.equal(row.confidence, null, word);
      assert.match(row.note, new RegExp(`${item.questions} question-token occurrences`, 'u'), word);
      assert.match(row.source, /question-bank-context-audit-2026-11;/u, word);
      for (const source of item.sources) assert.ok(row.source.includes(source), `${word} opened source ${source}`);
    } else {
      assert.equal(row.translation_ar, item.old, `${word} original gloss retained`);
      assert.equal(row.ui_fallback_ar, '', `${word} no fallback while unreviewed`);
      assert.equal(row.status, 'machine_draft_needs_review', word);
      assert.equal(row.review_required, 1, word);
      assert.equal(row.provider, 'opus-mt-local', word);
    }
  }
});
