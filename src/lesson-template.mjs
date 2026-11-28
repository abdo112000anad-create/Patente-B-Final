import {renderLessonVisual as renderMappedLessonVisual} from './lesson-visuals.mjs';
import {
  renderPriorityLesson,
  renderTireLesson,
  renderSpeedLesson,
  renderAlcoholLesson,
  renderSafeDistanceLesson,
} from './visuals-engine.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pair = (it,ar) => `<span class="language-pair lesson-pair"><span class="pair-it" lang="it" dir="ltr">${esc(it)}</span><span class="pair-ar" lang="ar" dir="rtl">${esc(ar)}</span></span>`;

const engineVisualsByLesson = Object.freeze({
  'u1-l3': renderSpeedLesson,
  'u4-l1': renderPriorityLesson,
  'u5-l3': renderSafeDistanceLesson,
  'u6-l1': renderSpeedLesson,
  'u7-l1': renderTireLesson,
  'u9-l1': renderAlcoholLesson,
});

function renderEngineVisual(lesson, renderer, compact) {
  const id = String(lesson?.id ?? '');
  const titleIt = lesson?.titleIt ?? lesson?.heading_it ?? 'Lezione visiva';
  const titleAr = lesson?.titleAr ?? lesson?.heading_ar ?? '';
  const svg = renderer({title: titleIt}).replace('<svg xmlns=', '<svg class="lesson-svg" xmlns=');
  const caption = compact ? '' : `<figcaption><span lang="it" dir="ltr">${esc(titleIt)}</span><span lang="ar" dir="rtl">${esc(titleAr)}</span></figcaption>`;
  return `<figure class="lesson-svg-figure is-engine-visual${compact ? ' is-compact' : ''}" data-lesson-visual="${esc(id)}">${svg}${caption}</figure>`;
}

export function renderLessonVisualSection(lesson,{compact=false}={}){
  const renderer = engineVisualsByLesson[String(lesson?.id ?? '')];
  return renderer
    ? renderEngineVisual(lesson,renderer,compact)
    : renderMappedLessonVisual(lesson,{compact});
}

function pointCards(items=[],italianWordMarkup=esc){
  const cards=items.map(item=>`<article class="lesson-key-point-card key-point-card"><div class="lesson-key-point-title" role="heading" aria-level="3"><div class="kp-it" lang="it" dir="ltr">${italianWordMarkup(item.it)}</div><div class="kp-ar" lang="ar" dir="rtl">${esc(item.ar)}</div></div></article>`).join('');
  return `<section class="lesson-key-points" data-lesson-section="points"><h2>${pair('Punti importanti','النقاط الأساسية')}</h2><div class="lesson-key-point-list key-points-list key-points-grid">${cards}</div></section>`;
}

export function renderLessonSections(lesson,_visualMarkup='',options={}){
  const italianWordMarkup=typeof options.italianWordMarkup==='function'?options.italianWordMarkup:esc;
  const trapMarkup=String(options.trapMarkup||'');
  const quickCheckMarkup=String(options.quickCheckMarkup||'');
  const summary=`<section class="lesson-content-block" data-lesson-section="summary"><h2>${pair('Sintesi della lezione','خلاصة الدرس')}</h2><div class="lesson-summary-card"><div class="lesson-it-text" lang="it" dir="ltr">${italianWordMarkup(lesson.summaryIt)}</div><div class="lesson-ar-full" lang="ar" dir="rtl">${esc(lesson.summaryAr)}</div></div></section>`;
  return `${summary}${pointCards(lesson.keyPoints||[],italianWordMarkup)}${trapMarkup}${quickCheckMarkup}`;
}
