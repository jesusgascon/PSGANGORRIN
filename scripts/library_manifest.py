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
FEATURE_SCHEMA_VERSION = 4
REFERENCE_SEGMENT_SECONDS = (8, 10, 12)
MAX_REFERENCE_SEGMENTS = 8
SPECTRAL_BAND_FREQUENCIES = (90, 140, 220, 320, 450, 650, 900, 1300)
REQUIRED_FEATURE_KEYS = {
    "schemaVersion",
    "fingerprintsCount",
    "onsetContrast",
    "onsetPeakMean",
    "rhythmicStability",
    "signalQuality",
    "spectralProfile",
    "spectralFlux",
    "spectralFluxSeries",
    "strongSegments",
}


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
            and has_required_features(previous.get("features"))
        ):
            references.append({**previous, **entry})
            continue

        file_path = project_root / "assets" / "pasos" / entry["file"]
        try:
            references.append({**entry, **analyse_audio_file(file_path)})
        except (subprocess.SubprocessError, ValueError, OSError) as error:
            references.append({**entry, "error": str(error)})

    references = enrich_reference_segments(references)

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


def has_required_features(features: object) -> bool:
    return (
        isinstance(features, dict)
        and features.get("schemaVersion") == FEATURE_SCHEMA_VERSION
        and REQUIRED_FEATURE_KEYS.issubset(features.keys())
    )


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


def analyse_samples(samples: array, sample_rate: int, include_segments: bool = True) -> dict:
    stats = measure_signal(samples)
    envelope = build_envelope(samples, stats["peak"])
    onset = build_onset_profile(envelope)
    peak_indexes = detect_peaks(onset)
    hop_seconds = (ANALYSIS_WINDOW / 2) / sample_rate
    peak_times = [index * hop_seconds for index in peak_indexes]
    peak_rate = len(peak_indexes) / max(0.1, len(samples) / sample_rate)
    onset_profile = measure_onset_profile(onset, peak_indexes)
    rhythmic_stability = estimate_rhythmic_stability(peak_times)
    fingerprints = build_rhythm_fingerprints(peak_times)
    spectral_profile, spectral_flux_series = build_spectral_signature(samples, sample_rate)

    features = {
        "schemaVersion": FEATURE_SCHEMA_VERSION,
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
        "fingerprints": fingerprints,
        "fingerprintsCount": len(fingerprints),
        "onsetContrast": round(onset_profile["contrast"], 6),
        "onsetPeakMean": round(onset_profile["peak_mean"], 6),
        "rhythmicStability": round(rhythmic_stability, 6),
        "durationSeconds": round(len(samples) / sample_rate, 3),
        "hopSeconds": round(hop_seconds, 6),
        "rms": round(stats["rms"], 6),
        "peakAmplitude": round(stats["peak"], 6),
        "signalQuality": round(
            estimate_signal_quality(
                stats,
                len(peak_indexes),
                peak_rate,
                onset_profile["contrast"],
                rhythmic_stability,
            ),
            6,
        ),
        "spectralProfile": round_values(spectral_profile),
        "spectralFlux": round_values(resample_vector(spectral_flux_series, ENVELOPE_BINS)),
        "spectralFluxSeries": round_values(spectral_flux_series),
    }
    if include_segments:
        features["strongSegments"] = build_strong_segments(samples, sample_rate)
    else:
        features["strongSegments"] = []

    return features


def build_strong_segments(samples: array, sample_rate: int) -> list[dict]:
    duration_seconds = len(samples) / sample_rate
    if duration_seconds < min(REFERENCE_SEGMENT_SECONDS) + 2:
        return []

    frames = measure_energy_frames(samples, sample_rate)
    centers = find_strong_segment_centers(frames)
    centers.extend(find_distributed_segment_centers(samples, sample_rate))
    segments = []
    seen = set()

    for center in centers:
        for window_seconds in REFERENCE_SEGMENT_SECONDS:
            start_seconds = max(0.0, min(center - window_seconds / 2, duration_seconds - window_seconds))
            key = (round(start_seconds, 1), window_seconds)
            if key in seen:
                continue
            seen.add(key)

            start_sample = int(start_seconds * sample_rate)
            end_sample = min(len(samples), int((start_seconds + window_seconds) * sample_rate))
            if end_sample - start_sample < ANALYSIS_WINDOW:
                continue

            segment_features = analyse_samples(samples[start_sample:end_sample], sample_rate, include_segments=False)
            if segment_features["fingerprintsCount"] < 4 or segment_features["peaksCount"] < 4:
                continue

            score = (
                segment_features["signalQuality"] * 22
                + segment_features["onsetContrast"] * 18
                + min(18, segment_features["fingerprintsCount"] * 0.18)
                + min(12, segment_features["peaksCount"] * 0.6)
                + segment_features["rhythmicStability"] * 10
            )
            segments.append(
                {
                    "startSeconds": round(start_seconds, 3),
                    "durationSeconds": round((end_sample - start_sample) / sample_rate, 3),
                    "baseScore": round(score, 6),
                    "score": round(score, 6),
                    "features": segment_features,
                }
            )

    segments.sort(key=lambda item: item["score"], reverse=True)
    selected = []
    for segment in segments:
        if all(abs(segment["startSeconds"] - existing["startSeconds"]) > 4 for existing in selected):
            selected.append(segment)
        if len(selected) >= MAX_REFERENCE_SEGMENTS:
            break

    return selected


def measure_energy_frames(samples: array, sample_rate: int) -> list[dict]:
    frame_size = max(ANALYSIS_WINDOW, round(sample_rate * 0.25))
    hop_size = max(1, frame_size // 2)
    frames = []
    scale = 32768

    for start in range(0, max(0, len(samples) - frame_size + 1), hop_size):
        energy = 0.0
        for sample in samples[start : start + frame_size]:
            value = sample / scale
            energy += value * value
        frames.append(
            {
                "rms": (energy / frame_size) ** 0.5,
                "centerSeconds": (start + frame_size / 2) / sample_rate,
            }
        )

    return frames


def find_strong_segment_centers(frames: list[dict]) -> list[float]:
    ordered = sorted(frames, key=lambda item: item["rms"], reverse=True)
    centers = []
    for frame in ordered:
        center = frame["centerSeconds"]
        if all(abs(center - existing) > 6 for existing in centers):
            centers.append(center)
        if len(centers) >= MAX_REFERENCE_SEGMENTS:
            break
    return centers


def find_distributed_segment_centers(samples: array, sample_rate: int) -> list[float]:
    duration_seconds = len(samples) / sample_rate
    if duration_seconds < 40:
        return []

    markers = (0.12, 0.28, 0.45, 0.62, 0.8)
    return [duration_seconds * marker for marker in markers]


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


def build_spectral_signature(samples: array, sample_rate: int) -> tuple[list[float], list[float]]:
    if len(samples) < ANALYSIS_WINDOW:
        size = len(SPECTRAL_BAND_FREQUENCIES)
        return [0.0] * size, [0.0] * ENVELOPE_BINS

    hop = ANALYSIS_WINDOW // 2
    scale = 32768
    previous_bands = None
    band_frames: list[list[float]] = []
    flux_values: list[float] = []

    for start in range(0, max(0, len(samples) - ANALYSIS_WINDOW), hop):
        frame = [sample / scale for sample in samples[start : start + ANALYSIS_WINDOW]]
        band_values = [goertzel_magnitude(frame, sample_rate, frequency) for frequency in SPECTRAL_BAND_FREQUENCIES]
        band_values = normalize_array(band_values)
        band_frames.append(band_values)
        if previous_bands is None:
            flux_values.append(0.0)
        else:
            flux_values.append(
                sum(max(0.0, current - previous) for current, previous in zip(band_values, previous_bands))
                / max(1, len(band_values))
            )
        previous_bands = band_values

    if not band_frames:
        size = len(SPECTRAL_BAND_FREQUENCIES)
        return [0.0] * size, [0.0] * ENVELOPE_BINS

    profile = []
    for band_index in range(len(SPECTRAL_BAND_FREQUENCIES)):
        profile.append(sum(frame[band_index] for frame in band_frames) / len(band_frames))

    return normalize_array(profile), smooth_vector(normalize_array(flux_values), 2)


def goertzel_magnitude(frame: list[float], sample_rate: int, target_frequency: float) -> float:
    import math

    if not frame or target_frequency <= 0:
        return 0.0

    frame_size = len(frame)
    if frame_size < 4:
        return 0.0

    k = max(1, round(0.5 + (frame_size * target_frequency) / sample_rate))
    omega = (2.0 * math.pi * k) / frame_size
    coefficient = 2.0 * math.cos(omega)
    q0 = 0.0
    q1 = 0.0
    q2 = 0.0
    for sample in frame:
        q0 = coefficient * q1 - q2 + sample
        q2 = q1
        q1 = q0

    real = q1 - q2 * math.cos(omega)
    imaginary = q2 * math.sin(omega)
    return (real * real + imaginary * imaginary) ** 0.5


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


def measure_onset_profile(onset: list[float], peak_indexes: list[int]) -> dict:
    if not onset:
        return {"contrast": 0.0, "peak_mean": 0.0}

    peak_values = [onset[index] for index in peak_indexes if 0 <= index < len(onset)]
    sorted_values = sorted(onset)
    median = sorted_values[int(len(sorted_values) * 0.5)] if sorted_values else 0.0
    p90 = sorted_values[int(len(sorted_values) * 0.9)] if sorted_values else 0.0
    peak_mean = sum(peak_values) / len(peak_values) if peak_values else 0.0
    contrast = clamp(max(p90, peak_mean) - median, 0.0, 1.0)
    return {"contrast": contrast, "peak_mean": peak_mean}


def estimate_rhythmic_stability(peak_times: list[float]) -> float:
    if len(peak_times) < 4:
        return 0.0

    intervals = []
    for index in range(1, len(peak_times)):
        interval = peak_times[index] - peak_times[index - 1]
        if 0.06 < interval < 2.4:
            intervals.append(interval)
    if len(intervals) < 3:
        return 0.0

    intervals = sorted(intervals)
    median = intervals[len(intervals) // 2]
    if not median:
        return 0.0

    deviations = sorted(abs(interval - median) for interval in intervals)
    median_deviation = deviations[len(deviations) // 2] if deviations else 0.0
    return clamp(1 - median_deviation / max(0.08, median * 0.9), 0.0, 1.0)


def quantize_interval(seconds: float) -> int:
    return max(1, round(seconds / FINGERPRINT_INTERVAL_STEP))


def estimate_signal_quality(
    stats: dict,
    peaks_count: int,
    peak_rate: float,
    onset_contrast: float,
    rhythmic_stability: float,
) -> float:
    rms_score = clamp(stats["rms"] / 0.08, 0, 1)
    peak_score = clamp(stats["peak"] / 0.35, 0, 1)
    rhythm_score = clamp(peaks_count / 8, 0, 1)
    rate_score = clamp(peak_rate / 3, 0, 1)
    contrast_score = clamp(onset_contrast / 0.28, 0, 1)
    stability_score = clamp(rhythmic_stability, 0, 1)
    return (
        rms_score * 0.22
        + peak_score * 0.18
        + rhythm_score * 0.18
        + rate_score * 0.12
        + contrast_score * 0.18
        + stability_score * 0.12
    )


def enrich_reference_segments(references: list[dict]) -> list[dict]:
    ready_references = [reference for reference in references if isinstance(reference.get("features"), dict)]
    if len(ready_references) < 2:
        return references

    for reference in ready_references:
        features = reference["features"]
        segments = features.get("strongSegments") or []
        if not segments:
            continue

        rescored = []
        for segment in segments:
            segment_features = segment.get("features")
            if not isinstance(segment_features, dict):
                continue

            distinctiveness = estimate_segment_distinctiveness(
                segment_features,
                reference.get("file"),
                ready_references,
            )
            field_distinctiveness = estimate_field_segment_distinctiveness(
                segment_features,
                reference.get("file"),
                ready_references,
            )
            base_score = float(segment.get("baseScore", segment.get("score", 0.0)) or 0.0)
            rescored.append(
                {
                    **segment,
                    "baseScore": round(base_score, 6),
                    "distinctiveness": round(distinctiveness, 6),
                    "fieldDistinctiveness": round(field_distinctiveness, 6),
                    "score": round(base_score + distinctiveness * 16 + field_distinctiveness * 18, 6),
                }
            )

        rescored.sort(
            key=lambda item: (
                item.get("score", 0.0),
                item.get("fieldDistinctiveness", 0.0),
                item.get("distinctiveness", 0.0),
            ),
            reverse=True,
        )
        selected = []
        for segment in rescored:
            if all(abs(segment["startSeconds"] - existing["startSeconds"]) > 4 for existing in selected):
                selected.append(segment)
            if len(selected) >= MAX_REFERENCE_SEGMENTS:
                break
        features["strongSegments"] = selected

    return references


def estimate_segment_distinctiveness(segment_features: dict, owner_file: str | None, references: list[dict]) -> float:
    max_similarity = 0.0
    for reference in references:
        if reference.get("file") == owner_file:
            continue
        for variant_features in iter_reference_variant_features(reference):
            similarity = measure_reference_similarity(segment_features, variant_features)
            if similarity > max_similarity:
                max_similarity = similarity
    return clamp(1 - max_similarity, 0.0, 1.0)


def estimate_field_segment_distinctiveness(segment_features: dict, owner_file: str | None, references: list[dict]) -> float:
    max_similarity = 0.0
    for reference in references:
        if reference.get("file") == owner_file:
            continue
        for variant_features in iter_reference_variant_features(reference):
            similarity = measure_field_reference_similarity(segment_features, variant_features)
            if similarity > max_similarity:
                max_similarity = similarity
    return clamp(1 - max_similarity, 0.0, 1.0)


def iter_reference_variant_features(reference: dict) -> list[dict]:
    features = reference.get("features")
    if not isinstance(features, dict):
        return []

    variants = [features]
    segments = features.get("strongSegments") or []
    for segment in segments[:3]:
        if isinstance(segment, dict) and isinstance(segment.get("features"), dict):
            variants.append(segment["features"])
    return variants


def measure_reference_similarity(left: dict, right: dict) -> float:
    onset_similarity = clamp(1 - vector_distance(left.get("onset", []), right.get("onset", [])), 0.0, 1.0)
    envelope_similarity = clamp(1 - vector_distance(left.get("envelope", []), right.get("envelope", [])), 0.0, 1.0)
    interval_similarity = clamp(1 - vector_distance(left.get("intervals", []), right.get("intervals", [])), 0.0, 1.0)
    spectral_similarity = clamp(
        1 - vector_distance(left.get("spectralProfile", []), right.get("spectralProfile", [])),
        0.0,
        1.0,
    )
    flux_similarity = clamp(
        1 - vector_distance(left.get("spectralFlux", []), right.get("spectralFlux", [])),
        0.0,
        1.0,
    )
    tempo_similarity = clamp(
        1 - abs(float(left.get("tempoEstimate", 0.0)) - float(right.get("tempoEstimate", 0.0))) / 180,
        0.0,
        1.0,
    )
    density_similarity = clamp(
        1 - abs(float(left.get("density", 0.0)) - float(right.get("density", 0.0))),
        0.0,
        1.0,
    )
    fingerprint_similarity = fingerprint_hash_similarity(
        left.get("fingerprints", []) or [],
        right.get("fingerprints", []) or [],
    )

    return clamp(
        onset_similarity * 0.2
        + envelope_similarity * 0.18
        + interval_similarity * 0.16
        + spectral_similarity * 0.18
        + flux_similarity * 0.14
        + fingerprint_similarity * 0.08
        + tempo_similarity * 0.04
        + density_similarity * 0.02,
        0.0,
        1.0,
    )


def measure_field_reference_similarity(left: dict, right: dict) -> float:
    onset_similarity = clamp(1 - vector_distance(left.get("onset", []), right.get("onset", [])), 0.0, 1.0)
    envelope_similarity = clamp(1 - vector_distance(left.get("envelope", []), right.get("envelope", [])), 0.0, 1.0)
    interval_similarity = clamp(1 - vector_distance(left.get("intervals", []), right.get("intervals", [])), 0.0, 1.0)
    spectral_similarity = clamp(
        1 - vector_distance(left.get("spectralProfile", []), right.get("spectralProfile", [])),
        0.0,
        1.0,
    )
    flux_similarity = clamp(
        1 - vector_distance(left.get("spectralFlux", []), right.get("spectralFlux", [])),
        0.0,
        1.0,
    )
    tempo_similarity = clamp(
        1 - abs(float(left.get("tempoEstimate", 0.0)) - float(right.get("tempoEstimate", 0.0))) / 180,
        0.0,
        1.0,
    )
    density_similarity = clamp(
        1 - abs(float(left.get("density", 0.0)) - float(right.get("density", 0.0))),
        0.0,
        1.0,
    )

    return clamp(
        onset_similarity * 0.22
        + envelope_similarity * 0.23
        + interval_similarity * 0.18
        + spectral_similarity * 0.18
        + flux_similarity * 0.12
        + tempo_similarity * 0.05
        + density_similarity * 0.02,
        0.0,
        1.0,
    )


def fingerprint_hash_similarity(left: list[dict], right: list[dict]) -> float:
    left_hashes = {item.get("hash") for item in left if item.get("hash")}
    right_hashes = {item.get("hash") for item in right if item.get("hash")}
    if not left_hashes or not right_hashes:
        return 0.0
    shared = len(left_hashes & right_hashes)
    return shared / max(len(left_hashes), len(right_hashes))


def vector_distance(left: list[float], right: list[float]) -> float:
    size = max(len(left), len(right))
    total = 0.0
    for index in range(size):
        a = left[index] if index < len(left) else (left[-1] if left else 0.0)
        b = right[index] if index < len(right) else (right[-1] if right else 0.0)
        total += (a - b) ** 2
    return (total / size) ** 0.5 if size else 0.0


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
