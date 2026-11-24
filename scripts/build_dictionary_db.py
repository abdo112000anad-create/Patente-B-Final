#!/usr/bin/env python3
"""Build the v62 SQLite dictionary and its matching JSON lookup."""
from __future__ import annotations
import hashlib
import json
import os
import sqlite3
import tempfile
import unicodedata
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_PATH = ROOT / "data/italian_arabic_dictionary_lookup.json"
DB_PATH = ROOT / "android/app/src/main/assets/dictionary.db"
APP_VERSION = 62
EXPECTED_WORD_COUNT = 5335

# User-requested standalone lemma, kept separate from question-bank extraction.
REQUESTED_LEMMA_ADDITIONS = {
    "riconoscere": (
        "يتعرف على",
        "lexical_translation",
        "المعنى المعجمي الذي طلب المستخدم إضافته.",
    ),
    "spiegazione": (
        "شرح / تفسير",
        "lexical_translation",
        "ترجمة معجمية أضافها المستخدم بطلبه.",
    ),
    "distingue": (
        "يميز / يفرق",
        "lexical_translation",
        "صيغة الفعل التي تظهر في درس أنواع المركبات، أُضيفت بطلب المستخدم.",
    ),
    "distinguere": (
        "يميز / يفرق",
        "lexical_translation",
        "مصدر الفعل في درس أنواع المركبات، أُضيف بطلب المستخدم.",
    ),
}
REQUESTED_LEMMA_SOURCES = {
    "riconoscere": "user-requested-lemma-v47",
    "spiegazione": "user-requested-lemma-v51",
    "distingue": "user-requested-lemma-v61",
    "distinguere": "user-requested-lemma-v61",
}
VIDEO_CONTEXT_ADDITIONS = {
    "forme": (
        "أشكال",
        "contextual_translation",
        "في عبارة الدرس عن أشكال إشارات المرور: forme e significati؛ المقصود الأشكال.",
    ),
    "offrono": (
        "توفّر / تقدّم",
        "contextual_translation",
        "في عبارة الدرس: i segnali di indicazione offrono informazioni utili؛ أي توفّر أو تقدّم معلومات مفيدة.",
    ),
    "concreto": (
        "المحدّد / الملموس",
        "contextual_translation",
        "في عبارة الدرس: il simbolo concreto؛ أي الرمز المحدّد الظاهر على الإشارة.",
    ),
}
VIDEO_CONTEXT_SOURCES = {word: "video-lesson-context-v54" for word in VIDEO_CONTEXT_ADDITIONS}
LESSON_DICTIONARY_ADDITIONS = {
    "appartengono": ("تنتمي / تندرج ضمن", "contextual_translation", "صيغة الجمع الواردة في درس فئات المركبات."),
    "appartenere": ("ينتمي إلى / يندرج ضمن", "lexical_translation", "مصدر appartengono في درس فئات المركبات."),
    "ignorare": ("يتجاهل", "contextual_translation", "مفردة أساسية في درسي الحذر وأعمال الطرق."),
    "aggiornamenti": ("تحديثات", "contextual_translation", "صيغة الجمع الواردة في درس التحقق من تحديثات القانون."),
    "aggiornamento": ("تحديث", "lexical_translation", "مصدر aggiornamenti في درس التحقق من تحديثات القانون."),
    "testo": ("نصّ", "contextual_translation", "النص القانوني الذي يُرجع إليه للتحقق من القاعدة النافذة."),
    "fonti": ("مصادر", "contextual_translation", "صيغة الجمع في عبارة المصادر الرسمية."),
    "fonte": ("مصدر", "lexical_translation", "مصدر fonti في درس التحقق من المعلومات الرسمية."),
    "ufficiali": ("رسمية", "contextual_translation", "صيغة الصفة في عبارة fonti ufficiali."),
    "ufficiale": ("رسمي", "lexical_translation", "مصدر ufficiali في درس مصادر المعلومات."),
    "pubblicazione": ("نشر / إصدار", "contextual_translation", "النشر الرسمي للقانون، كما في تاريخ النشر."),
    "coincide": ("يتطابق / يتزامن", "contextual_translation", "صيغة الفعل في مقارنة تاريخ النشر والنفاذ."),
    "coincidere": ("يتطابق / يتزامن", "lexical_translation", "مصدر coincide في درس تحديثات القانون."),
    "consultare": ("يراجع", "contextual_translation", "مراجعة النص القانوني النافذ."),
    "notizia": ("خبر", "contextual_translation", "خبر عام لا يُعد وحده دليلًا على تعديل القانون."),
    "gruppi": ("مجموعات", "contextual_translation", "صيغة الجمع في عنوان درس تصنيف الإشارات."),
    "gruppo": ("مجموعة", "lexical_translation", "مصدر gruppi في درس مجموعات الإشارات."),
    "prescrivono": ("تفرض / تُلزِم", "contextual_translation", "صيغة الجمع للأفعال التي تصف ما تفرضه إشارات الإلزام."),
    "prescrive": ("يفرض / يُلزِم", "contextual_translation", "تصحيح للمعنى الفعلي في سياق إشارة الإلزام؛ يستبدل المسودة غير المناسبة."),
    "prescrivere": ("يفرض / يُلزِم", "lexical_translation", "مصدر prescrive وprescrivono في درس أنواع الإشارات."),
    "sembra": ("يبدو", "contextual_translation", "صيغة الفعل في عبارة يبدو فيها الطريق خاليًا."),
    "sembrare": ("يبدو", "lexical_translation", "مصدر sembra في سؤال أولوية المرور."),
    "ambito": ("نطاق / مجال السريان", "contextual_translation", "المجال الذي تحدده اللوحة التكميلية."),
    "leggono": ("تُقرأ", "contextual_translation", "صيغة si leggono في شرح كيفية قراءة اللوحات التكميلية."),
    "leggere": ("يقرأ", "lexical_translation", "مصدر leggono في شرح قراءة اللوحات."),
    "interpretato": ("مُفسَّر", "contextual_translation", "صيغة اسم المفعول في va interpretato ضمن سؤال التحقق."),
    "interpretare": ("يفسّر", "lexical_translation", "مصدر interpretato في درس اللوحات التكميلية."),
    "organizzare": ("ينظّم", "contextual_translation", "وظيفة خطوط الطريق في تنظيم حركة المرور."),
    "prevalere": ("يسود / تكون له الأولوية على", "lexical_translation", "مصدر prevalgono في درس أولوية إشارات شرطي المرور."),
    "critici": ("حرجة / خطرة", "contextual_translation", "صيغة الجمع في عبارة punti critici."),
    "critico": ("حرِج / خطِر", "lexical_translation", "مصدر critici في درس الإشارات والعوائق."),
}
V62_LESSON_DICTIONARY_ADDITIONS = {
    "incrociarsi": ("تتقاطع مساراتها", "contextual_translation", "في درس التقاطعات: مسارات المركبات على وشك أن تتقاطع."),
    "traiettorie": ("مسارات المركبات", "contextual_translation", "في درس الأولوية عند تقاطع مسارات السير."),
    "utente": ("مستخدم للطريق", "lexical_translation", "المستخدم في سياق قواعد الطريق."),
    "vulnerabile": ("معرّض للخطر / ضعيف الحماية", "lexical_translation", "وصف مستخدمي الطريق الأكثر عرضة للإصابة، مثل المشاة وراكبي الدراجات."),
    "ambulanza": ("سيارة إسعاف", "lexical_translation", "مركبة طوارئ في أسئلة إفساح الطريق."),
    "emergenze": ("حالات الطوارئ", "contextual_translation", "صيغة الجمع في درس حارات الطوارئ ومركبات الإسعاف."),
    "urgente": ("عاجل", "contextual_translation", "في عبارة mezzo in servizio urgente: مركبة تؤدي خدمة عاجلة."),
    "angoli": ("زوايا", "contextual_translation", "صيغة الجمع في مصطلح angoli ciechi: الزوايا العمياء."),
    "ciechi": ("عمياء", "contextual_translation", "صيغة المذكر الجمع في مصطلح angoli ciechi: الزوايا العمياء."),
    "indicatore": ("إشارة الاتجاه", "contextual_translation", "في عبارة indicatore di direzione: إشارة الانعطاف/الاتجاه."),
    "meteo": ("الأحوال الجوية", "lexical_translation", "الطقس في سياق مسافة الأمان."),
    "sfavorevole": ("غير ملائم / سيئ", "contextual_translation", "وصف الأحوال الجوية التي تزيد خطر الطريق."),
    "avverse": ("غير ملائمة / قاسية", "contextual_translation", "صفة الجمع في عبارة condizioni avverse: ظروف جوية أو طريق غير ملائمة."),
    "allontanamento": ("الابتعاد", "lexical_translation", "إمكانية ابتعاد السائق عن المركبة تميز sosta عن fermata."),
    "immobilizzarlo": ("تثبيته ومنعه من الحركة", "contextual_translation", "في درس الوقوف على منحدر: منع المركبة من التحرك."),
    "disposizioni": ("أحكام / قواعد", "contextual_translation", "في عبارة salvo diverse disposizioni: ما لم تنص القواعد على خلاف ذلك."),
    "rotatoria": ("دوّار مروري", "contextual_translation", "المعنى في درس الدوارات؛ يصحح المسودة التي ترجمتها بمعنى الدوران."),
    "riservata": ("مخصّصة", "contextual_translation", "صفة مؤنثة في corsia riservata: حارة مخصصة."),
    "retrovisore": ("مرآة الرؤية الخلفية", "lexical_translation", "اسم المرآة التي تُستخدم لمراجعة الطريق خلف المركبة."),
    "morto": ("ميت؛ وفي angolo morto تعني أعمى", "contextual_translation", "في مصطلح angolo morto: زاوية عمياء أو موضع لا يظهر في مجال الرؤية."),
    "dosso": ("نتوء / مطب مرتفع", "lexical_translation", "نتوء أو قمة محدبة في الطريق، لا تعني الاتجاه إلى الأعلى."),
    "segnalazioni": ("إشارات / تنبيهات", "contextual_translation", "إشارات المرور أو تنبيهات مركبة الطوارئ، لا البلاغات."),
    "acustiche": ("صوتية", "contextual_translation", "صفة مؤنثة جمع في segnalazioni acustiche: تنبيهات صوتية."),
    "sicurezza": ("السلامة", "contextual_translation", "السلامة من الخطر في القيادة، لا الأمن بمعنى الحراسة."),
    "spazio": ("مساحة / حيّز متاح", "contextual_translation", "المساحة المتاحة للمناورة أو التوقف الآمن."),
    "occupante": ("راكب / شاغل المركبة", "lexical_translation", "مفرد occupanti في درس أحزمة الأمان وأنظمة التثبيت."),
    "identificazione": ("التعريف / تحديد الهوية", "contextual_translation", "التعريف بالمركبة أو تحديد هويتها في سياق الوثائق."),
    "documentale": ("متعلق بالوثائق / مستندي", "lexical_translation", "صفة obligation documentale: الالتزام بالوثائق المطلوبة."),
    "autorità": ("السلطات / الجهات المختصة", "contextual_translation", "في سياق اتباع تعليمات السلطات بعد حادث مروري."),
    "legale": ("قانوني", "lexical_translation", "صفة conseguenza legale: نتيجة قانونية."),
    "vigente": ("نافذ / ساري المفعول", "lexical_translation", "في norma vigente: القاعدة القانونية النافذة."),
}
LESSON_DICTIONARY_ADDITIONS.update(V62_LESSON_DICTIONARY_ADDITIONS)
LESSON_DICTIONARY_SOURCES = {
    word: "lesson-dictionary-audit-v62" if word in V62_LESSON_DICTIONARY_ADDITIONS else "lesson-dictionary-audit-v61"
    for word in LESSON_DICTIONARY_ADDITIONS
}
QUESTION_BANK_AUDIT_OVERRIDES = {"prescrive", "rotatoria", "riservata", "retrovisore", "morto", "dosso", "segnalazioni", "acustiche", "sicurezza", "spazio"}
PROJECT_ADDITIONS = {**REQUESTED_LEMMA_ADDITIONS, **VIDEO_CONTEXT_ADDITIONS, **LESSON_DICTIONARY_ADDITIONS}
PROJECT_ADDITION_SOURCES = {**REQUESTED_LEMMA_SOURCES, **VIDEO_CONTEXT_SOURCES, **LESSON_DICTIONARY_SOURCES}

# Owner-supplied, explicitly approved corrections from the v42 review.
# Each tuple is (Arabic display text, translation kind, explanatory note).
OWNER_CORRECTIONS = {
    "diano": (
        "لاحقة بمعنى (يومي) - جزء من كلمة وليست كلمة مستقلة",
        "morpheme_explanation",
        "مقطع/لاحقة مقتطعة من كلمة؛ ليست كلمة إيطالية مستقلة.",
    ),
    "diciannove": (
        "تسعة عشر (19)",
        "number_gloss",
        "اسم العدد الإيطالي 19.",
    ),
    "gpl": (
        "غاز البترول المسال (GPL)",
        "acronym_expansion",
        "اختصار إيطالي يشير إلى غاز البترول المسال.",
    ),
    "hashish": (
        "حشيش (مادة مخدرة)",
        "lexical_translation",
        "المقابل المعجمي المقصود في سياق أسئلة القيادة.",
    ),
    "i": (
        "أداة تعريف للجمع المذكر",
        "grammar_particle",
        "أداة تعريف إيطالية للجمع المذكر، كما في i veicoli؛ وليست اسم الحرف I.",
    ),
    "imposti": (
        "مفروضة / مقررة",
        "contextual_translation",
        "صيغة من imporre؛ يتحدد الضبط النحوي بحسب الاسم في الجملة.",
    ),
    "kg": (
        "كيلوغرام (كجم)",
        "unit_abbreviation",
        "اختصار وحدة الكتلة chilogrammo.",
    ),
    "planoaltimetrico": (
        "مخطط الطريق (المسقط الأفقي والارتفاعي)",
        "technical_translation",
        "مصطلح تقني لوصف المسقط الأفقي والارتفاعي للطريق.",
    ),
    "sedici": (
        "ستة عشر (16)",
        "number_gloss",
        "اسم العدد الإيطالي 16.",
    ),
}

# Isolated single-letter tokens are extraction artifacts rather than dictionary words.
EXCLUDED_SINGLE_LETTER_ARTIFACTS = {"b", "f", "g", "h", "p", "v", "x"}


def normalized_word(value: object) -> str:
    return unicodedata.normalize("NFC", str(value or "").strip())


def write_json_atomically(payload: dict) -> None:
    fd, temp_name = tempfile.mkstemp(prefix="dictionary-v62-", suffix=".json", dir=JSON_PATH.parent)
    os.close(fd)
    try:
        Path(temp_name).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        Path(temp_name).replace(JSON_PATH)
    finally:
        Path(temp_name).unlink(missing_ok=True)


def main() -> int:
    payload = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    rows = payload.get("entries")
    if payload.get("schema_version") != 1 or not isinstance(rows, list):
        raise SystemExit("Expected schema_version 1 and an entries array")

    for word, (translation, kind, note) in PROJECT_ADDITIONS.items():
        if not any(normalized_word(row.get("word")).casefold() == word.casefold() for row in rows):
            rows.append({
                "word": word,
                "translation_ar": translation,
                "ui_fallback_ar": translation,
                "translation_kind": kind,
                "source": PROJECT_ADDITION_SOURCES[word],
                "provider": "project-maintained",
                "confidence": None,
                "status": "reviewed_override",
                "review_required": 0,
                "note": note,
            })

    filtered_rows = []
    seen: set[str] = set()
    for row in rows:
        word = normalized_word(row.get("word"))
        if not word:
            raise SystemExit("Dictionary contains an empty Italian word")
        key = word.casefold()
        if key in EXCLUDED_SINGLE_LETTER_ARTIFACTS:
            continue
        if key in seen:
            raise SystemExit(f"Duplicate normalized Italian word: {word!r}")
        seen.add(key)
        row["word"] = word
        correction = OWNER_CORRECTIONS.get(key)
        if correction:
            translation, kind, note = correction
            row.update({
                "translation_ar": translation,
                "ui_fallback_ar": translation,
                "translation_kind": kind,
                "source": "owner-approved-correction-v42",
                "provider": "Abdul",
                "confidence": None,
                "status": "reviewed_override",
                "review_required": 0,
                "note": note,
            })
        elif key in PROJECT_ADDITIONS:
            translation, kind, note = PROJECT_ADDITIONS[key]
            row.update({
                "translation_ar": translation,
                "ui_fallback_ar": translation,
                "translation_kind": kind,
                "source": PROJECT_ADDITION_SOURCES[key],
                "provider": "project-maintained",
                "confidence": None,
                "status": "reviewed_override",
                "review_required": 0,
                "note": note,
            })
        if not str(row.get("translation_ar") or "").strip():
            raise SystemExit(f"Dictionary translation is empty after corrections: {word!r}")
        filtered_rows.append(row)

    if len(filtered_rows) != EXPECTED_WORD_COUNT:
        raise SystemExit(f"Expected {EXPECTED_WORD_COUNT:,} dictionary terms after excluding letter artifacts, got {len(filtered_rows):,}")
    missing_corrections = set(OWNER_CORRECTIONS) - {row["word"].casefold() for row in filtered_rows}
    if missing_corrections:
        raise SystemExit(f"Owner correction terms are missing: {sorted(missing_corrections)}")
    missing_project_additions = set(PROJECT_ADDITIONS) - {row["word"].casefold() for row in filtered_rows}
    if missing_project_additions:
        raise SystemExit(f"Project addition terms are missing: {sorted(missing_project_additions)}")

    rows = filtered_rows
    statuses = Counter(str(row.get("status") or "needs_review") for row in rows)
    machine_rows = sum(1 for row in rows if row.get("translation_kind") == "machine_translation")
    legacy_rows = statuses.get("legacy_glossary_needs_review", 0)
    approved_rows = statuses.get("reviewed_override", 0)
    review_required_rows = sum(int(row.get("review_required", 1)) for row in rows)
    translated_rows = sum(bool(str(row.get("translation_ar") or "").strip()) for row in rows)
    nonlexical_rows = sum(row.get("translation_kind") == "morpheme_explanation" for row in rows)

    metadata_json = payload.setdefault("metadata", {})
    metadata_json.update({
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "app_release": APP_VERSION,
        "counts_by_status": dict(sorted(statuses.items())),
        "total_entries": len(rows),
        "translated_entries": translated_rows,
        "review_required_entries": review_required_rows,
        "unique_question_bank_terms": sum(row["word"].casefold() not in PROJECT_ADDITIONS or row["word"].casefold() in QUESTION_BANK_AUDIT_OVERRIDES for row in rows),
        "terms_with_lookup_entry": len(rows),
        "entries_with_arabic_translation": translated_rows,
        "entries_without_lexical_translation": nonlexical_rows,
        "entries_with_safe_ui_fallback": 0,
        "owner_approved_corrections": len(OWNER_CORRECTIONS),
        "excluded_single_letter_artifacts": sorted(EXCLUDED_SINGLE_LETTER_ARTIFACTS),
        "accuracy_note": "Automatic model and legacy glossary entries remain unreviewed drafts; v42 owner corrections, v47/v51/v61 requested terms, v54 video-context terms, and v61/v62 lesson-audit additions are marked reviewed_override. The lookup omits isolated single-letter extraction artifacts.",
        "requested_lemma_additions": len(REQUESTED_LEMMA_ADDITIONS),
        "video_context_additions": len(VIDEO_CONTEXT_ADDITIONS),
        "lesson_dictionary_audit_additions": len(LESSON_DICTIONARY_ADDITIONS),
    })
    payload["entries"] = rows
    write_json_atomically(payload)

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    DB_PATH.unlink(missing_ok=True)
    db = sqlite3.connect(DB_PATH)
    try:
        db.execute("PRAGMA journal_mode=DELETE")
        db.execute("PRAGMA synchronous=FULL")
        db.execute(f"PRAGMA user_version={APP_VERSION}")
        db.executescript("""
            CREATE TABLE Dictionary (
                Italian_Word TEXT PRIMARY KEY NOT NULL,
                Arabic_Translation TEXT NOT NULL,
                Translation_Kind TEXT NOT NULL,
                Source TEXT NOT NULL,
                Provider TEXT NOT NULL,
                Status TEXT NOT NULL,
                Confidence REAL,
                Review_Required INTEGER NOT NULL CHECK (Review_Required IN (0, 1)),
                Note TEXT NOT NULL
            );
            CREATE TABLE Metadata (
                Key TEXT PRIMARY KEY NOT NULL,
                Value TEXT NOT NULL
            );
        """)
        db.executemany(
            "INSERT INTO Dictionary VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [(
                row["word"],
                str(row["translation_ar"]).strip(),
                str(row.get("translation_kind") or "unknown"),
                str(row.get("source") or ""),
                str(row.get("provider") or ""),
                str(row.get("status") or "needs_review"),
                row.get("confidence"),
                int(row.get("review_required", 1)),
                str(row.get("note") or ""),
            ) for row in rows],
        )
        sqlite_metadata = {
            "schema_version": "1",
            "app_version": str(APP_VERSION),
            "word_count": str(len(rows)),
            "automatic_translation_rows": str(machine_rows),
            "legacy_glossary_rows": str(legacy_rows),
            "owner_approved_override_rows": str(approved_rows),
            "requested_lemma_addition_rows": str(len(REQUESTED_LEMMA_ADDITIONS)),
            "video_context_addition_rows": str(len(VIDEO_CONTEXT_ADDITIONS)),
            "lesson_dictionary_audit_rows": str(len(LESSON_DICTIONARY_ADDITIONS)),
            "unresolved_rows_given_transparent_fallback": "0",
            "excluded_single_letter_artifacts": ",".join(sorted(EXCLUDED_SINGLE_LETTER_ARTIFACTS)),
            "translation_notice": "Automatic translations remain drafts unless status is reviewed_override; reviewed overrides include requested v47/v51/v61 lemmas, v54 video-context translations, and v61/v62 lesson-audit terms.",
            "fallback_notice": "The v42 lookup excludes isolated single-letter extraction artifacts and includes owner-approved corrections.",
        }
        db.executemany("INSERT INTO Metadata(Key, Value) VALUES (?, ?)", sorted(sqlite_metadata.items()))
        db.commit()
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        count = db.execute("SELECT COUNT(*) FROM Dictionary").fetchone()[0]
        empty = db.execute("SELECT COUNT(*) FROM Dictionary WHERE trim(Arabic_Translation) = ''").fetchone()[0]
        approved_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE Source = 'owner-approved-correction-v42' AND Status = 'reviewed_override' AND Review_Required = 0").fetchone()[0]
        excluded_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE lower(Italian_Word) IN ('b','f','g','h','p','v','x')").fetchone()[0]
        if integrity != "ok" or count != EXPECTED_WORD_COUNT or empty != 0 or approved_db_rows != len(OWNER_CORRECTIONS) or excluded_db_rows != 0:
            raise SystemExit(f"SQLite validation failed: integrity={integrity}, rows={count}, empty={empty}, approved={approved_db_rows}, excluded={excluded_db_rows}")
        project_addition_db_rows = sum(
            db.execute(
                "SELECT COUNT(*) FROM Dictionary WHERE Italian_Word = ? AND Arabic_Translation = ? AND Source = ? AND Status = 'reviewed_override' AND Review_Required = 0",
                (word, translation, PROJECT_ADDITION_SOURCES[word]),
            ).fetchone()[0]
            for word, (translation, _kind, _note) in PROJECT_ADDITIONS.items()
        )
        if project_addition_db_rows != len(PROJECT_ADDITIONS):
            raise SystemExit(f"Project addition SQLite validation failed: rows={project_addition_db_rows}")
    finally:
        db.close()

    digest = hashlib.sha256(DB_PATH.read_bytes()).hexdigest()
    print(f"SQLite asset: {DB_PATH}")
    print(f"Rows: {len(rows)}; automatic: {machine_rows}; legacy: {legacy_rows}; owner-approved corrections: {approved_rows}; excluded letter artifacts: {len(EXCLUDED_SINGLE_LETTER_ARTIFACTS)}")
    print(f"Integrity: ok; rows with empty Arabic_Translation: 0; bytes: {DB_PATH.stat().st_size}; SHA-256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
