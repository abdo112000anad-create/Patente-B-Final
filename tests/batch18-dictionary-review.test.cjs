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

test('batch eighteen applies only source-backed decisions and retains cambio flagged', () => {
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
    conducenti: {old:'السائقون', arabic:'السائقون', questions:87, contexts:85, lessons:1, lessonRecords:1, decision:'confirmed', sources:['context.reverso.net','treccani.it/vocabolario/conducente/','aci.it/fileadmin/cds/art-201.php']},
    segnaletica: {old:'الإشارات المرورية', arabic:'إشارات وعلامات المرور', questions:85, contexts:85, lessons:16, lessonRecords:5, decision:'corrected', sources:['dizionario.reverso.net/italiano-arabo/segnaletica+stradale','treccani.it/vocabolario/segnaletica/','aci.gov.it/codice-della-strada/art-38/']},
    precede: {old:'يسبق', arabic:'يسبق', questions:55, contexts:55, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/precedere','treccani.it/vocabolario/precedere/','aci.it/fileadmin/cds/art-149.php']},
    inversione: {old:'عكس', arabic:'عكس اتجاه السير', questions:47, contexts:47, lessons:1, lessonRecords:1, decision:'corrected', sources:['context.reverso.net','aci.gov.it/codice-della-strada/art-154/','treccani.it/vocabolario/inversione/']},
    segnalare: {old:'أبلغ', arabic:'يشير إلى / ينبّه إلى؛ يُبلّغ عن', questions:43, contexts:43, lessons:2, lessonRecords:2, decision:'corrected', sources:['context.reverso.net/traduzione/italiano-arabo/segnalare','it.glosbe.com/it/ar/segnalare','aci.it/fileadmin/cds/art-154.php']},
    incroci: {old:'تقاطعات', arabic:'تقاطعات', questions:42, contexts:42, lessons:1, lessonRecords:1, decision:'confirmed', sources:['dizionario.reverso.net/italiano-arabo/incrocio','aci.it/fileadmin/cds/art-145.php','treccani.it/vocabolario/incrocio/']},
    freccia: {old:'سهم', arabic:'سهم', questions:40, contexts:39, lessons:0, lessonRecords:0, decision:'confirmed', sources:['treccani.it/vocabolario/freccia/','context.reverso.net/traduzione/italiano-arabo/freccia']},
    retromarcia: {old:'رجوع إلى الخلف', arabic:'رجوع إلى الخلف', questions:36, contexts:36, lessons:7, lessonRecords:2, decision:'confirmed', sources:['treccani.it/vocabolario/retromarcia/','dizionario.reverso.net/italiano-arabo/retromarcia','aci.gov.it/codice-della-strada/art-176/']},
    cambio: {old:'ناقل الحركة', arabic:'ناقل الحركة', questions:36, contexts:36, lessons:0, lessonRecords:0, decision:'retained', status:'legacy_glossary_needs_review'},
    ostacolo: {old:'عائق', arabic:'عائق', questions:32, contexts:32, lessons:2, lessonRecords:1, decision:'confirmed', sources:['arabita.news/dizionario/1014','treccani.it/vocabolario/ostacolo/','aci.gov.it/codice-della-strada/art-162/']},
    fermo: {old:'قف', arabic:'متوقف', questions:32, contexts:32, lessons:0, lessonRecords:0, decision:'corrected', sources:['context.reverso.net/traduzione/italiano-arabo/fermo','treccani.it/vocabolario/fermo1/']},
    limiti: {old:'الحدود', arabic:'الحدود', questions:29, contexts:29, lessons:2, lessonRecords:2, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/limiti','aci.it/fileadmin/cds/art-142.php','treccani.it/vocabolario/limite/']},
    semafori: {old:'إشارات المرور', arabic:'إشارات المرور', questions:26, contexts:26, lessons:2, lessonRecords:2, decision:'confirmed', sources:['glosbe.com/it/ar/semaforo','aci.it/fileadmin/cds/art-41.php','treccani.it/vocabolario/semaforo/']},
    pista: {old:'المسار', arabic:'المسار', questions:26, contexts:26, lessons:0, lessonRecords:0, decision:'confirmed', sources:['context.reverso.net/traduzione/italiano-arabo/pista','treccani.it/vocabolario/pista/','glosbe.com/it/ar/Pista%20ciclabile']},
    asfalto: {old:'الأسفلت', arabic:'الأسفلت', questions:22, contexts:22, lessons:0, lessonRecords:0, decision:'confirmed', sources:['it.glosbe.com/it/ar/asfalto','treccani.it/vocabolario/asfalto/']},
    direzioni: {old:'الإتجاهات', arabic:'الإتجاهات', questions:18, contexts:18, lessons:0, lessonRecords:0, decision:'confirmed', sources:['arabdict.com/fr/italian-arabic/direzione','patente.it/normativa/articolo-40-cds','context.reverso.net']},
    attraversamenti: {old:'العبور', arabic:'المعابر', questions:14, contexts:14, lessons:3, lessonRecords:2, decision:'corrected', sources:['arabdict.com','glosbe.com/it/ar/attraversamento','treccani.it/vocabolario/attraversamento/']},
    mezzi: {old:'نصف', arabic:'مركبات / وسائل نقل', questions:13, contexts:12, lessons:1, lessonRecords:1, decision:'corrected', sources:['treccani.it/vocabolario/mezzo2/','glosbe.com/it/ar/mezzi','dictionary.reverso.net/italian-arabic/mezzi']},
  };

  const totals = Object.values(expected).reduce((sum, item) => ({
    questions: sum.questions + item.questions,
    contexts: sum.contexts + item.contexts,
    lessons: sum.lessons + item.lessons,
    lessonRecords: sum.lessonRecords + item.lessonRecords,
  }), {questions:0, contexts:0, lessons:0, lessonRecords:0});

  assert.equal(Object.keys(expected).length, 18);
  assert.deepEqual(totals, {questions:683, contexts:679, lessons:38, lessonRecords:20});
  assert.equal(questionsIt.count, 7020);
  assert.equal(questionsAr.questions.length, 7020);
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 66);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 81);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.review_required_entries, 5106);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5106);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5062);
  assert.equal(dictionary.metadata.counts_by_status.legacy_glossary_needs_review, 33);
  assert.equal(dictionary.metadata.counts_by_status.contextual_candidate_needs_review, 3);
  assert.equal(dictionary.metadata.counts_by_status.contextual_override_v49, 8);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 230);
  assert.equal(Object.values(expected).filter(item => item.decision === 'corrected').length, 6);
  assert.equal(Object.values(expected).filter(item => item.decision === 'confirmed').length, 11);
  assert.equal(Object.values(expected).filter(item => item.decision === 'retained').length, 1);

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
    assert.match(row.note, new RegExp(`${item.questions} question-token occurrence`, 'u'), word);
    for (const source of item.sources) assert.ok(row.source.includes(source), `${word} opened source ${source}`);
    if (item.decision === 'corrected') assert.notEqual(row.translation_ar, item.old, `${word} supported correction`);
    else assert.equal(row.translation_ar, item.old, `${word} unchanged confirmation`);
  }
});
