'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validate, getApplicationId } = require('../scripts/check-firebase-production.cjs');
const fs = require('node:fs');
const path = require('node:path');

const pkg = 'it.patenteb.sideload.v29';
function fixture() {
  return {
    expectedPackage: pkg,
    webConfig: {
      apiKey: 'AIzaSyA123456789012345678901234567890123',
      authDomain: 'patente-demo.firebaseapp.com',
      projectId: 'patente-demo-12345',
      messagingSenderId: '123456789012',
      appId: '1:123456789012:web:abcdef0123456789'
    },
    androidConfig: {
      project_info: { project_number: '123456789012', project_id: 'patente-demo-12345', storage_bucket: 'patente-demo-12345.appspot.com' },
      client: [{ client_info: { mobilesdk_app_id: '1:123456789012:android:abcdef0123456789', android_client_info: { package_name: pkg } }, api_key: [{ current_key: 'AIzaSyA123456789012345678901234567890123' }] }]
    }
  };
}

test('accepts matching non-placeholder web and Android Firebase configs for the actual package', () => {
  assert.deepEqual(validate(fixture()), { ok: true, errors: [] });
  const gradle = path.join(__dirname, '../android/app/build.gradle');
  assert.equal(getApplicationId(gradle), pkg);
});
test('rejects empty web config and placeholder Android values with clear diagnostics', () => {
  const config = fixture();
  config.webConfig.apiKey = '';
  config.webConfig.projectId = '';
  config.androidConfig.project_info.project_id = 'placeholder-nonfunctional';
  config.androidConfig.client[0].api_key[0].current_key = 'FAKE_NONFUNCTIONAL_DO_NOT_USE';
  const result = validate(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(message => /Web Firebase config: apiKey/u.test(message)));
  assert.ok(result.errors.some(message => /Web Firebase config: projectId/u.test(message)));
  assert.ok(result.errors.some(message => /Android google-services.json: project_id/u.test(message)));
  assert.ok(result.errors.some(message => /placeholder API key/u.test(message)));
});
test('rejects package mismatch and cross-project sender/project identifiers', () => {
  const config = fixture();
  config.androidConfig.client[0].client_info.android_client_info.package_name = 'it.other.app';
  config.androidConfig.project_info.project_id = 'another-project-54321';
  config.webConfig.messagingSenderId = '987654321098';
  const result = validate(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(message => /no client matches applicationId/u.test(message)));
  assert.ok(result.errors.some(message => /web projectId and Android/u.test(message)));
  assert.ok(result.errors.some(message => /messagingSenderId and Android/u.test(message)));
});
test('rejects malformed IDs, project-number inconsistency, and missing API key', () => {
  const config = fixture();
  config.webConfig.appId = 'invalid';
  config.androidConfig.client[0].client_info.mobilesdk_app_id = '1:999999999999:android:abcdef0123456789';
  config.androidConfig.client[0].api_key = [];
  const result = validate(config);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(message => /not a Firebase web app ID/u.test(message)));
  assert.ok(result.errors.some(message => /project number does not match/u.test(message)));
  assert.ok(result.errors.some(message => /missing or placeholder API key/u.test(message)));
});
