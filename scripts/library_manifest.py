#!/usr/bin/env python3

from __future__ import annotations

import json
import mimetypes
import shutil
import subprocess
from array import array
from pathlib import Path


SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".ogg"}
DEFAULT_TAG = "Sin etiqueta"
DEFAULT_TAGS = [
    DEFAULT_TAG,
    "Oracion",
    "Llamada",
    "Procesion",
    "Recogida",
    "Marcha lenta",
    "Exhibicion",
]
ANALYSIS_WINDOW = 2048
ENVELOPE_BINS = 96
MIN_ONSET_THRESHOLD = 0.18
FINGERPRINT_MAX_NEIGHBORS = 5
FINGERPRINT_MAX_INTERVAL_SECONDS = 3.2
FINGERPRINT_INTERVAL_STEP = 0.05
FEATURE_SAMPLE_RATE = 22050


def prettify_name(filename: str) -> str:
    stem = Path(filename).stem.replace("_", " ").replace("-", " ").strip()
    return " ".join(part.capitalize() for part in stem.split()) or filename


def read_metadata(project_root: Path) -> dict:
    metadata_path = project_root / "assets" / "pasos" / "metadata.json"
    if not metadata_path.exists():
        return {"tags": DEFAULT_TAGS, "references": {}}

    try:
        return sanitize_metadata(json.loads(metadata_path.read_text(encoding="utf-8")))
    except (json.JSONDecodeError, OSError):
        return {"tags": DEFAULT_TAGS, "references": {}}


def write_metadata(project_root: Path, metadata: dict) -> Path:
    metadata_path = project_root / "assets" / "pasos" / "metadata.json"
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    clean_metadata = sanitize_metadata(metadata)
    metadata_path.write_text(
        json.dumps(clean_metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return metadata_path


def sanitize_metadata(metadata: dict) -> dict:
    raw_tags = metadata.get("tags", []) if isinstance(metadata, dict) else []
    tags = []
    for tag in [DEFAULT_TAG, *raw_tags]:
        clean_tag = str(tag).strip()
        if clean_tag and clean_tag not in tags:
            tags.append(clean_tag)

    raw_references = metadata.get("references", {}) if isinstance(metadata, dict) else {}
    references = {}
    if isinstance(raw_references, dict):
        iterable = raw_references.items()
    elif isinstance(raw_references, list):
        iterable = ((entry.get("file"), entry) for entry in raw_references if isinstance(entry, dict))
    else:
        iterable = []

    for filename, entry in iterable:
        if not filename or not isinstance(entry, dict):
            continue

        clean_filename = Path(str(filename)).name
        clean_entry = {}
        name = str(entry.get("name", "")).strip()
        tag = str(entry.get("tag", "")).strip()
        notes = str(entry.get("notes", "")).strip()
        if name:
            clean_entry["name"] = name[:160]
        if tag:
            clean_entry["tag"] = tag[:80]
            if clean_entry["tag"] not in tags:
                tags.append(clean_entry["tag"])
        if notes:
            clean_entry["notes"] = notes[:500]
        if clean_entry:
            try:
                clean_entry["updatedAt"] = int(entry.get("updatedAt") or 0)
            except (TypeError, ValueError):
                clean_entry["updatedAt"] = 0
            references[clean_filename] = clean_entry

    return {"tags": tags, "references": references}


def build_manifest(project_root: Path) -> dict:
    pasos_dir = project_root / "assets" / "pasos"
    pasos_dir.mkdir(parents=True, exist_ok=True)
    metadata = read_metadata(project_root)
    metadata_by_file = metadata.get("references", {})
    features_path = project_root / "assets" / "pasos" / "features.json"
    features_by_file = {
        entry.get("file"): entry
        for entry in read_existing_features(features_path).get("references", [])
        if isinstance(entry, dict) and entry.get("file")
    }

    references = []
    for file_path in sorted(pasos_dir.iterdir()):
        if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue

        stat = file_path.stat()
        file_metadata = metadata_by_file.get(file_path.name, {})
        file_features = features_by_file.get(file_path.name, {})
        references.append(
            {
                "name": file_metadata.get("name") or prettify_name(file_path.name),
                "file": file_path.name,
                "size": stat.st_size,
                "modifiedAt": int(stat.st_mtime * 1000),
                "mimeType": mimetypes.guess_type(file_path.name)[0] or "audio/mpeg",
                "tag": file_metadata.get("tag") or DEFAULT_TAG,
                "notes": file_metadata.get("notes") or "",
                "duration": file_features.get("duration") or 0,
                "sampleRate": file_features.get("sampleRate") or 0,
                "channels": file_features.get("channels") or 0,
            }
        )

    return {"tags": metadata.get("tags", DEFAULT_TAGS), "references": references}


def write_manifest(project_root: Path) -> Path:
    manifest_path = project_root / "assets" / "pasos" / "manifest.json"
    manifest = build_manifest(project_root)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest_path


def write_library_files(project_root: Path) -> tuple[Path, Path | None]:
    features_path = write_features(project_root)
    manifest_path = write_manifest(project_root)
    return manifest_path, features_path


def write_features(project_root: Path) -> Path | None:
    if not shutil.which("ffmpeg"):
        return None

    manifest = build_manifest(project_root)
    features_path = project_root / "assets" / "pasos" / "features.json"
    existing = read_existing_features(features_path)
    existing_by_file = {entry.get("file"): entry for entry in existing.get("references", [])}
    references = []

    for entry in manifest["references"]:
        previous = existing_by_file.get(entry["file"])
        if (
            previous
            and previous.get("size") == entry["size"]
            and previous.get("modifiedAt") == entry["modifiedAt"]
            and previous.get("features")
        ):
            references.append({**previous, **entry})
            continue

        file_path = project_root / "assets" / "pasos" / entry["file"]
        try:
            references.append({**entry, **analyse_audio_file(file_path)})
        except (subprocess.SubprocessError, ValueError, OSError) as error:
            references.append({**entry, "error": str(error)})

    features_path.write_text(
        json.dumps({"references": references}, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    return features_path


def read_existing_features(features_path: Path) -> dict:
    if not features_path.exists():
        return {"references": []}

    try:
        return json.loads(features_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"references": []}


def analyse_audio_file(file_path: Path) -> dict:
    pcm = decode_audio(file_path)
    if not pcm:
        raise ValueError("Audio vacío o no decodificable")

    features = analyse_samples(pcm, FEATURE_SAMPLE_RATE)
    return {
        "duration": features["durationSeconds"],
        "sampleRate": FEATURE_SAMPLE_RATE,
        "channels": 1,
        "features": features,
    }


def decode_audio(file_path: Path) -> array:
    command = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        str(file_path),
        "-ac",
        "1",
        "-ar",
        str(FEATURE_SAMPLE_RATE),
        "-f",
        "s16le",
        "-",
    ]
    result = subprocess.run(command, check=True, capture_output=True)
    pcm = array("h")
    pcm.frombytes(result.stdout)
    return pcm


def analyse_samples(samples: array, sample_rate: int) -> dict:
    stats = measure_signal(samples)
    envelope = build_envelope(samples, stats["peak"])
    onset = build_onset_profile(envelope)
    peak_indexes = detect_peaks(onset)
    hop_seconds = (ANALYSIS_WINDOW / 2) / sample_rate
    peak_times = [index * hop_seconds for index in peak_indexes]
    peak_rate = len(peak_indexes) / max(0.1, len(samples) / sample_rate)

    return {
        "envelope": round_values(resample_vector(envelope, ENVELOPE_BINS)),
        "onset": round_values(resample_vector(onset, ENVELOPE_BINS)),
        "envelopeSeries": round_values(envelope),
        "onsetSeries": round_values(onset),
        "intervals": round_values(build_interval_profile(peak_indexes, sample_rate)),
        "density": round(len(peak_indexes) / max(1, len(onset)), 6),
        "peakRate": round(peak_rate, 6),
        "tempoEstimate": round(estimate_tempo(peak_indexes, sample_rate), 3),
        "peaksCount": len(peak_indexes),
        "peakTimes": round_values(peak_times),
        "fingerprints": build_rhythm_fingerprints(peak_times),
        "durationSeconds": round(len(samples) / sample_rate, 3),
        "hopSeconds": round(hop_seconds, 6),
        "rms": round(stats["rms"], 6),
        "peakAmplitude": round(stats["peak"], 6),
        "signalQuality": round(estimate_signal_quality(stats, len(peak_indexes), peak_rate), 6),
    }


def measure_signal(samples: array) -> dict:
    peak = 0
    energy = 0.0
    scale = 32768

    for sample in samples:
        value = sample / scale
        absolute = abs(value)
        peak = max(peak, absolute)
        energy += value * value

    return {
        "peak": peak,
        "rms": (energy / len(samples)) ** 0.5 if samples else 0,
    }


def build_envelope(samples: array, peak: float) -> list[float]:
    if not peak:
        return []

    hop = ANALYSIS_WINDOW // 2
    frame_values = []
    scale = 32768 * peak
    for start in range(0, max(0, len(samples) - ANALYSIS_WINDOW), hop):
        energy = 0.0
        for sample in samples[start : start + ANALYSIS_WINDOW]:
            value = sample / scale
            energy += value * value
        frame_values.append((energy / ANALYSIS_WINDOW) ** 0.5)

    return smooth_vector(normalize_array(frame_values), 4)


def build_onset_profile(envelope: list[float]) -> list[float]:
    onset = [0.0]
    for index in range(1, len(envelope)):
        onset.append(max(0.0, envelope[index] - envelope[index - 1]))
    return smooth_vector(normalize_array(onset), 2)


def detect_peaks(onset: list[float]) -> list[int]:
    if len(onset) < 3:
        return []

    sorted_values = sorted(onset)
    threshold = max(MIN_ONSET_THRESHOLD, sorted_values[int(len(sorted_values) * 0.78)] * 0.85)
    peaks = []
    for index in range(1, len(onset) - 1):
        value = onset[index]
        if value > threshold and value > onset[index - 1] and value >= onset[index + 1]:
            peaks.append(index)
    return peaks


def build_interval_profile(peak_indexes: list[int], sample_rate: int) -> list[float]:
    bins = 16
    histogram = [0.0] * bins
    hop_duration = (ANALYSIS_WINDOW / 2) / sample_rate
    min_interval = 0.08
    max_interval = 2.0
    import math

    log_min = math.log(min_interval)
    log_range = math.log(max_interval) - log_min
    for index in range(1, len(peak_indexes)):
        interval_seconds = (peak_indexes[index] - peak_indexes[index - 1]) * hop_duration
        if interval_seconds < min_interval or interval_seconds > max_interval:
            continue
        position = (math.log(interval_seconds) - log_min) / log_range
        bin_index = max(0, min(bins - 1, int(position * bins)))
        histogram[bin_index] += 1
    return normalize_array(histogram)


def estimate_tempo(peak_indexes: list[int], sample_rate: int) -> float:
    if len(peak_indexes) < 2:
        return 0.0

    hop_duration = (ANALYSIS_WINDOW / 2) / sample_rate
    intervals = sorted(
        (peak_indexes[index] - peak_indexes[index - 1]) * hop_duration
        for index in range(1, len(peak_indexes))
    )
    median = intervals[len(intervals) // 2]
    return max(0.0, min(260.0, 60 / median if median else 0.0))


def build_rhythm_fingerprints(peak_times: list[float]) -> list[dict]:
    fingerprints = []
    for anchor_index, anchor_time in enumerate(peak_times):
        max_second = min(len(peak_times) - 1, anchor_index + FINGERPRINT_MAX_NEIGHBORS)
        for second_index in range(anchor_index + 1, max_second + 1):
            first_interval = peak_times[second_index] - anchor_time
            if first_interval <= 0 or first_interval > FINGERPRINT_MAX_INTERVAL_SECONDS:
                continue
            max_third = min(len(peak_times) - 1, second_index + FINGERPRINT_MAX_NEIGHBORS)
            for third_index in range(second_index + 1, max_third + 1):
                second_interval = peak_times[third_index] - peak_times[second_index]
                total_interval = peak_times[third_index] - anchor_time
                if (
                    second_interval <= 0
                    or second_interval > FINGERPRINT_MAX_INTERVAL_SECONDS
                    or total_interval > FINGERPRINT_MAX_INTERVAL_SECONDS
                ):
                    continue
                fingerprints.append(
                    {
                        "hash": f"{quantize_interval(first_interval)}:{quantize_interval(second_interval)}",
                        "time": round(anchor_time, 3),
                    }
                )
    return fingerprints


def quantize_interval(seconds: float) -> int:
    return max(1, round(seconds / FINGERPRINT_INTERVAL_STEP))


def estimate_signal_quality(stats: dict, peaks_count: int, peak_rate: float) -> float:
    rms_score = clamp(stats["rms"] / 0.08, 0, 1)
    peak_score = clamp(stats["peak"] / 0.35, 0, 1)
    rhythm_score = clamp(peaks_count / 8, 0, 1)
    rate_score = clamp(peak_rate / 3, 0, 1)
    return rms_score * 0.35 + peak_score * 0.25 + rhythm_score * 0.25 + rate_score * 0.15


def resample_vector(vector: list[float], target_size: int) -> list[float]:
    if not vector:
        return [0.0] * target_size
    if len(vector) == target_size:
        return list(vector)

    output = []
    last_index = len(vector) - 1
    for index in range(target_size):
        position = (index / (target_size - 1)) * last_index
        base = int(position)
        mix = position - base
        left = vector[base]
        right = vector[min(base + 1, last_index)]
        output.append(left + (right - left) * mix)
    return output


def smooth_vector(vector: list[float], radius: int) -> list[float]:
    output = []
    for index in range(len(vector)):
        values = [
            vector[position]
            for position in range(index - radius, index + radius + 1)
            if 0 <= position < len(vector)
        ]
        output.append(sum(values) / len(values) if values else 0.0)
    return output


def normalize_array(values: list[float]) -> list[float]:
    maximum = max(values, default=0)
    if not maximum:
        return [0.0 for _ in values]
    return [value / maximum for value in values]


def round_values(values: list[float]) -> list[float]:
    return [round(value, 5) for value in values]


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


def main() -> None:
    project_root = Path(__file__).resolve().parent.parent
    manifest_path, features_path = write_library_files(project_root)
    print(f"Manifest generado en {manifest_path}")
    if features_path:
        print(f"Features generadas en {features_path}")
    else:
        print("Features no generadas: ffmpeg no está disponible")


if __name__ == "__main__":
    main()
