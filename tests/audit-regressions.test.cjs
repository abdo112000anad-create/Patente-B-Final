'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('completed practice and exam results discard the in-memory quiz before later navigation', () => {
  const app = read('src/app.js');
  const practiceStart = app.indexOf('function finishPractice(){');
  const examStart = app.indexOf('function finishExam(', practiceStart);
  const examEnd = app.indexOf('function recordExamAnswer(', examStart);
  const practice = app.slice(practiceStart, examStart);
  const exam = app.slice(examStart, examEnd);

  assert.ok(practiceStart >= 0 && examStart > practiceStart && examEnd > examStart);
  assert.ok(practice.indexOf('showResult(') >= 0);
  assert.ok(practice.lastIndexOf('quiz=null;') > practice.indexOf('showResult('));
  assert.ok(exam.indexOf('showResult(') >= 0);
  assert.ok(exam.lastIndexOf('quiz=null;') > exam.indexOf('showResult('));
});

test('progress backup round-trips Arabic-first preference and defaults older backups safely', async () => {
  const {createProgressBackup, restoreProgressBackup} = await import(path.join(root, 'src/progress-backup.mjs'));
  const context = {
    questionIds: new Set([1]),
    lessonKeys: new Set(['u1-l1']),
    topics: new Set(),
    sourceCheckIds: new Set()
  };
  const backup = JSON.parse(createProgressBackup({
    favorites: new Set(), wrong: new Set(), solved: new Set(),
    completedLessons: new Set(), reviewedLessons: new Set(),
    languageOrder: 'ar'
  }));

  assert.equal(backup.progress.languageOrder, 'ar');
  assert.equal(restoreProgressBackup(backup, context).languageOrder, 'ar');
  const older = restoreProgressBackup({
    format: 'patente-b-progress-backup', version: 1, progress: {}
  }, context);
  assert.equal(older.languageOrder, 'it');

  const cloud = await import(path.join(root, 'src/cloud-progress.mjs'));
  const cloudPayload = JSON.parse(cloud.createCloudProgress({
    favorites: new Set(), wrong: new Set(), solved: new Set(),
    completedLessons: new Set(), reviewedLessons: new Set(), languageOrder: 'ar'
  }));
  assert.equal(Object.hasOwn(cloudPayload.progress, 'languageOrder'), false);
  assert.doesNotThrow(() => cloud.validateCloudProgress(cloudPayload, context));
});

test('successful backup import reapplies language order immediately', () => {
  assert.match(read('src/app.js'), /onImported:\(\)=>\{applyLanguageOrder\(\);render\('home'\)\}/u);
});
