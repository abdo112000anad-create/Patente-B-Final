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

test('batch fifteen applies only source-supported decisions and retains four uncertain entries flagged', () => {
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
    autovettura: {old: 'سيارة ركاب', arabic: 'سيارة ركاب', questions: 83, contexts: 82, lessons: 3, lessonRecords: 1, decision: 'confirmed', sources: ['context.reverso.net/traduzione/italiano-arabo/autovettura']},
    emergenza: {old: 'حالة طارئة', arabic: 'طارئ؛ حالة طارئة؛ طوارئ (بحسب السياق)', questions: 78, contexts: 78, lessons: 9, lessonRecords: 3, decision: 'corrected', sources: ['arabdict.com/ar/عربي-إيطالي/emergenza']},
    autoveicolo: {old: 'مركبة آلية', arabic: 'مركبة آلية', questions: 67, contexts: 67, lessons: 1, lessonRecords: 1, decision: 'retained', status: 'legacy_glossary_needs_review'},
    intersezione: {old: 'ملتقى طرق', arabic: 'ملتقى طرق', questions: 50, contexts: 48, lessons: 0, lessonRecords: 0, decision: 'retained', status: 'legacy_glossary_needs_review'},
    biciclette: {old: 'الدراجات', arabic: 'الدراجات', questions: 47, contexts: 47, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['it.glosbe.com/it/ar/bicicletta', 'context.reverso.net/traduzione/italiano-arabo/bicicletta']},
    segnali: {old: 'الإشارات', arabic: 'الإشارات', questions: 44, contexts: 44, lessons: 22, lessonRecords: 9, decision: 'retained', status: 'machine_draft_needs_review'},
    rimorchi: {old: 'السحب', arabic: 'مقطورات', questions: 41, contexts: 41, lessons: 1, lessonRecords: 1, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/rimorchio']},
    ferito: {old: 'مصاب', arabic: 'مصاب', questions: 38, contexts: 38, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/ferito']},
    caduta: {old: 'سقوط', arabic: 'سقوط', questions: 35, contexts: 35, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/caduta']},
    clacson: {old: 'بوق', arabic: 'بوق', questions: 34, contexts: 34, lessons: 3, lessonRecords: 1, decision: 'confirmed', sources: ['context.reverso.net/translation/italian-arabic/clacson']},
    motociclo: {old: 'دراجة نارية', arabic: 'دراجة نارية', questions: 34, contexts: 34, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['context.reverso.net/traduzione/italiano-arabo/motociclo']},
    freno: {old: 'مكبح', arabic: 'مكبح', questions: 30, contexts: 30, lessons: 2, lessonRecords: 1, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/freno+di+stazionamento']},
    pedone: {old: 'مشاة', arabic: 'مشاة', questions: 29, contexts: 29, lessons: 3, lessonRecords: 2, decision: 'confirmed', sources: ['lexisrex.com/Arabo/Parole/pedone']},
    nebbia: {old: 'ضباب', arabic: 'ضباب', questions: 29, contexts: 27, lessons: 1, lessonRecords: 1, decision: 'confirmed', sources: ['ar.glosbe.com/it/ar/nebbia']},
    abbagliante: {old: 'الضوء العالي / مُبهِر', arabic: 'الضوء العالي / مُبهِر', questions: 28, contexts: 28, lessons: 0, lessonRecords: 0, decision: 'retained', status: 'contextual_candidate_needs_review'},
    cinture: {old: 'حزام', arabic: 'أحزمة الأمان', questions: 27, contexts: 27, lessons: 3, lessonRecords: 2, decision: 'corrected', sources: ['context.reverso.net/traduzione/italiano-arabo/cintura+di+sicurezza', 'glosbe.com/ar/it/%D8%AD%D8%B2%D8%A7%D9%85%20%D8%A7%D9%84%D8%A3%D9%85%D8%A7%D9%86']},
    neve: {old: 'ثلج', arabic: 'ثلج', questions: 25, contexts: 24, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/neve']},
    freni: {old: 'فرامل', arabic: 'فرامل', questions: 24, contexts: 24, lessons: 6, lessonRecords: 2, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/freno+di+stazionamento']},
  };

  assert.equal(Object.keys(expected).length, 18);
  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 83);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 91);
  assert.equal(dictionary.metadata.review_required_entries, 5079);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5079);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5037);
  assert.equal(dictionary.metadata.counts_by_status.legacy_glossary_needs_review, 31);
  assert.equal(dictionary.metadata.counts_by_status.contextual_candidate_needs_review, 3);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 257);
  assert.equal(Object.values(expected).filter(item => item.decision !== 'retained').length, 14);
  assert.equal(Object.values(expected).filter(item => item.decision === 'retained').length, 4);

  for (const [word, item] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(questionOccurrences(word), item.questions, `${word} question-token occurrences`);
    assert.equal(distinctQuestionContexts(word), item.contexts, `${word} distinct question contexts`);
    const lesson = lessonCounts(word);
    assert.equal(lesson.occurrences, item.lessons, `${word} lesson-text occurrences`);
    assert.equal(lesson.records, item.lessonRecords, `${word} matching lesson records`);
    const examples = questionsIt.questions.filter(question => exactCount(question.it, word) > 0).slice(0, 3);
    assert.ok(examples.length > 0, `${word} has a supplied Italian context`);
    for (const italian of examples) {
      const arabic = arabicById.get(italian.id);
      assert.ok(arabic?.ar, `${word} paired Arabic question ${italian.id}`);
      assert.equal(arabic.id, italian.id, `${word} paired question ID ${italian.id}`);
    }

    assert.equal(row.translation_ar, item.arabic, `${word} audited Arabic gloss`);
    if (item.decision === 'retained') {
      assert.equal(row.translation_ar, item.old, `${word} existing gloss remains untouched`);
      assert.equal(row.review_required, 1, `${word} ambiguity remains flagged`);
      assert.equal(row.status, item.status, `${word} original review status retained`);
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
    for (const source of item.sources) assert.ok(row.source.includes(source), `${word} opened evidence source ${source}`);
    if (item.decision === 'corrected') assert.notEqual(row.translation_ar, item.old, `${word} supported correction`);
    else assert.equal(row.translation_ar, item.old, `${word} unchanged-gloss confirmation`);
  }
});
