# Patente B Italian–Arabic Content Audit — Batch 22

**Outcome:** four Arabic question translations were corrected; no Italian question text or VERO/FALSO answer changed. The `abitato` and `delineatore` dictionary entries remain flagged because the opened sources do not establish safe, standardized Arabic equivalents.

## Question translations corrected

### Q22730 — brief horn warning in immediate danger

The former Arabic used plural “pedestrians,” an awkward phrase for yielding priority, and `صفرة` (“whistle”) for a vehicle horn. It now refers to one pedestrian, expresses the right-of-way clause clearly, and says `ضغطة قصيرة على البوق` (“a brief press of the horn”). The immediate-danger condition remains.

ACI [Article 156](https://www.aci.it/fileadmin/cds/art-156.php) says acoustic warnings must be used with maximum moderation, only for road safety, and for the shortest time possible; in built-up areas they are prohibited except in actual and immediate danger. ACI [Article 191](https://www.aci.it/fileadmin/cds/art-191.php) supplies the relevant pedestrian-priority context at and near crossings. These articles support the safety context, not every detail of the question’s hypothetical. The proposed Arabic is descriptive, not an official legal translation.

### Q22745 — overtaking or interrupting a procession

The Arabic was revised to preserve the Italian claim that a driver should consider a procession’s density and overtake or interrupt it if possible. ACI [Article 163(2)](https://aci.gov.it/codice-della-strada/art-163/) states that interrupting processions and similar groups is prohibited, supporting the existing **FALSO** answer. The answer key was preserved.

### Q24666 — parking at a vehicle-access entrance

The malformed `مدخل عبرة للمركبات` and untranslated parenthetical `passo carrabile` were replaced with the descriptive phrase `مدخلٍ مخصّص لدخول المركبات إلى عقارٍ متصل بالطريق`. ACI [Article 158(2)(a)](https://www.aci.it/fileadmin/cds/art-158.php) prohibits parking at the exit of a vehicle-access entrance. Official Gazette [Article 126-bis](https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=12&art.idGruppo=10&art.flagTipoArticolo=0&art.codiceRedazionale=092G0306&art.idArticolo=126&art.idSottoArticolo=2&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=1992-05-18&art.progressivo=0) makes point deductions subject to the attached table of listed violations. That table was not checked individually, so this batch does **not** claim an independent verification of the existing **FALSO** answer. The Arabic wording is descriptive; no authoritative Arabic equivalent for *passo carrabile* was found.

### Q22497 — caution and speed at railway level crossings

The former `معتدلة السرعة` was a mismatched adjective phrase rather than an instruction to moderate speed. It now says `خفض السرعة` (“reduce speed”) and uses `معابر السكك الحديدية` for level crossings. ACI [Article 147](https://www.aci.it/fileadmin/cds/art-147.php) requires maximum prudence when approaching a level crossing. The exact `moderare la velocità` wording is preserved from the paired Italian question records; the official quiz PDF could not be read by the available text extraction. No Italian text or **VERO** answer was changed.

## Flagged dictionary terms left unchanged

### `abitato`

The row remains `مأهول`, `machine_draft_needs_review`, `review_required: 1`. ACI [Article 3](https://www.aci.it/fileadmin/cds/art-3.php) defines *centro abitato* as a group of buildings delimited by start/end signs and subject to further criteria. [Treccani](https://www.treccani.it/vocabolario/abitato/) distinguishes the adjective “populated/inhabited” from the noun sense of a place occupied by a group of buildings. An opened [Italian–Arabic dictionary page](http://dizionario-arabo-italiano.blogspot.com/) lists `مأهول بالسكان` and `مجمع سكاني`, but it is not an authoritative legal-terminology source. `مأهول` remains defensible for the adjective; the statutory road-context phrase is not safely settled. The prior batch-21 note recorded 145 question contexts (47 `abitato`, 98 `abitati`); this batch checked representative records, not a second exhaustive pass.

### `delineatore`

The row remains `المُعَيِّن`, `machine_draft_needs_review`, `review_required: 1`. ACI [Article 42](https://aci.gov.it/codice-della-strada/art-42/) describes complementary signs that reveal road layout, curves, critical points and obstacles. The [implementing regulation’s Article 174 transcription](https://www.patente.it/normativa/articolo-174-regolamento?idc=678) lists different delineator types and uses; this is a secondary-hosted transcription, not an official government-hosted source. An Arabic commercial description uses `محددات الطريق`, but that does not establish a one-to-one legal equivalent. The representative question renderings `المحدد الظاهر` in Q21946–Q21947 were left unchanged as descriptive phrases. The prior batch-20 note records 57 distinct contexts; this batch did not repeat that full review.

## Validation and coverage limits

- Field-by-field comparison to the pre-batch commit confirmed that only `ar` changed for Q22497, Q22730, Q22745 and Q24666 in each paired question file; all 7,020 Italian records and answer keys remain unchanged.
- The batch-21 untouched-field regression baseline was adjusted to exclude the four IDs now independently asserted by the batch-22 test. This addresses a stale cross-batch hash expectation; the batch-22 test pins the four new translations and preserves the Italian and answer fields.
- `npm test` completed the PWA build and passed **168/168** tests. PWA remains v66; bundle SHA-256 is `e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685`.
- The 7,020-question bank SHA-256 is `72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0`. The similar-question index and PWA release metadata match it; the index remains 453 groups, 1,093 grouped questions and 1,251 accepted pairs.
- No dictionary row changed, so the SQLite asset was not rebuilt. Its 5,336 rows match the JSON fields exactly; `PRAGMA integrity_check` returned `ok`. Database SHA-256 remains `5d1b0bf1f5e904707a780d9de4ad695aa296d4bc5c29ed39012a8e9067ace560`; dictionary JSON SHA-256 remains `e48821b1c8b12e1e09dacddb4b5377d5e13cf1fd6d8750356dbe63768cb8e733`.
- The official [Ministry quiz PDF](https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650) was opened by the reviewers, but text extraction returned encoded PDF data, so it is not treated as independent readable verification of these question rows.
- The Copilot CLI was not installed in the environment. The connector offered an interactive installation prompt that did not respond to input; the prompt process was stopped and no Copilot review was completed. No paid tool was used.
- This is a data/PWA build and test result only. No Android package build or device-runtime test was performed.
