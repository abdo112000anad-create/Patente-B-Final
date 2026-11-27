# Patente B Italian–Arabic Content Audit — Batch 21

**The audit remains incomplete.** This bounded batch reviewed 145 question contexts for `abitato`/`abitati` and six reported question-translation issues. It fixes Arabic wording in 15 question records only. No Italian text or VERO/FALSO answer changed.

## `abitato` remains flagged

The supplied family review covered 47 `abitato` contexts and 98 `abitati` contexts, with no lesson matches. The dictionary entry stays `مأهول`, `status: machine_draft_needs_review`, `review_required: 1`.

[Treccani’s entry for *abitato*](https://www.treccani.it/vocabolario/abitato/) distinguishes the adjective “populated/inhabited” from the substantive sense of a built-up place, including a speed-limit example. An opened [Italian–Arabic dictionary page](http://dizionario-arabo-italiano.blogspot.com/) lists both `مأهول بالسكان` and `مجمع سكاني`, but it is not an authoritative legal-translation source. The [Gazzetta Ufficiale code landing page](https://www.gazzettaufficiale.it/dettaglio/codici/strada/46_0_1) did not expose the relevant Article 3 definition in the opened text. `مأهول` is supported as an adjectival sense, but not as a safe, complete rendering for the road-context family `centro abitato`/`centri abitati`. No question-level `abitato` wording was changed.

## Corrected question translations

**`carreggiata` — Q22513–Q22520, Q21946–Q21947 and Q22829.** The untranslated or misspelled token was replaced with **`الجزء المخصص لسير المركبات من الطريق`** (“the part of the road designated for vehicle movement”). [ACI Article 3](https://www.aci.it/fileadmin/cds/art-3.php) defines `carreggiata` as the part of the road intended for vehicle movement and says it consists of one or more `corsie`; a `corsia` is defined separately. [Cambridge’s English–Arabic entry for *carriageway*](https://dictionary.cambridge.org/dictionary/english-arabic/carriageway) corroborates the Arabic semantic direction, but is not direct Italian–Arabic evidence. The Arabic phrase is descriptive and follows ACI’s definition. The existing `delineatore` Arabic in Q21946–Q21947 (`المحدد الظاهر`) and the existing `centro abitato` rendering in Q22513–Q22520 (`في منطقة مأهولة`) were left unchanged.

**`senso unico` — Q22829.** Rendered as **`على طريقٍ ذي اتجاهٍ واحد`**. The opened [Italian–Arabic examples for *senso unico*](https://context.reverso.net/translation/italian-arabic/senso+unico) support “one-way”; a [Ministry road-safety question PDF](https://www.mit.gov.it/sites/default/files/media/basic/2016-02/Sicurezza_Stradale_Comune_Nazionale__CHN_.pdf) uses `strade a senso unico` in a road-rules context. This is a translation decision, not a new legal interpretation.

**`sorpassato` — Q21876.** The Arabic verb meaning “take a risk” was replaced with wording that means the vehicle must be overtaken: **`الجهة التي يجب أن يتمّ من خلالها تجاوز المركبة التي وُضعت عليها`**. [ACI Article 148](https://www.aci.it/fileadmin/cds/art-148.php) defines the traffic maneuver as passing/overtaking; [Reverso](https://context.reverso.net/translation/italian-arabic/sorpassare) and [Arabdict](https://www.arabdict.com/en/italian-arabic/%D8%AA%D8%AC%D8%A7%D9%88%D8%B2+عن) support the Arabic `تجاوز` sense. The official [question-list PDF](https://www.ilportaledellautomobilista.it/documents/56611/85457073/DomandeAM.pdf/112daa18-5efc-441d-8c15-640556a28ef4) was opened, but its extracted text was binary; the statement was matched in search-indexed text, so that PDF is not treated as a readable transcription.

**Mechanical `giochi` — Q24128.** Replaced `طقوسًا` (“rituals”) with **`خلوص ميكانيكي`** (“mechanical clearance/play”). [Treccani’s physical-sciences entry](https://www.treccani.it/enciclopedia/gioco_(Dizionario-delle-Scienze-Fisiche)/) describes the mechanical sense as a small space between parts; [Almaany](https://www.almaany.com/en/dict/ar-en/clearances/) gives `خلوص` for mechanical clearances with automotive examples. A [Ministry technical-inspection PDF](https://www.mit.gov.it/sites/default/files/media/basic/2016-02/Norme_Tecniche_Comune_Nazionale__CGN_.pdf) also uses `giochi` for vehicle-mechanism play, but its cited example concerns steering, not towing components specifically.

**`ROTATORIA` — Q20288.** Replaced the untranslated word with **`دوّار`** in the traffic-sign sentence. The official [Italian quiz PDF](https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650) establishes the traffic context; opened [Italian–Arabic examples for *rotatoria*](https://context.reverso.net/traduzione/italiano-arabo/rotatoria) use `دوار` for traffic roundabouts.

**`ripartendo` — Q22712.** Replaced “withdrawing” with **`الانطلاق مجددًا`** (“setting off again”). [Treccani](https://www.treccani.it/vocabolario/ripartire2/) and [De Mauro](https://dizionario.internazionale.it/parola/ripartire) define `ripartire` as setting off or getting moving again; [Reverso](https://dictionary.reverso.net/italian-arabic/ripartire) lists `الانطلاق`.

All 15 edits were made to the Arabic field in both paired question files. The official Italian wording and answer keys were preserved.

## Still open

The preferred Arabic road-context rendering for the `abitato` family is unresolved, and its flag remains. `delineatore` also remains flagged; Q21946–Q21947 only had their `carreggiata` wording fixed. Q22730, Q22745, Q24666 and Q22497 from the batch-20 list were not reviewed here. No broader context audit was inferred for `senso unico`, `rotatoria`, `giochi` or `ripartire` from these individual question reviews.

## Build and test results

- **Dictionary:** 5,336 entries. All 5,336 JSON rows matched SQLite field-by-field; SQLite integrity check returned `ok`. Regeneration changed only dictionary JSON `generated_at_utc`; entries remained identical. `abitato` remains flagged.
- **Question bank:** 7,020 questions; SHA-256 `df5e724a954057737f9f8775aec38735bcbc20f24a899a22d71e673ab6ef43dd`. The similar-groups index and PWA release metadata match it. The index remains 453 groups, 1,093 grouped questions and 1,251 accepted pairs; only its source fingerprint changed.
- **PWA and tests:** PWA v66 build succeeded; bundle SHA-256 `e4d827dfa7fd305ffaafd80a3386e546a8a29cd4fbc6836b4b4506e93a45e685`. Focused batch-20/batch-21 tests: 7 passed, 0 failed. Full `npm test` (including a fresh PWA build): 165 passed, 0 failed.
- **Generated hashes:** dictionary JSON `e48821b1c8b12e1e09dacddb4b5377d5e13cf1fd6d8750356dbe63768cb8e733`; SQLite `5d1b0bf1f5e904707a780d9de4ad695aa296d4bc5c29ed39012a8e9067ace560`.
- This was a content/data audit; no Android package build or device-runtime test was performed.
