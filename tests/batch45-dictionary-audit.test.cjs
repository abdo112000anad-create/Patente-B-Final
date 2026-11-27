'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = process.env.PATENTEB_ROOT || path.resolve(__dirname, '..');
const json = relative => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const dictionary = json('data/italian_arabic_dictionary_lookup.json');
const entries = new Map(dictionary.entries.map(row => [row.word.normalize('NFC').toLocaleLowerCase('it'), row]));
const questionsAr = json('data/questions.json').questions;
const questionsIt = json('data/questions.it.json').questions;
const arabicById = new Map(questionsAr.map(row => [String(row.id), row]));

function escaped(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function tokenMatches(text, term) {
  const normalized = String(text || '').normalize('NFC');
  const expression = new RegExp(`(?<![\\p{L}\\p{M}])${escaped(term.normalize('NFC'))}(?![\\p{L}\\p{M}])`, 'giu');
  return [...normalized.matchAll(expression)].length;
}

function isItalianTextField(key) {
  return key === 'it' || key === 'qIt' || key === 'source_name' || key.endsWith('It') || /(?:^|_)it$/iu.test(key);
}

function italianFieldMatches(value, term, pathParts = [], inheritedItalian = false, matches = []) {
  let occurrences = 0;
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      occurrences += italianFieldMatches(item, term, [...pathParts, String(index)], inheritedItalian, matches);
    });
  } else if (value && typeof value === 'object') {
    for (const [childKey, child] of Object.entries(value)) {
      const childPath = [...pathParts, childKey];
      const childIsItalian = isItalianTextField(childKey);
      if (typeof child === 'string' && childIsItalian) {
        const count = tokenMatches(child, term);
        occurrences += count;
        if (count) matches.push({ path: childPath.join('.'), count });
      } else if (child && typeof child === 'object') {
        occurrences += italianFieldMatches(child, term, childPath, childIsItalian, matches);
      }
    }
  } else if (typeof value === 'string' && inheritedItalian) {
    const count = tokenMatches(value, term);
    occurrences += count;
    if (count) matches.push({ path: pathParts.join('.'), count });
  }
  return occurrences;
}

const expected = {
  lavori: {
    questionTokens: 37, questionRecords: 37, uniqueItalianTexts: 34, uniquePairedTexts: 36,
    questionIdFingerprint: '4114debda0a0c90f12c1e1041271a53db6f156b80e59bd4302ead7a0dab4f396',
    lessons: {
      'data/lessons-v2.json': ['modules.2.lessons.3.quickChecks.1.qIt', 'modules.2.lessons.3.quickChecks.2.qIt', 'modules.2.title_it'],
      'data/lessons.json': ['modules.2.lessons.3.quickCheck.1.qIt', 'modules.2.lessons.3.quickCheck.2.qIt', 'modules.2.title_it'],
    },
  },
  titolare: {
    questionTokens: 37, questionRecords: 37, uniqueItalianTexts: 37, uniquePairedTexts: 37,
    questionIdFingerprint: '3aa1e7690dd4e4858a17e363c28f35e387a6460ee68b761b6bdb3b304f9cb485',
    lessons: { 'data/lessons-v2.json': [], 'data/lessons.json': [] },
  },
  giungendo: {
    questionTokens: 46, questionRecords: 46, uniqueItalianTexts: 45, uniquePairedTexts: 46,
    questionIdFingerprint: 'c8b04de35c546c359f6bda5556da27341182812818e6cfa2933867176253596a',
    lessons: { 'data/lessons-v2.json': [], 'data/lessons.json': [] },
  },
  viaggia: {
    questionTokens: 40, questionRecords: 40, uniqueItalianTexts: 40, uniquePairedTexts: 40,
    questionIdFingerprint: '3f263c72ff1ed3722f30b23147947f47e6ee73bb9a147950eca99a87d923dcbb',
    lessons: {
      'data/lessons-v2.json': ['modules.6.quiz.0.prompt_it'],
      'data/lessons.json': ['modules.6.quiz.0.prompt_it'],
    },
  },
  pressione: {
    questionTokens: 36, questionRecords: 35, uniqueItalianTexts: 35, uniquePairedTexts: 35,
    questionIdFingerprint: '49a347547dc0bb9c326541b348bb8f59d56b7ba106ee8b12ddea0559da6d7947',
    lessons: {
      'data/lessons-v2.json': ['modules.6.lessons.0.summaryIt', 'modules.6.lessons.0.keyPoints.1.it', 'modules.6.lessons.0.quickChecks.1.qIt'],
      'data/lessons.json': ['modules.6.lessons.0.summaryIt', 'modules.6.lessons.0.keyPoints.1.it', 'modules.6.lessons.0.quickCheck.1.qIt'],
    },
  },
};

const priorForms = {
  lavori: ['lavoro', 'lavori', 'lavorare', 'lavora', 'lavorano', 'lavorando', 'lavorato', 'lavorata', 'lavorati', 'lavorate', 'lavoratore', 'lavoratori', 'lavoratrice', 'lavoratrici'],
  titolare: ['titolare', 'titolari'],
  giungendo: ['giungere', 'giungo', 'giungi', 'giunge', 'giungiamo', 'giungono', 'giungendo', 'giunto', 'giunta', 'giunti', 'giunte', 'giungerà', 'giungeranno'],
  viaggia: ['viaggiare', 'viaggia', 'viaggio', 'viaggi', 'viaggiano', 'viaggiando', 'viaggiato', 'viaggiata', 'viaggiati', 'viaggiate', 'viaggerà'],
  pressione: ['pressione', 'pressioni'],
};

const sourceHashes = {
  'data/questions.json': '72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0',
  'data/questions.it.json': '4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada',
  'data/lessons.json': '7f91d6cdd6cca92d750287d9b90737e91b8e5763d1f5922824ffc187afe9c4dd',
  'data/lessons-v2.json': '09a66320c1fa91fb1291f771ab471143708388f7eaf71e2108a203f3bba80e25',
};

const resolved = {
  lavori: 'أعمال (جمع lavoro؛ يتحدد المقابل بحسب السياق)',
  titolare: 'حامل (الرخصة/الوثيقة/الحق)؛ وفي هذه المجموعة: حامل رخصة القيادة',
  giungendo: 'عند الوصول (إلى)؛ وفي سياق الاقتراب من التقاطع: عند الاقتراب (من)',
};

const requiredSources = [
  'https://www.treccani.it/vocabolario/lavoro/',
  'https://context.reverso.net/traduzione/italiano-arabo/lavori',
  'https://dizionario.reverso.net/italiano-arabo/titolare',
  'https://context.reverso.net/traduzione/italiano-arabo/titolare',
  'https://www.treccani.it/vocabolario/giungere/',
  'https://www.treccani.it/enciclopedia/gerundio/',
  'https://context.reverso.net/traduzione/italiano-arabo/giungendo',
  'https://www.treccani.it/vocabolario/viaggiare/',
  'https://it.glosbe.com/it/ar/viaggiare',
  'https://context.reverso.net/traduzione/italiano-arabo/viaggiare',
  'https://www.treccani.it/vocabolario/pressione/',
  'https://context.reverso.net/traduzione/italiano-arabo/pressione',
];

function sqliteAudit() {
  const script = String.raw`
import json, sqlite3, sys
path = sys.argv[1]
db = sqlite3.connect(path)
db.row_factory = sqlite3.Row
integrity = db.execute('PRAGMA integrity_check').fetchone()[0]
count = db.execute('SELECT COUNT(*) FROM Dictionary').fetchone()[0]
review_required = db.execute('SELECT COUNT(*) FROM Dictionary WHERE Review_Required = 1').fetchone()[0]
status_counts = dict(db.execute('SELECT Status, COUNT(*) FROM Dictionary GROUP BY Status'))
metadata = dict(db.execute('SELECT Key, Value FROM Metadata'))
words = ('lavori', 'titolare', 'giungendo', 'viaggia', 'pressione')
rows = {}
for row in db.execute('SELECT Italian_Word, Arabic_Translation, Translation_Kind, Source, Provider, Status, Review_Required, Note FROM Dictionary WHERE lower(Italian_Word) IN (?, ?, ?, ?, ?)', tuple(words)):
    rows[row['Italian_Word'].lower()] = dict(row)
print(json.dumps({'integrity': integrity, 'count': count, 'review_required': review_required, 'status_counts': status_counts, 'metadata': metadata, 'rows': rows}, ensure_ascii=False))
db.close()
`;
  const output = execFileSync('python3', ['-c', script, path.join(ROOT, 'android/app/src/main/assets/dictionary.db')], { encoding: 'utf8' });
  return JSON.parse(output);
}

test('batch 45 terms and all stated inflections are absent from the 60 earlier audit notes/tests', () => {
  const noteDir = path.join(ROOT, 'docs');
  const testDir = path.join(ROOT, 'tests');
  const previousNotes = fs.readdirSync(noteDir).filter(name => {
    const match = name.match(/batch[-_]?([0-9]+)/iu);
    return name.endsWith('.md') && match && Number(match[1]) < 45;
  });
  const previousTests = fs.readdirSync(testDir).filter(name => {
    const match = name.match(/^batch([0-9]+)-.*\.test\.cjs$/u);
    return match && Number(match[1]) < 45;
  });
  previousTests.push('v40-dictionary-app.test.cjs');
  const files = [...new Set([...previousNotes.map(name => path.join(noteDir, name)), ...previousTests.map(name => path.join(testDir, name))])];
  assert.equal(files.length, 60, 'all 60 earlier audit notes/tests are included');
  for (const [term, forms] of Object.entries(priorForms)) {
    for (const file of files) {
      assert.ok(fs.existsSync(file), `prior audit file exists: ${file}`);
      const contents = fs.readFileSync(file, 'utf8').normalize('NFC');
      for (const form of forms) {
        const reference = new RegExp(`(?<![\\p{L}\\p{M}])${escaped(form)}(?![\\p{L}\\p{M}])`, 'iu');
        assert.doesNotMatch(contents, reference, `${term}/${form} must not repeat coverage in ${path.basename(file)}`);
      }
    }
  }
});

test('batch 45 pins exact question-token totals and verifies each paired Arabic context by ID', () => {
  assert.equal(questionsIt.length, 7020);
  assert.equal(questionsAr.length, 7020);
  for (const [term, expectedTerm] of Object.entries(expected)) {
    let tokenOccurrences = 0;
    const ids = [];
    const italianTexts = new Set();
    const pairedTexts = new Set();
    for (const question of questionsIt) {
      const count = tokenMatches(question.it, term);
      if (!count) continue;
      tokenOccurrences += count;
      const paired = arabicById.get(String(question.id));
      assert.ok(paired, `Missing paired Arabic question ${question.id} for ${term}`);
      assert.equal(paired.it, question.it, `Italian text differs for question ${question.id}`);
      assert.equal(paired.answer, question.answer, `Answer differs for question ${question.id}`);
      assert.ok(paired.ar, `Arabic pair is empty for question ${question.id}`);
      ids.push(String(question.id));
      italianTexts.add(question.it);
      pairedTexts.add(`${question.it}\u0000${paired.ar}`);
    }
    assert.equal(tokenOccurrences, expectedTerm.questionTokens, `${term} question-token count`);
    assert.equal(ids.length, expectedTerm.questionRecords, `${term} paired question records`);
    assert.equal(italianTexts.size, expectedTerm.uniqueItalianTexts, `${term} unique Italian contexts`);
    assert.equal(pairedTexts.size, expectedTerm.uniquePairedTexts, `${term} unique Italian-Arabic pairs`);
    assert.equal(sha256(ids.join(String.fromCharCode(10))), expectedTerm.questionIdFingerprint, `${term} exact question-ID set`);
  }
});

test('batch 45 pins all Italian-designated lesson paths in current and legacy files', () => {
  for (const [term, expectedTerm] of Object.entries(expected)) {
    for (const [relative, expectedPaths] of Object.entries(expectedTerm.lessons)) {
      const matches = [];
      const occurrences = italianFieldMatches(json(relative), term, [], false, matches);
      assert.equal(occurrences, expectedPaths.length, `${term} lesson-field occurrences in ${relative}`);
      assert.deepEqual(matches.map(match => match.path).sort(), expectedPaths.slice().sort(), `${term} exact Italian lesson paths in ${relative}`);
    }
  }
});

test('batch 45 applies three corrections, confirms pressione, and keeps viaggia flagged', () => {
  for (const [term, translation] of Object.entries(resolved)) {
    const row = entries.get(term);
    assert.ok(row, `${term} dictionary row exists`);
    assert.equal(row.translation_ar, translation, `${term} translation`);
    assert.equal(row.translation_kind, 'contextual_translation', `${term} translation kind`);
    assert.equal(row.status, 'reviewed_override', `${term} status`);
    assert.equal(row.provider, 'project-contextual-audit', `${term} provenance`);
    assert.equal(row.review_required, 0, `${term} review flag`);
    assert.equal(row.ui_fallback_ar, translation, `${term} fallback`);
    assert.match(row.source, /question-bank-context-audit-2026-11;/u);
    assert.match(row.note, /Project-reviewed, not owner-approved\./u);
  }
  assert.match(entries.get('lavori').source, /Treccani.*Reverso Context/u);
  assert.match(entries.get('titolare').source, /Reverso Italian-Arabic dictionary.*Reverso Context/u);
  assert.match(entries.get('giungendo').source, /Treccani.*gerundio.*Reverso Context/u);

  const pressione = entries.get('pressione');
  assert.ok(pressione, 'pressione dictionary row exists');
  assert.equal(pressione.translation_ar, 'الضغط');
  assert.equal(pressione.translation_kind, 'contextual_translation');
  assert.equal(pressione.status, 'reviewed_override');
  assert.equal(pressione.provider, 'project-contextual-audit');
  assert.equal(pressione.review_required, 0);
  assert.equal(pressione.ui_fallback_ar, 'الضغط');
  assert.match(pressione.source, /question-bank-context-confirmation-2026-11;/u);
  assert.match(pressione.source, /Treccani.*Reverso Context/u);
  assert.match(pressione.note, /Project-reviewed, not owner-approved\./u);

  const viaggia = entries.get('viaggia');
  assert.ok(viaggia, 'viaggia dictionary row exists');
  assert.equal(viaggia.translation_ar, 'سافر', 'ambiguous machine gloss retained unchanged');
  assert.equal(viaggia.translation_kind, 'machine_translation');
  assert.equal(viaggia.source, 'Helsinki-NLP/opus-mt-it-ar@11004c1520b360d6955a0b52c85db0c2e2e696f4');
  assert.equal(viaggia.provider, 'opus-mt-local');
  assert.equal(viaggia.status, 'machine_draft_needs_review');
  assert.equal(viaggia.review_required, 1);
  assert.equal(viaggia.ui_fallback_ar, '');
});

test('batch 45 note includes opened sources and discloses review limits', () => {
  const note = fs.readFileSync(path.join(ROOT, 'docs/dictionary-audit-batch45-2026-11-27.md'), 'utf8');
  for (const source of requiredSources) assert.ok(note.includes(source), `audit note cites ${source}`);
  for (const term of Object.keys(expected)) assert.ok(note.includes(`\`${term}\``), `audit note covers ${term}`);
  assert.match(note, /لم يظهر أي تكرار/u);
  assert.match(note, /بقيت `viaggia` معلّمة للمراجعة/u);
  assert.match(note, /ليست موافقة مالك التطبيق/u);
  assert.match(note, /لا تثبت معيارًا عربيًا قانونيًا/u);
  assert.match(note, /لم يُجر اختبار Android على جهاز/u);
});

test('batch 45 pins cumulative JSON and SQLite metadata, integrity, and reviewed rows', () => {
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(dictionary.metadata.review_required_entries, 5067);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 3);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 91);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 95);
  assert.deepEqual(dictionary.metadata.counts_by_status, {
    contextual_candidate_needs_review: 3,
    contextual_override_v49: 8,
    legacy_glossary_needs_review: 31,
    machine_draft_needs_review: 5025,
    reviewed_override: 269,
  });
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5067);

  for (const [relative, digest] of Object.entries(sourceHashes)) {
    assert.equal(sha256(fs.readFileSync(path.join(ROOT, relative))), digest, `${relative} source fingerprint`);
  }

  const sqlite = sqliteAudit();
  assert.equal(sqlite.integrity, 'ok');
  assert.equal(sqlite.count, 5336);
  assert.equal(sqlite.review_required, 5067);
  assert.deepEqual(sqlite.status_counts, dictionary.metadata.counts_by_status);
  assert.equal(sqlite.metadata.verified_question_bank_context_correction_rows, '91');
  assert.equal(sqlite.metadata.verified_question_bank_context_gloss_confirmation_rows, '95');
  assert.equal(sqlite.metadata.reviewed_override_rows, '269');
  assert.equal(sqlite.metadata.word_count, '5336');
  assert.deepEqual(Object.keys(sqlite.rows).sort(), Object.keys(expected).sort());
  for (const term of Object.keys(expected)) {
    const jsonRow = entries.get(term);
    const dbRow = sqlite.rows[term];
    assert.equal(dbRow.Arabic_Translation, jsonRow.translation_ar, `${term} SQLite translation`);
    assert.equal(dbRow.Translation_Kind, jsonRow.translation_kind, `${term} SQLite translation kind`);
    assert.equal(dbRow.Source, jsonRow.source, `${term} SQLite source`);
    assert.equal(dbRow.Provider, jsonRow.provider, `${term} SQLite provider`);
    assert.equal(dbRow.Status, jsonRow.status, `${term} SQLite status`);
    assert.equal(dbRow.Review_Required, jsonRow.review_required, `${term} SQLite review flag`);
    assert.equal(dbRow.Note, jsonRow.note, `${term} SQLite note`);
  }
});
