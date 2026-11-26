'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = path.resolve(__dirname, '../scripts/verify-apk-certificate.sh');
const match = 'd43b44d31392824a09641bfbaf829cd1d77d9843c8206e8dc2b44eba937072d8';

function run(t, output, code = '0') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patente-sign-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const toolDir = path.join(dir, 'build-tools/36.0.0');
  fs.mkdirSync(toolDir, { recursive: true });
  fs.writeFileSync(path.join(toolDir, 'apksigner'), '#!/bin/sh\nprintf "%s\\n" "$MOCK_OUTPUT"\nexit "$MOCK_CODE"\n', { mode: 0o755 });
  const apk = path.join(dir, 'app.apk');
  fs.writeFileSync(apk, 'test fixture');
  return spawnSync('bash', [script, apk], { encoding: 'utf8', env: { ...process.env, ANDROID_HOME: dir, MOCK_OUTPUT: output, MOCK_CODE: code } });
}

test('certificate gate accepts exactly the expected signing certificate', t => {
  assert.equal(run(t, `Signer #1 certificate SHA-256 digest: ${match}`).status, 0);
});
test('certificate gate rejects a different certificate and multiple signers', t => {
  assert.notEqual(run(t, `Signer #1 certificate SHA-256 digest: ${'a'.repeat(64)}`).status, 0);
  assert.notEqual(run(t, `Signer #1 certificate SHA-256 digest: ${match}\nSigner #2 certificate SHA-256 digest: ${match}`).status, 0);
});
test('certificate gate rejects missing digests or a failed signature verification', t => {
  assert.notEqual(run(t, 'no signer').status, 0);
  assert.notEqual(run(t, `Signer #1 certificate SHA-256 digest: ${match}`, '1').status, 0);
});
