from __future__ import annotations

import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent.parent / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

from admin_config import is_admin_configured, verify_admin_password, write_admin_password  # noqa: E402


def test_admin_password_roundtrip():
    with tempfile.TemporaryDirectory() as temp_dir:
        project_root = Path(temp_dir)
        assert not is_admin_configured(project_root)

        write_admin_password(project_root, "contrasegura123")

        assert is_admin_configured(project_root)
        assert verify_admin_password(project_root, "contrasegura123")
        assert not verify_admin_password(project_root, "incorrecta")
