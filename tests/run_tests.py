from test_library_manifest import (
    test_features_file_is_generated_when_ffmpeg_exists,
    test_manifest_lists_audio_files,
    test_metadata_sanitizer_accepts_reference_map,
    test_metadata_sanitizer_allows_removing_default_custom_tags,
    test_prettify_name_from_filename,
)
from test_detection_calibration import (
    test_calibration_recommends_safe_minimums,
    test_percentile_interpolates_values,
)
from test_detection_outcomes import (
    test_classify_outcome_marks_probable_field_match,
    test_field_ambiguity_relaxes_for_strong_leader_but_keeps_plausible_second,
)


def main() -> None:
    tests = [
        test_prettify_name_from_filename,
        test_manifest_lists_audio_files,
        test_metadata_sanitizer_accepts_reference_map,
        test_metadata_sanitizer_allows_removing_default_custom_tags,
        test_features_file_is_generated_when_ffmpeg_exists,
        test_percentile_interpolates_values,
        test_calibration_recommends_safe_minimums,
        test_classify_outcome_marks_probable_field_match,
        test_field_ambiguity_relaxes_for_strong_leader_but_keeps_plausible_second,
    ]

    for test in tests:
        test()
        print(f"ok {test.__name__}")


if __name__ == "__main__":
    main()
