'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

test('v64 app dictionary contains auditable rows and excludes isolated letter artifacts', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questions = json('data/questions.json');
  assert.equal(dictionary.schema_version, 1);
  assert.equal(dictionary.metadata.source_question_count, questions.questions.length);
  assert.equal(dictionary.metadata.app_release, 64);
  assert.equal(dictionary.metadata.unique_question_bank_terms, 5277);
  assert.equal(dictionary.metadata.total_entries, 5336);
  assert.equal(dictionary.entries.length, 5336);
  assert.equal(new Set(dictionary.entries.map(row => row.word)).size, dictionary.entries.length);
  for (const row of dictionary.entries) {
    assert.ok(row.word);
    assert.ok(row.source);
    assert.ok(row.provider);
    assert.ok(['reviewed_override', 'legacy_glossary_needs_review', 'machine_draft_needs_review', 'contextual_override_v49', 'contextual_candidate_needs_review'].includes(row.status));
    assert.ok(row.confidence === null || Number.isFinite(row.confidence));
    assert.ok(row.review_required === 0 || row.review_required === 1);
  }
  assert.equal(dictionary.metadata.counts_by_status.contextual_override_v49, 8);
});

test('v64 context candidates retain two unresolved flags while frenare is source-confirmed', async () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questions = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  assert.match(questions.source, /Ministero delle Infrastrutture e dei Trasporti/u);
  assert.equal(questions.questions.filter(row => /\bfrenare\b/iu.test(row.it)).length, 15);
  assert.equal(questions.questions.filter(row => /\babbagliante\b/iu.test(row.it)).length, 28);
  assert.equal(questions.questions.filter(row => /\babbagliant\w*/iu.test(row.it)).length, 38);
  assert.equal(questions.questions.filter(row => /\banabbagliant\w*/iu.test(row.it)).length, 37);
  assert.equal(questions.questions.filter(row => /\babbagliamento\b/iu.test(row.it)).length, 2);
  assert.equal(dictionary.metadata.question_bank_context_correction_candidates, 2);
  assert.equal(dictionary.metadata.counts_by_status.contextual_candidate_needs_review, 2);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  const expected = {
    abbagliante: { arabic: 'الضوء العالي / مُبهِر', source: /Reverso/u },
    abbagliamento: { arabic: 'الإبهار الضوئي / وهج يعيق الرؤية', source: /Translate\.com/u },
  };
  const translation = await import(path.join(root, 'src/lesson-translation.mjs'));
  translation.setGeneratedDictionary(dictionary.entries);
  const frenare = byWord.get('frenare');
  assert.equal(frenare.translation_ar, 'يفرمل / يكبح');
  assert.equal(frenare.status, 'reviewed_override');
  assert.equal(frenare.review_required, 0);
  assert.match(frenare.source, /question-bank-context-confirmation-2026-11;/u);
  const frenareResult = translation.translateTappedWord('frenare', []);
  assert.equal(frenareResult.arabic, frenare.translation_ar);
  assert.equal(frenareResult.status, 'reviewed_override');
  for (const [word, expectedRow] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, expectedRow.arabic, word);
    assert.equal(row.status, 'contextual_candidate_needs_review', word);
    assert.equal(row.review_required, 1, word);
    assert.equal(row.ui_fallback_ar, '', word);
    assert.equal(row.confidence, null, word);
    assert.equal(row.provider, 'project-contextual-audit', word);
    assert.match(row.source, expectedRow.source, word);
    assert.match(row.note, /اقتراح.*مراجعة بشرية/u, word);
    const result = translation.translateTappedWord(word, []);
    assert.equal(result.arabic, row.translation_ar, word);
    assert.equal(result.status, 'contextual_candidate_needs_review', word);
    assert.equal(result.note, row.note, word);
    assert.equal(result.hasLexicalTranslation, true, word);
  }
});

test('existing and Abdul-approved v42 corrections plus the v47 lemma are reviewed; model drafts need review', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  for (const [word, arabic] of [
    ['corsia', 'حارة سير'],
    ['carreggiata', 'الطريق المخصص للمركبات'],
    ['prudenza', 'حذر'],
  ]) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, arabic);
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.equal(row.provider, 'owner-approved-override');
    assert.equal(row.confidence, null);
  }
  const corrected = {
    diano: 'لاحقة بمعنى (يومي) - جزء من كلمة وليست كلمة مستقلة',
    diciannove: 'تسعة عشر (19)',
    gpl: 'غاز البترول المسال (GPL)',
    hashish: 'حشيش (مادة مخدرة)',
    i: 'أداة تعريف للجمع المذكر',
    imposti: 'مفروضة / مقررة',
    kg: 'كيلوغرام (كجم)',
    planoaltimetrico: 'مخطط الطريق (المسقط الأفقي والارتفاعي)',
    sedici: 'ستة عشر (16)',
  };
  for (const [word, arabic] of Object.entries(corrected)) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, arabic);
    assert.equal(row.status, 'reviewed_override');
    assert.equal(row.review_required, 0);
    assert.equal(row.provider, 'Abdul');
    assert.equal(row.source, 'owner-approved-correction-v42');
  }
  const requestedLemma = byWord.get('riconoscere');
  assert.equal(requestedLemma.translation_ar, 'يتعرف على');
  assert.equal(requestedLemma.source, 'user-requested-lemma-v47');
  assert.equal(requestedLemma.status, 'reviewed_override');
  assert.equal(requestedLemma.review_required, 0);
  const spellingLemma = byWord.get('spiegazione');
  assert.equal(spellingLemma.translation_ar, 'شرح / تفسير');
  assert.equal(spellingLemma.source, 'user-requested-lemma-v51');
  assert.equal(spellingLemma.status, 'reviewed_override');
  assert.equal(spellingLemma.review_required, 0);
  assert.match(byWord.get('diano').note, /ليست كلمة إيطالية مستقلة/u);
  for (const artifact of ['b', 'f', 'g', 'h', 'p', 'v', 'x']) assert.equal(byWord.has(artifact), false);
  for (const row of dictionary.entries.filter(row => row.status === 'machine_draft_needs_review')) {
    assert.equal(row.review_required, 1);
    assert.equal(row.confidence, null);
    assert.equal(row.provider, 'opus-mt-local');
  }
});

test('v63 lesson vocabulary includes reviewed Arabic translations for every missing lemma and used form', async () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const expected = {
    distingue: 'يميز / يفرق', distinguere: 'يميز / يفرق',
    appartengono: 'تنتمي / تندرج ضمن', appartenere: 'ينتمي إلى / يندرج ضمن',
    ignorare: 'يتجاهل', aggiornamenti: 'تحديثات', aggiornamento: 'تحديث',
    testo: 'نصّ', fonti: 'مصادر', fonte: 'مصدر', ufficiali: 'رسمية', ufficiale: 'رسمي',
    pubblicazione: 'نشر / إصدار', coincide: 'يتطابق / يتزامن', coincidere: 'يتطابق / يتزامن',
    consultare: 'يراجع', notizia: 'خبر', gruppi: 'مجموعات', gruppo: 'مجموعة',
    prescrivono: 'تفرض / تُلزِم', prescrive: 'يفرض / يُلزِم', prescrivere: 'يفرض / يُلزِم',
    sembra: 'يبدو', sembrare: 'يبدو', ambito: 'نطاق / مجال السريان',
    leggono: 'تُقرأ', leggere: 'يقرأ', interpretato: 'مُفسَّر', interpretare: 'يفسّر',
    organizzare: 'ينظّم', prevalere: 'يسود / تكون له الأولوية على', critici: 'حرجة / خطرة', critico: 'حرِج / خطِر',
    incrociarsi: 'تتقاطع مساراتها', traiettorie: 'مسارات المركبات', utente: 'مستخدم للطريق', vulnerabile: 'معرّض للخطر / ضعيف الحماية',
    ambulanza: 'سيارة إسعاف', emergenze: 'حالات الطوارئ', urgente: 'عاجل', angoli: 'زوايا', ciechi: 'عمياء', indicatore: 'إشارة الاتجاه',
    spia: 'مؤشر تحذير', spie: 'مؤشرات تحذير',
    meteo: 'الأحوال الجوية', sfavorevole: 'غير ملائم / سيئ', avverse: 'غير ملائمة / قاسية', allontanamento: 'الابتعاد',
    immobilizzarlo: 'تثبيته ومنعه من الحركة', disposizioni: 'أحكام / قواعد', rotatoria: 'دوّار مروري', riservata: 'مخصّصة',
    retrovisore: 'مرآة الرؤية الخلفية', morto: 'ميت؛ وفي angolo morto تعني أعمى', dosso: 'نتوء / مطب مرتفع',
    segnalazioni: 'إشارات / تنبيهات', acustiche: 'صوتية', sicurezza: 'السلامة', spazio: 'مساحة / حيّز متاح',
    occupante: 'راكب / شاغل المركبة', identificazione: 'التعريف / تحديد الهوية', documentale: 'متعلق بالوثائق / مستندي',
    autorità: 'السلطات / الجهات المختصة', legale: 'قانوني', vigente: 'نافذ / ساري المفعول',
  };
  assert.equal(Object.keys(expected).length, 66);
  assert.equal(dictionary.metadata.lesson_dictionary_audit_additions, 64);
  const translation = await import(path.join(root, 'src/lesson-translation.mjs'));
  translation.setGeneratedDictionary(dictionary.entries);
  for (const [word, arabic] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.equal(row?.translation_ar, arabic, word);
    assert.equal(row?.status, 'reviewed_override', word);
    assert.equal(row?.review_required, 0, word);
    const result = translation.translateTappedWord(word, []);
    assert.equal(result.arabic, arabic, word);
    assert.equal(result.status, 'reviewed_override', word);
    assert.equal(result.hasLexicalTranslation, true, word);
  }
  for (const word of ['rotatoria', 'riservata', 'retrovisore', 'morto', 'dosso', 'segnalazioni', 'acustiche', 'sicurezza', 'spazio']) {
    assert.equal(byWord.get(word).source, 'lesson-dictionary-audit-v62', word);
  }
  for (const word of ['spia', 'spie']) {
    assert.equal(byWord.get(word).source, 'lesson-dictionary-audit-v63', word);
  }
  const prevailing = translation.translateTappedWord('prevalgono', []);
  assert.equal(prevailing.arabic, 'تتقدّم على');
  assert.equal(prevailing.status, 'contextual_override_v49');
});

test('v49 contextual lookups cover earlier video terms and show their context note', async () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const translation = await import(path.join(root, 'src/lesson-translation.mjs'));
  translation.setGeneratedDictionary(dictionary.entries);
  const expected = {
    seguite: 'مُتَّبَعة', tra: 'بين', degli: 'مِنَ الـ / لِـ', essere: 'أن يكون / يكون',
    prevalgono: 'تتقدّم على', senza: 'دون / بدون', questa: 'هذه', sottocategoria: 'فئة فرعية',
  };
  for (const [word, arabic] of Object.entries(expected)) {
    const result = translation.translateTappedWord(word, []);
    assert.equal(result.arabic, arabic, word);
    assert.equal(result.status, 'contextual_override_v49', word);
    assert.match(result.note, /سياق|سياقي|تركيب/u, word);
  }
  const signage = translation.translateTappedWord('segnaletica', []);
  assert.equal(signage.arabic, 'إشارات وعلامات المرور');
  assert.equal(signage.status, 'reviewed_override');
});

test('compact lookup asset is in the offline PWA and its release hash matches', () => {
  const sw = read('public/sw.js');
  const build = read('scripts/build-pwa.cjs');
  const release = json('public/release.json');
  const sourcePath = path.join(root, 'data/italian_arabic_dictionary_lookup.json');
  const assetHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
  assert.match(sw, /'\/data\/italian_arabic_dictionary_lookup\.json'/u);
  assert.match(sw, /validJsonPayload\('\/data\/italian_arabic_dictionary_lookup\.json'/u);
  assert.match(build, /'italian_arabic_dictionary_lookup\.json'/u);
  assert.equal(release.dictionarySha256, assetHash);
  const distPath = path.join(root, 'dist/data/italian_arabic_dictionary_lookup.json');
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(distPath)).digest('hex'), assetHash);
});

test('service-worker validator accepts the current dictionary schema and contextual overrides', () => {
  const vm = require('node:vm');
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const sandbox = { self: { addEventListener() {} } };
  vm.runInNewContext(`${read('public/sw.js')}\nglobalThis.__validateJsonPayload = validJsonPayload;`, sandbox);
  assert.notEqual(dictionary.metadata.unique_question_bank_terms, dictionary.entries.length);
  assert.equal(sandbox.__validateJsonPayload('/data/italian_arabic_dictionary_lookup.json', dictionary), true);
});

test('local word-lookup loader serves a single isolated word and never presents model output as reviewed', async () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const translation = await import(path.join(root, 'src/lesson-translation.mjs'));
  const loaded = await translation.loadLocalWordDictionary('/data/italian_arabic_dictionary_lookup.json', async url => ({
  ok: url === '/data/italian_arabic_dictionary_lookup.json',
  json: async () => dictionary,
}));
  assert.equal(loaded, 5336);
  assert.equal(translation.wordAtOffset('La corsia è libera.', 4), 'corsia');
  const approved = translation.translateTappedWord('corsia', []);
  assert.equal(approved.word, 'corsia');
  assert.equal(approved.arabic, 'حارة سير');
  assert.equal(approved.status, 'reviewed_override');
  const machineWord = dictionary.entries.find(row => row.status === 'machine_draft_needs_review');
  assert.ok(machineWord);
  const draft = translation.translateTappedWord(machineWord.word, []);
  assert.equal(draft.word, machineWord.word);
  assert.equal(draft.status, 'machine_draft_needs_review');
  assert.match(draft.note, /مسودة ترجمة آلية غير مراجعة/u);
  assert.equal(draft.confidence, null);
});

test('frequent question-bank dictionary corrections are backed by exact contexts and direct Italian-Arabic sources', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  const expected = {
    veicoli: { arabic: 'مركبات', count: 955, id: 21823, source: /dizionario\.reverso\.net\/italiano-arabo\/veicoli/u, context: /جميع المركبات/u },
    indica: { arabic: 'يشير إلى / يبيّن', count: 911, id: 22106, source: /dizionario\.reverso\.net\/italiano-arabo\/indica/u, context: /تشير إلى مقطع طريق/u },
    preannuncia: { arabic: 'ينذر / يعلن مسبقًا', count: 422, id: 20454, source: /dizionario\.reverso\.net\/italiano-arabo\/preannunciare/u, context: /عن منعطف إلزامي/u },
    transito: { arabic: 'مرور / عبور', count: 330, id: 21343, source: /dizionario\.reverso\.net\/italiano-arabo\/transito/u, context: /مرور المركبات/u },
  };
  assert.equal(questionsIt.count, 7020);
  assert.match(questionsIt.sourceUrl, /ilportaledellautomobilista\.it/u);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  for (const [word, item] of Object.entries(expected)) {
    const row = byWord.get(word);
    assert.equal(questionsIt.questions.reduce((count, question) => count + (question.it.match(new RegExp(`\\b${word}\\b`, 'giu')) || []).length, 0), item.count, word);
    const question = questionsIt.questions.find(candidate => candidate.id === item.id);
    assert.ok(question?.it.includes(word), word);
    assert.match(arabicById.get(item.id).ar, item.context, word);
    assert.equal(row.translation_ar, item.arabic, word);
    assert.equal(row.ui_fallback_ar, item.arabic, word);
    assert.equal(row.status, 'reviewed_override', word);
    assert.equal(row.review_required, 0, word);
    assert.equal(row.provider, 'project-contextual-audit', word);
    assert.equal(row.confidence, null, word);
    assert.match(row.source, item.source, word);
    assert.match(row.source, /ilportaledellautomobilista\.it\/documents/u, word);
    assert.match(row.note, new RegExp(String(item.id)), word);
  }
});

test('high-impact prohibition term remains flagged for human review', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  for (const [word, arabic] of [
    ['divieti', 'محظورات / إشارات منع'],
  ]) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, arabic);
    assert.equal(row.ui_fallback_ar, '');
    assert.equal(row.status, 'machine_draft_needs_review');
    assert.equal(row.review_required, 1);
    assert.equal(row.confidence, null);
    assert.match(row.note, /سياق.*مرور/u);
  }
});

test('source-backed presenza is corrected while mixed-sense senso remains flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(questionsIt.questions.reduce((count, question) => count + (question.it.match(/\bpresenza\b/giu) || []).length, 0), 475);
  assert.equal(questionsIt.questions.reduce((count, question) => count + (question.it.match(/\bsenso\b/giu) || []).length, 0), 333);

  const presence = byWord.get('presenza');
  const garage = questionsIt.questions.find(question => question.id === 22122);
  const panels = questionsIt.questions.find(question => question.id === 22232);
  assert.match(garage.it, /la presenza di un garage/u);
  assert.match(arabicById.get(22122).ar, /بوجود مرآب/u);
  assert.match(panels.it, /La presenza di uno dei due pannelli/u);
  assert.match(arabicById.get(22232).ar, /وجود أحد اللوحين/u);
  assert.equal(presence.translation_ar, 'وجود');
  assert.equal(presence.ui_fallback_ar, 'وجود');
  assert.equal(presence.status, 'reviewed_override');
  assert.equal(presence.review_required, 0);
  assert.equal(presence.translation_kind, 'contextual_translation');
  assert.equal(presence.provider, 'project-contextual-audit');
  assert.match(presence.source, /dizionario\.reverso\.net\/italiano-arabo\/presenza/u);
  assert.match(presence.source, /wordreference\.com\/itar\/presenza/u);
  assert.match(presence.source, /ilportaledellautomobilista\.it\/documents/u);
  assert.match(presence.note, /22122.*22232/u);

  let lessonPresenceCount = 0;
  let lessonSensoCount = 0;
  const scanLessonItalian = value => {
    if (Array.isArray(value)) {
      for (const item of value) scanLessonItalian(item);
    } else if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        if (typeof child === 'string' && (key === 'it' || key === 'qIt' || key.endsWith('It'))) {
          lessonPresenceCount += (child.match(/\bpresenza\b/giu) || []).length;
          lessonSensoCount += (child.match(/\bsenso\b/giu) || []).length;
        } else {
          scanLessonItalian(child);
        }
      }
    }
  };
  scanLessonItalian(json('data/lessons.json').modules);
  assert.equal(lessonPresenceCount, 3);
  assert.equal(lessonSensoCount, 1);

  const mixedSenso = byWord.get('senso');
  assert.equal(mixedSenso.translation_ar, 'معنى');
  assert.equal(mixedSenso.status, 'machine_draft_needs_review');
  assert.equal(mixedSenso.review_required, 1);
  const directional = questionsIt.questions.find(question => question.id === 22240);
  const meaningless = questionsIt.questions.find(question => question.id === 24895);
  const hearing = questionsIt.questions.find(question => question.id === 31064);
  assert.match(directional.it, /invertire il senso di marcia/u);
  assert.match(meaningless.it, /frasi e parole senza senso/u);
  assert.match(arabicById.get(24895).ar, /parole|عبارات/u);
  assert.match(arabicById.get(24895).ar, /بلا معنى/u);
  assert.match(hearing.it, /un senso importante/u);
  assert.match(arabicById.get(31064).ar, /السمع.*حاسة مهمة/u);

  const stillFlagged = {
    segnale: 'إشارة',
    senso: 'معنى',
    circolazione: 'حركة المرور',
    fermata: 'توقف مؤقت',
  };
  for (const [word, arabic] of Object.entries(stillFlagged)) {
    const candidate = byWord.get(word);
    assert.equal(candidate.translation_ar, arabic, word);
    assert.equal(candidate.review_required, 1, word);
  }
  const confirmedInBatchSeventeen = {
    veicolo: 'مركبة',
    'velocità': 'السرعة',
    precedenza: 'أولوية المرور',
  };
  for (const [word, arabic] of Object.entries(confirmedInBatchSeventeen)) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, arabic, word);
    assert.equal(row.status, 'reviewed_override', word);
    assert.equal(row.review_required, 0, word);
  }
});

test('source-backed vieta and occorre corrections match question and lesson contexts; six mixed terms remain flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  const questionOccurrences = word => questionsIt.questions.reduce((total, question) => total + (question.it.match(new RegExp(`\\b${word}\\b`, 'giu')) || []).length, 0);
  const countLessonWord = word => {
    let count = 0;
    const pattern = new RegExp(`\\b${word}\\b`, 'giu');
    const scan = (value, key = '') => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
          if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
            count += (child.match(pattern) || []).length;
          } else {
            scan(child, childKey);
          }
        }
      }
    };
    scan(json('data/lessons.json').modules);
    return count;
  };
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(questionOccurrences('vieta'), 202);
  assert.equal(questionOccurrences('occorre'), 129);
  assert.equal(countLessonWord('vieta'), 0);
  assert.equal(countLessonWord('occorre'), 10);

  const vieta = byWord.get('vieta');
  const prohibition = questionsIt.questions.find(question => question.id === 20455);
  const transit = questionsIt.questions.find(question => question.id === 21343);
  assert.match(prohibition.it, /il segnale raffigurato vieta agli autocarri/iu);
  assert.match(arabicById.get(20455).ar, /تحظر على الشاحنات/u);
  assert.match(transit.it, /vieta il transito ai veicoli/u);
  assert.match(arabicById.get(21343).ar, /تحظر الإشارة.*مرور المركبات/u);
  assert.equal(vieta.translation_ar, 'يمنع');
  assert.equal(vieta.ui_fallback_ar, 'يمنع');
  assert.equal(vieta.translation_kind, 'contextual_translation');
  assert.equal(vieta.status, 'reviewed_override');
  assert.equal(vieta.review_required, 0);
  assert.equal(vieta.provider, 'project-contextual-audit');
  assert.match(vieta.source, /dizionario\.reverso\.net\/italiano-arabo\/vietare/u);
  assert.match(vieta.source, /context\.reverso\.net\/traduzione\/italiano-arabo\/vietare/u);
  assert.match(vieta.source, /ilportaledellautomobilista\.it\/documents/u);
  assert.match(vieta.note, /20455.*21343/u);

  const occorre = byWord.get('occorre');
  const reduceSpeed = questionsIt.questions.find(question => question.id === 22117);
  const ifNeeded = questionsIt.questions.find(question => question.id === 19237);
  const noStop = questionsIt.questions.find(question => question.id === 20473);
  const doubleUse = questionsIt.questions.find(question => question.id === 22959);
  assert.match(reduceSpeed.it, /occorre diminuire la velocità/u);
  assert.match(arabicById.get(22117).ar, /يلزم تقليل السرعة/u);
  assert.match(ifNeeded.it, /se occorre/u);
  assert.match(arabicById.get(19237).ar, /إذا لزم الأمر/u);
  assert.match(noStop.it, /non occorre fermarsi/u);
  assert.match(arabicById.get(20473).ar, /لا يلزم التوقف/u);
  assert.equal((doubleUse.it.match(/\boccorre\b/giu) || []).length, 2);
  assert.match(arabicById.get(22959).ar, /التوقف مطلوب فقط عند الضرورة/u);
  assert.equal(occorre.translation_ar, 'يلزم');
  assert.equal(occorre.ui_fallback_ar, 'يلزم');
  assert.equal(occorre.translation_kind, 'contextual_translation');
  assert.equal(occorre.status, 'reviewed_override');
  assert.equal(occorre.review_required, 0);
  assert.equal(occorre.provider, 'project-contextual-audit');
  assert.match(occorre.source, /context\.reverso\.net.*\/occorre/u);
  assert.match(occorre.source, /ilportaledellautomobilista\.it\/documents/u);
  assert.match(occorre.note, /22117.*19237.*20473.*22959/u);

  const stillFlagged = {
    rappresentato: {arabic:'ممثّل', questions:336, lessons:0},
    guida: {arabic:'مرشد', questions:269, lessons:22},
    extraurbane: {arabic:'خارج البلاد', questions:135, lessons:3},
    tratto: {arabic:'السّنة', questions:131, lessons:0},
    passaggio: {arabic:'تمرير', questions:122, lessons:5},
    circolare: {arabic:'دائري', questions:120, lessons:1},
  };
  for (const [word, expected] of Object.entries(stillFlagged)) {
    const candidate = byWord.get(word);
    assert.equal(candidate.translation_ar, expected.arabic, word);
    assert.equal(candidate.review_required, 1, word);
    assert.equal(candidate.status === 'reviewed_override', false, word);
    assert.equal(questionOccurrences(word), expected.questions, word);
    assert.equal(countLessonWord(word), expected.lessons, word);
  }
});

test('source-backed km and traffico corrections match app contexts; six batch-five terms remain flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  const questionOccurrences = word => questionsIt.questions.reduce((total, question) => total + (question.it.match(new RegExp(`\\b${word}\\b`, 'giu')) || []).length, 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(question => new RegExp(`\\b${word}\\b`, 'iu').test(question.it)).length;
  const countLessonWord = word => {
    let count = 0;
    const pattern = new RegExp(`\\b${word}\\b`, 'giu');
    const scan = (value, key = '') => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
          if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
            count += (child.match(pattern) || []).length;
          } else {
            scan(child, childKey);
          }
        }
      }
    };
    scan(json('data/lessons.json').modules);
    return count;
  };
  assert.equal(questionsIt.count, 7020);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.review_required_entries, 5112);

  const km = byWord.get('km');
  assert.equal(questionOccurrences('km'), 176);
  assert.equal(distinctQuestionContexts('km'), 175);
  assert.equal(countLessonWord('km'), 0);
  assert.match(questionsIt.questions.find(question => question.id === 21533).it, /90 km\/h/u);
  assert.match(arabicById.get(21533).ar, /90 كم\/س/u);
  assert.match(questionsIt.questions.find(question => question.id === 18990).it, /3,8 km/u);
  assert.equal(km.translation_ar, 'كيلومتر');
  assert.equal(km.ui_fallback_ar, 'كيلومتر');
  assert.equal(km.translation_kind, 'unit_abbreviation');
  assert.equal(km.status, 'reviewed_override');
  assert.equal(km.review_required, 0);
  assert.equal(km.provider, 'project-contextual-audit');
  assert.match(km.source, /glosbe\.com\/it\/ar\/km/u);
  assert.match(km.source, /context\.reverso\.net\/translation\/arabic-italian/u);
  assert.match(km.source, /ilportaledellautomobilista\.it\/documents/u);
  assert.match(km.note, /21533.*18990/u);

  const traffico = byWord.get('traffico');
  assert.equal(questionOccurrences('traffico'), 153);
  assert.equal(distinctQuestionContexts('traffico'), 151);
  assert.equal(countLessonWord('traffico'), 9);
  assert.match(questionsIt.questions.find(question => question.id === 21481).it, /strada chiusa al traffico/u);
  assert.match(arabicById.get(21481).ar, /طريق مغلق أمام المرور/u);
  assert.match(questionsIt.questions.find(question => question.id === 21492).it, /zona a traffico limitato/u);
  assert.match(arabicById.get(21492).ar, /منطقة ذات حركة مرورية محدودة/u);
  assert.match(questionsIt.questions.find(question => question.id === 22155).it, /traffico intenso/u);
  assert.match(arabicById.get(22155).ar, /ازدحام مروري/u);
  assert.equal(traffico.translation_ar, 'حركة المرور');
  assert.equal(traffico.ui_fallback_ar, 'حركة المرور');
  assert.equal(traffico.translation_kind, 'contextual_translation');
  assert.equal(traffico.status, 'reviewed_override');
  assert.equal(traffico.review_required, 0);
  assert.equal(traffico.provider, 'project-contextual-audit');
  assert.match(traffico.source, /glosbe\.com\/it\/ar\/traffico/u);
  assert.match(traffico.source, /context\.reverso\.net.*\/traffico/u);
  assert.match(traffico.source, /arabdict\.com.*traffico/u);
  assert.match(traffico.source, /ilportaledellautomobilista\.it\/documents/u);
  assert.match(traffico.note, /21481.*21492.*18729.*22155/u);

  const stillFlagged = {
    norme: {arabic: 'المقاييس', questions: 143, lessons: 2},
    divieto: {arabic: 'ممنوع', questions: 107, lessons: 6},
    motocicli: {arabic: 'درّاجات', questions: 119, lessons: 0},
    centri: {arabic: 'وسط', questions: 109, lessons: 0},
    diritto: {arabic: 'مستقيم', questions: 120, lessons: 1},
    livello: {arabic: 'المستوى', questions: 116, lessons: 0},
  };
  for (const [word, expected] of Object.entries(stillFlagged)) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, expected.arabic, word);
    assert.equal(row.review_required, 1, word);
    assert.notEqual(row.status, 'reviewed_override', word);
    assert.equal(questionOccurrences(word), expected.questions, word);
    assert.equal(countLessonWord(word), expected.lessons, word);
  }
});

test('source-backed consente correction matches app contexts and leaves other batch terms flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const arabicById = new Map(questionsAr.questions.map(row => [row.id, row]));
  const row = byWord.get('consente');
  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(questionsIt.questions.reduce((count, question) => count + (question.it.match(/\bconsente\b/giu) || []).length, 0), 235);
  const question = questionsIt.questions.find(candidate => candidate.id === 21907);
  assert.match(question.it, /uno svincolo che consente l'inversione di marcia/u);
  assert.match(arabicById.get(21907).ar, /مخرج يتيح عكس اتجاه السير/u);
  assert.equal(row.translation_ar, 'يسمح / يتيح');
  assert.equal(row.ui_fallback_ar, row.translation_ar);
  assert.equal(row.status, 'reviewed_override');
  assert.equal(row.review_required, 0);
  assert.equal(row.provider, 'project-contextual-audit');
  assert.match(row.source, /dictionary\.reverso\.net\/italian-arabic\/consentire/u);
  assert.match(row.source, /ilportaledellautomobilista\.it\/documents/u);
  assert.match(row.note, /21907/u);

  let lessonOccurrences = 0;
  const countLessonItalian = (value, key = '') => {
    if (Array.isArray(value)) {
      for (const item of value) countLessonItalian(item);
    } else if (value && typeof value === 'object') {
      for (const [childKey, child] of Object.entries(value)) {
        if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
          lessonOccurrences += (child.match(/\bconsente\b/giu) || []).length;
        } else {
          countLessonItalian(child, childKey);
        }
      }
    }
  };
  countLessonItalian(json('data/lessons.json').modules);
  assert.equal(lessonOccurrences, 3);

  const stillFlagged = {
    raffigurato: 'مُصوّر',
    posto: 'المكان',
    sosta: 'وقوف ممتد',
    integrativo: 'متكامل',
    corrispondenza: 'تطابق',
    carico: 'تحميل',
    corsie: 'المسارات',
  };
  for (const [word, arabic] of Object.entries(stillFlagged)) {
    const candidate = byWord.get(word);
    assert.equal(candidate.translation_ar, arabic, word);
    assert.equal(candidate.review_required, 1, word);
  }
});

test('batch-six confirms supported existing glosses unchanged and retains unresolved terms flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const exactCount = (text, word) => (text.match(new RegExp(`\\b${word}\\b`, 'giu')) || []).length;
  const lessonOccurrences = word => {
    let count = 0;
    const scan = (value, key = '') => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
          if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
            count += exactCount(child, word);
          } else {
            scan(child, childKey);
          }
        }
      }
    };
    scan(json('data/lessons.json').modules);
    return count;
  };
  const confirmed = {
    incrocio: {arabic: 'تقاطع', occurrences: 634, questions: 601, lessons: 4, sources: [/dizionario\.reverso\.net\/italiano-arabo\/incrocio/u, /glosbe\.com\/it\/ar\/incrocio/u]},
    sorpasso: {arabic: 'تجاوز مركبة', occurrences: 216, questions: 213, lessons: 8, sources: [/arabdict\.com.*sorpasso/u, /context\.reverso\.net.*sorpassare/u, /treccani\.it\/vocabolario\/sorpasso/u]},
    pericolo: {arabic: 'خطر', occurrences: 213, questions: 210, lessons: 8, sources: [/arabita\.news\/dizionario\/944/u, /context\.reverso\.net.*pericolo/u]},
    distanza: {arabic: 'المسافة', occurrences: 205, questions: 202, lessons: 11, sources: [/it\.glosbe\.com\/it\/ar\/distanza/u, /context\.reverso\.net.*distanza/u]},
    semaforo: {arabic: 'إشارة ضوئية', occurrences: 204, questions: 178, lessons: 0, sources: [/ar\.glosbe\.com\/it\/ar\/semaforo/u, /context\.reverso\.net.*semaforo/u, /aci\.gov\.it\/codice-della-strada\/art-41/u]},
  };

  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 80);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5112);
  for (const [word, expected] of Object.entries(confirmed)) {
    const row = byWord.get(word);
    assert.equal(questionsIt.questions.reduce((count, question) => count + exactCount(question.it, word), 0), expected.occurrences, word);
    assert.equal(questionsIt.questions.filter(question => exactCount(question.it, word) > 0).length, expected.questions, word);
    assert.equal(lessonOccurrences(word), expected.lessons, word);
    assert.equal(row.translation_ar, expected.arabic, word);
    assert.equal(row.ui_fallback_ar, expected.arabic, word);
    assert.equal(row.translation_kind, 'contextual_translation', word);
    assert.equal(row.status, 'reviewed_override', word);
    assert.equal(row.review_required, 0, word);
    assert.equal(row.provider, 'project-contextual-audit', word);
    assert.match(row.source, /question-bank-context-confirmation-2026-11;/u, word);
    assert.match(row.note, new RegExp(`${expected.occurrences} occurrences`, 'u'), word);
    for (const sourcePattern of expected.sources) assert.match(row.source, sourcePattern, word);
  }

  const unresolved = {pannello: 'لوحة', marcia: 'السير'};
  for (const [word, arabic] of Object.entries(unresolved)) {
    const row = byWord.get(word);
    assert.equal(row.translation_ar, arabic, word);
    assert.equal(row.review_required, 1, word);
    assert.notEqual(row.status, 'reviewed_override', word);
  }
});


test('batch-seven contextual reviews correct two obligation glosses, confirm four, and retain two ambiguous terms', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const lessons = json('data/lessons.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const italianQuestions = new Map(questionsIt.questions.map(row => [row.id, row]));
  const arabicQuestions = new Map(questionsAr.questions.map(row => [row.id, row]));
  const exactPattern = word => new RegExp(`(?<![\\p{L}\\p{M}])${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?![\\p{L}\\p{M}])`, 'giu');
  const exactCount = (text, word) => (text.match(exactPattern(word)) || []).length;
  const questionOccurrences = word => questionsIt.questions.reduce((total, question) => total + exactCount(question.it, word), 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(question => exactCount(question.it, word) > 0).length;
  const lessonOccurrences = word => {
    let count = 0;
    const scan = (value, key = '') => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
          if (typeof child === 'string' && (childKey === 'it' || childKey === 'qIt' || childKey.endsWith('It'))) {
            count += exactCount(child, word);
          } else {
            scan(child, childKey);
          }
        }
      }
    };
    scan(lessons.modules);
    return count;
  };
  const reviewed = {
    deve: {arabic: 'يجب أن', questions: 702, contexts: 699, lessons: 18, type: 'corrected', sources: [/context\.reverso\.net.*ma\+deve/u, /dizionario\.reverso\.net.*sottoscrivere/u, /wisc\.pb\.unizin\.org/u], examples: [[21296, /\bdeve\b/u, /يجب التجاوز من اليمين/u], [18726, /\bdeve\b/u, /على سائق المركبة/u]]},
    'può': {arabic: 'يستطيع', questions: 603, contexts: 599, lessons: 44, type: 'flagged', examples: [[23116, /veicolo P può passare/u, /يمكن للمركبة P أن تمر/u], [18718, /si può incorrere/u, /قد.*غرامة/u]]},
    conducente: {arabic: 'سائق', questions: 540, contexts: 536, lessons: 39, type: 'confirmed', sources: [/context\.reverso\.net.*conducente/u, /aci\.gov\.it/u], examples: [[21413, /al conducente/u, /للسائق المتجه/u], [18716, /Il conducente/u, /لقائد مركبة/u]]},
    destra: {arabic: 'يمين', questions: 330, contexts: 323, lessons: 5, type: 'confirmed', sources: [/it\.glosbe\.com.*destra/u, /context\.reverso\.net.*destra/u, /treccani\.it.*destra/u], examples: [[20454, /a destra/u, /يمين/u], [23124, /la destra occupata/u, /الجهة اليمنى/u]]},
    strade: {arabic: 'الشوارع', questions: 290, contexts: 290, lessons: 3, type: 'flagged', examples: [[22244, /pulizia delle strade/u, /تنظيف الشوارع/u], [18351, /Le strade extraurbane/u, /الطرق خارج المناطق/u]]},
    bisogna: {arabic: 'يجب أن', questions: 284, contexts: 284, lessons: 1, type: 'corrected', sources: [/dizionario\.reverso\.net.*bisogna/u, /context\.reverso\.net.*bisogna/u, /treccani\.it.*bisognare/u], examples: [[21230, /bisogna percorrere/u, /يجب السير/u], [18670, /Bisogna lasciare/u, /يجب ترك التقاطعات/u]]},
    consentito: {arabic: 'مسموح', questions: 273, contexts: 273, lessons: 1, type: 'confirmed', sources: [/dizionario\.reverso\.net.*consentito/u, /aci\.it.*art-148/u, /gazzettaufficiale\.it.*art\.idArticolo=148/u], examples: [[22113, /non è consentito superare/u, /لا يُسمح بتجاوز/u], [20823, /è consentito al conducente/u, /يُسمح للسائق/u]]},
    patente: {arabic: 'رخصة القيادة', questions: 270, contexts: 231, lessons: 6, type: 'confirmed', sources: [/dizionario\.reverso\.net.*patente/u, /dizionario\.reverso\.net.*patente\+di\+guida/u, /ilportaledellautomobilista\.it.*la-patente-di-guida/u], examples: [[18559, /senza patente/u, /دون رخصة قيادة/u], [24537, /La patente di categoria B/u, /رخصة الفئة B/u]]},
  };

  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 80);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5112);
  for (const [word, expected] of Object.entries(reviewed)) {
    assert.equal(questionOccurrences(word), expected.questions, word);
    assert.equal(distinctQuestionContexts(word), expected.contexts, word);
    assert.equal(lessonOccurrences(word), expected.lessons, word);
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(row.translation_ar, expected.arabic, word);
    if (expected.type === 'flagged') {
      assert.equal(row.review_required, 1, word);
      assert.notEqual(row.status, 'reviewed_override', word);
    } else {
      assert.equal(row.ui_fallback_ar, expected.arabic, word);
      assert.equal(row.translation_kind, 'contextual_translation', word);
      assert.equal(row.status, 'reviewed_override', word);
      assert.equal(row.review_required, 0, word);
      assert.equal(row.provider, 'project-contextual-audit', word);
      assert.match(row.source, expected.type === 'corrected' ? /question-bank-context-audit-2026-11;/u : /question-bank-context-confirmation-2026-11;/u, word);
      for (const sourcePattern of expected.sources) assert.match(row.source, sourcePattern, word);
    }
    for (const [id, italianPattern, arabicPattern] of expected.examples) {
      assert.match(italianQuestions.get(id)?.it || '', italianPattern, `${word} question ${id} Italian`);
      assert.match(arabicQuestions.get(id)?.ar || '', arabicPattern, `${word} question ${id} Arabic`);
    }
  }
});


test('batch-nine corrects two supported glosses, confirms four, and retains two uncertain flags', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const italianQuestions = new Map(questionsIt.questions.map(row => [row.id, row]));
  const arabicQuestions = new Map(questionsAr.questions.map(row => [row.id, row]));
  const exactPattern = word => new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'giu');
  const exactCount = (text, word) => (text.match(exactPattern(word)) || []).length;
  const questionOccurrences = word => questionsIt.questions.reduce((total, question) => total + exactCount(question.it, word), 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(question => exactCount(question.it, word) > 0).length;
  const lessonOccurrences = word => {
    let count = 0;
    const scan = value => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (typeof child === 'string' && (key === 'it' || key === 'qIt' || key.endsWith('It'))) {
            count += exactCount(child, word);
          } else {
            scan(child);
          }
        }
      }
    };
    scan(json('data/lessons.json').modules);
    return count;
  };
  const reviewed = {
    caso: {arabic: 'الحالة', occurrences: 276, contexts: 273, lessons: 3, type: 'flagged', examples: [[24939, /In caso di incidente stradale/u, /في حالة حادث مروري/u]]},
    "nell'incrocio": {arabic: 'في التقاطع', occurrences: 268, contexts: 268, lessons: 0, type: 'confirmed', sources: [/glosbe\.com\/it\/ar\/incrocio/u, /dizionario\.reverso\.net\/italiano-arabo\/incrocio/u], examples: [[23043, /Nell'incrocio rappresentato in figura/u, /في التقاطع الممثل في الشكل/u]]},
    motore: {arabic: 'محرك', occurrences: 241, contexts: 224, lessons: 0, type: 'confirmed', sources: [/context\.reverso\.net.*motore/u, /arabita\.news\/dizionario\/2210/u], examples: [[24274, /riscaldamento del motore/u, /المحرّك/u]]},
    dare: {arabic: 'أعط', occurrences: 207, contexts: 206, lessons: 0, type: 'flagged', examples: [[22119, /dare la precedenza a destra/u, /إفساح أولوية المرور/u]]},
    svoltare: {arabic: 'انعطف', occurrences: 173, contexts: 173, lessons: 0, type: 'corrected', sources: [/glosbe\.com\/it\/ar\/svoltare/u, /arabdict\.com.*svoltare/u, /arabicacademy\.gov\.eg/u], examples: [[20456, /obbligo di svoltare a destra/u, /بوجوب الانعطاف يمين/u]]},
    stradale: {arabic: 'متعلق بالطريق / مروري (صفة)', occurrences: 153, contexts: 152, lessons: 5, type: 'corrected', sources: [/context\.reverso\.net.*stradale/u, /arabdict\.com.*stradale/u], examples: [[22117, /incidente stradale/u, /حادث مروري/u]]},
    ruote: {arabic: 'عجلات', occurrences: 147, contexts: 142, lessons: 0, type: 'confirmed', sources: [/context\.reverso\.net.*ruota/u, /it\.glosbe\.com\/ar\/it/u], examples: [[21509, /su tutte le quattro ruote/u, /على جميع العجلات الأربع/u]]},
    massa: {arabic: 'كتلة', occurrences: 129, contexts: 120, lessons: 0, type: 'confirmed', sources: [/context\.reverso\.net.*massa/u, /glosbe\.com\/it\/ar\/massa/u], examples: [[20454, /di massa superiore a 3,5 t/u, /ذات كتلة تزيد عن 3,5/u]]},
  };

  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 80);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5112);
  for (const [word, expected] of Object.entries(reviewed)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(questionOccurrences(word), expected.occurrences, word);
    assert.equal(distinctQuestionContexts(word), expected.contexts, word);
    assert.equal(lessonOccurrences(word), expected.lessons, word);
    assert.equal(row.translation_ar, expected.arabic, word);
    for (const [id, italianPattern, arabicPattern] of expected.examples) {
      assert.match(italianQuestions.get(id)?.it || '', italianPattern, `${word} question ${id} Italian`);
      assert.match(arabicQuestions.get(id)?.ar || '', arabicPattern, `${word} question ${id} Arabic`);
    }
    if (expected.type === 'flagged') {
      assert.equal(row.review_required, 1, word);
      assert.notEqual(row.status, 'reviewed_override', word);
      continue;
    }
    assert.equal(row.ui_fallback_ar, expected.arabic, word);
    assert.equal(row.translation_kind, 'contextual_translation', word);
    assert.equal(row.status, 'reviewed_override', word);
    assert.equal(row.review_required, 0, word);
    assert.equal(row.provider, 'project-contextual-audit', word);
    assert.match(row.source, expected.type === 'corrected' ? /question-bank-context-audit-2026-11;/u : /question-bank-context-confirmation-2026-11;/u, word);
    assert.match(row.note, new RegExp(`${expected.occurrences} (?:question-token )?occurrences`, 'u'), word);
    for (const sourcePattern of expected.sources) assert.match(row.source, sourcePattern, word);
  }
});

test('batch-eight confirms six supported glosses and keeps figura and pedoni flagged', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const italianQuestions = new Map(questionsIt.questions.map(row => [row.id, row]));
  const arabicQuestions = new Map(questionsAr.questions.map(row => [row.id, row]));
  const exactPattern = word => new RegExp(`(?<![\\p{L}\\p{M}])${word.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}(?![\\p{L}\\p{M}])`, 'giu');
  const exactCount = (text, word) => (text.match(exactPattern(word)) || []).length;
  const questionOccurrences = word => questionsIt.questions.reduce((total, question) => total + exactCount(question.it, word), 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(question => exactCount(question.it, word) > 0).length;
  const lessonOccurrences = word => {
    let count = 0;
    const scan = value => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (typeof child === 'string' && (key === 'it' || key === 'qIt' || key.endsWith('It'))) {
            count += exactCount(child, word);
          } else {
            scan(child);
          }
        }
      }
    };
    scan(json('data/lessons.json').modules);
    return count;
  };
  const confirmed = {
    sinistra: {arabic: 'يسار', occurrences: 277, contexts: 268, lessons: 1, sources: [/glosbe\.com\/it\/ar\/sinistra/u, /glosbe\.com\/ar\/it/u], example: [20457, /svolta a sinistra/u, /يسار/u]},
    luce: {arabic: 'ضوء', occurrences: 174, contexts: 168, lessons: 4, sources: [/glosbe\.com\/it\/ar\/luce/u, /dizionario\.reverso\.net\/italiano-arabo\/luce/u, /arabdict\.com.*luce/u], example: [21949, /ha luce propria/u, /إضاءة خاصة/u]},
    obbligatorio: {arabic: 'إلزامي', occurrences: 137, contexts: 137, lessons: 1, sources: [/context\.reverso\.net.*obbligatorio/u], example: [21297, /è obbligatorio svoltare a sinistra/u, /الإلزامي.*الانعطاف/u]},
    direzione: {arabic: 'الاتجاه', occurrences: 134, contexts: 133, lessons: 2, sources: [/arabdict\.com.*direzione/u, /dictionary\.reverso\.net\/italian-arabic\/direzione/u], example: [21820, /direzione obbligatoria/u, /باتجاه إلزامي/u]},
    obbligo: {arabic: 'التزام', occurrences: 132, contexts: 132, lessons: 5, sources: [/arabita\.news\/dizionario\/945/u, /context\.reverso\.net.*obbligo/u, /glosbe\.com\/it\/ar\/obbligo/u], example: [21817, /obbligo di arresto alla frontiera/u, /بوجوب التوقف على الحدود/u]},
    limite: {arabic: 'الحد', occurrences: 130, contexts: 130, lessons: 5, sources: [/context\.reverso\.net.*limite/u], example: [21532, /limite massimo di velocità/u, /الحد الأقصى للسرعة/u]},
  };

  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 80);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5112);
  for (const [word, expected] of Object.entries(confirmed)) {
    const row = byWord.get(word);
    assert.equal(questionOccurrences(word), expected.occurrences, word);
    assert.equal(distinctQuestionContexts(word), expected.contexts, word);
    assert.equal(lessonOccurrences(word), expected.lessons, word);
    assert.equal(row.translation_ar, expected.arabic, word);
    assert.equal(row.ui_fallback_ar, expected.arabic, word);
    assert.equal(row.translation_kind, 'contextual_translation', word);
    assert.equal(row.status, 'reviewed_override', word);
    assert.equal(row.review_required, 0, word);
    assert.equal(row.provider, 'project-contextual-audit', word);
    assert.match(row.source, /question-bank-context-confirmation-2026-11;/u, word);
    assert.match(row.note, new RegExp(`${expected.occurrences} occurrences`, 'u'), word);
    for (const sourcePattern of expected.sources) assert.match(row.source, sourcePattern, word);
    const [id, italianPattern, arabicPattern] = expected.example;
    assert.match(italianQuestions.get(id)?.it || '', italianPattern, `${word} question ${id} Italian`);
    assert.match(arabicQuestions.get(id)?.ar || '', arabicPattern, `${word} question ${id} Arabic`);
  }

  const held = {
    figura: {arabic: 'صورة', occurrences: 1014, contexts: 1012, lessons: 0, example: [20462, /rappresentati in figura/u, /مركبات.*مرسومة في الشكل/u]},
    pedoni: {arabic: 'المشاه', occurrences: 137, contexts: 137, lessons: 10, example: [21584, /pedoni transitano/u, /يعبر المشاة/u]},
  };
  for (const [word, expected] of Object.entries(held)) {
    const row = byWord.get(word);
    assert.equal(questionOccurrences(word), expected.occurrences, word);
    assert.equal(distinctQuestionContexts(word), expected.contexts, word);
    assert.equal(lessonOccurrences(word), expected.lessons, word);
    assert.equal(row.translation_ar, expected.arabic, word);
    assert.equal(row.review_required, 1, word);
    assert.notEqual(row.status, 'reviewed_override', word);
    const [id, italianPattern, arabicPattern] = expected.example;
    assert.match(italianQuestions.get(id)?.it || '', italianPattern, `${word} question ${id} Italian`);
    assert.match(arabicQuestions.get(id)?.ar || '', arabicPattern, `${word} question ${id} Arabic`);
  }
});


test('batch ten confirms three supported glosses and retains five uncertain flags', () => {
  const dictionary = json('data/italian_arabic_dictionary_lookup.json');
  const questionsIt = json('data/questions.it.json');
  const questionsAr = json('data/questions.json');
  const lessons = json('data/lessons.json');
  const byWord = new Map(dictionary.entries.map(row => [row.word, row]));
  const italianQuestions = new Map(questionsIt.questions.map(row => [row.id, row]));
  const arabicQuestions = new Map(questionsAr.questions.map(row => [row.id, row]));
  const exactPattern = word => new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'giu');
  const exactCount = (text, word) => (text.match(exactPattern(word)) || []).length;
  const questionOccurrences = word => questionsIt.questions.reduce((total, question) => total + exactCount(question.it, word), 0);
  const distinctQuestionContexts = word => questionsIt.questions.filter(question => exactCount(question.it, word) > 0).length;
  const lessonOccurrences = word => {
    let count = 0;
    const scan = value => {
      if (Array.isArray(value)) {
        for (const item of value) scan(item);
      } else if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          if (typeof child === 'string' && (key === 'it' || key === 'qIt' || key.endsWith('It'))) {
            count += exactCount(child, word);
          } else {
            scan(child);
          }
        }
      }
    };
    scan(lessons.modules);
    return count;
  };
  const reviewed = {
    striscia: {arabic: 'شريط', occurrences: 128, contexts: 128, lessons: 0, status: 'machine_draft_needs_review', example: [20973, /striscia trasversale d'arresto/u, /شريط التوقف العرضي/u]},
    sorpassare: {arabic: 'تخطّي', occurrences: 121, contexts: 118, lessons: 3, status: 'machine_draft_needs_review', example: [22163, /obbligo di sorpassare a sinistra/u, /وجوب التجاوز من اليسار/u]},
    vietato: {arabic: 'ممنوع', occurrences: 121, contexts: 121, lessons: 0, status: 'machine_draft_needs_review', example: [19535, /SENSO VIETATO/u, /ممنوع الاتجاه/u]},
    manovra: {arabic: 'المناورة', occurrences: 112, contexts: 111, lessons: 6, status: 'machine_draft_needs_review', example: [21619, /vieta la manovra di inversione/u, /تحظر مناورات/u]},
    rimorchio: {arabic: 'مقطورة', occurrences: 103, contexts: 94, lessons: 5, status: 'legacy_glossary_needs_review', example: [24079, /Nel rimorchio è presente/u, /في المقطورة يوجد جهاز أمان/u]},
    autostrade: {arabic: 'الطرق السريعة', occurrences: 102, contexts: 102, lessons: 2, status: 'confirmed', sources: [/glosbe\.com\/it\/ar\/autostrada/u, /context\.reverso\.net.*autostrada/u, /patente\.it.*articolo-2/u], example: [21535, /130 km \/h.*sulle autostrade/u, /على الطرق السريعة/u]},
    fermarsi: {arabic: 'توقّف', occurrences: 86, contexts: 86, lessons: 8, status: 'confirmed', sources: [/dictionary\.reverso\.net.*fermarsi/u, /glosbe\.com\/it\/ar\/fermare/u, /normattiva\.it.*art157/u], example: [22119, /indica di fermarsi e dare la precedenza/u, /ضرورة التوقف وإفساح أولوية المرور/u]},
    pneumatici: {arabic: 'إطارات', occurrences: 78, contexts: 76, lessons: 9, status: 'confirmed', sources: [/glosbe\.com\/it\/ar\/pneumatico/u, /context\.reverso\.net.*pneumatici/u, /lautomobile\.aci\.it.*pneumatici-invernali/u], example: [21503, /pneumatici invernali/u, /إطارات شتوية/u]},
  };

  assert.equal(dictionary.metadata.question_bank_verified_contextual_corrections, 61);
  assert.equal(dictionary.metadata.question_bank_verified_contextual_gloss_confirmations, 80);
  assert.equal(dictionary.metadata.review_required_entries, 5112);
  assert.equal(dictionary.entries.filter(row => row.review_required === 1).length, 5112);
  for (const [word, expected] of Object.entries(reviewed)) {
    const row = byWord.get(word);
    assert.ok(row, word);
    assert.equal(questionOccurrences(word), expected.occurrences, word);
    assert.equal(distinctQuestionContexts(word), expected.contexts, word);
    assert.equal(lessonOccurrences(word), expected.lessons, word);
    assert.equal(row.translation_ar, expected.arabic, word);
    const [id, italianPattern, arabicPattern] = expected.example;
    assert.match(italianQuestions.get(id)?.it || '', italianPattern, `${word} question ${id} Italian`);
    assert.match(arabicQuestions.get(id)?.ar || '', arabicPattern, `${word} question ${id} Arabic`);
    if (expected.status === 'confirmed') {
      assert.equal(row.ui_fallback_ar, expected.arabic, word);
      assert.equal(row.translation_kind, 'contextual_translation', word);
      assert.equal(row.status, 'reviewed_override', word);
      assert.equal(row.review_required, 0, word);
      assert.equal(row.provider, 'project-contextual-audit', word);
      assert.match(row.source, /question-bank-context-confirmation-2026-11;/u, word);
      assert.match(row.note, new RegExp(`${expected.occurrences} question-token occurrences`, 'u'), word);
      for (const sourcePattern of expected.sources) assert.match(row.source, sourcePattern, word);
    } else {
      assert.equal(row.ui_fallback_ar, '', word);
      assert.equal(row.status, expected.status, word);
      assert.equal(row.review_required, 1, word);
    }
  }

  // Q19550's sentence-level safety translation is a separate question-bank change and is intentionally not asserted here.
  // Its dictionary example is checked above against Q21619, whose source translation already exists on main.
});
