#!/usr/bin/env python3

from __future__ import annotations

import argparse
import http.server
import json
import os
import secrets
import socketserver
from pathlib import Path
from http import HTTPStatus

from library_manifest import read_metadata, write_library_files, write_metadata


PROJECT_ROOT = Path(__file__).resolve().parent.parent
ADMIN_PASSWORD = os.environ.get("COFRABEAT_ADMIN_PASSWORD", "psangorrin")
ADMIN_COOKIE = "cofrabeat_admin"
ADMIN_SESSIONS: set[str] = set()


class CofraBeatHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(PROJECT_ROOT), **kwargs)

    def do_GET(self):
        if self.path == "/api/admin/status":
            return self.send_json({"authenticated": self.is_admin_authenticated()})

        if self.path == "/api/admin/metadata":
            if not self.is_admin_authenticated():
                return self.send_json({"error": "No autorizado"}, HTTPStatus.UNAUTHORIZED)
            return self.send_json(read_metadata(PROJECT_ROOT))

        if self.path in {"/", "/index.html", "/assets/pasos/manifest.json", "/assets/pasos/features.json"}:
            write_library_files(PROJECT_ROOT)
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
        if not self.is_admin_authenticated():
            return self.send_json({"error": "No autorizado"}, HTTPStatus.UNAUTHORIZED)

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, json.JSONDecodeError):
            return self.send_json({"error": "JSON inválido"}, HTTPStatus.BAD_REQUEST)

        write_metadata(PROJECT_ROOT, payload)
        write_library_files(PROJECT_ROOT)
        return self.send_json({"saved": True, "metadata": read_metadata(PROJECT_ROOT)})

    def handle_admin_login(self):
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Servidor HTTP de CofraBeat con manifest automático.")
    parser.add_argument("--host", default="0.0.0.0", help="Host de escucha. Por defecto 0.0.0.0")
    parser.add_argument("--port", type=int, default=8000, help="Puerto HTTP. Por defecto 8000")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    write_library_files(PROJECT_ROOT)
    with ReusableTCPServer((args.host, args.port), CofraBeatHandler) as httpd:
        print(f"Serving CofraBeat on http://{args.host}:{args.port} from {PROJECT_ROOT}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
