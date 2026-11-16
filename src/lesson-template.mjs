const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const pair = (it,ar) => `<span class="language-pair lesson-pair"><span class="pair-it" lang="it" dir="ltr">${esc(it)}</span><span class="pair-ar" lang="ar" dir="rtl">${esc(ar)}</span></span>`;

function pointCards(items=[]){
  const cards=items.map(item=>`<article class="lesson-key-point-card"><h3 class="lesson-key-point-title"><span lang="it" dir="ltr">${esc(item.title_it)}</span><span lang="ar" dir="rtl">${esc(item.title_ar)}</span></h3><div class="lesson-key-point-rule"><div class="lesson-key-point-rule-label">${pair('Regola da ricordare','القاعدة التي يجب تذكرها')}</div>${pair(item.it,item.ar)}</div></article>`).join('');
  return `<section class="lesson-key-points" data-lesson-section="points"><h2>${pair('Punti importanti','النقاط المهمة')}</h2><div class="lesson-key-point-list">${cards}</div></section>`;
}
function trapCards(items=[]){
  const body=items.length?items.map(item=>`<article class="lesson-trap-card"><h3><span lang="it" dir="ltr">${esc(item.term_it)}</span><small lang="ar" dir="rtl">${esc(item.meaning_ar)}</small></h3><div>${pair(item.why_it,item.why_ar)}</div>${item.example_it||item.example_ar?`<blockquote>${pair(item.example_it||'',item.example_ar||'')}</blockquote>`:''}</article>`).join(''):`<p class="lesson-empty-note">${pair('No special trap word applies to this lesson.','لا توجد كلمة ملتبسة خاصة بهذا الدرس.')}</p>`;
  return `<section class="lesson-trap-words" data-lesson-section="trap-words"><h2>${pair('Parole da leggere con attenzione','كلمات مميزة تستحق الانتباه')}</h2>${body}</section>`;
}
function numberCards(items=[]){
  const body=items.length?`<ul>${items.map(item=>`<li><strong lang="it" dir="ltr">${esc(item.value)}</strong><div>${pair(item.context_it,item.context_ar)}</div></li>`).join('')}</ul>`:`<p class="lesson-empty-note">${pair('This lesson has no special numeric value to memorize.','لا يتضمن الدرس رقمًا خاصًا للحفظ.')}</p>`;
  return `<section class="lesson-number-block" data-lesson-section="numbers"><h2>${pair('Numeri e condizioni','الأرقام والشروط')}</h2>${body}</section>`;
}
function mistakesList(items=[]){
  const rows=items.map(item=>`<li><div class="lesson-mistake"><strong>${pair(item.mistake_it,item.mistake_ar)}</strong><p>${pair(item.why_it,item.why_ar)}</p></div></li>`).join('');
  return `<section class="lesson-mistakes" data-lesson-section="mistakes"><h2>${pair('Errori comuni','أخطاء شائعة')}</h2><ol>${rows}</ol></section>`;
}
function quickChecks(items=[]){
  const cards=items.map((item,index)=>`<fieldset class="lesson-quick-check" data-quick-check data-answer="${item.answer==='VERO'?'VERO':'FALSO'}"><legend><span class="quick-check-number">${String(index+1).padStart(2,'0')}</span>${pair(item.statement_it,item.statement_ar)}</legend><div class="quick-check-buttons"><button type="button" data-quick-check-answer="VERO">${pair('Vero','صحيح')}</button><button type="button" data-quick-check-answer="FALSO">${pair('Falso','خطأ')}</button></div><p class="quick-check-feedback" role="status" aria-live="polite" hidden></p><div class="quick-check-explanation" hidden>${pair(item.explanation_it,item.explanation_ar)}</div></fieldset>`).join('');
  return `<section class="lesson-check-block" data-lesson-section="check"><h2>${pair('Controllo rapido · Vero o Falso?','تحقق سريع · صحيح أم خطأ؟')}</h2><div class="lesson-quick-check-list">${cards}</div></section>`;
}

export function renderLessonSections(lesson,visualMarkup=''){
  const body=`<section class="lesson-content-block" data-lesson-section="body"><h2>${pair('Testo in italiano','النص الإيطالي')}</h2><div class="lesson-body-pair"><div class="lesson-it-text" lang="it" dir="ltr">${esc(lesson.body_it)}</div><div class="lesson-ar-full" lang="ar" dir="rtl">${esc(lesson.body_ar)}</div></div></section>`;
  const core=`<section class="lesson-core-idea" data-lesson-section="idea"><h2>${pair('Idea centrale','الفكرة الأساسية')}</h2><div>${pair(lesson.core_it,lesson.core_ar)}</div></section>`;
  return `${body}${core}${pointCards(lesson.key_points||[])}${trapCards(lesson.trap_words||[])}${numberCards(lesson.numbers||[])}${mistakesList(lesson.common_mistakes||[])}${quickChecks(lesson.quick_check||[])}${visualMarkup}`;
}
