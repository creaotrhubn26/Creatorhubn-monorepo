"""Kopier attributter per kamera — grade/transform fra ett klipp til alle like.

Use case: du har gradet ett Canon C80-klipp og vil ha samme look på ALLE
C80-klipp (og tilsvarende for Sony osv.). Tre veier:

  mode=grade       CopyGrades: node-stakken fra kildeklippet (tc=playhead,
                   eller sourceClip=<navn>) kopieres til alle timeline-items
                   som matcher cameraPattern. OVERSKRIVER målenes grade.
  mode=attributes  Edit-attributter (SetProperty): keys=Pan,Tilt,ZoomX,...
                   leses fra kilden og settes på alle mål. Kun oppgitte keys
                   røres. Default-keys: Pan,Tilt,ZoomX,ZoomY,RotationAngle.
  mode=group       ANBEFALT for kamera-looks: oppretter/gjenbruker Color
                   Group (groupName, default = pattern) og melder alle
                   matchende items inn. Grade settes ÉN gang på gruppen i
                   Color-siden — gjelder alle medlemmer, også fremtidige.
                   Endrer ikke eksisterende klipp-grades.

Mål-utvalg: cameraPattern=<regex> mot klippnavn (f.eks. "C80"→Canon-filer
via "A_00\\d+C\\d+.*CANON", "Sony"→"A74\\d+.*MP4" — eller bare "CANON").
onlyUngraded=true (kun for grade-mode): hopp over mål som alt HAR grade.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402

DEFAULT_KEYS = ["Pan", "Tilt", "ZoomX", "ZoomY", "RotationAngle"]


def _tc_frames(tc: str, fps: float) -> int:
    m = re.match(r"(\d+):(\d+):(\d+)[:;](\d+)", tc.strip())
    if not m:
        return 0
    h, mi, s, f = (int(x) for x in m.groups())
    return int((h * 3600 + mi * 60 + s) * round(fps) + f)


def _all_items(timeline):
    out = []
    for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
        for it in timeline.GetItemListInTrack("video", t) or []:
            out.append((t, it))
    return out


def run(params: dict, dry_run: bool) -> None:  # noqa: C901
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    project = conn.project
    timeline = project.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen gjeldende timeline.")
        return
    fps = float(timeline.GetSetting("timelineFrameRate") or 25.0)
    mode = (params.get("mode") or "group").strip().lower()
    pattern = (params.get("cameraPattern") or "").strip()
    if not pattern:
        bridge.error("cameraPattern=<regex> kreves (f.eks. CANON eller A74).")
        return
    rx = re.compile(pattern, re.I)

    items = _all_items(timeline)
    targets = [(t, it) for t, it in items if rx.search(it.GetName() or "")]
    if not targets:
        bridge.error(f"Ingen timeline-items matcher «{pattern}».")
        return

    # kilde (grade/attributes): klippet på tc, ellers navngitt
    source = None
    if mode in ("grade", "attributes"):
        tc = (params.get("tc") or "").strip()
        want_name = (params.get("sourceClip") or "").strip()
        if tc:
            frame = _tc_frames(tc, fps)
            at = [(t, it) for t, it in items
                  if int(it.GetStart() or 0) <= frame < int(it.GetEnd() or 0)]
            if at:
                source = max(at, key=lambda x: x[0])[1]  # øverste synlige
        elif want_name:
            source = next((it for _t, it in items if (it.GetName() or "") == want_name), None)
        if not source:
            bridge.error("Fant ikke kildeklipp — oppgi tc=<playhead> eller sourceClip=<navn>.")
            return
        targets = [(t, it) for t, it in targets if it != source]

    if mode == "grade":
        if str(params.get("onlyUngraded", "")).lower() in ("true", "1", "yes"):
            filtered = []
            for t, it in targets:
                try:
                    g = it.GetNodeGraph()
                    if not g or int(g.GetNumNodes() or 0) == 0:
                        filtered.append((t, it))
                except Exception:
                    filtered.append((t, it))
            targets = filtered
        report = {"mode": mode, "source": source.GetName(), "pattern": pattern,
                  "targets": len(targets),
                  "sample": [it.GetName() or "?" for _t, it in targets[:10]],
                  "copied": 0, "dryRun": dry_run,
                  "warning": "CopyGrades OVERSKRIVER målenes eksisterende grade."}
        if not dry_run and targets:
            try:
                if source.CopyGrades([it for _t, it in targets]):
                    report["copied"] = len(targets)
            except Exception as e:
                report["error"] = str(e)[:200]
        bridge.result(report)
        return

    if mode == "attributes":
        keys = [k.strip() for k in (params.get("keys") or ",".join(DEFAULT_KEYS)).split(",")
                if k.strip()]
        values = {}
        for k in keys:
            try:
                values[k] = source.GetProperty(k)
            except Exception:
                values[k] = None
        values = {k: v for k, v in values.items() if v is not None}
        report = {"mode": mode, "source": source.GetName(), "pattern": pattern,
                  "keys": values, "targets": len(targets), "applied": 0, "dryRun": dry_run}
        if not dry_run:
            for _t, it in targets:
                ok_all = True
                for k, v in values.items():
                    try:
                        if not it.SetProperty(k, v):
                            ok_all = False
                    except Exception:
                        ok_all = False
                if ok_all:
                    report["applied"] += 1
        bridge.result(report)
        return

    if mode == "group":
        gname = (params.get("groupName") or pattern).strip()
        existing = None
        try:
            for g in project.GetColorGroupsList() or []:
                if (g.GetName() or "") == gname:
                    existing = g
                    break
        except Exception:
            pass
        report = {"mode": mode, "groupName": gname, "pattern": pattern,
                  "groupExisted": bool(existing), "targets": len(targets),
                  "assigned": 0, "alreadyIn": 0, "dryRun": dry_run,
                  "note": "Grade settes på GRUPPEN i Color-siden (Group Pre/Post-clip) "
                          "— gjelder alle medlemmer uten å røre klipp-gradene."}
        if dry_run:
            bridge.result(report)
            return
        group = existing or project.AddColorGroup(gname)
        if not group:
            bridge.error(f"Kunne ikke opprette color-gruppen «{gname}».")
            return
        for _t, it in targets:
            try:
                cur = it.GetColorGroup()
                if cur and (cur.GetName() or "") == gname:
                    report["alreadyIn"] += 1
                    continue
                if it.AssignToColorGroup(group):
                    report["assigned"] += 1
            except Exception:
                pass
        bridge.result(report)
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
