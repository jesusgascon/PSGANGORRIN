#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from analyze_capture import analyze_best_candidate  # noqa: E402
from library_manifest import decode_audio  # noqa: E402
from validate_detection import (  # noqa: E402
    get_match_ambiguity,
    is_reliable_match,
    is_usable_capture,
    load_limits,
    load_references,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Analiza en bloque el dataset real de capturas de campo."
    )
    parser.add_argument("--project-root", type=Path, default=PROJECT_ROOT)
    parser.add_argument("--mode", choices=("balanced", "fast", "field", "strict"), default="field")
    parser.add_argument("--minimum-confidence", type=float, default=45)
    parser.add_argument("--top", type=int, default=3)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()
    dataset_root = project_root / "data" / "field-dataset"
    manifest_path = dataset_root / "manifest.json"
    if not manifest_path.exists():
        raise SystemExit(f"No existe el manifest del dataset: {manifest_path}")

    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    captures = payload.get("captures", [])
    if not captures:
        raise SystemExit("No hay capturas registradas en el dataset.")

    references = load_references(project_root)
    limits = load_limits(project_root)

    summary = {
        "confirmed": 0,
        "unconfirmed": 0,
        "ambiguous": 0,
        "wrong": 0,
        "unusable": 0,
        "missing": 0,
    }

    print(f"Capturas registradas: {len(captures)}")
    print("")

    for entry in captures:
        capture_path = dataset_root / entry["relativePath"]
        print(f"=== {capture_path} ===")
        print(f"Esperado: {entry.get('expectedName')} ({entry.get('expectedFile')})")
        print(f"Origen: {entry.get('sourceType')} · Dispositivo: {entry.get('device') or '-'}")
        if entry.get("notes"):
          print(f"Notas: {entry['notes']}")
        if not capture_path.exists():
            summary["missing"] += 1
            print("No existe el archivo registrado.")
            print("")
            continue

        samples = decode_audio(capture_path)
        candidate = analyze_best_candidate(samples, references, limits, args)
        features = candidate["features"]
        usable, reason = is_usable_capture(features, limits, args.mode)
        matches = candidate["matches"] if usable else []
        best = matches[0] if matches else None
        expected_file = entry.get("expectedFile")
        expected_match = next(
            (match for match in matches if match["reference"].get("file") == expected_file),
            None,
        )
        ambiguity = get_match_ambiguity(matches, limits, args.minimum_confidence, args.mode) if matches else None
        reliable = bool(best and is_reliable_match(best, limits, args.minimum_confidence, args.mode) and not ambiguity)

        print(f"Tempo: {features['tempoEstimate']:.1f} bpm")
        print(f"RMS: {features['rms']:.4f} · Calidad: {features['signalQuality']:.3f}")

        if not usable:
            summary["unusable"] += 1
            print(f"Estado: NO USABLE ({reason})")
            print("")
            continue

        if reliable and best and best["reference"].get("file") == expected_file:
            summary["confirmed"] += 1
            print(f"Estado: OK CONFIRMADO · {best['reference'].get('name')} ({best['confidence']}%)")
        elif ambiguity:
            summary["ambiguous"] += 1
            if best and best["reference"].get("file") == expected_file:
                print(
                    "Estado: AMBIGUO · correcto primero, pero sin confirmar · "
                    f"{best['reference'].get('name')} / {ambiguity['reference'].get('name')}"
                )
            elif ambiguity["reference"].get("file") == expected_file:
                print(
                    "Estado: AMBIGUO · correcto entre candidatos · "
                    f"{best['reference'].get('name')} / {ambiguity['reference'].get('name')}"
                )
            else:
                print(
                    "Estado: AMBIGUO · "
                    f"{best['reference'].get('name')} / {ambiguity['reference'].get('name')}"
                )
        elif best and best["reference"].get("file") == expected_file:
            summary["unconfirmed"] += 1
            print(f"Estado: OK NO CONFIRMADO · {best['reference'].get('name')} ({best['confidence']}%)")
        else:
            summary["wrong"] += 1
            if best:
                if expected_match:
                    print(
                        f"Estado: FALLO REAL · {best['reference'].get('name')} ({best['confidence']}%) "
                        f"· esperado en ranking: {expected_match['reference'].get('name')} "
                        f"({expected_match['confidence']}%)"
                    )
                else:
                    print(f"Estado: FALLO REAL · {best['reference'].get('name')} ({best['confidence']}%)")
            else:
                print("Estado: FALLO REAL · sin coincidencias comparables")

        if matches:
            print("Ranking:")
            for index, match in enumerate(matches[: max(1, args.top)], 1):
                diagnostics = match.get("diagnostics", {})
                print(
                    f"  {index}. {match['reference'].get('name')} - {match['confidence']}% "
                    f"- patron {diagnostics.get('patternScore', 0):.3f} "
                    f"- timbre {diagnostics.get('timbreScore', 0):.3f} "
                    f"- perfil {'lento' if diagnostics.get('slowPatternProfile') else 'normal'}"
                )
        print("")

    print("Resumen:")
    print(f"  OK confirmadas: {summary['confirmed']}")
    print(f"  OK no confirmadas: {summary['unconfirmed']}")
    print(f"  Ambiguas: {summary['ambiguous']}")
    print(f"  Fallos reales: {summary['wrong']}")
    print(f"  No usables: {summary['unusable']}")
    print(f"  Faltan archivos: {summary['missing']}")


if __name__ == "__main__":
    main()
