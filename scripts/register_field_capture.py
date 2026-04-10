#!/usr/bin/env python3

from __future__ import annotations

import argparse
import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
import sys
import uuid

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from validate_detection import load_references  # noqa: E402


DATASET_DIRNAME = "field-dataset"
DATASET_CAPTURE_DIRNAME = "captures"
DATASET_MANIFEST = "manifest.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Registra una captura real dentro del dataset de campo de CofraBeat."
    )
    parser.add_argument("file", type=Path, help="Archivo WAV/MP3/M4A/OGG que quieres guardar en el dataset.")
    parser.add_argument(
        "--expected-file",
        required=True,
        help='Nombre exacto del MP3 de referencia esperado, por ejemplo "Prendimiento - Formacion.mp3".',
    )
    parser.add_argument(
        "--source",
        choices=("mic", "monitor", "mobile"),
        default="mic",
        help="Origen de la captura.",
    )
    parser.add_argument("--device", default="", help="Texto libre para indicar movil, webcam o equipo usado.")
    parser.add_argument("--notes", default="", help="Notas libres sobre distancia, volumen o sala.")
    parser.add_argument("--project-root", type=Path, default=PROJECT_ROOT)
    parser.add_argument(
        "--copy-only",
        action="store_true",
        help="Copia el archivo al dataset y actualiza manifest, sin ejecutar ningun analisis adicional.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    project_root = args.project_root.resolve()
    source_file = args.file.resolve()
    if not source_file.exists():
        raise SystemExit(f"No existe el archivo: {source_file}")

    references = load_references(project_root)
    reference = next((item for item in references if item.get("file") == args.expected_file), None)
    if not reference:
        raise SystemExit(
            "No existe esa referencia en assets/pasos/features.json: "
            f"{args.expected_file}"
        )

    dataset_root = project_root / "data" / DATASET_DIRNAME
    capture_root = dataset_root / DATASET_CAPTURE_DIRNAME
    capture_root.mkdir(parents=True, exist_ok=True)
    manifest_path = dataset_root / DATASET_MANIFEST

    now = datetime.now(timezone.utc)
    stamp = now.strftime("%Y%m%dT%H%M%S")
    microseconds = f"{now.microsecond:06d}"
    ext = source_file.suffix.lower() or ".wav"
    safe_expected = slugify(Path(args.expected_file).stem)
    safe_device = slugify(args.device) if args.device else args.source
    target_name = f"{stamp}{microseconds}Z__{safe_expected}__{args.source}__{safe_device}__{uuid.uuid4().hex[:8]}{ext}"
    target_path = capture_root / target_name
    shutil.copy2(source_file, target_path)

    manifest = load_dataset_manifest(manifest_path)
    entry = {
        "id": str(uuid.uuid4()),
        "addedAt": now.isoformat(),
        "expectedFile": reference.get("file"),
        "expectedName": reference.get("name"),
        "sourceType": args.source,
        "device": args.device.strip(),
        "notes": args.notes.strip(),
        "relativePath": str(target_path.relative_to(dataset_root)),
        "originalFilename": source_file.name,
        "size": target_path.stat().st_size,
    }
    manifest["captures"].append(entry)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print("Captura registrada.")
    print(f"Esperado: {entry['expectedName']}")
    print(f"Guardada en: {target_path}")
    print(f"Manifest: {manifest_path}")


def load_dataset_manifest(manifest_path: Path) -> dict:
    if not manifest_path.exists():
        return {"captures": []}
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    captures = payload.get("captures", [])
    if not isinstance(captures, list):
        captures = []
    return {"captures": captures}


def slugify(value: str) -> str:
    text = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    while "--" in text:
        text = text.replace("--", "-")
    return text.strip("-") or "capture"


if __name__ == "__main__":
    main()
