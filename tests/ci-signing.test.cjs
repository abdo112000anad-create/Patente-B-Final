'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'scripts/ci-assemble-debug.sh');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'patente-ci-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'scripts'));
  fs.mkdirSync(path.join(dir, 'android'));
  fs.mkdirSync(path.join(dir, 'runner'));
  fs.copyFileSync(script, path.join(dir, 'scripts/ci-assemble-debug.sh'));
  fs.writeFileSync(path.join(dir, 'android/expected'), 'dummy fixture only');
  fs.writeFileSync(path.join(dir, 'android/gradlew'), `#!/usr/bin/env bash
set -euo pipefail
[[ -z "\${PATENTE_DEBUG_KEYSTORE_B64+x}" ]]
[[ "$1" == --no-daemon ]]
[[ "$2" == -PpatenteDebugKeystore=* ]]
key="\${2#-PpatenteDebugKeystore=}"
[[ "$(stat -c %a "$key")" == 600 ]]
cmp -s "$key" expected
[[ "$3" == :app:assembleDebug && "$4" == :app:testDebugUnitTest ]]
exit "\${MOCK_GRADLE_EXIT:-0}"
`, { mode: 0o755 });
  return dir;
}

function run(dir, value, extra = {}) {
  const env = { ...process.env, RUNNER_TEMP: path.join(dir, 'runner'), ...extra };
  if (value === undefined) delete env.PATENTE_DEBUG_KEYSTORE_B64;
  else env.PATENTE_DEBUG_KEYSTORE_B64 = value;
  return spawnSync('bash', [path.join(dir, 'scripts/ci-assemble-debug.sh')], { encoding: 'utf8', env });
}

test('CI signing uses a private temporary file and removes it after the build', t => {
  const dir = fixture(t);
  const result = run(dir, Buffer.from('dummy fixture only').toString('base64'));
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'runner')), []);
  assert.doesNotMatch(result.stdout + result.stderr, /dummy fixture only/);
});

test('CI signing fails closed for missing or malformed secret and removes temporary files', t => {
  const dir = fixture(t);
  assert.notEqual(run(dir, undefined).status, 0);
  assert.notEqual(run(dir, 'not!valid!base64').status, 0);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'runner')), []);
});

test('CI signing removes the temporary key if Gradle fails', t => {
  const dir = fixture(t);
  const result = run(dir, Buffer.from('dummy fixture only').toString('base64'), { MOCK_GRADLE_EXIT: '7' });
  assert.equal(result.status, 7);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'runner')), []);
});

test('workflow injects the signing secret and checks certificate before artifact upload', () => {
  const workflow = fs.readFileSync(path.join(root, '.github/workflows/build.yml'), 'utf8');
  assert.match(workflow, /PATENTE_DEBUG_KEYSTORE_B64:\s*\$\{\{\s*secrets\.PATENTE_DEBUG_KEYSTORE_B64\s*\}\}/);
  assert.match(workflow, /run:\s*bash scripts\/ci-assemble-debug\.sh/);
  const guard = workflow.indexOf('bash scripts/verify-apk-certificate.sh');
  const upload = workflow.indexOf('actions/upload-artifact@');
  assert.ok(guard !== -1 && upload > guard);
});
