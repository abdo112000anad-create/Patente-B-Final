#!/usr/bin/env python3
"""Verify canonical compact lessons and their attached long-form support content."""
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
course = json.loads((ROOT / "data/lessons-v2.json").read_text(encoding="utf-8"))
support_data = json.loads((ROOT / "data/lesson-support.json").read_text(encoding="utf-8"))
support = support_data.get("lessons", {})
app = (ROOT / "src/app.js").read_text(encoding="utf-8")
template = (ROOT / "src/lesson-template.mjs").read_text(encoding="utf-8")
animation = (ROOT / "src/lesson-animation.mjs").read_text(encoding="utf-8")
speech = (ROOT / "src/speech.mjs").read_text(encoding="utf-8")

components = [
    ("bilingual lesson title", "function lessonDetailPage" in app and "lesson-detail-head" in app),
    ("Italian-only TTS", 'data-tts-locale="${ITALIAN_TTS_LOCALE}"' in app and "it-IT" in speech),
    ("accessible inline SVG", "renderLessonVisualSection" in app and 'class="lesson-animation-svg"' in animation),
    ("Italian and Arabic summaries", 'class="lesson-it-text"' in template and 'class="lesson-ar-full"' in template),
    ("key-point cards", 'class="lesson-key-point-card' in template),
    ("trap-word display", "function trapWordMarkup" in app and "lesson.trapWord" in app),
    ("canonical quick-check display", "lesson.quickChecks" in app and "quickCheckMarkup" in template),
    ("official source links", 'class="lesson-sources"' in app),
    ("lesson navigation", "lesson-footer-nav" in app),
]
missing_components = [name for name, ok in components if not ok]
if missing_components:
    print("CURRENT_TEMPLATE_FAILURES:", ", ".join(missing_components))
    sys.exit(1)

# Use a Unicode-aware letters-only pattern, keeping internal apostrophes in a word.
word_pattern = re.compile(r"[^\W\d_]+(?:[’'][^\W\d_]+)*", re.UNICODE)
rows = []
canonical_ids = set()
for module in course.get("modules", []):
    for index, compact in enumerate(module.get("lessons", []), start=1):
        lesson_id = compact.get("id")
        if not lesson_id or lesson_id in canonical_ids:
            rows.append((module.get("module_id", "?"), index, 0, False))
            continue
        canonical_ids.add(lesson_id)
        lesson = support.get(lesson_id, {})
        checks = compact.get("quickChecks", [])
        compact_ok = (
            len(compact) == 8 and len(checks) == 3 and
            all(set(check) == {"qIt", "a", "explainAr"} and check.get("qIt") and check.get("a") in {"VERO", "FALSO"} and check.get("explainAr") for check in checks)
        )
        body_it = str(lesson.get("body_it", ""))
        count = len(word_pattern.findall(body_it))
        core_it = [line for line in str(lesson.get("core_it", "")).strip().splitlines() if line.strip()]
        core_ar = [line for line in str(lesson.get("core_ar", "")).strip().splitlines() if line.strip()]
        fields_ok = compact_ok and all([
            lesson.get("heading_it"), lesson.get("heading_ar"), body_it,
            lesson.get("body_ar"), len(core_it) == 2, len(core_ar) == 2,
            4 <= len(lesson.get("key_points", [])) <= 6,
            len(lesson.get("trap_words", [])) <= 2,
            len(lesson.get("numbers", [])) <= 2,
            2 <= len(lesson.get("common_mistakes", [])) <= 3,
            len(lesson.get("quick_check", [])) == 3,
            len(lesson.get("sources", [])) > 0,
        ])
        passed = fields_ok and 80 <= count <= 120
        rows.append((module.get("module_id", "?"), index, count, passed))
        state = "PASS" if passed else "FAIL"
        print(f"{module.get('module_id', '?')}:{index:02d} | Italian words={count:3d}/120 | compact quickChecks=3 | {state}")

failed = [row for row in rows if not row[3]]
counts = [row[2] for row in rows]
ids_match = canonical_ids == set(support)
print(f"SUMMARY lessons={len(rows)}/50 | canonical/support IDs match={ids_match} | UI hooks={len(components)}/{len(components)} | Italian_words_min={min(counts) if counts else 0} | Italian_words_max={max(counts) if counts else 0} | failures={len(failed)}")
if len(rows) != 50 or not ids_match or failed:
    sys.exit(1)
