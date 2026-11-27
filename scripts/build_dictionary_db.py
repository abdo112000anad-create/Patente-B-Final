#!/usr/bin/env python3
"""Build the v63 SQLite dictionary and its matching JSON lookup."""
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
APP_VERSION = 64
EXPECTED_WORD_COUNT = 5336

QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX = "question-bank-context-confirmation-2026-11;"
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS = {
    "incrocio": (
        "تقاطع",
        "contextual_translation",
        "634 occurrences in 601 distinct official-question contexts and 4 lesson contexts; the reviewed uses are road junctions/intersections. Reverso Italiano-Arabo and Glosbe directly support تقاطع. Existing gloss retained unchanged and marked reviewed.",
    ),
    "sorpasso": (
        "تجاوز مركبة",
        "contextual_translation",
        "216 occurrences in 213 distinct official-question contexts and 8 lesson contexts; the reviewed uses concern overtaking a vehicle. Arabdict directly supports تجاوز, Reverso supports the corresponding traffic use, and Treccani defines the Italian maneuver. Existing app-context gloss retained unchanged and marked reviewed.",
    ),
    "pericolo": (
        "خطر",
        "contextual_translation",
        "213 occurrences in 210 distinct official-question contexts and 8 lesson contexts; the reviewed uses mean danger/hazard. Arabita and Reverso Italiano-Arabo support خطر. Existing gloss retained unchanged and marked reviewed.",
    ),
    "distanza": (
        "المسافة",
        "contextual_translation",
        "205 occurrences in 202 distinct official-question contexts and 11 lesson contexts; the reviewed uses concern safety or physical distance. Glosbe Italiano-Arabo and Reverso usage support مسافة/المسافة. Existing gloss retained unchanged and marked reviewed.",
    ),
    "semaforo": (
        "إشارة ضوئية",
        "contextual_translation",
        "204 occurrences in 178 distinct official-question contexts; the reviewed uses concern traffic signals. Glosbe and Reverso Italiano-Arabo support إشارة ضوئية, consistent with ACI Article 41. Existing gloss retained unchanged and marked reviewed.",
    ),
}
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES = {
    "incrocio": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/incrocio; Glosbe Italiano-Arabo: https://glosbe.com/it/ar/incrocio",
    "sorpasso": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabdict Italiano-Arabo: https://www.arabdict.com/it/italian-arabic/sorpasso; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/sorpassare; Treccani: https://www.treccani.it/vocabolario/sorpasso/",
    "pericolo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabita: https://arabita.news/dizionario/944; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/pericolo",
    "distanza": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://it.glosbe.com/it/ar/distanza; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/distanza",
    "semaforo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://ar.glosbe.com/it/ar/semaforo; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/semaforo; ACI Codice della Strada, art. 41: https://aci.gov.it/codice-della-strada/art-41/",
}

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
V63_LESSON_DICTIONARY_ADDITIONS = {
    "spia": ("مؤشر تحذير", "contextual_translation", "في سياق لوحة عدادات المركبة، spia تعني مؤشرًا أو ضوءًا تحذيريًا لا جاسوسًا."),
    "spie": ("مؤشرات تحذير", "contextual_translation", "صيغة الجمع في درس لوحة عدادات المركبة؛ تعني مؤشرات أو أضواء التحذير."),
}
LESSON_DICTIONARY_ADDITIONS.update(V62_LESSON_DICTIONARY_ADDITIONS)
LESSON_DICTIONARY_ADDITIONS.update(V63_LESSON_DICTIONARY_ADDITIONS)
LESSON_DICTIONARY_SOURCES = {
    word: "lesson-dictionary-audit-v63" if word in V63_LESSON_DICTIONARY_ADDITIONS
    else "lesson-dictionary-audit-v62" if word in V62_LESSON_DICTIONARY_ADDITIONS
    else "lesson-dictionary-audit-v61"
    for word in LESSON_DICTIONARY_ADDITIONS
}
QUESTION_BANK_AUDIT_OVERRIDES = {"prescrive", "rotatoria", "riservata", "retrovisore", "morto", "dosso", "segnalazioni", "acustiche", "sicurezza", "spazio", "spia", "spie"}
PROJECT_ADDITIONS = {**REQUESTED_LEMMA_ADDITIONS, **VIDEO_CONTEXT_ADDITIONS, **LESSON_DICTIONARY_ADDITIONS}
PROJECT_ADDITION_SOURCES = {**REQUESTED_LEMMA_SOURCES, **VIDEO_CONTEXT_SOURCES, **LESSON_DICTIONARY_SOURCES}

# Contextual corrections grounded in the official question-bank examples and open dictionaries.
# These remain explicit review candidates; they are not represented as human-approved translations.
QUESTION_BANK_CONTEXTUAL_CANDIDATES = {
    "abbagliante": (
        "الضوء العالي / مُبهِر",
        "contextual_translation_draft",
        "اقتراح تصحيح سياقي أولي: في أسئلة المركبات تشير luci/fari/proiettori abbaglianti إلى الأضواء العالية؛ وتبقى دلالة مُبهِر في الاستعمال العام. تؤيد أمثلة القاموس معنى high-beam headlamp؛ لم يخضع المدخل لمراجعة بشرية مستقلة.",
    ),
    "abbagliamento": (
        "الإبهار الضوئي / وهج يعيق الرؤية",
        "contextual_translation_draft",
        "اقتراح تصحيح سياقي أولي: في أسئلة القيادة يعني abbagliamento glare/إبهار البصر بسبب الشمس أو الطائرات، لا مجرد التوهج؛ لم يخضع المدخل لمراجعة بشرية مستقلة.",
    ),
    "extraurbane": (
        "خارج المناطق المأهولة",
        "contextual_translation_draft",
        "مقترح مؤقت: وردت extraurbane في 135 سياقًا من أسئلة التطبيق و3 مواضع في الدرس u6-l5. تحدد المادة 3 من قانون المرور الطريق خارج المركز المأهول المحدد قانونًا، ويشرح Treccani المعنى بأنه خارج المدينة أو النطاق العمراني. يتبع المقابل العربي الصياغة الغالبة في الأسئلة، لكن لا يتوفر مصدر عربي قانوني مباشر يثبت دقته؛ لذلك يبقى المدخل قيد المراجعة ولا يُعد تصحيحًا معتمدًا.",
    ),
}
QUESTION_BANK_CONTEXTUAL_CANDIDATE_SOURCES = {
    "abbagliante": "question-bank-context-audit-v64; Reverso Italian-English; Ministero delle Infrastrutture e dei Trasporti",
    "abbagliamento": "question-bank-context-audit-v64; Translate.com Italian-English; Ministero delle Infrastrutture e dei Trasporti",
    "extraurbane": "question-bank-context-audit-v65; ACI Codice della Strada, art. 3: https://aci.gov.it/codice-della-strada/art-3/; Treccani, extraurbano: https://www.treccani.it/vocabolario/extraurbano/; Reverso Italian-Arabic examples: https://dizionario.reverso.net/italiano-arabo/extraurbano; official MIT question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
}

# Source- and context-verified corrections for frequent question-bank terms.
# These are project audit decisions, not owner-approved wording.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS = {
    "veicoli": (
        "مركبات",
        "contextual_translation",
        "سؤال الوزارة 21823: tutti i veicoli تعني جميع المركبات لا السيارات وحدها؛ يقابلها Reverso الإيطالي-العربي بـ«مركبات» ويورد أمثلة مرورية.",
    ),
    "indica": (
        "يشير إلى / يبيّن",
        "contextual_translation",
        "سؤال الوزارة 22106: indica un tratto di strada؛ ترجمة التطبيق «تشير إلى مقطع طريق». يؤيد مدخل Reverso الإيطالي-العربي مقابلي «تشير إلى» و«يبين/يوضح».",
    ),
    "preannuncia": (
        "ينذر / يعلن مسبقًا",
        "contextual_translation",
        "سؤال الوزارة 20454: preannuncia una svolta obbligatoria؛ الفعل يخبر مسبقًا عن الانعطاف الإلزامي. مدخل Reverso الإيطالي-العربي لـpreannunciare يعطي «ينذر» و«يعلن»؛ «تنبؤ» اسم لا يناسب صيغة الفعل.",
    ),
    "transito": (
        "مرور / عبور",
        "contextual_translation",
        "سؤال الوزارة 21343: vieta il transito ai veicoli؛ المعنى منع مرور المركبات. أمثلة Reverso الإيطالي-العربي تترجم traffico di transito إلى «حركة المرور العابر» وتورد «عبور/مرور»؛ «نقل» يضلل في هذا السياق.",
    ),
    "consente": (
        "يسمح / يتيح",
        "contextual_translation",
        "سؤال الوزارة 21907: svincolo che consente l'inversione di marcia؛ المعنى يتيح/يسمح بعكس اتجاه السير، لا صيغة الأمر «اسمح». يؤيد مدخل Reverso الإيطالي-العربي consentire مقابلات السماح والإتاحة؛ تتغير صيغة الفعل بالعربية بحسب جنس الفاعل.",
    ),
    "presenza": (
        "وجود",
        "contextual_translation",
        "سؤالا الوزارة 22122 و22232: presenza di un garage / di pannelli تعني وجود مرآب أو لوحات، لا الحضور الشخصي. يؤيد مدخل Reverso الإيطالي-العربي presenza معنى «وجود» في سياق وجود الأشياء والظروف؛ يُحصر التصحيح في هذا المعنى المستعمل في التطبيق.",
    ),
    "vieta": (
        "يمنع",
        "contextual_translation",
        "سياقا الوزارة 20455 و21343: il segnale vieta ...؛ vieta فعل مضارع بمعنى يمنع/يحظر، لا صفة «ممنوع». مدخل Reverso الإيطالي-العربي لـ vietare يصنفه فعلًا ويورد «منع/حظر»، وتؤكد أمثلة Reverso Context الصيغة الفعلية. يطابق «يمنع» الفاعل المفرد المذكر il segnale.",
    ),
    "occorre": (
        "يلزم",
        "contextual_translation",
        "سياقات الوزارة 22117 و19237 و20473 و22959: occorre/non occorre تعبر عن اللزوم أو الضرورة، لا الاسم «الحاجة»؛ ومنها إذا لزم الأمر والتوقف مطلوب عند الضرورة. أمثلة Reverso Context للشكل occorre تسند يجب/لا بد من، ويعبر «يلزم» عن المعنى الأساس مع بقاء تركيب se occorre مشروطًا بالسياق.",
    ),
    "km": (
        "كيلومتر",
        "unit_abbreviation",
        "176 ظهورًا في 175 سؤالًا رسميًا؛ السؤال 21533 يستخدم 90 km/h وتقابله في ترجمة التطبيق 90 كم/س، والسؤال 18990 يستخدم 3,8 km مسافة لا أميال. Glosbe الإيطالي-العربي يورد كيلومتر/كم ويعطي مثالًا ثنائيًا للمسافة؛ Reverso Context يؤكد كيلومتر لـ km.",
    ),
    "traffico": (
        "حركة المرور",
        "contextual_translation",
        "153 occurrences in 151 distinct official-question contexts and 9 lesson contexts; the predominant use is traffic/traffic flow, not congestion alone: 21481 strada chiusa al traffico, 21492 zona a traffico limitato, and 18729 agenti del traffico. Congestion is specified by intenso in 22155 and 21499. Glosbe, Arabdict, and Reverso Context support the general traffic sense.",
    ),
    "deve": (
        "يجب أن",
        "contextual_translation",
        "702 occurrences in 699 distinct official-question contexts and 18 lesson contexts; the app uses deve for obligation/necessity, including different grammatical subjects and impersonal constructions. The old gloss adds a fixed masculine subject and ‘that’. Opened Reverso Italian-Arabic examples support obligation phrasing; the University of Wisconsin dovere reference confirms must/have-to semantics. Exact standalone-form Arabic dictionary evidence is limited, so this concise modal gloss is grounded in the full app contexts and bilingual examples.",
    ),
    "bisogna": (
        "يجب أن",
        "contextual_translation",
        "284 occurrences in 284 distinct official-question contexts and 1 lesson context; the app uses impersonal bisogna for general obligation or necessity, including negation. The old gloss adds a specific ‘you’ and ‘that’. The opened Reverso Italian-Arabic entry and examples directly support يجب أن; Treccani defines the Italian verb bisognare as necessity/appropriateness.",
    ),
    "acceleratore": (
        "دواسة الوقود",
        "contextual_translation",
        "4 question-token occurrences in 4 distinct paired question contexts and no lesson matches. Every app use means the vehicle accelerator pedal; the old مسرع is too generic. Reverso's opened Italian-Arabic dictionary entry and examples explicitly support دواسة الوقود for the car pedal; the paired app Arabic also uses دواسة التسارع.",
    ),
    "seggiolino": (
        "مقعد أمان للأطفال (في السيارة)",
        "contextual_translation",
        "3 question-token occurrences in 3 distinct paired question contexts and no lesson matches. All app uses mean a child car safety seat/restraint; the old مقعد omits the child-safety sense. Opened Italian-Arabic Reverso entries/examples and Treccani's definition support the more specific wording.",
    ),
    "anabbagliante": (
        "المصباح الأمامي المنخفض",
        "contextual_translation",
        "2 question-token occurrences in 2 distinct paired question contexts and no lesson matches. Both app uses mean a vehicle low-beam headlamp, not something shining; the old متألق is unrelated. The opened exact-headword Italian-Arabic Reverso entry explicitly supports المصباح الأمامي المنخفض, corroborated by Treccani's low-beam definition.",
    ),
}
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX = "question-bank-context-audit-2026-11;"
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES = {
    "veicoli": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/veicoli; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "indica": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/indica; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "preannuncia": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/preannunciare; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "transito": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/transito; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "consente": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dictionary.reverso.net/italian-arabic/consentire; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "presenza": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/presenza; WordReference Italiano-Arabo: https://www.wordreference.com/itar/presenza; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "vieta": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/vietare; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/vietare; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "occorre": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/occorre; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "km": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italiano-Arabo: https://glosbe.com/it/ar/km; Reverso Context Arabo-Italiano: https://context.reverso.net/translation/arabic-italian/%D9%83%D9%8A%D9%84%D9%88%D9%85%D8%AA%D8%B1; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "traffico": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italiano-Arabo: https://ar.glosbe.com/it/ar/traffico; Reverso Context: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/traffico; Arabdict Italiano-Arabo: https://www.arabdict.com/ar/%D8%B9%D8%B1%D8%A8%D9%8A-%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A/traffico; MIT quiz PDF: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "deve": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italiano-Arabo, ma deve: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/ma+deve; Reverso Italiano-Arabo example: https://dizionario.reverso.net/italiano-arabo/sottoscrivere; University of Wisconsin, dovere: https://wisc.pb.unizin.org/italianreadingtranslation/chapter/ii-irregular-verb-dovere/; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "bisogna": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo dictionary: https://dizionario.reverso.net/italiano-arabo/bisogna; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/bisogna; Treccani, bisognare: https://www.treccani.it/vocabolario/bisognare/; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "acceleratore": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic dictionary: https://dizionario.reverso.net/italiano-arabo/acceleratore; Reverso Context Italian-Arabic, pedale dell'acceleratore: https://context.reverso.net/traduzione/italiano-arabo/pedale+dell%27acceleratore; full paired app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_acceleratore.json",
    "seggiolino": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic dictionary, seggiolino per bambini: https://dizionario.reverso.net/italiano-arabo/seggiolino+bambini; Reverso Context Italian-Arabic: https://context.reverso.net/الترجمة/الإيطالية-العربية/seggiolino; Treccani: https://www.treccani.it/vocabolario/seggiolino/; full paired app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_seggiolino.json",
    "anabbagliante": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic exact-headword entry: https://dictionary.reverso.net/italian-arabic/anabbagliante; Treccani: https://www.treccani.it/vocabolario/anabbagliante/; full paired app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_anabbagliante.json",
}

QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "conducente": (
        "سائق",
        "contextual_translation",
        "540 occurrences in 536 distinct official-question contexts and 39 lesson contexts; every reviewed app use refers to a vehicle driver/operator. The paired Arabic contexts predominantly use سائق/السائق; Reverso Italian-Arabic examples independently support سائق. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "destra": (
        "يمين",
        "contextual_translation",
        "330 occurrences in 323 distinct official-question contexts and 5 lesson contexts; all audited uses are spatial/directional (right side, right turn, or approaching from the right). Glosbe and Reverso Italian-Arabic support يمين/اليمين; Treccani and ACI road-code articles support the matching road-direction sense. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "consentito": (
        "مسموح",
        "contextual_translation",
        "273 occurrences in 273 distinct official-question contexts and 1 lesson context; all reviewed uses express permission/allowance, including negation. Reverso Italian-Arabic directly lists يسمح/يُسمح and جائز/مباح; ACI and Gazzetta Ufficiale road-code article 148 corroborate the traffic-law permission context. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "patente": (
        "رخصة القيادة",
        "contextual_translation",
        "270 occurrences in 231 distinct official-question contexts and 6 lesson contexts; every audited app use concerns a driving licence, its category, validity, points, or sanctions. Reverso Italian-Arabic entries for patente/patente di guida and the reverse Arabic-Italian entry support رخصة القيادة; the official motorist portal confirms the Italian legal-document sense. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "sinistra": (
        "يسار",
        "contextual_translation",
        "277 occurrences in 268 distinct official-question contexts and 1 lesson context; all reviewed uses are spatial/directional (left side, turn, lane, or approach from the left). Glosbe Italian-Arabic directly supports يسار and gives a right-to-left example; its Arabic-Italian entry confirms the direction. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "luce": (
        "ضوء",
        "contextual_translation",
        "174 occurrences in 168 distinct official-question contexts and 4 lesson contexts; app uses include signal lights, vehicle lamps, emitted light, and reflected light. Glosbe, Reverso, and Arabdict Italian-Arabic entries support ضوء while showing نور/إضاءة as context-dependent alternatives. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "obbligatorio": (
        "إلزامي",
        "contextual_translation",
        "137 occurrences in 137 distinct official-question contexts and 1 lesson context; reviewed uses describe required or mandatory actions/equipment. Opened Reverso Italian-Arabic examples directly pair obbligatorio with إلزامي/إجباري. Arabic sentence forms vary with syntax, but the existing general gloss is supported and marked reviewed.",
    ),
    "direzione": (
        "الاتجاه",
        "contextual_translation",
        "134 occurrences in 133 distinct official-question contexts and 2 lesson contexts; app uses primarily concern direction, route, or movement, including indicatori di direzione. Arabdict directly lists اتجاه; Reverso examples show other administrative senses, while the reviewed app contexts support the current directional gloss. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "obbligo": (
        "التزام",
        "contextual_translation",
        "132 occurrences in 132 distinct official-question contexts and 5 lesson contexts; uses include duties, mandatory-sign obligations, and a document obligation. Arabita, Reverso, and Glosbe provide direct Italian-Arabic support for التزام alongside واجب/إلزام as context-sensitive alternatives. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "limite": (
        "الحد",
        "contextual_translation",
        "130 occurrences in 130 distinct official-question contexts and 5 lesson contexts; app uses cover maximum/minimum speed, time, and dimensional limits. Opened Reverso Italian-Arabic examples support حد/الحد in these broad boundary senses. Existing general gloss confirmed unchanged and marked reviewed; this is a lexical decision, not a legal-rule claim.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "conducente": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/conducente; Collins Italian-English: https://www.collinsdictionary.com/dictionary/italian-english/conducente; ACI Codice della strada: https://aci.gov.it/approfondimento/il-codice-della-strada/",
    "destra": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://it.glosbe.com/it/ar/destra; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/destra; Treccani: https://www.treccani.it/vocabolario/destra/; ACI Codice della strada, arts. 143 and 145: https://aci.gov.it/codice-della-strada/art-143/ and https://aci.gov.it/codice-della-strada/art-145/",
    "consentito": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/consentito; ACI Codice della strada, art. 148: https://www.aci.it/fileadmin/cds/art-148.php; Gazzetta Ufficiale, art. 148: https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.progressivo=0&art.idArticolo=148&art.versione=1&art.codiceRedazionale=093A6158&art.dataPubblicazioneGazzetta=1994-03-22&art.idGruppo=11&art.idSottoArticolo1=10&art.idSottoArticolo=1&art.flagTipoArticolo=0",
    "patente": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo, patente: https://dizionario.reverso.net/italiano-arabo/patente; Reverso, patente di guida: https://dizionario.reverso.net/italiano-arabo/patente+di+guida; Reverso Arabic-Italian, رخصة القيادة: https://dizionario.reverso.net/arabo-italiano/%D8%B1%D8%AE%D8%B5%D8%A9+%D8%A7%D9%84%D9%82%D9%8A%D8%A7%D8%AF%D8%A9; Il Portale dell'Automobilista: https://www.ilportaledellautomobilista.it/web/portale-automobilista/la-patente-di-guida",
    "sinistra": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://glosbe.com/it/ar/sinistra; Glosbe Arabo-Italiano: https://glosbe.com/ar/it/%D9%8A%D8%B3%D8%A7%D8%B1; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "luce": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://it.glosbe.com/it/ar/luce; Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/luce; Arabdict Italiano-Arabo: https://www.arabdict.com/it/italian-arabic/luce; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "obbligatorio": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/obbligatorio; Collins Italiano-Inglese (Italian sense only): https://www.collinsdictionary.com/dictionary/italian-english/obbligatorio; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "direzione": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabdict Italiano-Arabo: https://www.arabdict.com/en/italian-arabic/direzione; Reverso Italiano-Arabo: https://dictionary.reverso.net/italian-arabic/direzione/; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "obbligo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabita: https://arabita.news/dizionario/945; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/obbligo; Glosbe Italiano-Arabo: https://glosbe.com/it/ar/obbligo; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "limite": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/limite; MIT quiz PDF as app-context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

# Batch-eleven unchanged-gloss confirmations: current app contexts and direct bilingual sources.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "necessario": (
        "ضروري",
        "contextual_translation",
        "129 question-token occurrences in 128 distinct official-question contexts and 9 lesson-text occurrences across 8 lesson records; reviewed uses cover necessary/required senses including se necessario and eligibility. Reverso Italian–Arabic supports ضروري and phrase variants; Glosbe independently lists ضروري. Existing concise gloss retained unchanged and marked reviewed; syntax may require alternatives such as لازم or مطلوب.",
    ),
    "massimo": (
        "الأقصى",
        "contextual_translation",
        "128 question-token occurrences in 128 distinct official-question contexts and no matching lesson record; reviewed uses express upper limits for speed, quantity, capacity, load, number, and duration. Reverso Italian–Arabic examples and Glosbe directly support أقصى / الأقصى. Existing gloss retained unchanged and marked reviewed; specialized or nominal senses may need phrase-level translation.",
    ),
    "metri": (
        "متر",
        "contextual_translation",
        "127 question-token occurrences in 127 distinct official-question contexts and no matching lesson record; all uses are the length unit for sign distances, vehicle dimensions, safety gaps, and road stretches. Reverso identifies metri as the inflected form of metro with متر / أمتار examples; Glosbe directly defines متر as the distance unit. Existing lemma gloss retained unchanged and marked reviewed; Arabic form varies with numeral and syntax.",
    ),
    "categoria": (
        "الفئة",
        "contextual_translation",
        "125 question-token occurrences in 110 distinct official-question contexts and 1 lesson-text occurrence in 1 lesson record; app uses concern vehicle classes, licence categories, and classification/group senses. Reverso Italian–Arabic supports فئة; Glosbe independently corroborates it in a category phrase. Existing الفئة retained unchanged and marked reviewed; register and context may support alternatives such as تصنيف.",
    ),
    "luci": (
        "الأضواء",
        "contextual_translation",
        "112 question-token occurrences in 112 distinct official-question contexts and 9 lesson-text occurrences across 3 lesson records; app uses refer to signal lights, vehicle lamps, warning lights, and ordinary lights. Reverso directly lists أضواء for luci and Glosbe supports the underlying luce sense. Existing plural gloss retained unchanged and marked reviewed; technical compounds require compound-specific equivalents.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "necessario": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/necessario; Glosbe Italiano-Arabo: https://ar.glosbe.com/it/ar/necessario; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/se+necessario",
    "massimo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/massimo; Glosbe Italiano-Arabo: https://it.glosbe.com/it/ar/massimo",
    "metri": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/metri; Glosbe Italiano-Arabo: https://ar.glosbe.com/it/ar/Metro",
    "categoria": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/categoria; Glosbe Italiano-Arabo: https://glosbe.com/it/ar/categoria%20colore",
    "luci": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/translation/italian-arabic/luci; Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/luce; Glosbe Italiano-Arabo: https://glosbe.com/it/ar/luce",
})

# Owner-supplied, explicitly approved corrections from the v42 review.
# Each tuple is (Arabic display text, translation kind, explanatory note).
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "stradale": (
        "متعلق بالطريق / مروري (صفة)",
        "contextual_translation",
        "153 question-token occurrences in 152 distinct official-question contexts and 3 lesson contexts; every app use is adjectival in combinations such as cantiere/incidente/segnaletica/fondo stradale. The old gloss الطريق is a noun and does not express the adjective. Opened Reverso Italian-Arabic examples and the Arabdict entry support road-/traffic-related adjectival senses; Arabic wording varies with the noun, so retain both a broad road-related sense and the common traffic adjective rather than asserting one phrase fits every compound.",
    ),
    "svoltare": (
        "انعطف",
        "contextual_translation",
        "173 occurrences in 173 distinct official-question contexts and 0 matching lesson contexts; all reviewed app uses concern turning/changing direction on a road. Glosbe and Arabdict Italian-Arabic entries support انعطف or equivalent directional forms, and Reverso examples support the same road sense. The current إنعطف uses a hamza above alif; the Cairo Arabic Language Academy entry writes the verb انْعَطَفَ with plain alif (hamzat wasl). This is an orthographic correction, not a change of the verified meaning.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "stradale": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/translation/italian-arabic/stradale; Arabdict Italiano-Arabo: https://www.arabdict.com/m//results?lang=ar&dict=it&q=stradale; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "svoltare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italiano-Arabo: https://glosbe.com/it/ar/svoltare; Arabdict Italiano-Arabo: https://www.arabdict.com/en/italian-arabic/svoltare; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/svoltare; Cairo Arabic Language Academy, انعطف: https://www.arabicacademy.gov.eg/ar/%D9%85%D8%AD%D8%B1%D9%83-%D8%A7%D9%84%D8%A8%D8%AD%D8%AB?criteria=%D8%A7%D9%86%D9%92%D8%B9%D9%8E%D8%B7%D9%8E%D9%81%D9%8E&exact_search=true; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "nell'incrocio": (
        "في التقاطع",
        "contextual_translation",
        "268 occurrences in 268 distinct official-question contexts and 0 lesson contexts; all reviewed questions use the phrase for location at/in a road junction, predominantly right-of-way situations. Glosbe supports تقاطع and Reverso's traffic examples use في التقاطع. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "motore": (
        "محرك",
        "contextual_translation",
        "241 occurrences in 224 distinct official-question contexts and 0 lesson contexts; reviewed uses mean a vehicle engine/motor, including temperature, oil, starting/stopping, power, emissions, and veicoli a motore. Reverso and Arabita independently support محرك for the mechanical sense. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "ruote": (
        "عجلات",
        "contextual_translation",
        "147 occurrences in 142 distinct official-question contexts and 0 lesson contexts; all reviewed app uses refer to physical vehicle wheel(s), including driven, front/rear, locking, and wheel-count contexts. Reverso vehicle examples and Glosbe Arabic-Italian support عجلة/عجلات. Existing gloss confirmed unchanged and marked reviewed.",
    ),
    "massa": (
        "كتلة",
        "contextual_translation",
        "129 occurrences in 120 distinct official-question contexts and 0 lesson contexts; all reviewed app uses concern physical vehicle/load/axle mass, including maximum authorized and fully loaded mass. Reverso and Glosbe support كتلة in the physical-mass sense. Existing gloss confirmed unchanged and marked reviewed.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "nell'incrocio": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://glosbe.com/it/ar/incrocio; Reverso Italiano-Arabo traffic examples: https://dizionario.reverso.net/italiano-arabo/incrocio; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "motore": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/motore; Arabita Italian-Arabic dictionary: https://arabita.news/dizionario/2210; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "ruote": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/ruota; Glosbe Arabo-Italiano: https://it.glosbe.com/ar/it/%D8%B9%D8%AC%D9%84%D8%A9; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "massa": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italiano-Arabo: https://context.reverso.net/translation/italian-arabic/massa; Glosbe Italiano-Arabo: https://glosbe.com/it/ar/massa; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "autostrade": (
        "الطرق السريعة",
        "contextual_translation",
        "102 question-token occurrences in 102 distinct official-question contexts and 2 lesson-text occurrences in 2 matching lesson records; all reviewed uses refer to Italian motorways/high-speed controlled-access roads. Glosbe and Reverso Italian-Arabic examples support الطريق السريع, matching the plural gloss الطرق السريعة in the app. Existing gloss confirmed unchanged and marked reviewed; this does not validate every quiz rule.",
    ),
    "fermarsi": (
        "توقّف",
        "contextual_translation",
        "86 question-token occurrences in 86 distinct official-question contexts and 8 lesson-text occurrences in 6 matching lesson records; reviewed uses concern a driver or vehicle stopping, including required, precautionary, and negated actions. Reverso Italian-Arabic and Glosbe directly support توقف/التوقف for the app-relevant stop sense. Existing gloss confirmed unchanged and marked reviewed; technical arresto/fermata/sosta distinctions remain sentence-context dependent.",
    ),
    "pneumatici": (
        "إطارات",
        "contextual_translation",
        "78 question-token occurrences in 76 distinct official-question contexts and 9 lesson-text occurrences in 2 matching lesson records; all reviewed uses mean vehicle tyres, including pressure, tread, winter equipment, wear, and grip. Glosbe and independent Reverso Italian-Arabic examples support إطار/إطارات; ACI supplies Italian road-safety context. Existing gloss confirmed unchanged and marked reviewed; this is lexical confirmation, not validation of every quiz assertion.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "autostrade": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://it.glosbe.com/it/ar/autostrada; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/autostrada; Patente.it Codice della Strada, art. 2: https://www.patente.it/normativa/articolo-2-cds?idc=257; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "fermarsi": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo: https://dictionary.reverso.net/italian-arabic/fermarsi; Glosbe Italiano-Arabo, fermare: https://glosbe.com/it/ar/fermare; Normattiva Codice della Strada, art. 157: https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285~art157; ACI art. 157: https://www.aci.it/fileadmin/cds/art-157.php; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "pneumatici": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://glosbe.com/it/ar/pneumatico; Reverso Context Italiano-Arabo: https://context.reverso.net/translation/italian-arabic/pneumatici; ACI road-safety guidance: https://www.lautomobile.aci.it/come-fare-per/pneumatici/pneumatici-invernali-catene-obbligo-cosa-sapere/; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

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

# Batch-twelve contextual confirmations and correction, based on complete paired app contexts.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "superiore": (
        "أعلى",
        "contextual_translation",
        "131 question-token occurrences in 122 distinct official-question contexts and no matching lesson records. App uses are predominantly quantitative comparisons and thresholds (vehicle mass/dimensions, engine capacity, speed, power, age, and licence limits); paired Arabic includes أعلى/أكبر من/تزيد عن. Reverso Italian-Arabic, Glosbe Italian-Arabic, and reverse Reverso support أعلى for this comparative sense. Existing gloss confirmed unchanged for these app contexts; broader senses were not assessed.",
    ),
    "ore": (
        "ساعات",
        "contextual_translation",
        "119 question-token occurrences in 94 distinct official-question contexts and no matching lesson records. App uses include plural durations, parts of day/night, and schedule windows; clock-time phrases naturally use الساعة in sentence context. Glosbe Italian-Arabic supports plural hours and Reverso Italian-Arabic supports phrase-level clock-time forms. Existing plural gloss confirmed unchanged for these app contexts.",
    ),
    "evitare": (
        "تجنب",
        "contextual_translation",
        "107 question-token occurrences in 106 distinct official-question contexts and 2 lesson-text occurrences in 2 lesson records. App uses concern preventing accidents, collisions, danger, and damage or refraining from risky actions; paired Arabic uses تجنب/يتجنب and sometimes تفادي. Arabita and Reverso Italian-Arabic support تجنب, with تفادي as a contextual alternative. Existing broad gloss confirmed unchanged; lesson explainAr siblings were assessed as explanations, not literal translations.",
    ),
    "autobus": (
        "حافلة",
        "contextual_translation",
        "106 question-token occurrences in 104 distinct official-question contexts and no matching lesson records. All reviewed uses refer to buses/coaches as passenger road vehicles (public-service, school, tourist, and general traffic contexts); paired Arabic uses حافلة/الحافلات. Glosbe and Reverso Italian-Arabic support حافلة. Existing gloss confirmed unchanged for these app contexts.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "superiore": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italiano-Arabo: https://dictionary.reverso.net/italian-arabic/superiore; Glosbe Italiano-Arabo: https://glosbe.com/it/ar/superiore; Reverso Arabo-Italiano: https://dizionario.reverso.net/arabo-italiano/%D8%A3%D8%B9%D9%84%D9%89; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "ore": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo, ora: https://glosbe.com/it/ar/ora; Reverso Italiano-Arabo, alle ore: https://dizionario.reverso.net/italiano-arabo/alle+ore; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "evitare": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabita Italiano-Arabo: https://arabita.news/dizionario/1265; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/evitare; Glosbe Arabo-Italiano: https://ar.glosbe.com/ar/it/%D8%A7%D8%AC%D8%AA%D9%86%D8%A8; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "autobus": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italiano-Arabo: https://ar.glosbe.com/it/ar/autobus; Reverso Context Italiano-Arabo: https://context.reverso.net/translation/italian-arabic/autobus; Glosbe Arabo-Italiano: https://glosbe.com/ar/it/%D8%AD%D8%A7%D9%81%D9%84%D8%A9; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "obbliga": (
        "يُلزم",
        "contextual_translation",
        "102 question-token occurrences in 102 distinct official-question contexts and no matching lesson records. The dominant app use is a binding traffic duty or legal requirement: signs and rules require a driver to stop, yield, maintain speed/distance, or follow a direction; paired Arabic repeatedly uses يُلزم/تلزم. Glosbe Italian-Arabic lists ألزم for obbligare and Reverso Italian-Arabic supplies obligation/force examples. يُلزم better fits the reviewed finite-form app use than draft أجبر; this contextual correction does not claim أجبر is invalid for every sense of obbligare.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "obbliga": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italiano-Arabo, obbligare: https://glosbe.com/it/ar/obbligare; Reverso Context Italiano-Arabo, obbligare: https://context.reverso.net/traduzione/italiano-arabo/obbligare; MIT quiz PDF as app-context corpus only: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

# Batch-thirteen corrections grounded in complete paired contexts and opened bilingual evidence.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "vicinanza": (
        "قُرب؛ بالقرب من",
        "contextual_translation",
        "104 question-token occurrences in 104 distinct paired question contexts and no lesson matches; all app uses denote nearness/proximity, chiefly in vicinanza di / in vicinanza di a checkpoint, roadworks, crossings, curves, stations, or other locations. The current اقترب is an imperative verb, not the noun/phrase sense in the app. Glosbe's direct Italian-Arabic vicinanza entry supports قرب, and Reverso bilingual examples support قرب/على مقربة من. The compact gloss is for the audited proximity sense; phrase-level Arabic may require بالقرب من or على مقربة من.",
    ),
    "effettuare": (
        "يُجري؛ يقوم بـ",
        "contextual_translation",
        "87 question-token occurrences in 87 distinct paired question contexts and no lesson matches; the dominant app sense is to carry out/perform an action (e.g. إجراء/تنفيذ a maneuver, overtaking, check, stop, or connection). The existing شغّل means switch on/operate and does not fit this general action use. Reverso's direct Italian-Arabic entry supports القيام/بإجراء and examples such as نفذ ما يلي; Reverso Context supports إجراء in action contexts. Some specialized uses (e.g. skiing or camera movement) need phrase-level wording, so this gloss records the dominant contextual sense rather than every possible Italian use.",
    ),
    "autocarri": (
        "الشاحنات",
        "contextual_translation",
        "83 question-token occurrences in 83 distinct paired question contexts and no lesson matches; the app uses autocarri for freight trucks, often with mass, load, access, and overtaking rules. The draft السيارات is too broad and can be read as passenger cars. Reverso Italian-Arabic examples for autocarro and Glosbe's Arabic-Italian شاحنة entry support the truck equivalent; ACI art. 54 confirms the Italian class is for goods transport, but is cited for Italian legal sense only, not Arabic wording. Arabic usage is commonly الشاحنات, with occasional سيارات الشحن.",
    ),
    "ciclomotori": (
        "دراجات نارية صغيرة",
        "contextual_translation",
        "67 question-token occurrences in 67 distinct paired question contexts and 2 lesson-text occurrences in 1 matching lesson; the app uses the Italian traffic-law vehicle class, typically distinct from motocicli and described by engine/road-use limits. The draft دورانات does not express a vehicle. Glosbe's direct Italian-Arabic ciclomotore entry gives دراجة نارية صغيرة, supporting this plural gloss. Reverso's scooter examples show informal alternatives but are not direct evidence for ciclomotore; Normattiva art. 52 is cited only for Italian legal context, not Arabic equivalence. The precise statutory class may require explanatory phrase translation in some contexts.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "vicinanza": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italiano-Arabo, vicinanza: https://glosbe.com/it/ar/vicinanza; Reverso Context Italiano-Arabo, vicinanza: https://context.reverso.net/traduzione/italiano-arabo/vicinanza; batch13 paired app contexts: /workspace/patente_b_dictionary_audit/batch13_inputs/batch13_vicinanza.json",
    "effettuare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso direct Italian-Arabic entry: https://dictionary.reverso.net/italian-arabic/effettuare; Reverso Context Italiano-Arabo: https://context.reverso.net/traduzione/italiano-arabo/effettuare; batch13 paired app contexts: /workspace/patente_b_dictionary_audit/batch13_inputs/batch13_effettuare.json",
    "autocarri": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italiano-Arabo, autocarro: https://context.reverso.net/traduzione/italiano-arabo/autocarro; Glosbe Arabo-Italiano, شاحنة: https://glosbe.com/ar/it/%D8%B4%D8%A7%D8%AD%D9%86%D8%A9; ACI Codice della Strada, art. 54 (Italian legal sense only): https://aci.gov.it/codice-della-strada/art-54/; batch13 paired app contexts: /workspace/patente_b_dictionary_audit/batch13_inputs/batch13_autocarri.json",
    "ciclomotori": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italiano-Arabo, ciclomotore: https://glosbe.com/it/ar/ciclomotore; Reverso Context Italiano-Arabo, scooter (related term only): https://context.reverso.net/traduzione/italiano-arabo/scooter; Normattiva Codice della Strada, art. 52 (Italian legal sense only): https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1992-04-30;285!vig=2026-11-22#art52; batch13 paired app contexts and lesson: /workspace/patente_b_dictionary_audit/batch13_inputs/batch13_ciclomotori.json",
})

# Batch-fourteen corrections from full app-context packs and opened bilingual evidence.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "curva": (
        "منعطف (للطريق)؛ منحنى/انحناء (للمسار الهندسي)",
        "contextual_translation",
        "88 question-token occurrences in 86 distinct paired question contexts and 2 lesson-text occurrences in 1 lesson record. Road contexts predominantly mean a bend/turn, while radius and shape contexts use geometric curve/curvature. Reverso Italian-Arabic and Glosbe directly support both منعطف and منحنى in context; the sense-qualified gloss avoids forcing one equivalent across both uses.",
    ),
    "sinistro": (
        "أيسر؛ حادث (مروري)",
        "contextual_translation",
        "76 question-token occurrences in 76 distinct paired question contexts and no lesson matches. The adjective means left/left-hand, while the noun in sinistro stradale means a traffic accident. Reverso's exact Italian-Arabic headword examples support الجانب الأيسر and الحادث; the gloss preserves both app senses without treating the Italian legal source as Arabic evidence.",
    ),
    "visibilità": (
        "الرؤية؛ مدى/وضوح الرؤية بحسب السياق",
        "contextual_translation",
        "75 question-token occurrences in 75 distinct paired question contexts and 10 lesson-text occurrences across 5 lesson records. The app uses cover a driver's ability/range of sight and visibility/conspicuousness (alta visibilità); Reverso Italian-Arabic examples support رؤية, وضوح, and ظهور. The old مدى الرؤية is too narrow as a sole gloss.",
    ),
    "arrestarsi": (
        "التوقّف",
        "contextual_translation",
        "73 question-token occurrences in 73 distinct paired question contexts and 2 lesson-text occurrences across 2 records; all app uses mean a vehicle/driver stopping or being ready to stop. The prior dictionary string contained stray literal quotation marks around التوقّف; those marks are removed as a formatting correction, while the meaning remains unchanged. The opened exact-headword Reverso bilingual examples support the stopping sense.",
    ),
    "parcheggio": (
        "موقف سيارات؛ ركن/وقوف السيارة بحسب السياق",
        "contextual_translation",
        "59 question-token occurrences in 57 distinct paired question contexts and no lesson matches. App contexts use parcheggio for both a parking area/facility and parking as an action or manoeuvre (including parking sensors). Reverso Italian-Arabic supports موقف سيارات for the place; opened bilingual examples support ركن السيارة for the action.",
    ),
    "carreggiate": (
        "أجزاء الطريق المخصّصة لسير المركبات",
        "contextual_translation",
        "56 question-token occurrences in 56 distinct paired question contexts and no lesson matches. The app uses the plural for vehicle-carrying road sections, sometimes divided into multiple lanes; it is not the same as one lane, and the old مركّب is unrelated. Reverso bilingual examples support the road sense, while ACI Article 3 supports only the Italian legal distinction between carreggiata and corsia.",
    ),
    "arresto": (
        "التوقّف؛ الاعتقال بحسب السياق",
        "contextual_translation",
        "55 question-token occurrences in 55 distinct paired question contexts and 11 lesson-text occurrences across 5 records. The app includes the traffic interruption/stop sense and the criminal-custody sense; Reverso's opened Italian-Arabic examples support توقف and اعتقال. Gazzetta Ufficiale Article 157 establishes only the Italian road-code meaning, not an Arabic equivalent.",
    ),
    "frenatura": (
        "الكبح؛ الفرملة (فعل/نظام بحسب السياق)",
        "contextual_translation",
        "52 question-token occurrences in 52 distinct paired question contexts and no lesson matches. The contexts use frenatura for the braking action/process, braking distance, and braking systems; the old فرامل names the hardware and is too narrow. Reverso Italian-Arabic examples support الكبح/الفرملة; Treccani supports Italian semantic range only.",
    ),
    "ciclisti": (
        "راكبو الدراجات الهوائية",
        "contextual_translation",
        "44 question-token occurrences in 44 distinct paired question contexts and 3 lesson-text occurrences across 2 records. Every supplied use means bicycle riders, explicitly distinguished in some contexts from moped riders. The opened Italian-Arabic ciclista headword gives راكب دراجة هوائية; the plural gloss makes the rider sense explicit.",
    ),
    "casco": (
        "خوذة",
        "contextual_translation",
        "44 question-token occurrences in 43 distinct paired question contexts and 4 lesson-text occurrences in 1 record. Every supplied use means protective headgear for motorcycle, moped, quad, or bicycle users. Direct Italian-Arabic examples support خوذة; the change corrects the Arabic spelling from خوذه to خوذة without changing the sense.",
    ),
    "lampeggiante": (
        "وامض؛ ضوء/مصباح وامض (للاسم)",
        "contextual_translation",
        "38 question-token occurrences in 38 distinct paired question contexts and 1 lesson-text occurrence in 1 record. The app uses lampeggiante for flashing signal lights and an emergency beacon; لامع means shiny and misses the flashing action. Reverso's exact Italian-Arabic headword supports وامض; ACI Article 41 supplies Italian traffic-signal context only.",
    ),
    "soccorso": (
        "إسعاف؛ إنقاذ؛ مساعدة/إغاثة بحسب السياق",
        "contextual_translation",
        "38 question-token occurrences in 37 distinct paired question contexts and 3 lesson-text occurrences across 2 records. The app spans medical first aid/emergency care, helping an injured or stranded person, and roadside rescue/recovery; the single prior gloss مساعدة is underspecified. Opened bilingual examples support context-dependent إسعاف, إنقاذ, and assistance wording; the MIT circular establishes the Italian roadside-assistance sense only.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "curva": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italiano-Arabo: https://dizionario.reverso.net/italiano-arabo/curva; Glosbe exact headword: https://glosbe.com/it/ar/curva; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/curva; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_curva.json",
    "sinistro": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso exact Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/sinistro; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_sinistro.json",
    "visibilità": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/visibilit%C3%A0; Treccani Italian semantics only: https://www.treccani.it/vocabolario/visibilita/; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_visibilità.json",
    "arrestarsi": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso exact Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/arrestarsi; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/arrestarsi; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_arrestarsi.json",
    "parcheggio": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/parcheggio; Reverso Context: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/parcheggio; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_parcheggio.json",
    "carreggiate": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic, carreggiata: https://context.reverso.net/traduzione/italiano-arabo/carreggiata; ACI Codice della Strada art. 3 (Italian legal sense only): https://aci.gov.it/codice-della-strada/art-3/; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_carreggiate.json",
    "arresto": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/arresto; reverse Reverso Arabic-Italian for اعتقال: https://dizionario.reverso.net/arabo-italiano/%D8%A7%D9%90%D8%B9%D9%92%D8%AA%D9%90%D9%82%D8%A7%D9%84; Gazzetta Ufficiale Codice della Strada art. 157 (Italian legal sense only): https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=17&art.idGruppo=11&art.flagTipoArticolo=0&art.codiceRedazionale=092G0306&art.idArticolo=157&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=1992-05-18&art.progressivo=0; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_arresto.json",
    "frenatura": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/frenatura; Treccani Italian semantics only: https://www.treccani.it/vocabolario/frenatura/; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_frenatura.json",
    "ciclisti": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic headword, singular ciclista: https://dizionario.reverso.net/italiano-arabo/ciclista; ACI Codice della Strada art. 182 (Italian legal sense only): https://aci.gov.it/codice-della-strada/art-182/; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_ciclisti.json",
    "casco": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic Context: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/casco; Reverso Arabic-Italian خوذة: https://dizionario.reverso.net/arabo-italiano/%D8%AE%D9%88%D8%B0%D8%A9; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_casco.json",
    "lampeggiante": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso exact Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/lampeggiante; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/lampeggiante; ACI Codice della Strada art. 41 (Italian legal sense only): https://www.aci.it/fileadmin/cds/art-41.php; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_lampeggiante.json",
    "soccorso": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context exact query: https://context.reverso.net/traduzione/italiano-arabo/soccorso; reverse Reverso Arabic-Italian إسعاف: https://dizionario.reverso.net/arabo-italiano/%D8%A5%D8%B3%D8%B9%D8%A7%D9%81; MIT roadside-assistance circular (Italian legal sense only): https://www.mit.gov.it/normativa/circolare-numero-3279-del-24051999; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_soccorso.json",
})

# Batch-fourteen unchanged glosses; all supplied contexts and bilingual evidence were reviewed.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "bambini": (
        "الأطفال",
        "contextual_translation",
        "63 question-token occurrences in 62 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. All supplied uses mean children, including road users, passengers subject to child-restraint rules, and children in fixed phrases. Glosbe's exact Italian-Arabic bambini entry and Reverso bilingual examples support أطفال/الأطفال; the existing gloss is confirmed unchanged and marked reviewed.",
    ),
    "incidente": (
        "حادث",
        "contextual_translation",
        "58 question-token occurrences in 57 distinct paired question contexts and 6 lesson-text occurrences across 2 records. Supplied contexts consistently use incidente for a road/vehicle accident or its occurrence; Reverso's direct Italian-Arabic exact-headword examples support حادث/الحادث. The existing gloss is confirmed unchanged for these app senses; broader Italian senses are not asserted.",
    ),
    "marciapiede": (
        "رصيف",
        "contextual_translation",
        "45 question-token occurrences in 45 distinct paired question contexts and 3 lesson-text occurrences in 1 matching record. Every supplied context concerns the pedestrian sidewalk beside the carriageway, including ramps and edges. Reverso Italian-Arabic examples and a reverse Glosbe entry support رصيف; the existing gloss is confirmed unchanged for this road sense.",
    ),
    "pioggia": (
        "مطر",
        "contextual_translation",
        "42 question-token occurrences in 42 distinct paired question contexts and 2 lesson-text occurrences across 2 records. All supplied uses mean meteorological rain/rainfall or rainy conditions affecting driving. Arabdict and Reverso direct Italian-Arabic headword evidence support مطر; the existing broad gloss is confirmed unchanged.",
    ),
    "assicurazione": (
        "التأمين",
        "contextual_translation",
        "41 question-token occurrences in 38 distinct paired question contexts and 5 lesson-text occurrences in 1 matching record. Supplied contexts concern motor insurance, coverage, the insurer, policies, and certificates. Arabita's direct Italian-Arabic headword and Reverso bilingual vehicle-insurance examples support التأمين; the existing gloss is confirmed unchanged for these app uses.",
    ),
    "incidenti": (
        "حوادث",
        "contextual_translation",
        "38 question-token occurrences in 38 distinct paired question contexts and no lesson matches. All supplied contexts concern accidents/incidents to prevent, cause, report, or insure against. Reverso's exact plural-query Italian-Arabic examples support حوادث; the existing gloss is confirmed unchanged for the app contexts.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "bambini": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic exact headword: https://it.glosbe.com/it/ar/bambini; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/bambini; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_bambini.json",
    "incidente": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso exact Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/incidente; Reverso Context for incidente stradale: https://context.reverso.net/traduzione/italiano-arabo/incidente+stradale; Treccani Italian semantics only: https://www.treccani.it/vocabolario/incidente/; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_incidente.json",
    "marciapiede": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/marciapiede; reverse Glosbe Arabic-Italian: https://it.glosbe.com/ar/it/%D8%B1%D8%B5%D9%8A%D9%81; official Italian legal definition only: https://www1.interno.gov.it/mininterno/site/it/sezioni/servizi/old_servizi/legislazione/codice_strada/legislazione_34.html; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_marciapiede.json",
    "pioggia": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabdict Italian-Arabic headword: https://www.arabdict.com/it/italian-arabic/pioggia; Reverso Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/pioggia; Glosbe examples: https://it.glosbe.com/it/ar/pioggia; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_pioggia.json",
    "assicurazione": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabita direct Italian-Arabic headword: https://arabita.news/dizionario/2315; Reverso Context vehicle-insurance examples: https://context.reverso.net/traduzione/italiano-arabo/assicurazione; Treccani Italian semantic context only: https://www.treccani.it/vocabolario/assicurazione/; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_assicurazione.json",
    "incidenti": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic exact plural query: https://context.reverso.net/traduzione/italiano-arabo/incidenti; related singular examples: https://context.reverso.net/traduzione/italiano-arabo/incidente; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch14_inputs/batch14_incidenti.json",
})

# Batch-fifteen corrections and unchanged-gloss confirmations from complete paired contexts.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "emergenza": (
        "طارئ؛ حالة طارئة؛ طوارئ (بحسب السياق)",
        "contextual_translation",
        "78 question-token occurrences in 78 distinct paired question contexts and 9 lesson-text occurrences across 3 matching lessons. App uses include the noun (emergency situation/service) and adjective compounds such as emergency lane, lights, braking, and switch; حالة طارئة is valid but too narrow as a sole gloss. Opened Arabdict Italian-Arabic entry directly lists طارئة، طوارئ، طارئ، and حالة طوارئ, supporting a compact sense-qualified gloss.",
    ),
    "rimorchi": (
        "مقطورات",
        "contextual_translation",
        "41 question-token occurrences in 41 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. All app uses denote trailers (including caravan, agricultural, T.A.T.S., horse, and semitrailer contexts), not the act of towing; the current السحب is wrong for this noun. Opened Reverso Italian-Arabic noun examples support مقطورة / عربة مقطورة; the plural gloss is مقطورات.",
    ),
    "cinture": (
        "أحزمة الأمان",
        "contextual_translation",
        "27 question-token occurrences in 27 distinct paired question contexts and 3 lesson-text occurrences across 2 matching lessons. All app uses refer to vehicle safety/seat belts; the existing generic singular حزام omits the safety sense and plural. Opened Italian-Arabic examples support حزام الأمان for cintura di sicurezza, and the opened reverse Glosbe entry defines the safety belt directly.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "emergenza": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Arabdict direct Italian-Arabic entry: https://www.arabdict.com/ar/عربي-إيطالي/emergenza; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_emergenza.json",
    "rimorchi": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic exact noun entry, rimorchio: https://dizionario.reverso.net/italiano-arabo/rimorchio; complete paired app contexts and lesson: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_rimorchi.json",
    "cinture": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic examples, cintura di sicurezza: https://context.reverso.net/traduzione/italiano-arabo/cintura+di+sicurezza; Glosbe Arabic-Italian safety-belt entry: https://glosbe.com/ar/it/%D8%AD%D8%B2%D8%A7%D9%85%20%D8%A7%D9%84%D8%A3%D9%85%D8%A7%D9%86; complete paired app contexts and lessons: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_cinture.json",
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "autovettura": (
        "سيارة ركاب",
        "contextual_translation",
        "83 question-token occurrences in 82 distinct paired question contexts and 3 lesson-text occurrences in 1 matching lesson. App uses consistently denote a passenger-car category, distinguished from buses, trucks, motorcycles, and trailers; the existing gloss fits. Opened Reverso Italian-Arabic examples support سيارة and سيارة للركاب; ordinary paired app Arabic is contextual evidence only.",
    ),
    "biciclette": (
        "الدراجات",
        "contextual_translation",
        "47 question-token occurrences in 47 distinct paired question contexts and no lesson matches. Every supplied use denotes bicycles as road vehicles; no distinct sense conflicts. Opened Glosbe and Reverso Italian-Arabic examples support دراجة / دراجة هوائية, making the existing plural الدراجات adequate.",
    ),
    "ferito": (
        "مصاب",
        "contextual_translation",
        "38 question-token occurrences in 38 distinct paired question contexts and no lesson matches. All app uses refer to an injured person/casualty in first-aid and road-accident scenarios; opened Reverso Italian-Arabic examples support مصاب for an injured person. Other senses do not appear in the supplied contexts.",
    ),
    "caduta": (
        "سقوط",
        "contextual_translation",
        "35 question-token occurrences in 35 distinct paired question contexts and no lesson matches. App uses concern physical falling/dropping (rocks, riders, cargo, and hazardous substances); opened Reverso Italian-Arabic examples support سقوط. Other dictionary senses are absent from these contexts.",
    ),
    "clacson": (
        "بوق",
        "contextual_translation",
        "34 question-token occurrences in 34 distinct paired question contexts and 3 lesson-text occurrences in 1 matching lesson. Every use refers to a vehicle's audible warning horn; opened Reverso Italian-Arabic examples directly list بوق and بوق السيارة. The existing gloss is adequate.",
    ),
    "motociclo": (
        "دراجة نارية",
        "contextual_translation",
        "34 question-token occurrences in 34 distinct paired question contexts and no lesson matches. All app uses refer to a motorcycle/motorbike; opened Reverso Italian-Arabic examples support بطارية الدراجة النارية and قطع غيار الدراجات النارية. The existing gloss remains accurate for these contexts.",
    ),
    "freno": (
        "مكبح",
        "contextual_translation",
        "30 question-token occurrences in 30 distinct paired question contexts and 2 lesson-text occurrences in 1 matching lesson. Contexts cover the general braking device/system, parking brake, and trailer brakes; the core noun remains مكبح. Opened Italian-Arabic examples for freno di stazionamento render it فرامل اليد / فرملة الانتظار, supporting the brake-device sense without requiring a phrase-specific gloss for the standalone lemma.",
    ),
    "pedone": (
        "مشاة",
        "contextual_translation",
        "29 question-token occurrences in 29 distinct paired question contexts and 3 lesson-text occurrences across 2 matching lessons. All uses refer to people walking on or crossing roads, including a person pushing a stroller. The opened Italian-Arabic vocabulary page gives مشاة for pedone; confidence is medium because the short entry does not distinguish singular and collective morphology, but the existing collective glossary fits these app uses.",
    ),
    "nebbia": (
        "ضباب",
        "contextual_translation",
        "29 question-token occurrences in 27 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. Contexts concern weather fog/reduced visibility and fog-light compounds. Opened Glosbe Italian-Arabic evidence lists ضباب and gives nebbia spessa as الضباب الكثيف; the existing gloss is confirmed.",
    ),
    "neve": (
        "ثلج",
        "contextual_translation",
        "25 question-token occurrences in 24 distinct paired question contexts and no lesson matches. All uses concern snow, snowfall, or snow cover affecting driving; opened Reverso Italian-Arabic examples support ثلج. The existing gloss is confirmed.",
    ),
    "freni": (
        "فرامل",
        "contextual_translation",
        "24 question-token occurrences in 24 distinct paired question contexts and 6 lesson-text occurrences across 2 matching lessons. Contexts consistently refer to vehicle brakes/braking devices, including brake-fluid and performance contexts. Opened Reverso Italian-Arabic brake-compound examples support فرامل; an opened English-Arabic brake entry is supplementary only. The existing plural gloss is confirmed.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "autovettura": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic examples: https://context.reverso.net/traduzione/italiano-arabo/autovettura; complete paired app contexts and lesson: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_autovettura.json",
    "biciclette": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic, bicicletta: https://it.glosbe.com/it/ar/bicicletta; Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/bicicletta; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_biciclette.json",
    "ferito": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso exact Italian-Arabic entry: https://dizionario.reverso.net/italiano-arabo/ferito; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_ferito.json",
    "caduta": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso exact Italian-Arabic entry: https://dizionario.reverso.net/italiano-arabo/caduta; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_caduta.json",
    "clacson": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/translation/italian-arabic/clacson; complete paired app contexts and lesson: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_clacson.json",
    "motociclo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/motociclo; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_motociclo.json",
    "freno": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic, freno di stazionamento: https://dizionario.reverso.net/italiano-arabo/freno+di+stazionamento; complete paired app contexts and lesson: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_freno.json",
    "pedone": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Lexis Rex Italian-Arabic vocabulary page: https://www.lexisrex.com/Arabo/Parole/pedone; complete paired app contexts and lessons: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_pedone.json",
    "nebbia": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic exact headword: https://ar.glosbe.com/it/ar/nebbia; complete paired app contexts and lesson: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_nebbia.json",
    "neve": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic exact headword: https://dizionario.reverso.net/italiano-arabo/neve; complete paired app contexts: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_neve.json",
    "freni": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic brake example: https://dizionario.reverso.net/italiano-arabo/freno+di+stazionamento; supplementary English-Arabic brake entry: https://www.wordreference.com/enar/brake; complete paired app contexts and lessons: /workspace/patente_b_dictionary_audit/batch15_inputs/batch15_freni.json",
})

# Batch-sixteen corrections and unchanged-gloss confirmations from complete paired contexts.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "frenata": (
        "فرملة",
        "contextual_translation",
        "23 question-token occurrences in 23 distinct paired question contexts and 4 lesson-text occurrences across 2 matching lessons. All app uses refer to vehicle braking as an action/process. Opened Reverso Italian-Arabic examples directly support فرملة/الفرملة for frenata in traffic; the existing كبح is related but less precise as a noun gloss.",
    ),
    "marciare": (
        "السير",
        "contextual_translation",
        "22 question-token occurrences in 22 distinct paired question contexts and no lesson matches. App uses marciare for movement/proceeding, often of vehicles; existing سر is not the dictionary verb form required here. Opened Reverso Italian-Arabic examples support السير/يسير, and Treccani confirms the vehicle sense procedere/avanzare.",
    ),
    "sterzo": (
        "المقود؛ نظام التوجيه",
        "contextual_translation",
        "17 question-token occurrences in 17 distinct paired question contexts and no lesson matches. App uses include both the physical steering wheel and the steering mechanism/system (including servosterzo); the old gloss omits the physical-wheel sense. Opened Reverso Italian-Arabic examples and reverse Glosbe headword evidence support both المقود/عجلة القيادة and نظام التوجيه.",
    ),
    "consentire": (
        "يسمح، يتيح",
        "contextual_translation",
        "16 question-token occurrences in 16 distinct paired question contexts and no lesson matches. App uses mean allow, permit, enable, or make possible in road/maneuver contexts. Existing اسمح is an Arabic imperative, not the Italian infinitive; opened Reverso Italian-Arabic entries/examples support يسمح/يتيح, and Treccani confirms the relevant Italian sense.",
    ),
    "parcheggiare": (
        "يركن (السيارة)",
        "contextual_translation",
        "15 question-token occurrences in 15 distinct paired question contexts and no lesson matches. All app uses mean to park a vehicle or perform a parking maneuver. Existing قف is an imperative meaning stop; opened Glosbe Italian-Arabic examples support صفّ/وقّف for parking and Treccani defines the vehicle-parking sense.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "frenata": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic context for frenata: https://context.reverso.net/traduzione/italiano-arabo/frenata; supporting Reverso entries for frenare and freno: https://dizionario.reverso.net/italiano-arabo/frenare and https://dizionario.reverso.net/italiano-arabo/freno; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_frenata.json",
    "marciare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic examples: https://context.reverso.net/traduzione/italiano-arabo/marciare; Treccani vehicle sense: https://www.treccani.it/vocabolario/marciare/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_marciare.json",
    "sterzo": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic examples: https://context.reverso.net/traduzione/italiano-arabo/sterzo; reverse Glosbe for عجلة القيادة: https://it.glosbe.com/ar/it/%D8%B9%D8%AC%D9%84%D8%A9%20%D8%A7%D9%84%D9%82%D9%8A%D8%A7%D8%AF%D8%A9; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_sterzo.json",
    "consentire": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic entry/examples: https://dizionario.reverso.net/italiano-arabo/consentire and https://context.reverso.net/traduzione/italiano-arabo/consentire; Treccani Italian sense: https://www.treccani.it/vocabolario/consentire/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_consentire.json",
    "parcheggiare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Glosbe Italian-Arabic: https://glosbe.com/it/ar/parcheggiare; Reverso context: https://context.reverso.net/translation/italian-arabic/posso+parcheggiare; Treccani Italian sense: https://www.treccani.it/vocabolario/parcheggiare/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_parcheggiare.json",
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "traino": (
        "سحب",
        "contextual_translation",
        "23 question-token occurrences in 22 distinct paired question contexts and no lesson matches. In the app, traino is the noun for towing/tow force or related towing equipment; سحب fits. Opened Reverso Italian-Arabic examples for traino and fune di traino support سحب/جرّ and towing expressions.",
    ),
    "arrestare": (
        "أوقف",
        "contextual_translation",
        "17 question-token occurrences in 17 distinct paired question contexts and 2 lesson-text occurrences in 1 matching lesson. App contexts use arrestare transitively for bringing a vehicle, engine, movement, bleeding, or process to a stop, not police arrest. Reverso supports وقف for a non-police stop sense and Treccani distinguishes stopping from legal custody; أوقف fits these app uses.",
    ),
    "cintura": (
        "حزام",
        "contextual_translation",
        "15 question-token occurrences in 15 distinct paired question contexts and 5 lesson-text occurrences across 2 matching lessons. All contexts refer to a vehicle safety belt/restraint; opened Glosbe and Reverso Italian-Arabic examples support حزام and حزام الأمان for cintura/cintura di sicurezza. The standalone gloss حزام is accurate and confirmed unchanged.",
    ),
    "frenare": (
        "يفرمل / يكبح",
        "contextual_translation",
        "15 question-token occurrences in 15 distinct paired question contexts and no lesson matches. App contexts concern braking or slowing a vehicle; opened Reverso Italian-Arabic examples support كبح for frenare in driving. The existing verb gloss is confirmed unchanged and its earlier preliminary candidate flag is cleared.",
    ),
    "ghiaccio": (
        "جليد",
        "contextual_translation",
        "14 question-token occurrences in 14 distinct paired question contexts and no lesson matches. Every app use is literal physical ice or road ice; opened Reverso Italian-Arabic examples support جليد. Figurative idioms are absent; the existing gloss is confirmed unchanged.",
    ),
    "frizione": (
        "قابض",
        "contextual_translation",
        "9 question-token occurrences in 9 distinct paired question contexts and no lesson matches. All uses denote an automotive clutch or clutch pedal, not general friction; opened Reverso Italian-Arabic examples support قابض/دواسة القابض, while Treccani distinguishes the vehicle device from the friction sense. Existing gloss confirmed unchanged.",
    ),
    "illuminazione": (
        "الإضاءة",
        "contextual_translation",
        "9 question-token occurrences in 9 distinct paired question contexts and no lesson matches. All uses concern literal vehicle/road lighting and its adequacy; opened Reverso Italian-Arabic examples support الإضاءة/إنارة. Figurative senses are absent; existing gloss confirmed unchanged.",
    ),
    "pneumatico": (
        "إطار",
        "contextual_translation",
        "9 question-token occurrences in 8 distinct paired question contexts and no lesson matches. All uses denote vehicle tires (one question contains two occurrences); opened Glosbe and Reverso Italian-Arabic entries support إطار for the tire noun. The air-powered adjective sense is absent; existing gloss confirmed unchanged.",
    ),
    "ciclista": (
        "راكب دراجة",
        "contextual_translation",
        "7 question-token occurrences in 7 distinct paired question contexts and 4 lesson-text occurrences across 2 matching lessons. Every use refers to a person riding a bicycle; opened Reverso Italian-Arabic examples support راكب دراجة/دراج. Existing gloss confirmed unchanged.",
    ),
    "bicicletta": (
        "دراجة",
        "contextual_translation",
        "7 question-token occurrences in 7 distinct paired question contexts and no lesson matches. All uses are the bicycle noun; opened Glosbe and Reverso Italian-Arabic examples support دراجة/دراجة هوائية. No competing app sense appears; existing gloss confirmed unchanged.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "traino": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic traino examples: https://context.reverso.net/traduzione/italiano-arabo/traino; fune di traino: https://dizionario.reverso.net/italiano-arabo/fune+di+traino; reverse Glosbe for جرّ: https://it.glosbe.com/ar/it/%D8%AC%D8%B1%D9%91; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_traino.json",
    "arrestare": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic entry: https://dizionario.reverso.net/italiano-arabo/arrestare; Treccani senses: https://www.treccani.it/vocabolario/arrestare2/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_arrestare.json",
    "cintura": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic: https://it.glosbe.com/it/ar/cintura; Reverso Italian-Arabic examples: https://context.reverso.net/traduzione/italiano-arabo/cintura; Treccani definition: https://www.treccani.it/vocabolario/cintura/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_cintura.json",
    "frenare": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic entry: https://dizionario.reverso.net/italiano-arabo/frenare; Reverso Arabic-Italian traffic examples: https://context.reverso.net/traduzione/arabo-italiano/%D8%A7%D9%84%D9%81%D8%B1%D8%A7%D9%85%D8%A7%D9%84; Cambridge vehicle sense: https://dictionary.cambridge.org/us/dictionary/italian-english/frenare; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_frenare.json",
    "ghiaccio": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic examples: https://context.reverso.net/traduzione/italiano-arabo/ghiaccio; Collins semantics: https://www.collinsdictionary.com/dictionary/italian-english/ghiaccio; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_ghiaccio.json",
    "frizione": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/frizione; Reverso Context: https://context.reverso.net/traduzione/italiano-arabo/frizione; Treccani: https://www.treccani.it/vocabolario/frizione/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_frizione.json",
    "illuminazione": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic headword: https://dizionario.reverso.net/italiano-arabo/illuminazione; Treccani: https://www.treccani.it/vocabolario/illuminazione/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_illuminazione.json",
    "pneumatico": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic: https://it.glosbe.com/it/ar/pneumatico; Reverso Italian-Arabic contexts: https://context.reverso.net/traduzione/italiano-arabo/pneumatico; Treccani tire noun sense: https://www.treccani.it/vocabolario/pneumatico3/; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_pneumatico.json",
    "ciclista": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic examples: https://context.reverso.net/traduzione/italiano-arabo/ciclista; Collins Italian-English noun entry: https://www.collinsdictionary.com/dictionary/english-italian/cyclist; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_ciclista.json",
    "bicicletta": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic: https://it.glosbe.com/it/ar/bicicletta; Reverso Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/bicicletta; full app contexts: /workspace/patente_b_dictionary_audit/batch16_inputs/batch16_bicicletta.json",
})

# Batch-seventeen confirmations and corrections, based on complete paired app contexts.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "ciclomotore": (
        "دراجة بمحرك صغير",
        "contextual_translation",
        "6 question-token occurrences in 6 distinct paired question contexts and no lesson matches. All app uses refer to the Italian small-motor-vehicle class; the current descriptive gloss is supported by Reverso's Italian-Arabic equivalent and remains understandable in context. ACI Article 52 corroborates only the Italian legal category, not Arabic wording.",
    ),
    "feriti": (
        "جرحى",
        "contextual_translation",
        "6 question-token occurrences in 6 distinct paired question contexts and no lesson matches. All app uses mean people injured in road incidents; direct bilingual evidence for singular ferito supports مصاب/جريح, and the existing plural جرحى fits the app contexts.",
    ),
    "volante": (
        "عجلة القيادة",
        "contextual_translation",
        "6 question-token occurrences in 6 distinct paired question contexts and no lesson matches. Every app use refers to the physical steering wheel; opened Italian-Arabic Reverso examples explicitly support عجلة القيادة and المقود.",
    ),
    "precedere": (
        "يسبق",
        "contextual_translation",
        "1 question-token occurrence in 1 distinct paired question context and no lesson matches. The sole app use means that a sign comes before another; Reverso and Arabdict Italian-Arabic support يسبق/سبق, and Treccani confirms the come-before sense. Existing gloss confirmed unchanged for this app use.",
    ),
    "veicolo": (
        "مركبة",
        "contextual_translation",
        "1278 question-token occurrences in 1057 distinct paired question contexts and 47 lesson-text occurrences across 19 lessons. The app uses the general road-vehicle noun; opened Reverso and Arabdict Italian-Arabic sources support مركبة. The reviewer initially undercounted lesson hits (41 vs 47); an independent exact-token recount of Italian lesson fields verified the pack and manifest at 47/19 before this unchanged-gloss confirmation.",
    ),
    "strada": (
        "الطريق",
        "contextual_translation",
        "791 question-token occurrences in 778 distinct paired question contexts and 22 lesson-text occurrences across 12 lessons. App contexts use strada for roads/roadways, road sections, and routes; Reverso Italian-Arabic supports طريق/شارع and Treccani confirms the road/path senses. Existing gloss confirmed unchanged for these contexts.",
    ),
    "velocità": (
        "السرعة",
        "contextual_translation",
        "496 question-token occurrences in 494 distinct paired question contexts and 20 lesson-text occurrences across 5 lessons. The app uses the word mainly for road/vehicle speed, limits, and safe speed; Glosbe Italian-Arabic supports السرعة and Treccani confirms the vehicle-speed sense. Existing standalone gloss confirmed unchanged; compounds remain phrase-dependent.",
    ),
    "precedenza": (
        "أولوية المرور",
        "contextual_translation",
        "465 question-token occurrences in 449 distinct paired question contexts and 22 lesson-text occurrences across 5 lessons. All reviewed app uses concern traffic right-of-way/priority; Arabdict supports أولوية/أسبقية and Treccani confirms the road-priority sense. Existing gloss confirmed unchanged for these app contexts.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "ciclomotore": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/translation/italian-arabic/ciclomotore; ACI Codice della Strada, art. 52 (Italian legal category only): https://aci.gov.it/codice-della-strada/art-52/; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_ciclomotore.json",
    "feriti": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic, ferito: https://context.reverso.net/traduzione/italiano-arabo/ferito; Treccani: https://www.treccani.it/vocabolario/ferito/; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_feriti.json",
    "volante": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic, volante: https://context.reverso.net/traduzione/italiano-arabo/volante; Reverso Context, al volante: https://context.reverso.net/traduzione/italiano-arabo/al+volante; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_volante.json",
    "precedere": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic dictionary: https://dizionario.reverso.net/italiano-arabo/precedere; Arabdict Italian-Arabic: https://www.arabdict.com/it/italian-arabic/precedere; Treccani: https://www.treccani.it/vocabolario/precedere/; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_precedere.json",
    "veicolo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/veicolo; Arabdict Italian-Arabic: https://www.arabdict.com/es/italian-arabic/%D8%A7%D9%84%D9%85%D8%B1%D9%83%D8%A8%D8%A9; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_veicolo.json",
    "strada": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic dictionary: https://dizionario.reverso.net/italiano-arabo/strada; Treccani: https://www.treccani.it/vocabolario/strada/; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_strada.json",
    "velocità": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic: https://glosbe.com/it/ar/velocit%C3%A0; Treccani: https://www.treccani.it/vocabolario/velocita/; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_velocita.json",
    "precedenza": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabdict Italian-Arabic: https://www.arabdict.com/en/italian-arabic/precedenza; Treccani: https://www.treccani.it/vocabolario/precedenza/; full app contexts: /workspace/patente_b_dictionary_audit/batch17_inputs/batch17_precedenza.json",
})

# Batch-eighteen source-backed corrections and unchanged-gloss confirmations.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "segnaletica": (
        "إشارات وعلامات المرور",
        "contextual_translation",
        "85 question-token occurrences in 85 distinct paired question contexts and 16 lesson-text occurrences across 5 matching lessons. App uses include road signs and horizontal road markings; the old إشارات المرورية underrepresents road markings. Reverso Italian-Arabic supports علامات الطريق/إشارات المرور; Treccani and ACI Article 38 confirm the Italian category includes horizontal, vertical, light, and complementary signage. The broader gloss is specific to the app’s traffic-signage sense.",
    ),
    "inversione": (
        "عكس اتجاه السير",
        "contextual_translation",
        "47 question-token occurrences in 47 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. Every app use is the traffic maneuver inversione (del) senso di marcia; the current bare عكس is too vague. Reverso supports the general عكس/انعكاس sense, and ACI Article 154 plus Treccani confirm the road-maneuver sense. The replacement is context-specific; inversione remains polysemous outside this app use.",
    ),
    "segnalare": (
        "يشير إلى / ينبّه إلى؛ يُبلّغ عن",
        "contextual_translation",
        "43 question-token occurrences in 43 distinct paired question contexts and 2 lesson-text occurrences across 2 matching lessons. Most app uses mean signal/indicate or warn; a smaller set means report/notify. The current أبلغ alone misses the dominant signaling sense. Direct Reverso and Glosbe Italian-Arabic examples support يشير إلى/أشار and distinguish report examples with الإبلاغ عن/بلاغات; ACI Article 154 confirms the traffic-signaling use. The alternatives are sense-specific, not interchangeable in every sentence.",
    ),
    "fermo": (
        "متوقف",
        "contextual_translation",
        "32 question-token occurrences in 32 distinct paired question contexts and no matching lesson record. All app uses describe a person or vehicle as stopped/stationary; the existing imperative قف does not fit the adjective. Reverso Italian-Arabic directly renders stationary/stopped examples with التوقف/المتوقفة, while Treccani confirms the relevant adjective sense. Other meanings of fermo are outside this context-specific correction.",
    ),
    "attraversamenti": (
        "المعابر",
        "contextual_translation",
        "14 question-token occurrences in 14 distinct paired question contexts and 3 lesson-text occurrences across 2 matching lessons. App uses concern road/pedestrian crossings; the old verbal noun العبور does not identify the crossing places. Arabdict and Glosbe Italian-Arabic support معبر/معابر in crossing contexts, and Treccani confirms the Italian crossing/place sense.",
    ),
    "mezzi": (
        "مركبات / وسائل نقل",
        "contextual_translation",
        "13 question-token occurrences in 12 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. In the app, mezzi refers to road vehicles/means of transport; the current نصف is unrelated. Treccani confirms the vehicle/transport sense, and Glosbe/Reverso Italian-Arabic examples support وسائل نقل and vehicle-related Arabic wording. The paired app contexts distinguish the vehicle sense from the broader means/resources sense.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "segnaletica": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/segnaletica+stradale; Treccani: https://www.treccani.it/vocabolario/segnaletica/; ACI Codice della Strada, art. 38: https://aci.gov.it/codice-della-strada/art-38/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_segnaletica.json",
    "inversione": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/inversione; ACI Codice della Strada, art. 154: https://aci.gov.it/codice-della-strada/art-154/; Treccani: https://www.treccani.it/vocabolario/inversione/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_inversione.json",
    "segnalare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/segnalare; Glosbe Italian-Arabic: https://it.glosbe.com/it/ar/segnalare; ACI Codice della Strada, art. 154: https://www.aci.it/fileadmin/cds/art-154.php; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_segnalare.json",
    "fermo": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/fermo; Treccani: https://www.treccani.it/vocabolario/fermo1/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_fermo.json",
    "attraversamenti": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Arabdict Italian-Arabic: https://www.arabdict.com/ar/%D8%B9%D8%B1%D8%A8%D9%8A-%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A/attraversamento; Glosbe Italian-Arabic, attraversamento pedonale: https://glosbe.com/it/ar/attraversamento%20pedonale; Treccani: https://www.treccani.it/vocabolario/attraversamento/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_attraversamenti.json",
    "mezzi": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Treccani, mezzo: https://www.treccani.it/vocabolario/mezzo2/; Glosbe Italian-Arabic, mezzi pubblici: https://glosbe.com/it/ar/mezzi%20pubblici; ACI Codice della Strada, artt. 7 and 158: https://aci.gov.it/codice-della-strada/art-7/ and https://aci.gov.it/codice-della-strada/art-158/; Reverso Italian-Arabic: https://dictionary.reverso.net/italian-arabic/mezzi; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_mezzi.json",
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "conducenti": (
        "السائقون",
        "contextual_translation",
        "87 question-token occurrences in 85 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. All app uses refer to people driving or operating vehicles, including bicycles, buses, trains, motorcycles, and trucks. Reverso Italian-Arabic supports سائق; Treccani and ACI Article 201 corroborate the vehicle-driver sense. Existing plural gloss confirmed unchanged for the app contexts.",
    ),
    "precede": (
        "يسبق",
        "contextual_translation",
        "55 question-token occurrences in 55 distinct paired question contexts and no matching lesson record. App uses describe a sign or vehicle that comes before/is ahead of another; Reverso Italian-Arabic supports يسبق, Treccani confirms the before/ahead senses, and ACI Article 149 uses veicolo che precede for the vehicle ahead. Existing gloss confirmed unchanged for the app contexts.",
    ),
    "incroci": (
        "تقاطعات",
        "contextual_translation",
        "42 question-token occurrences in 42 distinct paired question contexts and 1 lesson-text occurrence in 1 matching lesson. All app uses mean road junctions/intersections; Reverso Italian-Arabic supports تقاطع/تقاطع طرق for incrocio, and Treccani plus ACI Article 145 confirm the road-intersection context. Existing plural gloss confirmed unchanged.",
    ),
    "freccia": (
        "سهم",
        "contextual_translation",
        "40 question-token occurrences in 39 distinct paired question contexts and no matching lesson record. All supplied app contexts use freccia for a drawn arrow indicating direction or lane; paired Arabic uses سهم. Reverso Italian-Arabic examples and Treccani's traffic-direction sense support the existing gloss; the separate vehicle turn-indicator sense is not attested in these contexts.",
    ),
    "retromarcia": (
        "رجوع إلى الخلف",
        "contextual_translation",
        "36 question-token occurrences in 36 distinct paired question contexts and 7 lesson-text occurrences across 2 matching lessons. Most uses mean reversing/backing up; one quiz context uses the reverse gear. Reverso Italian-Arabic and Treccani support الرجوع إلى الخلف for the maneuver, while ACI Article 176 confirms the road-code maneuver sense. Existing gloss retained as contextually adequate; the precise gear term remains phrase-dependent.",
    ),
    "ostacolo": (
        "عائق",
        "contextual_translation",
        "32 question-token occurrences in 32 distinct paired question contexts and 2 lesson-text occurrences in 1 matching lesson. All app uses concern a physical roadway obstruction/hazard. Arabita directly lists عائق, and Treccani plus ACI Article 162 corroborate the impediment/road-obstacle sense. Existing gloss confirmed unchanged; عقبة is also used in some paired Arabic contexts.",
    ),
    "limiti": (
        "الحدود",
        "contextual_translation",
        "29 question-token occurrences in 29 distinct paired question contexts and 2 lesson-text occurrences across 2 matching lessons. App uses cover speed, dimension, and other upper/lower limits; Reverso Italian-Arabic supports حدود, Treccani confirms the boundary/limit sense, and ACI Article 142 supplies speed-limit context. Existing plural gloss confirmed unchanged.",
    ),
    "semafori": (
        "إشارات المرور",
        "contextual_translation",
        "26 question-token occurrences in 26 distinct paired question contexts and 2 lesson-text occurrences across 2 matching lessons. All uses refer to road traffic lights/signals; Glosbe Italian-Arabic supports إشارات المرور and Treccani/ACI Article 41 confirm the signal-device sense. Existing plural gloss confirmed unchanged.",
    ),
    "pista": (
        "المسار",
        "contextual_translation",
        "26 question-token occurrences in 26 distinct paired question contexts and no matching lesson record. The app contexts use pista for a lane/path or road track, including a cycle lane; Reverso Italian-Arabic, Glosbe's pista ciclabile examples, and Treccani support this route/path sense. Existing gloss confirmed unchanged for the supplied contexts.",
    ),
    "asfalto": (
        "الأسفلت",
        "contextual_translation",
        "22 question-token occurrences in 22 distinct paired question contexts and no matching lesson record. All app uses refer to the asphalt road surface/material; Glosbe Italian-Arabic supports the material sense, and Treccani confirms the road-surfacing use. Existing gloss confirmed unchanged.",
    ),
    "direzioni": (
        "الإتجاهات",
        "contextual_translation",
        "18 question-token occurrences in 18 distinct paired question contexts and no matching lesson record. All app uses concern directions/traffic movement and signs; Arabdict and Reverso Italian-Arabic support اتجاه/اتجاهات, while Patente.it Article 40 confirms the traffic-sign context. Existing gloss confirmed unchanged for these contexts; orthographic normalization was not part of this semantic review.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "conducenti": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/conducente; Treccani: https://www.treccani.it/vocabolario/conducente/; ACI Codice della Strada, art. 201: https://www.aci.it/fileadmin/cds/art-201.php; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_conducenti.json",
    "precede": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/precedere; Treccani: https://www.treccani.it/vocabolario/precedere/; ACI Codice della Strada, art. 149: https://www.aci.it/fileadmin/cds/art-149.php; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_precede.json",
    "incroci": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/incrocio; ACI Codice della Strada, art. 145: https://www.aci.it/fileadmin/cds/art-145.php; Treccani: https://www.treccani.it/vocabolario/incrocio/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_incroci.json",
    "freccia": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Treccani: https://www.treccani.it/vocabolario/freccia/; Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/freccia; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_freccia.json",
    "retromarcia": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Treccani: https://www.treccani.it/vocabolario/retromarcia/; Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/retromarcia; ACI Codice della Strada, art. 176: https://aci.gov.it/codice-della-strada/art-176/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_retromarcia.json",
    "ostacolo": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabita Italian-Arabic: https://arabita.news/dizionario/1014; Treccani: https://www.treccani.it/vocabolario/ostacolo/; ACI Codice della Strada, art. 162: https://aci.gov.it/codice-della-strada/art-162/; Reverso Arabic-Italian: https://dizionario.reverso.net/arabo-italiano/%D8%B9%D8%A7%D8%A6%D9%82; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_ostacolo.json",
    "limiti": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/limiti; ACI Codice della Strada, art. 142: https://www.aci.it/fileadmin/cds/art-142.php; Treccani: https://www.treccani.it/vocabolario/limite/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_limiti.json",
    "semafori": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic: https://glosbe.com/it/ar/semaforo; ACI Codice della Strada, art. 41: https://www.aci.it/fileadmin/cds/art-41.php; Treccani: https://www.treccani.it/vocabolario/semaforo/; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_semafori.json",
    "pista": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/pista; Treccani: https://www.treccani.it/vocabolario/pista/; Glosbe Italian-Arabic, pista ciclabile: https://it.glosbe.com/it/ar/Pista%20ciclabile; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_pista.json",
    "asfalto": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Glosbe Italian-Arabic: https://it.glosbe.com/it/ar/asfalto; Treccani: https://www.treccani.it/vocabolario/asfalto/; Reverso Italian-Arabic, stendere: https://dizionario.reverso.net/italiano-arabo/stendere; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_asfalto.json",
    "direzioni": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Arabdict Italian-Arabic: https://www.arabdict.com/fr/italian-arabic/direzione; Patente.it Codice della Strada, art. 40: https://www.patente.it/normativa/articolo-40-cds?idc=299; Reverso Context Italian-Arabic: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/direzione; full paired contexts: /workspace/patente_b_dictionary_audit/batch18_inputs/batch18_direzioni.json",
})

# Batch-nineteen source-backed corrections and unchanged-gloss confirmations.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "trova": (
        "يوجد؛ يقع (في صيغة si trova)",
        "contextual_translation",
        "108 question-token occurrences in 107 distinct paired question contexts and no lesson matches. The reviewed uses are principally si trova = exists/is situated, not the imperative ‘search’; questions 21814, 21429 and 22838 show the location/state sense. Reverso, Glosbe and Treccani support يجد/يوجد/يقع according to context; the gloss explicitly scopes the two Arabic equivalents to si trova.",
    ),
    "preavvisa": (
        "يُنبّه مسبقًا / يُشير مسبقًا إلى",
        "contextual_translation",
        "84 question-token occurrences in 84 distinct paired question contexts and no lesson matches. In the traffic-sign contexts the sign informs or points to an upcoming border, turn, roadworks, signal or prohibition, not invariably a danger warning. Treccani defines preavvisare as informing beforehand and Reverso supports the advance-notice element.",
    ),
    "indossare": (
        "ارتداء",
        "contextual_translation",
        "18 lemma-family tokens across 17 paired question records (indossare 10, indossato 3, indossando 1, indossate 2, indossa 2), plus 2 lesson-text occurrences in one record (u7-l5: summaryIt and quickChecks[2].qIt, both indossato). The current machine gloss البس is imperative; the reviewed infinitive and inflected contexts describe wearing/putting on and support ارتداء / يرتدي. Reverso and Glosbe Italian-Arabic examples support the wearing sense.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "trova": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic, si trova: https://context.reverso.net/traduzione/italiano-arabo/si+trova; Glosbe, trovare: https://glosbe.com/it/ar/trovare; Treccani, trovare: https://www.treccani.it/vocabolario/trovare/; full official-question context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "preavvisa": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic, preavviso: https://context.reverso.net/traduzione/italiano-arabo/preavviso; Treccani, preavvisare: https://www.treccani.it/vocabolario/preavvisare/; full official-question context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "indossare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic, indossare: https://context.reverso.net/traduzione/italiano-arabo/indossare; Glosbe Italian-Arabic, indossare: https://it.glosbe.com/it/ar/indossare; official question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS.update({
    "vietata": (
        "ممنوع",
        "contextual_translation",
        "91 question-token occurrences in 90 distinct paired question contexts and no lesson matches. The reviewed contexts use vietata for prohibited/forbidden road actions or access; Reverso Italian-Arabic and Treccani's vietare entry support the existing general gloss ممنوع. Existing gloss confirmed unchanged.",
    ),
    "proseguire": (
        "تابع",
        "contextual_translation",
        "88 question-token occurrences in 88 distinct paired question contexts plus 2 lesson-text occurrences across 2 lesson records. Every reviewed app use means continue/proceed; Reverso Italian-Arabic and Treccani support the verb sense. Existing gloss confirmed unchanged for the reviewed contexts.",
    ),
    "tonnellate": (
        "أطنان",
        "contextual_translation",
        "80 question-token occurrences in 79 distinct paired question contexts and no lesson matches. The reviewed uses refer to vehicle or vehicle-load mass; Reverso Italian-Arabic and Treccani support the tonne/ton sense. Existing plural gloss confirmed unchanged.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES.update({
    "vietata": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/vietata; Treccani, vietare: https://www.treccani.it/vocabolario/vietare/; full official-question context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "proseguire": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic: https://context.reverso.net/%D8%A7%D9%84%D8%AA%D8%B1%D8%AC%D9%85%D8%A9/%D8%A7%D9%84%D8%A5%D9%8A%D8%B7%D8%A7%D9%84%D9%8A%D8%A9-%D8%A7%D9%84%D8%B9%D8%B1%D8%A8%D9%8A%D8%A9/proseguire; Treccani: https://www.treccani.it/vocabolario/proseguire/; full official-question context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "tonnellate": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_PREFIX + " Reverso Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/tonnellata; Treccani: https://www.treccani.it/vocabolario/tonnellata/; full official-question context corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

# Batch twenty: source-backed contextual gloss corrections.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "spazi": (
        "أماكن، مساحات",
        "contextual_translation",
        "19 question-token occurrences in 18 distinct paired question contexts and no matching lesson records. The reviewed traffic uses consistently mean concrete allocated places or areas, including parking bays, bus/tram stops, taxi stands, accessible-vehicle spaces, emergency areas, and marked spaces. Reverso and Glosbe support مكان/مساحة, while Treccani defines usable or bounded space; فراغ does not fit these concrete uses. Questions 23722 and 23725 also exposed mistranslated stalli/stallo in parentheses.",
    ),
    "sorpassato": (
        "المركبة التي تمّ تجاوزها؛ قديم / متقادِم (للوصف)",
        "contextual_translation",
        "13 question-token occurrences in 13 distinct paired question contexts and no matching lesson records. Most app uses are the participle/adjective for the vehicle being overtaken; a small number retain the ordinary adjective sense old/outdated. Treccani defines sorpassato as the participle of sorpassare and covers both traffic overtaking and outdated senses; Reverso examples support تجاوز and قديم. The gloss preserves both reviewed senses rather than applying the old adjective gloss to every context.",
    ),
    "possono": (
        "يمكن / قد",
        "contextual_translation",
        "203 question-token occurrences in 202 distinct paired contexts plus 18 lesson-text occurrences across 13 lesson records. App contexts use possono for ability/permission and possibility; the fixed subject-specific يمكنهم is too narrow and misses قد. The opened exact-form Reverso entry lists both يمكن and قد; Treccani describes capacity, possibility, permission, and probability/supposition senses of potere. Arabic question-level polarity/modality issues in 23968 and 24012 were separately corrected without changing Italian wording or answers.",
    ),
    "devono": (
        "يجب أن / يجب على",
        "contextual_translation",
        "133 question-token occurrences in 132 distinct paired contexts plus 6 lesson-text occurrences across 5 lesson records. The app uses the third-person plural modal for obligation, including impersonal si devono; يجب عليهم ذلك adds a fixed subject and object that do not fit all contexts. Reverso's opened example uses يجب على ... and Treccani defines dovere as obligation/necessity. Paired Arabic wording in 22512, 24471, 24472, 24800, and 24801 was separately corrected; Italian text and answers were preserved.",
    ),
    "autovetture": (
        "سيارات الركوب",
        "contextual_translation",
        "76 question-token occurrences in 76 distinct paired contexts and one matching lesson record. Every reviewed use concerns the passenger-car vehicle category; lesson u1-l2 distinguishes autovettura from the broader autoveicolo and translates it as عربية ركوب. The opened bilingual Reverso page directly pairs سيارات الركوب with autovetture, and Treccani defines the category as motor vehicles for private passenger transport. The broader المسودة السيارات is less precise.",
    ),
    "comporta": (
        "ينطوي على؛ يستلزم / يقتضي؛ يترتب عليه / يؤدي إلى",
        "contextual_translation",
        "74 question-token occurrences in 72 distinct paired contexts and no matching lesson records. The app uses comporta for what a sign/rule requires and for results or consequences such as penalties, risks, and effects; the draft تنشئ does not cover these uses. Reverso examples support ينطوي على and يتضمن; Treccani defines comportare as carrying with it or requiring as a consequence. The alternatives retain the context-dependent senses.",
    ),
    "massima": (
        "أقصى / قصوى؛ الحدّ الأقصى",
        "contextual_translation",
        "69 question-token occurrences in 67 distinct paired contexts plus 4 lesson-text occurrences in one matching lesson. The app predominantly uses feminine massima as the maximum/upper-bound modifier (speed, mass, dimensions, duration, and similar limits), and also for maximum caution/concentration. Reverso examples directly support السرعة القصوى and الحد الأقصى; Treccani identifies massima as the feminine form of massimo. The standalone الأقصى is not a safe general gloss for the adjective.",
    ),
    "norma": (
        "قاعدة؛ عادةً (في di norma)",
        "contextual_translation",
        "67 question-token occurrences in 67 distinct paired contexts plus one lesson-text occurrence in one matching lesson. Most app contexts use di norma to mean usually/as a rule; two are the noun rule in traffic-code contexts, and lesson u8-l5 uses norma vigente. Reverso's opened entry supports قاعدة for the noun and its phrase examples render di norma as عادةً/في العادة; Treccani distinguishes rule from habitual usage. The existing adjective-like عادي is unsuitable.",
    ),
    "passare": (
        "يمرّ / يعبر (بحسب السياق)",
        "contextual_translation",
        "66 question-token occurrences in 66 distinct paired contexts plus one lesson-text occurrence in one matching lesson. The app uses passare as a verb for passing through, past or around a place/vehicle and for proceeding in turn; the noun-only gloss مرور obscures that function. Reverso examples list Arabic verb equivalents مَرَّ and عَبَرَ and show المرور عبر in a phrase; Treccani and Corriere confirm transit, crossing, and passing-by senses. The paired examples show context-sensitive constructions, so alternatives are retained.",
    ),
    "prossimità": (
        "قُرب؛ بالقرب من",
        "contextual_translation",
        "66 question-token occurrences in 66 distinct paired contexts plus one lesson-text occurrence in one matching lesson. App uses are spatial, especially in prossimità di for near/close to a location or road feature. Reverso examples render prossimità as قرب/على مقربة من; Treccani defines it as grande vicinanza and in prossimità di as vicino/presso. The current imperative اقترب is not the noun or prepositional phrase used in the app.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "spazi": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic: https://dictionary.reverso.net/italian-arabic/spazio; Glosbe: https://glosbe.com/it/ar/spazio; Treccani: https://www.treccani.it/vocabolario/spazio/",
    "sorpassato": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/الترجمة/الإيطالية-العربية/e+sorpassati; Treccani: https://www.treccani.it/vocabolario/sorpassare/; Cambridge: https://dictionary.cambridge.org/us/dictionary/italian-english/sorpassato",
    "possono": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/translation/italian-arabic/possono; Treccani, potere: https://www.treccani.it/vocabolario/potere-2/",
    "devono": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/dovere; Treccani, dovere: https://www.treccani.it/vocabolario/dovere/",
    "autovetture": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Arabic-Italian: https://context.reverso.net/الترجمة/العربية-الإيطالية/سيارات+الركوب; Treccani: https://www.treccani.it/vocabolario/autovettura/; Glosbe Arabic-Italian: https://it.glosbe.com/ar/it/%D8%B3%D9%8A%D8%A7%D8%B1%D8%A9",
    "comporta": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/comporta; Treccani, comportare: https://www.treccani.it/vocabolario/comportare/",
    "massima": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic, velocità massima: https://context.reverso.net/translation/italian-arabic/velocit%C3%A0+massima; Treccani: https://www.treccani.it/vocabolario/massima1/",
    "norma": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/norma; Reverso Context, di norma: https://context.reverso.net/الترجمة/الإيطالية-العربية/di+norma+non; Treccani: https://www.treccani.it/vocabolario/norma/",
    "passare": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/translation/italian-arabic/passare; Treccani: https://www.treccani.it/vocabolario/passare/; Corriere Dizionario: https://dizionari.corriere.it/dizionario_italiano/P/passare.shtml",
    "prossimità": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Context Italian-Arabic: https://context.reverso.net/traduzione/italiano-arabo/prossimit%C3%A0; Treccani: https://www.treccani.it/vocabolario/prossimita/",
})

# Batch twenty-four source-backed contextual corrections.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "ripartire": (
        "يستأنف السير",
        "contextual_translation",
        "5 exact lemma-token occurrences: 3 question tokens in Q20976/Q20790/Q24009 and 2 lesson-text tokens in u6-l2. Each app use concerns a vehicle or road user setting off/resuming movement. Reverso Italian-Arabic lists الانطلاق and gives a resume-after-break example; Reverso Italian-English supports ‘to start again/to leave again’; Al-Maany’s restarted entry includes استئناف. يستأنف السير is a context-specific active verb correction, not owner-approved wording.",
    ),
    "avverte": (
        "يُنَبِّهُ",
        "contextual_translation",
        "4 exact lemma-token occurrences: 3 question tokens in Q21791/Q19031/Q19048 and 1 lesson-text token in u2-l2. The app uses are active warnings/alerts about potholes or the closing of railway barriers. Treccani’s avvertire sense 3 includes drawing attention, informing, and warning; Reverso Italian-Arabic supports the warning/alert sense and lists تنبيه. The verb يُنَبِّهُ fits these contexts better than the machine-draft noun تحذير; project-reviewed, not owner-approved.",
    ),
    "indifferentemente": (
        "دون تفضيل؛ بحسب السياق: على حدّ سواء",
        "contextual_translation",
        "3 exact lemma-token occurrences in Q23122/Q18319/Q23535 and no lesson matches. In these app contexts the word means without distinction/no preference (vehicles pass first equally; overtaking is described as possible from either side), not emotional indifference. De Mauro defines sense 1 as ‘senza differenza, allo stesso modo’; Collins supports ‘without distinction’ and ‘either one would do’. The qualified Arabic gloss avoids the unrelated affective sense بلا مبالاة; project-reviewed, not owner-approved.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "ripartire": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/ripartire; Reverso Italian-English context: https://context.reverso.net/translation/italian-english/di+ripartire; Al-Maany restarted: https://www.almaany.com/en/dict/ar-en/restarted/; official MIT question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "avverte": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Treccani, avvertire, sense 3: https://www.treccani.it/vocabolario/avvertire/; Reverso Italian-Arabic: https://dizionario.reverso.net/italiano-arabo/avvertire; official MIT question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "indifferentemente": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " De Mauro/Internazionale: https://dizionario.internazionale.it/parola/indifferentemente; Collins Italian-English: https://www.collinsdictionary.com/us/dictionary/italian-english/indifferentemente; Reverso Italian-Arabic contexts: https://context.reverso.net/traduzione/italiano-arabo/indifferentemente; official MIT question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

# Batch twenty-five source-backed contextual corrections.
QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS.update({
    "integrativo": (
        "تكميلي",
        "contextual_translation",
        "190 exact question-token occurrences in 190 paired records: 189 use pannello integrativo and one (Q24536) uses esame teorico integrativo; 3 lesson-text tokens occur in u2-l4. D.P.R. 495/1992 Article 83 describes supplementary panels as adding or clarifying information about the principal sign; Treccani defines integrativo as serving to add/complete and includes esame integrativo. The paired Arabic contexts use تكميلي; project-reviewed, not owner-approved.",
    ),
    "tratto": (
        "جزء من الطريق؛ وقد تعني «مسافة/امتدادًا» بحسب السياق",
        "contextual_translation",
        "131 exact question-token occurrences in 131 paired records and no lesson matches. Most uses refer to a road portion/section (including tratto di strada and named road stretches); constructions such as per un tratto sufficiente mean distance or extent. Treccani defines both road-portion and extended distance senses; ACI Article 3 uses tratto di strada for a roadway portion; Al-Maany supports جزء for a part and مسافة for distance. The qualified gloss preserves both app senses; project-reviewed, not owner-approved.",
    ),
})
QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES.update({
    "integrativo": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " D.P.R. 16 December 1992 no. 495, art. 83, Gazzetta Ufficiale: https://www.gazzettaufficiale.it/atto/serie_generale/caricaArticolo?art.versione=1&art.idGruppo=12&art.flagTipoArticolo=0&art.codiceRedazionale=092G0531&art.idArticolo=83&art.idSottoArticolo=1&art.idSottoArticolo1=10&art.dataPubblicazioneGazzetta=1992-12-28&art.progressivo=0; Treccani: https://www.treccani.it/vocabolario/integrativo/; official MIT question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
    "tratto": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCE_PREFIX + " Treccani: https://www.treccani.it/vocabolario/tratto2/; ACI Codice della Strada, art. 3: https://aci.gov.it/codice-della-strada/art-3/; Al-Maany, جزء: https://www.almaany.com/ar/dict/ar-ar/%D8%AC%D8%B2%D8%A1/; Al-Maany, المسافة: https://www.almaany.com/ar/dict/ar-ar/%D8%A7%D9%84%D9%85%D8%B3%D8%A7%D9%81%D8%A9/; official MIT question corpus: https://www.ilportaledellautomobilista.it/documents/56611/57319/210926_Conseguimento+A-B+italiano.pdf/07091bb8-a16b-4fa1-b921-4fd21fa5b650",
})

# Isolated single-letter tokens are extraction artifacts rather than dictionary words.
EXCLUDED_SINGLE_LETTER_ARTIFACTS = {"b", "f", "g", "h", "p", "v", "x"}


def normalized_word(value: object) -> str:
    return unicodedata.normalize("NFC", str(value or "").strip())


def write_json_atomically(payload: dict) -> None:
    fd, temp_name = tempfile.mkstemp(prefix="dictionary-v64-", suffix=".json", dir=JSON_PATH.parent)
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
        elif key in QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS:
            translation, kind, note = QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS[key]
            row.update({
                "translation_ar": translation,
                "ui_fallback_ar": translation,
                "translation_kind": kind,
                "source": QUESTION_BANK_VERIFIED_CONTEXTUAL_SOURCES[key],
                "provider": "project-contextual-audit",
                "confidence": None,
                "status": "reviewed_override",
                "review_required": 0,
                "note": note,
            })
        elif key in QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS:
            translation, kind, note = QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS[key]
            if row.get("translation_ar") != translation:
                raise SystemExit(f"Contextual confirmation expected unchanged translation {translation!r} for {key!r}, got {row.get('translation_ar')!r}")
            row.update({
                "translation_ar": translation,
                "ui_fallback_ar": translation,
                "translation_kind": kind,
                "source": QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATION_SOURCES[key],
                "provider": "project-contextual-audit",
                "confidence": None,
                "status": "reviewed_override",
                "review_required": 0,
                "note": note,
            })
        elif key in QUESTION_BANK_CONTEXTUAL_CANDIDATES:
            translation, kind, note = QUESTION_BANK_CONTEXTUAL_CANDIDATES[key]
            row.update({
                "translation_ar": translation,
                "ui_fallback_ar": "",
                "translation_kind": kind,
                "source": QUESTION_BANK_CONTEXTUAL_CANDIDATE_SOURCES[key],
                "provider": "project-contextual-audit",
                "confidence": None,
                "status": "contextual_candidate_needs_review",
                "review_required": 1,
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
    missing_context_candidates = set(QUESTION_BANK_CONTEXTUAL_CANDIDATES) - {row["word"].casefold() for row in filtered_rows}
    if missing_context_candidates:
        raise SystemExit(f"Contextual candidate terms are missing: {sorted(missing_context_candidates)}")
    missing_verified_contextual_corrections = set(QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS) - {row["word"].casefold() for row in filtered_rows}
    if missing_verified_contextual_corrections:
        raise SystemExit(f"Verified contextual correction terms are missing: {sorted(missing_verified_contextual_corrections)}")
    missing_verified_contextual_confirmations = set(QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS) - {row["word"].casefold() for row in filtered_rows}
    if missing_verified_contextual_confirmations:
        raise SystemExit(f"Verified contextual confirmation terms are missing: {sorted(missing_verified_contextual_confirmations)}")

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
        "accuracy_note": f"Automatic model and legacy glossary entries remain unreviewed drafts. The two v64 question-bank candidates and the batch-25 extraurbane wording remain flagged. {len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS)} frequent question-bank translations were corrected and {len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS)} existing glosses were confirmed unchanged using app contexts and Italian-Arabic sources; these project contextual reviews are not owner-approved. The documented v42 owner corrections and requested/video/lesson additions remain separately traceable. The lookup omits isolated single-letter extraction artifacts.",
        "question_bank_context_correction_candidates": len(QUESTION_BANK_CONTEXTUAL_CANDIDATES),
        "question_bank_verified_contextual_corrections": len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS),
        "question_bank_verified_contextual_gloss_confirmations": len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS),
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
            "owner_approved_override_rows": str(sum(row.get("source") == "owner-approved-correction-v42" and row.get("status") == "reviewed_override" for row in rows)),
            "reviewed_override_rows": str(approved_rows),
            "requested_lemma_addition_rows": str(len(REQUESTED_LEMMA_ADDITIONS)),
            "video_context_addition_rows": str(len(VIDEO_CONTEXT_ADDITIONS)),
            "lesson_dictionary_audit_rows": str(len(LESSON_DICTIONARY_ADDITIONS)),
            "contextual_candidate_rows_needing_review": str(len(QUESTION_BANK_CONTEXTUAL_CANDIDATES)),
            "verified_question_bank_context_correction_rows": str(len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS)),
            "verified_question_bank_context_gloss_confirmation_rows": str(len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS)),
            "unresolved_rows_given_transparent_fallback": "0",
            "excluded_single_letter_artifacts": ",".join(sorted(EXCLUDED_SINGLE_LETTER_ARTIFACTS)),
            "translation_notice": f"Automatic translations remain drafts unless status is reviewed_override. The two v64 context-audit candidates and the batch-25 extraurbane wording remain flagged. {len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS)} frequent context-audit corrections and {len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS)} unchanged-gloss confirmations are tied to app contexts and Italian-Arabic sources; they are project-reviewed, not owner-approved.",
            "fallback_notice": "The v42 lookup excludes isolated single-letter extraction artifacts and includes owner-approved corrections.",
        }
        db.executemany("INSERT INTO Metadata(Key, Value) VALUES (?, ?)", sorted(sqlite_metadata.items()))
        db.commit()
        integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
        count = db.execute("SELECT COUNT(*) FROM Dictionary").fetchone()[0]
        empty = db.execute("SELECT COUNT(*) FROM Dictionary WHERE trim(Arabic_Translation) = ''").fetchone()[0]
        approved_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE Source = 'owner-approved-correction-v42' AND Status = 'reviewed_override' AND Review_Required = 0").fetchone()[0]
        contextual_candidate_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE Source LIKE 'question-bank-context-audit-v%' AND Status = 'contextual_candidate_needs_review' AND Review_Required = 1 AND Translation_Kind = 'contextual_translation_draft'").fetchone()[0]
        verified_contextual_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE Source LIKE 'question-bank-context-audit-2026-11;%' AND Status = 'reviewed_override' AND Review_Required = 0").fetchone()[0]
        verified_contextual_confirmation_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE Source LIKE 'question-bank-context-confirmation-2026-11;%' AND Status = 'reviewed_override' AND Review_Required = 0").fetchone()[0]
        excluded_db_rows = db.execute("SELECT COUNT(*) FROM Dictionary WHERE lower(Italian_Word) IN ('b','f','g','h','p','v','x')").fetchone()[0]
        if integrity != "ok" or count != EXPECTED_WORD_COUNT or empty != 0 or approved_db_rows != len(OWNER_CORRECTIONS) or contextual_candidate_db_rows != len(QUESTION_BANK_CONTEXTUAL_CANDIDATES) or verified_contextual_db_rows != len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CORRECTIONS) or verified_contextual_confirmation_db_rows != len(QUESTION_BANK_VERIFIED_CONTEXTUAL_CONFIRMATIONS) or excluded_db_rows != 0:
            raise SystemExit(f"SQLite validation failed: integrity={integrity}, rows={count}, empty={empty}, owner_approved={approved_db_rows}, contextual_candidates={contextual_candidate_db_rows}, verified_contextual={verified_contextual_db_rows}, confirmed_unchanged={verified_contextual_confirmation_db_rows}, excluded={excluded_db_rows}")
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
    print(f"Rows: {len(rows)}; automatic: {machine_rows}; legacy: {legacy_rows}; reviewed overrides: {approved_rows}; excluded letter artifacts: {len(EXCLUDED_SINGLE_LETTER_ARTIFACTS)}")
    print(f"Integrity: ok; rows with empty Arabic_Translation: 0; bytes: {DB_PATH.stat().st_size}; SHA-256: {digest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
