'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const context = {
  questionIds: new Set([1, 2]),
  lessonKeys: new Set(['u1-l1', 'u1-l2']),
  topics: new Set(),
  sourceCheckIds: new Set()
};
const DAY = 86_400_000;

function stateWithQuickChecks(wrongAnswers, quickCheckSchedule) {
  return {
    favorites: new Set(), wrong: new Set(), solved: new Set(),
    completedLessons: new Set(), reviewedLessons: new Set(),
    wrongAnswers, quickCheckSchedule, questionStats: {}, sessions: [],
    topicCorrect: {}, topicTotal: {}, sourceChecks: {},
    correctCount: 0, practiceCount: 0, streak: 0, fontSize: 16
  };
}

test('progress backup exports and restores spaced quick-check state, filtering invalid lesson/question IDs', async () => {
  const {createProgressBackup, restoreProgressBackup} = await import(path.join(root, 'src/progress-backup.mjs'));
  const review = await import(path.join(root, 'src/quick-check-review.mjs'));
  const now = Date.UTC(2026, 10, 22);
  const wrong = review.scheduleQuickCheckAnswer({
    lessonId: 'u1-l1', questionIndex: 0, chosen: 'FALSO', expected: 'VERO', now
  });
  const state = stateWithQuickChecks(
    [...wrong.wrongAnswers, 'u1-l1::q4', 'bad-key'],
    {...wrong.schedule, 'u99-l1::q1': {...wrong.schedule['u1-l1::q1'], lessonId: 'u99-l1'}}
  );
  const payload = JSON.parse(createProgressBackup(state, '2026-11-22T00:00:00.000Z'));
  assert.deepEqual(payload.progress.wrongAnswers, ['u1-l1::q1']);
  assert.deepEqual(Object.keys(payload.progress.quickCheckSchedule).sort(), ['u1-l1::q1', 'u99-l1::q1']);
  payload.progress.wrongAnswers.push('u99-l1::q1');
  payload.progress.quickCheckSchedule['u99-l1::q1'] = {...wrong.schedule['u1-l1::q1'], lessonId: 'u99-l1'};
  const restored = restoreProgressBackup(payload, context);
  assert.deepEqual(restored.wrongAnswers, ['u1-l1::q1']);
  assert.deepEqual({...restored.quickCheckSchedule['u1-l1::q1']}, wrong.schedule['u1-l1::q1']);
  assert.equal(Object.hasOwn(restored.quickCheckSchedule, 'u99-l1::q1'), false);

  const course = JSON.parse(read('data/lessons-v2.json'));
  const appLessonKeys = new Set(course.modules.flatMap(module => module.lessons.flatMap((lesson, index) => [`${module.module_id}.${index}`, lesson.id])));
  assert.ok(appLessonKeys.has('road-basics.0'));
  assert.ok(appLessonKeys.has('u1-l1'));
  const restoredWithAppContext = restoreProgressBackup(payload, {...context, lessonKeys: appLessonKeys});
  assert.deepEqual(restoredWithAppContext.wrongAnswers, ['u1-l1::q1']);
  assert.deepEqual({...restoredWithAppContext.quickCheckSchedule['u1-l1::q1']}, wrong.schedule['u1-l1::q1']);

  const legacy = restoreProgressBackup({format: 'patente-b-progress-backup', version: 1, progress: {}}, context);
  assert.deepEqual(legacy.wrongAnswers, []);
  assert.deepEqual(Object.keys(legacy.quickCheckSchedule), []);
});

test('app backup and cloud contexts accept both lesson storage keys and quick-check lesson IDs', () => {
  const app = read('src/app.js');
  assert.match(app, /function progressLessonKeys\(\)\{return new Set\(flatLessons\(\)\.flatMap\(item=>\[item\.key,item\.lesson\.id\]\)\);\}/u);
  assert.equal((app.match(/lessonKeys:progressLessonKeys\(\)/gu) || []).length, 2);
});

test('cloud progress syncs quick-check schedules and resolves newer correct answers over stale errors', async () => {
  const review = await import(path.join(root, 'src/quick-check-review.mjs'));
  const cloud = await import(path.join(root, 'src/cloud-progress.mjs'));
  const now = Date.UTC(2026, 10, 22);
  const firstWrong = review.scheduleQuickCheckAnswer({
    lessonId: 'u1-l1', questionIndex: 0, chosen: 'FALSO', expected: 'VERO', now
  });
  const corrected = review.scheduleQuickCheckAnswer({
    schedule: firstWrong.schedule, wrongAnswers: firstWrong.wrongAnswers,
    lessonId: 'u1-l1', questionIndex: 0, chosen: 'VERO', expected: 'VERO', now: now + DAY
  });
  const remoteError = review.scheduleQuickCheckAnswer({
    schedule: corrected.schedule, wrongAnswers: corrected.wrongAnswers,
    lessonId: 'u1-l1', questionIndex: 1, chosen: 'FALSO', expected: 'VERO', now: now + 2 * DAY
  });
  const local = stateWithQuickChecks(firstWrong.wrongAnswers, firstWrong.schedule);
  const remote = stateWithQuickChecks(remoteError.wrongAnswers, remoteError.schedule);
  const payload = cloud.createCloudProgress(remote, '2026-11-24T00:00:00.000Z');
  const validated = cloud.validateCloudProgress(payload, context);
  assert.deepEqual(validated.wrongAnswers, ['u1-l1::q2']);
  assert.deepEqual(Object.keys(validated.quickCheckSchedule).sort(), ['u1-l1::q1', 'u1-l1::q2']);
  const merged = cloud.mergeCloudProgress(local, payload, context);
  assert.deepEqual(merged.wrongAnswers, ['u1-l1::q2']);
  assert.equal(merged.quickCheckSchedule['u1-l1::q1'].lastCorrect, true);
  assert.equal(merged.quickCheckSchedule['u1-l1::q1'].attempts, 2);
  assert.equal(merged.quickCheckSchedule['u1-l1::q2'].lastCorrect, false);
});

test('authored stylesheets contain no malformed CSS color custom-property references', () => {
  for (const file of ['src/styles.css', 'src/rebuild.css']) {
    const css = read(file);
    assert.doesNotMatch(css, /var\(\s*--#/u, `${file} must use literal colors, not malformed custom properties`);
    assert.match(css, /#142733/iu, `${file} should retain the intended surface color`);
  }
});

test('local static server serves the requested runtime configuration with fresh-cache headers', async t => {
  const {server, resolveStaticFile} = require('../server.js');
  assert.match(resolveStaticFile('/runtime-config.js'), /public[/\\]runtime-config\.js$/u);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/runtime-config.js?v=57`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /^text\/javascript/u);
  assert.equal(response.headers.get('cache-control'), 'no-cache');
  assert.match(await response.text(), /window\.PATENTEB_CONFIG/u);
});
