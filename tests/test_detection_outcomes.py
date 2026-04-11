import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from validate_detection import classify_outcome, get_match_ambiguity  # noqa: E402


LIMITS = {
    "minTopMatchMargin": 10,
    "minMatchConfidence": 40,
    "minMatchEvidence": 0.58,
    "minFingerprintVotes": 6,
}


def build_match(name: str, confidence: int, *, evidence: float, votes: int, diagnostics: dict, file_name: str | None = None):
    return {
        "reference": {"name": name, "file": file_name or f"{name}.mp3"},
        "confidence": confidence,
        "absoluteSimilarity": 0.8,
        "evidenceScore": evidence,
        "alignment": {"fingerprintVotes": votes},
        "diagnostics": diagnostics,
    }


def test_classify_outcome_marks_probable_field_match():
    best = build_match(
        "Prendimiento Zaragoza",
        73,
        evidence=0.90,
        votes=2,
        file_name="Prendimiento - Zaragoza.mp3",
        diagnostics={
            "patternScore": 0.82,
            "timbreScore": 0.68,
            "envelopeSimilarity": 0.79,
            "segmentConsistency": 0.75,
            "landmarkSimilarity": 0.31,
        },
    )

    outcome = classify_outcome(
        best,
        [best],
        None,
        False,
        "Prendimiento - Zaragoza.mp3",
        True,
        45,
        "field",
    )

    assert outcome == "probable"


def test_field_ambiguity_relaxes_for_strong_leader_but_keeps_plausible_second():
    best = build_match(
        "Prendimiento Zaragoza",
        80,
        evidence=0.92,
        votes=5,
        file_name="Prendimiento - Zaragoza.mp3",
        diagnostics={
            "patternScore": 0.85,
            "timbreScore": 0.68,
            "envelopeSimilarity": 0.84,
            "segmentConsistency": 0.80,
            "landmarkSimilarity": 0.35,
            "rhythmSimilarity": 0.93,
            "intervalSimilarity": 0.70,
            "slowPatternProfile": False,
        },
    )
    second = build_match(
        "Prendimiento Cuatrera",
        74,
        evidence=0.70,
        votes=4,
        file_name="Prendimiento - Cuatrera.mp3",
        diagnostics={
            "patternScore": 0.81,
            "timbreScore": 0.71,
            "envelopeSimilarity": 0.74,
            "segmentConsistency": 0.78,
            "landmarkSimilarity": 0.30,
            "rhythmSimilarity": 0.76,
            "intervalSimilarity": 0.61,
            "slowPatternProfile": False,
        },
    )

    ambiguity = get_match_ambiguity([best, second], LIMITS, 45, "field")

    assert ambiguity is second
