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

test('batch fourteen applies only supported contextual decisions and clears 18 reviewed flags', () => {
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
    curva: {old: 'منحنى', arabic: 'منعطف (للطريق)؛ منحنى/انحناء (للمسار الهندسي)', questions: 88, contexts: 86, lessons: 2, lessonRecords: 1, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/curva', 'glosbe.com/it/ar/curva', 'context.reverso.net/traduzione/italiano-arabo/curva']},
    sinistro: {old: 'يسار', arabic: 'أيسر؛ حادث (مروري)', questions: 76, contexts: 76, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/sinistro']},
    'visibilità': {old: 'مدى الرؤية', arabic: 'الرؤية؛ مدى/وضوح الرؤية بحسب السياق', questions: 75, contexts: 75, lessons: 10, lessonRecords: 5, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/visibilit']},
    arrestarsi: {old: '"التوقّف"', arabic: 'التوقّف', questions: 73, contexts: 73, lessons: 2, lessonRecords: 2, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/arrestarsi', 'context.reverso.net/traduzione/italiano-arabo/arrestarsi']},
    bambini: {old: 'الأطفال', arabic: 'الأطفال', questions: 63, contexts: 62, lessons: 1, lessonRecords: 1, decision: 'confirmed', sources: ['it.glosbe.com/it/ar/bambini', 'context.reverso.net/traduzione/italiano-arabo/bambini']},
    parcheggio: {old: 'موقف سيارات', arabic: 'موقف سيارات؛ ركن/وقوف السيارة بحسب السياق', questions: 59, contexts: 57, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/parcheggio', 'context.reverso.net']},
    incidente: {old: 'حادث', arabic: 'حادث', questions: 58, contexts: 57, lessons: 6, lessonRecords: 2, decision: 'confirmed', sources: ['dizionario.reverso.net/italiano-arabo/incidente']},
    carreggiate: {old: 'مركّب', arabic: 'أجزاء الطريق المخصّصة لسير المركبات', questions: 56, contexts: 56, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['context.reverso.net/traduzione/italiano-arabo/carreggiata', 'aci.gov.it/codice-della-strada/art-3']},
    arresto: {old: 'توقف بسبب حركة المرور', arabic: 'التوقّف؛ الاعتقال بحسب السياق', questions: 55, contexts: 55, lessons: 11, lessonRecords: 5, decision: 'corrected', sources: ['context.reverso.net/traduzione/italiano-arabo/arresto', 'gazzettaufficiale.it/atto/serie_generale']},
    frenatura: {old: 'فرامل', arabic: 'الكبح؛ الفرملة (فعل/نظام بحسب السياق)', questions: 52, contexts: 52, lessons: 0, lessonRecords: 0, decision: 'corrected', sources: ['context.reverso.net/traduzione/italiano-arabo/frenatura', 'treccani.it/vocabolario/frenatura']},
    marciapiede: {old: 'رصيف', arabic: 'رصيف', questions: 45, contexts: 45, lessons: 3, lessonRecords: 1, decision: 'confirmed', sources: ['context.reverso.net/traduzione/italiano-arabo/marciapiede']},
    ciclisti: {old: 'درّاجون', arabic: 'راكبو الدراجات الهوائية', questions: 44, contexts: 44, lessons: 3, lessonRecords: 2, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/ciclista', 'aci.gov.it/codice-della-strada/art-182']},
    casco: {old: 'خوذه', arabic: 'خوذة', questions: 44, contexts: 43, lessons: 4, lessonRecords: 1, decision: 'corrected', sources: ['context.reverso.net', 'dizionario.reverso.net/arabo-italiano']},
    pioggia: {old: 'مطر', arabic: 'مطر', questions: 42, contexts: 42, lessons: 2, lessonRecords: 2, decision: 'confirmed', sources: ['arabdict.com/it/italian-arabic/pioggia', 'dizionario.reverso.net/italiano-arabo/pioggia']},
    assicurazione: {old: 'التأمين', arabic: 'التأمين', questions: 41, contexts: 38, lessons: 5, lessonRecords: 1, decision: 'confirmed', sources: ['arabita.news/dizionario/2315', 'context.reverso.net/traduzione/italiano-arabo/assicurazione']},
    incidenti: {old: 'حوادث', arabic: 'حوادث', questions: 38, contexts: 38, lessons: 0, lessonRecords: 0, decision: 'confirmed', sources: ['context.reverso.net/traduzione/italiano-arabo/incidenti']},
    lampeggiante: {old: 'لامع', arabic: 'وامض؛ ضوء/مصباح وامض (للاسم)', questions: 38, contexts: 38, lessons: 1, lessonRecords: 1, decision: 'corrected', sources: ['dizionario.reverso.net/italiano-arabo/lampeggiante', 'aci.it/fileadmin/cds/art-41']},
    soccorso: {old: 'مساعدة', arabic: 'إسعاف؛ إنقاذ؛ مساعدة/إغاثة بحسب السياق', questions: 38, contexts: 37, lessons: 3, lessonRecords: 2, decision: 'corrected', sources: ['context.reverso.net/traduzione/italiano-arabo/soccorso', 'mit.gov.it/normativa/circolare-numero-3279']},
  };
  const representativeIds = {
    curva: [18924, 22361], sinistro: [21890, 24968], 'visibilità': [18939, 23845], arrestarsi: [20970, 19045],
    bambini: [21593, 24364], parcheggio: [20463, 23010], incidente: [22117, 22473], carreggiate: [18494, 22792],
    arresto: [23642, 24850], frenatura: [22602, 24082], marciapiede: [18518, 18521], ciclisti: [19182, 23974],
    casco: [24336, 24395], pioggia: [24710, 24160], assicurazione: [21212, 25046], incidenti: [22123, 31011],
    lampeggiante: [21037, 18429], soccorso: [21559, 21600],
  };

  assert.equal(Object.keys(expected).length, 18);
  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 73);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 83);
  assert.equal(dictionary.metadata.review_required_entries, 5097);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5097);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5053);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 239);

  for (const [word, item] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(questionOccurrences(word), item.questions, `${word} question-token occurrences`);
    assert.equal(distinctQuestionContexts(word), item.contexts, `${word} distinct question contexts`);
    const lesson = lessonCounts(word);
    assert.equal(lesson.occurrences, item.lessons, `${word} lesson-text occurrences`);
    assert.equal(lesson.records, item.lessonRecords, `${word} matching lesson records`);
    for (const id of representativeIds[word]) {
      const italian = questionsIt.questions.find(question => question.id === id);
      const arabic = arabicById.get(id);
      assert.ok(italian?.it, `${word} Italian question ${id}`);
      assert.ok(arabic?.ar, `${word} paired Arabic question ${id}`);
      assert.ok(exactCount(italian.it, word) > 0, `${word} exact token in question ${id}`);
      assert.equal(arabic.id, italian.id, `${word} paired question ID ${id}`);
    }

    assert.equal(row.translation_ar, item.arabic, `${word} reviewed Arabic gloss`);
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

    if (item.decision === 'corrected') {
      assert.notEqual(row.translation_ar, item.old, `${word} expected correction from old gloss`);
    } else {
      assert.equal(item.old, item.arabic, `${word} unchanged-gloss audit`);
      assert.equal(row.translation_ar, item.old, `${word} original gloss retained`);
    }
  }

  for (const word of ['figura', 'senso']) {
    assert.equal(byWord.get(word).review_required, 1, `${word} remains flagged outside this supported batch`);
  }
});
