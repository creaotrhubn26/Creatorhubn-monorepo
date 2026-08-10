#!/usr/bin/env python3
"""Claude×Blender MCP-server — stdio JSON-RPC → HTTP-broen i Blender.

Håndrullet og null deps (Role Room MCP-mønsteret). Verktøykatalogen hentes
LIVE fra broen (GET /tools) — core.TOOLS er eneste kilde.

Bruk (Claude Code):
    claude mcp add blender -- python3 apps/blender-bridge/mcp/blender_mcp_server.py
Krev: Blender kjører med Claude Bridge-extensionen aktiv (port 7717).
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BRIDGE = "http://127.0.0.1:7717"
PROTOCOL_VERSION = "2024-11-05"


def _http(path: str, payload: dict | None = None) -> dict:
    req = urllib.request.Request(
        BRIDGE + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={"Content-Type": "application/json"},
        method="POST" if payload is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=90) as response:
        return json.loads(response.read())


def _tool_list() -> list[dict]:
    tools = _http("/tools")["tools"]
    return [
        {
            "name": t["name"],
            "description": t["description"] + (" [MUTERER SCENEN]" if t["mutates"] else ""),
            "inputSchema": {"type": "object", "additionalProperties": True},
        }
        for t in tools
    ]


def _handle(request: dict) -> dict | None:
    method = request.get("method")
    request_id = request.get("id")

    if method == "initialize":
        return _result(request_id, {
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {}, "resources": {}},
            "serverInfo": {"name": "blender-bridge", "version": "0.1.0"},
        })
    if method in ("notifications/initialized", "notifications/cancelled"):
        return None
    if method == "tools/list":
        try:
            return _result(request_id, {"tools": _tool_list()})
        except (urllib.error.URLError, OSError):
            return _error(request_id, -32000,
                          "Får ikke kontakt med Blender-broen (kjører Blender med extensionen?)")
    if method == "resources/list":
        try:
            listed = _http("/resources")["resources"]
        except (urllib.error.URLError, OSError):
            return _error(request_id, -32000, "Får ikke kontakt med Blender-broen")
        return _result(request_id, {"resources": [
            {"uri": r["uri"], "name": r["name"], "mimeType": "application/json"}
            for r in listed
        ]})
    if method == "resources/read":
        uri = ((request.get("params") or {}).get("uri")) or ""
        from urllib.parse import quote
        try:
            response = _http("/resource?uri=" + quote(uri, safe=""))
        except urllib.error.HTTPError as err:
            body = err.read().decode(errors="replace")
            return _error(request_id, -32002, f"ressurs feilet: {body[:200]}")
        except (urllib.error.URLError, OSError):
            return _error(request_id, -32000, "Får ikke kontakt med Blender-broen")
        return _result(request_id, {"contents": [{
            "uri": uri,
            "mimeType": "application/json",
            "text": json.dumps(response.get("result"), indent=2),
        }]})
    if method == "tools/call":
        params = request.get("params") or {}
        try:
            response = _http("/call", {
                "tool": params.get("name"),
                "args": params.get("arguments") or {},
            })
        except urllib.error.HTTPError as err:
            body = err.read().decode(errors="replace")
            try:
                message = json.loads(body).get("error", body)
            except json.JSONDecodeError:
                message = body
            return _result(request_id, _tool_text(f"Feil: {message}", is_error=True))
        except (urllib.error.URLError, OSError):
            return _result(request_id, _tool_text(
                "Får ikke kontakt med Blender-broen (kjører Blender med extensionen?)",
                is_error=True))
        return _result(request_id, _tool_text(json.dumps(response.get("result"), indent=2)))
    if request_id is not None:
        return _error(request_id, -32601, f"ukjent metode {method}")
    return None


def _tool_text(text: str, is_error: bool = False) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def _result(request_id, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _error(request_id, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            continue
        response = _handle(request)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
