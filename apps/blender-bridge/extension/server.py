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

try:
    from . import core, permissions, resources
except ImportError:  # flat import i headless-testene
    import core, permissions, resources

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
            if cmd["tool"] == "__resources__":
                cmd["result"] = resources.list_resources()
            elif cmd["tool"] == "__resource__":
                cmd["result"] = resources.resolve(cmd["args"]["uri"])
            else:
                level = core.TOOLS.get(cmd["tool"], {}).get("level", "safe")
                if permissions.requires_approval(level):
                    approval_id = permissions.create_pending(cmd["tool"], cmd["args"])
                    cmd["result"] = {
                        "approval_required": True,
                        "approval_id": approval_id,
                        "level": level,
                        "message": "Venter på godkjenning i Blender-panelet. "
                                   "Kall check_approval med approval_id for status/resultat.",
                    }
                    cmd["ok"] = True
                    cmd["event"].set()
                    continue
                cmd["result"] = core.call_tool(cmd["tool"], cmd["args"])
                permissions.log(cmd["tool"], True)
            cmd["ok"] = True
        except Exception as exc:  # noqa: BLE001 — feilen skal til klienten
            cmd["ok"] = False
            cmd["error"] = str(exc)
            permissions.log(cmd["tool"], False, str(exc))
        cmd["event"].set()

    # kjør godkjente ventende kommandoer (godkjent via panel-klikk)
    for entry in permissions.approved_ready():
        try:
            result = core.call_tool(entry["tool"], entry["args"])
            permissions.set_status(entry["id"], "done", result=result)
            permissions.log(entry["tool"], True, "godkjent av bruker")
        except Exception as exc:  # noqa: BLE001
            permissions.set_status(entry["id"], "failed", error=str(exc))
            permissions.log(entry["tool"], False, str(exc))
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
        elif self.path.startswith("/resource?"):
            from urllib.parse import parse_qs, urlparse
            uri = (parse_qs(urlparse(self.path).query).get("uri") or [""])[0]
            cmd = {"tool": "__resource__", "args": {"uri": uri}, "event": threading.Event()}
            _COMMANDS.put(cmd)
            if not cmd["event"].wait(timeout=30):
                return self._respond(504, {"ok": False, "error": "timeout"})
            if cmd["ok"]:
                self._respond(200, {"ok": True, "result": cmd["result"]})
            else:
                self._respond(422, {"ok": False, "error": cmd["error"]})
        elif self.path == "/resources":
            cmd = {"tool": "__resources__", "args": {}, "event": threading.Event()}
            _COMMANDS.put(cmd)
            if not cmd["event"].wait(timeout=30):
                return self._respond(504, {"ok": False, "error": "timeout"})
            self._respond(200, {"resources": cmd.get("result", [])})
        elif self.path == "/tools":
            tools = [
                {"name": name, "description": t["description"], "mutates": t["mutates"],
                 "level": t.get("level", "safe")}
                for name, t in core.TOOLS.items()
            ]
            tools.append({
                "name": "check_approval",
                "description": "Sjekk status/resultat for et kall som venter på godkjenning "
                               "i Blender-panelet. Args: approval_id.",
                "mutates": False, "level": "safe",
            })
            self._respond(200, {"tools": tools})
        elif self.path.startswith("/approval/"):
            entry = permissions.get(self.path[len("/approval/"):])
            if entry is None:
                self._respond(404, {"ok": False, "error": "ukjent approval_id"})
            else:
                self._respond(200, {"ok": True, "result": {
                    "status": entry["status"], "result": entry["result"],
                    "error": entry["error"], "tool": entry["tool"],
                }})
        elif self.path == "/log":
            self._respond(200, {"log": permissions.log_tail(20)})
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
        if tool == "check_approval":
            entry = permissions.get((payload.get("args") or {}).get("approval_id", ""))
            if entry is None:
                return self._respond(422, {"ok": False, "error": "ukjent approval_id"})
            return self._respond(200, {"ok": True, "result": {
                "status": entry["status"], "result": entry["result"], "error": entry["error"],
            }})
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
