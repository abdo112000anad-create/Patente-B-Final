# Patente B Italian–Arabic Content Audit — Batch 23

**Outcome:** Q24666’s licence-points claim is now checked against the Ministry’s posted Article 126-bis table. Its existing **FALSO** answer is supported. No question text, answer key, dictionary entry, or generated data was changed. `abitato` and `delineatore` remain flagged because the available Arabic-source evidence does not establish safe equivalents for the Italian legal/technical terms.

## Q24666 — *passo carrabile* and licence points

The statement is: “Lasciare in sosta l'auto davanti a un passo carrabile comporta una perdita di punti sulla patente.” The existing answer is **FALSO** in both paired question files.

The official [Gazzetta Ufficiale text of Article 126-bis](https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=12&art.idGruppo=10&art.flagTipoArticolo=0&art.codiceRedazionale=092G0306&art.idArticolo=126&art.idSottoArticolo=2&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=1992-05-18&art.progressivo=0) says deductions follow the attached table. The [Ministry’s Portale dell’Automobilista Code page and points table](https://www.ilportaledellautomobilista.it/web/portale-automobilista/codice-della-strada) lists Article 158, paragraph 2, **letters d), g) and h)** for 2 points; letter **a)** is not listed. [ACI Article 158](https://aci.gov.it/codice-della-strada/art-158/) identifies paragraph 2(a) as parking at the exit of a vehicle-access entrance, and [ACI Article 3](https://aci.gov.it/codice-della-strada/art-3/) defines *passo carrabile* as access to a side area suitable for one or more vehicles to stop.

Thus the violation in Q24666 is not one of the Article 158(2) point-bearing cases in the posted table; the existing **FALSO** key is consistent with the evidence. The Arabic wording introduced in batch 22 remains unchanged. The Ministry portal notes that its code text is informational and that the printed Gazzetta Ufficiale text prevails; its displayed points table is labeled as updated with changes through 2010. No conflicting official table entry was found.

## Arabic terminology flags

### `abitato`

The entry remains `مأهول`, `status: machine_draft_needs_review`, `review_required: 1`. ACI’s [Article 3 definition of *centro abitato*](https://aci.gov.it/codice-della-strada/art-3/) is specific: a grouping of at least 25 buildings, with public-use areas and vehicle or pedestrian access to the road, delimited by beginning/end signs. The [UNECE agreements index](https://unece.org/road-traffic-and-road-signs-and-signals-agreements-and-conventions) lists an Arabic version of the 2006 consolidated Convention on Road Signs and Signals. However, extraction from its [Arabic PDF](https://unece.org/DAM/trans/conventn/Conv_road_signs_2006v_AR.pdf) corrupts the Arabic characters, and the local environment’s direct PDF download was blocked. I therefore could not verify the exact Arabic wording. Even if the Convention’s “built-up area” term were recovered, its international sign-defined concept cannot automatically be treated as identical to Italy’s statutory *centro abitato*. No question wording or gloss was changed on this basis.

### `delineatore`

The entry remains `المُعَيِّن`, `status: machine_draft_needs_review`, `review_required: 1`. The UNECE Arabic PDF’s extraction is not readable enough to verify any exact label for guide posts, edge markers, or obstacle markers, and the Convention’s device categories do not establish a one-to-one equivalent for the Italian term’s varied uses. The [Saudi Highway Code SHC 602 manual PDF](https://istitlaa.scbc.gov.sa/ar/transportation/mot/saudihighwaycode/Documents/SHC%20602%20final.pdf), despite being hosted under an Arabic-language government page, is an English-language manual; it does not supply Arabic terminology evidence. The current descriptive wording in Q21946–Q21947 is left unchanged, and the dictionary flag remains open.

## Previously documented question-text findings

The reported Arabic text corrections from batches 20–22 are present in both 7,020-question datasets. Checks of the paired records found their Italian text and answer keys equal across the two files, including Q24666. Existing tests explicitly pin the batch-20, batch-21, and batch-22 corrections and preserve the reviewed answers. No earlier question-text finding was found still awaiting a supported Arabic correction. The unresolved `abitato` and `delineatore` terminology flags are kept separate from those completed question-level fixes.

## Validation and limits

- This batch changes documentation only; question data, dictionary JSON/SQLite, the question-bank fingerprint, similarity index, and PWA release metadata are unchanged.
- `npm test` succeeded: PWA v66 built successfully with bundle SHA-256 `e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685`; the full suite passed **168/168**, 0 failed.
- `data/questions.json` SHA-256 remains `72ef279a39e86104f51c6fce94d06b5a1d86121db4659b37c58437f9dc4842b0`; paired `data/questions.it.json` SHA-256 is `4f2076b4096a6d48319d4a1f33df3541398ea03aed304ce80a1916178c572ada`.
- Dictionary JSON remains 5,336 rows, SHA-256 `e48821b1c8b12e1e09dacddb4b5377d5e13cf1fd6d8750356dbe63768cb8e733`. The existing SQLite asset remains 5,336 dictionary rows, SHA-256 `5d1b0bf1f5e904707a780d9de4ad695aa296d4bc5c29ed39012a8e9067ace560`; `PRAGMA integrity_check` returned `ok`. No database rebuild was needed.
- `git diff --check` passed. No Android package build or device-runtime test was performed.
