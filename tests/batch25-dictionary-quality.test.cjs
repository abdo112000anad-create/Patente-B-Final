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
const lessons = json('data/lessons-v2.json');

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
  const ids = [];
  for (const question of questionsIt) {
    const count = tokenMatches(question.it, term);
    if (!count) continue;
    tokenOccurrences += count;
    const paired = arabicById.get(String(question.id));
    assert.ok(paired, `Missing paired Arabic question ${question.id} for ${term}`);
    assert.equal(paired.it, question.it, `Italian text differs for question ${question.id}`);
    assert.equal(paired.answer, question.answer, `Answer differs for question ${question.id}`);
    assert.equal(paired.ar, question.ar, `Arabic text differs for question ${question.id}`);
    ids.push(String(question.id));
  }
  return { tokenOccurrences, ids: ids.sort() };
}

function lessonCounts(term) {
  let occurrences = 0;
  const ids = [];
  for (const module of lessons.modules) {
    for (const lesson of module.lessons || []) {
      const fields = [lesson.titleIt, lesson.summaryIt, lesson.trapWord?.word];
      for (const point of lesson.keyPoints || []) fields.push(point?.it);
      for (const check of lesson.quickChecks || []) fields.push(check?.qIt);
      const hits = fields.reduce((sum, value) => sum + tokenMatches(value, term), 0);
      occurrences += hits;
      if (hits) ids.push(lesson.id);
    }
  }
  return { occurrences, ids: ids.sort() };
}

const expectedContexts = {
  extraurbane: {
    questionTokens: 135,
    questionIds: 135,
    questionIdFingerprint: 'ccd9c9d15cb081925d85fe2ac406c3b22630ffe372745295e28502805a5bb63a',
    lessonTokens: 3,
    lessonIds: ['u6-l5'],
  },
  integrativo: {
    questionTokens: 190,
    questionIds: 190,
    questionIdFingerprint: 'b6d68d4569bea7d5b23322841874ffdf66ee74eddf3bafca7a54623c1c8f1fe2',
    lessonTokens: 3,
    lessonIds: ['u2-l4'],
  },
  tratto: {
    questionTokens: 131,
    questionIds: 131,
    questionIdFingerprint: '25d64a2f4007cf48b1fa5423dc8358426089b57b6ce5fb9997fec84ee62a6515',
    lessonTokens: 0,
    lessonIds: [],
  },
};

test('batch 25 context inventory covers every exact question and lesson occurrence', () => {
  for (const [term, expected] of Object.entries(expectedContexts)) {
    const questions = questionCounts(term);
    assert.equal(questions.tokenOccurrences, expected.questionTokens, `${term} token occurrences`);
    assert.equal(questions.ids.length, expected.questionIds, `${term} distinct question contexts`);
    assert.equal(sha256(questions.ids.join('\n')), expected.questionIdFingerprint, `${term} exact question-ID set`);
    assert.deepEqual(lessonCounts(term), {
      occurrences: expected.lessonTokens,
      ids: expected.lessonIds,
    }, `${term} exact lesson contexts`);
  }

  const integrativoQuestions = questionsIt.filter(question => tokenMatches(question.it, 'integrativo'));
  const panelQuestions = integrativoQuestions.filter(question => /\bpannello integrativo\b/i.test(question.it));
  assert.equal(panelQuestions.length, 189, '189 integrativo records concern pannello integrativo');
  assert.deepEqual(integrativoQuestions.filter(question => !/\bpannello integrativo\b/i.test(question.it)).map(question => String(question.id)), ['24536']);
  assert.match(integrativoQuestions.find(question => String(question.id) === '24536').it, /esame teorico integrativo/);
});

test('batch 25 corrects integrativo and tratto with source provenance', () => {
  const corrected = {
    integrativo: {
      translation: 'تكميلي',
      sourceUrls: [
        'https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?',
        'https://www.treccani.it/vocabolario/integrativo/',
      ],
    },
    tratto: {
      translation: 'جزء من الطريق؛ وقد تعني «مسافة/امتدادًا» بحسب السياق',
      sourceUrls: [
        'https://www.treccani.it/vocabolario/tratto2/',
        'https://aci.gov.it/codice-della-strada/art-3/',
        'https://www.almaany.com/ar/dict/ar-ar/%D8%AC%D8%B2%D8%A1/',
        'https://www.almaany.com/ar/dict/ar-ar/%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%A9/',
      ],
    },
  };

  for (const [term, expected] of Object.entries(corrected)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, expected.translation, `${term} Arabic gloss`);
    assert.equal(row.ui_fallback_ar, expected.translation, `${term} UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation');
    assert.equal(row.provider, 'project-contextual-audit');
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.match(row.source, /^question-bank-context-audit-2026-11;/);
    for (const url of expected.sourceUrls) assert.ok(row.source.includes(url), `${term} source URL ${url}`);
  }
});

test('batch 25 keeps the extraurbane candidate flagged because the exact Arabic legal equivalent is unresolved', () => {
  const row = entries.get('extraurbane');
  assert.ok(row, 'dictionary row exists for extraurbane');
  assert.equal(row.translation_ar, 'خارج المناطق المأهولة');
  assert.equal(row.ui_fallback_ar, '');
  assert.equal(row.translation_kind, 'contextual_translation_draft');
  assert.equal(row.provider, 'project-contextual-audit');
  assert.equal(row.status, 'contextual_candidate_needs_review');
  assert.equal(row.review_required, 1);
  assert.match(row.source, /^question-bank-context-audit-v65;/);
  assert.ok(row.source.includes('https://aci.gov.it/codice-della-strada/art-3/'));
  assert.ok(row.source.includes('https://www.treccani.it/vocabolario/extraurbano/'));
  assert.match(row.note, /مقترح مؤقت/u);
});

test('batch 25 leaves the mixed-sense guida entry unchanged and flagged', () => {
  const row = entries.get('guida');
  assert.ok(row, 'dictionary row exists for guida');
  assert.equal(row.translation_ar, 'مرشد');
  assert.equal(row.status, 'machine_draft_needs_review');
  assert.equal(row.review_required, 1);
  assert.equal(row.provider, 'opus-mt-local');
});

test('batch 25 global dictionary counts match the reviewed rows and unresolved draft', () => {
  assert.equal(dictionary.metadata.total_entries, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5075);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 85);
  assert.equal(dictionary.metadata.counts_by_status.contextual_candidate_needs_review, 3);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5033);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 261);
});

test('batch 25 preserves both paired question files and all official wording/answer keys', () => {
  assert.equal(sha256(fs.readFileSync(path.join(ROOT, 'data/questions.json'))),
    '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0');
  assert.equal(sha256(fs.readFileSync(path.join(ROOT, 'data/questions.it.json'))),
    '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada');
  assert.equal(questionsAr.length, 7020);
  assert.equal(questionsIt.length, 7020);
  assert.equal(arabicById.size, 7020);

  for (const italian of questionsIt) {
    const arabic = arabicById.get(String(italian.id));
    assert.ok(arabic, `paired Arabic record exists for ${italian.id}`);
    assert.equal(arabic.it, italian.it, `Italian wording is paired for ${italian.id}`);
    assert.equal(arabic.answer, italian.answer, `answer key is paired for ${italian.id}`);
    assert.equal(arabic.ar, italian.ar, `Arabic wording is paired for ${italian.id}`);
  }
});
