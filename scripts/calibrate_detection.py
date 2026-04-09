#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from library_manifest import write_library_files  # noqa: E402


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
}

METRIC_KEYS = [
    "durationSeconds",
    "rms",
    "peakAmplitude",
    "peakRate",
    "peaksCount",
    "fingerprintsCount",
    "onsetContrast",
    "rhythmicStability",
    "signalQuality",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analiza la biblioteca de toques y genera umbrales de deteccion."
    )
    parser.add_argument(
        "--project-root",
        type=Path,
        default=PROJECT_ROOT,
        help="Raiz del proyecto CofraBeat.",
    )
    parser.add_argument(
        "--skip-regenerate",
        action="store_true",
        help="Usa features.json tal como esta, sin regenerarlo antes.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()

    payload, calibration_path, report_path = write_calibration_files(
        project_root,
        regenerate_library=not args.skip_regenerate,
    )

    print(f"Calibracion generada en {calibration_path}")
    print(f"Informe generado en {report_path}")
    print(f"Referencias analizadas: {payload['references']}")


def write_calibration_files(
    project_root: Path,
    regenerate_library: bool = True,
) -> tuple[dict, Path, Path]:
    if regenerate_library:
        write_library_files(project_root)

    features_path = project_root / "assets" / "pasos" / "features.json"
    calibration_path = project_root / "assets" / "pasos" / "calibration.json"
    report_path = project_root / "docs" / "CALIBRATION.md"
    references = load_feature_references(features_path)
    metrics = [extract_metrics(reference) for reference in references]
    metrics = [metric for metric in metrics if metric]

    if not metrics:
        raise SystemExit("No hay features validas para calibrar. Revisa ffmpeg y los mp3.")

    statistics = build_statistics(metrics)
    recommended_limits = build_recommended_limits(statistics)
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "scripts/calibrate_detection.py",
        "references": len(metrics),
        "recommendedLimits": recommended_limits,
        "statistics": statistics,
        "referenceMetrics": metrics,
    }

    calibration_path.parent.mkdir(parents=True, exist_ok=True)
    previous_payload = read_existing_calibration(calibration_path)
    if previous_payload and same_calibration(previous_payload, payload):
        if not report_path.exists():
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(render_report(previous_payload), encoding="utf-8")
        return previous_payload, calibration_path, report_path

    calibration_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(render_report(payload), encoding="utf-8")
    return payload, calibration_path, report_path


def read_existing_calibration(calibration_path: Path) -> dict | None:
    if not calibration_path.exists():
        return None

    try:
        payload = json.loads(calibration_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return None
    return payload if isinstance(payload, dict) else None


def same_calibration(previous: dict, current: dict) -> bool:
    stable_keys = [
        "source",
        "references",
        "recommendedLimits",
        "statistics",
        "referenceMetrics",
    ]
    return all(previous.get(key) == current.get(key) for key in stable_keys)


def load_feature_references(features_path: Path) -> list[dict]:
    if not features_path.exists():
        raise SystemExit(f"No existe {features_path}")

    try:
        payload = json.loads(features_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"features.json no es JSON valido: {error}") from error

    references = payload.get("references", [])
    if not isinstance(references, list):
        raise SystemExit("features.json no contiene una lista references valida")
    return [reference for reference in references if isinstance(reference, dict)]


def extract_metrics(reference: dict) -> dict | None:
    features = reference.get("features")
    if not isinstance(features, dict):
        return None

    peak_times = features.get("peakTimes") if isinstance(features.get("peakTimes"), list) else []
    fingerprints = features.get("fingerprints") if isinstance(features.get("fingerprints"), list) else []
    metrics = {
        "file": reference.get("file") or "",
        "name": reference.get("name") or reference.get("file") or "",
        "tag": reference.get("tag") or "Sin etiqueta",
        "durationSeconds": number(features.get("durationSeconds") or reference.get("duration")),
        "rms": number(features.get("rms")),
        "peakAmplitude": number(features.get("peakAmplitude")),
        "peakRate": number(features.get("peakRate")),
        "peaksCount": int_number(features.get("peaksCount")),
        "fingerprintsCount": int_number(features.get("fingerprintsCount"), len(fingerprints)),
        "onsetContrast": number(features.get("onsetContrast")),
        "rhythmicStability": number(features.get("rhythmicStability")),
        "signalQuality": number(features.get("signalQuality")),
        "tempoEstimate": number(features.get("tempoEstimate")),
        "peakTimesCount": len(peak_times),
    }

    if metrics["durationSeconds"] <= 0 or metrics["peaksCount"] <= 0:
        return None
    return metrics


def build_statistics(metrics: list[dict]) -> dict:
    stats = {}
    for key in METRIC_KEYS:
        values = [number(metric.get(key)) for metric in metrics]
        values = [value for value in values if value >= 0]
        stats[key] = {
            "min": rounded(min(values)),
            "p10": rounded(percentile(values, 10)),
            "p25": rounded(percentile(values, 25)),
            "median": rounded(percentile(values, 50)),
            "p75": rounded(percentile(values, 75)),
            "p90": rounded(percentile(values, 90)),
            "max": rounded(max(values)),
            "mean": rounded(mean(values)),
        }
    return stats


def build_recommended_limits(statistics: dict) -> dict:
    p10 = lambda key: statistics[key]["p10"]

    limits = dict(DEFAULT_LIMITS)
    limits.update(
        {
            "minSignalRms": rounded(clamp(p10("rms") * 0.4, 0.008, 0.035), 6),
            "minSignalPeak": rounded(clamp(p10("peakAmplitude") * 0.3, 0.03, 0.12), 6),
            "minPeakRate": rounded(clamp(p10("peakRate") * 0.45, 0.35, 1.5), 6),
            "minCapturePeaks": int(clamp(round(p10("peaksCount") * 0.25), 3, 12)),
            "minSignalQuality": rounded(clamp(p10("signalQuality") * 0.55, 0.18, 0.55), 6),
            "minOnsetContrast": rounded(clamp(p10("onsetContrast") * 0.45, 0.08, 0.35), 6),
            "minCaptureFingerprints": int(
                clamp(round(p10("fingerprintsCount") * 0.08), 2, 30)
            ),
            "minRhythmicStability": rounded(
                clamp(p10("rhythmicStability") * 0.45, 0.1, 0.45), 6
            ),
            "minFingerprintVotes": int(
                clamp(round(p10("fingerprintsCount") * 0.015), 2, 12)
            ),
        }
    )
    return limits


def percentile(values: list[float], percent: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]

    position = (len(ordered) - 1) * (percent / 100)
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    mix = position - lower
    return ordered[lower] * (1 - mix) + ordered[upper] * mix


def render_report(payload: dict) -> str:
    limits = payload["recommendedLimits"]
    statistics = payload["statistics"]
    metrics = payload["referenceMetrics"]
    rows = "\n".join(
        f"| {metric['name']} | {metric['tag']} | {metric['durationSeconds']:.1f} | "
        f"{metric['peaksCount']} | {metric['peakRate']:.2f} | "
        f"{metric['fingerprintsCount']} | {metric['signalQuality']:.3f} |"
        for metric in metrics
    )
    limit_rows = "\n".join(
        f"| `{key}` | `{value}` |" for key, value in sorted(limits.items())
    )
    stat_rows = "\n".join(
        f"| `{key}` | {value['p10']} | {value['median']} | {value['p90']} |"
        for key, value in statistics.items()
    )

    return f"""# Calibracion De Deteccion

Generado por `scripts/calibrate_detection.py`.

## Resumen

- Referencias analizadas: {payload["references"]}
- Archivo de salida: `assets/pasos/calibration.json`
- La app carga este archivo automaticamente al arrancar por HTTP/HTTPS.

## Umbrales Recomendados

| Variable | Valor |
| --- | --- |
{limit_rows}

## Estadisticas Base

| Metrica | p10 | mediana | p90 |
| --- | ---: | ---: | ---: |
{stat_rows}

## Referencias Analizadas

| Toque | Etiqueta | Duracion s | Golpes | Golpes/s | Fingerprints | Calidad |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
{rows}

## Uso

Ejecuta:

```bash
python3 scripts/calibrate_detection.py
```

Despues reinicia o recarga la app. Si el archivo `assets/pasos/calibration.json`
existe, CofraBeat usara esas variables en lugar de los valores por defecto.
"""


def number(value: object, fallback: float = 0.0) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return fallback
    return result if result >= 0 else fallback


def int_number(value: object, fallback: int = 0) -> int:
    try:
        result = int(value)
    except (TypeError, ValueError):
        return fallback
    return result if result >= 0 else fallback


def rounded(value: float, digits: int = 6) -> float:
    return round(float(value), digits)


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


if __name__ == "__main__":
    main()
