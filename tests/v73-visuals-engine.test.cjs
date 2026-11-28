'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const course = JSON.parse(read('data/lessons.json'));
const lessons = course.modules.flatMap(module => module.lessons);

async function getRenderers() {
  const [legacy, template] = await Promise.all([
    import(path.join(root, 'src/lesson-visuals.mjs')),
    import(path.join(root, 'src/lesson-template.mjs')),
  ]);
  return {legacy, template};
}

test('v73 binds a valid, lesson-ID-specific SVG to every one of the 50 lessons', async () => {
  const {legacy, template} = await getRenderers();
  const lessonIds = lessons.map(lesson => lesson.id).sort();
  assert.equal(lessons.length, 50);
  assert.equal(new Set(lessonIds).size, 50);
  assert.deepEqual(legacy.lessonVisualIds().sort(), lessonIds);

  const figures = lessons.map(lesson => template.renderLessonVisualSection(lesson));
  const parsed = JSON.parse(execFileSync('python3', ['-c', [
    'import json, sys, xml.etree.ElementTree as ET',
    'figures = json.load(sys.stdin)',
    'svg_ns = "{http://www.w3.org/2000/svg}svg"',
    'result = []',
    'for figure in figures:',
    '    root = ET.fromstring(figure)',
    '    svg = root.find(svg_ns)',
    '    if root.tag != "figure" or svg is None:',
    '        raise SystemExit("missing figure or SVG root")',
    '    result.append(root.attrib.get("data-lesson-visual"))',
    'print(json.dumps(result))',
  ].join('\n')], {input: JSON.stringify(figures), encoding: 'utf8'}));
  assert.deepEqual(parsed, lessons.map(lesson => lesson.id));
  assert.ok(figures.every(figure => (figure.match(/<svg\b/g) || []).length === 1));
});

test('the pasted engine is selected only for lessons matching its five visual concepts', async () => {
  const {template} = await getRenderers();
  const expected = new Map([
    ['u1-l3', /LIMITI DI VELOCITÀ/u],
    ['u4-l1', /PRECEDENZA/u],
    ['u5-l3', /Distanza di sicurezza|DISTANZA DI SICUREZZA/u],
    ['u6-l1', /LIMITI DI VELOCITÀ/u],
    ['u7-l1', /PNEUMATICI/u],
    ['u9-l1', /ALCOL/u],
  ]);
  for (const [id, marker] of expected) {
    const markup = template.renderLessonVisualSection(lessons.find(lesson => lesson.id === id));
    assert.match(markup, new RegExp(`data-lesson-visual="${id}"`));
    assert.match(markup, marker, id);
  }
  const priority = template.renderLessonVisualSection(lessons.find(lesson => lesson.id === 'u4-l1'));
  assert.match(priority, /matrix\(1 \.18 -\.34 \.82 0 0\)/u);
  assert.match(priority, /matrix\(1 \.28 -\.55 \.62 0 0\)/u);
  assert.match(priority, /@keyframes priority-\d+-drive/u);
});

test('engine artwork preserves the mobile 4:3 frame and disables motion when requested', () => {
  const css = read('src/v64-ui-fixes.css');
  assert.match(css, /\.lesson-svg-figure\.is-engine-visual\s*\{/u);
  assert.match(css, /\.lesson-svg-figure\.is-engine-visual\s+\.lesson-svg\s*\{[^}]*aspect-ratio:\s*4\s*\/\s*3/u);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/u);
  assert.match(css, /animation: none !important/u);
});
