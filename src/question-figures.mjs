function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
}

const EXPLICIT_VISUAL_WORDING = /\b(?:figura\b|raffigur\w*\b|immagine\b|disegn\w*\b|illustrat\w*\b)/iu;
const NON_VISUAL_FIGURA = /\bnella patente figura\b/iu;

export function hasQuestionVisualReference(question = {}) {
  const italian = String(question.it ?? '');
  return Boolean(question.hasFigureRef) || (EXPLICIT_VISUAL_WORDING.test(italian) && !NON_VISUAL_FIGURA.test(italian));
}

function officialFigureNote(question, sourceMarkup = '') {
  const id = escapeHtml(question.id ?? '');
  const page = Number(question.page);
  const pageIt = Number.isFinite(page) ? ` (pagina PDF ${page})` : '';
  const pageAr = Number.isFinite(page) ? ` (صفحة ${page.toLocaleString('ar')})` : '';
  return `<aside class="question-figure-source-note" data-figure-fallback data-question-id="${id}" role="note"><strong lang="it" dir="ltr">Per la figura di questo quesito, consulta il PDF ufficiale.</strong><small lang="it" dir="ltr">Riferimento${pageIt}.</small><strong lang="ar" dir="rtl">لرؤية رسم هذا السؤال، راجع ملف الوزارة الرسمي.</strong><small lang="ar" dir="rtl">المرجع${pageAr}.</small>${sourceMarkup}</aside>`;
}

export function questionFigureMarkup(question = {}, {sourceMarkup = ''} = {}) {
  const image = String(question.image ?? '').trim();
  const id = escapeHtml(question.id ?? '');
  const fallback = officialFigureNote(question, sourceMarkup);
  if (image) {
    const alt = escapeHtml(question.it || 'Illustrazione della domanda');
    return `<figure class="quiz-figure question-figure" data-question-id="${id}"><img class="question-figure-img" data-question-figure data-question-id="${id}" src="${escapeHtml(image)}" alt="${alt}" loading="lazy" decoding="async"><figcaption><span lang="it" dir="ltr">Illustrazione della domanda</span><span lang="ar" dir="rtl">رسم توضيحي للسؤال</span>${sourceMarkup}</figcaption>${fallback.replace('<aside ', '<aside hidden ')}</figure>`;
  }
  if (hasQuestionVisualReference(question)) return fallback;
  return '';
}
