# Patente B Dictionary and Arabic Content Audit — Batch 19

**The audit remains incomplete.** Batch 19 integrates only the reviewed, evidence-backed changes on `audit/v67-dictionary-quality`; ambiguous entries remain flagged, and no change was made to `main`.

## Decisions and changes

Three contextual dictionary glosses were corrected: `trova` → `يوجد / يقع (في صيغة si trova)`, `preavvisa` → `يُنبّه مسبقًا / يُشير مسبقًا إلى`, and `indossare` → `ارتداء`. Three existing glosses were confirmed unchanged: `vietata` → `ممنوع`, `proseguire` → `تابع`, and `tonnellate` → `أطنان`.

Five terms remain flagged because the reviewed contexts do not support one safe, universal gloss: `unico`, `fine`, `rappresentata`, `usare`, and `svolta`. The reviewer notes for `rappresentata` conflicted between the decision label and rationale; the conservative choice was to keep it flagged.

The question-bank Arabic was corrected for Q21582, Q23850, and Q24015 in both paired JSON datasets. Q21582 now translates `ATTRAVERSAMENTO PEDONALE` as `معبر للمشاة`; Q23850 corrects `إزالة` to `ارتداء`; Q24015 now translates the stopping condition and `centri abitati` as populated areas. The Italian text and `VERO`/`FALSO` answers were preserved. A full semantic comparison found no question changes beyond the Arabic fields for those three IDs.

`indossare` was reviewed across 18 lemma-family tokens in 17 paired question records: `indossare` (10), `indossato` (3), `indossando` (1), `indossate` (2), and `indossa` (2). The contexts support the infinitive gloss `ارتداء` and the corresponding forms `يرتدي`. Two additional `indossato` occurrences were verified in lesson `u7-l5`—one in `summaryIt` and one in `quickChecks[2].qIt`.

## Evidence

- `trova`: [Reverso Context](https://context.reverso.net/traduzione/italiano-arabo/si+trova), [Glosbe](https://glosbe.com/it/ar/trovare), and [Treccani](https://www.treccani.it/vocabolario/trovare/).
- `preavvisa`: [Reverso Context](https://context.reverso.net/traduzione/italiano-arabo/preavviso) and [Treccani](https://www.treccani.it/vocabolario/preavvisare/).
- `indossare`: [Reverso Context](https://context.reverso.net/traduzione/italiano-arabo/indossare), [Glosbe](https://it.glosbe.com/it/ar/indossare), and the [official Italian question corpus](https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650).
- Confirmations: `vietata` ([Reverso](https://context.reverso.net/traduzione/italiano-arabo/vietata), [Treccani](https://www.treccani.it/vocabolario/vietare/)); `proseguire` ([Reverso](https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/proseguire), [Treccani](https://www.treccani.it/vocabolario/proseguire/)); `tonnellate` ([Reverso](https://context.reverso.net/traduzione/italiano-arabo/tonnellata), [Treccani](https://www.treccani.it/vocabolario/tonnellata/)).
- Q24015: [Reverso Context for `centro abitato`](https://context.reverso.net/traduzione/italiano-arabo/centro+abitato) gives `منطقة مأهولة بالسكان`; [Treccani](https://www.treccani.it/vocabolario/abitato/) defines `abitato` as populated/inhabited.
- Q21582: [Reverso Context for `attraversamento pedonale`](https://context.reverso.net/traduzione/italiano-arabo/attraversamento+pedonale) supports `معبر` and `ممر المشاة`. [ACI Article 39](https://aci.gov.it/codice-della-strada/art-39/) explains that danger signs pre-announce hazards, but does not name this particular sign; no legal answer was changed.
- Terms left ambiguous: `unico` ([Reverso](https://context.reverso.net/traduzione/italiano-arabo/a+senso+unico), [Treccani](https://www.treccani.it/vocabolario/unico/)); `fine` ([Reverso](https://dizionario.reverso.net/italiano-arabo/fine), [Treccani fine3](https://www.treccani.it/vocabolario/fine3/), [Treccani fine1](https://www.treccani.it/vocabolario/fine1/)); `rappresentata` ([Glosbe](https://ar.glosbe.com/it/ar/rappresentata), [Treccani](https://www.treccani.it/vocabolario/rappresentare/)); `usare` ([Reverso](https://context.reverso.net/traduzione/italiano-arabo/usare), [Treccani](https://www.treccani.it/vocabolario/usare/)); `svolta` ([Reverso](https://context.reverso.net/traduzione/italiano-arabo/svolta), [Treccani](https://www.treccani.it/vocabolario/svolta/)).

## Coverage and unfinished review

The ten originally planned terms cover 918 question-token occurrences across 913 distinct paired question contexts, plus seven lesson-text occurrences in seven lesson records (`proseguire`: two occurrences in two records; `usare`: five in five). The `indossare` lemma-family review adds 18 question tokens across 17 paired records and the two lesson occurrences in `u7-l5`.

The broader dictionary entry `abitato` remains flagged. A morphological scan found 145 question contexts (47 `abitato`, 98 `abitati`); that complete set was not reviewed in this batch. Only the phrase in Q24015 was corrected, so the dictionary headword was not marked reviewed. The other flagged terms listed above also remain unresolved.

The branch dictionary now reports 5,122 review-required entries, 51 contextual corrections, and 80 unchanged confirmations. The previous branch count of 5,128 is reduced by the six batch-19 decisions; this reconciles the generated total with the earlier branch summary. The historical dictionary source hash remains `0b092118291a1e2d08f8a6c39cc2d80bb4cd3341830b09a359e07a698f7bd45d` for its original 7,020-question source. It was intentionally preserved; the current PWA question-bank fingerprint is separate.

## Generated outputs and validation

The dictionary JSON contains 5,336 entries. Status counts are 5,079 machine drafts, 33 legacy drafts, 8 v49 contextual overrides, 2 contextual candidates, and 214 reviewed overrides. There are 5,122 review-required entries; metadata records one entry without a lexical translation. The generated SQLite database contains 5,336 rows and reports `PRAGMA integrity_check = ok`; JSON/SQLite row parity was verified. The SQLite SHA-256 is `ac5deab6f96a090c6f30362b6622fe50914ecb62c41a4ac18af9b4595e0a4b86`; dictionary JSON SHA-256 is `36784927270bdf9f35fbc64e1399dd45d2f8ec66ab150e72535243671dbb4bda`.

The PWA build succeeded for v66. Its bundle SHA-256 is `e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685`. The current question-bank file, the PWA release metadata, and `similar-groups.json` all use question-bank SHA-256 `8d9ae98c2e4266ee8648530865d5c211a8a24cbf483e9f9aa097f3f5e369cd1f`; only the stale fingerprint field in the similar-groups index was refreshed, with group data unchanged.

- Focused batch 11–19 and schema-migration tests: **26 passed, 0 failed**.
- Full `npm test` (including the PWA build and all `tests/*.test.cjs`): **158 passed, 0 failed**.
- No Android runtime/device test or Android package build was performed for this batch.
- GitHub Actions run [45910301976](https://github.com/abdo112000anad-create/Patente-B-Final/actions/runs/45910301976) succeeded for the prior base commit `6700055db44e62cc9f6f5e2a36d8412240c552c8`; it is **not** a run for this batch-19 change set. The new commit's Actions status must be checked after pushing.
