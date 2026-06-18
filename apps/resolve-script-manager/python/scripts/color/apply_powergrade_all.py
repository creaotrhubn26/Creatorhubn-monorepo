"""Apply PowerGrade to All Clips — propagér en .drx-node-tre/PowerGrade til alle
V1-klipp i gjeldende timeline.

Bakgrunn: node-tre kan ikke bygges pålitelig via Resolve-API (`AddNode`=NULL), men
en ferdig PowerGrade kan LAGRES som .drx i Color-siden og propageres til alle klipp
via `item.GetNodeGraph().ApplyGradeFromDRX(drxPath, gradeMode)`.

⚠️ Gotcha (verifisert): ApplyGradeFromDRX trenger ~0.15s pust MELLOM klipp — uten
delay returnerer den falsy og hopper stille over (en rask løkke traff kun 1/61 klipp).
PowerGrade-album er IKKE eksponert i gallery-API-et → bruk .drx-FILA på disk.

Brukes som «brand-grade-default»: sett BRAND_GRADE_DRX i Settings → legges automatisk
på i hvert prosjekt (kan også kjøres manuelt med drxPath-param).

Input params:
  drxPath:        sti til .drx (default: env BRAND_GRADE_DRX)
  timelineName:   (valgfri) default = current
  gradeMode:      0 = no keyframes (default), 1 = source-TC, 2 = start-frame aligned
  minNodes:       hopp over klipp som allerede har >= dette antall noder (default 2 = allerede gradet)
  trackIndex:     video-spor (default 1)
  delaySec:       pust mellom klipp (default 0.15)

Output: { applied, already, failed, totalClips, verifiedWithGrade, drxPath }
"""
from __future__ import annotations

import os
import sys
import time
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def apply_powergrade_to_timeline(conn, timeline, drx_path: str, grade_mode: int = 0,
                                 min_nodes: int = 2, track_index: int = 1,
                                 delay_sec: float = 0.15) -> dict[str, Any]:
    """Gjenbrukbar: legg .drx på alle klipp på et spor. Returnerer tellinger.
    Trygg å kalle fra build-scripts (hopper over klipp som allerede er gradet)."""
    items = timeline.GetItemListInTrack("video", track_index) or []
    applied = already = failed = 0
    for it in items:
        try:
            g = it.GetNodeGraph()
            if g is None:
                failed += 1
                continue
            if (g.GetNumNodes() or 0) >= min_nodes:
                already += 1
                continue
            ok = g.ApplyGradeFromDRX(drx_path, grade_mode)
            time.sleep(delay_sec)  # ⚠️ påkrevd — uten pust returnerer neste kall falsy
            if ok or (it.GetNodeGraph().GetNumNodes() or 0) >= min_nodes:
                applied += 1
            else:
                failed += 1
        except Exception:  # noqa: BLE001
            failed += 1
    verified = sum(1 for it in items if (it.GetNodeGraph().GetNumNodes() or 0) >= min_nodes)
    return {"applied": applied, "already": already, "failed": failed,
            "totalClips": len(items), "verifiedWithGrade": verified}


def run(params: dict[str, Any], dry_run: bool) -> None:
    drx_path = (params.get("drxPath") or os.environ.get("BRAND_GRADE_DRX") or "").strip()
    timeline_name = (params.get("timelineName") or "").strip()
    grade_mode = int(params.get("gradeMode") if params.get("gradeMode") is not None else 0)
    min_nodes = int(params.get("minNodes") if params.get("minNodes") is not None else 2)
    track_index = int(params.get("trackIndex") or 1)
    delay_sec = float(params.get("delaySec") if params.get("delaySec") is not None else 0.15)

    if dry_run:
        bridge.result({"summary": f"Would apply {drx_path or '(BRAND_GRADE_DRX)'} to all V{track_index} clips "
                                  f"(gradeMode={grade_mode}, skip >= {min_nodes} noder)"})
        return

    if not drx_path:
        bridge.result({"skipped": True, "reason": "Ingen drxPath / BRAND_GRADE_DRX satt — hopper over grade."})
        return
    if not os.path.isfile(drx_path):
        bridge.error(f"Finner ikke .drx: {drx_path}")
        sys.exit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen åpen Resolve/timeline.")
        sys.exit(1)
    p = conn.project
    tl = None
    if timeline_name:
        for i in range(1, (p.GetTimelineCount() or 0) + 1):
            t = p.GetTimelineByIndex(i)
            if t and t.GetName() == timeline_name:
                tl = t
                break
    tl = tl or p.GetCurrentTimeline()
    if tl is None:
        bridge.error("Ingen aktiv timeline.")
        sys.exit(1)

    bridge.progress(10, 100, "Propagerer PowerGrade til alle klipp…")
    res = apply_powergrade_to_timeline(conn, tl, drx_path, grade_mode, min_nodes, track_index, delay_sec)
    res["drxPath"] = drx_path
    bridge.progress(100, 100, "Ferdig.")
    bridge.log(f"PowerGrade: {res['applied']} lagt på, {res['already']} allerede, "
               f"{res['failed']} feilet — {res['verifiedWithGrade']}/{res['totalClips']} verifisert.")
    bridge.result(res)


if __name__ == "__main__":
    bridge.main_guard(run)
