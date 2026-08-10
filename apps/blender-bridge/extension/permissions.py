# permissions.py — godkjennings-flyt og operasjonslogg (§11-12, §36).
#
# Nivåer (level på hvert verktøy i core.TOOLS):
#   safe        → kjøres alltid
#   modify      → kjøres når «Auto-godkjenn endringer» er PÅ (default på;
#                 slås av i N-panelet)
#   destructive → krever ALLTID klikk i Blender-panelet (Approve/Deny) —
#                 godkjenning kan IKKE gis over HTTP (da kunne agenten
#                 godkjent seg selv). Unntak: BRIDGE_AUTO_APPROVE=1 (headless
#                 CI/E2E, satt av mennesket som starter prosessen).
#
# Flyt: gated kall → {approval_required, approval_id} → bruker klikker i
# panelet → kommandoen kjøres på main thread → Claude henter resultatet via
# check_approval(approval_id).

from __future__ import annotations

import os
import threading
import time
import uuid

AUTO_APPROVE = os.environ.get("BRIDGE_AUTO_APPROVE") == "1"

# Slås av/på fra panelet (leses/skrives kun på main thread).
auto_modify = True

_LOCK = threading.Lock()
_PENDING: dict[str, dict] = {}
_LOG: list[dict] = []
_LOG_MAX = 50


def requires_approval(level: str) -> bool:
    if AUTO_APPROVE:
        return False
    if level == "destructive":
        return True
    if level == "modify":
        return not auto_modify
    return False


def create_pending(tool: str, args: dict) -> str:
    approval_id = uuid.uuid4().hex[:12]
    with _LOCK:
        _PENDING[approval_id] = {
            "id": approval_id,
            "tool": tool,
            "args": args,
            "status": "pending",  # pending | approved | denied | done | failed
            "result": None,
            "error": None,
            "created": time.time(),
        }
    return approval_id


def pending_list() -> list[dict]:
    with _LOCK:
        return [dict(p) for p in _PENDING.values() if p["status"] == "pending"]


def get(approval_id: str) -> dict | None:
    with _LOCK:
        entry = _PENDING.get(approval_id)
        return dict(entry) if entry else None


def set_status(approval_id: str, status: str, result=None, error=None) -> None:
    with _LOCK:
        entry = _PENDING.get(approval_id)
        if entry is None:
            return
        entry["status"] = status
        if result is not None:
            entry["result"] = result
        if error is not None:
            entry["error"] = error


def approved_ready() -> list[dict]:
    """Godkjente, ikke-kjørte — drain-loopen plukker disse."""
    with _LOCK:
        return [dict(p) for p in _PENDING.values() if p["status"] == "approved"]


def log(tool: str, ok: bool, detail: str = "") -> None:
    with _LOCK:
        _LOG.append({"tool": tool, "ok": ok, "detail": detail[:120], "t": time.time()})
        del _LOG[:-_LOG_MAX]


def log_tail(count: int = 10) -> list[dict]:
    with _LOCK:
        return list(_LOG[-count:])
