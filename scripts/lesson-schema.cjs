'use strict';

function toLegacyLessons(canonical) {
  if (!canonical || !Array.isArray(canonical.modules)) {
    throw new Error('Cannot generate legacy lessons from an invalid canonical payload.');
  }
  return {
    ...canonical,
    modules: canonical.modules.map(module => ({
      ...module,
      lessons: module.lessons.map(lesson => {
        if (!lesson || !Array.isArray(lesson.quickChecks) || Object.hasOwn(lesson, 'quickCheck')) {
          throw new Error('Cannot generate legacy lessons from a non-canonical lesson.');
        }
        const {quickChecks, ...legacyLesson} = lesson;
        return {...legacyLesson, quickCheck: quickChecks};
      })
    }))
  };
}

module.exports = {toLegacyLessons};
