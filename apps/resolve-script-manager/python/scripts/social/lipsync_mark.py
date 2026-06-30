"""Lip-sync sjekk — STEG 2: marker funne usynkede seksjoner i timeline (eller fjern dem).
Params: timelineName(valgfri=current), action ("mark"|"clear"), sections (liste fra lipsync_scan:
[{tlStartRel,tlEndRel,file,offsetFrames,corr}]). customData='svblip' så de er lette å fjerne."""
from __future__ import annotations
import os, sys
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

def run(params: dict[str, Any], dry_run: bool) -> None:
    name = (params.get("timelineName") or "").strip()
    action = (params.get("action") or "mark").lower()
    sections = params.get("sections") or []
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    proj = conn.project
    tl = None
    if name:
        for i in range(1, proj.GetTimelineCount()+1):
            t = proj.GetTimelineByIndex(i)
            if t.GetName() == name: tl = t
    tl = tl or proj.GetCurrentTimeline()
    if not tl: bridge.error("Ingen timeline"); sys.exit(1)

    if action == "clear":
        ok = False
        try: ok = tl.DeleteMarkersByCustomData("svblip")
        except Exception as e: bridge.warn(f"clear-feil: {e}")
        bridge.result({"action": "clear", "cleared": bool(ok), "timeline": tl.GetName()})
        return

    # mark: fjern gamle svblip-markører først (idempotent), så legg nye
    try: tl.DeleteMarkersByCustomData("svblip")
    except Exception: pass
    added = 0
    for s in sections:
        fid = int(s["tlStartRel"]); dur = max(1, int(s.get("tlEndRel", fid+1)) - fid)
        offf = s.get("offsetFrames", 0); corr = s.get("corr", 0)
        nm = f"LIP-SYNC OFF: {s.get('file','?')} {offf:+.0f}f"
        note = f"Bilde {offf:+.0f}f ({float(offf)/25:+.2f}s) ute av sync mot opptaker-lyd (corr {corr})."
        ok = tl.AddMarker(fid, "Red", nm, note, dur, "svblip")
        if not ok: ok = tl.AddMarker(fid+1, "Red", nm, note, dur, "svblip")
        if ok: added += 1
    bridge.result({"action": "mark", "added": added, "requested": len(sections), "timeline": tl.GetName(),
                   "note": f"La inn {added} markør(er). Fjern når som helst med 'Fjern markører'."})

if __name__ == "__main__":
    bridge.main_guard(run)
