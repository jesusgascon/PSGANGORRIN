import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

from calibrate_detection import build_recommended_limits, build_statistics, percentile  # noqa: E402


def test_percentile_interpolates_values():
    assert percentile([10, 20, 30], 50) == 20
    assert percentile([10, 20], 25) == 12.5


def test_calibration_recommends_safe_minimums():
    metrics = [
        {
            "durationSeconds": 8,
            "rms": 0.04,
            "peakAmplitude": 0.28,
            "peakRate": 2.2,
            "peaksCount": 18,
            "fingerprintsCount": 80,
            "onsetContrast": 0.35,
            "rhythmicStability": 0.5,
            "signalQuality": 0.62,
        },
        {
            "durationSeconds": 9,
            "rms": 0.03,
            "peakAmplitude": 0.2,
            "peakRate": 1.7,
            "peaksCount": 13,
            "fingerprintsCount": 45,
            "onsetContrast": 0.26,
            "rhythmicStability": 0.42,
            "signalQuality": 0.51,
        },
    ]

    limits = build_recommended_limits(build_statistics(metrics))

    assert limits["minSignalRms"] >= 0.008
    assert limits["minSignalPeak"] >= 0.03
    assert limits["minCapturePeaks"] >= 3
    assert limits["minCaptureFingerprints"] >= 2
    assert limits["minMatchEvidence"] == 0.42
