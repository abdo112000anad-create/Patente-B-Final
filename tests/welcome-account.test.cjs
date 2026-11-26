'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const modules = Promise.all([import('../src/welcome-account.mjs'), import('../src/account-ui.mjs')]);

function harness(initializeWelcomeAccount, { configured = true, signInGoogle = async () => {}, initialState = {} } = {}) {
  let listener;
  let unsubscribed = false;
  const service = {
    isConfigured: configured,
    signInGoogle,
    subscribe(fn) { listener = fn; fn(initialState); return () => { unsubscribed = true; }; }
  };
  const buttonListeners = new Map();
  const button = {
    disabled: true, hidden: false,
    addEventListener(type, fn) { buttonListeners.set(type, fn); },
    removeEventListener(type) { buttonListeners.delete(type); },
    click() { return buttonListeners.get('click')?.(); }
  };
  const dialog = { open: true, closed: false, close() { this.open = false; this.closed = true; } };
  const note = { textContent: '' };
  const controller = initializeWelcomeAccount({ service, dialog, button, note });
  return { service, button, dialog, note, controller, emit: state => listener?.(state), isUnsubscribed: () => unsubscribed };
}

test('unconfigured Google sign-in remains unavailable and does not call the provider', async () => {
  const [{ initializeWelcomeAccount }] = await modules;
  let calls = 0;
  const h = harness(initializeWelcomeAccount, { configured: false, signInGoogle: async () => { calls++; } });
  assert.equal(h.button.disabled, true);
  assert.match(h.note.textContent, /غير مهيّأ/);
  await h.button.click();
  assert.equal(calls, 0);
  assert.equal(h.dialog.closed, false);
});

test('Google request does not claim authentication or close welcome until auth state supplies a user', async () => {
  const [{ initializeWelcomeAccount }] = await modules;
  let resolveSignIn;
  const h = harness(initializeWelcomeAccount, { signInGoogle: () => new Promise(resolve => { resolveSignIn = resolve; }) });
  const pending = h.button.click();
  assert.equal(h.button.disabled, true);
  assert.match(h.note.textContent, /جارٍ تسجيل الدخول/);
  resolveSignIn();
  await pending;
  assert.equal(h.controller.isSignedIn(), false);
  assert.equal(h.dialog.closed, false);
  assert.match(h.note.textContent, /التحقق من الحساب/);
  h.emit({ user: { uid: 'verified-auth-state' } });
  assert.equal(h.controller.isSignedIn(), true);
  assert.equal(h.dialog.closed, true);
  assert.equal(h.button.hidden, true);
});

test('Google failure is shown and allows retry without disabling guest dismissal', async () => {
  const [{ initializeWelcomeAccount }] = await modules;
  const h = harness(initializeWelcomeAccount, { signInGoogle: async () => { throw new Error('تعذر تسجيل الدخول.'); } });
  await h.button.click();
  assert.equal(h.note.textContent, 'تعذر تسجيل الدخول.');
  assert.equal(h.button.disabled, false);
  assert.equal(h.dialog.closed, false);
});

test('destroy unsubscribes and removes the Google click handler', async () => {
  const [{ initializeWelcomeAccount }] = await modules;
  let calls = 0;
  const h = harness(initializeWelcomeAccount, { signInGoogle: async () => { calls++; } });
  h.controller.destroy();
  await h.button.click();
  assert.equal(calls, 0);
  assert.equal(h.isUnsubscribed(), true);
});

test('privacy wording distinguishes Firebase configured from unavailable states', async () => {
  const [, { accountPrivacyMessage }] = await modules;
  const configured = accountPrivacyMessage(true);
  const unavailable = accountPrivacyMessage(false);
  assert.match(configured, /Firebase/);
  assert.match(configured, /التقدم/);
  assert.match(unavailable, /غير مهيّأين/);
  assert.doesNotMatch(unavailable, /قد تُرسل بيانات الحساب/);
});
