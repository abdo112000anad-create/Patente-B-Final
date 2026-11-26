'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const readText = file => fs.readFileSync(path.join(root, file), 'utf8');
const readJson = file => JSON.parse(readText(file));
const canonicalLessons = readJson('data/lessons-v2.json');
const legacyLessons = readJson('data/lessons.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function lessonFixture(shape, mutate = () => {}) {
  const course = clone(canonicalLessons);
  for (const module of course.modules) {
    module.lessons = module.lessons.map(lesson => {
      const {quickChecks, ...rest} = lesson;
      const shaped = shape === 'legacy' ? {...rest, quickCheck: quickChecks} : {...rest, quickChecks};
      mutate(shaped);
      return shaped;
    });
  }
  return course;
}

function jsonResponse(payload, {status = 200, contentType = 'application/json', rawText} = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: name => name.toLowerCase() === 'content-type' ? contentType : null},
    text: async () => rawText === undefined ? JSON.stringify(payload) : rawText
  };
}

async function runStartup({fileOverrides = {}, responseOverrides = {}} = {}) {
  const calls = [];
  const files = {
    '/data/questions.json': readJson('data/questions.json'),
    '/data/lessons-v2.json': canonicalLessons,
    '/data/lessons.json': legacyLessons,
    '/data/topic-labels.json': readJson('data/topic-labels.json'),
    '/data/similar-groups.json': readJson('data/similar-groups.json'),
    '/data/lesson-support.json': readJson('data/lesson-support.json'),
    ...fileOverrides
  };
  const {loadCourseData} = await import(path.join(root, 'src/startup.mjs'));
  try {
    const result = await loadCourseData({
      fetchImpl: async url => {
        calls.push(url);
        const override = responseOverrides[url];
        if (override instanceof Error) throw override;
        if (typeof override === 'function') return override(url, files[url]);
        if (override) return jsonResponse(override.payload, override);
        const payload = files[url];
        if (payload === undefined) return jsonResponse(null, {status: 404});
        if (url === '/data/questions.json') {
          return {
            ...jsonResponse(null),
            text: async () => readText('data/questions.json')
          };
        }
        return jsonResponse(payload);
      }
    });
    return {result, calls};
  } catch (error) {
    error.fetchCalls = calls;
    throw error;
  }
}

function serviceWorker() {
  const sandbox = {
    crypto: crypto.webcrypto,
    URL,
    self: {addEventListener() {}, location: {origin: 'https://example.test'}}
  };
  vm.runInNewContext(`${readText('public/sw.js')}\nglobalThis.__safeToCache = safeToCache; globalThis.__validJsonPayload = validJsonPayload; globalThis.__hasCompatibleOfflineData = hasCompatibleOfflineData; globalThis.__cachedResponse = cachedResponse;`, sandbox);
  return sandbox;
}

function cacheResponse(data) {
  const raw = Buffer.from(JSON.stringify(data));
  return {
    ok: true,
    headers: {get: () => 'application/json'},
    clone() { return this; },
    async text() { return raw.toString('utf8'); },
    async json() { return JSON.parse(raw.toString('utf8')); },
    async arrayBuffer() { return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength); }
  };
}

function offlineCache({canonical = canonicalLessons, legacy = legacyLessons, similar = readJson('data/similar-groups.json')} = {}) {
  const payloads = {
    '/data/questions.json': readJson('data/questions.json'),
    '/data/lessons-v2.json': canonical,
    '/data/lessons.json': legacy,
    '/data/lesson-support.json': readJson('data/lesson-support.json'),
    '/data/topic-labels.json': readJson('data/topic-labels.json'),
    '/data/similar-groups.json': similar,
    '/data/italian_arabic_dictionary_lookup.json': readJson('data/italian_arabic_dictionary_lookup.json')
  };
  return {match: async key => payloads[key] === undefined ? undefined : cacheResponse(payloads[key])};
}

test('canonical source retains exactly 50 ordered lessons and three ordered checks each', async () => {
  const {result, calls} = await runStartup();
  const [, course, , similar] = result;
  const lessons = course.modules.flatMap(module => module.lessons);
  assert.equal(course.modules.length, 11);
  assert.equal(lessons.length, 50);
  assert.equal(new Set(lessons.map(lesson => lesson.id)).size, 50);
  assert.ok(lessons.every(lesson => lesson.quickChecks.length === 3));
  assert.deepEqual(calls.slice(0, 5), [
    '/data/questions.json', '/data/lessons-v2.json', '/data/topic-labels.json',
    '/data/similar-groups.json', '/data/lesson-support.json'
  ]);
  assert.equal(similar.question_bank_sha256, crypto.createHash('sha256').update(readText('data/questions.json')).digest('hex'));
  assert.deepEqual(lessons.map(lesson => lesson.id), canonicalLessons.modules.flatMap(module => module.lessons.map(lesson => lesson.id)));
  for (const [moduleIndex, module] of course.modules.entries()) {
    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      assert.deepEqual(lesson.quickChecks, canonicalLessons.modules[moduleIndex].lessons[lessonIndex].quickChecks);
      assert.equal(Object.hasOwn(lesson, 'quickCheck'), false);
    }
  }
});

test('legacy endpoint is a content-identical quickCheck alias and normalizes at runtime', async () => {
  for (const [moduleIndex, module] of canonicalLessons.modules.entries()) {
    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      const legacy = legacyLessons.modules[moduleIndex].lessons[lessonIndex];
      const {quickChecks, ...canonicalWithoutChecks} = lesson;
      const {quickCheck, ...legacyWithoutCheck} = legacy;
      assert.deepEqual(legacyWithoutCheck, canonicalWithoutChecks);
      assert.deepEqual(quickCheck, quickChecks);
    }
  }
  const {result} = await runStartup({responseOverrides: {
    '/data/lessons-v2.json': {payload: null, status: 404}
  }});
  const [, course] = result;
  for (const [moduleIndex, module] of course.modules.entries()) {
    for (const [lessonIndex, lesson] of module.lessons.entries()) {
      assert.deepEqual(lesson.quickChecks, legacyLessons.modules[moduleIndex].lessons[lessonIndex].quickCheck);
      assert.equal(Object.hasOwn(lesson, 'quickCheck'), false);
    }
  }
});

test('network rejection on v2 falls back to the legacy payload', async () => {
  const {result, calls} = await runStartup({responseOverrides: {
    '/data/lessons-v2.json': new TypeError('offline')
  }});
  assert.ok(calls.includes('/data/lessons.json'));
  assert.equal(result[1].modules.flatMap(module => module.lessons).length, 50);
});

test('challenge, malformed JSON, invalid schema, and non-404 server errors do not silently downgrade', async t => {
  const cases = [
    ['challenge', {payload: null, status: 403}],
    ['malformed JSON', {payload: null, status: 200, rawText: '{', contentType: 'application/json'}],
    ['server error', {payload: null, status: 500}]
  ];
  for (const [label, response] of cases) {
    await t.test(label, async () => {
      await assert.rejects(runStartup({responseOverrides: {'/data/lessons-v2.json': response}}), error => {
        assert.ok(!error.fetchCalls.includes('/data/lessons.json'));
        return true;
      });
    });
  }
  await assert.rejects(runStartup({fileOverrides: {
    '/data/lessons-v2.json': lessonFixture('legacy')
  }}), error => error.code === 'course_integrity' && !error.fetchCalls.includes('/data/lessons.json'));
});

test('real question-bank/index mismatch is rejected without rewriting either fixture', async () => {
  const similar = readJson('data/similar-groups.json');
  const expectedHash = similar.question_bank_sha256;
  assert.notEqual(expectedHash, '0'.repeat(64));
  similar.question_bank_sha256 = '0'.repeat(64);
  await assert.rejects(runStartup({fileOverrides: {'/data/similar-groups.json': similar}}), error => error.code === 'course_integrity');
});

test('malformed, missing, or ambiguous quick-check arrays are rejected', async () => {
  for (const mutate of [
    lesson => { lesson.quickChecks = lesson.quickChecks.slice(0, 2); },
    lesson => { delete lesson.quickChecks; },
    lesson => { lesson.quickCheck = lesson.quickChecks; }
  ]) {
    await assert.rejects(runStartup({fileOverrides: {'/data/lessons-v2.json': lessonFixture('canonical', mutate)}}), error => error.code === 'course_integrity');
  }
});

test('service worker accepts only the right schema at each endpoint', async () => {
  const sw = serviceWorker();
  const responseFor = payload => ({
    ok: true,
    headers: {get: () => 'application/json'},
    clone() { return this; },
    text: async () => JSON.stringify(payload)
  });
  assert.equal(await sw.__safeToCache(responseFor(canonicalLessons), '/data/lessons-v2.json'), true);
  assert.equal(await sw.__safeToCache(responseFor(legacyLessons), '/data/lessons.json'), true);
  assert.equal(await sw.__safeToCache(responseFor(canonicalLessons), '/data/lessons.json'), false);
  assert.equal(await sw.__safeToCache(responseFor(legacyLessons), '/data/lessons-v2.json'), false);
  assert.equal(await sw.__safeToCache(responseFor(lessonFixture('canonical', lesson => { lesson.quickCheck = lesson.quickChecks; })), '/data/lessons-v2.json'), false);
  assert.equal(await sw.__safeToCache(responseFor(lessonFixture('legacy', lesson => { lesson.quickChecks = lesson.quickCheck; })), '/data/lessons.json'), false);
});

test('offline completeness requires both legacy and canonical payloads with a matching real question-bank fingerprint', async () => {
  const sw = serviceWorker();
  assert.equal(await sw.__hasCompatibleOfflineData(offlineCache()), true);
  const missingLegacy = offlineCache();
  missingLegacy.match = async key => key === '/data/lessons.json' ? undefined : offlineCache().match(key);
  assert.equal(await sw.__hasCompatibleOfflineData(missingLegacy), false);
  const mismatched = readJson('data/similar-groups.json');
  mismatched.question_bank_sha256 = '0'.repeat(64);
  assert.equal(await sw.__hasCompatibleOfflineData(offlineCache({similar: mismatched})), false);
  const changedModule = clone(legacyLessons);
  changedModule.modules[0].title_it += ' modificato';
  assert.equal(await sw.__hasCompatibleOfflineData(offlineCache({legacy: changedModule})), false);
});

test('current service worker can read a legacy endpoint from an older cache until migration data is complete', async () => {
  const sw = serviceWorker();
  const oldCache = {match: async key => key === '/data/lessons.json' ? cacheResponse(legacyLessons) : undefined};
  const currentCache = {match: async () => undefined};
  sw.caches = {
    keys: async () => ['patente-ar-v65-native-tts-1'],
    open: async () => oldCache
  };
  const legacy = await sw.__cachedResponse(currentCache, '/data/lessons.json');
  assert.ok(legacy);
  assert.equal((await legacy.json()).modules[0].lessons[0].quickCheck.length, 3);
  const oldPluralPayload = {match: async key => key === '/data/lessons.json' ? cacheResponse(canonicalLessons) : undefined};
  sw.caches.open = async () => oldPluralPayload;
  assert.equal(await sw.__cachedResponse(currentCache, '/data/lessons.json'), undefined);
});

test('saved progress IDs and question positions remain stable', async () => {
  const review = await import(path.join(root, 'src/quick-check-review.mjs'));
  const lesson = canonicalLessons.modules[0].lessons[0];
  const ids = lesson.quickChecks.map((_, index) => review.quickCheckId(lesson.id, index));
  assert.deepEqual(ids, ['u1-l1::q1', 'u1-l1::q2', 'u1-l1::q3']);
  const scheduled = review.scheduleQuickCheckAnswer({
    lessonId: lesson.id, questionIndex: 1, chosen: 'VERO', expected: lesson.quickChecks[1].a, now: 0
  });
  assert.equal(scheduled.key, 'u1-l1::q2');
});
