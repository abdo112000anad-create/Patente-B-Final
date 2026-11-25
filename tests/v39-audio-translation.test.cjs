'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

let translation;
test('load local word-translation module', async () => {
  translation = await import(path.join(root, 'src/lesson-translation.mjs'));
});

test('single-tap lookup resolves one isolated word and labels machine drafts honestly', () => {
  assert.equal(translation.wordAtOffset('La corsia è libera.', 4), 'corsia');
  assert.equal(translation.wordAtOffset('---', 1), '');
  assert.equal(translation.wordAtOffset('   ', 1), '');
  translation.setGeneratedDictionary([{
    word: 'corsia', translation_ar: 'مسودة لحارة السير', source: 'local model@pinned revision',
    provider: 'opus-mt-local', status: 'machine_draft_needs_review', review_required: 1,
    confidence: null, note: '',
  }]);
  const draft = translation.translateTappedWord('corsia', []);
  assert.equal(draft.word, 'corsia');
  assert.equal(draft.arabic, 'مسودة لحارة السير');
  assert.equal(draft.status, 'machine_draft_needs_review');
  assert.equal(draft.confidence, null);
  assert.match(draft.note, /مسودة ترجمة آلية غير مراجعة/u);
  const missing = translation.translateTappedWord('parola non presente', []);
  assert.equal(missing.arabic, '');
  assert.match(missing.note, /لم يُسجَّل مقابل عربي مفرد لهذه الكلمة/u);
  const app = read('src/app.js');
  const tooltipStart = app.indexOf('function showWordTooltip(');
  const tooltipEnd = app.indexOf('function openTappedWord(', tooltipStart);
  const tooltipHandler = app.slice(tooltipStart, tooltipEnd);
  assert.ok(tooltipHandler.includes('translateTappedWord(word,[])'));
  assert.ok(!tooltipHandler.includes('translateLessonSentence'));
  assert.match(app.slice(app.indexOf('function openTappedWord('), app.indexOf('function showInlineSentenceTranslation(')), /loadLocalWordDictionary\(\)/u);
  assert.match(app, /main\.addEventListener\('click',event=>\{/u);
  assert.match(app, /const tappedWord=event\.target\.closest\('\.wt-word\[data-term\]'\)/u);
  assert.match(app, /openTappedWord\(tappedWord,event\)/u);
  assert.doesNotMatch(app, /wordHoldTimer|heldItalianTarget/u);
});

test('only project-approved terms are presented as reviewed overrides', () => {
  const overrides = JSON.parse(read('prototypes/v40-dictionary/approved_overrides.json'));
  assert.equal(overrides.corsia.arabic, 'حارة سير');
  assert.equal(overrides.carreggiata.arabic, 'الطريق المخصص للمركبات');
  assert.equal(overrides.prudenza.arabic, 'حذر');
  const app = read('src/app.js');
  assert.ok(app.includes('document.querySelector(\'#translationTooltipNote\').textContent=matched.note'));
});

test('v63 ships the corrected dictionary in JSON and a valid SQLite asset', () => {
  const dictionary = JSON.parse(read('data/italian_arabic_dictionary_lookup.json'));
  assert.equal(dictionary.entries.length, 5336);
  assert.ok(dictionary.entries.every(row => row.word && row.translation_ar));
  assert.equal(dictionary.entries.filter(row => row.status === 'fallback_draft_needs_review').length, 0);
  assert.equal(dictionary.entries.filter(row => row.source === 'owner-approved-correction-v42' && row.status === 'reviewed_override' && row.review_required === 0).length, 9);
  for (const letterArtifact of ['b', 'f', 'g', 'h', 'p', 'v', 'x']) assert.equal(dictionary.entries.some(row => row.word === letterArtifact), false);
  const get = word => dictionary.entries.find(row => row.word.toLocaleLowerCase('it') === word);
  assert.equal(get('corsia').translation_ar, 'حارة سير');
  assert.equal(get('carreggiata').translation_ar, 'الطريق المخصص للمركبات');
  assert.equal(get('prudenza').translation_ar, 'حذر');
  assert.equal(get('riconoscere').translation_ar, 'يتعرف على');
  assert.equal(get('riconoscere').status, 'reviewed_override');
  assert.equal(get('spiegazione').translation_ar, 'شرح / تفسير');
  assert.equal(get('spiegazione').source, 'user-requested-lemma-v51');
  assert.equal(get('spiegazione').translation_ar, 'شرح / تفسير');
  assert.equal(get('spiegazione').source, 'user-requested-lemma-v51');
  const db = fs.readFileSync(path.join(root, 'android/app/src/main/assets/dictionary.db'));
  assert.equal(db.subarray(0, 16).toString('ascii'), 'SQLite format 3\0');
});

test('v43 top bar keeps the brand only and removes install controls and listeners', () => {
  const index = read('index.html');
  const app = read('src/app.js');
  assert.doesNotMatch(index, /installApp|installDialog|install-button|Installa|تثبيت التطبيق/u);
  assert.doesNotMatch(app, /installPrompt|beforeinstallprompt|appinstalled|showInstallHelp|updateInstallButton|isStandalone/u);
});

test('published video links remain high-contrast controls and unpublished lessons are status-only', () => {
  const app = read('src/app.js');
  const css = read('src/v50-contrast.css');
  assert.ok(app.includes('lesson-video-status-link" data-youtube-cta'));
  assert.ok(app.includes('lesson-video-upcoming-status'));
  assert.ok(app.includes('role="status"'));
  assert.ok(!app.includes('Watch the video explanation (coming soon)'));
  assert.match(css, /#main \.lesson-video-cta-link \{ background: #145766 !important; color: #c8e5ea !important;/u);
  assert.match(css, /#main \.lesson-video-upcoming-status/u);
});

test('warning cards use the v50 teal palette with WCAG AA contrast', () => {
  const css = read('src/v50-contrast.css');
  const luminance = hex => {
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  };
  const contrast = (a, b) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + .05) / (lo + .05);
  };
  assert.match(css, /#main \.lesson-warning-block[\s\S]*?background: #173d4a !important/u);
  assert.ok(contrast('#c8e5ea', '#173d4a') >= 4.5);
  assert.ok(contrast('#2edbc0', '#173d4a') >= 4.5);
});

test('floating audio player uses SVG controls, a fixed 0.8x speed, and compact dimensions', () => {
  const index = read('index.html');
  const css = read('src/v40-audio.css');
  assert.match(index, /id="speechStop"[^>]*aria-label="إيقاف الصوت"/u);
  assert.match(index, /class="speech-rate-control"[\s\S]*?class="speech-rate-value" aria-label="سرعة الصوت الإيطالي">0\.8×/u);
  assert.match(css, /bottom: max\(20px, env\(safe-area-inset-bottom\)\)/u);
  assert.match(css, /width: 90%;[\s\S]*?max-width: 400px;[\s\S]*?height: 60px/u);
});

test('generated dictionary preserves Italian diacritics instead of merging distinct token forms', () => {
  translation.setGeneratedDictionary([
    {word: 'velocita', translation_ar: 'شكل بلا علامة', source: 'test', provider: 'test', status: 'machine_draft_needs_review', confidence: null},
    {word: 'velocità', translation_ar: 'شكل بعلامة صوتية', source: 'test', provider: 'test', status: 'machine_draft_needs_review', confidence: null},
  ]);
  assert.equal(translation.translateTappedWord('velocita', []).arabic, 'شكل بلا علامة');
  assert.equal(translation.translateTappedWord('velocità', []).arabic, 'شكل بعلامة صوتية');
});

test('bilingual key-point cards keep readable contrast in the unified v50 palette', () => {
  const css = read('src/v50-contrast.css');
  const luminance = color => {
    const channels = color.match(/[0-9a-f]{2}/giu).map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  assert.ok(contrast('#c8e5ea', '#193543') >= 4.5);
  assert.ok(contrast('#91c4cf', '#193543') >= 4.5);
  assert.match(css, /#main \.lesson-key-point-card/u);
  assert.match(css, /:root\[data-theme="dark"\] #main \.lesson-key-point-rule/u);
  assert.match(css, /:root\[data-theme="system"\] #main \.lesson-key-point-card/u);
});

test('new word taps dismiss the previous tooltip and touch hover cannot stay on a stale word', () => {
  const app = read('src/app.js');
  const css = read('src/v40-audio.css');
  const v50Css = read('src/v50-contrast.css');
  const start = app.indexOf('function openTappedWord(');
  const end = app.indexOf('function showInlineSentenceTranslation(', start);
  assert.ok(start >= 0 && end > start);
  assert.match(app.slice(start, end), /^function openTappedWord\(node,event=\{\}\)\{\s*closeWordTooltip\(\);/u);
  assert.match(css, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*#main \.lesson-it-text \.wt-word:hover:not\(:focus-visible\)/u);
  assert.match(v50Css, /#main \.lesson-it-text \.wt-word:active \{ background: #1b5660 !important;/u);
});
