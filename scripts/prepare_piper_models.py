#!/usr/bin/env python3
"""Prepare the locally bundled Piper models for sherpa-onnx.

Downloads only static model/metadata files. No lesson text is sent to a network
service. Conversion follows https://k2-fsa.github.io/sherpa/onnx/tts/piper.html.
Requires: pip install onnx==1.17.0
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSET_BASE = ROOT / "android/app/src/main/assets"
ASSET_ROOT = ASSET_BASE / "piper"
MODEL_ROOT = ASSET_BASE / "models"
MANIFEST_PATH = ASSET_ROOT / "PIPER_MODELS_MANIFEST.json"
VOICES = [
    {
        "id": "it_IT-paola-medium",
        "dir": "it_IT-paola-medium",
        "repo": "https://huggingface.co/rhasspy/piper-voices/resolve/main",
        "model": "it/it_IT/paola/medium/it_IT-paola-medium.onnx",
        "json": "it/it_IT/paola/medium/it_IT-paola-medium.onnx.json",
        "card": "it/it_IT/paola/medium/MODEL_CARD",
        "card_name": "MODEL_CARD",
        "language": "it",
        "voice": "it",
        "num_speakers": 1,
        "sample_rate": 22050,
        "quality": "medium",
        "display": "Paola — Italian (Italy), one speaker, medium (22.05 kHz)",
        "model_license": "Piper voices repository metadata reports MIT; the current Paola model card reports CC0 for the voice dataset",
        "dataset_license": "CC0 as stated by the current model card; source: OHF-Voice voice-datasets",
        "model_url": "https://huggingface.co/rhasspy/piper-voices/tree/main/it/it_IT/paola/medium",
        "dataset_url": "https://github.com/OHF-Voice/voice-datasets",
    },
    {
        "id": "ar_JO-kareem-medium",
        "dir": "ar_JO-kareem-medium",
        "repo": "https://huggingface.co/rhasspy/piper-voices/resolve/e7229f7d33a10e145e109b886d661984201ac3c4",
        "model": "ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx",
        "json": "ar/ar_JO/kareem/medium/ar_JO-kareem-medium.onnx.json",
        "card": "ar/ar_JO/kareem/medium/MODEL_CARD",
        "card_name": "MODEL_CARD",
        "language": "ar",
        "voice": "ar_JO",
        "num_speakers": 1,
        "sample_rate": 22050,
        "display": "Kareem — Arabic (Jordan), medium",
        "model_license": "Piper voices repository metadata reports MIT; model card delegates dataset terms to its source URL",
        "dataset_license": "Unresolved: linked arabicttstrain repository reports no license and no license/terms file was found",
        "model_url": "https://huggingface.co/rhasspy/piper-voices/tree/main/ar/ar_JO/kareem/medium",
        "dataset_url": "https://github.com/AliMokhammad/arabicttstrain",
    },
]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def min_size(dest: Path) -> int:
    return 64 if dest.name in ("MODEL_CARD", "MODEL_CARD.md", "README.md") else 1024


def download(url: str, dest: Path) -> None:
    if dest.exists() and dest.stat().st_size >= min_size(dest):
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    request = urllib.request.Request(url, headers={"User-Agent": "PatenteB-v41-asset-builder/1.0"})
    print(f"Downloading {url}", flush=True)
    with urllib.request.urlopen(request, timeout=90) as response, tmp.open("wb") as out:
        total = int(response.headers.get("Content-Length") or 0)
        downloaded = 0
        while True:
            block = response.read(1024 * 1024)
            if not block:
                break
            out.write(block)
            downloaded += len(block)
            if total and downloaded % (16 * 1024 * 1024) < len(block):
                print(f"  {dest.name}: {downloaded:,}/{total:,} bytes", flush=True)
    if tmp.stat().st_size < min_size(dest):
        raise RuntimeError(f"Downloaded file is unexpectedly small: {tmp}")
    tmp.replace(dest)
    print(f"Saved {dest.name} ({dest.stat().st_size:,} bytes)", flush=True)


def prepare_voice(spec: dict, onnx_module, previous: dict) -> dict:
    voice_dir = ASSET_ROOT / spec["dir"]
    voice_dir.mkdir(parents=True, exist_ok=True)
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    model_name = Path(spec["model"]).name
    config_name = Path(spec["json"]).name
    model_path = MODEL_ROOT / model_name
    config_path = MODEL_ROOT / config_name
    for legacy_path in (voice_dir / model_name, voice_dir / config_name):
        new_path = MODEL_ROOT / legacy_path.name
        if legacy_path.exists() and not new_path.exists():
            legacy_path.replace(new_path)
    tokens_path = voice_dir / "tokens.txt"
    sequences_path = voice_dir / "phoneme_sequences.json"
    card_path = voice_dir / spec["card_name"]

    download(f"{spec['repo']}/{spec['json']}", config_path)
    download(f"{spec['repo']}/{spec['card']}", card_path)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    audio_config = config.get("audio") or {}
    if int(audio_config.get("sample_rate", 0)) != int(spec["sample_rate"]):
        raise RuntimeError(f"Unexpected sample rate in {config_path}: {audio_config.get('sample_rate')!r}")
    if spec.get("quality") and audio_config.get("quality") != spec["quality"]:
        raise RuntimeError(f"Unexpected model quality in {config_path}: {audio_config.get('quality')!r}")
    token_map = config.get("phoneme_id_map")
    if not isinstance(token_map, dict) or not token_map:
        raise RuntimeError(f"No phoneme_id_map in {config_path}")

    prior = previous.get(spec["id"], {})
    if model_path.exists() and prior.get("packaged_sha256") == sha256(model_path):
        source_hash = prior.get("source_sha256")
        print(f"Keeping verified packaged model {model_path.name}", flush=True)
    else:
        raw_path = voice_dir / (model_path.name + ".source")
        download(f"{spec['repo']}/{spec['model']}", raw_path)
        source_hash = sha256(raw_path)
        model = onnx_module.load(str(raw_path), load_external_data=True)
        metadata = {entry.key: entry.value for entry in model.metadata_props}
        metadata.update({
            "model_type": "vits",
            "comment": "piper",
            "language": spec["language"],
            "voice": spec["voice"],
            "has_espeak": "1",
            "n_speakers": str(spec["num_speakers"]),
            "sample_rate": str(spec["sample_rate"]),
        })
        del model.metadata_props[:]
        for key, value in metadata.items():
            item = model.metadata_props.add()
            item.key = key
            item.value = str(value)
        onnx_module.checker.check_model(model)
        fd, tmp_name = tempfile.mkstemp(prefix=model_path.name, suffix=".onnx.tmp", dir=MODEL_ROOT)
        os.close(fd)
        try:
            onnx_module.save(model, tmp_name)
            Path(tmp_name).replace(model_path)
        finally:
            Path(tmp_name).unlink(missing_ok=True)
            raw_path.unlink(missing_ok=True)
        print(f"Prepared {model_path.name}: {model_path.stat().st_size:,} bytes", flush=True)

    multicodepoint_tokens = sorted((symbol for symbol in token_map if len(symbol) != 1), key=lambda symbol: (-len(symbol), symbol))
    mapped_multicodepoint_tokens = []
    with tokens_path.open("w", encoding="utf-8", newline="\n") as out:
        for symbol, ids in token_map.items():
            if not isinstance(ids, list) or not ids:
                raise RuntimeError(f"Invalid token mapping: {symbol!r} -> {ids!r}")
            if len(symbol) != 1:
                continue
            out.write(f"{symbol} {int(ids[0])}\n")
        for index, symbol in enumerate(multicodepoint_tokens):
            replacement = 0xE000 + index
            replacement_symbol = chr(replacement)
            if replacement_symbol in token_map:
                raise RuntimeError(f"Private-use replacement collides with model token: U+{replacement:04X}")
            ids = token_map[symbol]
            out.write(f"{replacement_symbol} {int(ids[0])}\n")
            mapped_multicodepoint_tokens.append({
                "symbol": symbol,
                "codepoints": [ord(character) for character in symbol],
                "replacement_codepoint": replacement,
                "token_id": int(ids[0]),
            })
    sequences_path.write_text(json.dumps({"schema_version": 1, "mappings": mapped_multicodepoint_tokens}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    files = {}
    for path in (model_path, config_path, tokens_path, sequences_path, card_path):
        asset_path = path.relative_to(ASSET_BASE).as_posix()
        files[asset_path] = {"bytes": path.stat().st_size, "sha256": sha256(path)}
    model_asset = model_path.relative_to(ASSET_BASE).as_posix()
    config_asset = config_path.relative_to(ASSET_BASE).as_posix()
    tokens_asset = tokens_path.relative_to(ASSET_BASE).as_posix()
    sequences_asset = sequences_path.relative_to(ASSET_BASE).as_posix()
    card_asset = card_path.relative_to(ASSET_BASE).as_posix()
    return {
        "id": spec["id"],
        "display": spec["display"],
        "sample_rate": int(spec["sample_rate"]),
        "quality": spec.get("quality", "medium"),
        "model_url": spec["model_url"],
        "dataset_url": spec["dataset_url"],
        "model_license": spec["model_license"],
        "dataset_license": spec["dataset_license"],
        "source_sha256": source_hash,
        "packaged_sha256": files[model_asset]["sha256"],
        "model_asset": model_asset,
        "config_asset": config_asset,
        "tokens_asset": tokens_asset,
        "sequences_asset": sequences_asset,
        "card_asset": card_asset,
        "mapped_multicodepoint_tokens": mapped_multicodepoint_tokens,
        "files": files,
    }


def write_readme(entries: list[dict]) -> None:
    lines = [
        "# Bundled Piper voice models — source, license and privacy notes",
        "",
        "Speech synthesis runs locally through sherpa-onnx. The app does not send lesson text to a TTS service.",
        "ONNX models and their JSON sidecars are packaged under `assets/models/`; generated token files and source cards are retained under `assets/piper/<voice>/`.",
        "",
        "## Included models",
        "",
    ]
    for entry in entries:
        lines += [
            f"### {entry['display']}",
            f"Model: {entry['model_url']}",
            f"ONNX asset: `assets/{entry['model_asset']}`",
            f"Model JSON asset: `assets/{entry['config_asset']}`",
            f"Token/sequence/card assets: `assets/{entry['tokens_asset']}`, `assets/{entry['sequences_asset']}`, `assets/{entry['card_asset']}`",
            f"Model license declared by source: {entry['model_license']}",
            f"Training dataset source: {entry['dataset_url']}",
            f"Dataset license/provenance: {entry['dataset_license']}",
            f"SHA-256 of downloaded source ONNX: `{entry['source_sha256']}`",
            f"SHA-256 of ONNX after adding sherpa-onnx metadata: `{entry['packaged_sha256']}`",
            "",
        ]
    lines += [
        "## Rights note",
        "",
        "The Jordanian `ar_JO-kareem-medium` model is included in this Alpha debug candidate at the project owner's direction. Its card points to `https://github.com/AliMokhammad/arabicttstrain` and says `License: See URL`; GitHub reports no repository license and no license/terms file was found. The model repository metadata reports MIT for the Piper voices collection, but that does not resolve the linked training-data rights.",
        "Paola `it_IT-paola-medium` is included at the owner's direction. The model card identifies medium quality at 22,050 Hz and states CC0 for the voice dataset; the repository metadata reports MIT. This candidate is for private Alpha testing; preserve this attribution and review rights before any public redistribution.",
        "",
        "## Runtime libraries",
        "",
        "- sherpa-onnx Android AAR 2.0.1: Apache-2.0; https://github.com/k2-fsa/sherpa-onnx",
        "- piper-phonemize Android AAR 1.5.9: GPL-3.0-or-later (includes eSpeak-NG data); https://github.com/csukuangfj/piper-phonemize",
        "",
        "ONNX files and JSON sidecars are under `assets/models/`; source cards, generated `tokens.txt`, and `phoneme_sequences.json` are under `assets/piper/<voice>/`. Multi-codepoint phoneme tokens are represented by private-use Unicode codepoints in tokens.txt and translated back to model token IDs before inference. Model/dataset provenance is recorded here and in `PIPER_MODELS_MANIFEST.json`. Rights review remains necessary before public distribution.",
        "",
        "This note records source declarations; it is not legal advice. Re-check model and dataset terms before public/commercial distribution.",
    ]
    (ASSET_ROOT / "PIPER_MODELS_README.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> int:
    try:
        import onnx
    except ImportError:
        print("Missing dependency: run `python3 -m pip install --target /tmp/v41-python-deps onnx==1.17.0` and set PYTHONPATH=/tmp/v41-python-deps", file=sys.stderr)
        return 2
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    desired_dirs = {spec["dir"] for spec in VOICES}
    for candidate in ASSET_ROOT.iterdir():
        if candidate.is_dir() and candidate.name not in desired_dirs:
            shutil.rmtree(candidate)
            print(f"Removed unused voice from Android assets: {candidate.name}", flush=True)
    desired_model_files = {
        Path(spec[key]).name
        for spec in VOICES
        for key in ("model", "json")
    }
    for candidate in MODEL_ROOT.iterdir():
        if candidate.is_file() and candidate.name not in desired_model_files:
            candidate.unlink()
            print(f"Removed unused model asset: {candidate.name}", flush=True)
    previous = {}
    if MANIFEST_PATH.exists():
        try:
            previous = json.loads(MANIFEST_PATH.read_text(encoding="utf-8")).get("voices", {})
        except Exception:
            previous = {}
    entries = [prepare_voice(spec, onnx, previous) for spec in VOICES]
    manifest = {
        "schema_version": 1,
        "runtime": {"sherpa_onnx": "2.0.1", "piper_phonemize_android": "1.5.9"},
        "voices": {entry["id"]: entry for entry in entries},
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    write_readme(entries)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
