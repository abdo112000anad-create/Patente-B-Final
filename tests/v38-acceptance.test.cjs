'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const course = json('data/lessons.json');
const bank = json('data/questions.json');
const index = read('index.html');
const app = read('src/app.js');


test('course retains 11 ordered modules and exactly 50 bilingual lessons', () => {
  assert.equal(course.modules.length, 11);
  assert.equal(course.modules.reduce((count, module) => count + module.lessons.length, 0), 50);
  assert.deepEqual(course.modules.map(module => module.order_hint), [...course.modules.map(module => module.order_hint)].sort((a, b) => a - b));
  for (const module of course.modules) for (const lesson of module.lessons) {
    assert.ok(lesson.heading_it && lesson.heading_ar && lesson.body_it && lesson.body_ar);
  }
});

test('lesson passages, core summaries, study notes, checks, visuals, and citations remain present', () => {
  for (const module of course.modules) for (const lesson of module.lessons) {
    const words = lesson.body_it.trim().split(/\s+/u).length;
    assert.ok(words >= 80 && words <= 120, `${lesson.heading_it}: ${words} Italian words`);
    assert.equal(String(lesson.core_it || '').split('\n').length, 2);
    assert.equal(String(lesson.core_ar || '').split('\n').length, 2);
    assert.ok(Array.isArray(lesson.key_points) && lesson.key_points.length > 0);
    assert.ok(Array.isArray(lesson.trap_words));
    assert.ok(Array.isArray(lesson.common_mistakes));
    assert.ok(lesson.quick_check && lesson.visual_script && lesson.sources?.length);
  }
});

test('course legal caveats keep the current-law limitation clear', () => {
  assert.ok(course.legal_check_date);
  assert.ok(course.disclaimer_ar);
  assert.ok(course.modules.some(module => module.caveats_ar?.some(text => /لم يتحقق هنا من تعديلات تشريعية لاحقة/u.test(text))));
  assert.ok(course.modules.some(module => module.sources?.some(source => /normattiva\.it/iu.test(source.url || ''))));
});

test('video scripts remain local planning material and are not published', () => {
  const lessons = course.modules.flatMap(module => module.lessons);
  assert.equal(lessons.filter(lesson => lesson.video_script_available).length >= 5, true);
  assert.ok(lessons.filter(lesson => lesson.youtube_video?.status === 'published').every(lesson => /youtu\.be|youtube\.com/iu.test(lesson.youtube_video.url || '')));
});

test('glossary and reference data remain populated across approved categories', () => {
  const glossary = json('data/glossary-v37.json');
  const tools = json('data/reference-tools.json');
  assert.ok(glossary.entries.length >= 100);
  assert.ok(new Set(glossary.entries.map(entry => entry.category)).size >= 5);
  assert.ok(tools.traps.length > 0 && tools.numbers.length > 0 && tools.comparisons.length > 0);
  const terms = Object.fromEntries(glossary.entries.map(entry => [entry.italian.toLocaleLowerCase('it-IT'), entry.arabic]));
  assert.equal(terms.corsia, 'حارة سير');
  assert.equal(terms.carreggiata, 'الطريق المخصص للمركبات');
});

test('each lesson has a nullable videoUrl field and only the two confirmed videos are linked', () => {
  const lessons = course.modules.flatMap(module => module.lessons);
  assert.equal(lessons.length, 50);
  assert.ok(lessons.every(lesson => Object.hasOwn(lesson, 'videoUrl') && (lesson.videoUrl === null || typeof lesson.videoUrl === 'string')));
  assert.equal(lessons[0].videoUrl, 'https://youtu.be/cpzGIxl94x4');
  assert.equal(lessons[1].videoUrl, 'https://youtu.be/3JZWwAcSALQ');
  assert.ok(lessons.slice(2).every(lesson => lesson.videoUrl === null));
  assert.match(app, /lesson-video-cta/);
  assert.match(app, /الفيديو قريبًا/);
  assert.match(app, /lesson-video-upcoming-status/);
  assert.match(app, /loadVideoManifest/);
});

test('the official-source question bank retains 7,020 unique records', () => {
  assert.equal(bank.count, 7020);
  assert.equal(bank.questions.length, 7020);
  assert.equal(new Set(bank.questions.map(question => Number(question.id))).size, 7020);
  assert.ok(bank.questions.every(question => ['VERO', 'FALSO'].includes(question.answer)));
});

test('mobile navigation retains the five requested destinations and order', () => {
  const nav = index.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/u)?.[0] || '';
  assert.ok(nav);
  const destinations = [...nav.matchAll(/data-view="([^"]+)"/gu)].map(match => match[1]);
  assert.deepEqual(destinations, ['home', 'review', 'bank', 'simulation', 'profile']);
});

test('header stays minimal and lesson-title search is removed while question-bank search remains', () => {
  const header = index.match(/<header class="topbar"[\s\S]*?<\/header>/u)?.[0] || '';
  assert.ok(header);
  assert.match(header, /brand/u);
  assert.doesNotMatch(header, /searchInput|searchForm/u);
  assert.doesNotMatch(app, /course-finder|courseSearch|course-search-box|data-course-lesson-row/u);
  assert.match(app, /id="searchForm"/u);
});

test('Glossary remains a Home tool while assistant code is removed and settings stay in Profile', () => {
  assert.doesNotMatch(app, /assistantPage|assistant\.mjs|data-ask-lesson|data-assistant-prompt/u);
  assert.equal(fs.existsSync(path.join(root, 'src/assistant.mjs')), false);
  assert.match(app, /glossaryPage\(/u);
  assert.match(app, /profilePage\(/u);
  assert.match(index, /data-view="profile"/u);
  assert.match(app, /profilePrivacyControls/u);
});

test('standard simulation remains 30 questions, 20 minutes, and at most 3 errors', () => {
  assert.match(index, /id="startStandardExam"/u);
  assert.match(app, /startQuiz\('exam',questions\)/u);
  assert.match(app, /30/u);
  assert.match(app, /20/u);
  assert.match(app, /wrong<=3/u);
});

test('lesson screen keeps its bilingual vocabulary and sentence-level translation hooks', () => {
  assert.match(app, /function lessonDetailPage/u);
  assert.match(app, /function vocabularyMarkup/u);
  assert.match(app, /data-sentence-translate/u);
  assert.match(app, /data-sentence-tap/u);
  assert.match(app, /inline-sentence-translation/u);
});

test('v51 keeps the floating player and uses Web Speech without bundled TTS', () => {
  const audioCss = read('src/v40-audio.css');
  const speech = read('src/speech.mjs');
  const mainActivity = read('android/app/src/main/java/it/patenteb/sideload/v29/MainActivity.java');
  const gradle = read('android/app/build.gradle');
  const manifest = read('android/app/src/main/AndroidManifest.xml');
  assert.match(index, /data-audio-backend="web-speech"/u);
  assert.match(index, /id="speechPlaybackBar"/u);
  assert.match(index, /id="translationTooltipAudio"/u);
  assert.match(app, /createSpeechController\(\{getRate:/u);
  assert.ok(app.includes("ITALIAN_TTS_LOCALE} from './speech.mjs'"));
  assert.doesNotMatch(`${app}\n${speech}`, /ARABIC_TTS_LOCALE|data-tts-locale=.*ARABIC/u);
  assert.match(app, /speak\(lessonItalianAudio\.dataset\.ttsText\|\|''/u);
  assert.doesNotMatch(`${app}\n${speech}`, /playItalianAudio|isAudioUnlocked/u);
  assert.match(speech, /speechSynthesis|SpeechSynthesisUtterance/u);
  assert.doesNotMatch(`${app}\n${speech}\n${mainActivity}\n${gradle}\n${manifest}`, /Piper|piperAlpha|nativeTts|ONNX/u);
  assert.match(mainActivity, /registerPlugin\(RewardedAdsPlugin\.class\)/u);
  assert.match(audioCss, /\.speech-playback-bar/u);
});

test('lesson renders accessible topic-specific 2D visuals and keeps explanatory text stages', () => {
  const animation = read('src/lesson-animation.mjs');
  assert.match(animation, /\$\{sceneSvg\(type\)\}/u);
  assert.match(animation, /role="img" aria-label="\$\{escapeHtml\(sceneDescription\)\}"/u);
  assert.match(animation, /data-explainer-step/u);
  assert.match(animation, /sceneDescription=/u);
  assert.doesNotMatch(animation, /lesson-animation-unavailable|تم تعطيل الرسم المسطّح الحالي|رُفع الرسم المسطّح القديم مؤقتًا/u);
});

test('the unified v50 dark palette keeps readable lesson copy and mobile sizing', () => {
  const dark = read('src/theme-dark.css');
  const responsive = read('src/rebuild.css');
  const updated = read('src/v50-contrast.css');
  assert.match(dark, /data-theme="dark"/u);
  assert.match(dark, /prefers-color-scheme: dark/u);
  assert.match(updated, /--v50-surface: #142733/u);
  assert.match(updated, /--v50-text: #c8e5ea/u);
  assert.match(responsive, /@media\(max-width:650px\)/u);
  assert.match(updated, /lesson-animation-svg/u);
});

test('local debug build still avoids real Firebase sign-in credentials', () => {
  const config = json('android/app/google-services.json');
  assert.match(JSON.stringify(config), /REPLACE_WITH_FIREBASE|PLACEHOLDER|YOUR_/iu);
  assert.match(read('src/app.js'), /Firebase.*not configured|placeholder|not available/iu);
});

test('Android sample ads and the Firebase placeholder are retained', () => {
  const native = read('android/app/src/main/AndroidManifest.xml');
  assert.match(native, /ca-app-pub-3940256099942544/iu);
  assert.match(JSON.stringify(json('android/app/google-services.json')), /REPLACE_WITH_FIREBASE|PLACEHOLDER|YOUR_/iu);
});

test('app shell retains translation, legal, and driving-safety disclaimers', () => {
  assert.match(course.disclaimer_ar, /تعليمي/u);
  assert.match(app, /وسيلةً مساعدة للدراسة لا ترجمة قانونية رسمية/u);
  assert.match(app, /traduzioni in arabo sono state generate dall’IA e non sono state revisionate/u);
});

test('offline cache includes local lessons, questions, dictionary, and v50 stylesheets', () => {
  const startup = read('src/startup.mjs');
  const serviceWorker = read('public/sw.js');
  assert.match(startup, /questions\.json/u);
  assert.match(startup, /lessons\.json/u);
  assert.match(serviceWorker, /CACHE_OFFLINE_CONTENT/u);
  assert.match(serviceWorker, /lessons\.json/u);
  assert.match(serviceWorker, /refactor-v38\.css/u);
  assert.match(serviceWorker, /v40-audio\.css/u);
  assert.match(serviceWorker, /v50-contrast\.css/u);
  assert.match(serviceWorker, /v52-dark-overhaul\.css/u);
  assert.match(serviceWorker, /italian_arabic_dictionary_lookup\.json/u);
  assert.match(read('scripts/build-pwa.cjs'), /italian_arabic_dictionary_lookup\.json/u);
  assert.match(serviceWorker, /patente-ar-v54-italian-audio/u);
  assert.match(index, /data-app-version="54"/u);
});

test('Home goal and lesson grid retain narrow-phone wrapping rules', () => {
  const dark = read('src/theme-dark.css');
  const responsive = read('src/rebuild.css');
  assert.match(dark, /\.daily-goal-card \{ grid-template-columns: minmax\(0, 1fr\)/u);
  assert.match(dark, /\.daily-goal-card > \* \{ min-width: 0; \}/u);
  assert.match(responsive, /\.lesson-detail-copy\{[^}]*grid-template-columns:minmax\(0,1fr\)/u);
});

test('Glossary controls fit the single-column mobile layout', () => {
  const css = read('src/theme-dark.css');
  assert.match(css, /\.glossary-controls \{ grid-template-columns: minmax\(0, 1fr\); \}/u);
  assert.match(css, /\.glossary-controls > label \{ min-width: 0; \}/u);
});

test('Android build script remains debug-only and uses v54 metadata', () => {
  const build = read('scripts/build-android.sh');
  const gradleCommand = build.match(/^\.\/gradlew .*$/mu)?.[0] || '';
  assert.match(gradleCommand, /\bclean\b/u);
  assert.match(gradleCommand, /:app:assembleDebug/u);
  assert.match(gradleCommand, /:app:testDebugUnitTest/u);
  assert.doesNotMatch(gradleCommand, /assembleRelease|bundleRelease|publish|upload/iu);
  const gradle = read('android/app/build.gradle');
  assert.match(gradle, /versionCode\s+54/u);
  assert.match(gradle, /versionName\s+"54\.0\.0"/u);
  assert.match(gradle, /abiFilters\s+'arm64-v8a',\s*'armeabi-v7a'/u);
  assert.match(read('android/variables.gradle'), /minSdkVersion\s*=\s*24/u);
  assert.equal(json('package.json').version, '54.0.0');
  assert.equal(json('package-lock.json').packages[''].version, '54.0.0');
  assert.equal(json('public/release.json').version, 54);
});
