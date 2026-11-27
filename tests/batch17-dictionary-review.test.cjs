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

test('batch seventeen applies supported decisions and retains three ambiguous entries flagged', () => {
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
    ciclomotore: {old:'دراجة بمحرك صغير', arabic:'دراجة بمحرك صغير', questions:6, contexts:6, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/translation/italian-arabic/ciclomotore','aci.gov.it/codice-della-strada/art-52/']},
    feriti: {old:'جرحى', arabic:'جرحى', questions:6, contexts:6, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/ferito','treccani.it/vocabolario/ferito/']},
    volante: {old:'عجلة القيادة', arabic:'عجلة القيادة', questions:6, contexts:6, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/volante','context.reverso.net/traduzione/italiano-arabo/al+volante']},
    acceleratore: {old:'مسرع', arabic:'دواسة الوقود', questions:4, contexts:4, lessons:0, lessonRecords:0, decision:'corrected', sources:['dizionario.reverso.net/italiano-arabo/acceleratore','context.reverso.net/traduzione/italiano-arabo/pedale+dell%27acceleratore']},
    moto: {old:'حركة', arabic:'حركة', questions:3, contexts:3, lessons:0, lessonRecords:0, decision:'retained', status:'machine_draft_needs_review'},
    seggiolino: {old:'مقعد', arabic:'مقعد أمان للأطفال (في السيارة)', questions:3, contexts:3, lessons:0, lessonRecords:0, decision:'corrected', sources:['dizionario.reverso.net/italiano-arabo/seggiolino+bambini','treccani.it/vocabolario/seggiolino/']},
    anabbagliante: {old:'متألق', arabic:'المصباح الأمامي المنخفض', questions:2, contexts:2, lessons:0, lessonRecords:0, decision:'corrected', sources:['dictionary.reverso.net/italian-arabic/anabbagliante','treccani.it/vocabolario/anabbagliante/']},
    precedere: {old:'يسبق', arabic:'يسبق', questions:1, contexts:1, lessons:0, lessonRecords:0, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/precedere','arabdict.com/it/italian-arabic/precedere']},
    veicolo: {old:'مركبة', arabic:'مركبة', questions:1278, contexts:1057, lessons:47, lessonRecords:19, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/veicolo','arabdict.com/es/italian-arabic']},
    strada: {old:'الطريق', arabic:'الطريق', questions:791, contexts:778, lessons:22, lessonRecords:12, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/strada','treccani.it/vocabolario/strada/']},
    'velocità': {old:'السرعة', arabic:'السرعة', questions:496, contexts:494, lessons:20, lessonRecords:5, decision:'confirmed', sources:['glosbe.com/it/ar/velocit%C3%A0','treccani.it/vocabolario/velocita/']},
    precedenza: {old:'أولوية المرور', arabic:'أولوية المرور', questions:465, contexts:449, lessons:22, lessonRecords:5, decision:'confirmed', sources:['arabdict.com/en/italian-arabic/precedenza','treccani.it/vocabolario/precedenza/']},
    circolazione: {old:'حركة المرور', arabic:'حركة المرور', questions:320, contexts:312, lessons:8, lessonRecords:5, decision:'retained', status:'legacy_glossary_needs_review'},
    sosta: {old:'وقوف ممتد', arabic:'توقف / وقوف', questions:313, contexts:300, lessons:12, lessonRecords:3, decision:'corrected', sources:['aci.gov.it/codice-della-strada/art-157/','treccani.it/vocabolario/sosta/','dizionario.reverso.net/italiano-arabo/sosta']},
    guida: {old:'مرشد', arabic:'مرشد', questions:269, contexts:261, lessons:22, lessonRecords:11, decision:'retained', status:'machine_draft_needs_review'},
    fermata: {old:'توقف مؤقت', arabic:'توقف مؤقت / موقف', questions:145, contexts:143, lessons:7, lessonRecords:2, decision:'corrected', sources:['aci.gov.it/codice-della-strada/art-157/','treccani.it/vocabolario/fermata/','dizionario.reverso.net/italiano-arabo/fermata','glosbe.com/it/ar/fermata%20dell\'autobus']},
  };

  const totals = Object.values(expected).reduce((sum, item) => ({
    questions: sum.questions + item.questions,
    contexts: sum.contexts + item.contexts,
    lessons: sum.lessons + item.lessons,
    lessonRecords: sum.lessonRecords + item.lessonRecords,
  }), {questions:0, contexts:0, lessons:0, lessonRecords:0});

  assert.equal(Object.keys(expected).length, 16);
  assert.deepEqual(totals, {questions:4108, contexts:3825, lessons:160, lessonRecords:62});
  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 82);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 87);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.review_required_entries, 5084);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5084);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5042);
  assert.equal(dictionary.metadata.counts_by_status.legacy_glossary_needs_review, 31);
  assert.equal(dictionary.metadata.counts_by_status.contextual_candidate_needs_review, 3);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 252);
  assert.equal(dictionary.metadata.counts_by_status.contextual_override_v49, 8);
  assert.equal(Object.values(expected).filter(item => item.decision === 'corrected').length, 5);
  assert.equal(Object.values(expected).filter(item => item.decision === 'confirmed').length, 8);
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
    assert.match(row.note, new RegExp(`${item.questions} (?:exact )?question-token occurrence`, 'u'), word);
    for (const source of item.sources) assert.ok(row.source.includes(source), `${word} opened source ${source}`);
    if (item.decision === 'corrected') assert.notEqual(row.translation_ar, item.old, `${word} supported correction`);
    else assert.equal(row.translation_ar, item.old, `${word} unchanged confirmation`);
  }
});
