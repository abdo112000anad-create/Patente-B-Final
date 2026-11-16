import {findRelevantQuestions, normalizeSearchText} from './search.mjs';

export function resolveAssistantPrompt(draft = '', suggestion = '') {
  return String(draft ?? '').trim() || String(suggestion ?? '').trim();
}

function questionAnswerLabel(question, language) {
  const value = question?.answer === 'VERO'
    ? (language === 'ar' ? 'صحيح' : 'Vero')
    : (language === 'ar' ? 'خطأ' : 'Falso');
  return value;
}

function findRightOfWayReference(questions = []) {
  return (Array.isArray(questions) ? questions : []).find(question => Number(question?.id) === 20536)
    || findRelevantQuestions(questions, 'regola generale precedenza a destra', 1)[0]
    || null;
}

function rightOfWayAnswer(questions = []) {
  const reference = findRightOfWayReference(questions);
  const referenceIt = reference
    ? `\n\nRiferimento nel banco locale: quiz #${reference.id}, pagina ${reference.page}; risposta registrata: ${questionAnswerLabel(reference, 'it')}.`
    : '';
  const referenceAr = reference
    ? `\n\nمرجع في بنك الأسئلة المحلي: السؤال #${reference.id}، الصفحة ${reference.page}؛ والإجابة المسجلة: ${questionAnswerLabel(reference, 'ar')}.`
    : '';
  return `Italiano:\nLa regola generale è: all'incrocio, se non ci sono indicazioni diverse, devi dare precedenza ai veicoli che arrivano dalla tua destra (art. 145, comma 2, Codice della strada). Avvicinati con prudenza e controlla bene prima di impegnare l'incrocio.\n\nSegui invece le indicazioni specifiche: quelle dell'agente, il semaforo e i segnali di precedenza, come STOP o DARE PRECEDENZA. Non entrare nell'incrocio se non puoi liberarlo senza ostacolare il traffico.\n\nIn breve: in assenza di indicazioni diverse, cede il passo chi ha un veicolo alla propria destra.${referenceIt}\n\nLa traduzione araba è didattica; nella guida reale rispetta sempre segnaletica, indicazioni degli agenti e prudenza. Fonte: [ACI — art. 145 del Codice della strada](https://aci.gov.it/codice-della-strada/art-145/).\n\nالعربية:\nالقاعدة العامة: عند التقاطع، إذا لم توجد تعليمات أو إشارات مختلفة، أفسح الطريق للمركبات القادمة من يمينك (المادة 145، الفقرة 2 من قانون الطرق الإيطالي). اقترب بحذر وتحقق جيدًا قبل دخول التقاطع.\n\nاتبع التعليمات المحددة بدلًا من افتراض القاعدة العامة: توجيهات الشرطي، وإشارة المرور، وإشارات الأولوية مثل STOP أو «إفساح الأولوية». ولا تدخل التقاطع إن لم تستطع الخروج منه من دون إعاقة السير.\n\nللحفظ: عند غياب تعليمات مختلفة، أفسح الطريق لمن يأتي من يمينك.${referenceAr}\n\nهذه ترجمة تعليمية؛ أثناء القيادة اتبع دائمًا الإشارات وتعليمات الشرطي وقُد بحذر. المصدر: [ACI — المادة 145 من قانون الطرق الإيطالي](https://aci.gov.it/codice-della-strada/art-145/).`;
}

function localQuestionListAnswer(query, matches, totalQuestions = 0, similarGroups = []) {
  const items = Array.isArray(matches) ? matches.slice(0, 4) : [];
  if (!items.length) {
    return `Italiano:\nNon ho trovato una domanda direttamente pertinente nella banca locale di ${Number(totalQuestions).toLocaleString('it-IT')} quiz. Prova una parola chiave più breve o cerca nel banco dei quiz.\n\nالعربية:\nلم أعثر على سؤال ذي صلة مباشرة في بنك الأسئلة المحلي الذي يضم ${Number(totalQuestions).toLocaleString('ar')} سؤالًا. جرّب كلمة مفتاحية أقصر أو ابحث في بنك الأسئلة.`;
  }
  const relatedNote = (question, language) => {
    const group = (Array.isArray(similarGroups) ? similarGroups : []).find(item => item.question_ids?.includes(Number(question.id)));
    if (!group) return '';
    return language === 'ar'
      ? `\nصياغات متقاربة: المجموعة ${group.id} تضم ${Number(group.member_count).toLocaleString('ar')} سجلات مستقلة؛ قد تختلف صورها أو بياناتها.`
      : `\nSimilar wording: group ${group.id} contains ${group.member_count} separate records; their figures or details may differ.`;
  };
  const italian = `Non ho una spiegazione locale già preparata per questa formulazione. La ricerca è rimasta su questo dispositivo e ha trovato ${items.length} quiz correlati nella banca locale di ${Number(totalQuestions).toLocaleString('it-IT')}; sono esempi di quiz, non una risposta completa alla regola.\n\n${items.map(question => `Quiz #${question.id} · pagina ${question.page}\nDomanda: ${question.it}\nRisposta registrata: ${questionAnswerLabel(question, 'it')}${relatedNote(question, 'it')}`).join('\n\n')}\n\nPer domande basate su un'immagine, apri il quiz nel banco per vedere la figura. La traduzione araba è didattica.`;
  const arabic = `لم أعثر على شرح محلي مُعدّ مسبقًا لهذه الصياغة. بقي البحث على هذا الجهاز ووجد ${items.length.toLocaleString('ar')} أسئلة تدريبية ذات صلة من أصل ${Number(totalQuestions).toLocaleString('ar')}؛ وهي أمثلة للاختبار وليست جوابًا شاملًا للقاعدة.\n\n${items.map(question => `السؤال #${question.id} · الصفحة ${question.page}\nالسؤال: ${question.ar || question.it}\nالإجابة المسجلة: ${questionAnswerLabel(question, 'ar')}${relatedNote(question, 'ar')}`).join('\n\n')}\n\nإذا كان السؤال يعتمد على صورة، افتح السؤال في بنك الأسئلة لرؤية الرسم. الترجمة العربية تعليمية.`;
  return `Italiano:\n${italian}\n\nالعربية:\n${arabic}`;
}

export function formatLocalQuestionSearchAnswer(query, matches, totalQuestions = 0, questions = [], similarGroups = []) {
  const normalized = normalizeSearchText(query);
  const asksRightOfWay = /(precedenza|priorita|اولوية|right of way|priority)/u.test(normalized)
    && /(destra|right|يمين)/u.test(normalized);
  if (asksRightOfWay) return rightOfWayAnswer(questions);
  return localQuestionListAnswer(query, matches, totalQuestions, similarGroups);
}

export function splitBilingualAssistantAnswer(content = '') {
  const match = String(content ?? '').match(/^\s*Italiano\s*:?[ \t]*\n([\s\S]*?)\n\s*(?:العربية|Arabo)\s*:?[ \t]*\n([\s\S]*)$/i);
  return match ? {italian: match[1].trim(), arabic: match[2].trim()} : null;
}

export async function requestAssistantAnswer({prompt = '', context = '', questions = [], similarGroups = []} = {}) {
  const lookup = [String(prompt ?? '').trim(), String(context ?? '').trim()].filter(Boolean).join(' ');
  const matches = findRelevantQuestions(questions, lookup, 4);
  return {
    source: 'local',
    content: formatLocalQuestionSearchAnswer(lookup, matches, questions.length, questions, similarGroups)
  };
}
