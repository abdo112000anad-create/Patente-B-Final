#!/usr/bin/env python3
"""Offline generation smoke test for the bundled Piper models.

Requires the test-only Python packages installed by the developer; the Android
APK does not run Python. No speech text is sent to a network service.
"""
from __future__ import annotations

import hashlib
import json
import math
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import sherpa_onnx
from piper_phonemize import phonemize_espeak

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "android/app/src/main/assets/piper"
MODEL_ASSETS = ROOT / "android/app/src/main/assets/models"
OUT = ROOT / "test-artifacts/v41-tts-smoke"
VOICES = [
    {
        "id": "it_IT-paola-medium",
        "dir": "it_IT-paola-medium",
        "model": "it_IT-paola-medium.onnx",
        "text": "La corsia è riservata alla circolazione dei veicoli. Guida con prudenza.",
        "phonemizer_language": "it",
        "label": "Paola Italian medium 22.05 kHz",
    },
    {
        "id": "ar_JO-kareem-medium",
        "dir": "ar_JO-kareem-medium",
        "model": "ar_JO-kareem-medium.onnx",
        "text": "مرحباً بكم. يجب القيادة بحذر واحترام إشارات المرور.",
        "phonemizer_language": "ar",
        "label": "Kareem Jordanian Arabic",
    },
]


def file_sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def synthesize(spec: dict) -> dict:
    folder = ASSETS / spec["dir"]
    model_path = MODEL_ASSETS / spec["model"]
    tokens_path = folder / "tokens.txt"
    sequences_path = folder / "phoneme_sequences.json"
    if not model_path.is_file() or not tokens_path.is_file() or not sequences_path.is_file():
        raise FileNotFoundError(f"Missing prepared assets for {spec['id']}")

    config = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=str(model_path),
                tokens=str(tokens_path),
            ),
            debug=True,
        ),
    )
    started = time.perf_counter()
    tts = sherpa_onnx.OfflineTts(config)
    initialized_seconds = time.perf_counter() - started

    sentences = phonemize_espeak(spec["text"], spec["phonemizer_language"])
    sequence_data = json.loads(sequences_path.read_text(encoding="utf-8"))
    mappings = sorted(sequence_data.get("mappings", []), key=lambda item: len(item["codepoints"]), reverse=True)
    def combine_sequences(sentence):
        raw = [ord(character) for character in "".join(sentence) if character]
        out = []
        index = 0
        while index < len(raw):
            match = next((item for item in mappings if raw[index:index + len(item["codepoints"])] == item["codepoints"]), None)
            if match:
                out.append(chr(match["replacement_codepoint"]))
                index += len(match["codepoints"])
            else:
                out.append(chr(raw[index]))
                index += 1
        return out
    token_sentences = [combine_sequences(sentence) for sentence in sentences]
    if not token_sentences or not any(token_sentences):
        raise RuntimeError(f"Piper phonemization returned no tokens for {spec['id']}")

    generation = sherpa_onnx.GenerationConfig()
    generation.sid = 0
    generation.speed = 1.0
    generation.tokens = token_sentences
    gen_started = time.perf_counter()
    audio = tts.generate("", generation)
    generation_seconds = time.perf_counter() - gen_started
    samples = np.asarray(audio.samples, dtype=np.float32)
    if samples.size < int(audio.sample_rate * 0.4):
        raise RuntimeError(f"Generated audio is too short for {spec['id']}: {samples.size} samples")
    if not np.isfinite(samples).all() or float(np.max(np.abs(samples))) <= 0.0001:
        raise RuntimeError(f"Generated audio is silent or invalid for {spec['id']}")

    OUT.mkdir(parents=True, exist_ok=True)
    output = OUT / f"{spec['id']}.wav"
    sf.write(str(output), samples, samplerate=audio.sample_rate, subtype="PCM_16")
    duration = samples.size / audio.sample_rate
    return {
        "id": spec["id"],
        "label": spec["label"],
        "text": spec["text"],
        "phonemizer_language": spec["phonemizer_language"],
        "sherpa_lang": tts.lang,
        "sample_rate": int(audio.sample_rate),
        "samples": int(samples.size),
        "duration_seconds": round(duration, 3),
        "peak_amplitude": round(float(np.max(np.abs(samples))), 6),
        "rms_amplitude": round(float(math.sqrt(float(np.mean(np.square(samples))))), 6),
        "runtime_init_seconds": round(initialized_seconds, 3),
        "generation_seconds": round(generation_seconds, 3),
        "realtime_factor": round(generation_seconds / duration, 3),
        "wav_path": str(output),
        "wav_bytes": output.stat().st_size,
        "wav_sha256": file_sha256(output),
        "result": "PASS: local non-silent WAV generated through sherpa-onnx OfflineTts and Piper phonemizer",
    }


def main() -> int:
    results = [synthesize(spec) for spec in VOICES]
    OUT.mkdir(parents=True, exist_ok=True)
    result_path = OUT / "results.json"
    result_path.write_text(json.dumps(results, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    for result in results:
        print(f"{result['label']}: {result['result']}")
        print(f"  duration={result['duration_seconds']}s sr={result['sample_rate']}Hz peak={result['peak_amplitude']} rms={result['rms_amplitude']} RTF={result['realtime_factor']}")
        print(f"  WAV={result['wav_path']} ({result['wav_bytes']:,} bytes) sha256={result['wav_sha256']}")
    print(f"JSON={result_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
