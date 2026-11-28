'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const course = JSON.parse(read('data/lessons.json'));
const lessons = course.modules.flatMap(module => module.lessons);

 test('all 50 lessons render a local visual; shared SVGs keep accessibility metadata', async () => {
  const visuals = await import(path.join(root, 'src/lesson-visuals.mjs'));
  const ids = visuals.lessonVisualIds().sort();
  assert.equal(ids.length, 50);
  assert.deepEqual(ids, lessons.map(lesson => lesson.id).sort());
  for (const lesson of lessons) {
    const svg = visuals.renderLessonVisual(lesson);
    if (lesson.id === 'u4-l1') {
      assert.match(svg, /<svg class="lesson-svg" viewBox="0 0 1000 800" width="100%" height="auto"/u, lesson.id);
      assert.equal((svg.match(/<svg\b/gu) || []).length, 1, lesson.id);
      assert.equal((svg.match(/<\/svg>/gu) || []).length, 1, lesson.id);
      const svgStart = svg.indexOf('<svg class="lesson-svg"');
      const svgEnd = svg.indexOf('</svg>', svgStart) + '</svg>'.length;
      const svgMarkup = svg.slice(svgStart, svgEnd);
      assert.equal(crypto.createHash('sha256').update(svgMarkup).digest('hex'), 'fbb61a1b6a5896ebdcc79b758430f36532ac9bf239a2ef9abfa657e27939a168');
      assert.match(svg, /id="carGreenTop"[\s\S]*?<stop offset="0%" stop-color="#6ee7b7"\/>\s*<stop offset="100%" stop-color="#10b981"\/>/u, lesson.id);
      assert.match(svg, /id="carOrangeTop"/u, lesson.id);
      assert.match(svg, /id="shadowHeavy"[\s\S]*?<feDropShadow/u, lesson.id);
      assert.match(svg, /id="neonGlow"[\s\S]*?<feGaussianBlur/u, lesson.id);
      assert.match(svg, /class="car-anim-orange"/u, lesson.id);
      assert.match(svg, /class="car-anim-green"/u, lesson.id);
      assert.match(svg, /animation: driveOrange 5s infinite/u, lesson.id);
      assert.match(svg, /animation: driveGreen 5s infinite/u, lesson.id);
      assert.match(svg, /pulseArrow 1\.5s infinite/u, lesson.id);
      assert.match(svg, /class="arrow-pulse"[\s\S]*?marker-end="url\(#arrowhead\)"/u, lesson.id);
      assert.match(svg, />PRECEDENZA<|>DEVE FERMARSI</u, lesson.id);
      continue;
    }
    assert.doesNotMatch(svg, /id="car(?:Green|Orange)Top"|class="car-anim-(?:orange|green)"/u, lesson.id);
    assert.match(svg, /<svg class="lesson-svg" viewBox="0 0 760 320"/u, lesson.id);
    assert.match(svg, /<title id="u\d+-l\d+-title"/u, lesson.id);
    assert.match(svg, /<desc id="u\d+-l\d+-desc"/u, lesson.id);
    assert.match(svg, /<linearGradient/u, lesson.id);
    assert.match(svg, /<radialGradient/u, lesson.id);
    assert.match(svg, /<feDropShadow/u, lesson.id);
    assert.match(svg, /prefers-reduced-motion:reduce/u, lesson.id);
    assert.doesNotMatch(svg, /<(?:img|image)\b|href="https?:\/\//iu, lesson.id);
    assert.doesNotMatch(svg, /url\(#(?:shadow|glass)\)/u, lesson.id);
    assert.match(svg, /#10b981/u, lesson.id);
    assert.match(svg, /#3b82f6/u, lesson.id);
  }
  const priorityCss = read('src/v64-ui-fixes.css');
  assert.match(priorityCss, /#main \.lesson-svg-figure\[data-lesson-visual="u4-l1"\]\s*\{\s*width:\s*100%;\s*height:\s*auto;\s*max-height:\s*500px;\s*overflow:\s*visible;/u);
  assert.match(priorityCss, /#main \.lesson-svg-figure\[data-lesson-visual="u4-l1"\] \.lesson-svg\s*\{[^}]*max-height:\s*450px;[^}]*aspect-ratio:\s*5\s*\/\s*4;[^}]*overflow:\s*visible;/u);
  assert.match(priorityCss, /animation-name:\s*u4l1DriveOrangeVisible\s*!important/u);
  assert.match(priorityCss, /animation-name:\s*u4l1DriveGreenVisible\s*!important/u);
  assert.match(priorityCss, /filter:\s*drop-shadow\(0 0 8px #10b981\) !important/u);
});

test('tire cross-section, right-priority intersection, speed, safe distance and traffic signal explain their concepts', async () => {
  const {renderLessonVisual} = await import(path.join(root, 'src/lesson-visuals.mjs'));
  const tire = renderLessonVisual(lessons.find(lesson => lesson.id === 'u7-l1'));
  assert.match(tire, /BATTISTRADA/u);
  assert.match(tire, /PROFONDITÀ DEL BATTISTRADA/u);
  assert.match(tire, /stroke-dasharray="7 7"/u);
  const priority = renderLessonVisual(lessons.find(lesson => lesson.id === 'u4-l1'));
  assert.match(priority, /viewBox="0 0 1000 800"/u);
  assert.match(priority, /STRADA PRINCIPALE/u);
  assert.match(priority, /STRADA SECONDARIA/u);
  assert.match(priority, /class="car-anim-orange"/u);
  assert.match(priority, /class="car-anim-green"/u);
  assert.match(priority, /#10b981/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u1-l3')), /ADEGUA LA VELOCITÀ/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u6-l1')), /ESEMPIO: 50 km\/h/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u5-l3')), /SPAZIO DI ARRESTO/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u3-l2')), /FERMATI/u);
});

test('lesson template renders inline SVG immediately after the bilingual heading and review uses the same art', async () => {
  const template = await import(path.join(root, 'src/lesson-template.mjs'));
  const lesson = lessons.find(item => item.id === 'u7-l1');
  assert.match(template.renderLessonVisualSection(lesson), /<svg class="lesson-svg" xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 800 600"/u);
  assert.match(template.renderLessonVisualSection(lesson, {compact: true}), /is-compact/u);
  const app = read('src/app.js');
  assert.match(app, /<h1>\$\{pair\(lesson\.heading_it,lesson\.heading_ar,'detail-title'\)\}<\/h1>\$\{renderLessonVisualSection\(lesson\)\}<\/header>/u);
  assert.match(app, /lessonReviewVisualMarkup\(lesson,true\)/u);
  assert.doesNotMatch(app, /data-lesson-image|visual-placeholder|lessonImageMarkup|resolveLessonVisual/u);
  for (const stylesheet of ['src/rebuild.css','src/v50-contrast.css','src/v52-dark-overhaul.css','src/v64-ui-fixes.css']) {
    assert.doesNotMatch(read(stylesheet), /lesson-image|visual-placeholder|course-lesson-visual/u, stylesheet);
  }
  assert.doesNotMatch(read('src/question-figures.mjs'), /Immagine non disponibile|الصورة غير متاحة/u);
});
