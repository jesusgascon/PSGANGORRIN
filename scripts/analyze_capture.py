#!/usr/bin/env python3

from __future__ import annotations

import argparse
import sys
from array import array
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from library_manifest import FEATURE_SAMPLE_RATE, analyse_samples, decode_audio  # noqa: E402
from validate_detection import (  # noqa: E402
    compare_against_references,
    get_match_ambiguity,
    is_reliable_match,
    is_usable_capture,
    limit_for,
    load_limits,
    load_references,
)

CAPTURE_FRAME_SECONDS = 0.12
CAPTURE_WINDOW_SECONDS = (6, 8, 10, 12)
MAX_CAPTURE_CANDIDATES = 9


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analiza grabaciones reales de microfono o monitor contra la biblioteca de CofraBeat."
    )
    parser.add_argument("files", nargs="+", type=Path, help="WAV/MP3/M4A/OGG capturados para analizar.")
    parser.add_argument("--project-root", type=Path, default=PROJECT_ROOT)
    parser.add_argument("--mode", choices=("balanced", "fast", "field", "strict"), default="field")
    parser.add_argument("--minimum-confidence", type=float, default=45)
    parser.add_argument("--top", type=int, default=4)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    references = load_references(args.project_root)
    limits = load_limits(args.project_root)

    for capture_path in args.files:
        print_capture_result(capture_path, references, limits, args)


def print_capture_result(capture_path: Path, references: list[dict], limits: dict, args: argparse.Namespace) -> None:
    print()
    print(f"=== {capture_path} ===")
    if not capture_path.exists():
        print("No existe el archivo.")
        return

    samples = decode_audio(capture_path)
    candidate = analyze_best_candidate(samples, references, limits, args)
    features = candidate["features"]
    usable, reason = is_usable_capture(features, limits, args.mode)
    matches = candidate["matches"] if usable else []
    best = matches[0] if matches else None
    ambiguity = get_match_ambiguity(matches, limits, args.minimum_confidence, args.mode) if matches else None
    reliable = bool(best and is_reliable_match(best, limits, args.minimum_confidence, args.mode) and not ambiguity)

    print(f"Duracion: {features['durationSeconds']:.2f} s")
    if not candidate["is_full_capture"]:
        print(f"Tramo elegido: {candidate['durationSeconds']:.2f} s desde {candidate['startSeconds']:.2f} s")
    preprocess = candidate.get("preprocess", {})
    if preprocess.get("applied"):
        print(
            "Preprocesado: DC/gate suave "
            f"(ruido {preprocess.get('noiseGateThreshold', 0):.4f}, "
            f"RMS original {preprocess.get('sourceRms', 0):.4f})"
        )
    print(f"RMS: {features['rms']:.4f}")
    print(f"Pico: {features['peakAmplitude']:.4f}")
    print(f"Golpes: {features['peaksCount']}")
    print(f"Fingerprints: {features['fingerprintsCount']}")
    print(f"Calidad: {features['signalQuality']:.3f}")
    print(f"Contraste: {features['onsetContrast']:.3f}")
    print(f"Estabilidad: {features['rhythmicStability']:.3f}")
    print(f"Timbre espectral: {sum(features.get('spectralProfile', []) or [0]) / max(1, len(features.get('spectralProfile', []) or [1])):.3f}")
    print(f"Tempo: {features['tempoEstimate']:.1f} bpm")
    print(f"Captura usable: {'si' if usable else 'no'}")

    if not usable:
        print(f"Motivo: {reason}")
        return

    if not matches:
        print("Sin referencias comparables.")
        return

    if reliable:
        print(f"Resultado: {best['reference'].get('name')} ({best['confidence']}%)")
    elif ambiguity:
        print(f"Resultado ambiguo: {best['reference'].get('name')} / {ambiguity['reference'].get('name')}")
    else:
        print("Sin deteccion fiable.")

    print("Ranking:")
    for index, match in enumerate(matches[: max(1, args.top)], 1):
        alignment = match.get("alignment", {})
        diagnostics = match.get("diagnostics", {})
        variant = match.get("referenceVariant", {})
        variant_label = "completo"
        if variant.get("type") == "segment":
            variant_label = f"segmento {variant.get('startSeconds', 0):.1f}s/{variant.get('durationSeconds', 0):.1f}s"
        print(
            f"  {index}. {match['reference'].get('name')} - {match['confidence']}% "
            f"- evidencia {match['evidenceScore']:.3f} "
            f"- votos {alignment.get('fingerprintVotes', 0)} "
            f"- patron {diagnostics.get('patternScore', 0):.3f} "
            f"- timbre {diagnostics.get('timbreScore', 0):.3f} "
            f"- ritmo {diagnostics.get('rhythmSimilarity', 0):.3f} "
            f"- envolvente {diagnostics.get('envelopeSimilarity', 0):.3f} "
            f"- intervalos {diagnostics.get('intervalSimilarity', 0):.3f} "
            f"- espectro {diagnostics.get('spectralSimilarity', 0):.3f} "
            f"- flujo {diagnostics.get('spectralFluxSimilarity', 0):.3f} "
            f"- dominio {diagnostics.get('patternDominance', 0):.3f} "
            f"- bonus {diagnostics.get('fieldLeadershipBonus', 0):.3f} "
            f"- perfil {'lento' if diagnostics.get('slowPatternProfile') else 'normal'} "
            f"- penalizacion micro {diagnostics.get('microphonePenalty', 0):.3f} "
            f"- {variant_label}"
        )


def analyze_best_candidate(
    samples: array,
    references: list[dict],
    limits: dict,
    args: argparse.Namespace,
) -> dict:
    prepared_samples, preprocess_metrics = prepare_capture_samples(samples, limits, args.mode)
    windows = build_capture_windows(prepared_samples)
    best_candidate = None
    fallback_candidate = None

    for order, window in enumerate(windows):
        features = analyse_samples(window["samples"], FEATURE_SAMPLE_RATE)
        usable, _reason = is_usable_capture(features, limits, args.mode)
        matches = compare_against_references(features, references, limits, args.mode) if usable else []
        best = matches[0] if matches else None
        ambiguity = get_match_ambiguity(matches, limits, args.minimum_confidence, args.mode) if best else None
        reliable = bool(best and is_reliable_match(best, limits, args.minimum_confidence, args.mode) and not ambiguity)
        score = score_candidate(features, best, ambiguity, reliable, order, args.mode)
        candidate = {
            **window,
            "features": features,
            "matches": matches,
            "reliable": reliable,
            "preprocess": preprocess_metrics,
            "score": score,
        }

        if fallback_candidate is None or score > fallback_candidate["score"]:
            fallback_candidate = candidate
        if usable and best and (best_candidate is None or is_better_candidate(candidate, best_candidate)):
            best_candidate = candidate

    return best_candidate or fallback_candidate


def prepare_capture_samples(samples: array, limits: dict, mode_key: str) -> tuple[array, dict]:
    if not samples:
        return samples, {"applied": False}

    scale = 32768
    source_values = [sample / scale for sample in samples]
    source_rms = (sum(value * value for value in source_values) / len(source_values)) ** 0.5
    source_peak = max(abs(value) for value in source_values)
    dc_offset = sum(source_values) / len(source_values)
    centered = [value - dc_offset for value in source_values]
    centered_rms = (sum(value * value for value in centered) / len(centered)) ** 0.5
    centered_peak = max(abs(value) for value in centered)

    if (
        centered_rms < limit_for(limits, "minSignalRms", mode_key) * 0.55
        or centered_peak < limit_for(limits, "minSignalPeak", mode_key) * 0.55
    ):
        output = array("h", [int(max(-1, min(1, value)) * 32767) for value in centered])
        return output, {
            "applied": abs(dc_offset) > 0.0005,
            "dcOffset": dc_offset,
            "noiseGateThreshold": 0,
            "sourceRms": source_rms,
            "sourcePeak": source_peak,
        }

    step = max(1, len(centered) // 2400)
    abs_samples = sorted(abs(value) for value in centered[::step])
    noise_floor = abs_samples[int(len(abs_samples) * 0.35)] if abs_samples else 0
    gate_threshold = max(noise_floor * 2.2, centered_rms * 0.055, 0.0015)
    processed = []
    for value in centered:
        absolute = abs(value)
        if absolute < gate_threshold:
            processed.append(value * 0.22)
        elif absolute < gate_threshold * 1.8:
            mix = (absolute - gate_threshold) / gate_threshold
            processed.append(value * max(0.22, min(0.72, 0.22 + mix * 0.5)))
        else:
            processed.append(value)

    output = array("h", [int(max(-1, min(1, value)) * 32767) for value in processed])
    return output, {
        "applied": True,
        "dcOffset": dc_offset,
        "noiseGateThreshold": gate_threshold,
        "sourceRms": source_rms,
        "sourcePeak": source_peak,
    }


def is_better_candidate(candidate: dict, current: dict) -> bool:
    if candidate.get("reliable") != current.get("reliable"):
        return bool(candidate.get("reliable"))
    return candidate["score"] > current["score"]


def build_capture_windows(samples: array) -> list[dict]:
    duration_seconds = len(samples) / FEATURE_SAMPLE_RATE
    windows = [
        {
            "samples": samples,
            "startSeconds": 0.0,
            "durationSeconds": duration_seconds,
            "is_full_capture": True,
        }
    ]
    if duration_seconds <= 6.5:
        return windows

    active_range = find_active_range(samples)
    if active_range:
        active_center = (active_range[0] + active_range[1]) / 2
        for window_seconds in CAPTURE_WINDOW_SECONDS:
            add_window(windows, samples, active_center - window_seconds / 2, window_seconds)
        add_window(windows, samples, active_range[0] - 0.5, min(duration_seconds, active_range[1] - active_range[0] + 1))

    for center in find_strongest_centers(samples):
        add_window(windows, samples, center - 4, 8)
        add_window(windows, samples, center - 3, 6)

    return windows[:MAX_CAPTURE_CANDIDATES]


def add_window(windows: list[dict], samples: array, start_seconds: float, window_seconds: float) -> None:
    total_seconds = len(samples) / FEATURE_SAMPLE_RATE
    duration = min(window_seconds, total_seconds)
    if duration < 3.8:
        return

    start = max(0.0, min(start_seconds, max(0.0, total_seconds - duration)))
    if any(abs(item["startSeconds"] - start) < 0.18 and abs(item["durationSeconds"] - duration) < 0.18 for item in windows):
        return

    start_sample = int(start * FEATURE_SAMPLE_RATE)
    end_sample = min(len(samples), int((start + duration) * FEATURE_SAMPLE_RATE))
    if end_sample - start_sample < 2048:
        return

    windows.append(
        {
            "samples": samples[start_sample:end_sample],
            "startSeconds": start,
            "durationSeconds": (end_sample - start_sample) / FEATURE_SAMPLE_RATE,
            "is_full_capture": False,
        }
    )


def find_active_range(samples: array) -> tuple[float, float] | None:
    frames = measure_frames(samples)
    if not frames:
        return None

    values = sorted(frame["rms"] for frame in frames)
    median = values[int(len(values) * 0.5)] if values else 0
    p80 = values[int(len(values) * 0.8)] if values else 0
    peak = values[-1] if values else 0
    threshold = max(0.003, median * 1.8, p80 * 0.55, peak * 0.16)
    active_indexes = [index for index, frame in enumerate(frames) if frame["rms"] >= threshold]
    if not active_indexes:
        return None

    start_index = max(0, active_indexes[0] - 2)
    end_index = min(len(frames) - 1, active_indexes[-1] + 2)
    return frames[start_index]["startSeconds"], frames[end_index]["endSeconds"]


def find_strongest_centers(samples: array) -> list[float]:
    ordered = sorted((frame for frame in measure_frames(samples) if frame["rms"] > 0.003), key=lambda item: item["rms"], reverse=True)
    centers = []
    for frame in ordered:
        center = (frame["startSeconds"] + frame["endSeconds"]) / 2
        if all(abs(existing - center) > 2.5 for existing in centers):
            centers.append(center)
        if len(centers) >= 3:
            break
    return centers


def measure_frames(samples: array) -> list[dict]:
    frame_size = max(2048, round(FEATURE_SAMPLE_RATE * CAPTURE_FRAME_SECONDS))
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
                "startSeconds": start / FEATURE_SAMPLE_RATE,
                "endSeconds": (start + frame_size) / FEATURE_SAMPLE_RATE,
            }
        )
    return frames


def score_candidate(
    features: dict,
    best: dict | None,
    ambiguity: dict | None,
    reliable: bool,
    order: int,
    mode_key: str,
) -> float:
    match_score = 0.0
    if best:
        votes = best["alignment"].get("fingerprintVotes", 0)
        diagnostics = best.get("diagnostics", {})
        if mode_key == "field":
            match_score = (
                best["confidence"] * 0.34
                + best["evidenceScore"] * 30
                + best["absoluteSimilarity"] * 13
                + diagnostics.get("patternScore", 0) * 21
                + diagnostics.get("timbreScore", 0) * 19
                + diagnostics.get("rhythmSimilarity", 0) * 8
                + diagnostics.get("envelopeSimilarity", 0) * 8
                + diagnostics.get("spectralSimilarity", 0) * 8
                + diagnostics.get("spectralFluxSimilarity", 0) * 7
                + diagnostics.get("fieldLeadershipBonus", 0) * 18
                + min(2.2, votes * 0.11)
            )
        else:
            match_score = (
                best["confidence"] * 0.45
                + best["evidenceScore"] * 35
                + best["absoluteSimilarity"] * 20
                + min(12, votes * 0.7)
            )
    if mode_key == "field":
        quality_score = (
            features["signalQuality"] * 18
            + features["onsetContrast"] * 12
            + features["rhythmicStability"] * 8
            + min(8, features["peaksCount"] * 0.35)
            + min(4, features["fingerprintsCount"] * 0.04)
        )
    else:
        quality_score = (
            features["signalQuality"] * 16
            + features["onsetContrast"] * 10
            + min(8, features["peaksCount"] * 0.35)
            + min(8, features["fingerprintsCount"] * 0.08)
        )
    return match_score + quality_score + (25 if reliable else 0) - (18 if ambiguity else 0) - order * 0.3


if __name__ == "__main__":
    main()
