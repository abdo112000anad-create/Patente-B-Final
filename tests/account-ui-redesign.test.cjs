'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('account and sync screen keeps dark high-contrast, wrapped, responsive account cards', () => {
  const css = read('src/account-ui.css');
  const html = read('index.html');
  assert.match(css, /\.account-dialog\s*\{[\s\S]*?color-scheme:\s*dark/u);
  assert.match(css, /\.account-dialog input\s*\{[\s\S]*?background:\s*#09171d\s*!important;[\s\S]*?color:\s*#f1f8f8\s*!important;/u);
  assert.match(css, /\.account-profile-card/u);
  assert.match(css, /\.account-state-card/u);
  assert.match(css, /@media\s*\(max-width:\s*540px\)/u);
  assert.match(css, /overflow-wrap:\s*anywhere/u);
  assert.match(css, /dialog\.account-dialog\s*\{/u);
  assert.match(css, /background:\s*#18373b/u);
  assert.doesNotMatch(css, /background:\s*#f1f6f5/u);
  assert.doesNotMatch(css, /color:\s*#142b46\b/u);
  assert.match(html, /\/src\/account-ui\.css\?v=34/u);
  assert.ok(html.indexOf('/src/account-ui.css?v=34') > html.indexOf('/src/v64-ui-fixes.css?v=64'));
});

test('redesigned account controls retain the existing Firebase and sync service actions', () => {
  const ui = read('src/account-ui.mjs');
  for (const action of ['signInGoogle', 'signInEmail', 'registerEmail', 'sendPasswordReset', 'sendVerification', 'syncNow', 'importGuestProgress', 'signOut', 'deleteAccount']) {
    assert.ok(ui.includes(`service.${action}(`), `missing service callback ${action}`);
  }
  assert.match(ui, /state\.user\.emailVerified/u);
  assert.match(ui, /button\(LABEL\.sync/u);
  assert.match(ui, /button\(LABEL\.merge/u);
  assert.match(ui, /button\(LABEL\.signout/u);
  assert.match(ui, /LABEL\.delete/u);
});
