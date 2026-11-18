const main=document.querySelector('#main');
const toastNode=document.querySelector('#toast');
main.addEventListener('error',event=>{const image=event.target;if(image?.tagName!=='IMG'||!image.matches('[data-question-figure]'))return;image.hidden=true;const figure=image.closest('.question-figure');const caption=figure?.querySelector('figcaption');if(caption)caption.hidden=true;const fallback=figure?.querySelector('[data-figure-fallback]');if(fallback)fallback.hidden=false;},true);
const sourceDialog=document.querySelector('#sourceDialog');
const lessonUnlockDialog=document.querySelector('#lessonUnlockDialog');
const watchRewardedLessonButton=document.querySelector('#watchRewardedLesson');
const privacyOptionsButton=document.querySelector('#privacyOptionsButton');
import {initializeProgressBackup} from './progress-backup.mjs';
import {restoreActiveQuiz} from './session-recovery.mjs';
import {loadCourseData} from './startup.mjs';
import {Capacitor, registerPlugin} from '@capacitor/core';
import {createSpeechController,buildLessonSpeechTexts,ITALIAN_TTS_LOCALE,ARABIC_TTS_LOCALE} from './speech.mjs';
import {resolveLessonVisual} from './lesson-visual.mjs';
import {lessonAnimationMarkup} from './lesson-animation.mjs';
import {normalizeSearchText as norm, matchesSearchText, findRelevantQuestions} from './search.mjs';
import {resolveAssistantPrompt, requestAssistantAnswer, splitBilingualAssistantAnswer} from './assistant.mjs';
import {questionFigureMarkup} from './question-figures.mjs';
import {glossaryEntries, glossaryCategories} from './glossary.mjs';
import {findGlossaryMatches} from './lesson-vocabulary.mjs';
import {diffQuestionText,renderDiffSide} from './similar-diff.mjs';
import {lessonVideoDestination,loadVideoManifest} from './video-links.mjs';
import {loadLocalWordDictionary,lookupOfflineWord, splitSentences, translateLessonSentence, translateTappedWord, wordAtOffset} from './lesson-translation.mjs';
import {dueQuestionPool, scheduleQuestionReview} from './spaced-repetition.mjs';
import {createLessonAccess, FREE_LESSON_COUNT} from './lesson-access.mjs';
import {createAccountService} from './firebase-account.mjs';
import {initializeAccountUI} from './account-ui.mjs';
import {firebaseConfig} from './firebase-config.mjs';
import {referenceData} from './reference-data.mjs';
import {renderReferencePage} from './reference-pages.mjs';
import {renderLessonSections} from './lesson-template.mjs';
import {createSetEditTracker} from './progress-set-edits.mjs';
const NativeRewardedAds=registerPlugin('RewardedAds');
const NativeSpeechSettings=registerPlugin('SpeechSettings');
const examSourcePage='https://www.ilportaledellautomobilista.it/web/portale-automobilista/-/quiz-per-le-patenti-am-b-superiori-e-cqc';
const stateKey='patente-ar-state-v1';
const welcomeKey='patente-b-welcome-dismissed-v37';
let activeStateKey=stateKey,accountService=null;
let bank,questions=[],questionsById=new Map(),categories=[],lessonModules=[],topicLabels={},similarQuestionGroups=[],similarGroupCounts={},similarGroupByQuestion=new Map(),similarGroupedQuestionCount=0;
let officialSyllabusMeta={},officialSyllabus=[],videoUrlOverrides=new Map();
let currentView='home',currentLessonId=null,currentLessonIndex=0,quiz=null,browsePage=0,lastParentView='home';
let timerHandle=null,toastHandle=null;
let offlineCacheState='checking',offlineCacheStats=null;
let assistantMessages=[],assistantContext='',assistantDraft='',assistantBusy=false,assistantError='',lastQuizDefinition=null;
let progressStorageAvailable=true;
let lessonAccess=null,pendingLessonRequest=null,adConsentPromise=Promise.resolve(null);
const state=loadState();Object.assign(state,loadUiPreferences());
const setEditTracker=createSetEditTracker(state);
let speechRate=.8;
const speechController=createSpeechController({getRate:()=>speechRate,onStateChange:syncSpeechControls,onWordProgress:syncItalianSpeechHighlight});
document.body.dataset.audioBackend='web-speech';
document.querySelector('#speechToggle')?.addEventListener('click',()=>speechController.toggle());
document.querySelector('#speechStop')?.addEventListener('click',()=>stopSpeech());
document.querySelector('#speechSettingsButton')?.addEventListener('click',()=>{void openSpeechSettings();});
document.querySelector('#speechRate')?.addEventListener('change',event=>{speechRate=Math.max(.70,Math.min(1.30,Number(event.target.value)||.85));event.target.value=String(speechRate);});
void loadLocalWordDictionary();
document.querySelector('#translationTooltipClose')?.addEventListener('click',()=>closeWordTooltip({restoreFocus:true}));

function playItalianAudio(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel(); // إيقاف أي صوت سابق

    const attemptSpeak = () => {
        const voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
            setTimeout(attemptSpeak, 100); // انتظار تحميل الأصوات في أندرويد
            return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'it-IT';
        utterance.rate = 0.8; // إبطاء السرعة (بناءً على طلب المستخدم)
        utterance.pitch = 1.0;

        const itVoice = voices.find(v => v.lang.startsWith('it'));
        if (itVoice) utterance.voice = itVoice;

        try {
            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.error(e);
        }
    };

    setTimeout(attemptSpeak, 50); // تأخير بسيط إجباري لمتصفح أندرويد
}

function loadState(key=stateKey){
  const empty={favorites:new Set(),wrong:new Set(),solved:new Set(),correctCount:0,practiceCount:0,topicCorrect:{},topicTotal:{},completedLessons:new Set(),reviewedLessons:new Set(),sourceChecks:{},lastLessonKey:'',lastStudy:'',streak:0,questionStats:{},sessions:[],activeQuiz:null,fontSize:16,syncSetEdits:{}};
  try{
    const raw=JSON.parse(localStorage.getItem(key)||'{}');
    return {favorites:new Set(Array.isArray(raw.favorites)?raw.favorites:[]),wrong:new Set(Array.isArray(raw.wrong)?raw.wrong:[]),solved:new Set(Array.isArray(raw.solved)?raw.solved:[]),correctCount:Number(raw.correctCount)||0,practiceCount:Number(raw.practiceCount)||0,topicCorrect:raw.topicCorrect&&typeof raw.topicCorrect==='object'?raw.topicCorrect:{},topicTotal:raw.topicTotal&&typeof raw.topicTotal==='object'?raw.topicTotal:{},completedLessons:new Set(Array.isArray(raw.completedLessons)?raw.completedLessons:[]),reviewedLessons:new Set(Array.isArray(raw.reviewedLessons)?raw.reviewedLessons:[]),sourceChecks:raw.sourceChecks&&typeof raw.sourceChecks==='object'?raw.sourceChecks:{},lastLessonKey:typeof raw.lastLessonKey==='string'?raw.lastLessonKey:'',lastStudy:typeof raw.lastStudy==='string'?raw.lastStudy:'',streak:Number(raw.streak)||0,questionStats:raw.questionStats&&typeof raw.questionStats==='object'?raw.questionStats:{},sessions:Array.isArray(raw.sessions)?raw.sessions.filter(x=>x&&typeof x==='object').slice(0,20):[],activeQuiz:raw.activeQuiz&&typeof raw.activeQuiz==='object'?raw.activeQuiz:null,fontSize:[16,18,20].includes(Number(raw.fontSize))?Number(raw.fontSize):16,syncSetEdits:raw.syncSetEdits&&typeof raw.syncSetEdits==='object'?raw.syncSetEdits:{}};
  }catch{progressStorageAvailable=false;return empty;}
}
function loadUiPreferences(key=activeStateKey){try{const raw=JSON.parse(localStorage.getItem(key)||'{}');return {dailyGoal:raw.dailyGoal&&typeof raw.dailyGoal==='object'?raw.dailyGoal:{date:'',questions:0,lessons:0},themeMode:raw.themeMode==='dark'?'dark':'system',fontSize:[16,18,20,22].includes(Number(raw.fontSize))?Number(raw.fontSize):16,languageOrder:raw.languageOrder==='ar'?'ar':'it'};}catch{return {dailyGoal:{date:'',questions:0,lessons:0},themeMode:'system',fontSize:16,languageOrder:'it'};}}
function persistState({notify=true,track=true}={}){if(track)setEditTracker.record(state);try{localStorage.setItem(activeStateKey,JSON.stringify({...state,favorites:[...state.favorites],wrong:[...state.wrong],solved:[...state.solved],completedLessons:[...state.completedLessons],reviewedLessons:[...state.reviewedLessons]}));progressStorageAvailable=true;updateNavCounts();if(notify)accountService?.notifyLocalChange();return true;}catch(error){progressStorageAvailable=false;console.warn('Progress is session-only because local storage is unavailable.');updateNavCounts();return false;}}
function setStudyOwner(uid,{discardCurrent=false}={}){
  const nextKey=uid?`patente-ar-account-v1:${uid}`:stateKey;if(nextKey===activeStateKey)return;
  if(!discardCurrent)persistState({notify:false});stopTimer();stopSpeech();quiz=null;activeStateKey=nextKey;Object.assign(state,loadState(nextKey),loadUiPreferences(nextKey));setEditTracker.reset(state);applyFontSize();applyThemeMode();applyLanguageOrder();if(bank)render('home');
}
function applySyncedProgress(next){const active=state.activeQuiz,fontSize=state.fontSize,themeMode=state.themeMode,languageOrder=state.languageOrder;Object.assign(state,next,{activeQuiz:active,fontSize,themeMode,languageOrder});setEditTracker.reset(state);applyThemeMode();applyLanguageOrder();persistState({notify:false,track:false});if(['home','review'].includes(currentView))render(currentView);}
window.__patenteHandleNativeBack=()=>{const dialog=document.querySelector('dialog[open]');if(dialog){dialog.close();return true;}if(currentView!=='home'){if(quiz&&!quiz.reviewing)saveActiveQuiz();stopTimer();stopSpeech();quiz=null;render('home');return true;}return false;};
function esc(value=''){return String(value).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function pair(it,ar,cls=''){return `<span class="language-pair ${cls}"><span class="pair-it" lang="it" dir="ltr">${esc(it)}</span><span class="pair-ar" lang="ar" dir="rtl">${esc(ar)}</span></span>`;}
function pairRaw(itHtml,arHtml,cls=''){return `<span class="language-pair ${cls}"><span class="pair-it" lang="it" dir="ltr">${itHtml}</span><span class="pair-ar" lang="ar" dir="rtl">${arHtml}</span></span>`;}
function controlLabel(it,ar){return `<span class="control-label"><span lang="it" dir="ltr">${esc(it)}</span><small lang="ar" dir="rtl">${esc(ar)}</small></span>`;}
function lessonYouTubeUrl(lesson){
  const video=lesson?.youtube_video;
  if(video?.status!=='published'||typeof video.url!=='string')return '';
  try{
    const url=new URL(video.url);
    if(url.protocol!=='https:')return '';
    const host=url.hostname.toLowerCase();
    const id=host==='youtu.be'?url.pathname.slice(1):(['youtube.com','www.youtube.com'].includes(host)&&url.pathname==='/watch'?url.searchParams.get('v'):'');
    return /^[A-Za-z0-9_-]{11}$/.test(id||'')?url.href:'';
  }catch{return '';}
}
function lessonVideoBlock(lesson,moduleId,index){
  const destination=lessonVideoDestination(lesson,lessonKey(moduleId,index),videoUrlOverrides);
  if(destination.kind==='video')return `<aside class="lesson-video-status" role="group"><div>${pair('Published lesson video · opens on YouTube','فيديو الدرس المنشور · يفتح على YouTube')}</div><a class="lesson-video-cta-link lesson-video-status-link" data-youtube-cta href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer">${controlLabel('Watch the published lesson video ↗','شاهد فيديو الدرس المنشور ↗')}</a><p>${pair('This published video is optional external content.','هذا الفيديو المنشور محتوى خارجي اختياري.')}</p></aside>`;
  return `<aside class="lesson-video-status lesson-video-pending" role="note"><p>${lesson?.video_script_available?pair('The script is prepared; this lesson video is not published yet.','نص الدرس جاهز، لكن فيديو هذا الدرس لم يُنشر بعد.'):pair('No published video is linked to this lesson yet.','لا يوجد فيديو منشور مرتبط بهذا الدرس حتى الآن.')}</p></aside>`;
}
function lessonVideoCTA(lesson,moduleId,index){
  const destination=lessonVideoDestination(lesson,lessonKey(moduleId,index),videoUrlOverrides);
  if(destination.kind==='video')return `<aside class="lesson-video-cta" aria-label="Video lesson · فيديو الدرس"><div class="eyebrow">${pair('VIDEO LESSON','فيديو الدرس')}</div><a class="lesson-video-cta-link" data-youtube-cta href="${esc(destination.url)}" target="_blank" rel="noopener noreferrer">${controlLabel('Watch the detailed video explanation','شاهد الشرح التفصيلي بالفيديو')}</a></aside>`;
  return `<aside class="lesson-video-cta is-upcoming" aria-label="Video lesson · فيديو الدرس"><div class="eyebrow">${pair('VIDEO LESSON','فيديو الدرس')}</div><div class="lesson-video-upcoming-status" role="status">${pair('Video coming soon','الفيديو قريبًا')}</div></aside>`;
}
function shuffle(array){const out=[...array];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()* (i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function showToast(it,ar){toastNode.innerHTML=pair(it,ar,'toast-pair');toastNode.classList.add('show');clearTimeout(toastHandle);toastHandle=setTimeout(()=>toastNode.classList.remove('show'),3200);}
function syncSpeechControls({status='idle',button=null,locale='',progress=0,voiceName='',error='',needsSpeechSettings=false}={}){
  if(status==='idle'||status==='error')clearLessonWordHighlight(button);
  const bar=document.querySelector('#speechPlaybackBar');if(!bar)return;
  const active=status!=='idle',playing=status==='playing',paused=status==='paused',failed=status==='error';
  bar.hidden=!active;
  document.body.classList.toggle('audio-player-open',active);
  const toggle=document.querySelector('#speechToggle'),playIcon=document.querySelector('#speechIconPlay'),pauseIcon=document.querySelector('#speechIconPause'),progressBar=document.querySelector('#speechProgress'),rate=document.querySelector('#speechRate'),debug=document.querySelector('#speechVoiceDebug'),statusNode=document.querySelector('#speechPlaybackStatus'),notice=document.querySelector('#speechPlaybackNotice'),settingsButton=document.querySelector('#speechSettingsButton');
  if(toggle){toggle.setAttribute('aria-pressed',String(playing));toggle.setAttribute('aria-label',paused?'استئناف الصوت':playing?'إيقاف الصوت مؤقتًا':'تشغيل الصوت');}
  if(playIcon)playIcon.hidden=playing;
  if(pauseIcon)pauseIcon.hidden=!playing;
  if(progressBar){progressBar.value=active?Math.max(0,Math.min(1,Number(progress)||0)):0;progressBar.setAttribute('aria-valuenow',String(Math.round(progressBar.value*100)));}
  if(rate){rate.value=String(speechRate);rate.setAttribute('aria-label','سرعة الصوت الإيطالي');}
  const selectedVoice=voiceName||((String(locale).toLowerCase().startsWith('it'))?'صوت إيطالي على الجهاز':locale?'صوت عربي على الجهاز':'اختر اللغة');
  const browserVoice=String(locale).toLowerCase().startsWith('it')?'نطق إيطالي على الجهاز':'نطق عربي على الجهاز';
  if(debug){debug.textContent=failed?(error||'تعذّر تشغيل الصوت'):`${selectedVoice||browserVoice}`;debug.dataset.qualityHint='device-speech';}
  if(statusNode)statusNode.textContent=failed?(error||'تعذّر تشغيل الصوت'):status==='preparing'?'جارٍ تجهيز صوت الجهاز...':paused?'الصوت متوقف مؤقتًا':playing?'الصوت يعمل':'';

  if(notice)notice.hidden=!statusNode?.textContent;
  if(settingsButton)settingsButton.hidden=!needsSpeechSettings||!Capacitor.isNativePlatform()||typeof NativeSpeechSettings.openVoiceDataSettings!=='function';
  if(button){button.classList.toggle('speaking',playing);button.classList.toggle('speech-paused',paused);button.classList.toggle('speech-error',failed);button.setAttribute('aria-pressed',String(playing));}
}
function clearLessonWordHighlight(button=null){
  const scope=button?.closest?.('.lesson-detail-page')||main;
  scope?.querySelectorAll('.speech-current-word').forEach(node=>{node.classList.remove('speech-current-word');node.removeAttribute('aria-current');});
}
function syncItalianSpeechHighlight({button=null,locale='',charIndex=0,status='progress'}={}){
  const page=button?.closest?.('.lesson-detail-page');
  if(!page||button.dataset.lessonItalianAudio!=='true')return;
  if(status==='clear'||!String(locale).toLowerCase().startsWith('it')){clearLessonWordHighlight(button);return;}
  const root=page.querySelector('.lesson-it-text');
  const raw=String(root?.dataset.rawText||'');
  const offset=Math.floor(Number(charIndex)||0)-Number(button.dataset.lessonBodyOffset||0);
  if(!root||offset<0||offset>=raw.length){clearLessonWordHighlight(button);return;}
  const words=[...root.querySelectorAll('[data-speech-start]')];
  const active=words.find(node=>{const start=Number(node.dataset.speechStart),end=start+node.textContent.length;return offset>=start&&offset<end;})||words.find(node=>Number(node.dataset.speechStart)>=offset);
  words.forEach(node=>{const selected=node===active;node.classList.toggle('speech-current-word',selected);if(selected)node.setAttribute('aria-current','true');else node.removeAttribute('aria-current');});
}
async function openSpeechSettings(){
  if(!Capacitor.isNativePlatform()||typeof NativeSpeechSettings.openVoiceDataSettings!=='function'){showToast('Speech data settings are unavailable here.','إعدادات بيانات النطق غير متاحة هنا.');return;}
  try{await NativeSpeechSettings.openVoiceDataSettings();}catch(error){console.warn('Android speech data settings could not be opened.',String(error?.message||error));showToast('Speech data settings could not be opened.','تعذّر فتح إعدادات بيانات النطق. افتح إعدادات الهاتف ثم خدمات تحويل النص إلى كلام.');}
}
function updateNavCounts(){const node=document.querySelector('#navCount');if(node&&bank)node.textContent=bank.count.toLocaleString('ar');}
function navView(view){document.querySelectorAll('.side-nav .nav-item[data-view],.mobile-nav button[data-view]').forEach(node=>{const active=node.dataset.view===view;node.classList.toggle('active',active);if(active)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');});}
function setActiveNav(view){const routeTabs=['home','review','bank','simulation','profile'];let active=view;if(['lesson','assistant','glossary','lessons','traps','numbers','comparisons'].includes(view))active='home';else if(['topics','similar-groups','search','mistakes','favorites'].includes(view))active='bank';else if(view==='quiz'||view==='result')active=routeTabs.includes(quiz?.returnView)?quiz.returnView:'bank';if(!routeTabs.includes(active))active='home';navView(active);}
function stopTimer(){if(timerHandle)clearInterval(timerHandle);timerHandle=null;}
function stopSpeech(){speechController.stop();document.querySelectorAll('.audio-button').forEach(b=>b.classList.remove('speaking','speech-paused'));}
function updateSourceDialog(){
  const link=document.querySelector('#officialSource');link.href=bank.sourceUrl;
  const portal=document.querySelector('#officialPortalPage');if(portal)portal.href=bank.sourcePortalPage;
  document.querySelector('#sourceVersion').innerHTML=pair(`Fonte registrata: Ministero delle Infrastrutture e dei Trasporti · ${bank.count.toLocaleString('it-IT')} quiz. Aggiornamento della pagina ufficiale: ${bank.sourcePageUpdated}. File collegato: ${bank.sourceFileName}. Metadati PDF: ${bank.sourcePdfDate}. Il portale non pubblica una data di rilascio o numero di versione ufficiale. Il link e il nome file sono quelli pubblicati dal portale; l'app non certifica una verifica della trascrizione e delle risposte domanda per domanda. Traduzione araba non ufficiale.`,`المصدر المسجل: وزارة البنية التحتية والنقل الإيطالية · ${bank.count.toLocaleString('ar')} سؤال. تحديث الصفحة الرسمية: ${bank.sourcePageUpdated}. الملف المرتبط: ${bank.sourceFileName}. بيانات PDF: ${bank.sourcePdfDate}. لا تنشر البوابة تاريخ إصدار أو رقم نسخة رسميًا للملف. الرابط واسم الملف كما تعرضهما البوابة؛ ولا يصادق التطبيق على مراجعة مطابقة كل سؤال وإجابته على حدة. الترجمة العربية غير رسمية.`);
}
function lessonKey(moduleId,index){return `${moduleId}.${index}`;}
function localDateKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function markStudyDay(){const today=localDateKey(),now=new Date(),yesterday=localDateKey(new Date(now.getFullYear(),now.getMonth(),now.getDate()-1));if(state.lastStudy!==today){state.streak=state.lastStudy===yesterday?state.streak+1:1;state.lastStudy=today;}}
function dailyGoalToday(){const date=localDateKey();if(state.dailyGoal?.date!==date)state.dailyGoal={date,questions:0,lessons:0};return state.dailyGoal;}
function recordDailyGoal(kind,count=1){const goal=dailyGoalToday();if(kind==='questions')goal.questions=Math.min(1_000_000,Number(goal.questions||0)+count);if(kind==='lessons')goal.lessons=Math.min(1_000_000,Number(goal.lessons||0)+count);}
function applyFontSize(){document.documentElement.style.fontSize=`${state.fontSize}px`;}
function adjustFontSize(delta){state.fontSize=Math.max(16,Math.min(22,state.fontSize+delta));applyFontSize();persistState();}
function applyThemeMode(){document.documentElement.dataset.theme=state.themeMode==='dark'?'dark':'system';document.documentElement.style.colorScheme=state.themeMode==='dark'?'dark':'';const button=document.querySelector('#themeToggle');if(button){const dark=state.themeMode==='dark';button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Usa l’aspetto del dispositivo · استخدام مظهر الجهاز':'Attiva la modalità scura · تفعيل الوضع الداكن');button.title=dark?'Usa l’aspetto del dispositivo · استخدام مظهر الجهاز':'Attiva la modalità scura · تفعيل الوضع الداكن';button.innerHTML=dark?'☀':'☾';}}
function applyLanguageOrder(){document.documentElement.dataset.languageOrder=state.languageOrder==='ar'?'ar':'it';}
applyThemeMode();
applyLanguageOrder();
function flatLessons(){return lessonModules.flatMap(m=>m.lessons.map((lesson,index)=>({module:m,lesson,index,key:lessonKey(m.module_id,index)})));}
function findLesson(key){return flatLessons().find(x=>x.key===key)||null;}
function getLessonAccess(){if(!lessonAccess&&lessonModules.length)lessonAccess=createLessonAccess(flatLessons().map(item=>item.key),FREE_LESSON_COUNT);return lessonAccess;}
function setLessonUnlockStatus(it,ar){const node=document.querySelector('#lessonUnlockStatus');if(!node)return;const italian=node.querySelector('[lang="it"]'),arabic=node.querySelector('[lang="ar"]');if(italian)italian.textContent=it;if(arabic)arabic.textContent=ar;}
function updatePrivacyOptionsButton(status){const button=document.querySelector('#privacyOptionsButton');if(button)button.hidden=!Capacitor.isNativePlatform()||status?.privacyOptionsRequired!==true;}
function ensureLessonAccess(moduleId,index,continueAfterUnlock){
  const key=lessonKey(moduleId,index),access=getLessonAccess();
  if(access?.hasAccess(key))return true;
  const item=findLesson(key);
  if(!item){showToast('Lezione non trovata.','لم نعثر على الدرس.');return false;}
  pendingLessonRequest={key,continueAfterUnlock};
  const italian=document.querySelector('#lessonUnlockLesson'),arabic=document.querySelector('#lessonUnlockLessonArabic');
  if(italian)italian.textContent=item.lesson.heading_it;
  if(arabic)arabic.textContent=item.lesson.heading_ar;
  const native=Capacitor.isNativePlatform(),button=document.querySelector('#watchRewardedLesson');
  if(button){button.hidden=!native;button.disabled=false;}
  setLessonUnlockStatus(
    native?'A Google test ad can unlock only this lesson for the current session.':'The test ad runs only in the Android test build.',
    native?'إعلان Google الاختباري يفتح هذا الدرس وحده لهذه الجلسة.':'إعلانات الاختبار تعمل فقط في نسخة Android التجريبية.'
  );
  if(lessonUnlockDialog&&!lessonUnlockDialog.open)lessonUnlockDialog.showModal();
  return false;
}
async function attemptRewardedLessonUnlock(){const request=pendingLessonRequest,button=document.querySelector('#watchRewardedLesson');if(!request)return;if(!Capacitor.isNativePlatform()||typeof NativeRewardedAds.showRewarded!=='function'){setLessonUnlockStatus('A rewarded test ad is unavailable here; no lesson was unlocked.','إعلان المكافأة الاختباري غير متاح هنا؛ لم يُفتح أي درس.');return;}if(button)button.disabled=true;setLessonUnlockStatus('Checking privacy choices and preparing the Google test ad…','جارٍ التحقق من خيارات الخصوصية وتجهيز إعلان Google الاختباري…');try{const consent=await adConsentPromise;if(consent?.canRequestAds===false){setLessonUnlockStatus('Google reports that an ad cannot be requested now. No lesson was unlocked.','تفيد Google بأنه لا يمكن طلب إعلان الآن؛ لم يُفتح أي درس.');return;}const result=await NativeRewardedAds.showRewarded();if(pendingLessonRequest!==request)return;const access=getLessonAccess();if(!access?.grantRewardedUnlock(request.key,result,Capacitor.isNativePlatform())){setLessonUnlockStatus('The ad did not complete with a verified reward. This lesson remains locked.','لم يكتمل الإعلان بمكافأة متحققة؛ يظل هذا الدرس مقفلًا.');return;}pendingLessonRequest=null;if(lessonUnlockDialog?.open)lessonUnlockDialog.close();request.continueAfterUnlock?.();}catch(error){console.warn('Rewarded test ad was unavailable or failed',error);setLessonUnlockStatus('The test ad could not be loaded. Try again later; no lesson was unlocked.','تعذّر تحميل الإعلان الاختباري. أعد المحاولة لاحقًا؛ لم يُفتح أي درس.');}finally{if(button)button.disabled=false;}}
async function updateAdConsentAtStartup(){if(!Capacitor.isNativePlatform()||typeof NativeRewardedAds.updateConsent!=='function'){updatePrivacyOptionsButton(null);adConsentPromise=Promise.resolve(null);return null;}adConsentPromise=Promise.resolve().then(()=>NativeRewardedAds.updateConsent()).catch(error=>{console.warn('Google UMP consent update failed',error);return null;});const status=await adConsentPromise;updatePrivacyOptionsButton(status);return status;}
async function openPrivacyOptions(){if(!Capacitor.isNativePlatform()||typeof NativeRewardedAds.showPrivacyOptions!=='function')return;try{const status=await NativeRewardedAds.showPrivacyOptions();adConsentPromise=Promise.resolve(status);updatePrivacyOptionsButton(status);}catch(error){console.warn('Google UMP privacy options could not be shown',error);showToast('Impostazioni privacy non disponibili.','خيارات الخصوصية غير متاحة الآن.');}}
async function showExamInterstitial(){if(!Capacitor.isNativePlatform()||typeof NativeRewardedAds.showInterstitial!=='function')return;try{const consent=await adConsentPromise;if(consent?.canRequestAds!==true)return;const result=await NativeRewardedAds.showInterstitial();if(result?.shown!==true)console.info('Test interstitial not shown:',result?.reason||'not_available');}catch(error){console.warn('Test interstitial could not be shown',error);}}
document.querySelector('#watchRewardedLesson')?.addEventListener('click',()=>{void attemptRewardedLessonUnlock();});
document.querySelector('#privacyOptionsButton')?.addEventListener('click',()=>{void openPrivacyOptions();});
lessonUnlockDialog?.addEventListener('close',()=>{pendingLessonRequest=null;const button=document.querySelector('#watchRewardedLesson');if(button)button.disabled=false;});
window.addEventListener('patente:ready',()=>{void updateAdConsentAtStartup();},{once:true});
function orderedTopics(){const found=[];const seen=new Set();for(const m of lessonModules)for(const l of m.lessons)for(const t of l.bank_topics||[])if(!seen.has(t)){seen.add(t);found.push(t);}return found;}
function topicLabel(topic){return topicLabels[topic]||{it:topic,ar:'موضوع من بنك الوزارة'};}
function sourceLabel(source){
  const raw=String(source.url||'');let url;try{url=new URL(raw);}catch{return {it:'Fonte normativa ufficiale',ar:'مصدر قانوني رسمي'};}
  const host=url.hostname.toLowerCase(),whole=`${raw} ${source.title||''}`;
  const article=(url.pathname.match(/art-(\d+)/i)||whole.match(/art(?:icolo)?[.\s-]*(\d+)/i)||[])[1];
  if(host.includes('aci.gov.it'))return article?{it:`ACI · Codice della strada · art. ${article}`,ar:`ACI · قانون الطرق الإيطالي · المادة ${article}`}:{it:'ACI · Codice della strada',ar:'ACI · قانون الطرق الإيطالي'};
  if(host.includes('normattiva.it')){
    if(whole.includes('2005-09-07;209')||/assicurazioni private/i.test(whole))return {it:'Normattiva · Codice delle assicurazioni private',ar:'Normattiva · قانون التأمينات الخاصة'};
    if(whole.includes('1942-03-16;262')||/codice civile/i.test(whole))return {it:'Normattiva · Codice civile italiano',ar:'Normattiva · القانون المدني الإيطالي'};
    if(whole.includes('24G00199')||/177\/2024/.test(whole))return {it:'Normattiva · Legge 177/2024',ar:'Normattiva · القانون الإيطالي 177/2024'};
    return {it:'Normattiva · Codice della strada vigente',ar:'Normattiva · قانون الطرق الإيطالي النافذ'};
  }
  if(host.includes('gazzettaufficiale.it'))return whole.includes('177')?{it:'Gazzetta Ufficiale · Legge 177/2024',ar:'الجريدة الرسمية الإيطالية · القانون 177/2024'}:{it:'Gazzetta Ufficiale · testo normativo',ar:'الجريدة الرسمية الإيطالية · نص تشريعي'};
  if(host.includes('mit.gov.it')){
    if(raw.includes('Decreto_Ministeriale_10-07-2002'))return {it:'MIT · Decreto ministeriale 10 luglio 2002 · cantieri stradali',ar:'وزارة النقل · المرسوم الوزاري 10 يوليو 2002 · أعمال الطرق'};
    if(url.pathname.includes('/news/'))return {it:'MIT · comunicato ufficiale sulla sicurezza stradale',ar:'وزارة النقل · بيان رسمي عن السلامة المرورية'};
    if(url.pathname.includes('codice-della-strada'))return {it:'MIT · Codice della strada e aggiornamenti',ar:'وزارة النقل · قانون الطرق وتحديثاته'};
    return {it:'Ministero delle Infrastrutture e dei Trasporti · fonte ufficiale',ar:'وزارة البنية التحتية والنقل · مصدر رسمي'};
  }
  return {it:'Fonte ufficiale',ar:'مصدر رسمي'};
}
function topicCount(topic){return questions.reduce((n,q)=>n+(q.topic===topic),0);}
function lessonPool(lesson){
  if(Array.isArray(lesson.review_question_ids)&&lesson.review_question_ids.length)return lesson.review_question_ids.map(id=>questionsById.get(Number(id))).filter(Boolean);
  const topics=new Set(lesson.bank_topics||[]);
  return questions.filter(q=>topics.has(q.topic)).sort((a,b)=>Number(a.id)-Number(b.id));
}
function relatedLessonForQuestion(q){
  const all=flatLessons();
  return all.find(item=>(item.lesson.review_question_ids||[]).some(id=>Number(id)===Number(q.id)))||all.find(item=>(item.lesson.bank_topics||[]).includes(q.topic))||null;
}
function lessonReviewCount(lesson){return lesson.source_check?1:lessonPool(lesson).length;}
function lessonImageMarkup(lesson,compact=false){
  const {official,src,isOfficialImage}=resolveLessonVisual(lesson,questions);
  if(!src)return `<div class="visual-placeholder">${pair('Immagine non disponibile','الصورة غير متاحة')}</div>`;
  const alt=isOfficialImage?`${official.it} / ${official.ar}`:`Illustrazione didattica / رسم تعليمي`;
  const caption=isOfficialImage?pair(official.it,official.ar,'figure-caption-pair'):pair('Illustrazione didattica non ufficiale.','رسم تعليمي توضيحي غير رسمي.','figure-caption-pair');
  const source=isOfficialImage?`<a class="figure-source" href="${esc(bank.sourceUrl)}#page=${official.page}" target="_blank" rel="noopener noreferrer">${controlLabel(`PDF p. ${official.page}`,`صفحة ${official.page} من المصدر`)}</a>`:`<span class="visual-not-official">${controlLabel('Illustrazione didattica','رسم تعليمي غير رسمي')}</span>`;
  return `<figure class="lesson-image ${compact?'compact':''}"><img src="${esc(src)}" loading="lazy" alt="${esc(alt)}"><figcaption>${caption}${source}</figcaption></figure>`;
}
function courseProgress(){const all=flatLessons();const complete=all.filter(x=>state.completedLessons.has(x.key)).length;return {all,complete,pct:all.length?Math.round(100*complete/all.length):0};}
function nextCourseLesson(){const all=flatLessons();if(state.lastLessonKey){const last=findLesson(state.lastLessonKey);if(last&&!state.completedLessons.has(last.key))return last;const i=all.findIndex(x=>x.key===state.lastLessonKey);if(i>=0&&i+1<all.length)return all[i+1];}return all.find(x=>!state.completedLessons.has(x.key))||all[0]||null;}
function openLesson(moduleId,index){if(!ensureLessonAccess(moduleId,index,()=>openLesson(moduleId,index)))return;currentLessonId=moduleId;currentLessonIndex=index;const key=lessonKey(moduleId,index);state.lastLessonKey=key;markStudyDay();persistState();render('lesson',{moduleId,index});}
function recentExamReadinessMarkup(){
  const recent=state.sessions.filter(item=>item.mode==='exam'&&!item.studyAdjusted).slice(0,3);
  const total=recent.reduce((sum,item)=>sum+Number(item.total||30),0);
  const right=recent.reduce((sum,item)=>sum+Number(item.right||0),0);
  const score=total?Math.round(right/total*100):null;
  return `<section class="readiness-card"><div><div class="eyebrow">${pair('RECENT EXAM PRACTICE','نتائج المحاكاة الأخيرة','eyebrow-pair')}</div><h2>${pair('Track your mock-exam average','تابع متوسط نتائج المحاكاة')}</h2><p>${pair(recent.length?`Based on your last ${recent.length} completed simulations; this is a study metric, not a guarantee of passing.`:'Complete a timed simulation to start your personal trend.',recent.length?`مبني على آخر ${recent.length.toLocaleString('ar')} محاكاة؛ مؤشر للمذاكرة وليس ضمانًا للنجاح.`:'أكمل محاكاة محددة الوقت لبدء متابعة مستواك.')}</p></div><strong>${score===null?'—':`${score.toLocaleString('ar')}%`}</strong><button class="quiet-button" data-action="exam">${controlLabel('Start exam','ابدأ محاكاة')}</button></section>`;
}
function studyInsightsMarkup(){
  const weakest=orderedTopics().map(topic=>{const total=Number(state.topicTotal[topic]||0),correct=Number(state.topicCorrect[topic]||0);return {topic,total,accuracy:total?Math.round(correct/total*100):0};}).filter(x=>x.total>=2).sort((a,b)=>a.accuracy-b.accuracy||b.total-a.total).slice(0,3);
  const topicRows=weakest.length?weakest.map(x=>`<div class="mastery-row"><div class="mastery-copy">${pair(topicLabel(x.topic).it,topicLabel(x.topic).ar)}<small>${x.total.toLocaleString('it-IT')} risposte · ${x.total.toLocaleString('ar')} إجابة</small></div><div class="mastery-track" role="progressbar" aria-label="${esc(topicLabel(x.topic).it)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${x.accuracy}"><i style="width:${x.accuracy}%"></i></div><strong>${x.accuracy.toLocaleString('ar')}%</strong></div>`).join(''):`<div class="insight-empty">${pair('Rispondi ad alcune domande di allenamento per individuare gli argomenti da ripassare.','أجب عن بعض أسئلة التدريب لتظهر الموضوعات التي تحتاج إلى تركيز.')}</div>`;
  const labels={exam:{it:'Esame simulato',ar:'محاكاة امتحان'},visual:{it:'Sfida visiva',ar:'تدريب بصري'},smart:{it:'Ripasso intelligente',ar:'مراجعة ذكية'},due:{it:'Ripasso programmato',ar:'مراجعة مستحقة'},custom:{it:'Allenamento personalizzato',ar:'تدريب مخصص'},topic:{it:'Quiz per argomento',ar:'تدريب موضوعي'},'lesson-review':{it:'Ripasso lezione',ar:'مراجعة درس'},mistakes:{it:'Errori',ar:'الأخطاء'},favorites:{it:'Preferiti',ar:'المحفوظات'},practice:{it:'Allenamento',ar:'تدريب'},single:{it:'Domanda singola',ar:'سؤال منفرد'}};
  const recent=state.sessions.slice(0,5).map(item=>{const mode=labels[item.mode]||labels.practice,day=Number.isFinite(item.at)?new Date(item.at).toLocaleDateString('it-IT',{day:'2-digit',month:'short'}):'';return `<div class="session-row"><span class="session-date">${esc(day)}</span><div class="session-kind">${pair(mode.it,mode.ar)}</div><strong>${Number(item.right||0).toLocaleString('ar')}/${Number(item.answered||0).toLocaleString('ar')}</strong><span class="session-result">${pair(item.mode==='exam'?(item.passed?'Superata':'Da rivedere'):`${Number(item.wrong||0)} errori`,item.mode==='exam'?(item.passed?'اجتياز':'تحتاج إلى مراجعة'):`${Number(item.wrong||0).toLocaleString('ar')} أخطاء`)}</span></div>`;}).join('');
  return `<section class="insight-grid"><article class="insight-card"><h2>${pair('Argomenti su cui concentrarsi','موضوعات تحتاج إلى تركيز')}</h2>${topicRows}</article><article class="insight-card"><h2>${pair('Sessioni di studio recenti','جلسات الدراسة الأخيرة')}</h2>${recent||`<div class="insight-empty">${pair('Le sessioni completate appariranno qui.','ستظهر جلساتك المكتملة هنا.')}</div>`}</article></section>`;
}
function officialSyllabusMarkup(){
  const rows=officialSyllabus.map(item=>{
    const target=(item.lesson_refs||[]).map(findLesson).find(Boolean);
    if(!target)return '';
    return `<li class="syllabus-map-item"><span class="syllabus-map-id">${esc(item.id.toUpperCase())}</span><div class="syllabus-map-copy">${pair(item.title_it,item.title_ar,'syllabus-map-title')}<small>${pair(`${item.lesson_refs.length} lezioni collegate`,`${item.lesson_refs.length.toLocaleString('ar')} دروس مرتبطة`)}</small></div><button class="syllabus-open" type="button" data-open-lesson="${esc(target.module.module_id)}" data-lesson-index="${target.index}" aria-label="${esc(`${item.title_it} / ${item.title_ar}`)}">${controlLabel('Open lesson','افتح درسًا')}</button></li>`;
  }).join('');
  return `<details class="official-syllabus"><summary><span class="syllabus-summary-copy">${pair(`${officialSyllabus.length} argomenti ufficiali collegati alle lezioni`,`${officialSyllabus.length.toLocaleString('ar')} موضوعًا رسميًا مرتبطًا بالدروس`,'unit-title')}</span><span class="accordion-chevron" aria-hidden="true"></span></summary><div class="official-syllabus-body"><p>${pair('Index based on the Ministry’s 2019 circular. It is a navigation aid, not a certification of legal completeness.','فهرس مبني على دورية الوزارة لعام 2019؛ أداة للتنقل وليس شهادة باكتمال التغطية القانونية.')}</p><ol class="syllabus-map-list">${rows}</ol><div class="syllabus-source-links"><a href="${esc(officialSyllabusMeta.source_url||'#')}" target="_blank" rel="noopener noreferrer">${pair('Apri la circolare del MIT sul programma','افتح دورية الوزارة للمنهج')}</a><a href="${esc(officialSyllabusMeta.exam_format_url||'#')}" target="_blank" rel="noopener noreferrer">${pair('Consulta le procedure d’esame attuali','تحقق من إجراءات الامتحان الحالية')}</a></div><p class="syllabus-exam-note">${pair(officialSyllabusMeta.exam_format_note_it||'',officialSyllabusMeta.exam_format_note_ar||'')}</p></div></details>`;
}
function dashboardIcon(name){
  const paths={
    spark:`<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z"/>`,
    exam:`<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6v3H9zM8 12h8M8 16h5"/>`,
    chat:`<path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/><path d="m17 2 .7 1.6L19.5 4l-1.8.7L17 6.5l-.7-1.8L14.5 4l1.8-.7L17 2Z"/>`,
    book:`<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6h13M8 10h7M8 13h7"/>`,
    sign:`<path d="M4 5h16l-2 5H6L4 5ZM6 10v9M18 10v9M9 14h6M9 17h6"/>`,
    alert:`<path d="m12 3 9 16H3l9-16Z"/><path d="M12 9v4M12 16h.01"/>`,
    bookmark:`<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4V4.5Z"/>`,
    arrow:`<path d="M5 12h14M13 6l6 6-6 6"/>`
  };
  return `<svg class="tool-svg" viewBox="0 0 24 24" aria-hidden="true">${paths[name]||paths.book}</svg>`;
}
function courseUnitIllustration(module){
  const paths={
    'road-basics':'<path d="M5 21 9 3h6l4 18M12 4v3m0 4v4m0 4v2"/>',
    'signs':'<path d="m12 3 9 17H3L12 3Z"/><path d="M12 9v5m0 3h.01"/>',
    'signals-markings':'<rect x="7" y="3" width="10" height="17" rx="3"/><circle cx="12" cy="8" r="1.7"/><circle cx="12" cy="13" r="1.7"/><path d="M12 20v2"/>',
    'priority-intersections':'<path d="M3 9h18M9 3v18M15 3v18M3 15h18"/><path d="m15 8 3 1-3 1"/>',
    'movement-overtaking':'<path d="M4 20 8 4h8l4 16M12 5v4m0 4v5"/><path d="m16 8 3 3-3 3"/>',
    'speed-stopping-highways':'<path d="M4 18a8 8 0 1 1 16 0"/><path d="m12 14 4-4M7 18h10"/>',
    'vehicle-safety':'<path d="m3 15 2-6h14l2 6v4H3zM6 9l2-4h8l2 4"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/>',
    'documents-liability':'<path d="M6 3h9l4 4v14H6zM15 3v5h4M9 12h7m-7 4h7"/>',
    'driver-health-environment':'<circle cx="12" cy="7" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M9 15l3 2 3-2"/>',
    'exam-supplement-driver':'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    'exam-supplement-vehicle':'<path d="m3 15 2-6h14l2 6v4H3zM6 9l2-4h8l2 4"/><circle cx="7" cy="17" r="1.5"/><circle cx="17" cy="17" r="1.5"/>',
  };
  const fallback='<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z"/><path d="M4 6h13M8 10h7M8 14h7"/>';
  const label=esc(`${module.title_it} / ${module.title_ar}`);
  return `<span class="course-unit-art"><svg viewBox="0 0 24 24" role="img" aria-label="${label}" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[module.module_id]||fallback}</svg></span>`;
}
function homePage(){
  const prog=courseProgress(),next=nextCourseLesson(),accuracy=state.practiceCount?Math.round(state.correctCount/state.practiceCount*100):0,totalLessons=prog.all.length;
  const reviewAlert=state.wrong.size?`<aside class="recommendation-banner"><div>${pair('A few questions are ready for another look.','لديك أسئلة تستحق مراجعة أخرى.')}</div><button class="small-button" data-action="mistakes">${controlLabel(`Review ${state.wrong.size} mistakes`,`راجع ${state.wrong.size.toLocaleString('ar')} أخطاء`)}</button></aside>`:'';
  const resumeBanner=state.activeQuiz?`<aside class="resume-banner"><div>${pair(progressStorageAvailable?'You have an unfinished study session saved on this device.':'Browser storage is unavailable; this unfinished session may be lost if you close the tab.',progressStorageAvailable?'لديك جلسة دراسة غير مكتملة محفوظة على هذا الجهاز.':'تخزين المتصفح غير متاح؛ قد تضيع الجلسة عند إغلاق الصفحة.')}</div><button class="primary-button" data-action="resume-session">${controlLabel('Resume session','استأنف الجلسة')}</button><button class="quiet-button" data-action="discard-session">${controlLabel('Discard','إلغاء')}</button></aside>`:'';
  const toolCards=[
    {view:'assistant',icon:'chat',tone:'mint',it:'Assistente',ar:'المساعد',subIt:'Aiuto pratico per lezioni e quiz.',subAr:'مساعدة في الدروس والأسئلة.'},
    {view:'glossary',icon:'book',tone:'blue',it:'Glossario',ar:'القاموس',subIt:'200 termini italiano–arabo con pronuncia.',subAr:'٢٠٠ مصطلح إيطالي–عربي مع النطق.'}
  ];
  const tools=toolCards.map(item=>`<button class="dashboard-tool dashboard-tool-primary ${item.tone}" type="button" data-view="${item.view}"><span class="tool-icon">${dashboardIcon(item.icon)}</span><span class="tool-copy">${pair(item.it,item.ar,'tool-title')}<small>${pair(item.subIt,item.subAr)}</small></span><span class="tool-arrow" aria-hidden="true">${dashboardIcon('arrow')}</span></button>`).join('');
  const moduleHtml=lessonModules.map((module,mi)=>{
    const done=module.lessons.filter((_,li)=>state.completedLessons.has(lessonKey(module.module_id,li))).length;
    const lessons=module.lessons.map((lesson,li)=>{
      const key=lessonKey(module.module_id,li),complete=state.completedLessons.has(key),access=getLessonAccess(),accessible=access?.hasAccess(key)===true,free=access?.isFree(key)===true;
      const searchText=`${lesson.heading_it} ${lesson.heading_ar} ${module.title_it} ${module.title_ar}`;
      const accessLabel=!accessible?controlLabel('Locked · test ad','مقفل · إعلان اختباري'):!free?controlLabel('Unlocked this session','مفتوح لهذه الجلسة'):complete?controlLabel('Completed','مكتمل'):controlLabel('Open lesson','افتح الدرس');
      return `<button class="course-lesson-row ${accessible?'':'is-locked'}" type="button" data-open-lesson="${esc(module.module_id)}" data-lesson-index="${li}" data-course-lesson-row data-search="${esc(searchText)}"><span class="lesson-row-mark ${complete?'is-done':''}" aria-hidden="true">${complete?'✓':String(li+1).padStart(2,'0')}</span><span class="course-lesson-copy">${pair(lesson.heading_it,lesson.heading_ar,'course-lesson-heading')}<small>${accessLabel}</small></span><span class="course-row-arrow" aria-hidden="true">›</span></button>`;
    }).join('');
    return `<details class="course-accordion" data-course-unit><summary><span class="course-unit-number">${String(mi+1).padStart(2,'0')}</span>${courseUnitIllustration(module)}<span class="course-accordion-title">${pair(module.title_it,module.title_ar,'unit-title')}</span><span class="unit-progress"><strong>${done.toLocaleString('ar')}/${module.lessons.length.toLocaleString('ar')}</strong><small>${pair('lezioni','دروس')}</small></span><span class="accordion-chevron" aria-hidden="true"></span></summary><div class="course-accordion-lessons"><p class="course-unit-intro">${pair(module.intro_it,module.intro_ar)}</p>${lessons}</div></details>`;
  }).join('');
  return `${resumeBanner}${reviewAlert}
  <details class="home-progress-details"><summary>${pair('Il tuo progresso','تقدمك الدراسي')}<span class="accordion-chevron" aria-hidden="true"></span></summary><section class="study-stats" aria-label="Panoramica dello studio · ملخص الدراسة"><div>${pair('Banca dati dei quiz','بنك الأسئلة')}<strong>${bank.count.toLocaleString('ar')}</strong></div><div>${pair('Precisione negli esercizi','دقة التدريب')}<strong>${accuracy.toLocaleString('ar')}%</strong></div><div>${pair('Lezioni completate','الدروس المكتملة')}<strong>${prog.complete.toLocaleString('ar')} / ${prog.all.length.toLocaleString('ar')}</strong></div><div>${pair('Giorni consecutivi di studio','أيام المذاكرة المتتالية')}<strong>${state.streak.toLocaleString('ar')}</strong></div></section></details>
  <section class="dashboard-section home-primary-actions"><div class="section-title-row"><div>${pair('Strumenti di studio','أدوات الدراسة','section-title')}</div></div><div class="dashboard-tools">${tools}</div></section>
  <details class="home-reference-tools"><summary>${pair('Altri strumenti utili','أدوات أخرى مفيدة')}<span class="accordion-chevron" aria-hidden="true"></span></summary><div class="home-reference-grid"><button class="small-button" data-view="traps">${controlLabel('Trap words','كلمات ملتبسة')}</button><button class="small-button" data-view="numbers">${controlLabel('Key numbers','أرقام مهمة')}</button><button class="small-button" data-view="comparisons">${controlLabel('Compare concepts','قارن المفاهيم')}</button><button class="small-button" data-view="bank">${controlLabel('All quiz questions','كل أسئلة الاختبار')}</button></div></details>
  <details class="course-finder" id="courseFinder"><summary>${pair('Cerca una lezione','ابحث عن درس')}<span class="accordion-chevron" aria-hidden="true"></span></summary><div class="course-finder-body"><p>${pair('Cerca i titoli delle lezioni in italiano o in arabo.','ابحث عن عنوان الدرس بالإيطالية أو العربية.')}</p><label class="course-search-box"><span class="search-glyph" aria-hidden="true">⌕</span><input id="courseSearch" type="search" autocomplete="off" placeholder="Cerca le lezioni · ابحث في الدروس" aria-label="Cerca le lezioni in italiano o in arabo · ابحث عن الدروس بالإيطالية أو العربية"></label><p id="courseSearchStatus" class="course-search-status" role="status" aria-live="polite">${pair(`Le ${totalLessons} lezioni sono organizzate per unità.`,`الدروس الـ${totalLessons.toLocaleString('ar')} مرتبة حسب الوحدة.`)}</p></div></details>
  ${officialSyllabusMarkup()}
  <details class="dashboard-insights"><summary>${pair('Progressi e risultati recenti','التقدم والنتائج الأخيرة')}<span aria-hidden="true" class="accordion-chevron"></span></summary>${recentExamReadinessMarkup()}${studyInsightsMarkup()}</details>
  <details class="course-catalog" id="courseCatalog"><summary>${pair('Contenuti del corso · 50 lezioni','محتوى المنهج · ٥٠ درسًا')}<span class="accordion-chevron" aria-hidden="true"></span></summary><div class="course-catalog-body"><div class="course-accordion-list">${moduleHtml}</div></div></details>
  <div class="notice-banner">${pair('Il testo italiano dei quesiti e le relative risposte rimandano alla fonte. Le traduzioni in arabo sono state generate dall’IA e non sono state revisionate da una persona; sono un supporto allo studio, non traduzioni giuridiche ufficiali.','نص الأسئلة وإجاباتها الإيطالية مرتبط بالمصدر. الترجمات العربية مولّدة آليًا ولم تُراجع بشريًا؛ استخدمها وسيلةً مساعدة للدراسة لا ترجمة قانونية رسمية.')}</div>`;
}
function lessonDetailPage(moduleId,index){
  const module=lessonModules.find(m=>m.module_id===moduleId),lesson=module?.lessons[index];
  if(!module||!lesson)return `<div class="empty-state">${pair('Lesson not found','لم نعثر على الدرس')}<button class="quiet-button" data-view="home">${controlLabel('Back to the course','العودة إلى المنهج')}</button></div>`;
  const all=flatLessons(),at=all.findIndex(x=>x.key===lessonKey(moduleId,index)),prev=all[at-1],next=all[at+1],key=lessonKey(moduleId,index),done=state.completedLessons.has(key);
  const {italian:lessonText}=buildLessonSpeechTexts(lesson);
  const sourceList=[...(module.sources||[]),...(lesson.sources||[])].filter((item,index,all)=>item?.url&&all.findIndex(other=>other.url===item.url)===index);
  const sources=sourceList.map(source=>{const label=sourceLabel(source);return `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${pair(label.it,label.ar,'source-link')}</a><small>${pair(source.legal_reference_it||'Riferimento normativo ufficiale',source.legal_reference||'مرجع قانوني رسمي')}</small></li>`;}).join('');
  return `<article class="lesson-detail-page" data-lesson-page="${esc(key)}"><header class="lesson-detail-head"><div class="eyebrow" lang="it">UNITÀ ${String(module.order_hint).padStart(2,'0')} · LEZIONE ${String(index+1).padStart(2,'0')}</div><h1>${pair(lesson.heading_it,lesson.heading_ar,'detail-title')}</h1></header>
  <div class="lesson-audio-row" role="group" aria-label="محتوى الدرس"><button class="audio-button" data-lesson-italian-audio="true" data-lesson-body-offset="${String(lesson.heading_it||'').trim().length+(lesson.body_it?2:0)}" data-tts-locale="${ITALIAN_TTS_LOCALE}" data-tts-text="${esc(lessonText)}">${controlLabel('Ascolta in italiano','استمع بالإيطالية')}</button>${lessonVideoBlock(lesson,moduleId,index)}</div>
  <div class="lesson-detail-copy">${renderLessonSections(lesson,lessonAnimationMarkup(lesson,module.module_id))}</div>
  <details class="lesson-sources" data-lesson-section="sources"><summary>${pair('Fonti ufficiali · apri per consultarle','مصادر رسمية · افتح لعرضها')}<span class="accordion-chevron" aria-hidden="true"></span></summary><ul>${sources}</ul></details>
  ${lessonVideoCTA(lesson,moduleId,index)}
  <nav class="lesson-footer-nav" aria-label="Navigazione tra le lezioni · التنقل بين الدروس"><button class="quiet-button" data-view="home">${controlLabel('Course home','الرئيسية')}</button>${prev?`<button class="quiet-button" data-open-lesson="${esc(prev.module.module_id)}" data-lesson-index="${prev.index}">${controlLabel('← Previous lesson',`← الدرس السابق: ${prev.lesson.heading_ar}`)}</button>`:''}${next?`<button class="primary-button" data-open-lesson="${esc(next.module.module_id)}" data-lesson-index="${next.index}">${controlLabel('Next lesson →',`الدرس التالي: ${next.lesson.heading_ar} ←`)}</button>`:''}<button class="small-button" data-review-lesson="${esc(key)}">${controlLabel('Review this lesson','راجع هذا الدرس')}</button><button class="small-button" data-ask-lesson="${esc(key)}">${controlLabel('Ask the tutor','اسأل المساعد')}</button><button class="small-button" data-toggle-complete="${esc(key)}">${done?controlLabel('Completed ✓ · undo','مكتمل ✓ · إلغاء العلامة'):controlLabel('Mark lesson complete','علّم الدرس مكتملًا')}</button></nav></article>`;
}
function reviewIndexPage(){
  const progress=courseProgress();
  const modules=lessonModules.map((m,mi)=>`<section class="review-module"><header>${pair(`UNIT ${String(mi+1).padStart(2,'0')} · ${m.title_it}`,`الوحدة ${mi+1} · ${m.title_ar}`)}</header>${m.lessons.map((lesson,li)=>{
    const key=lessonKey(m.module_id,li),count=lessonReviewCount(lesson),check=lesson.source_check,stored=check?state.sourceChecks[check.id]:null;
    const reviewed=state.reviewedLessons.has(key)||!!stored;
    const marker=check?(stored?.correct?'✓':stored?'!':''):(reviewed?'✓':'');
    const countText=check?pair('One Ministry-source checkpoint; separate from the linked question bank.','نقطة تحقق من مصدر الوزارة؛ مستقلة عن بنك الأسئلة المرتبط.'):
      pair(`${count.toLocaleString('it-IT')} selected official questions from linked topics`,`${count.toLocaleString('ar')} سؤالًا رسميًا مختارًا من الموضوعات المرتبطة`);
    const access=getLessonAccess(),accessible=access?.hasAccess(key)===true,reviewLabel=accessible?controlLabel(reviewed?'Review again':'Start review',reviewed?'أعد المراجعة':'ابدأ المراجعة'):controlLabel('Unlock with test ad','افتح بإعلان اختباري');
    return `<article class="review-lesson ${reviewed?'reviewed':''} ${accessible?'':'is-locked'}">${lessonImageMarkup(lesson,true)}<div class="review-lesson-copy">${pair(lesson.heading_it,lesson.heading_ar,'review-heading')}<small>${countText}</small></div><span class="review-mark" aria-label="${check&&stored&&!stored.correct?'Needs another review':''}">${marker}</span><button class="primary-button" data-review-lesson="${esc(key)}">${reviewLabel}</button></article>`;
  }).join('')}</section>`).join('');
  return `<div class="page-heading"><div>${pair('REVIEW · ONE LESSON AT A TIME','المراجعة · درس مستقل في كل مرة','eyebrow-pair')}<h1>${pair('Check what you understood','اختبر فهمك لكل درس')}</h1><p>${pair('Choose a lesson; answer questions selected from its linked Ministry topics, then see the correction. The 2024 update lesson has a separate Ministry-source check.','اختر درسًا وأجب عن أسئلة منتقاة من موضوعات الوزارة المرتبطة به، ثم شاهد التصحيح. ولدرس تحديث 2024 نقطة تحقق مستقلة من مصدر الوزارة.')}</p></div><span class="lesson-progress-label">${pair(`${state.reviewedLessons.size} reviewed`,`راجعت ${state.reviewedLessons.size.toLocaleString('ar')} درسًا`)}</span></div><div class="review-module-list">${modules}</div><div class="notice-banner">${pair('Bank-based reviews use the official Italian statements and recorded Vero/Falso answers. The Ministry-source checkpoint for the 2024 law is separate; it does not establish the question bank’s release date or whether later changes are reflected.','تعتمد المراجعات المأخوذة من البنك على العبارات الإيطالية الرسمية وإجاباتها المسجلة. أما نقطة التحقق المستندة إلى الوزارة بشأن قانون 2024 فهي تدريب مستقل؛ ولا تثبت تاريخ إصدار بنك الأسئلة أو مدى تغطيته للتعديلات اللاحقة.')}</div>`;
}
function bankIndexPage(){
  const topics=orderedTopics(),used=new Set(),topicOptions=topics.map(t=>`<option value="${esc(t)}">${esc(topicLabel(t).it)} · ${esc(topicLabel(t).ar)}</option>`).join('');
  const moduleSections=lessonModules.map((m,mi)=>{const moduleTopics=[];for(const l of m.lessons)for(const t of l.bank_topics||[])if(!used.has(t)){used.add(t);moduleTopics.push(t);}return `<section class="bank-unit"><header class="bank-unit-title"><span class="course-unit-number">${String(mi+1).padStart(2,'0')}</span>${pair(m.title_it,m.title_ar,'unit-title')}</header><div class="bank-topic-list">${moduleTopics.map(t=>{const label=topicLabel(t),count=topicCount(t),correct=state.topicCorrect[t]||0,total=state.topicTotal[t]||0;return `<article class="bank-topic-row"><button class="topic-open" data-bank-topic="${esc(t)}">${pair(label.it,label.ar,'bank-topic-name')}<small>${pair(`${count.toLocaleString('it-IT')} questions · ${correct}/${total} correct`,`${count.toLocaleString('ar')} سؤال · ${correct.toLocaleString('ar')} من ${total.toLocaleString('ar')} صحيحة`)}</small></button><button class="small-button" data-practice-topic="${esc(t)}">${controlLabel('Practice','تدرّب')}</button></article>`;}).join('')}</div></section>`;}).join('');
  return `<section class="bank-hero"><div>${pair('PATENTE AB · QUESTION BANK SOURCE','مصدر بنك أسئلة Patente AB','eyebrow-pair')}<h1>${pair('Browse the Patente AB source questions by course unit','تصفح أسئلة ملف Patente AB وفق وحدات المنهج')}</h1><p>${pair(`${bank.count.toLocaleString('it-IT')} statements attributed to the PDF linked from the official portal · ${topics.length} ordered subjects · PDF metadata date: ${bank.sourcePdfDate}. Verify wording, answers, and figures in the original file; this app does not certify every record individually. Check current law through the linked Ministry sources.`,`${bank.count.toLocaleString('ar')} سؤال من الملف المرتبط بالبوابة الرسمية · ${topics.length.toLocaleString('ar')} موضوعًا مرتبًا · تاريخ بيانات PDF: ${bank.sourcePdfDate}. تحقق من نص السؤال وإجابته وشكله في الملف الأصلي؛ فالتطبيق لا يصادق على المطابقة الفردية لكل سجل. راجع مصادر الوزارة للتعديلات النافذة.`)}</p></div><div class="bank-actions"><button class="primary-button" data-action="exam">${controlLabel('Final exam simulation','محاكاة الامتحان النهائي')}</button><button class="quiet-button" data-view="bank" data-all-bank="true">${controlLabel('Browse all questions','تصفح جميع الأسئلة')}</button><button class="quiet-button" data-view="similar-groups">${controlLabel(`Similar wordings · ${similarQuestionGroups.length}`,`صياغات متقاربة · ${similarQuestionGroups.length.toLocaleString('ar')}`)}</button></div></section><div class="notice-banner bank-scope-note">${pair('This app uses the Ministry-linked Patente AB PDF for categories A and B. Questions are not separated by license category, so this is not a B-only question filter; check the current official B syllabus.','يعتمد هذا التطبيق على ملف Patente AB المرتبط بالوزارة (الفئتان A وB). لا تُفرز الأسئلة بحسب الفئة؛ لذلك لا تمثل هذه القائمة مجموعة مخصصة لفئة B وحدها. راجع المصدر الرسمي للمنهج النافذ.')}</div><div class="bank-tool-row"><form class="search-row" id="searchForm"><input id="searchInput" placeholder="Cerca in italiano o arabo" aria-label="Search the question bank · البحث في بنك الأسئلة"><button type="submit">${controlLabel('Search','بحث')}</button></form><div class="field-hint">${pair('Cerca in italiano o in arabo','يمكنك البحث بالإيطالية أو بالعربية')}</div><div class="bank-utility-buttons"><button class="quiet-button" data-action="smart-practice">${controlLabel('Personalized practice · 10 questions','تدريب ذكي · 10 أسئلة')}</button><button class="quiet-button" data-practice-count="5">${controlLabel('Quick practice · 5','تدريب سريع · 5')}</button><button class="quiet-button" data-practice-count="10">${controlLabel('Quick practice · 10','تدريب سريع · 10')}</button><button class="quiet-button" data-practice-count="20">${controlLabel('Quick practice · 20','تدريب سريع · 20')}</button><button class="quiet-button" data-action="mistakes">${controlLabel(`Review errors (${state.wrong.size})`,`مراجعة الأخطاء (${state.wrong.size.toLocaleString('ar')})`)}</button><button class="quiet-button" data-action="favorites">${controlLabel(`Saved (${state.favorites.size})`,`المحفوظات (${state.favorites.size.toLocaleString('ar')})`)}</button><button class="quiet-button" data-show-all-bank="true">${controlLabel('All '+bank.count.toLocaleString('it-IT')+' questions','كل الأسئلة الـ'+bank.count.toLocaleString('ar'))}</button></div><form id="customPracticeForm" class="practice-builder"><div class="practice-builder-title">${pair('Build a focused study set','أنشئ مجموعة تدريب مخصصة')}</div><label><span>${pair('Topic','الموضوع')}</span><select id="customTopic"><option value="">All topics · كل الموضوعات</option>${topicOptions}</select></label><label><span>${pair('Focus','نوع الأسئلة')}</span><select id="customFocus"><option value="all">Mixed questions · متنوعة</option><option value="unanswered">Not answered yet · لم تُحل بعد</option><option value="mistakes">Questions I missed · أخطائي</option></select></label><label><span>${pair('Questions','عدد الأسئلة')}</span><input id="customCount" type="number" min="1" max="50" value="15" inputmode="numeric"></label><button class="primary-button" type="submit">${controlLabel('Start this session','ابدأ الجلسة')}</button></form><button class="quiet-button visual-challenge" data-action="sign-challenge">${controlLabel('Visual road-sign challenge · 10 questions','تحدي بصري لإشارات الطريق · 10 أسئلة')}</button></div><div class="section-title-row"><div>${pair('TOPICS IN COURSE ORDER','الموضوعات بترتيب المنهج','section-title')}</div><span>${pair('Open a topic to browse every question','افتح الموضوع لتصفح جميع أسئلته')}</span></div>${moduleSections}<button class="exam-banner" data-action="exam">${pair('Ready? Start a timed final simulation: 30 questions · 20 minutes · up to 3 errors.','هل أنت مستعد؟ ابدأ محاكاة نهائية محددة الوقت: 30 سؤالًا · 20 دقيقة · حتى 3 أخطاء.')}</button>`;
}
function sourceAnchor(q){
  if(q.source_url)return `<a href="${esc(q.source_url)}" target="_blank" rel="noopener noreferrer">${controlLabel(q.source_label_it||'Official ministry source',q.source_label_ar||'مصدر وزاري رسمي')}</a>`;
  return `<a href="${esc(bank.sourceUrl)}#page=${q.page}" target="_blank" rel="noopener noreferrer">${controlLabel(`Source page ${q.page}`,`صفحة المصدر ${q.page}`)}</a>`;
}
function questionAudio(q,answered=false){
  const buttons=`<button class="audio-button" data-tts-locale="it-IT" data-tts-text="${esc(q.it)}">${controlLabel('Listen to the question','استمع إلى السؤال')}</button><button class="audio-button" data-tts-locale="${ARABIC_TTS_LOCALE}" data-tts-text="${esc(q.ar||'')}">${controlLabel('Listen to Arabic (device voice)','استمع إلى العربية بصوت الجهاز')}</button>`;
  if(!answered)return `<div class="audio-controls">${buttons}</div>`;
  const isTrue=q.answer==='VERO';
  const it=`${q.it} Risposta corretta: ${isTrue?'Vero':'Falso'}.${q.explanation_it?` Spiegazione: ${q.explanation_it}`:''}`;
  const ar=`${q.ar||''} الإجابة الصحيحة: ${isTrue?'صحيح':'خطأ'}.${q.explanation_ar?` التفسير: ${q.explanation_ar}`:''}`;
  return `<div class="audio-controls">${buttons}<button class="audio-button" data-tts-locale="it-IT" data-tts-text="${esc(it)}">${controlLabel('Listen to the answer and explanation','استمع إلى الإجابة والتفسير')}</button><button class="audio-button" data-tts-locale="${ARABIC_TTS_LOCALE}" data-tts-text="${esc(ar)}">${controlLabel('Listen to Arabic (device voice)','استمع إلى العربية بصوت الجهاز')}</button></div>`;
}
function questionListRow(q){
  const saved=state.favorites.has(q.id);
  const similar=similarGroupByQuestion.get(Number(q.id));
  const similarMarkup=similar?`<div class="question-similarity-note"><span>${pair(`Similar wording · group ${similar.id} · ${similar.member_count} records`,`مجموعة صياغات متقاربة · ${Number(similar.member_count).toLocaleString('ar')} سجلات`)}</span><button type="button" class="small-button" data-open-similar-group="${esc(similar.id)}">${controlLabel(`Compare all ${similar.member_count} wordings`,`قارن الصياغات الـ${Number(similar.member_count).toLocaleString('ar')}`)}</button></div>`:'';
  return `<article class="question-row"><span class="question-id" aria-label="Question number ${esc(q.id)}">#${esc(q.id)}</span><div class="question-copy"><p class="q-it" lang="it" dir="ltr">${esc(q.it)}</p><p class="q-ar" lang="ar" dir="rtl">${esc(q.ar||'')}</p>${questionFigureMarkup(q)}${questionAudio(q)}<small class="question-topic">${pair(topicLabel(q.topic).it,topicLabel(q.topic).ar)}</small>${similarMarkup}</div><div class="question-row-actions"><button type="button" class="small-button favorite-toggle ${saved?'is-saved':''}" data-toggle-favorite="${q.id}" aria-pressed="${saved}" aria-label="${saved?'Saved question':'Save question'} · ${saved?'سؤال محفوظ':'احفظ السؤال'}">${controlLabel(saved?'Saved':'Save question',saved?'محفوظ':'احفظ السؤال')}</button><button type="button" class="small-button" data-open-id="${q.id}">${controlLabel('Answer','أجب')}</button></div></article>`;
}
function similarStudyUnits(group){
  return lessonModules.filter(module=>module.lessons.some(lesson=>(lesson.bank_topics||[]).includes(group.topic)));
}
function similarAnswerMarkup(question){
  const isTrue=question.answer==='VERO';
  return `<span class="similar-answer-pill ${isTrue?'is-true':'is-false'}"><span lang="it">${isTrue?'VERO':'FALSO'}</span><small lang="ar" dir="rtl">${isTrue?'الإجابة المسجلة: العبارة صحيحة':'الإجابة المسجلة: العبارة خاطئة'}</small></span>`;
}
function similarDiffMarkup(original,variant,side){
  const changes=diffQuestionText(original.it,variant.it);
  const html=renderDiffSide(changes,side,esc);
  const changed=changes.some(item=>item.type!=='equal');
  return {html:changed?html:`<span class="diff-no-change">${html}<small lang="ar" dir="rtl">لا يوجد اختلاف لفظي في النص الإيطالي المعروض.</small></span>`,changed};
}
function similarComparisonBody(group,selectedId){
  const original=questionsById.get(Number(group.representative_id));
  const variants=group.question_ids.map(id=>questionsById.get(Number(id))).filter(question=>question&&Number(question.id)!==Number(original?.id));
  if(!original||!variants.length)return `<p class="empty-state">${pair('No comparison pair is available.','لا يتوفر زوج للمقارنة.')}</p>`;
  const variant=variants.find(question=>Number(question.id)===Number(selectedId))||variants[0];
  const originalDiff=similarDiffMarkup(original,variant,'original');
  const variantDiff=similarDiffMarkup(original,variant,'variant');
  const units=similarStudyUnits(group),unitIt=units.map(unit=>unit.title_it).join(' · '),unitAr=units.map(unit=>unit.title_ar).join(' · ');
  const options=variants.map(question=>`<option value="${esc(question.id)}" ${Number(question.id)===Number(variant.id)?'selected':''}>#${esc(question.id)} · ${esc(question.it.slice(0,110))}${question.it.length>110?'…':''}</option>`).join('');
  const originalChanged=originalDiff.changed?'<span class="diff-token diff-removed" aria-hidden="true">−</span>':'';
  const variantChanged=variantDiff.changed?'<span class="diff-token diff-added" aria-hidden="true">+</span>':'';
  const explanation='قد يغيّر اختلاف كلمة الفاعل أو الفعل أو الشرط أو الرقم، وبالتالي يغيّر الحكم على العبارة. اللون الأحمر هنا يعني كلمة موجودة في الأصل وغير موجودة في البديل، والأخضر يعني كلمة أضيفت في البديل؛ الألوان لا تحدد وحدها الصواب. الإجابات المعروضة هي المسجلة لكل سؤال في بنك المصدر، ولا تتوافر بيانات تشرح أن هذا التغيير وحده سبب اختلاف الحكم.';
  return `<header>${pair(`${group.member_count} statements in an automatic wording group`,`مجموعة آلية تضم ${Number(group.member_count).toLocaleString('ar')} صياغة`,'similar-group-count')}<span>#${esc(group.id)}</span></header><p class="similar-group-intro" lang="ar" dir="rtl">قارن عبارتين متجاورتين، واختر أي صياغة من المجموعة من القائمة. التجميع آلي ولا يثبت أن السؤالين متكافئان.</p><label class="similar-variant-picker"><span lang="it">Choose a wording to compare</span><small lang="ar" dir="rtl">اختر صياغة لمقارنتها بالأصل</small><select data-similar-variant="${esc(group.id)}">${options}</select></label><div class="similar-comparison-grid"><section class="similar-comparison-statement original-statement"><header><strong>${pair(`Original wording · #${original.id}`,'الصياغة الأصلية')}</strong>${similarAnswerMarkup(original)}</header><p class="similar-diff-text" lang="it" dir="ltr">${originalDiff.html}${originalChanged}</p><p class="similar-translation" lang="ar" dir="rtl">${esc(original.ar||'لا تتوفر ترجمة عربية لهذا السؤال في البيانات.')}</p>${questionFigureMarkup(original)}${sourceAnchor(original)}</section><section class="similar-comparison-statement variant-statement"><header><strong>${pair(`Selected wording · #${variant.id}`,'الصياغة المختارة')}</strong>${similarAnswerMarkup(variant)}</header><p class="similar-diff-text" lang="it" dir="ltr">${variantDiff.html}${variantChanged}</p><p class="similar-translation" lang="ar" dir="rtl">${esc(variant.ar||'لا تتوفر ترجمة عربية لهذا السؤال في البيانات.')}</p>${questionFigureMarkup(variant)}${sourceAnchor(variant)}</section></div><div class="similar-diff-legend" lang="ar" dir="rtl"><span><i class="diff-token diff-removed">−</i> كلمة من الأصل حُذفت أو استُبدلت</span><span><i class="diff-token diff-added">+</i> كلمة أضيفت في الصياغة المختارة</span></div><aside class="similar-explanation" role="note"><strong lang="ar" dir="rtl">لماذا قد يغيّر هذا التعديل البسيط الإجابة؟</strong><p lang="ar" dir="rtl">${explanation}</p></aside><div class="similar-group-meta">${pair(topicLabel(group.topic).it,topicLabel(group.topic).ar)}${unitIt?pair(`Linked study unit: ${unitIt}`,`أبواب الدراسة المرتبطة: ${unitAr}`):''}</div>`;
}
function similarComparisonCard(group,selectedId){
  return `<article class="similar-group-card" id="${esc(group.id)}" data-similar-group-card="${esc(group.id)}">${similarComparisonBody(group,selectedId)}</article>`;
}
function similarGroupsPage(opts={}){
  const query=String(opts.query||'').trim(),moduleId=String(opts.module||''),groupId=String(opts.groupId||''),needle=norm(query);
  const filtered=similarQuestionGroups.filter(group=>{
    if(groupId&&group.id!==groupId)return false;
    const units=similarStudyUnits(group);
    if(moduleId&&!units.some(module=>module.module_id===moduleId))return false;
    if(!needle)return true;
    if(matchesSearchText(`${group.topic} ${topicLabel(group.topic).ar}`,needle))return true;
    return group.question_ids.some(id=>{const question=questionsById.get(Number(id));return question&&matchesSearchText(`${question.it} ${question.ar||''}`,needle);});
  });
  const pageSize=20,maxPage=Math.max(0,Math.ceil(filtered.length/pageSize)-1);
  browsePage=Math.max(0,Math.min(browsePage,maxPage));
  const moduleOptions=lessonModules.map((module,index)=>`<option value="${esc(module.module_id)}" ${module.module_id===moduleId?'selected':''}>${String(index+1).padStart(2,'0')} · ${esc(module.title_it)} — ${esc(module.title_ar)}</option>`).join('');
  const cards=filtered.slice(browsePage*pageSize,(browsePage+1)*pageSize).map(group=>similarComparisonCard(group)).join('');
  const count=filtered.reduce((total,group)=>total+group.member_count,0);
  return `<div class="page-heading"><div>${pair('SIMILAR QUESTION WORDINGS','مقارنة تفاعلية للصياغات المتقاربة','eyebrow-pair')}<h1>${pair('Compare source statements word by word','قارن نصّي السؤالين كلمةً بكلمة')}</h1><p>${pair(`${similarQuestionGroups.length.toLocaleString('it-IT')} automatic wording groups · ${similarGroupedQuestionCount.toLocaleString('it-IT')} source statements`,`${similarQuestionGroups.length.toLocaleString('ar')} مجموعة صياغات آلية · ${similarGroupedQuestionCount.toLocaleString('ar')} سؤالًا من المصدر`)}</p></div><button class="quiet-button" data-view="bank">${controlLabel('Back to question bank','العودة إلى بنك الأسئلة')}</button></div><div class="notice-banner">${pair('Red and green mark removed/added text, not truth. Vero/Falso badges are the source-bank answers for each individual statement. The groups are automatically generated and are not verified equivalent questions.','الأحمر والأخضر يميزان النص المحذوف والمضاف، ولا يحكمان على صحته. شارات صحيح/خطأ هي إجابة كل سؤال كما سجلها بنك المصدر. التجميع آلي وليس إثباتًا لتكافؤ الأسئلة.')}</div><form class="similar-filters" id="searchForm"><label><span>${pair('Study unit','باب الدراسة')}</span><select id="similarUnitFilter"><option value="">${pair('All study units','كل أبواب الدراسة')}</option>${moduleOptions}</select></label><label class="similar-search"><span>${pair('Search wording','ابحث في الصياغات')}</span><span class="search-row"><input id="searchInput" value="${esc(query)}" placeholder="Italiano o arabo · إيطالي أو عربي" aria-label="Search similar question wording · البحث في الصياغات المتقاربة"><button type="submit">${controlLabel('Search','بحث')}</button></span></label></form><div class="filters"><span class="list-meta">${pair(`${filtered.length.toLocaleString('it-IT')} comparison groups · ${count.toLocaleString('it-IT')} statements`,`مجموعات المقارنة ${filtered.length.toLocaleString('ar')} · الأسئلة ${count.toLocaleString('ar')}`)}</span></div>${cards?`<div class="similar-groups-list">${cards}</div><div class="pager"><button class="quiet-button" data-similar-page="prev" ${browsePage===0?'disabled':''}>${controlLabel('Previous','السابق')}</button><span>${pair(`${browsePage+1} / ${Math.max(1,Math.ceil(filtered.length/pageSize))}`,`${(browsePage+1).toLocaleString('ar')} / ${Math.max(1,Math.ceil(filtered.length/pageSize)).toLocaleString('ar')}`)}</span><button class="quiet-button" data-similar-page="next" ${browsePage>=maxPage?'disabled':''}>${controlLabel('Next','التالي')}</button></div>`:`<div class="empty-state">${pair('No similar wording groups match this filter.','لا توجد مجموعات صياغات مطابقة لهذا الاختيار.')}</div>`}`;
}
function listPage(kind,opts={}){
  let pool=questions,titleIt='Banca dati dei quiz',titleAr='بنك الأسئلة',subIt='Search in Italian or Arabic.',subAr='ابحث بالإيطالية أو العربية.';
  if(kind==='favorites'){pool=questions.filter(q=>state.favorites.has(q.id));titleIt='Saved questions';titleAr='الأسئلة المحفوظة';subIt='Your personal review set on this device.';subAr='مجموعة مراجعتك الشخصية على هذا الجهاز.';}
  if(kind==='mistakes'){pool=questions.filter(q=>state.wrong.has(q.id));titleIt='Questions to review';titleAr='أسئلة تحتاج إلى مراجعة';subIt='Try again and clear a question from this list by answering correctly.';subAr='أعد المحاولة؛ تُزال الأسئلة من القائمة عند الإجابة الصحيحة.';}
  const query=opts.query||'',topic=opts.topic||'',groupQuestionIds=Array.isArray(opts.groupQuestionIds)?new Set(opts.groupQuestionIds.map(Number)):null;let filtered=pool;
  if(opts.similarGroupId){subIt='These questions were grouped by similar Italian wording. Compare every word and figure; this does not mean they have the same answer.';subAr='جُمعت هذه الأسئلة لتقارب صياغتها الإيطالية. قارن كل كلمة وصورة؛ فهذا لا يعني أن إجاباتها واحدة.';}
  if(groupQuestionIds)filtered=filtered.filter(q=>groupQuestionIds.has(Number(q.id)));
  if(topic)filtered=filtered.filter(q=>q.topic===topic);
  if(query){filtered=filtered.filter(q=>matchesSearchText(`${q.id} ${q.it} ${q.ar||''} ${topicLabel(q.topic).it} ${topicLabel(q.topic).ar}`,query));}
  filtered.sort((a,b)=>Number(a.id)-Number(b.id));
  const pageSize=24,maxPage=Math.max(0,Math.ceil(filtered.length/pageSize)-1);browsePage=Math.max(0,Math.min(browsePage,maxPage));
  const visible=filtered.slice(browsePage*pageSize,(browsePage+1)*pageSize),label=topic?topicLabel(topic):null,scopedPractice=Array.isArray(opts.groupQuestionIds)&&opts.groupQuestionIds.length>0;
  return `<div class="page-heading"><div>${pair(kind==='bank'?'BANCA UFFICIALE':'RIPASSO PERSONALE',kind==='bank'?'بنك الأسئلة الرسمي':'مراجعة شخصية','eyebrow-pair')}<h1>${label?pair(label.it,label.ar):pair(titleIt,titleAr)}</h1><p>${pair(subIt,subAr)}</p></div><button class="primary-button" data-action="${scopedPractice?'practice-group':kind==='favorites'?'favorites':kind==='mistakes'?'mistakes':'practice'}" ${scopedPractice?`data-practice-group="${opts.groupQuestionIds.map(Number).join(',')}"`:''}>${scopedPractice?controlLabel('Practice this group','تدرّب على المجموعة'):controlLabel('Start random practice','ابدأ تدريبًا عشوائيًا')}</button></div><form class="search-row" id="searchForm"><input id="searchInput" value="${esc(query)}" placeholder="Cerca la domanda" aria-label="Search · بحث"><button type="submit">${controlLabel('Search','بحث')}</button></form><div class="field-hint">${pair('Cerca in italiano o in arabo','يمكنك البحث بالإيطالية أو العربية')}</div><div class="filters"><span class="list-meta">${pair(`${filtered.length.toLocaleString('it-IT')} results`,`النتائج ${filtered.length.toLocaleString('ar')}`)}</span>${topic?`<button class="quiet-button" data-view="bank">${controlLabel('Back to subjects','العودة للموضوعات')}</button>`:''}</div>${visible.length?`<div class="question-list">${visible.map(questionListRow).join('')}</div><div class="pager"><button class="quiet-button" data-page="prev" ${browsePage===0?'disabled':''}>${controlLabel('Previous','السابق')}</button><span>${pair(`${browsePage+1} / ${Math.max(1,Math.ceil(filtered.length/pageSize))}`,`${(browsePage+1).toLocaleString('ar')} / ${Math.max(1,Math.ceil(filtered.length/pageSize)).toLocaleString('ar')}`)}</span><button class="quiet-button" data-page="next" ${browsePage>=maxPage?'disabled':''}>${controlLabel('Next','التالي')}</button></div>`:`<div class="empty-state">${pair(kind==='favorites'?'No saved questions yet.':'No matching question.','لا توجد أسئلة مطابقة حاليًا.')}</div>`}`;
}
const officialHosts=new Set(['aci.gov.it','www.aci.gov.it','aci.it','www.aci.it','mit.gov.it','www.mit.gov.it','normattiva.it','www.normattiva.it','gazzettaufficiale.it','www.gazzettaufficiale.it','ilportaledellautomobilista.it','www.ilportaledellautomobilista.it']);
function safeAssistantLinks(text){
  const links=[];let raw=String(text||'');
  const put=(label,url)=>{const token=`__PATENTE_LINK_${links.length}__`;links.push({token,label,url});return token;};
  raw=raw.replace(/\[(.{1,160}?)\]\((https:\/\/[^)\s]+)\)/g,(_,label,url)=>put(label,url));
  raw=raw.replace(/https:\/\/[^\s<>]+/g,url=>{const clean=url.replace(/[.,!?;:]+$/,'');return put(clean,clean)+url.slice(clean.length);});
  let html=esc(raw);
  for(const item of links){
    let safe=false;try{const u=new URL(item.url);safe=u.protocol==='https:'&&officialHosts.has(u.hostname.toLowerCase());}catch{}
    const rendered=safe?`<a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.label)}</a>`:`${esc(item.label)} <span class="untrusted-link-note">(${esc(item.url)})</span>`;
    html=html.replace(item.token,rendered);
  }
  return html;
}
function assistantMessageMarkup(message){
  if(message.role!=='assistant')return `<div class="chat-content" dir="auto">${esc(message.content)}</div>`;
  const bilingual=splitBilingualAssistantAnswer(message.content);
  if(!bilingual)return `<div class="chat-content" dir="auto">${safeAssistantLinks(message.content)}</div>`;
  const italian=bilingual.italian,arabic=bilingual.arabic;
  const cleanSpeech=value=>value.replace(/\[(.+?)\]\(https:\/\/[^)]+\)/g,'$1').replace(/https:\/\/\S+/g,'').trim();
  return `<div class="assistant-answer-pair"><section class="assistant-answer-it" lang="it" dir="ltr"><strong>Italiano</strong><div>${safeAssistantLinks(italian)}</div></section><section class="assistant-answer-ar" lang="ar" dir="rtl"><strong>العربية</strong><div>${safeAssistantLinks(arabic)}</div></section></div><div class="audio-controls"><button class="audio-button" data-tts-locale="it-IT" data-tts-text="${esc(cleanSpeech(italian))}">${controlLabel('Listen to the Italian answer','استمع إلى الإجابة بالإيطالية')}</button><button class="audio-button" data-tts-locale="${ARABIC_TTS_LOCALE}" data-tts-text="${esc(cleanSpeech(arabic))}">${controlLabel('Listen to Arabic (device voice)','استمع إلى العربية بصوت الجهاز')}</button></div>`;
}
function glossaryPage(){
  const cards=glossaryEntries.map(entry=>{
    const category=glossaryCategories[entry.category]||glossaryCategories.licence_exam;
    return `<article class="glossary-card" data-glossary-entry data-glossary-category="${esc(entry.category)}" data-glossary-search="${esc(`${entry.it} ${entry.ar}`)}"><div class="glossary-term-head"><div><h2 lang="it" dir="ltr">${esc(entry.it)}</h2><p lang="ar" dir="rtl">${esc(entry.ar)}</p></div><button type="button" class="audio-button glossary-audio" data-tts-locale="it-IT" data-tts-text="${esc(entry.it)}" aria-label="Pronounce ${esc(entry.it)} in Italian · استمع إلى النطق الإيطالي"><svg class="audio-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12"/></svg>${controlLabel('Listen in Italian','استمع للنطق الإيطالي')}</button></div><div class="glossary-category">${pair(category.it,category.ar)}</div>${entry.note?`<p class="glossary-note" lang="ar" dir="rtl">${esc(entry.note)}</p>`:''}</article>`;
  }).join('');
  const options=Object.entries(glossaryCategories).map(([key,value])=>`<option value="${esc(key)}">${esc(value.it)} · ${esc(value.ar)}</option>`).join('');
  return `<section class="glossary-page"><header class="glossary-hero"><div class="eyebrow"><span lang="it">PATRIMONIO DI PAROLE</span><small lang="ar">مفردات الطريق والرخصة</small></div><h1>${pair('Italian–Arabic driving glossary','قاموس القيادة الإيطالي–العربي')}</h1><p>${pair(`A practical glossary of ${glossaryEntries.length.toLocaleString('it-IT')} selected licence and road-safety terms drawn from the course and quiz material. Tap the audio button to hear the Italian.`,`قاموس عملي يضم ${glossaryEntries.length.toLocaleString('ar')} مصطلحًا مختارًا من دروس الرخصة وأسئلة الطريق. اضغط زر الصوت لسماع النطق بالإيطالية.`)}</p><button class="quiet-button glossary-back" data-view="assistant">${controlLabel('Back to study assistant','العودة إلى المساعد الدراسي')}</button></header><div class="glossary-controls"><label><span>${pair('Search a word or meaning','ابحث عن كلمة أو معنى')}</span><input id="glossarySearch" type="search" autocomplete="off" placeholder="Italiano o arabo · إيطالي أو عربي" aria-label="Search glossary in Italian or Arabic · البحث في القاموس بالإيطالية أو العربية"></label><label><span>${pair('Category','التصنيف')}</span><select id="glossaryCategory"><option value="">${pair('All categories','كل التصنيفات')}</option>${options}</select></label></div><p id="glossaryStatus" class="glossary-status" role="status" aria-live="polite">${pair(`${glossaryEntries.length.toLocaleString('it-IT')} selected terms`,`المفردات ${glossaryEntries.length.toLocaleString('ar')}`)}</p><div class="glossary-list" id="glossaryList">${cards}</div><aside class="notice-banner glossary-disclaimer">${pair('This is a selected study glossary, not a complete dictionary or an official legal translation. Some Arabic equivalents are explanatory; preserve the Italian wording when answering official quiz questions.','هذا قاموس دراسي منتقى، وليس قاموسًا كاملًا أو ترجمة قانونية رسمية. بعض المقابلات العربية تفسيرية؛ حافظ على نص السؤال الإيطالي عند حل الاختبارات الرسمية.')}</aside></section>`;
}
function updateGlossaryResults(){
  const query=document.querySelector('#glossarySearch')?.value||'',category=document.querySelector('#glossaryCategory')?.value||'';
  let visible=0;
  document.querySelectorAll('[data-glossary-entry]').forEach(node=>{const match=(!category||node.dataset.glossaryCategory===category)&&(!query||matchesSearchText(node.dataset.glossarySearch,query));node.hidden=!match;if(match)visible++;});
  const status=document.querySelector('#glossaryStatus');if(status)status.innerHTML=pair(`${visible.toLocaleString('it-IT')} matching terms`,`المفردات المطابقة ${visible.toLocaleString('ar')}`);
}
function assistantPage(){
  const conversation=assistantMessages.map(m=>`<article class="chat-message ${m.role==='user'?'user-message':'assistant-message'}"><div class="chat-role">${m.role==='user'?controlLabel('You','أنت'):controlLabel('LOCAL TUTOR · IT / AR','المساعد المحلي')}</div>${assistantMessageMarkup(m)}</article>`).join('');
  const context=assistantContext?`<div class="assistant-context"><span>${pair('Study context attached','تم إرفاق سياق دراسي')}</span><button class="small-button" data-action="clear-assistant-context">${controlLabel('Remove','إزالة')}</button><p>${esc(assistantContext.slice(0,220))}${assistantContext.length>220?'…':''}</p></div>`:'';
  const privacyIt='The question bank and prepared lessons are stored on this device. If you choose the AI assistant, your question and any attached context are sent to the configured AI service for a reply; do not include personal or sensitive information. Account sign-in is optional. Chat is kept in this page and is not saved to local storage.';
  const privacyAr='بنك الأسئلة والدروس المُعدّة محفوظة على هذا الجهاز. إذا اخترت استخدام المساعد الذكي، يُرسل سؤالك وأي سياق مرفق إلى خدمة الذكاء الاصطناعي المهيأة لإعداد الرد؛ لا تُدرج معلومات شخصية أو حساسة. تسجيل الدخول اختياري. تبقى المحادثة في هذه الصفحة ولا تُحفظ في التخزين المحلي.';
  return `<section class="assistant-hero"><div class="eyebrow"><span lang="it">ASSISTENTE DIDATTICO</span><small lang="ar">مساعد تعليمي</small></div><h1>${pair('Ask about a rule, lesson or quiz question','اسأل عن قاعدة أو درس أو سؤال')}</h1><p>${pair('Prepared lessons and the question bank are available on this device. When configured, the optional AI assistant can answer open-ended questions using an online service.','الدروس المُعدّة وبنك الأسئلة متاحان على هذا الجهاز. عند تهيئته، يمكن للمساعد الذكي الاختياري الإجابة عن الأسئلة المفتوحة عبر خدمة على الإنترنت.')}</p><div class="assistant-hero-actions"><button class="quiet-button" data-view="glossary">${controlLabel('Open Italian–Arabic glossary','افتح القاموس الإيطالي–العربي')}</button>${assistantMessages.length?`<button class="quiet-button" data-action="clear-chat">${controlLabel('Clear conversation','مسح المحادثة')}</button>`:''}</div></section><div class="assistant-suggestions"><button type="button" class="suggestion-chip" ${assistantBusy?'disabled':''} data-assistant-prompt="Qual è la differenza tra fermata, sosta e arresto?">${controlLabel('Fermata vs sosta?','ما الفرق بين الوقوف المؤقت والركن؟')}</button><button type="button" class="suggestion-chip" ${assistantBusy?'disabled':''} data-assistant-prompt="Spiegami la regola generale della precedenza a destra.">${controlLabel('Right-of-way rules','اشرح قاعدة الأولوية من اليمين')}</button><button type="button" class="suggestion-chip" ${assistantBusy?'disabled':''} data-assistant-prompt="Come posso ricordare i segnali di pericolo?">${controlLabel('Warning signs','كيف أتذكر إشارات التحذير')}</button></div><section class="assistant-chat" id="assistantChat" aria-live="polite">${conversation||`<div class="chat-empty">${pair('Your study assistant is ready. Choose a suggestion or write your question below.','المساعد جاهز لمساعدتك. اختر سؤالًا مقترحًا أو اكتب سؤالك أدناه.')}</div>`}${assistantBusy?`<div class="chat-message assistant-message loading-answer"><div class="chat-role">${controlLabel('Thinking…','جارٍ إعداد الإجابة…')}</div><span class="spinner"></span></div>`:''}${assistantError?`<div class="assistant-error">${pair('The answer could not be loaded. Your message is kept; try again.','تعذّر تحميل الإجابة. احتفظنا برسالتك؛ أعد المحاولة.')}</div><button class="quiet-button" data-action="assistant-retry">${controlLabel('Retry','إعادة المحاولة')}</button>`:''}</section>${context}<aside class="assistant-privacy-note" role="note">${pair(privacyIt+' Do not send personal or sensitive information.',privacyAr+' لا تُرسل معلومات شخصية أو حساسة.')}</aside><form class="assistant-form" id="assistantForm"><label for="assistantInput">${pair('Your question','سؤالك')}</label><div class="assistant-input-hint">${pair('Scrivi in italiano o arabo','اكتب بالإيطالية أو العربية')}</div><textarea id="assistantInput" rows="3" maxlength="3500" placeholder="Scrivi la tua domanda" required ${assistantBusy?'disabled':''}>${esc(assistantDraft)}</textarea><div class="assistant-form-foot"><small>${pair('Optional account · if you choose the AI assistant, your question is sent to its configured service.','الحساب اختياري · عند اختيار المساعد الذكي، يُرسل سؤالك إلى الخدمة المهيأة.')}</small><button class="primary-button" type="submit" ${assistantBusy?'disabled':''}>${controlLabel('Send question','إرسال السؤال')}</button></div></form><div class="notice-banner">${pair('The local question bank and prepared explanations remain on this device. If the optional AI assistant is configured, your question is sent to its service. For current law, consult the linked official sources. Never use the app while driving.','يبقى بنك الأسئلة والشروح المُعدّة على هذا الجهاز. إذا كان المساعد الذكي الاختياري مهيأً، يُرسل سؤالك إلى خدمته. راجع المصادر الرسمية للقواعد النافذة، ولا تستخدم التطبيق أثناء القيادة.')}</div>`;
}
function smartPracticePool(limit=10){
  const now=Date.now();
  const ranked=questions.map(q=>{
    const stat=state.questionStats[String(q.id)]||{},misses=Number(stat.wrong||0),due=!stat.nextReviewAt||Number(stat.nextReviewAt)<=now,total=Number(state.topicTotal[q.topic]||0),correct=Number(state.topicCorrect[q.topic]||0),weakness=total>=3?1-correct/total:0;
    const dueError=(state.wrong.has(q.id)||misses>0)&&due;
    const unseen=!state.solved.has(q.id);
    const score=(dueError?8+Math.min(misses,5):0)+(weakness*5)+(unseen?1.5:0)+(Math.random()*0.35);
    return {q,score};
  });
  ranked.sort((a,b)=>b.score-a.score);
  return ranked.slice(0,Math.max(1,Math.min(30,Number(limit)||10))).map(x=>x.q);
}
function saveActiveQuiz(){
  if(!quiz)return;
  state.activeQuiz={mode:quiz.mode,questionIds:quiz.questions.map(q=>q.lesson_check?null:Number(q.id)),specialQuestions:quiz.questions.map(q=>q.lesson_check?{id:q.id}:null),answers:quiz.answers,index:quiz.index,remaining:quiz.remaining,timerMinutes:quiz.timerMinutes||20,studyAdjusted:!!quiz.studyAdjusted,autoRead:!!quiz.autoRead,lessonKey:quiz.lessonKey,lessonTitle:quiz.lessonTitle,returnView:quiz.returnView,flagged:quiz.flagged||[],reviewing:!!quiz.reviewing,savedAt:Date.now()};
  persistState();
}
function clearActiveQuiz(){state.activeQuiz=null;persistState();}
function quizRecoveryContext(){
  const sourceChecks=new Map(lessonModules.flatMap(module=>module.lessons.map(lesson=>lesson.source_check).filter(Boolean).map(check=>[check.id,check])));
  return {questions:questionsById,sourceChecks,lessonKeys:new Set(flatLessons().map(item=>item.key))};
}
function resumeActiveQuiz(){
  const saved=state.activeQuiz;
  if(saved?.mode==='lesson-review'&&saved.lessonKey&&!getLessonAccess()?.hasAccess(saved.lessonKey)){const item=findLesson(saved.lessonKey);if(item){ensureLessonAccess(item.module.module_id,item.index,()=>resumeActiveQuiz());return;}}
  const restored=restoreActiveQuiz(saved,quizRecoveryContext());
  if(!restored){clearActiveQuiz();showToast('La sessione salvata non è valida o non è più disponibile. Il resto dei progressi è stato mantenuto.','الجلسة المحفوظة تالفة أو لم تعد متاحة. احتفظنا ببقية تقدمك.');return;}
  let remaining=restored.remaining;
  if(restored.mode==='exam'&&Number.isFinite(restored.savedAt))remaining=Math.max(0,remaining-Math.floor((Date.now()-restored.savedAt)/1000));
  quiz={...restored,remaining};
  lastQuizDefinition={mode:quiz.mode,pool:quiz.questions,title:quiz.lessonTitle,lessonKey:quiz.lessonKey};currentView='quiz';setActiveNav('quiz');
  if(quiz.mode==='exam'&&remaining<=0){finishExam(true);return;}
  renderQuiz();if(quiz.mode==='exam')startExamTimer();
}
function startExamTimer(){
  stopTimer();timerHandle=setInterval(()=>{if(!quiz)return;quiz.remaining--;if(quiz.remaining<=0){finishExam(true);return;}const clock=document.querySelector('#examClock');if(clock){clock.textContent=formatTime(quiz.remaining);clock.classList.toggle('urgent',quiz.remaining<=120);}if(quiz.remaining%15===0)saveActiveQuiz();},1000);
}
function advanceQuiz(){if(!quiz)return;if(quiz.index<quiz.questions.length-1){quiz.index++;saveActiveQuiz();renderQuiz();return;}if(quiz.mode==='exam')finishExam(false);else finishPractice();}
function advanceExam(){if(!quiz)return;if(quiz.index===quiz.questions.length-1){quiz.reviewing=true;saveActiveQuiz();renderQuiz();}else{quiz.index++;saveActiveQuiz();renderQuiz();}}
function startQuiz(mode='practice',pool=null,meta={}){
  if(mode==='lesson-review'&&meta.lessonKey&&!getLessonAccess()?.hasAccess(meta.lessonKey)){const item=findLesson(meta.lessonKey);if(item){ensureLessonAccess(item.module.module_id,item.index,()=>startQuiz(mode,pool,meta));return;}}
  stopTimer();stopSpeech();let candidates=pool||questions;
  if(mode==='mistakes')candidates=questions.filter(q=>state.wrong.has(q.id));
  if(mode==='favorites')candidates=questions.filter(q=>state.favorites.has(q.id));
  if(mode==='smart')candidates=smartPracticePool(meta.count||10);
  if(mode==='due')candidates=dueQuestionPool(questions,state.questionStats).sort((a,b)=>{
    const priority=q=>state.wrong.has(q.id)?0:state.solved.has(q.id)?1:2;
    return priority(a)-priority(b)||(Number(state.questionStats[String(a.id)]?.nextReviewAt)||0)-(Number(state.questionStats[String(b.id)]?.nextReviewAt)||0);
  });
  if(!candidates.length){showToast('Nessuna domanda disponibile.','لا توجد أسئلة متاحة.');return;}
  if(mode==='exam')candidates=shuffle(candidates).slice(0,30);
  else if(mode==='practice')candidates=shuffle(candidates).slice(0,10);
  else if(mode==='custom')candidates=shuffle(candidates).slice(0,Math.max(1,Math.min(50,Number(meta.count)||10)));
  else if(mode==='visual')candidates=shuffle(candidates).slice(0,Math.max(1,Math.min(20,Number(meta.count)||10)));
  else if(mode==='topic'||mode==='mistakes'||mode==='favorites')candidates=shuffle(candidates).slice(0,15);
  else if(mode==='due')candidates=candidates.slice(0,Math.max(1,Math.min(30,Number(meta.count)||15)));
  else if(mode==='lesson-review')candidates=shuffle(candidates).slice(0,Math.min(5,candidates.length));
  else if(mode==='single')candidates=candidates.slice(0,1);
  lastQuizDefinition={mode,pool,title:meta.title||'',lessonKey:meta.lessonKey||''};
  const timerMinutes=mode==='exam'&&[20,30,40].includes(Number(meta.timerMinutes))?Number(meta.timerMinutes):20,autoRead=mode==='exam'&&meta.autoRead===true;
  quiz={mode,questions:candidates,answers:Array(candidates.length).fill(null),flagged:Array(candidates.length).fill(false),reviewing:false,index:0,remaining:timerMinutes*60,timerMinutes,studyAdjusted:mode==='exam'&&(timerMinutes!==20||autoRead),autoRead,lastAutoReadIndex:-1,lessonKey:meta.lessonKey||'',lessonTitle:meta.title||'',returnView:meta.returnView||(currentView==='result'?(quiz?.returnView||lastParentView):currentView)};
  currentView='quiz';setActiveNav('quiz');saveActiveQuiz();renderQuiz();
  if(mode==='exam')startExamTimer();
}
function formatTime(seconds){const m=Math.floor(seconds/60),s=seconds%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function currentQ(){return quiz?.questions[quiz.index];}
function renderQuiz(){
  if(!quiz)return;
  stopSpeech();
  const isExam=quiz.mode==='exam';
  if(isExam&&quiz.reviewing){
    const answered=quiz.answers.filter(value=>value!==null).length;
    const flagged=quiz.flagged.filter(Boolean).length;
    const firstUnanswered=quiz.answers.findIndex(value=>value===null);
    const cells=quiz.questions.map((item,index)=>{
      const hasAnswer=quiz.answers[index]!==null,marked=!!quiz.flagged[index];
      const statusIt=marked?'Da rivedere':hasAnswer?'Risposta data':'Senza risposta';
      const statusAr=marked?'للمراجعة':hasAnswer?'أُجيب':'بلا إجابة';
      const css=marked?'is-flagged':hasAnswer?'is-answered':'is-blank';
      return `<button type="button" class="exam-review-cell ${css}" data-action="goto-question" data-index="${index}" aria-labelledby="exam-review-label-${index}"><strong>${(index+1).toLocaleString('ar')}</strong><small>${pair(statusIt,statusAr)}</small><span class="visually-hidden" id="exam-review-label-${index}"><span lang="it" dir="ltr">Domanda ${index+1}: ${statusIt}</span><span lang="ar" dir="rtl">السؤال ${(index+1).toLocaleString('ar')}: ${statusAr}</span></span></button>`;
    }).join('');
    main.innerHTML=`<div class="quiz-shell"><div class="quiz-topline"><button class="quiet-button" data-action="quit">${controlLabel('Exit session','إنهاء الجلسة')}</button><span class="quiz-mode">${pair('EXAM REVIEW SHEET','مراجعة ورقة الامتحان')}</span><span class="exam-clock" id="examClock">${formatTime(quiz.remaining)}</span></div><div class="progress-track"><div class="progress-fill" style="width:100%"></div></div><article class="quiz-card exam-review-card"><h1>${pair('Review your answers before correction','راجع إجاباتك قبل التصحيح')}</h1><p>${pair(`${answered} of ${quiz.questions.length} answered · ${flagged} marked for review`,`${answered.toLocaleString('ar')} من ${quiz.questions.length.toLocaleString('ar')} أُجيب عنها · ${flagged.toLocaleString('ar')} للمراجعة`)}</p><div class="exam-review-grid">${cells}</div><div class="quiz-controls"><button class="quiet-button" data-action="back-to-current">${controlLabel('Return to last question','العودة إلى آخر سؤال')}</button><button class="primary-button" data-action="submit-exam">${controlLabel('Submit and correct exam','سلّم الورقة واعرض التصحيح')}</button></div></article></div>`;
    if(firstUnanswered>=0){const shortcut=document.createElement('button');shortcut.type='button';shortcut.className='quiet-button';shortcut.dataset.action='first-unanswered';shortcut.innerHTML=controlLabel('Vai alla prima domanda senza risposta','انتقل إلى أول سؤال بلا إجابة');main.querySelector('.quiz-controls')?.prepend(shortcut);}
    return;
  }
  const q=currentQ(),answered=quiz.answers[quiz.index],pct=quiz.index/quiz.questions.length*100;
  const label=q.lesson_check?{it:q.topic_it,ar:q.topic_ar}:topicLabel(q.topic),correct=q.answer==='VERO';
  const answerLabel=q.lesson_check?{it:'Risposta verificata nella fonte ministeriale',ar:'الإجابة وفق مصدر الوزارة'}:{it:'Risposta corretta registrata nel PDF ufficiale',ar:'الإجابة الصحيحة المسجلة في ملف الوزارة'};
  const feedback=isExam?'':answered===null||answered===undefined?'':`<div class="feedback ${answered===correct?'good':'bad'}" role="status"><strong>${pair(answered===correct?'Risposta corretta':'Risposta da rivedere',answered===correct?'إجابتك صحيحة':'إجابتك تحتاج إلى مراجعة')}</strong>${pair(`${answerLabel.it}: ${correct?'Vero':'Falso'}`,`${answerLabel.ar}: ${correct?'صحيح':'خطأ'}`)}${q.explanation_it?`<div class="quiz-explanation">${pair(q.explanation_it,q.explanation_ar||'')}</div>`:''}${questionAudio(q,true)}</div>`;
  const figure=q.image?`<figure class="quiz-figure"><img src="${esc(q.image)}" loading="lazy" alt="${esc(q.it)}"><figcaption>${pair('Original figure from the official quiz PDF.','الرسم الأصلي الوارد مع سؤال الوزارة.')}${sourceAnchor(q)}</figcaption></figure>`:q.hasFigureRef?`<div class="figure-panel">${pair('The statement refers to a figure; open the cited PDF page.','يشير السؤال إلى شكل؛ افتح صفحة ملف المصدر المشار إليها.')}</div>`:'';
  const questionId=q.lesson_check?`<span class="quiz-id">${controlLabel('MINISTRY SOURCE CHECK','فحص من مصدر الوزارة')}</span>`:`<span class="quiz-id">#${q.id}</span>`;
  const bookmarkButton=q.lesson_check?'':`<button class="bookmark-button ${state.favorites.has(q.id)?'saved':''}" data-action="bookmark">${pair(state.favorites.has(q.id)?'★ Saved':'☆ Save question',state.favorites.has(q.id)?'★ محفوظ':'☆ احفظ السؤال')}</button>`;
  const trueClass=`${answered===true?'selected-choice':''}${!isExam&&answered!==null&&answered!==undefined&&correct?' correct-choice':''}`.trim();
  const falseClass=`${answered===false?'selected-choice':''}${!isExam&&answered!==null&&answered!==undefined&&!correct?' correct-choice':''}`.trim();
  const locked=!isExam&&answered!==null&&answered!==undefined;
  const title=quiz.mode==='visual'?pair('VISUAL ROAD-SIGN PRACTICE','تدريب بصري على الإشارات'):pair(isExam?'FINAL EXAM SIMULATION':quiz.mode==='lesson-review'?'LESSON REVIEW':quiz.mode==='due'?'RIPASSO PROGRAMMATO':quiz.mode==='smart'?'PERSONALIZED PRACTICE':quiz.mode==='custom'?'CUSTOM PRACTICE':'PRACTICE',isExam?'محاكاة الامتحان النهائي':quiz.mode==='lesson-review'?'مراجعة الدرس':quiz.mode==='due'?'مراجعة مستحقة':quiz.mode==='smart'?'تدريب ذكي':quiz.mode==='custom'?'تدريب مخصص':'تدريب');
  const examControls=isExam?`<button class="quiet-button ${quiz.flagged[quiz.index]?'is-flagged':''}" data-action="flag">${controlLabel(quiz.flagged[quiz.index]?'Marked for review':'Mark for review',quiz.flagged[quiz.index]?'معلّم للمراجعة':'علّم للمراجعة')}</button><button class="quiet-button" data-action="skip">${controlLabel('Skip unanswered','تخطَّ بلا إجابة')}</button><button class="primary-button" data-action="exam-next">${controlLabel(quiz.index===quiz.questions.length-1?'Review answers':'Next →',quiz.index===quiz.questions.length-1?'مراجعة الإجابات':'التالي ←')}</button>`:`<button class="primary-button" data-action="next" ${answered===null||answered===undefined?'disabled':''}>${controlLabel(quiz.index===quiz.questions.length-1?'Show result':'Next question →',quiz.index===quiz.questions.length-1?'عرض النتيجة':'السؤال التالي ←')}</button>`;
  main.innerHTML=`<div class="quiz-shell"><div class="quiz-topline"><button class="quiet-button" data-action="quit">${controlLabel('Exit session','إنهاء الجلسة')}</button><span class="quiz-mode">${title}</span><span class="quiz-index">${(quiz.index+1).toLocaleString('ar')} / ${quiz.questions.length.toLocaleString('ar')}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><article class="quiz-card"><div class="quiz-tags"><span class="topic-tag">${pair(label.it,label.ar)}</span>${questionId}${isExam?`<span class="exam-clock" id="examClock">${formatTime(quiz.remaining)}</span>`:''}</div><p class="italian-question" lang="it" dir="ltr">${esc(q.it)}</p><p class="arabic-question" lang="ar" dir="rtl">${esc(q.ar||'')}</p>${questionAudio(q)}${figure}<div class="answer-area"><p class="answer-instruction">${pair('La frase è vera o falsa?','هل العبارة صحيحة أم خاطئة؟')}</p><div class="answer-buttons"><button class="answer-button true-choice ${trueClass}" data-answer="true" aria-pressed="${answered===true}" ${locked?'disabled':''}>${pair('Vero','صحيح')}</button><button class="answer-button false-choice ${falseClass}" data-answer="false" aria-pressed="${answered===false}" ${locked?'disabled':''}>${pair('Falso','خطأ')}</button></div>${feedback}</div><div class="quiz-controls">${bookmarkButton}<button class="quiet-button" data-action="prev" ${quiz.index===0?'disabled':''}>${controlLabel('Previous','السابق')}</button>${examControls}</div></article></div>`;
}
function updateQuestionMemory(q,correct){
  if(q.lesson_check)return;
  const key=String(q.id),previous=state.questionStats[key]||{};
  state.questionStats[key]=scheduleQuestionReview(previous,correct,Date.now());
}
function recordPractice(q,chosen){
  const right=chosen===(q.answer==='VERO');state.practiceCount++;recordDailyGoal('questions');
  if(q.lesson_check){if(right)state.correctCount++;state.sourceChecks[q.id]={correct:right};markStudyDay();persistState();return right;}
  state.solved.add(q.id);state.topicTotal[q.topic]=(state.topicTotal[q.topic]||0)+1;updateQuestionMemory(q,right);
  if(right){state.correctCount++;state.wrong.delete(q.id);state.topicCorrect[q.topic]=(state.topicCorrect[q.topic]||0)+1;}else state.wrong.add(q.id);
  markStudyDay();persistState();return right;
}
function answerQuestion(value){if(!quiz||(quiz.mode!=='exam'&&quiz.answers[quiz.index]!==null))return;quiz.answers[quiz.index]=value;const q=currentQ();if(quiz.mode!=='exam')recordPractice(q,value);saveActiveQuiz();renderQuiz();}
function nextQuestion(){advanceQuiz();}
function finishPractice(){
  if(!quiz)return;const session=quiz,total=session.answers.filter(a=>a!==null).length,right=session.answers.reduce((n,a,i)=>n+(a!==null&&a===(session.questions[i].answer==='VERO')?1:0),0);
  if(session.mode==='lesson-review'&&session.lessonKey){state.reviewedLessons.add(session.lessonKey);}
  state.activeQuiz=null;
  const results=session.questions.map((q,i)=>({q,chosen:session.answers[i],correct:session.answers[i]!==null&&session.answers[i]===(q.answer==='VERO'),skipped:session.answers[i]===null}));
  showResult({isExam:false,total,right,wrong:total-right,results,label:session.mode==='lesson-review'?session.lessonTitle:'',returnView:session.returnView});
}
function finishExam(byTime=false,explicitSubmit=false){
  if(!quiz)return;const session=quiz;stopTimer();let right=0,wrong=0,answered=0;
  const results=session.questions.map((q,i)=>{const chosen=session.answers[i];if(chosen===null)return {q,chosen,correct:false,skipped:true};answered++;const correct=chosen===(q.answer==='VERO');if(correct)right++;else wrong++;recordExamAnswer(q,correct);return {q,chosen,correct};});
  state.activeQuiz=null;persistState();showResult({isExam:true,byTime,total:session.questions.length,answered,right,wrong,results,returnView:session.returnView,studyAdjusted:!!session.studyAdjusted,timerMinutes:session.timerMinutes||20});
  if(explicitSubmit&&!byTime&&!session.studyAdjusted)void showExamInterstitial();
}
function recordExamAnswer(q,correct){
  state.practiceCount++;recordDailyGoal('questions');state.solved.add(q.id);state.topicTotal[q.topic]=(state.topicTotal[q.topic]||0)+1;updateQuestionMemory(q,correct);
  if(correct){state.correctCount++;state.wrong.delete(q.id);state.topicCorrect[q.topic]=(state.topicCorrect[q.topic]||0)+1;}else state.wrong.add(q.id);
  markStudyDay();
}
function recordSessionSummary(result){
  const mode=result.isExam?'exam':(quiz?.mode||'practice');
  state.sessions.unshift({at:Date.now(),mode,studyAdjusted:!!quiz?.studyAdjusted,timerMinutes:quiz?.timerMinutes||20,total:result.total,answered:result.answered??result.total,right:result.right,wrong:result.wrong,passed:result.isExam?result.answered===result.total&&result.wrong<=3:null,lessonKey:quiz?.lessonKey||'',lessonTitle:quiz?.lessonTitle||''});
  state.sessions=state.sessions.slice(0,20);state.activeQuiz=null;persistState();
}
function showResult(result){
  recordSessionSummary(result);stopTimer();stopSpeech();
  const passed=result.isExam&&result.answered===result.total&&result.wrong<=3,errors=result.results.filter(r=>!r.correct);
  lastParentView=result.returnView||'home';currentView='result';setActiveNav(result.returnView||'home');
  const rows=result.results.map(r=>{
    const q=r.q,ans=q.answer==='VERO',linkedLesson=!r.correct&&!q.lesson_check?relatedLessonForQuestion(q):null;
    const answerIt=`${q.lesson_check?'Controllo basato sulla fonte ministeriale':'Risposta registrata nel PDF ufficiale'}: ${ans?'Vero':'Falso'}.${q.explanation_it?` ${q.explanation_it}`:''}`;
    const answerAr=`${q.lesson_check?'تحقق مستند إلى مصدر الوزارة':'الإجابة المسجلة في ملف الأسئلة الرسمي'}: ${ans?'صحيح':'خطأ'}.${q.explanation_ar?` ${q.explanation_ar}`:''}`;
    return `<article class="review-item"><div class="review-question"><span class="question-id">${q.lesson_check?controlLabel('MIT','وزارة النقل'):('#'+esc(q.id))}</span><div><p lang="it" dir="ltr">${esc(q.it)}</p><p lang="ar" dir="rtl">${esc(q.ar||'')}</p>${questionAudio(q,true)}</div></div><div class="result-answer">${pair(r.skipped?'Non risposta':r.correct?'Corretto':'Da rivedere',r.skipped?'بلا إجابة':r.correct?'صحيح':'يحتاج إلى مراجعة')} · ${pair(answerIt,answerAr)}</div>${linkedLesson?`<button class="small-button remediation-link" data-open-lesson="${esc(linkedLesson.module.module_id)}" data-lesson-index="${linkedLesson.index}">${controlLabel('Review the related lesson','راجع الدرس المرتبط')}</button>`:''}${sourceAnchor(q)}</article>`;
  }).join('');
  const lessonLabel=result.label?findLesson(quiz?.lessonKey)?.lesson:null;
  main.innerHTML=`<section class="result-card"><div class="eyebrow"><span lang="it">${result.isExam?'ESITO DELLA SIMULAZIONE':'SESSIONE DI STUDIO'}</span><small lang="ar">${result.isExam?'نتيجة المحاكاة':'نتيجة جلسة الدراسة'}</small></div><div class="result-seal ${result.isExam&&!passed?'fail':''}">${result.isExam?(passed?'✓':'×'):`${result.right}/${result.total}`}</div><h1>${pair(result.isExam?(passed?'Simulazione superata':'Continua a esercitarti'):'Sessione completata',result.isExam?(passed?'اجتزت المحاكاة':'واصل التدريب'):'انتهت الجلسة')}</h1><p>${pair(result.isExam?'Simulazione didattica; l’esame ufficiale si svolge in italiano.':'Rivedi le risposte e continua con calma.',result.isExam?'هذه محاكاة تعليمية؛ الامتحان الرسمي باللغة الإيطالية.':'راجع الإجابات وواصل التعلّم بهدوء.')}</p>${result.isExam?`<div class="result-score"><div>${pair('Correct','صحيحة')}<strong>${result.right}</strong></div><div>${pair('Wrong','خاطئة')}<strong>${result.wrong}</strong></div><div>${pair('Blank','بلا إجابة')}<strong>${result.total-result.answered}</strong></div></div><p class="exam-criteria">${pair(result.answered<result.total?'Answer every question to complete the simulation.':result.wrong<=3?'Within the published threshold: no more than three errors.':'More than three errors; review and try again.',result.answered<result.total?'المحاكاة غير مكتملة: أجب عن جميع الأسئلة.':result.wrong<=3?'ضمن الحد المنشور: ثلاثة أخطاء كحد أقصى.':'تجاوزت ثلاثة أخطاء؛ راجع الأسئلة وأعد المحاولة.')}</p>`:''}${result.label?`<p>${pair('Lesson review','مراجعة الدرس')}: ${pair(result.label,lessonLabel?.heading_ar||result.label)}</p>`:''}<div class="hero-actions" style="justify-content:center"><button class="primary-button" data-action="practice">${controlLabel('New practice','تدريب جديد')}</button>${result.isExam?`<button class="quiet-button" data-view="bank">${controlLabel('Back to the bank','العودة إلى البنك')}</button>`:`<button class="quiet-button" data-view="review">${controlLabel('Review another lesson','راجع درسًا آخر')}</button>`}</div><div class="review-list"><div class="section-head"><h2>${pair(errors.length?'Review these answers':'Review your answers',errors.length?'راجع هذه الإجابات':'راجع إجاباتك')}</h2></div>${rows}</div></section>`;
  main.focus({preventScroll:true});
}
function speak(text,locale,button){const value=String(text||'').trim();if(!value)return Promise.resolve(false);return speechController.speak(value,locale,button);}
function setLessonExplainerStep(index){
  const section=main.querySelector('.lesson-animation');if(!section)return;
  const step=Math.max(0,Math.min(2,Number(index)||0));section.dataset.step=String(step);
  section.querySelectorAll('[data-explainer-step]').forEach(button=>{const active=Number(button.dataset.explainerStep)===step;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
  section.querySelectorAll('[data-explainer-stage]').forEach(stage=>{const active=Number(stage.dataset.explainerStage)===step;stage.classList.toggle('is-active',active);stage.setAttribute('aria-current',active?'step':'false');});
}
function setLessonExplainerPlaybackState(scene,status){
  if(!scene)return;
  const playing=status==='playing',paused=status==='paused';
  scene.classList.toggle('is-motion-playing',playing);scene.classList.toggle('is-motion-paused',paused);
  const motion=scene.querySelector('[data-toggle-motion]');if(motion){motion.setAttribute('aria-pressed',String(paused));motion.innerHTML=paused?'<span lang="it">Riprendi il movimento</span><small lang="ar" dir="rtl">استأنف الحركة</small>':'<span lang="it">Sospendi il movimento</span><small lang="ar" dir="rtl">أوقف الحركة</small>';}
  const play=scene.querySelector('[data-play-explainer]');if(play){const label=playing?{it:'Pausa',ar:'إيقاف مؤقت'}:paused?{it:'Riprendi',ar:'استئناف'}:{it:'Avvia la spiegazione',ar:'شغّل الشرح المرئي'};const icon=playing?'<path d="M7 5h4v14H7zM15 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>';play.dataset.playbackState=status;play.setAttribute('aria-label',`${label.it} · ${label.ar}`);play.innerHTML=`<span class="lesson-animation-play-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icon}</svg></span><span class="lesson-animation-play-label"><span lang="it">${label.it}</span><small lang="ar" dir="rtl">${label.ar}</small></span>`;}
}
function playLessonExplainer(button){
  const module=lessonModules.find(item=>item.module_id===currentLessonId),lesson=module?.lessons[currentLessonIndex];if(!lesson)return;
  const scene=button.closest('.lesson-animation');
  if(speechController.isActive(button)){const wasPaused=speechController.state==='paused';speechController.toggle();setLessonExplainerPlaybackState(scene,wasPaused?'playing':'paused');return;}
  setLessonExplainerStep(0);
  setLessonExplainerPlaybackState(scene,'playing');
  const stages=lesson.visual_script?.stages||[];
  const intros=['Idea principale:','Esempio:','Attenzione all’errore comune:'];
  const fallback=[lesson.core_it||lesson.body_it,lesson.example_it,lesson.common_mistakes?.[0]?.mistake_it||lesson.pitfall_it];
  const visualStageExcerpt=(text,max=190)=>{const value=String(text||'').trim();if(value.length<=max)return value;const boundary=value.slice(0,max).lastIndexOf(' ');return `${value.slice(0,boundary>max*.55?boundary:max).trim()}…`;};
  const segments=Array.from({length:3},(_,index)=>({text:`${intros[index]} ${visualStageExcerpt(stages[index]?.text_it||fallback[index]||'')}`}));
  void speechController.speakSequence(segments,ITALIAN_TTS_LOCALE,button,index=>setLessonExplainerStep(index)).finally(()=>{if(button.isConnected&&!speechController.isActive(button))setLessonExplainerPlaybackState(scene,'idle');});
}
const profileControlGroups={
  profileAccountControls:['.account-trigger'],
  profileAppearanceControls:['.text-size-control','#themeToggle'],
  profileProgressControls:['#progressBackupButton'],
  profilePrivacyControls:['#openSources','#privacyOptionsButton'],
  profileConnectivityControls:['#connectivityIndicator']
};
function returnProfileControlsToStore(){
  const store=document.querySelector('#profileControlStore');if(!store)return;
  for(const selectors of Object.values(profileControlGroups))for(const selector of selectors){
    const node=document.querySelector(selector);if(node&&node.parentElement!==store)store.append(node);
  }
}
function mountProfileControls(){
  for(const [targetId,selectors] of Object.entries(profileControlGroups)){
    const target=document.getElementById(targetId);if(!target)continue;
    for(const selector of selectors){const node=document.querySelector(selector);if(node)target.append(node);}
  }
  const language=document.querySelector('#languageOrderSelect');if(language)language.value=state.languageOrder==='ar'?'ar':'it';
}
function profilePage(){
  const accountStatus=accountService?.isConfigured===false?'Account sign-in is not configured in this build.':'Use the optional account for sync, or continue with local progress.';
  return `<section class="profile-page"><header class="page-heading"><div>${pair('IL TUO PROFILO','ملفك الشخصي','eyebrow-pair')}<h1>${pair('Profile & settings','الملف الشخصي والإعدادات')}</h1><p>${pair('Manage your study preferences, local backup, account and privacy options.','أدر تفضيلات الدراسة والنسخة الاحتياطية المحلية والحساب وخيارات الخصوصية.')}</p></div></header>
  <div class="profile-settings-grid">
    <section class="profile-setting-card"><h2>${pair('Account and sync','الحساب والمزامنة')}</h2><p>${pair(accountStatus,'يمكنك الدراسة محليًا دون حساب؛ المزامنة اختيارية.')}</p><div id="profileAccountControls" class="profile-control-set"></div></section>
    <section class="profile-setting-card"><h2>${pair('Display','العرض')}</h2><div class="profile-setting-row"><span>${pair('Text size','حجم النص')}</span><div id="profileAppearanceControls" class="profile-control-set"></div></div><p>${pair('Increase or reduce the text size, or switch between dark mode and the device appearance.','كبّر النص أو صغّره، وبدّل بين الوضع الداكن ومظهر الجهاز.')}</p></section>
    <section class="profile-setting-card"><h2>${pair('Language order','ترتيب اللغات')}</h2><label class="profile-language-setting" for="languageOrderSelect"><span>${pair('Keep both languages visible; choose which appears first.','أبقِ اللغتين ظاهرتين واختر أيهما تظهر أولًا.')}</span><select id="languageOrderSelect"><option value="it">Italiano first · الإيطالية أولًا</option><option value="ar">العربية first · العربية أولًا</option></select></label></section>
    <section class="profile-setting-card"><h2>${pair('Progress backup','نسخ التقدم')}</h2><p>${pair('Export or restore a local copy of your study progress.','صدّر نسخة محلية من تقدمك الدراسي أو استعدها.')}</p><div id="profileProgressControls" class="profile-control-set"></div></section>
    <section class="profile-setting-card"><h2>${pair('Privacy and information','الخصوصية والمعلومات')}</h2><p>${pair('Review official source information and the account privacy notice. Google privacy choices appear here when required.','راجع معلومات المصادر الرسمية وبيان خصوصية الحساب. تظهر خيارات خصوصية Google هنا عند الحاجة.')}</p><div id="profilePrivacyControls" class="profile-control-set"></div><div id="profileConnectivityControls" class="profile-connectivity"></div></section>
  </div></section>`;
}
function simulationPage(){
  const exams=state.sessions.filter(item=>item.mode==='exam'&&!item.studyAdjusted);
  const last=exams[0];
  const recentSummary=last?pair(`Last standard simulation: ${Number(last.right||0)}/${Number(last.total||30)} correct · ${Number(last.wrong||0)} errors.`, `آخر محاكاة قياسية: ${Number(last.right||0).toLocaleString('ar')}/${Number(last.total||30).toLocaleString('ar')} صحيحة · ${Number(last.wrong||0).toLocaleString('ar')} أخطاء.`):pair('Your completed standard simulations will appear here.','ستظهر هنا نتائج المحاكاة القياسية المكتملة.');
  return `<section class="simulation-page"><header class="simulation-hero"><div class="eyebrow">${pair('SIMULAZIONE D’ESAME','محاكاة الامتحان')}</div><h1>${pair('Prepare with the standard Patente B simulation','استعد بمحاكاة امتحان Patente B القياسية')}</h1><p>${pair('This launches the app’s actual timed exam session using its existing question bank and scoring flow.','يبدأ هذا جلسة الامتحان المحددة الوقت الفعلية في التطبيق، باستخدام بنك الأسئلة وآلية التقييم الحالية.')}</p><div class="simulation-criteria"><strong>30</strong><span>${pair('questions','سؤالًا')}</span><strong>20</strong><span>${pair('minutes','دقيقة')}</span><strong>3</strong><span>${pair('maximum errors','أخطاء كحد أقصى')}</span></div><div class="simulation-actions"><button class="primary-button" data-action="start-standard-exam">${controlLabel('Start standard simulation','ابدأ المحاكاة القياسية')}</button><button class="quiet-button" data-action="exam">${controlLabel('Accessibility and study options','خيارات الإتاحة والتدريب')}</button></div><p class="simulation-recent" role="status">${recentSummary}</p></header></section>`;
}
function render(view,options={}){
  returnProfileControlsToStore();
  if(currentView==='quiz'&&quiz&&view!=='quiz'&&view!=='result')saveActiveQuiz();
  stopTimer();stopSpeech();currentView=view;
  if(view!=='quiz'&&view!=='result')quiz=null;
  setActiveNav(view);
  if(view==='home'||view==='lessons')main.innerHTML=homePage();
  else if(view==='lesson'){
    currentLessonId=options.moduleId||currentLessonId;
    currentLessonIndex=Number.isInteger(options.index)?options.index:currentLessonIndex;
    main.innerHTML=lessonDetailPage(currentLessonId,currentLessonIndex);
  }else if(view==='review')main.innerHTML=reviewIndexPage();
  else if(view==='simulation')main.innerHTML=simulationPage();
  else if(view==='profile')main.innerHTML=profilePage();
  else if(view==='similar-groups')main.innerHTML=similarGroupsPage(options);
  else if(view==='bank'||view==='topics'){
    if(options.topic||options.query||options.kind)main.innerHTML=listPage(options.kind||'bank',options);
    else main.innerHTML=bankIndexPage();
  }else if(view==='mistakes'||view==='favorites')main.innerHTML=listPage(view);
  else if(view==='assistant'){
    main.innerHTML=assistantPage();
    const chat=document.querySelector('#assistantChat');if(chat)chat.scrollTop=chat.scrollHeight;
  }else if(view==='glossary')main.innerHTML=glossaryPage();
  else if(['traps','numbers','comparisons'].includes(view))main.innerHTML=renderReferencePage(view,referenceData,{pair});
  else if(view==='search'){
    browsePage=0;main.innerHTML=listPage('bank',options);document.querySelector('#searchInput')?.focus();
  }
  if(view==='profile')mountProfileControls();
  main.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});updateNavCounts();
}
function startLessonReview(key){
  const item=findLesson(key);
  if(!item){showToast('Lezione non trovata.','لم نعثر على الدرس.');return;}
  if(!getLessonAccess()?.hasAccess(item.key)){ensureLessonAccess(item.module.module_id,item.index,()=>startLessonReview(key));return;}
  const pool=item.lesson.source_check?[item.lesson.source_check]:lessonPool(item.lesson);
  if(!pool.length){showToast('Nessun quiz collegato a questa lezione.','لا توجد أسئلة مرتبطة بهذا الدرس.');return;}
  startQuiz('lesson-review',pool,{lessonKey:item.key,title:item.lesson.heading_it});
}
function submitLessonQuiz(moduleId){const module=lessonModules.find(x=>x.module_id===moduleId);if(!module)return;showToast('Usa il ripasso individuale per ogni lezione.','استخدم صفحة المراجعة لاختبار كل درس على حدة.');}
async function sendAssistantPrompt(retry=false,promptOverride=''){
  const input=document.querySelector('#assistantInput');const prompt=retry?assistantMessages.at(-1)?.content:resolveAssistantPrompt(input?.value||assistantDraft,promptOverride);if(!prompt||assistantBusy)return;
  const history=(retry?assistantMessages.slice(-9,-1):assistantMessages.slice(-4)).map(m=>({role:m.role,content:m.content}));
  if(!retry){assistantMessages.push({role:'user',content:prompt});assistantDraft='';}
  assistantBusy=true;assistantError='';render('assistant');
  try{
    const result=await requestAssistantAnswer({prompt,context:assistantContext,questions,similarGroups:similarQuestionGroups});
    assistantMessages.push({role:'assistant',content:result.content});
  }catch(error){console.error('assistant request could not produce a local result',error);assistantError='assistant_error';}
  finally{assistantBusy=false;render('assistant');}
}
function attachLessonContext(key){const found=findLesson(key);if(!found)return;const l=found.lesson;assistantContext=`Patente B lesson — ${l.heading_it}\n${l.heading_ar}\n\n${l.body_it}\n${l.body_ar}`.slice(0,2800);render('assistant');}
function attachQuestionContext(q){assistantContext=`Official Patente B question #${q.id}\nItalian: ${q.it}\nArabic: ${q.ar}\nCorrect answer: ${q.answer}\nOfficial PDF page: ${q.page}\nTopic: ${q.topic}`;render('assistant');}
function offlineCacheLabel(){if(offlineCacheState==='ready')return 'دون اتصال: جاهز';if(offlineCacheState==='partial'){const stats=offlineCacheStats;return `دون اتصال: جزئي${stats?` · الصور ${Number(stats.imageCached)||0}/${Number(stats.imageTotal)||0}`:''}`;}if(offlineCacheState==='unavailable')return 'دون اتصال: غير متاح';return 'دون اتصال: جارٍ التحقق';}
function updateConnectivity(){const offline=!navigator.onLine,root=document.querySelector('#connectivityIndicator'),status=document.querySelector('#connectivityStatus'),detail=document.querySelector('#connectivityDetail');root?.classList.toggle('is-offline',offline);if(status)status.textContent=offline?'Offline':'Online';if(detail)detail.textContent=`${offline?'غير متصل':'متصل'} · ${offlineCacheLabel()}`;}
window.addEventListener('online',updateConnectivity);window.addEventListener('offline',updateConnectivity);updateConnectivity();
if('serviceWorker'in navigator)navigator.serviceWorker.addEventListener('message',event=>{const data=event.data;if(data?.type!=='OFFLINE_CACHE_STATUS')return;offlineCacheState=data.status==='ready'?'ready':data.status==='partial'?'partial':'unavailable';offlineCacheStats={imageCached:data.imageCached,imageTotal:data.imageTotal,coreCached:data.coreCached,coreTotal:data.coreTotal};updateConnectivity();});
function vocabularyMarkup(text,baseOffset=0){
  const value=String(text);
  const speechWords=(segment,offset)=>{let cursor=0,html='';for(const match of segment.matchAll(/[\p{L}\p{M}]+(?:[’'`][\p{L}\p{M}]+)*/gu)){html+=esc(segment.slice(cursor,match.index));html+=`<span class="speech-word" data-speech-start="${offset+match.index}">${esc(match[0])}</span>`;cursor=match.index+match[0].length;}return html+esc(segment.slice(cursor));};
  const wordMarkup=(segment,index=-1,entry=null,offset=0)=>{
    if(index>=0)return `<span class="wt-word inline-vocabulary-term" role="button" tabindex="0" data-vocabulary-index="${index}" aria-haspopup="dialog" aria-label="${esc(`${entry.it}: ${entry.ar}`)}">${speechWords(segment,offset)}</span>`;
    let cursor=0,html='';for(const match of segment.matchAll(/[\p{L}\p{M}]+(?:[’'`][\p{L}\p{M}]+)*/gu)){html+=esc(segment.slice(cursor,match.index));const word=match[0];html+=`<span class="wt-word speech-word" data-speech-start="${offset+match.index}" role="button" tabindex="0" data-tap-word="${esc(word)}" aria-haspopup="dialog" aria-label="${esc(`Traduci ${word} · ترجمة ${word}`)}">${esc(word)}</span>`;cursor=match.index+word.length;}return html+esc(segment.slice(cursor));
  };
  const matches=findGlossaryMatches(value);if(!matches.length)return wordMarkup(value,-1,null,baseOffset);let cursor=0,html='';
  for(const match of matches){const index=glossaryEntries.indexOf(match.entry);if(index<0||match.start<cursor)continue;html+=wordMarkup(value.slice(cursor,match.start),-1,null,baseOffset+cursor);html+=wordMarkup(value.slice(match.start,match.end),index,match.entry,baseOffset+match.start);cursor=match.end;}
  return html+wordMarkup(value.slice(cursor),-1,null,baseOffset+cursor);
}
function lessonSentenceMarkup(text){
  const value=String(text),sentences=splitSentences(value);if(!sentences.length)return vocabularyMarkup(value);let cursor=0,html='';
  for(const sentence of sentences){const start=value.indexOf(sentence,cursor);if(start<0)continue;html+=vocabularyMarkup(value.slice(cursor,start),cursor);html+=`<span class="lesson-sentence" data-sentence-tap="true" data-sentence-offset="${start}" data-sentence-end="${start+sentence.length}">${vocabularyMarkup(sentence,start)}</span><button type="button" class="sentence-translation-trigger" data-sentence-translate="${start}" aria-label="Translate this sentence · ترجم الجملة" title="Translate this sentence · ترجم الجملة">↔</button>`;cursor=start+sentence.length;}
  return html+vocabularyMarkup(value.slice(cursor),cursor);
}
function translationOffsetAtPoint(root,x,y){
  let point=null;try{point=document.caretPositionFromPoint?.(x,y)||document.caretRangeFromPoint?.(x,y);}catch{}
  const node=point?.offsetNode||point?.startContainer,offset=Number(point?.offset??point?.startOffset)||0;if(!node||!root.contains(node))return 0;
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let total=0,current;while((current=walker.nextNode())){if(current.parentElement?.closest('.sentence-translation-trigger'))continue;if(current===node)return total+Math.min(offset,current.textContent.length);total+=current.textContent.length;}return 0;
}
function pairedArabicForItalian(italianNode){
  const languagePair=italianNode?.closest('.language-pair');
  const lessonBody=italianNode?.closest('.lesson-body-pair');
  const structured=italianNode?.closest('.question-copy,.review-question,.quiz-card,.review-item');
  const visualStage=italianNode?.closest('.lesson-animation-stage');
  const similarPair=italianNode?.closest('.similar-comparison-statement');
  return lessonBody?.querySelector('.lesson-ar-full')||languagePair?.querySelector('.pair-ar')||structured?.querySelector('.q-ar,.arabic-question,[lang="ar"]')||visualStage?.querySelector('.lesson-animation-stage-ar')||similarPair?.querySelector('.similar-translation')||null;
}
function closeWordTooltip({restoreFocus=false}={}){
  const tooltip=document.querySelector('#wordTranslationTooltip');if(!tooltip||tooltip.hidden)return;
  tooltip.hidden=true;
  activeWordTooltipAnchor?.setAttribute('aria-expanded','false');
  if(restoreFocus&&activeWordTooltipAnchor?.isConnected)activeWordTooltipAnchor.focus({preventScroll:true});
  activeWordTooltipAnchor=null;
}
let activeWordTooltipAnchor=null;
function positionWordTooltip(){
  const tooltip=document.querySelector('#wordTranslationTooltip');
  if(!tooltip)return;
  tooltip.style.removeProperty('left');
  tooltip.style.removeProperty('top');
}
function showWordTooltip(node,event,word,entry=null){
  const tooltip=document.querySelector('#wordTranslationTooltip');if(!tooltip)return;
  const matched=translateTappedWord(word,glossaryEntries);
  document.querySelector('#translationTooltipWord').textContent=matched.italian||word;
  document.querySelector('#translationTooltipArabic').textContent=matched.arabic||'لم يُسجَّل مقابل عربي مفرد لهذه الكلمة.';
  document.querySelector('#translationTooltipNote').textContent=matched.note;
  const tooltipAudio=document.querySelector('#translationTooltipAudio');if(tooltipAudio){tooltipAudio.dataset.ttsText=matched.italian||word;tooltipAudio.dataset.ttsLocale=ITALIAN_TTS_LOCALE;}
  closeWordTooltip();
  tooltip.hidden=false;activeWordTooltipAnchor=node||null;activeWordTooltipAnchor?.setAttribute('aria-expanded','true');
  positionWordTooltip(node,event);
  if(event?.detail===0)document.querySelector('#translationTooltipClose')?.focus({preventScroll:true});
}
function openTappedWord(node,event={}){
  closeWordTooltip();
  const indexed=node?.dataset?.vocabularyIndex!==undefined?glossaryEntries[Number(node.dataset.vocabularyIndex)]:null;
  const italianNode=node?.matches?.('.lesson-it-text,.q-it,.italian-question,.pair-it,[lang="it"]')?node:node?.closest?.('.lesson-it-text,.q-it,.italian-question,.pair-it,[lang="it"]')||node;
  const offset=italianNode&&event?translationOffsetAtPoint(italianNode,event.clientX||0,event.clientY||0):0;
  const word=indexed?.it||node?.dataset?.tapWord||wordAtOffset(italianNode?.dataset?.rawText||italianNode?.textContent||node?.textContent||'',offset);
  if(word)void loadLocalWordDictionary().then(()=>{if(!node||node.isConnected)showWordTooltip(node,event,word,indexed);});
}
function showInlineSentenceTranslation(trigger,event){
  const italianNode=trigger?.closest('.lesson-it-text'),body=italianNode?.closest('.lesson-body-pair'),languagePair=italianNode?.closest('.language-pair'),arabicNode=body?.querySelector('.lesson-ar-full')||languagePair?.querySelector('.pair-ar');if(!italianNode||!arabicNode)return;
  const selectedSentence=trigger.closest('.lesson-sentence[data-sentence-offset]'),specifiedOffset=trigger.dataset.sentenceTranslate??selectedSentence?.dataset.sentenceOffset;
  const offset=specifiedOffset!==undefined?Number(specifiedOffset):translationOffsetAtPoint(italianNode,event?.clientX||0,event?.clientY||0),rawText=italianNode.dataset.rawText||italianNode.textContent||'',matched=translateLessonSentence(rawText,arabicNode.textContent||'',offset);
  const placement=selectedSentence||[...italianNode.querySelectorAll('.lesson-sentence[data-sentence-offset]')].find(sentence=>Number(sentence.dataset.sentenceOffset)===offset)||italianNode;
  body?.querySelector('.inline-sentence-translation')?.remove();languagePair?.parentElement?.querySelector('.inline-sentence-translation')?.remove();
  const note=document.createElement('div');note.className='inline-sentence-translation';note.setAttribute('role','status');note.setAttribute('aria-live','polite');
  const arabic=document.createElement('span');arabic.lang='ar';arabic.dir='rtl';arabic.textContent=matched.translation;
  note.append(arabic);placement.insertAdjacentElement('afterend',note);
}
function openVocabularyCard(rawIndex,event){
  const entry=glossaryEntries[Number(rawIndex)];if(!entry)return;
  const anchor=event?.target instanceof Element?event.target.closest(`.wt-word[data-vocabulary-index="${Number(rawIndex)}"]`):null;
  showWordTooltip(anchor||document.querySelector(`.wt-word[data-vocabulary-index="${Number(rawIndex)}"]`),event,entry.it,entry);
}function enhanceLessonVocabulary(){
  for(const node of main.querySelectorAll('.lesson-it-text:not([data-vocabulary-ready])')){const text=node.textContent||'';node.dataset.rawText=text;node.innerHTML=lessonSentenceMarkup(text);node.dataset.vocabularyReady='true';node.dataset.translationTappable='true';node.tabIndex=0;node.setAttribute('role','group');node.setAttribute('aria-label','Testo italiano della lezione. Premi Invio per mostrare la traduzione araba · نص الدرس بالإيطالية؛ اضغط Enter لإظهار ترجمته العربية');}
  const heading=main.querySelector('.lesson-content-block h2');if(heading&&!heading.nextElementSibling?.classList.contains('inline-vocabulary-hint'))heading.insertAdjacentHTML('afterend',`<p class="inline-vocabulary-hint">${pair('Tocca una parola per tradurre','انقر على الكلمة للترجمة')}</p>`);
}
function quickStudyGuideMarkup(){
  return `<details class="quick-study-guide" data-quick-guide><summary>${pair('È la prima volta? Inizia con tre semplici passi','جديد هنا؟ ابدأ بثلاث خطوات بسيطة')}<span class="accordion-chevron" aria-hidden="true"></span></summary><div class="quick-study-steps"><article><strong>01</strong><div>${pair('Studia una breve lezione bilingue','تعلّم درسًا ثنائي اللغة')}</div><button class="small-button" data-action="continue-course">${controlLabel('Apri la prossima lezione','افتح الدرس التالي')}</button></article><article><strong>02</strong><div>${pair('Esercitati per argomento e ripassa gli errori','تدرّب حسب الموضوع وراجع أخطاءك')}</div><button class="small-button" data-action="smart-practice">${controlLabel('Inizia con 10 domande','ابدأ 10 أسئلة')}</button></article><article><strong>03</strong><div>${pair('Prova una simulazione d’esame quando ti senti pronto','جرّب المحاكاة عندما تصبح مستعدًا')}</div><button class="small-button" data-action="exam">${controlLabel('Scegli le opzioni dell’esame','اختر إعدادات المحاكاة')}</button></article></div></details>`;
}
function dailyGoalMarkup(){
  const goal=dailyGoalToday(),questionTarget=10,lessonTarget=1,due=dueQuestionPool(questions,state.questionStats).length;
  const questionPct=Math.min(100,Math.round(Number(goal.questions||0)/questionTarget*100)),lessonPct=Math.min(100,Math.round(Number(goal.lessons||0)/lessonTarget*100));
  return `<section class="daily-goal-card" data-daily-goal aria-labelledby="dailyGoalTitle"><div class="daily-goal-copy"><div class="eyebrow">${pair('OBIETTIVO DI STUDIO DI OGGI','هدف الدراسة اليوم')}</div><h2 id="dailyGoalTitle">${pair('Un passo costante oggi','خطوة ثابتة اليوم')}</h2><p>${pair('Rispondi a 10 domande e completa una lezione. Il conteggio comprende le sessioni di ripasso e le risposte date nelle simulazioni.','أجب عن ١٠ أسئلة وأكمل درسًا واحدًا. يشمل العدّ المراجعة والإجابات المسلّمة في المحاكاة.')}</p></div><div class="daily-goal-meters"><div class="daily-goal-meter"><span>${pair('Domande','الأسئلة')}</span><strong>${Math.min(questionTarget,Number(goal.questions||0)).toLocaleString('ar')} / ${questionTarget.toLocaleString('ar')}</strong><i role="progressbar" aria-label="Obiettivo giornaliero delle domande · هدف الأسئلة اليومي" aria-valuemin="0" aria-valuemax="${questionTarget}" aria-valuenow="${Math.min(questionTarget,Number(goal.questions||0))}"><b style="width:${questionPct}%"></b></i></div><div class="daily-goal-meter"><span>${pair('Lezioni','الدروس')}</span><strong>${Math.min(lessonTarget,Number(goal.lessons||0)).toLocaleString('ar')} / ${lessonTarget.toLocaleString('ar')}</strong><i role="progressbar" aria-label="Obiettivo giornaliero delle lezioni · هدف الدروس اليومي" aria-valuemin="0" aria-valuemax="${lessonTarget}" aria-valuenow="${Math.min(lessonTarget,Number(goal.lessons||0))}"><b style="width:${lessonPct}%"></b></i></div></div><div class="daily-goal-actions"><button type="button" class="small-button" data-action="due-review" aria-label="Ripassa le domande previste e quelle nuove · راجع الأسئلة المستحقة والجديدة">${controlLabel(`Ripassa le domande previste e quelle nuove · ${due.toLocaleString('it-IT')}`,`راجع المستحق · ${due.toLocaleString('ar')}`)}</button></div></section>`;
}
function ensureButtonAccessibleNames(root=main){for(const button of root?.querySelectorAll?.('button')||[]){if(button.hasAttribute('aria-label')||button.hasAttribute('aria-labelledby'))continue;const text=(button.textContent||button.title||'').replace(/\s+/gu,' ').trim();if(text)button.setAttribute('aria-label',text);}}
function syncDynamicStudyFeatures(){
  if(currentView==='home'&&main.querySelector('.study-stats')&&!main.querySelector('[data-daily-goal]'))(main.querySelector('.home-progress-details')||main.querySelector('.study-stats')).insertAdjacentHTML('beforebegin',dailyGoalMarkup());
  if(currentView==='lesson'){
    const marks=[['.lesson-detail-head','title'],['.lesson-audio-row','listen'],['.lesson-animation','visualNotice'],['.lesson-it-text','italian'],['.lesson-ar-full','translation'],['.lesson-mistakes','errors'],['.lesson-sources','source'],['.lesson-footer-nav','buttons']];
    for(const [selector,name] of marks){const node=main.querySelector(selector);if(node)node.dataset.lessonSection=name;}

  }
  ensureButtonAccessibleNames(document);
  if(currentView==='home'||currentView==='lessons'){const tools=main.querySelector('.dashboard-section');if(tools&&!main.querySelector('[data-quick-guide]'))tools.insertAdjacentHTML('afterend',quickStudyGuideMarkup());for(const [index,row] of [...main.querySelectorAll('.session-row')].entries()){const session=state.sessions[index];if(session?.mode==='exam'&&session.studyAdjusted&&!row.dataset.adjustedLabel){row.dataset.adjustedLabel='true';const kind=row.querySelector('.session-kind'),result=row.querySelector('.session-result');if(kind)kind.innerHTML=pair('Study practice · adjusted','تدريب بإعدادات مخصصة');if(result)result.innerHTML=pair('Study-only session, not a formal exam outcome','جلسة تدريبية فقط وليست نتيجة امتحان رسمي');}}}
  if(currentView==='lesson')enhanceLessonVocabulary();
  if(Capacitor.isNativePlatform()&&currentView==='quiz'&&quiz?.mode==='exam'&&!quiz.reviewing){const controls=main.querySelector('.quiz-controls');if(controls&&!controls.querySelector('[data-action="toggle-auto-read"]')){const button=document.createElement('button');button.type='button';button.className='quiet-button';button.dataset.action='toggle-auto-read';button.innerHTML=controlLabel(quiz.autoRead?'Auto-read on':'Turn on auto-read',quiz.autoRead?'القراءة التلقائية مفعّلة':'فعّل القراءة التلقائية');controls.prepend(button);}if(quiz.autoRead&&quiz.lastAutoReadIndex!==quiz.index){quiz.lastAutoReadIndex=quiz.index;const question=quiz.questions[quiz.index];if(question?.it)speak(question.it,'it-IT');}}
  if(currentView==='result'&&quiz?.studyAdjusted){const card=main.querySelector('.result-card');if(card&&!card.dataset.studyAdjustedNotice){card.dataset.studyAdjustedNotice='true';const title=card.querySelector(':scope > h1'),seal=card.querySelector('.result-seal'),criteria=card.querySelector('.exam-criteria');if(title)title.innerHTML=pair('Study practice completed','انتهى التدريب');if(seal)seal.textContent=`${quiz.answers.filter((value,index)=>value===true&&quiz.questions[index]?.answer==='VERO'||value===false&&quiz.questions[index]?.answer==='FALSO').length}/${quiz.questions.length}`;if(criteria)criteria.innerHTML=pair('This study session used personal practice settings; it is not an official exam result. Check the official procedure and the arrangements that apply to you.','هذه جلسة تدريب بإعدادات شخصية وليست نتيجة امتحان رسمية. راجع الإجراءات الرسمية والتسهيلات التي تنطبق على حالتك.');}}
}
const dynamicStudyObserver=new MutationObserver(()=>syncDynamicStudyFeatures());dynamicStudyObserver.observe(main,{childList:true,subtree:true});
function openExamSetup(){const dialog=document.querySelector('#examSetupDialog');if(dialog&&!dialog.open)dialog.showModal();else if(!dialog)startQuiz('exam',questions);}
document.addEventListener('click',event=>{
  const target=event.target instanceof Element?event.target:null;if(!target)return;
  const standard=target.closest('#startStandardExam');if(standard){event.preventDefault();event.stopImmediatePropagation();document.querySelector('#examSetupDialog')?.close();startQuiz('exam',questions);return;}
  const adjusted=target.closest('#startAdjustedExam');if(adjusted){event.preventDefault();event.stopImmediatePropagation();const timerMinutes=Number(document.querySelector('#examTimerMinutes')?.value)||20,autoRead=!!document.querySelector('#autoReadItalian')?.checked;document.querySelector('#examSetupDialog')?.close();startQuiz('exam',questions,{timerMinutes,autoRead});return;}
  const exam=target.closest('[data-action="exam"]');if(exam){event.preventDefault();event.stopImmediatePropagation();openExamSetup();return;}
  const autoReadButton=target.closest('[data-action="toggle-auto-read"]');if(autoReadButton&&quiz?.mode==='exam'){event.preventDefault();event.stopImmediatePropagation();quiz.autoRead=!quiz.autoRead;if(quiz.autoRead)quiz.studyAdjusted=true;quiz.lastAutoReadIndex=quiz.autoRead?-1:quiz.index;saveActiveQuiz();renderQuiz();return;}
  const vocabularyButton=target.closest('[data-vocabulary-index]');if(vocabularyButton){event.preventDefault();event.stopImmediatePropagation();openVocabularyCard(vocabularyButton.dataset.vocabularyIndex,event);return;}
  const tooltipAudio=target.closest('#translationTooltipAudio');if(tooltipAudio){event.preventDefault();event.stopImmediatePropagation();if(speechController.isActive(tooltipAudio))speechController.toggle();else speak(tooltipAudio.dataset.ttsText||'',ITALIAN_TTS_LOCALE,tooltipAudio);}
},true);
function registerServiceWorker(){
  if(!('serviceWorker'in navigator)){offlineCacheState='unavailable';updateConnectivity();return;}
  let attempts=0;
  const appVersion=document.documentElement.dataset.appVersion;if(!/^\d+$/.test(appVersion||'')){offlineCacheState='unavailable';updateConnectivity();return;}
  const register=async()=>{try{const registration=await navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(appVersion)}`,{scope:'/',updateViaCache:'none'});registration.update().catch(()=>{});}catch(error){console.warn('PWA service worker registration failed',error);if(++attempts<3)window.setTimeout(register,attempts*2000);else{offlineCacheState='unavailable';updateConnectivity();}}};
  register();
}
function requestOfflineContentCache(){if(!('serviceWorker'in navigator)){offlineCacheState='unavailable';updateConnectivity();return;}offlineCacheState='checking';updateConnectivity();const send=()=>navigator.serviceWorker.ready.then(registration=>{const worker=registration.active||navigator.serviceWorker.controller;if(worker)worker.postMessage({type:'CACHE_OFFLINE_CONTENT'});else{offlineCacheState='unavailable';updateConnectivity();}}).catch(()=>{offlineCacheState='unavailable';updateConnectivity();});if('requestIdleCallback'in window)window.requestIdleCallback(send,{timeout:10000});else window.setTimeout(send,3000);}

main.addEventListener('click',event=>{const shortcut=event.target.closest('[data-action="first-unanswered"]');if(!shortcut)return;const unanswered=quiz?.answers.findIndex(value=>value===null)??-1;if(unanswered>=0){quiz.index=unanswered;quiz.reviewing=false;saveActiveQuiz();renderQuiz();}});
main.addEventListener('click',event=>{
  const quickAnswer=event.target.closest('[data-quick-check-answer]');if(quickAnswer){const item=quickAnswer.closest('[data-quick-check]');if(!item||item.dataset.answered)return;const chosen=quickAnswer.dataset.quickCheckAnswer,expected=item.dataset.answer,correct=chosen===expected;item.dataset.answered='true';item.querySelectorAll('[data-quick-check-answer]').forEach(button=>{button.disabled=true;button.classList.toggle('is-selected',button===quickAnswer);});const feedback=item.querySelector('.quick-check-feedback'),explanation=item.querySelector('.quick-check-explanation');if(feedback){const answerIt=expected==='VERO'?'Vero':'Falso',answerAr=expected==='VERO'?'صحيح':'خطأ';feedback.innerHTML=pair(correct?'Corretto!':`Risposta corretta: ${answerIt}.`,correct?'إجابة صحيحة!':`الإجابة الصحيحة: ${answerAr}.`);feedback.classList.toggle('is-correct',correct);feedback.hidden=false;}if(explanation)explanation.hidden=false;return;}
  const tappedWord=event.target.closest('.wt-word[data-tap-word]');if(tappedWord){event.preventDefault();openTappedWord(tappedWord,event);return;}
  const sentenceControl=event.target.closest('[data-sentence-translate]');if(sentenceControl){showInlineSentenceTranslation(sentenceControl,event);return;}
  const tappedSentence=event.target.closest('.lesson-sentence[data-sentence-tap]');if(tappedSentence){showInlineSentenceTranslation(tappedSentence,event);return;}
  const dueReview=event.target.closest('[data-action="due-review"]');if(dueReview){startQuiz('due',null,{count:15});return;}
  const restart=event.target.closest('[data-restart-explainer]');if(restart){const scene=restart.closest('.lesson-animation'),svg=scene?.querySelector('.lesson-animation-svg');stopSpeech();if(scene){if(svg)svg.replaceWith(svg.cloneNode(true));scene.classList.remove('is-motion-paused');const toggle=scene.querySelector('[data-toggle-motion]');if(toggle){toggle.setAttribute('aria-pressed','false');toggle.innerHTML=controlLabel('Sospendi il movimento','أوقف الحركة');}setLessonExplainerStep(0);const play=scene.querySelector('[data-play-explainer]');if(play)playLessonExplainer(play);}return;}
  const motion=event.target.closest('[data-toggle-motion]');if(motion){const scene=motion.closest('.lesson-animation');if(scene){const paused=!scene.classList.contains('is-motion-paused'),play=scene.querySelector('[data-play-explainer]');if(speechController.isActive(play)){if(paused)speechController.pause();else speechController.resume();setLessonExplainerPlaybackState(scene,paused?'paused':'playing');}else{scene.classList.toggle('is-motion-paused',paused);scene.classList.toggle('is-motion-playing',!paused);motion.setAttribute('aria-pressed',String(paused));motion.innerHTML=paused?'<span lang="it">Riprendi il movimento</span><small lang="ar" dir="rtl">استأنف الحركة</small>':'<span lang="it">Sospendi il movimento</span><small lang="ar" dir="rtl">أوقف الحركة</small>';}}return;}
  const explainerPlay=event.target.closest('[data-play-explainer]');if(explainerPlay){playLessonExplainer(explainerPlay);return;}
  const explainerStep=event.target.closest('[data-explainer-step]');if(explainerStep){setLessonExplainerStep(explainerStep.dataset.explainerStep);return;}
  const openNode=event.target.closest('[data-open-lesson]');if(openNode){if(openNode.dataset.lessonIndex!==undefined&&openNode.dataset.lessonIndex!=='')openLesson(openNode.dataset.openLesson,Number(openNode.dataset.lessonIndex));return;}
  const review=event.target.closest('[data-review-lesson]');if(review){startLessonReview(review.dataset.reviewLesson);return;}
  const topic=event.target.closest('[data-bank-topic]');if(topic){browsePage=0;render('bank',{topic:topic.dataset.bankTopic});return;}
  const openSimilarGroup=event.target.closest('[data-open-similar-group]');if(openSimilarGroup){const group=similarQuestionGroups.find(item=>item.id===openSimilarGroup.dataset.openSimilarGroup);if(group){browsePage=0;render('similar-groups',{groupId:group.id});}return;}
  const drill=event.target.closest('[data-practice-topic]');if(drill){const t=drill.dataset.practiceTopic;startQuiz('topic',questions.filter(q=>q.topic===t),{title:topicLabel(t).it});return;}
  const favoriteToggle=event.target.closest('[data-toggle-favorite]');if(favoriteToggle){const q=questionsById.get(Number(favoriteToggle.dataset.toggleFavorite));if(q){if(state.favorites.has(q.id))state.favorites.delete(q.id);else state.favorites.add(q.id);persistState();const saved=state.favorites.has(q.id);favoriteToggle.classList.toggle('is-saved',saved);favoriteToggle.setAttribute('aria-pressed',String(saved));favoriteToggle.setAttribute('aria-label',saved?'Saved question · سؤال محفوظ':'Save question · احفظ السؤال');favoriteToggle.innerHTML=controlLabel(saved?'Saved':'Save question',saved?'محفوظ':'احفظ السؤال');}return;}
  const openQ=event.target.closest('[data-open-id]');if(openQ){const q=questions.find(x=>Number(x.id)===Number(openQ.dataset.openId));if(q)startQuiz('single',[q]);return;}
  const answer=event.target.closest('[data-answer]');if(answer){answerQuestion(answer.dataset.answer==='true');return;}
  const lessonItalianAudio=event.target.closest('[data-lesson-italian-audio="true"]');if(lessonItalianAudio){speechController.stop();playItalianAudio(lessonItalianAudio.dataset.ttsText||'');return;}
  const tts=event.target.closest('[data-tts-locale]');if(tts){if(speechController.isActive(tts))speechController.toggle();else speak(tts.dataset.ttsText,tts.dataset.ttsLocale,tts);return;}
  const legacySpeak=event.target.closest('[data-speak]');if(legacySpeak){const q=currentQ();if(q)speak(legacySpeak.dataset.speak==='it'?q.it:q.ar,legacySpeak.dataset.speak==='it'?'it-IT':ARABIC_TTS_LOCALE,legacySpeak);return;}
  const similarPage=event.target.closest('[data-similar-page]');if(similarPage){browsePage=Math.max(0,browsePage+(similarPage.dataset.similarPage==='next'?1:-1));render('similar-groups',{module:document.querySelector('#similarUnitFilter')?.value||'',query:document.querySelector('#searchInput')?.value||''});return;}
  const page=event.target.closest('[data-page]');if(page){browsePage=Math.max(0,browsePage+(page.dataset.page==='next'?1:-1));const query=document.querySelector('#searchInput')?.value||'';const topic=document.querySelector('#topicFilter')?.value||'';main.innerHTML=listPage(currentView==='mistakes'?'mistakes':currentView==='favorites'?'favorites':'bank',{query,topic,page:browsePage});return;}
  const actionNode=event.target.closest('[data-action]');if(actionNode){const action=actionNode.dataset.action;if(action==='start-standard-exam')startQuiz('exam',questions,{returnView:'simulation'});else if(action==='practice-group'){const ids=new Set((actionNode.dataset.practiceGroup||'').split(',').map(Number).filter(Number.isFinite));const pool=questions.filter(q=>ids.has(Number(q.id)));if(pool.length)startQuiz('custom',pool,{count:pool.length});}else if(action==='exam')startQuiz('exam',questions);else if(action==='sign-challenge'){const pool=questions.filter(q=>q.image&&/^(Segnali|Segnaletica|Pannelli)/i.test(q.topic));startQuiz('visual',pool,{count:10,title:'Visual road-sign practice'});}else if(action==='flag'){quiz.flagged[quiz.index]=!quiz.flagged[quiz.index];saveActiveQuiz();renderQuiz();}else if(action==='goto-question'){quiz.index=Math.max(0,Math.min(quiz.questions.length-1,Number(actionNode.dataset.index)||0));quiz.reviewing=false;saveActiveQuiz();renderQuiz();}else if(action==='back-to-current'){quiz.reviewing=false;saveActiveQuiz();renderQuiz();}else if(action==='submit-exam')finishExam(false,true);else if(action==='smart-practice')startQuiz('smart',null,{count:10});else if(action==='due-review')startQuiz('due',null,{count:15});else if(action==='resume-session')resumeActiveQuiz();else if(action==='reload')location.reload();else if(action==='discard-session'){state.activeQuiz=null;persistState();render('home');}else if(action==='practice'){const previous=lastQuizDefinition;if(currentView==='result'&&previous?.mode==='lesson-review')startQuiz('lesson-review',previous.pool,{lessonKey:previous.lessonKey,title:previous.title});else startQuiz('practice');}else if(action==='mistakes'||action==='review-wrongs')startQuiz('mistakes');else if(action==='favorites')startQuiz('favorites');else if(action==='all-bank')render('bank',{kind:'bank'});else if(action==='continue-course'){const n=nextCourseLesson();if(n)openLesson(n.module.module_id,n.index);}else if(action==='next')nextQuestion();else if(action==='exam-next'||action==='skip')advanceExam();else if(action==='prev'){if(quiz?.index>0){quiz.index--;saveActiveQuiz();renderQuiz();}}else if(action==='quit'){const target=quiz?.returnView||'bank';stopTimer();quiz=null;state.activeQuiz=null;persistState();render(target);}else if(action==='bookmark'){const q=currentQ();if(q){state.favorites.has(q.id)?state.favorites.delete(q.id):state.favorites.add(q.id);persistState();renderQuiz();}}else if(action==='lesson-complete'){const key=lessonKey(currentLessonId,currentLessonIndex),wasComplete=state.completedLessons.has(key);wasComplete?state.completedLessons.delete(key):state.completedLessons.add(key);if(!wasComplete)recordDailyGoal('lessons');persistState();render('lesson',{moduleId:currentLessonId,index:currentLessonIndex});}else if(action==='lesson-prev'||action==='lesson-next'){const all=flatLessons(),at=all.findIndex(x=>x.key===lessonKey(currentLessonId,currentLessonIndex)),next=all[at+(action==='lesson-next'?1:-1)];if(next)openLesson(next.module.module_id,next.index);}else if(action==='assistant-retry')sendAssistantPrompt(true);else if(action==='clear-assistant-context'){assistantContext='';render('assistant');}else if(action==='clear-chat'){assistantMessages=[];assistantContext='';assistantError='';render('assistant');}return;}
  const askLesson=event.target.closest('[data-ask-lesson]');if(askLesson){attachLessonContext(askLesson.dataset.askLesson);return;}
  const askQ=event.target.closest('[data-ask-question]');if(askQ){const q=questions.find(x=>Number(x.id)===Number(askQ.dataset.askQuestion));if(q)attachQuestionContext(q);return;}
  const suggestion=event.target.closest('[data-assistant-prompt]');if(suggestion){if(assistantBusy)return;const input=document.querySelector('#assistantInput');const prompt=resolveAssistantPrompt(input?.value||assistantDraft,suggestion.dataset.assistantPrompt);assistantDraft=prompt;sendAssistantPrompt(false,prompt);return;}
  const toggle=event.target.closest('[data-toggle-complete]');if(toggle){const key=toggle.dataset.toggleComplete,wasComplete=state.completedLessons.has(key);wasComplete?state.completedLessons.delete(key):state.completedLessons.add(key);if(!wasComplete)recordDailyGoal('lessons');persistState();render('lesson',{moduleId:currentLessonId,index:currentLessonIndex});return;}
  const practiceCount=event.target.closest('[data-practice-count]');if(practiceCount){startQuiz('custom',questions,{count:Number(practiceCount.dataset.practiceCount)});return;}
  const showAll=event.target.closest('[data-show-all-bank],[data-all-bank]');if(showAll){browsePage=0;render('bank',{kind:'bank'});return;}
});
document.addEventListener('click',event=>{const nav=event.target.closest('[data-view]');if(nav){event.preventDefault();render(nav.dataset.view);}});
main.addEventListener('submit',event=>{
  if(event.target.id==='customPracticeForm'){event.preventDefault();const topic=document.querySelector('#customTopic')?.value||'',focus=document.querySelector('#customFocus')?.value||'all',count=Math.max(1,Math.min(50,Number(document.querySelector('#customCount')?.value)||15));let pool=topic?questions.filter(q=>q.topic===topic):questions;if(focus==='unanswered')pool=pool.filter(q=>!state.solved.has(q.id));else if(focus==='mistakes')pool=pool.filter(q=>state.wrong.has(q.id));startQuiz('custom',pool,{count,title:topic?topicLabel(topic).it:''});return;}if(event.target.id==='searchForm'){event.preventDefault();const query=document.querySelector('#searchInput')?.value.trim()||'';browsePage=0;if(currentView==='similar-groups')render('similar-groups',{query,module:document.querySelector('#similarUnitFilter')?.value||''});else render('bank',{query,topic:''});return;}
  if(event.target.id==='assistantForm'){event.preventDefault();sendAssistantPrompt(false);}
});
main.addEventListener('change',event=>{const variantSelect=event.target.closest('[data-similar-variant]');if(variantSelect){const group=similarQuestionGroups.find(item=>item.id===variantSelect.dataset.similarVariant),card=variantSelect.closest('[data-similar-group-card]');if(group&&card){card.innerHTML=similarComparisonBody(group,variantSelect.value);card.querySelector('[data-similar-variant]')?.focus({preventScroll:true});}return;}if(event.target.id==='languageOrderSelect'){state.languageOrder=event.target.value==='ar'?'ar':'it';applyLanguageOrder();persistState();}else if(event.target.id==='glossaryCategory'){updateGlossaryResults();}else if(event.target.id==='topicFilter'){const query=document.querySelector('#searchInput')?.value||'';render('bank',{topic:event.target.value,query});}else if(event.target.id==='similarUnitFilter'){browsePage=0;render('similar-groups',{module:event.target.value,query:document.querySelector('#searchInput')?.value||''});}});
main.addEventListener('input',event=>{if(event.target.id==='assistantInput'){assistantDraft=event.target.value;return;}if(event.target.id==='glossarySearch'){updateGlossaryResults();return;}if(event.target.id==='referenceSearch'){const query=norm(event.target.value);let matches=0;main.querySelectorAll('[data-reference-entry]').forEach(entry=>{const found=!query||norm(entry.dataset.referenceSearch||'').includes(query);entry.hidden=!found;if(found)matches++;});const status=document.querySelector('#referenceSearchStatus');if(status)status.innerHTML=pair(query?`${matches} voci trovate`:`${matches} voci disponibili`,query?`عُثر على ${matches.toLocaleString('ar')} عنصر`:`${matches.toLocaleString('ar')} عنصر متاح`);return;}if(event.target.id!=='courseSearch')return;const query=norm(event.target.value);const finder=document.querySelector('#courseFinder'),catalog=document.querySelector('#courseCatalog');if(finder)finder.open=!!query;if(catalog)catalog.open=!!query;let matches=0;document.querySelectorAll('[data-course-unit]').forEach(unit=>{let unitMatches=0;unit.querySelectorAll('[data-course-lesson-row]').forEach(row=>{const found=!query||norm(row.dataset.search||'').includes(query);row.hidden=!found;if(found)unitMatches++;});unit.hidden=!!query&&!unitMatches;unit.open=!!query&&unitMatches>0;matches+=unitMatches;});const status=document.querySelector('#courseSearchStatus');if(status){const total=flatLessons().length;status.textContent=query?`${matches.toLocaleString('ar')} درس مطابق · ${matches} lezioni trovate`:`All ${total} lessons are organized by unit · الدروس الـ${total.toLocaleString('ar')} مرتبة حسب الوحدة`;}});
const backToTopButton=document.querySelector('#backToTop');
const updateBackToTop=()=>{if(backToTopButton)backToTopButton.hidden=window.scrollY<500;};
window.addEventListener('scroll',updateBackToTop,{passive:true});
backToTopButton?.addEventListener('click',()=>window.scrollTo({top:0,behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));
updateBackToTop();
document.querySelector('#openSources').addEventListener('click',()=>sourceDialog.showModal());
document.querySelector('#smallerText')?.addEventListener('click',()=>adjustFontSize(-2));
document.querySelector('#largerText')?.addEventListener('click',()=>adjustFontSize(2));
document.querySelector('#themeToggle')?.addEventListener('click',()=>{state.themeMode=state.themeMode==='dark'?'system':'dark';applyThemeMode();persistState();});
document.addEventListener('pointerdown',event=>{const target=event.target instanceof Element?event.target:null;if(!target)return;if(target.closest('#wordTranslationTooltip,.wt-word[role="button"],.lesson-it-text,.q-it,.italian-question,.pair-it,[lang="it"]'))return;closeWordTooltip();},true);
document.querySelector('#wordTranslationTooltip')?.addEventListener('keydown',event=>{if(event.key==='Escape'){closeWordTooltip({restoreFocus:true});event.preventDefault();}});
window.addEventListener('resize',()=>{if(!document.querySelector('#wordTranslationTooltip')?.hidden)positionWordTooltip(activeWordTooltipAnchor);},{passive:true});
window.addEventListener('scroll',()=>{if(!document.querySelector('#wordTranslationTooltip')?.hidden)closeWordTooltip();},{passive:true});

document.addEventListener('keydown',event=>{
  const target=event.target instanceof Element?event.target:null;if(!target||!['Enter',' '].includes(event.key))return;
  const word=target.closest('.wt-word[role="button"]');if(word){event.preventDefault();if(word.dataset.vocabularyIndex!==undefined)openVocabularyCard(word.dataset.vocabularyIndex,event);else openTappedWord(word,{clientX:0,clientY:0,detail:0});return;}
  const paragraph=target.closest('.lesson-it-text[data-translation-tappable]');if(paragraph){event.preventDefault();showInlineSentenceTranslation(paragraph,{clientX:0,clientY:0});}
});
document.addEventListener('keydown',event=>{if(!quiz||event.target.matches('input,textarea,select'))return;if(event.key==='ArrowRight'&&quiz.index>0){quiz.index--;saveActiveQuiz();renderQuiz();}else if(event.key==='ArrowLeft'&&quiz.mode!=='exam'&&quiz.answers[quiz.index]!==null)nextQuestion();});
const welcomeDialog=document.querySelector('#welcomeDialog');
document.querySelector('#welcomeGuest')?.addEventListener('click',()=>{try{localStorage.setItem(welcomeKey,'1');}catch{}welcomeDialog?.close();});
welcomeDialog?.addEventListener('close',()=>{try{localStorage.setItem(welcomeKey,'1');}catch{}});
async function boot(){
  applyFontSize();
  try{
    const [bankData,course,labels,similarData]=await loadCourseData();
    bank=bankData;questions=bank.questions;questionsById=new Map((Array.isArray(questions)?questions:[]).map(q=>[Number(q.id),q]));topicLabels=labels;similarQuestionGroups=Array.isArray(similarData?.groups)?similarData.groups:[];similarGroupedQuestionCount=Number(similarData?.grouped_question_count)||0;similarGroupCounts={};similarGroupByQuestion=new Map();for(const group of similarQuestionGroups){similarGroupCounts[group.topic]=(similarGroupCounts[group.topic]||0)+1;for(const id of group.question_ids)similarGroupByQuestion.set(Number(id),group);}lessonModules=(course.modules||[]).sort((a,b)=>a.order_hint-b.order_hint);officialSyllabusMeta=course.official_syllabus||{};officialSyllabus=officialSyllabusMeta.items||[];
    if(!Array.isArray(questions)||questions.length!==bank.count||questions.some(q=>!q.it||!q.ar||!q.answer||!q.topic))throw new Error('Question bank incomplete / بنك الأسئلة غير مكتمل');if(similarData?.schema_version!==2||similarData.method?.clustering!=='complete-link'||!Number.isFinite(similarData.method.minimum_sequence_similarity)||!Number.isInteger(similarData.method.maximum_changed_tokens)||similarData.question_count!==questions.length||similarData.group_count!==similarQuestionGroups.length)throw new Error('Similar-question index incomplete / فهرس الأسئلة المتقاربة غير مكتمل');const groupedIds=new Set();for(const group of similarQuestionGroups){if(!group.id||!topicLabels[group.topic]||!Array.isArray(group.question_ids)||group.question_ids.length<2||!group.question_ids.includes(group.representative_id)||!Number.isFinite(group.minimum_pair_similarity)||group.minimum_pair_similarity<similarData.method.minimum_sequence_similarity||!Number.isInteger(group.maximum_changed_tokens)||group.maximum_changed_tokens>similarData.method.maximum_changed_tokens)throw new Error('Invalid similar-question group / توجد مجموعة أسئلة متقاربة غير صالحة');for(const id of group.question_ids){const q=questionsById.get(Number(id));if(!q||q.topic!==group.topic||groupedIds.has(Number(id)))throw new Error('Similar-question group references are inconsistent / مراجع مجموعات الأسئلة غير متسقة');groupedIds.add(Number(id));}}if(groupedIds.size!==similarGroupedQuestionCount)throw new Error('Similar-question group count mismatch / عدد مجموعات الأسئلة غير متطابق');
    if(!lessonModules.length||lessonModules.some(m=>!m.title_it||!m.title_ar||!m.lessons?.length||!m.sources?.length))throw new Error('Course content incomplete / المنهج غير مكتمل');
    const expectedTopics=new Set(questions.map(q=>q.topic));if(expectedTopics.size!==25||Object.keys(topicLabels).length!==25||[...expectedTopics].some(t=>!topicLabels[t]))throw new Error('Topic index incomplete / فهرس الموضوعات غير مكتمل');
    const lessonList=flatLessons(),wordCount=text=>(String(text||'').match(/[\p{L}\p{M}]+(?:[’'][\p{L}\p{M}]+)*/gu)||[]).length;if(lessonModules.length!==11||lessonList.length!==50||lessonList.some(x=>{const l=x.lesson,n=wordCount(l.body_it);return !l.heading_it||!l.heading_ar||!l.body_it||!l.body_ar||n<80||n>120||!l.core_it||!l.core_ar||!Array.isArray(l.key_points)||l.key_points.length<4||l.key_points.length>6||!Array.isArray(l.trap_words)||l.trap_words.length>2||!Array.isArray(l.numbers)||l.numbers.length>2||!Array.isArray(l.common_mistakes)||l.common_mistakes.length<2||l.common_mistakes.length>3||!Array.isArray(l.quick_check)||l.quick_check.length!==3||!Array.isArray(l.sources)||!l.sources.length||!l.bank_topics?.length||(!l.visual_src&&!l.visual_question_id)||(!l.review_question_ids?.length&&!l.source_check);}))throw new Error('Structured lesson package is incomplete, out of word range, or missing required sections / حزمة الدروس ناقصة أو خارج عدد الكلمات أو ينقصها قسم مطلوب');if(glossaryEntries.length!==200||new Set(glossaryEntries.map(e=>e.it.toLocaleLowerCase())).size!==200||referenceData.traps?.length!==20||referenceData.numbers?.length!==40||referenceData.comparisons?.length!==15)throw new Error('Verified glossary or reference datasets are incomplete / بيانات القاموس والمراجع غير مكتملة');const lessonKeys=new Set(lessonList.map(x=>x.key));if(officialSyllabus.length!==25||officialSyllabus.some(item=>!item.id||!item.title_it||!item.title_ar||!item.lesson_refs?.length||item.lesson_refs.some(key=>!lessonKeys.has(key))))throw new Error('Official syllabus index is incomplete / فهرس المنهج الرسمي غير مكتمل');
    void loadVideoManifest().then(overrides=>{videoUrlOverrides=overrides;if(currentView==='lesson')render('lesson');});
    document.querySelector('#navCount').textContent=bank.count.toLocaleString('ar');updateSourceDialog();
    initializeProgressBackup({readState:()=>state,replaceState:next=>{const active=state.activeQuiz;Object.assign(state,next);state.activeQuiz=active;applyFontSize();applyThemeMode();return persistState();},getContext:()=>({questionIds:new Set(questions.map(q=>Number(q.id))),lessonKeys:new Set(flatLessons().map(x=>x.key)),sourceCheckIds:new Set(lessonModules.flatMap(m=>m.lessons.map(l=>l.source_check?.id).filter(Boolean))),topics:new Set(Object.keys(topicLabels))}),onImported:()=>render('home')});
    accountService=createAccountService({firebaseConfig,getState:()=>state,replaceState:applySyncedProgress,getContext:()=>({questionIds:new Set(questions.map(q=>Number(q.id))),lessonKeys:new Set(flatLessons().map(x=>x.key)),sourceCheckIds:new Set(lessonModules.flatMap(m=>m.lessons.map(l=>l.source_check?.id).filter(Boolean))),topics:new Set(Object.keys(topicLabels))}),onOwnerChanged:setStudyOwner,getGuestState:()=>loadState(stateKey),onAccountDeleted:uid=>{const key=`patente-ar-account-v1:${uid}`;if(activeStateKey===key)setStudyOwner(null,{discardCurrent:true});try{localStorage.removeItem(key);}catch{}}});
    initializeAccountUI({service:accountService});
    render('home');window.dispatchEvent(new Event('patente:ready'));requestOfflineContentCache();try{if(localStorage.getItem(welcomeKey)!=='1'&&welcomeDialog&&!welcomeDialog.open)welcomeDialog.showModal();}catch{if(welcomeDialog&&!welcomeDialog.open)welcomeDialog.showModal();}
  }catch(error){window.dispatchEvent(new Event('patente:failed'));console.error(error);main.innerHTML=`<div class="empty-state"><strong>${pair('Unable to load the course','تعذّر تحميل المنهج')}</strong><p>${esc(error.message)}</p><button class="quiet-button" data-action="reload">${controlLabel('Try again','أعد المحاولة')}</button></div>`;}
}
registerServiceWorker();boot();
