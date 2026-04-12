#!/usr/bin/env python3

from __future__ import annotations

import argparse
import http.server
import json
import os
import secrets
import socketserver
import threading
from pathlib import Path
from http import HTTPStatus

from calibrate_detection import write_calibration_files
from library_manifest import SUPPORTED_EXTENSIONS, read_metadata, write_library_files, write_metadata


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ADMIN_PASSWORD = os.environ.get("COFRABEAT_ADMIN_PASSWORD", "psangorrin")
ADMIN_COOKIE = "cofrabeat_admin"
ADMIN_SESSIONS: set[str] = set()
REFRESH_LOCK = threading.Lock()


class CofraBeatHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/api/admin/status":
            return self.send_json(
                {
                    "authenticated": self.is_admin_authenticated(),
                    "adminAvailable": self.is_admin_available(),
                    "requiresHttps": not self.is_loopback_request(),
                }
            )

        if self.path == "/api/admin/metadata":
            if not self.is_admin_authenticated():
                return self.send_json({"error": "No autorizado"}, HTTPStatus.UNAUTHORIZED)
            return self.send_json(read_metadata(PROJECT_ROOT))

        if self.path in {
            "/",
            "/index.html",
            "/assets/pasos/manifest.json",
            "/assets/pasos/features.json",
            "/assets/pasos/calibration.json",
        }:
            refresh_library()
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/admin/login":
            return self.handle_admin_login()

        if self.path == "/api/admin/logout":
            return self.handle_admin_logout()

        if self.path == "/api/admin/metadata":
            return self.handle_admin_metadata()

        self.send_error(HTTPStatus.NOT_FOUND, "API no encontrada")

    def handle_admin_metadata(self):
        if not self.is_admin_available():
            return self.send_json(
                {"error": "Administración global solo disponible en HTTPS o localhost"},
                HTTPStatus.FORBIDDEN,
            )
        if not self.is_admin_authenticated():
            return self.send_json({"error": "No autorizado"}, HTTPStatus.UNAUTHORIZED)

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, json.JSONDecodeError):
            return self.send_json({"error": "JSON inválido"}, HTTPStatus.BAD_REQUEST)

        write_metadata(PROJECT_ROOT, payload)
        refresh_library()
        return self.send_json({"saved": True, "metadata": read_metadata(PROJECT_ROOT)})

    def handle_admin_login(self):
        if not self.is_admin_available():
            return self.send_json(
                {"authenticated": False, "error": "HTTPS requerido para administración remota"},
                HTTPStatus.FORBIDDEN,
            )
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, json.JSONDecodeError):
            return self.send_json({"authenticated": False}, HTTPStatus.BAD_REQUEST)

        if payload.get("password") != ADMIN_PASSWORD:
            return self.send_json({"authenticated": False}, HTTPStatus.UNAUTHORIZED)

        token = secrets.token_urlsafe(32)
        ADMIN_SESSIONS.add(token)
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Set-Cookie", f"{ADMIN_COOKIE}={token}; Path=/; SameSite=Strict; HttpOnly")
        self.end_headers()
        self.wfile.write(json.dumps({"authenticated": True}).encode("utf-8"))

    def handle_admin_logout(self):
        token = self.get_admin_cookie()
        if token:
            ADMIN_SESSIONS.discard(token)

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Set-Cookie", f"{ADMIN_COOKIE}=; Path=/; Max-Age=0; SameSite=Strict; HttpOnly")
        self.end_headers()
        self.wfile.write(json.dumps({"authenticated": False}).encode("utf-8"))

    def is_admin_authenticated(self) -> bool:
        token = self.get_admin_cookie()
        return bool(token and token in ADMIN_SESSIONS)

    def is_admin_available(self) -> bool:
        return self.is_loopback_request()

    def is_loopback_request(self) -> bool:
        return self.client_address[0] in {"127.0.0.1", "::1"}

    def get_admin_cookie(self) -> str | None:
        cookie_header = self.headers.get("Cookie", "")
        for part in cookie_header.split(";"):
            name, _, value = part.strip().partition("=")
            if name == ADMIN_COOKIE:
                return value
        return None

    def send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def refresh_library() -> None:
    with REFRESH_LOCK:
        if not library_refresh_needed(PROJECT_ROOT):
            return
        write_library_files(PROJECT_ROOT)
        try:
            write_calibration_files(PROJECT_ROOT, regenerate_library=False)
        except (Exception, SystemExit) as error:
            print(f"Calibracion no generada: {error}")


def library_refresh_needed(project_root: Path) -> bool:
    pasos_dir = project_root / "assets" / "pasos"
    outputs = [pasos_dir / "manifest.json", pasos_dir / "features.json", pasos_dir / "calibration.json"]
    if any(not path.exists() for path in outputs):
        return True

    newest_output = min(path.stat().st_mtime for path in outputs)
    source_paths = [
        path for path in pasos_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    ]
    source_paths.extend(
        [
            pasos_dir / "metadata.json",
            project_root / "scripts" / "library_manifest.py",
            project_root / "scripts" / "calibrate_detection.py",
        ]
    )
    existing_sources = [path for path in source_paths if path.exists()]
    if not existing_sources:
        return False
    return max(path.stat().st_mtime for path in existing_sources) > newest_output


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Servidor HTTP de CofraBeat con manifest automático.")
    parser.add_argument("--host", default="0.0.0.0", help="Host de escucha. Por defecto 0.0.0.0")
    parser.add_argument("--port", type=int, default=8000, help="Puerto HTTP. Por defecto 8000")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    refresh_library()
    with ReusableTCPServer((args.host, args.port), CofraBeatHandler) as httpd:
        print(f"Serving CofraBeat on http://{args.host}:{args.port} from {PROJECT_ROOT}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
