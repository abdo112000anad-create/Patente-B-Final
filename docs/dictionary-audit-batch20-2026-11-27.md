# Patente B Dictionary and Arabic Content Audit — Batch 20

**The audit remains incomplete.** This batch records ten source-supported dictionary corrections and sixteen Arabic question-text fixes on `audit/v67-dictionary-quality`. Ambiguous terms and the separate question-level findings below remain unresolved. `main` was not modified or merged.

## Dictionary decisions

Ten flagged glosses were corrected. These are project-reviewed contextual decisions, not owner-approved legal translations:

- **`spazi`** — `فراغ` → **أماكن، مساحات**. The reviewed uses mean allocated places or areas (parking bays, stops, accessible spaces and similar), not an empty void. Evidence: [Reverso](https://dictionary.reverso.net/italian-arabic/spazio), [Glosbe](https://glosbe.com/it/ar/spazio), [Treccani](https://www.treccani.it/vocabolario/spazio/).
- **`sorpassato`** — `قديم` → **المركبة التي تمّ تجاوزها؛ قديم / متقادِم (للوصف)**. The question bank mostly uses the participle for the vehicle being overtaken, with a few ordinary “outdated” uses. Evidence: [Reverso Context](https://context.reverso.net/الترجمة/الإيطالية-العربية/e+sorpassati), [Treccani](https://www.treccani.it/vocabolario/sorpassare/), [Cambridge](https://dictionary.cambridge.org/us/dictionary/italian-english/sorpassato).
- **`possono`** — `يمكنهم` → **يمكن / قد**. The app uses both possibility and ability/permission; a fixed “they can” subject does not fit all sentences. Evidence: [Reverso Context](https://context.reverso.net/translation/italian-arabic/possono), [Treccani: potere](https://www.treccani.it/vocabolario/potere-2/).
- **`devono`** — `يجب عليهم ذلك` → **يجب أن / يجب على**. The broader forms fit both explicit and impersonal obligations without adding a fixed subject or object. Evidence: [Reverso](https://dizionario.reverso.net/italiano-arabo/dovere), [Treccani: dovere](https://www.treccani.it/vocabolario/dovere/).
- **`autovetture`** — `السيارات` → **سيارات الركوب**. All reviewed uses refer to the passenger-car category, narrower than “vehicles” generally. Evidence: [Reverso Context](https://context.reverso.net/الترجمة/العربية-الإيطالية/سيارات+الركوب), [Treccani](https://www.treccani.it/vocabolario/autovettura/), [Glosbe](https://it.glosbe.com/ar/it/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A9).
- **`comporta`** — `تَنْشِئُ` → **ينطوي على؛ يستلزم / يقتضي؛ يترتب عليه / يؤدي إلى**. The reviewed contexts include requirements and consequences, such as penalties or risks. Evidence: [Reverso Context](https://context.reverso.net/traduzione/italiano-arabo/comporta), [Treccani](https://www.treccani.it/vocabolario/comportare/).
- **`massima`** — `الأقصى` → **أقصى / قصوى؛ الحدّ الأقصى**. The adjective is used mainly for upper limits (speed, mass, dimensions and time) and for maximum caution. Evidence: [Reverso Context: velocità massima](https://context.reverso.net/translation/italian-arabic/velocit%C3%A0+massima), [Treccani](https://www.treccani.it/vocabolario/massima1/).
- **`norma`** — `عادي` → **قاعدة؛ عادةً (في di norma)**. Both the noun “rule” and the frequent phrase `di norma` (“usually/as a rule”) occur. Evidence: [Reverso](https://dizionario.reverso.net/italiano-arabo/norma), [Reverso Context: di norma](https://context.reverso.net/الترجمة/الإيطالية-العربية/di+norma+non), [Treccani](https://www.treccani.it/vocabolario/norma/).
- **`passare`** — `مرور` → **يمرّ / يعبر (بحسب السياق)**. The app uses the verb for passing through, past or around something and for proceeding in turn. Evidence: [Reverso Context](https://context.reverso.net/translation/italian-arabic/passare), [Treccani](https://www.treccani.it/vocabolario/passare/), [Corriere](https://dizionari.corriere.it/dizionario_italiano/P/passare.shtml).
- **`prossimità`** — `اقترب` → **قُرب؛ بالقرب من**. The reviewed contexts are spatial, especially the phrase `in prossimità di`. Evidence: [Reverso Context](https://context.reverso.net/traduzione/italiano-arabo/prossimit%C3%A0), [Treccani](https://www.treccani.it/vocabolario/prossimita/).

`abitato` remains flagged with its existing gloss `مأهول`. The 47 exact-form contexts were inspected, but 98 additional `abitati` contexts in the same family were not reviewed, so no confirmation credit or flag clearance was applied. `delineatore` also remains flagged with its existing gloss `المُعَيِّن`: its 57 question contexts span different marker types and no direct bilingual evidence justified a safe general replacement.

The current generated dictionary records **80 unchanged-gloss confirmations** from earlier batches; batch 20 adds no confirmations.

## Arabic question-text fixes

Sixteen question IDs were corrected in both paired JSON datasets: **Q23722, Q23725, Q23481, Q23524, Q23570, Q23573, Q23578, Q23583, Q23584, Q23968, Q24012, Q24471, Q24472, Q22512, Q24800 and Q24801**. The edits correct parking-place wording, distinguish the vehicle being overtaken, clarify modality/polarity, fix license-plate wording and improve the rail-crossing and two-wheeler sentences. They change Arabic text only; Italian wording and `VERO`/`FALSO` answers were preserved.

A semantic comparison against the base commit found exactly those sixteen Arabic-field changes in each dataset, with every other question field unchanged. The full Italian-text/answer projection remains at SHA-256 `11a4b7a72f3a1a18887434c947cc6090e4de34d4b8f67132377f89d918546e4d`. The official Italian question corpus is the [Ministry PDF](https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650), linked from the [Portale dell’Automobilista quiz page](https://www.ilportaledellautomobilista.it/web/portale-automobilista/-/quiz-per-le-patenti-am-b-superiori-e-cqc). No Italian legal question or answer key was changed.

## Other question findings not changed in this batch

These reviewer-reported issues are separate from the sixteen edits above and remain to be assessed:

- **Q22513–Q22520:** `carreggiata` remains untranslated in the Arabic text.
- **Q22730:** pedestrian-priority and warning-horn wording needs a clearer Arabic review; **Q22745:** the procession sentence’s “pass/overtake or interrupt it” wording needs an idiomatic review.
- **Q21876:** `sorpassato` is rendered as taking a risk rather than being overtaken. **Q24128:** mechanical `giochi` is rendered as “rituals.”
- **Q20288:** `ROTATORIA` remains in Italian. **Q22829:** both `senso unico` and `carreggiata` remain in Italian.
- **Q22712:** `ripartendo` is rendered as “withdrawing” rather than setting off again. **Q24666:** `passo carrabile` remains in parentheses and its Arabic rendering needs review.
- **Q22497:** the Arabic phrase corresponding to moderating speed has a grammar/agreement problem.
- **Q21946–Q21947:** `carreggiata` remains untranslated; these contexts also illustrate why `delineatore` was kept flagged.

No entry or question from this remaining-findings list was silently treated as fixed.

## Coverage

The exact-token shortlist was selected from 7,020 paired questions and 50 lesson records. Coverage totals below are per reviewed term; a question can contribute to more than one term:

| Term | Question tokens / distinct question contexts | Lesson occurrences / records |
|---|---:|---:|
| `abitato` | 47 / 47 | 0 / 0 |
| `spazi` | 19 / 18 | 0 / 0 |
| `sorpassato` | 13 / 13 | 0 / 0 |
| `possono` | 203 / 202 | 18 / 13 |
| `devono` | 133 / 132 | 6 / 5 |
| `autovetture` | 76 / 76 | 1 / 1 |
| `comporta` | 74 / 72 | 0 / 0 |
| `massima` | 69 / 67 | 4 / 1 |
| `norma` | 67 / 67 | 1 / 1 |
| `passare` | 66 / 66 | 1 / 1 |
| `prossimità` | 66 / 66 | 1 / 1 |
| `delineatore` | 57 / 57 | 0 / 0 |
| **Total term-context counts** | **890 / 883** | **32 / 23** |

## Regenerated data and validation

The dictionary still has **5,336 entries**. Current metadata reports **5,112 review-required entries**, **61** contextual corrections, and **80** contextual gloss confirmations. Status counts are 5,069 machine drafts, 33 legacy drafts, 8 v49 contextual overrides, 2 contextual candidates, and 224 reviewed overrides. Its historical 7,020-question source hash remains `0b092118291a1e2d08f8a6c39cc2d80bb4cd3341830b09a359e07a698f7bd45d`; the current PWA fingerprint is separate.

The regenerated SQLite database contains 5,336 rows; an explicit field-by-field comparison matched every JSON entry to its SQLite row, and `PRAGMA integrity_check` returned `ok`.

- Dictionary JSON SHA-256: `775e2ce022601854e74fa93b5c34528518b5d4112ba598da07b6c223916e3c47`
- SQLite SHA-256: `5d1b0bf1f5e904707a780d9de4ad695aa296d4bc5c29ed39012a8e9067ace560`
- Current question-bank SHA-256: `2c5603f18f5043dbdd7ba956e0fabbc9e903f316deca2ed8955c0bf7d5f21302`; both `similar-groups.json` and PWA release metadata match it, with similarity groups otherwise unchanged.
- PWA v66 build succeeded; bundle SHA-256: `e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685`.
- Focused batch-11–20/dictionary tests: **36 passed, 0 failed**. Final full `npm test` (including a fresh PWA build): **162 passed, 0 failed**.
- No Android runtime/device test or Android package build was performed for this content-audit batch. Local test success is not a GitHub Actions result; the remote run for the pushed commit must be checked separately.

The work is on `audit/v67-dictionary-quality`; `main` was not changed or merged. The audit remains open for the flagged dictionary families and question findings listed above.
