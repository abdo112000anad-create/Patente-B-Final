const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const questionId = 19550;
const italian =
  "Il segnale raffigurato vieta il sorpasso fra autoveicoli, anche se la manovra può compiersi entro la semicarreggiata";
const arabic =
  "الإشارة الموضَّحة تحظر تجاوز السيارات بعضها بعضًا، حتى لو أمكن إتمام المناورة داخل نصف الطريق المخصَّص لاتجاه سير واحد.";
const image = "/quiz-images/49d1253347bba2fff905.jpg";

function findRecords(value, records = []) {
  if (Array.isArray(value)) {
    for (const item of value) findRecords(item, records);
  } else if (value !== null && typeof value === "object") {
    if (value.id === questionId) records.push(value);
    for (const item of Object.values(value)) findRecords(item, records);
  }
  return records;
}

function readUniqueRecord(file) {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "..", file), "utf8"));
  const records = findRecords(data);
  assert.equal(records.length, 1, `expected exactly one question with id ${questionId} in ${file}`);
  return records[0];
}

test("Q19550 has the verified Italian safety translation in both datasets", () => {
  const defaultRecord = readUniqueRecord("data/questions.json");
  const italianRecord = readUniqueRecord("data/questions.it.json");

  // Official exam source: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650
  assert.equal(defaultRecord.it, italian);
  assert.equal(italianRecord.it, italian);
  assert.equal(defaultRecord.answer, "VERO");
  assert.equal(italianRecord.answer, "VERO");
  assert.equal(defaultRecord.image, image);
  assert.equal(italianRecord.image, image);

  // Applicable rule: https://www.normattiva.it/uri-res/N2Ls?urn:nir:presidente.repubblica:decreto.del.presidente.della.repubblica:1992-12-16;495~art116
  assert.equal(defaultRecord.ar, arabic);
  assert.equal(italianRecord.ar, arabic);
  assert.equal(defaultRecord.ar, italianRecord.ar);
});
