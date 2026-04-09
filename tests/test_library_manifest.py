import json
import shutil
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from library_manifest import build_manifest, prettify_name, sanitize_metadata, write_features  # noqa: E402


def test_prettify_name_from_filename():
    assert prettify_name("toque_lento-procesion.mp3") == "Toque Lento Procesion"


def test_manifest_lists_audio_files():
    manifest = build_manifest(PROJECT_ROOT)
    references = manifest["references"]

    assert "tags" in manifest
    assert len(references) >= 5
    assert all(reference["file"].lower().endswith(".mp3") for reference in references)
    assert all(reference["size"] > 0 for reference in references)
    assert all("tag" in reference for reference in references)


def test_metadata_sanitizer_accepts_reference_map():
    metadata = sanitize_metadata(
        {
            "tags": ["Entrada", "Entrada"],
            "references": {
                "../toque.mp3": {
                    "name": "Toque Principal",
                    "tag": "Entrada",
                    "notes": "Grabación limpia",
                    "updatedAt": 123,
                }
            },
        }
    )

    assert "Entrada" in metadata["tags"]
    assert "toque.mp3" in metadata["references"]
    assert metadata["references"]["toque.mp3"]["name"] == "Toque Principal"


def test_metadata_sanitizer_allows_removing_default_custom_tags():
    metadata = sanitize_metadata({"tags": ["Sin etiqueta", "Procesion"], "references": {}})

    assert metadata["tags"] == ["Sin etiqueta", "Procesion"]
    assert "Llamada" not in metadata["tags"]


def test_features_file_is_generated_when_ffmpeg_exists():
    if not shutil.which("ffmpeg"):
        return

    features_path = write_features(PROJECT_ROOT)
    assert features_path is not None
    payload = json.loads(features_path.read_text(encoding="utf-8"))
    references = payload["references"]

    assert len(references) >= 5
    assert any(reference.get("features") for reference in references)
    ready = [reference for reference in references if reference.get("features")]
    assert all(reference["features"]["peaksCount"] >= 0 for reference in ready)
    assert all("fingerprints" in reference["features"] for reference in ready)
