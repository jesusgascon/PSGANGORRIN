#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import random
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from calibrate_detection import write_calibration_files  # noqa: E402
from library_manifest import write_library_files  # noqa: E402


ANALYSIS_WINDOW = 2048
FINGERPRINT_MAX_NEIGHBORS = 5
FINGERPRINT_MAX_INTERVAL_SECONDS = 3.2
FINGERPRINT_INTERVAL_STEP = 0.05
FINGERPRINT_OFFSET_STEP = 0.25
SUBSEQUENCE_STRIDE_DIVISOR = 18
MATCHES_LIMIT = 4

MODE_PRESETS = {
    "fast": {
        "fingerprint": 0.32,
        "rhythm": 0.28,
        "envelope": 0.08,
        "interval": 0.16,
        "density": 0.06,
        "tempo": 0.06,
        "peaks": 0.04,
    },
    "field": {
        "fingerprint": 0.26,
        "rhythm": 0.3,
        "envelope": 0.12,
        "interval": 0.18,
        "density": 0.06,
        "tempo": 0.06,
        "peaks": 0.02,
    },
    "balanced": {
        "fingerprint": 0.36,
        "rhythm": 0.24,
        "envelope": 0.08,
        "interval": 0.18,
        "density": 0.06,
        "tempo": 0.06,
        "peaks": 0.02,
    },
    "strict": {
        "fingerprint": 0.42,
        "rhythm": 0.2,
        "envelope": 0.06,
        "interval": 0.2,
        "density": 0.04,
        "tempo": 0.06,
        "peaks": 0.02,
    },
}

DEFAULT_LIMITS = {
    "minOnsetThreshold": 0.18,
    "minSignalRms": 0.012,
    "minSignalPeak": 0.045,
    "minPeakRate": 0.45,
    "minCapturePeaks": 3,
    "minMatchConfidence": 28,
    "minSignalQuality": 0.22,
    "minOnsetContrast": 0.12,
    "minCaptureFingerprints": 2,
    "minRhythmicStability": 0.12,
    "minMatchAbsoluteSimilarity": 0.38,
    "minMatchEvidence": 0.42,
    "minFingerprintVotes": 2,
    "minFingerprintSimilarity": 0.08,
    "minRhythmSimilarity": 0.36,
    "minTopMatchMargin": 5,
}

MODE_LIMIT_OVERRIDES = {
    "field": {
        "minMatchConfidence": 40,
        "minSignalQuality": 0.35,
        "minCaptureFingerprints": 8,
        "minMatchAbsoluteSimilarity": 0.42,
        "minMatchEvidence": 0.58,
        "minFingerprintVotes": 6,
        "minFingerprintSimilarity": 0.12,
        "minRhythmSimilarity": 0.45,
        "minTopMatchMargin": 10,
    },
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Simula detecciones con MP3 de la biblioteca para validar la calibracion."
    )
    parser.add_argument("--project-root", type=Path, default=PROJECT_ROOT)
    parser.add_argument("--seconds", type=float, default=6.0, help="Duracion simulada de escucha.")
    parser.add_argument("--min-seconds", type=float, help="Duracion minima aleatoria por ensayo.")
    parser.add_argument("--max-seconds", type=float, help="Duracion maxima aleatoria por ensayo.")
    parser.add_argument("--runs", type=int, default=1, help="Numero de ensayos aleatorios.")
    parser.add_argument(
        "--random-segments",
        action="store_true",
        help="Usa trozos aleatorios en vez del tramo con mas golpes.",
    )
    parser.add_argument(
        "--active-segments",
        action="store_true",
        help="Usa trozos aleatorios con actividad ritmica suficiente.",
    )
    parser.add_argument(
        "--require-usable",
        action="store_true",
        help="Reintenta otro trozo si la captura simulada no tiene suficientes golpes.",
    )
    parser.add_argument("--max-attempts", type=int, default=30, help="Intentos por ensayo usable.")
    parser.add_argument("--mode", choices=sorted(MODE_PRESETS), default="fast")
    parser.add_argument("--minimum-confidence", type=float, default=45)
    parser.add_argument("--seed", type=int, default=7)
    parser.add_argument("--all", action="store_true", help="Valida todas las referencias.")
    parser.add_argument("--file", help="Valida solo el archivo indicado.")
    parser.add_argument(
        "--skip-regenerate",
        action="store_true",
        help="No regenera manifest/features/calibration antes de validar.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()

    if not args.skip_regenerate:
        write_library_files(project_root)
        write_calibration_files(project_root, regenerate_library=False)

    references = load_references(project_root)
    limits = load_limits(project_root)
    rng = random.Random(args.seed)
    trials = build_trials(references, args, rng)
    results = []
    for trial in trials:
        results.append(
            validate_reference(
                trial["reference"],
                references,
                limits,
                args,
                seconds=trial["seconds"],
                rng=rng,
                trial_number=trial["trial"],
            )
        )

    passed = [result for result in results if result["outcome"] == "confirmed"]
    ambiguous = [result for result in results if result["outcome"] == "ambiguous"]
    low_confidence = [result for result in results if result["outcome"] == "low_confidence"]
    wrong = [result for result in results if result["outcome"] == "wrong"]
    unusable = [result for result in results if result["outcome"] == "unusable"]

    print(f"Referencias validadas: {len(results)}")
    print(f"Confirmadas correctas: {len(passed)}")
    print(f"Ambiguas no confirmadas: {len(ambiguous)}")
    print(f"Correctas por debajo del umbral: {len(low_confidence)}")
    print(f"Confusiones reales: {len(wrong)}")
    print(f"Capturas no usables: {len(unusable)}")
    print("")

    for result in results:
        status = {
            "confirmed": "OK",
            "ambiguous": "AMBIGUO",
            "low_confidence": "BAJO",
            "wrong": "FALLO",
            "unusable": "NO USABLE",
        }.get(result["outcome"], "FALLO")
        prefix = f"Ensayo {result['trial']}: " if result["trial"] else ""
        print(f"[{status}] {prefix}{result['expected_name']}")
        print(f"  Esperado: {result['expected_file']}")
        print(
            f"  Fragmento: {result['seconds']:.1f} s "
            f"desde {result['startSeconds']:.1f} s "
            f"({result['peaksCount']} golpes, {result['fingerprintsCount']} fingerprints)"
        )
        if result["attempts"] > 1:
            print(f"  Reintentos hasta captura usable: {result['attempts']}")
        if result["usable"]:
            print(
                "  Mejor: "
                f"{result['best_name']} "
                f"({result['confidence']}%, evidencia {result['evidence']:.3f})"
            )
            if result["ambiguous_with"]:
                print(f"  Ambiguo con: {result['ambiguous_with']}")
        else:
            print(f"  Captura no usable: {result['reason']}")
        if result["ranking"]:
            print("  Ranking:")
            for index, match in enumerate(result["ranking"], start=1):
                print(
                    f"    {index}. {match['name']} "
                    f"- {match['confidence']}% "
                    f"- evidencia {match['evidenceScore']:.3f}"
                )
        print("")

    if wrong or unusable:
        raise SystemExit(1)


def load_references(project_root: Path) -> list[dict]:
    features_path = project_root / "assets" / "pasos" / "features.json"
    payload = json.loads(features_path.read_text(encoding="utf-8"))
    references = [
        reference
        for reference in payload.get("references", [])
        if isinstance(reference.get("features"), dict)
    ]
    if not references:
        raise SystemExit("No hay referencias con features para validar.")
    return references


def load_limits(project_root: Path) -> dict:
    calibration_path = project_root / "assets" / "pasos" / "calibration.json"
    if not calibration_path.exists():
        return dict(DEFAULT_LIMITS)

    payload = json.loads(calibration_path.read_text(encoding="utf-8"))
    limits = dict(DEFAULT_LIMITS)
    for key, value in payload.get("recommendedLimits", {}).items():
        try:
            limits[key] = float(value)
        except (TypeError, ValueError):
            pass
    return limits


def limit_for(limits: dict, key: str, mode_key: str = "fast") -> float:
    return MODE_LIMIT_OVERRIDES.get(mode_key, {}).get(key, limits[key])


def select_references(references: list[dict], args: argparse.Namespace) -> list[dict]:
    if args.file:
        selected = [reference for reference in references if reference.get("file") == args.file]
        if not selected:
            raise SystemExit(f"No existe la referencia {args.file!r}")
        return selected

    if args.all:
        return references

    rng = random.Random(args.seed)
    return [rng.choice(references)]


def build_trials(references: list[dict], args: argparse.Namespace, rng: random.Random) -> list[dict]:
    selected = select_references(references, args)
    run_count = max(1, args.runs)
    if args.file or args.all:
        if run_count == 1:
            return [
                {"trial": index + 1 if len(selected) > 1 else 0, "reference": reference, "seconds": args.seconds}
                for index, reference in enumerate(selected)
            ]
        base_references = selected
    else:
        base_references = references

    trials = []
    for trial in range(1, run_count + 1):
        reference = rng.choice(base_references)
        trials.append(
            {
                "trial": trial,
                "reference": reference,
                "seconds": choose_trial_seconds(args, rng),
            }
        )
    return trials


def choose_trial_seconds(args: argparse.Namespace, rng: random.Random) -> float:
    minimum = args.min_seconds if args.min_seconds is not None else args.seconds
    maximum = args.max_seconds if args.max_seconds is not None else args.seconds
    if maximum < minimum:
        minimum, maximum = maximum, minimum
    if maximum == minimum:
        return float(minimum)
    return rng.uniform(minimum, maximum)


def validate_reference(
    reference: dict,
    all_references: list[dict],
    limits: dict,
    args: argparse.Namespace,
    seconds: float | None = None,
    rng: random.Random | None = None,
    trial_number: int = 0,
) -> dict:
    capture = None
    usable = False
    reason = ""
    attempts = max(1, args.max_attempts if args.require_usable else 1)
    for attempt in range(1, attempts + 1):
        capture = build_capture_from_reference(
            reference,
            seconds if seconds is not None else args.seconds,
            rng=rng,
            random_segment=args.random_segments or args.runs > 1,
            active_segment=args.active_segments,
        )
        usable, reason = is_usable_capture(capture, limits, args.mode)
        if usable or not args.require_usable:
            break

    if capture is None:
        raise RuntimeError("No se pudo construir la captura simulada")
    matches = compare_against_references(capture, all_references, limits, args.mode) if usable else []
    best = matches[0] if matches else None
    ambiguity = get_match_ambiguity(matches, limits, args.minimum_confidence, args.mode)
    reliable = bool(best and is_reliable_match(best, limits, args.minimum_confidence, args.mode))
    expected_file = reference.get("file")
    outcome = classify_outcome(best, matches, ambiguity, reliable, expected_file, usable)

    return {
        "outcome": outcome,
        "usable": usable,
        "reason": reason,
        "expected_file": expected_file,
        "expected_name": reference.get("name") or expected_file,
        "best_name": best["reference"].get("name") if best else "",
        "ambiguous_with": ambiguity["reference"].get("name") if ambiguity else "",
        "confidence": best["confidence"] if best else 0,
        "evidence": best["evidenceScore"] if best else 0,
        "ranking": [
            {
                "name": match["reference"].get("name"),
                "file": match["reference"].get("file"),
                "confidence": match["confidence"],
                "evidenceScore": match["evidenceScore"],
            }
            for match in matches
        ],
        "trial": trial_number,
        "seconds": capture["requestedSeconds"],
        "startSeconds": capture["startSeconds"],
        "peaksCount": capture["peaksCount"],
        "fingerprintsCount": capture["fingerprintsCount"],
        "attempts": attempt,
}


def classify_outcome(
    best: dict | None,
    matches: list[dict],
    ambiguity: dict | None,
    reliable: bool,
    expected_file: str,
    usable: bool,
) -> str:
    if not usable:
        return "unusable"
    if not best:
        return "wrong"

    best_file = best["reference"].get("file")
    candidate_files = {match["reference"].get("file") for match in matches[:2]}
    if ambiguity and expected_file in candidate_files:
        return "ambiguous"
    if reliable and best_file == expected_file:
        return "confirmed"
    if best_file == expected_file:
        return "low_confidence"
    return "wrong"


def build_capture_from_reference(
    reference: dict,
    seconds: float,
    rng: random.Random | None = None,
    random_segment: bool = False,
    active_segment: bool = False,
) -> dict:
    features = reference["features"]
    hop_seconds = float(features.get("hopSeconds") or 0.04644)
    window_length = max(4, round(seconds / hop_seconds))
    onset_series = features.get("onsetSeries") or features.get("onset") or []
    envelope_series = features.get("envelopeSeries") or features.get("envelope") or []
    start = choose_segment_start(onset_series, window_length, rng, random_segment, active_segment)
    end = min(len(onset_series), start + window_length)

    onset = list(onset_series[start:end])
    envelope = list(envelope_series[start:end])
    peak_times = [
        float(time) - start * hop_seconds
        for time in features.get("peakTimes", [])
        if start * hop_seconds <= float(time) < end * hop_seconds
    ]
    peak_indexes = [round(time / hop_seconds) for time in peak_times]
    duration = max(seconds, len(onset) * hop_seconds)
    peak_rate = len(peak_times) / max(0.1, duration)
    fingerprints = build_rhythm_fingerprints(peak_times)
    onset_profile = measure_onset_profile(onset, peak_indexes)
    rhythmic_stability = estimate_rhythmic_stability(peak_times)
    stats = {
        "rms": float(features.get("rms") or 0),
        "peak": float(features.get("peakAmplitude") or 0),
    }

    return {
        "envelopeSeries": envelope,
        "onsetSeries": onset,
        "intervals": build_interval_profile(peak_indexes, hop_seconds),
        "density": len(peak_indexes) / max(1, len(onset)),
        "peakRate": peak_rate,
        "tempoEstimate": estimate_tempo(peak_times),
        "peaksCount": len(peak_indexes),
        "peakTimes": peak_times,
        "fingerprints": fingerprints,
        "fingerprintsCount": len(fingerprints),
        "durationSeconds": duration,
        "hopSeconds": hop_seconds,
        "rms": stats["rms"],
        "peakAmplitude": stats["peak"],
        "onsetContrast": onset_profile["contrast"],
        "onsetPeakMean": onset_profile["peakMean"],
        "rhythmicStability": rhythmic_stability,
        "signalQuality": estimate_signal_quality(
            stats,
            len(peak_indexes),
            peak_rate,
            onset_profile["contrast"],
            rhythmic_stability,
        ),
        "requestedSeconds": seconds,
        "startSeconds": start * hop_seconds,
    }


def choose_segment_start(
    onset: list[float],
    window_length: int,
    rng: random.Random | None = None,
    random_segment: bool = False,
    active_segment: bool = False,
) -> int:
    if len(onset) <= window_length:
        return 0

    if active_segment:
        random_source = rng or random.Random()
        candidates = active_segment_starts(onset, window_length)
        if candidates:
            return random_source.choice(candidates)

    if random_segment:
        random_source = rng or random.Random()
        return random_source.randint(0, len(onset) - window_length)

    best_start = 0
    best_energy = -1.0
    stride = max(1, window_length // 3)
    for start in range(0, len(onset) - window_length + 1, stride):
        energy = sum(onset[start : start + window_length])
        if energy > best_energy:
            best_energy = energy
            best_start = start
    return best_start


def active_segment_starts(onset: list[float], window_length: int) -> list[int]:
    stride = max(1, window_length // 4)
    scored = []
    for start in range(0, len(onset) - window_length + 1, stride):
        window = onset[start : start + window_length]
        energy = sum(window)
        strong_bins = sum(1 for value in window if value >= 0.18)
        scored.append((start, energy, strong_bins))

    if not scored:
        return []

    max_energy = max(item[1] for item in scored)
    min_energy = max_energy * 0.35
    return [
        start
        for start, energy, strong_bins in scored
        if energy >= min_energy and strong_bins >= 2
    ]


def is_usable_capture(features: dict, limits: dict, mode_key: str = "fast") -> tuple[bool, str]:
    checks = [
        ("rms", features["rms"], limit_for(limits, "minSignalRms", mode_key)),
        ("peakAmplitude", features["peakAmplitude"], limit_for(limits, "minSignalPeak", mode_key)),
        ("peaksCount", features["peaksCount"], limit_for(limits, "minCapturePeaks", mode_key)),
        ("peakRate", features["peakRate"], limit_for(limits, "minPeakRate", mode_key)),
        ("fingerprintsCount", features["fingerprintsCount"], limit_for(limits, "minCaptureFingerprints", mode_key)),
        ("signalQuality", features["signalQuality"], limit_for(limits, "minSignalQuality", mode_key)),
        ("onsetContrast", features["onsetContrast"], limit_for(limits, "minOnsetContrast", mode_key)),
        ("rhythmicStability", features["rhythmicStability"], limit_for(limits, "minRhythmicStability", mode_key)),
    ]
    for name, value, minimum in checks:
        if value < minimum:
            return False, f"{name}={value:.3f} < {minimum:.3f}"
    return True, ""


def compare_against_references(
    input_features: dict,
    references: list[dict],
    limits: dict,
    mode_key: str,
) -> list[dict]:
    weights = MODE_PRESETS.get(mode_key, MODE_PRESETS["fast"])
    scored = []

    for reference in references:
        variants = build_reference_feature_variants(reference)
        scored.append(
            min(
                (
                    score_reference_variant(
                        input_features,
                        reference,
                        variant,
                        weights,
                        limits,
                        mode_key,
                    )
                    for variant in variants
                ),
                key=lambda item: item["distance"],
            )
        )

    scored.sort(key=lambda item: item["distance"])
    best = scored[0]["distance"] if scored else 1
    second = scored[1]["distance"] if len(scored) > 1 else best + 0.1

    matches = []
    for index, item in enumerate(scored):
        separation_boost = (
            max(0, min(8, (second - best) * 36))
            if index == 0 and item["evidenceScore"] >= limit_for(limits, "minMatchEvidence", mode_key)
            else 0
        )
        item["confidence"] = round(clamp(item["signalAdjustedSimilarity"] * 100 + separation_boost, 0, 98))
        matches.append(item)
    matches.sort(key=lambda item: (-item["confidence"], item["distance"]))
    return matches[:MATCHES_LIMIT]


def build_reference_feature_variants(reference: dict) -> list[dict]:
    variants = [
        {
            "type": "full",
            "startSeconds": 0,
            "durationSeconds": reference["features"].get("durationSeconds", 0),
            "features": reference["features"],
        }
    ]
    for segment in reference["features"].get("strongSegments", []) or []:
        if isinstance(segment, dict) and isinstance(segment.get("features"), dict):
            variants.append(
                {
                    "type": "segment",
                    "startSeconds": segment.get("startSeconds", 0),
                    "durationSeconds": segment.get("durationSeconds") or segment["features"].get("durationSeconds", 0),
                    "score": segment.get("score", 0),
                    "features": segment["features"],
                }
            )
    return variants


def score_reference_variant(
    input_features: dict,
    reference: dict,
    variant: dict,
    weights: dict,
    limits: dict,
    mode_key: str,
) -> dict:
    reference_features = variant["features"]
    reference_hop_seconds = reference_features.get("hopSeconds") or input_features["hopSeconds"]
    target_window_length = max(
        2,
        round(input_features["durationSeconds"] / reference_hop_seconds),
    )
    rhythm_match = best_subsequence_match(
        input_features["onsetSeries"],
        reference_features["onsetSeries"],
        None,
        target_window_length,
    )
    envelope_match = best_subsequence_match(
        input_features["envelopeSeries"],
        reference_features["envelopeSeries"],
        rhythm_match["offset"],
        rhythm_match["windowLength"],
    )
    fingerprint_match = compare_rhythm_fingerprints(
        input_features["fingerprints"],
        reference_features["fingerprints"],
    )

    fingerprint_distance = 1 - fingerprint_match["similarity"]
    rhythm_distance = 1 - rhythm_match["similarity"]
    envelope_distance = 1 - envelope_match["similarity"]
    interval_distance = vector_distance(input_features["intervals"], reference_features["intervals"])
    density_distance = abs(input_features["density"] - reference_features["density"])
    peaks_distance = abs(input_features["peakRate"] - reference_features["peakRate"]) / 8
    tempo_distance = (
        abs(input_features["tempoEstimate"] - reference_features["tempoEstimate"]) / 180
        if input_features["tempoEstimate"] and reference_features["tempoEstimate"]
        else 0.15
    )
    distance = (
        fingerprint_distance * weights["fingerprint"]
        + rhythm_distance * weights["rhythm"]
        + envelope_distance * weights["envelope"]
        + interval_distance * weights["interval"]
        + density_distance * weights["density"]
        + tempo_distance * weights["tempo"]
        + peaks_distance * weights["peaks"]
    )
    absolute_similarity = clamp(1 - distance / 1.1, 0, 1)
    evidence_score = estimate_match_evidence(
        input_features,
        rhythm_match,
        fingerprint_match,
        absolute_similarity,
        limits,
        mode_key,
    )
    signal_adjusted_similarity = absolute_similarity * clamp(input_features["signalQuality"], 0, 1) * evidence_score
    return {
        "reference": reference,
        "referenceFeatures": reference_features,
        "referenceVariant": {
            "type": variant["type"],
            "startSeconds": variant.get("startSeconds", 0),
            "durationSeconds": variant.get("durationSeconds", 0),
            "score": variant.get("score", 0),
        },
        "distance": distance,
        "absoluteSimilarity": absolute_similarity,
        "signalAdjustedSimilarity": signal_adjusted_similarity,
        "evidenceScore": evidence_score,
        "alignment": {
            **rhythm_match,
            "fingerprintSimilarity": fingerprint_match["similarity"],
            "fingerprintOffsetSeconds": fingerprint_match["offsetSeconds"],
            "fingerprintVotes": fingerprint_match["votes"],
        },
        "confidence": 0,
    }


def estimate_match_evidence(
    input_features: dict,
    rhythm_match: dict,
    fingerprint_match: dict,
    absolute_similarity: float,
    limits: dict,
    mode_key: str,
) -> float:
    vote_score = clamp(
        fingerprint_match["votes"]
        / max(limit_for(limits, "minFingerprintVotes", mode_key), input_features["fingerprintsCount"] * 0.28),
        0,
        1,
    )
    fingerprint_score = clamp(fingerprint_match["similarity"] / 0.35, 0, 1)
    rhythm_score = clamp(rhythm_match["similarity"] / 0.72, 0, 1)
    absolute_score = clamp(absolute_similarity / 0.62, 0, 1)
    return clamp(
        fingerprint_score * 0.28
        + vote_score * 0.24
        + rhythm_score * 0.2
        + absolute_score * 0.18
        + input_features["rhythmicStability"] * 0.1,
        0,
        1,
    )


def is_reliable_match(match: dict, limits: dict, minimum_confidence: float, mode_key: str) -> bool:
    return (
        match["confidence"] >= max(limit_for(limits, "minMatchConfidence", mode_key), minimum_confidence)
        and match["absoluteSimilarity"] >= limit_for(limits, "minMatchAbsoluteSimilarity", mode_key)
        and match["evidenceScore"] >= limit_for(limits, "minMatchEvidence", mode_key)
        and match["alignment"]["fingerprintVotes"] >= limit_for(limits, "minFingerprintVotes", mode_key)
        and (
            match["alignment"]["fingerprintSimilarity"] >= limit_for(limits, "minFingerprintSimilarity", mode_key)
            or match["alignment"]["similarity"] >= limit_for(limits, "minRhythmSimilarity", mode_key)
        )
    )


def get_match_ambiguity(
    matches: list[dict],
    limits: dict,
    minimum_confidence: float,
    mode_key: str,
) -> dict | None:
    if len(matches) < 2:
        return None

    best = matches[0]
    minimum_plausible_confidence = max(
        limit_for(limits, "minMatchConfidence", mode_key) - 8,
        minimum_confidence - 8,
    )
    for candidate in matches[1:]:
        margin = best["confidence"] - candidate["confidence"]
        candidate_is_plausible = (
            candidate["confidence"] >= minimum_plausible_confidence
            and candidate["evidenceScore"] >= limit_for(limits, "minMatchEvidence", mode_key)
            and candidate["alignment"]["fingerprintVotes"]
            >= max(2, limit_for(limits, "minFingerprintVotes", mode_key) - 2)
        )
        if margin <= limit_for(limits, "minTopMatchMargin", mode_key) and candidate_is_plausible:
            return candidate
    return None


def compare_rhythm_fingerprints(query_fingerprints: list[dict], target_fingerprints: list[dict]) -> dict:
    if not query_fingerprints or not target_fingerprints:
        return {"similarity": 0, "offsetSeconds": 0, "votes": 0}

    target_by_hash = {}
    for fingerprint in target_fingerprints:
        target_by_hash.setdefault(fingerprint["hash"], []).append(float(fingerprint["time"]))

    offset_votes = {}
    shared_hashes = 0
    votes = 0
    for fingerprint in query_fingerprints:
        target_times = target_by_hash.get(fingerprint["hash"])
        if not target_times:
            continue
        shared_hashes += 1
        for target_time in target_times:
            offset_key = round((target_time - float(fingerprint["time"])) / FINGERPRINT_OFFSET_STEP)
            offset_votes[offset_key] = offset_votes.get(offset_key, 0) + 1
            votes += 1

    if not offset_votes:
        return {"similarity": 0, "offsetSeconds": 0, "votes": 0}

    best_offset_key, best_votes = max(offset_votes.items(), key=lambda item: item[1])
    coverage = shared_hashes / max(1, len(query_fingerprints))
    coherence = best_votes / max(1, votes)
    vote_strength = clamp(best_votes / max(3, len(query_fingerprints) * 0.55), 0, 1)
    return {
        "similarity": clamp(coverage * 0.45 + coherence * 0.25 + vote_strength * 0.3, 0, 1),
        "offsetSeconds": best_offset_key * FINGERPRINT_OFFSET_STEP,
        "votes": best_votes,
    }


def best_subsequence_match(
    query: list[float],
    target: list[float],
    preferred_offset: int | None = None,
    target_window_length: int | None = None,
) -> dict:
    if not query or not target:
        return {"similarity": 0, "offset": 0, "windowLength": 0}

    window_length = max(2, min(len(target), round(target_window_length or len(query))))
    comparable_query = resample_vector(query, window_length)

    if len(target) <= window_length:
        return {
            "similarity": normalized_correlation(resample_vector(query, max(len(target), 2)), target),
            "offset": 0,
            "windowLength": len(target),
        }

    if preferred_offset is not None:
        offset = max(0, min(len(target) - window_length, round(preferred_offset)))
        return {
            "similarity": normalized_correlation(comparable_query, target[offset : offset + window_length]),
            "offset": offset,
            "windowLength": window_length,
        }

    stride = max(1, window_length // SUBSEQUENCE_STRIDE_DIVISOR)
    best = {"similarity": -1, "offset": 0}
    for offset in range(0, len(target) - window_length + 1, stride):
        similarity = normalized_correlation(comparable_query, target[offset : offset + window_length])
        if similarity > best["similarity"]:
            best = {"similarity": similarity, "offset": offset}

    refined_start = max(0, best["offset"] - stride + 1)
    refined_end = min(len(target) - window_length, best["offset"] + stride - 1)
    for offset in range(refined_start, refined_end + 1):
        similarity = normalized_correlation(comparable_query, target[offset : offset + window_length])
        if similarity > best["similarity"]:
            best = {"similarity": similarity, "offset": offset}

    return {
        "similarity": clamp(best["similarity"], 0, 1),
        "offset": best["offset"],
        "windowLength": window_length,
    }


def normalized_correlation(left: list[float], right: list[float]) -> float:
    size = min(len(left), len(right))
    if not size:
        return 0

    left = left[:size]
    right = right[:size]
    left_mean = sum(left) / size
    right_mean = sum(right) / size
    numerator = 0.0
    left_energy = 0.0
    right_energy = 0.0
    for left_value, right_value in zip(left, right):
        left_centered = left_value - left_mean
        right_centered = right_value - right_mean
        numerator += left_centered * right_centered
        left_energy += left_centered * left_centered
        right_energy += right_centered * right_centered

    denominator = (left_energy * right_energy) ** 0.5
    if not denominator:
        return 0
    return (numerator / denominator + 1) / 2


def vector_distance(left: list[float], right: list[float]) -> float:
    size = max(len(left), len(right))
    total = 0.0
    for index in range(size):
        a = left[index] if index < len(left) else (left[-1] if left else 0)
        b = right[index] if index < len(right) else (right[-1] if right else 0)
        total += (a - b) ** 2
    return (total / size) ** 0.5 if size else 0


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


def build_interval_profile(peak_indexes: list[int], hop_seconds: float) -> list[float]:
    bins = 16
    histogram = [0.0] * bins
    min_interval = 0.08
    max_interval = 2.0
    import math

    log_min = math.log(min_interval)
    log_range = math.log(max_interval) - log_min
    for index in range(1, len(peak_indexes)):
        interval_seconds = (peak_indexes[index] - peak_indexes[index - 1]) * hop_seconds
        if interval_seconds < min_interval or interval_seconds > max_interval:
            continue
        position = (math.log(interval_seconds) - log_min) / log_range
        bin_index = max(0, min(bins - 1, int(position * bins)))
        histogram[bin_index] += 1
    return normalize_array(histogram)


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


def measure_onset_profile(onset: list[float], peak_indexes: list[int]) -> dict:
    if not onset:
        return {"contrast": 0.0, "peakMean": 0.0}

    sorted_values = sorted(onset)
    median = sorted_values[int(len(sorted_values) * 0.5)] if sorted_values else 0.0
    p90 = sorted_values[int(len(sorted_values) * 0.9)] if sorted_values else 0.0
    peak_values = [onset[index] for index in peak_indexes if 0 <= index < len(onset)]
    peak_mean = sum(peak_values) / len(peak_values) if peak_values else 0.0
    return {
        "contrast": clamp(max(p90, peak_mean) - median, 0, 1),
        "peakMean": peak_mean,
    }


def estimate_rhythmic_stability(peak_times: list[float]) -> float:
    if len(peak_times) < 4:
        return 0

    intervals = [
        peak_times[index] - peak_times[index - 1]
        for index in range(1, len(peak_times))
        if 0.06 < peak_times[index] - peak_times[index - 1] < 2.4
    ]
    if len(intervals) < 3:
        return 0

    intervals.sort()
    median = intervals[len(intervals) // 2]
    if not median:
        return 0
    deviations = sorted(abs(interval - median) for interval in intervals)
    median_deviation = deviations[len(deviations) // 2] if deviations else 0
    return clamp(1 - median_deviation / max(0.08, median * 0.9), 0, 1)


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
    return (
        rms_score * 0.22
        + peak_score * 0.18
        + rhythm_score * 0.18
        + rate_score * 0.12
        + contrast_score * 0.18
        + rhythmic_stability * 0.12
    )


def estimate_tempo(peak_times: list[float]) -> float:
    if len(peak_times) < 2:
        return 0.0
    intervals = sorted(
        peak_times[index] - peak_times[index - 1]
        for index in range(1, len(peak_times))
        if peak_times[index] > peak_times[index - 1]
    )
    if not intervals:
        return 0.0
    median = intervals[len(intervals) // 2]
    return max(0.0, min(260.0, 60 / median if median else 0.0))


def normalize_array(values: list[float]) -> list[float]:
    maximum = max(values, default=0)
    if not maximum:
        return [0.0 for _ in values]
    return [value / maximum for value in values]


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


if __name__ == "__main__":
    main()
