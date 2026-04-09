from test_library_manifest import (
    test_features_file_is_generated_when_ffmpeg_exists,
    test_manifest_lists_audio_files,
    test_metadata_sanitizer_accepts_reference_map,
    test_metadata_sanitizer_allows_removing_default_custom_tags,
    test_prettify_name_from_filename,
)


def main() -> None:
    tests = [
        test_prettify_name_from_filename,
        test_manifest_lists_audio_files,
        test_metadata_sanitizer_accepts_reference_map,
        test_metadata_sanitizer_allows_removing_default_custom_tags,
        test_features_file_is_generated_when_ffmpeg_exists,
    ]

    for test in tests:
        test()
        print(f"ok {test.__name__}")


if __name__ == "__main__":
    main()
