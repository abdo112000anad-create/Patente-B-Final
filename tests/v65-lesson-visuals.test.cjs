'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const course = JSON.parse(read('data/lessons.json'));
const lessons = course.modules.flatMap(module => module.lessons);

 test('every one of the 50 course lessons resolves to a self-contained, accessible inline SVG', async () => {
  const visuals = await import(path.join(root, 'src/lesson-visuals.mjs'));
  const ids = visuals.lessonVisualIds().sort();
  assert.equal(ids.length, 50);
  assert.deepEqual(ids, lessons.map(lesson => lesson.id).sort());
  for (const lesson of lessons) {
    const svg = visuals.renderLessonVisual(lesson);
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
});

test('tire cross-section, right-priority intersection, speed, safe distance and traffic signal explain their concepts', async () => {
  const {renderLessonVisual} = await import(path.join(root, 'src/lesson-visuals.mjs'));
  const tire = renderLessonVisual(lessons.find(lesson => lesson.id === 'u7-l1'));
  assert.match(tire, /BATTISTRADA/u);
  assert.match(tire, /PROFONDITÀ DEL BATTISTRADA/u);
  assert.match(tire, /stroke-dasharray="7 7"/u);
  const priority = renderLessonVisual(lessons.find(lesson => lesson.id === 'u4-l1'));
  assert.match(priority, /CHI ARRIVA DA DESTRA PASSA PER PRIMO/u);
  assert.match(priority, /marker-end="url\(#u4-l1-arrow\)"/u);
  assert.match(priority, /#f2b85b/u);
  assert.match(priority, /#10b981/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u1-l3')), /ADEGUA LA VELOCITÀ/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u6-l1')), /ESEMPIO: 50 km\/h/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u5-l3')), /SPAZIO DI ARRESTO/u);
  assert.match(renderLessonVisual(lessons.find(lesson => lesson.id === 'u3-l2')), /FERMATI/u);
});

test('lesson template renders inline SVG immediately after the bilingual heading and review uses the same art', async () => {
  const template = await import(path.join(root, 'src/lesson-template.mjs'));
  const lesson = lessons.find(item => item.id === 'u7-l1');
  assert.match(template.renderLessonVisualSection(lesson), /<svg class="lesson-svg"/u);
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
