# Patente B Italian–Arabic Dictionary Audit — Batch 25

**Outcome:** Two high-confidence glosses were corrected, and one safer `extraurbane` wording was added only as a provisional candidate that remains flagged. No Italian question wording, Arabic question wording, or answer key was changed. This is a bounded audit batch, not a complete dictionary review.

## Corrected glosses

- **`integrativo` → `تكميلي`** — All 190 exact question-token occurrences were reviewed across 190 paired question records, plus 3 lesson-text tokens in `u2-l4`. In 189 question records the word is in *pannello integrativo*; the only other use is Q24536, *esame teorico integrativo*. Article 83 of [D.P.R. 495/1992 in the Gazzetta Ufficiale](https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=1&art.idGruppo=12&art.flagTipoArticolo=0&art.codiceRedazionale=092G0531&art.idArticolo=83&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=1992-12-28&art.progressivo=0) describes supplementary panels as adding or clarifying information and specifying a sign’s scope. [Treccani](https://www.treccani.it/vocabolario/integrativo/) defines *integrativo* as something added to integrate or complete, and includes *esame integrativo*. The paired app Arabic uses `تكميلي` and related “supplementary” forms. The previous `متكامل` (“integrated/complete”) did not fit these contexts.

- **`tratto` → `جزء من الطريق؛ وقد تعني «مسافة/امتدادًا» بحسب السياق`** — All 131 exact question-token occurrences were reviewed across 131 records; no lesson token matched. Most describe a part or stretch of road (*tratto di strada*, including named road sections), while constructions such as *per un tratto sufficiente* mean a distance or extent. [Treccani](https://www.treccani.it/vocabolario/tratto2/) gives both the road-portion and extended distance senses. [ACI Article 3](https://aci.gov.it/codice-della-strada/art-3/) uses *tratto di strada* in official road definitions. [Al-Maany’s Arabic entries for `جزء`](https://www.almaany.com/ar/dict/ar-ar/%D8%AC%D8%B2%D8%A1/) and [`المسافة`](https://www.almaany.com/ar/dict/ar-ar/%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%A9/) support the two Arabic senses. The old `السّنة` (“the year”) was unrelated.

These are project-reviewed dictionary overrides, not owner-approved translations.

## Still flagged

- **`extraurbane`** — All 135 exact question contexts and 3 lesson tokens in `u6-l5` were reviewed. [ACI Article 3](https://aci.gov.it/codice-della-strada/art-3/) defines a *strada extraurbana* as a road outside a legally delimited *centro abitato*; [Treccani](https://www.treccani.it/vocabolario/extraurbano/) describes *extraurbano* as outside a city or urban perimeter. The paired Arabic questions predominantly use `خارج المناطق المأهولة`; Reverso’s [Italian–Arabic examples](https://dizionario.reverso.net/italiano-arabo/extraurbano) also show out-of-city/suburban senses, but neither source establishes the exact Arabic equivalent of Italy’s statutory boundary. The prior machine draft `خارج البلاد` (“outside the country”) is not endorsed. The app dictionary now carries `خارج المناطق المأهولة` only as a **provisional candidate** with `review_required=1`; retain the review flag until a directly applicable Arabic road-terminology source resolves the legal nuance.
- **`guida`** remains unchanged and flagged as the machine draft `مرشد`. It has many app occurrences and can mean guidance, driving, or a guide depending on context; the full set was not audited in this batch, so no safe global gloss is asserted.

## Validation evidence

The builder compiled and regenerated both the lookup JSON and SQLite asset. The database has 5,336 rows, `PRAGMA integrity_check` returns `ok`, and there are no empty Arabic translations. JSON status totals are 5,063 machine drafts, 33 legacy drafts, 8 contextual overrides, 229 reviewed overrides, and 3 flagged candidates (5,107 entries still require review). The corrections total 66 project-reviewed contextual changes; they are not owner-approved.

- Lookup JSON SHA-256: `71e4f3ee67d5184bc539107de45822e8dd84e211b767c7d1e2d21208a1d78390`.
- SQLite SHA-256: `bc8bd73b86a4c12c8ae55b679095c1470c5d82c654feb3f91db9832ebfc4a98e`.
- Paired question files are unchanged: Arabic SHA-256 `72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0`; Italian SHA-256 `4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada`. Batch-25 tests compare all 7,020 IDs and confirm Italian wording, Arabic wording, and answer keys remain paired.
- Focused dictionary regressions: 40/40 passed. Full `npm test` (including PWA build): 177/177 passed. PWA v66 bundle SHA-256: `e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685`; release metadata tracks the regenerated dictionary hash.
- `git diff --check` passed. No Android device/runtime test was performed; this audit makes no device-testing claim.
