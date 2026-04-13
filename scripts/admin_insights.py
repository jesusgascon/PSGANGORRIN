#!/usr/bin/env python3

from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from analyze_capture import analyze_best_candidate
from library_manifest import decode_audio
from validate_detection import (
    get_match_ambiguity,
    is_probable_field_match,
    is_reliable_match,
    is_usable_capture,
    load_limits,
    load_references,
)


def build_conflict_summary(
    project_root: Path,
    mode: str = "field",
    minimum_confidence: float = 45,
    limit: int = 8,
) -> dict:
    dataset_root = project_root / "data" / "field-dataset"
    manifest_path = dataset_root / "manifest.json"
    if not manifest_path.exists():
        return {"items": [], "capturesReviewed": 0, "capturesWithConflicts": 0}

    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    captures = payload.get("captures", [])
    if not captures:
        return {"items": [], "capturesReviewed": 0, "capturesWithConflicts": 0}

    references = load_references(project_root)
    limits = load_limits(project_root)
    buckets: dict[str, dict] = {}
    captures_reviewed = 0

    for entry in captures:
        capture_path = dataset_root / entry["relativePath"]
        if not capture_path.exists():
            continue

        samples = decode_audio(capture_path)
        candidate = analyze_best_candidate(
            samples,
            references,
            limits,
            _InsightArgs(mode=mode, minimum_confidence=minimum_confidence),
        )
        features = candidate["features"]
        usable, _reason = is_usable_capture(features, limits, mode)
        if not usable:
            continue

        captures_reviewed += 1
        matches = candidate["matches"]
        best = matches[0] if matches else None
        if not best:
            continue

        expected_file = entry.get("expectedFile")
        expected_name = entry.get("expectedName") or expected_file or "Desconocido"
        expected_match = next(
            (match for match in matches if match["reference"].get("file") == expected_file),
            None,
        )
        ambiguity = get_match_ambiguity(matches, limits, minimum_confidence, mode) if matches else None
        probable = bool(best and is_probable_field_match(best, minimum_confidence, mode))
        reliable = bool(best and is_reliable_match(best, limits, minimum_confidence, mode) and not ambiguity)

        rival_name = None
        outcome = None
        if reliable and best["reference"].get("file") == expected_file:
            continue
        if ambiguity:
            if best["reference"].get("file") == expected_file:
                rival_name = ambiguity["reference"].get("name")
                outcome = "probable_ambiguous" if probable else "ambiguous"
            elif ambiguity["reference"].get("file") == expected_file:
                rival_name = best["reference"].get("name")
                outcome = "ambiguous"
            elif expected_match:
                rival_name = best["reference"].get("name")
                outcome = "wrong"
        elif best["reference"].get("file") != expected_file:
            rival_name = best["reference"].get("name")
            outcome = "wrong"

        if not rival_name or not outcome:
            continue

        bucket = buckets.setdefault(
            expected_file or expected_name,
            {
                "expectedFile": expected_file,
                "expectedName": expected_name,
                "totalConflicts": 0,
                "counts": defaultdict(int),
                "rivals": defaultdict(int),
            },
        )
        bucket["totalConflicts"] += 1
        bucket["counts"][outcome] += 1
        bucket["rivals"][rival_name] += 1

    items = []
    for bucket in buckets.values():
        rivals = sorted(bucket["rivals"].items(), key=lambda item: (-item[1], item[0]))
        items.append(
            {
                "expectedFile": bucket["expectedFile"],
                "expectedName": bucket["expectedName"],
                "totalConflicts": bucket["totalConflicts"],
                "wrong": bucket["counts"]["wrong"],
                "ambiguous": bucket["counts"]["ambiguous"],
                "probableAmbiguous": bucket["counts"]["probable_ambiguous"],
                "topRivals": [{"name": name, "count": count} for name, count in rivals[:3]],
            }
        )

    items.sort(key=lambda item: (-item["totalConflicts"], -item["wrong"], item["expectedName"]))
    return {
        "items": items[: max(1, limit)],
        "capturesReviewed": captures_reviewed,
        "capturesWithConflicts": sum(item["totalConflicts"] for item in items),
    }


class _InsightArgs:
    def __init__(self, mode: str, minimum_confidence: float):
        self.mode = mode
        self.minimum_confidence = minimum_confidence
        self.top = 4
