'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

const exactCount = (text, word) => {
  const normalized = String(text || '').normalize('NFC');
  const escaped = word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`, 'giu');
  return (normalized.match(pattern) || []).length;
};

test('batch sixteen applies only supported decisions and retains three uncertain entries flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const lessons = json('data/lessons-v2.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  const questionOccurrences = word => questionsIt.questions.reduce((sum, question) => sum + exactCount(question.it, word), 0);
  const matchedQuestions = word => questionsIt.questions.filter(question => exactCount(question.it, word) > 0);
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
    frenata: {old:'كبح', arabic:'فرملة', questions:23, contexts:23, lessons:4, lessonRecords:2, decision:'corrected', sources:['context.reverso.net/traduzione/italiano-arabo/frenata','dizionario.reverso.net/italiano-arabo/frenare']},
    traino: {old:'سحب', arabic:'سحب', questions:23, contexts:22, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/traino','dizionario.reverso.net/italiano-arabo/fune+di+traino']},
    marciare: {old:'سر', arabic:'السير', questions:22, contexts:22, lessons:0, lessonRecords:0, decision:'corrected', sources:['context.reverso.net/traduzione/italiano-arabo/marciare','treccani.it/vocabolario/marciare']},
    arrestare: {old:'أوقف', arabic:'أوقف', questions:17, contexts:17, lessons:2, lessonRecords:1, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/arrestare','treccani.it/vocabolario/arrestare2']},
    sterzo: {old:'نظام توجيه', arabic:'المقود؛ نظام التوجيه', questions:17, contexts:17, lessons:0, lessonRecords:0, decision:'corrected', sources:['context.reverso.net/traduzione/italiano-arabo/sterzo','it.glosbe.com/ar/it/%D8%B9%D8%AC%D9%84%D8%A9']},
    guasto: {old:'عطل', arabic:'عطل', questions:16, contexts:16, lessons:4, lessonRecords:1, decision:'retained', status:'legacy_glossary_needs_review'},
    fari: {old:'أضواء', arabic:'أضواء', questions:16, contexts:15, lessons:1, lessonRecords:1, decision:'retained', status:'machine_draft_needs_review'},
    banchina: {old:'كتف الطريق', arabic:'كتف الطريق', questions:16, contexts:16, lessons:0, lessonRecords:0, decision:'retained', status:'legacy_glossary_needs_review'},
    consentire: {old:'اسمح', arabic:'يسمح، يتيح', questions:16, contexts:16, lessons:0, lessonRecords:0, decision:'corrected', sources:['dizionario.reverso.net/italiano-arabo/consentire','treccani.it/vocabolario/consentire']},
    cintura: {old:'حزام', arabic:'حزام', questions:15, contexts:15, lessons:5, lessonRecords:2, decision:'confirmed', sources:['it.glosbe.com/it/ar/cintura','context.reverso.net/traduzione/italiano-arabo/cintura']},
    frenare: {old:'يفرمل / يكبح', arabic:'يفرمل / يكبح', questions:15, contexts:15, lessons:0, lessonRecords:0, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/frenare','question-bank-context-confirmation-2026-11']},
    parcheggiare: {old:'قف', arabic:'يركن (السيارة)', questions:15, contexts:15, lessons:0, lessonRecords:0, decision:'corrected', sources:['glosbe.com/it/ar/parcheggiare','treccani.it/vocabolario/parcheggiare']},
    ghiaccio: {old:'جليد', arabic:'جليد', questions:14, contexts:14, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/ghiaccio']},
    frizione: {old:'قابض', arabic:'قابض', questions:9, contexts:9, lessons:0, lessonRecords:0, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/frizione','context.reverso.net/traduzione/italiano-arabo/frizione']},
    illuminazione: {old:'الإضاءة', arabic:'الإضاءة', questions:9, contexts:9, lessons:0, lessonRecords:0, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/illuminazione']},
    pneumatico: {old:'إطار', arabic:'إطار', questions:9, contexts:8, lessons:0, lessonRecords:0, decision:'confirmed', sources:['it.glosbe.com/it/ar/pneumatico','context.reverso.net/traduzione/italiano-arabo/pneumatico']},
    ciclista: {old:'راكب دراجة', arabic:'راكب دراجة', questions:7, contexts:7, lessons:4, lessonRecords:2, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/ciclista']},
    bicicletta: {old:'دراجة', arabic:'دراجة', questions:7, contexts:7, lessons:0, lessonRecords:0, decision:'confirmed', sources:['it.glosbe.com/it/ar/bicicletta','context.reverso.net/traduzione/italiano-arabo/bicicletta']},
  };

  const totals = Object.values(expected).reduce((sum, item) => ({
    questions: sum.questions + item.questions,
    contexts: sum.contexts + item.contexts,
    lessons: sum.lessons + item.lessons,
    lessonRecords: sum.lessonRecords + item.lessonRecords,
  }), {questions:0, contexts:0, lessons:0, lessonRecords:0});

  assert.equal(Object.keys(expected).length, 18);
  assert.deepEqual(totals, {questions:266, contexts:263, lessons:20, lessonRecords:9});
  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 88);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 94);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.review_required_entries, 5071);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5071);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5029);
  assert.equal(dictionary.metadata.counts_by_status.legacy_glossary_needs_review, 31);
  assert.equal(dictionary.metadata.counts_by_status.contextual_candidate_needs_review, 3);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 265);
  assert.equal(dictionary.metadata.counts_by_status.contextual_override_v49, 8);
  assert.equal(Object.values(expected).filter(item => item.decision === 'corrected').length, 5);
  assert.equal(Object.values(expected).filter(item => item.decision === 'confirmed').length, 10);
  assert.equal(Object.values(expected).filter(item => item.decision === 'retained').length, 3);

  for (const [word, item] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    const questions = matchedQuestions(word);
    assert.equal(questionOccurrences(word), item.questions, `${word} question-token occurrences`);
    assert.equal(questions.length, item.contexts, `${word} distinct question contexts`);
    const lesson = lessonCounts(word);
    assert.equal(lesson.occurrences, item.lessons, `${word} lesson-text occurrences`);
    assert.equal(lesson.records, item.lessonRecords, `${word} matching lesson records`);
    for (const italian of questions) {
      const arabic = arabicById.get(italian.id);
      assert.ok(arabic?.ar, `${word} paired Arabic question ${italian.id}`);
      assert.equal(arabic.id, italian.id, `${word} paired question ID ${italian.id}`);
    }

    assert.equal(row.translation_ar, item.arabic, `${word} audited Arabic gloss`);
    if (item.decision === 'retained') {
      assert.equal(row.translation_ar, item.old, `${word} existing gloss remains untouched`);
      assert.equal(row.review_required, 1, `${word} uncertainty remains flagged`);
      assert.equal(row.status, item.status, `${word} original review status remains`);
      continue;
    }

    assert.equal(row.ui_fallback_ar, item.arabic, `${word} reviewed UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation', word);
    assert.equal(row.status, 'reviewed_override', word);
    assert.equal(row.review_required, 0, word);
    assert.equal(row.provider, 'project-contextual-audit', word);
    assert.equal(row.confidence, null, word);
    const sourcePrefix = item.decision === 'corrected'
      ? /question-bank-context-audit-2026-11;/u
      : /question-bank-context-confirmation-2026-11;/u;
    assert.match(row.source, sourcePrefix, word);
    assert.match(row.note, new RegExp(`${item.questions} question-token occurrences`, 'u'), word);
    for (const source of item.sources) assert.ok(row.source.includes(source), `${word} opened source ${source}`);
    if (item.decision === 'corrected') assert.notEqual(row.translation_ar, item.old, `${word} supported correction`);
    else assert.equal(row.translation_ar, item.old, `${word} unchanged confirmation`);
  }
});
