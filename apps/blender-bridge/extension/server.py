# server.py — HTTP-broen inne i Blender-extensionen.
#
# http.server i egen tråd tar imot kall, men bpy røres ALDRI fra
# nettverkstråden (arkitekturdokumentets §10): hvert kall legges i en kø som
# en bpy.app.timers-callback drenerer på Blenders main thread; HTTP-tråden
# venter på et Event med timeout.
#
#   GET  /health   → {"ok": true, "blender": "5.2.0"}
#   GET  /tools    → verktøykatalogen (navn, beskrivelse, mutates)
#   POST /call     → {"tool": "...", "args": {...}} → {"ok": true, "result": ...}

from __future__ import annotations

import json
import queue
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import bpy

from . import core

HOST = "127.0.0.1"
PORT = 7717  # ponytail: fast port; gjør konfigurerbar når behovet oppstår

_COMMANDS: "queue.Queue[dict]" = queue.Queue()
_server: ThreadingHTTPServer | None = None
_thread: threading.Thread | None = None


def _drain_commands():
    """Kjøres av bpy.app.timers på main thread — eneste sted bpy kalles."""
    while True:
        try:
            cmd = _COMMANDS.get_nowait()
        except queue.Empty:
            break
        try:
            cmd["result"] = core.call_tool(cmd["tool"], cmd["args"])
            cmd["ok"] = True
        except Exception as exc:  # noqa: BLE001 — feilen skal til klienten
            cmd["ok"] = False
            cmd["error"] = str(exc)
        cmd["event"].set()
    return 0.05


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):  # stille — Blender-konsollen er støyete nok
        pass

    def _respond(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"ok": True, "blender": bpy.app.version_string})
        elif self.path == "/tools":
            tools = [
                {"name": name, "description": t["description"], "mutates": t["mutates"]}
                for name, t in core.TOOLS.items()
            ]
            self._respond(200, {"tools": tools})
        else:
            self._respond(404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if self.path != "/call":
            return self._respond(404, {"ok": False, "error": "not_found"})
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            return self._respond(400, {"ok": False, "error": "ugyldig_json"})
        tool = payload.get("tool")
        if not isinstance(tool, str):
            return self._respond(400, {"ok": False, "error": "tool_mangler"})
        cmd = {
            "tool": tool,
            "args": payload.get("args") or {},
            "event": threading.Event(),
        }
        _COMMANDS.put(cmd)
        if not cmd["event"].wait(timeout=60):
            return self._respond(504, {"ok": False, "error": "timeout"})
        if cmd["ok"]:
            self._respond(200, {"ok": True, "result": cmd["result"]})
        else:
            self._respond(422, {"ok": False, "error": cmd["error"]})


def start() -> None:
    global _server, _thread
    if _server is not None:
        return
    _server = ThreadingHTTPServer((HOST, PORT), _Handler)
    _thread = threading.Thread(target=_server.serve_forever, name="claude-bridge", daemon=True)
    _thread.start()
    if not bpy.app.timers.is_registered(_drain_commands):
        bpy.app.timers.register(_drain_commands, persistent=True)


def stop() -> None:
    global _server, _thread
    if bpy.app.timers.is_registered(_drain_commands):
        bpy.app.timers.unregister(_drain_commands)
    if _server is not None:
        _server.shutdown()
        _server = None
    _thread = None
