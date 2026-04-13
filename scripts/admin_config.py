#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from pathlib import Path


DEFAULT_ITERATIONS = 240_000
ADMIN_CONFIG_PATH = Path("data") / "admin-config.json"


def get_admin_password_env() -> str | None:
    value = os.environ.get("COFRABEAT_ADMIN_PASSWORD", "").strip()
    return value or None


def get_admin_config_path(project_root: Path) -> Path:
    return project_root / ADMIN_CONFIG_PATH


def read_admin_config(project_root: Path) -> dict:
    config_path = get_admin_config_path(project_root)
    if not config_path.exists():
        return {"configured": False}

    try:
        payload = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"configured": False}

    if not isinstance(payload, dict):
        return {"configured": False}

    password_hash = str(payload.get("passwordHash") or "").strip()
    salt = str(payload.get("salt") or "").strip()
    iterations = int(payload.get("iterations") or DEFAULT_ITERATIONS)
    updated_at = int(payload.get("updatedAt") or 0)
    if not password_hash or not salt:
        return {"configured": False}

    return {
        "configured": True,
        "passwordHash": password_hash,
        "salt": salt,
        "iterations": max(DEFAULT_ITERATIONS, iterations),
        "updatedAt": updated_at,
    }


def is_admin_configured(project_root: Path) -> bool:
    return read_admin_config(project_root).get("configured", False) or bool(get_admin_password_env())


def hash_password(password: str, salt: str, iterations: int = DEFAULT_ITERATIONS) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        bytes.fromhex(salt),
        iterations,
    ).hex()


def verify_admin_password(project_root: Path, password: str) -> bool:
    config = read_admin_config(project_root)
    if config.get("configured"):
        expected = config["passwordHash"]
        candidate = hash_password(password, config["salt"], config["iterations"])
        return hmac.compare_digest(candidate, expected)

    fallback_password = get_admin_password_env()
    return bool(fallback_password and hmac.compare_digest(password, fallback_password))


def write_admin_password(project_root: Path, password: str) -> Path:
    config_path = get_admin_config_path(project_root)
    config_path.parent.mkdir(parents=True, exist_ok=True)
    salt = os.urandom(16).hex()
    payload = {
        "passwordHash": hash_password(password, salt),
        "salt": salt,
        "iterations": DEFAULT_ITERATIONS,
        "updatedAt": int(time.time()),
    }
    config_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return config_path
