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

const correctedTerms = {
  ripartire: {
    translation: 'يستأنف السير',
    questionTokens: 3,
    questionIds: ['20790', '20976', '24009'],
    lessonTokens: 2,
    lessonIds: ['u6-l2'],
    source: 'https://dizionario.reverso.net/italiano-arabo/ripartire',
  },
  avverte: {
    translation: 'يُنَبِّهُ',
    questionTokens: 3,
    questionIds: ['19031', '19048', '21791'],
    lessonTokens: 1,
    lessonIds: ['u2-l2'],
    source: 'https://www.treccani.it/vocabolario/avvertire/',
  },
  indifferentemente: {
    translation: 'دون تفضيل؛ بحسب السياق: على حدّ سواء',
    questionTokens: 3,
    questionIds: ['18319', '23122', '23535'],
    lessonTokens: 0,
    lessonIds: [],
    source: 'https://dizionario.internazionale.it/parola/indifferentemente',
  },
};

test('batch 24 corrections match exact app contexts and retain source provenance', () => {
  for (const [term, expected] of Object.entries(correctedTerms)) {
    assert.deepEqual(questionCounts(term), {
      tokenOccurrences: expected.questionTokens,
      ids: expected.questionIds,
    }, `${term} exact question occurrences and IDs`);
    assert.deepEqual(lessonCounts(term), {
      occurrences: expected.lessonTokens,
      ids: expected.lessonIds,
    }, `${term} exact lesson occurrences and IDs`);

    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, expected.translation, `${term} Arabic gloss`);
    assert.equal(row.ui_fallback_ar, expected.translation, `${term} UI fallback`);
    assert.equal(row.translation_kind, 'contextual_translation');
    assert.equal(row.provider, 'project-contextual-audit');
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.match(row.source, /^question-bank-context-audit-2026-11;/);
    assert.ok(row.source.includes(expected.source), `${term} source URL is recorded`);
  }

  assert.equal(dictionary.metadata.total_entries, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5067);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 91);
  assert.equal(dictionary.metadata.counts_by_status.machine_draft_needs_review, 5025);
  assert.equal(dictionary.metadata.counts_by_status.reviewed_override, 269);
});

test('batch 24 leaves unresolved Arabic terms explicitly flagged as machine drafts', () => {
  const unresolved = {
    transitino: 'نقل',
    abitato: 'مأهول',
    abitati: 'مأهولة بالسكان',
    delineatore: 'المُعَيِّن',
  };
  for (const [term, translation] of Object.entries(unresolved)) {
    const row = entries.get(term);
    assert.ok(row, `dictionary row exists for ${term}`);
    assert.equal(row.translation_ar, translation, `${term} existing draft is unchanged`);
    assert.equal(row.status, 'machine_draft_needs_review', `${term} remains a draft`);
    assert.equal(row.review_required, 1, `${term} remains flagged`);
    assert.equal(row.provider, 'opus-mt-local');
  }
});

test('batch 24 preserves both paired question files and their Italian/answer/Arabic parity', () => {
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
