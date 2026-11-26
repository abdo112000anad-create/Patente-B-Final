#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function readJson(file, label, errors) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) {
    errors.push(`${label}: cannot read valid JSON at ${file} (${error.message})`);
    return null;
  }
}
function present(value) { return typeof value === 'string' && value.trim().length > 0; }
function placeholder(value) {
  return !present(value) || /placeholder|fake|dummy|replace[_ -]?with|your[_ -]?|nonfunctional|example|\.invalid|000000000000/i.test(value);
}
function validProjectId(value) { return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value || ''); }
function validAppId(value) { return /^1:\d{6,}:android:[0-9a-f]{16,}$/i.test(value || ''); }

function validate({ webConfig, androidConfig, expectedPackage }) {
  const errors = [];
  if (!webConfig || typeof webConfig !== 'object') errors.push('Web Firebase config: expected an object.');
  if (!androidConfig || typeof androidConfig !== 'object') errors.push('Android google-services config: expected an object.');
  if (!present(expectedPackage)) errors.push('Android package: expected a non-empty applicationId.');
  if (errors.length) return { ok: false, errors };

  const webFields = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId'];
  for (const key of webFields) {
    const value = webConfig[key];
    if (!present(value) || placeholder(value)) errors.push(`Web Firebase config: ${key} is empty or looks like a placeholder.`);
  }
  if (present(webConfig.projectId) && !placeholder(webConfig.projectId) && !validProjectId(webConfig.projectId)) errors.push('Web Firebase config: projectId has an invalid format.');
  if (present(webConfig.appId) && !placeholder(webConfig.appId) && !/^1:\d{6,}:web:[0-9a-f]+$/i.test(webConfig.appId)) errors.push('Web Firebase config: appId is not a Firebase web app ID.');
  if (present(webConfig.authDomain) && !placeholder(webConfig.authDomain) && !/^[a-z0-9-]+\.firebaseapp\.com$/i.test(webConfig.authDomain)) errors.push('Web Firebase config: authDomain must be a Firebase Hosting auth domain.');
  if (present(webConfig.messagingSenderId) && !placeholder(webConfig.messagingSenderId) && !/^\d{6,}$/.test(webConfig.messagingSenderId)) errors.push('Web Firebase config: messagingSenderId must be numeric.');

  const info = androidConfig.project_info;
  const clients = androidConfig.client;
  if (!info || typeof info !== 'object') errors.push('Android google-services.json: missing project_info.');
  if (!Array.isArray(clients) || clients.length === 0) errors.push('Android google-services.json: missing client entries.');
  if (info && typeof info === 'object') {
    for (const [label, value] of [['project_id', info.project_id], ['project_number', info.project_number]]) {
      if (!present(value) || placeholder(value)) errors.push(`Android google-services.json: ${label} is empty or looks like a placeholder.`);
    }
    if (present(info.project_id) && !placeholder(info.project_id) && !validProjectId(info.project_id)) errors.push('Android google-services.json: project_id has an invalid format.');
    if (present(info.project_number) && !placeholder(info.project_number) && !/^\d{6,}$/.test(info.project_number)) errors.push('Android google-services.json: project_number must be numeric.');
  }
  const matching = Array.isArray(clients) ? clients.filter(client => client?.client_info?.android_client_info?.package_name === expectedPackage) : [];
  if (!matching.length) errors.push(`Android google-services.json: no client matches applicationId ${expectedPackage}.`);
  for (const client of matching) {
    const appId = client?.client_info?.mobilesdk_app_id;
    if (!present(appId) || placeholder(appId) || !validAppId(appId)) errors.push('Android google-services.json: matching client has a missing, placeholder, or malformed mobilesdk_app_id.');
    else if (info?.project_number && appId.split(':')[1] !== info.project_number) errors.push('Android google-services.json: mobilesdk_app_id project number does not match project_info.project_number.');
    const keys = client?.api_key;
    if (!Array.isArray(keys) || !keys.length || keys.some(item => !present(item?.current_key) || placeholder(item.current_key))) errors.push('Android google-services.json: matching client has a missing or placeholder API key.');
  }
  if (present(webConfig.projectId) && present(info?.project_id) && webConfig.projectId !== info.project_id) errors.push('Firebase project mismatch: web projectId and Android project_info.project_id differ.');
  if (present(webConfig.messagingSenderId) && present(info?.project_number) && webConfig.messagingSenderId !== info.project_number) errors.push('Firebase project mismatch: web messagingSenderId and Android project_number differ.');
  return { ok: errors.length === 0, errors };
}

function getApplicationId(gradleFile) {
  const text = fs.readFileSync(gradleFile, 'utf8');
  const match = text.match(/^\s*applicationId\s+["']([^"']+)["']/m);
  if (!match) throw new Error(`Could not determine applicationId from ${gradleFile}`);
  return match[1];
}
function main(argv) {
  const root = path.resolve(__dirname, '..');
  const webPath = path.resolve(root, process.env.FIREBASE_WEB_CONFIG || 'src/firebase-config.mjs');
  const androidPath = path.resolve(root, process.env.FIREBASE_ANDROID_CONFIG || 'android/app/google-services.json');
  let webConfig;
  try {
    const source = fs.readFileSync(webPath, 'utf8');
    const object = source.match(/export\s+const\s+firebaseConfig\s*=\s*Object\.freeze\s*\(\s*(\{[\s\S]*?\})\s*\)/);
    if (object) {
      webConfig = {};
      const property = /\b(apiKey|authDomain|projectId|messagingSenderId|appId)\s*:\s*(['"])(.*?)\2/g;
      for (const match of object[1].matchAll(property)) webConfig[match[1]] = match[3];
    }
    else webConfig = JSON.parse(source);
  } catch (error) {
    console.error(`Web Firebase config: cannot parse ${webPath} as firebaseConfig object (${error.message}).`);
    return 1;
  }
  let androidConfig;
  try { androidConfig = JSON.parse(fs.readFileSync(androidPath, 'utf8')); }
  catch (error) { console.error(`Android google-services.json: cannot read valid JSON at ${androidPath} (${error.message}).`); return 1; }
  let expectedPackage;
  try { expectedPackage = getApplicationId(path.join(root, 'android/app/build.gradle')); }
  catch (error) { console.error(error.message); return 1; }
  const result = validate({ webConfig, androidConfig, expectedPackage });
  if (!result.ok) {
    console.error('Firebase production configuration check FAILED; no build, upload, or Firebase setup was performed.');
    for (const error of result.errors) console.error(` - ${error}`);
    console.error('Provide approved Firebase web config and matching Android google-services.json, then rerun this optional check.');
    return 1;
  }
  console.log(`Firebase configuration shape check PASSED for ${expectedPackage} / ${webConfig.projectId}. This does not verify OAuth, Firebase service enablement, or security rules.`);
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { validate, getApplicationId, readJson };
