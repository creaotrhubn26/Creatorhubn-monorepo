"""Social Vertikal B-kamera — STEG 1: Inspiser referanse-timeline (read-only) → inspect.json.
Params: refTimeline (str), workDir (str). Alt lagres i frames (tl_end_f EKSKLUSIV)."""
from __future__ import annotations
import os, sys, json
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    ref = (params.get("refTimeline") or "").strip()
    work = (params.get("workDir") or "").strip()
    if not ref or not work:
        bridge.error("Mangler refTimeline og/eller workDir"); sys.exit(1)
    os.makedirs(work, exist_ok=True)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    proj = conn.project

    tgt = None
    for i in range(1, proj.GetTimelineCount() + 1):
        t = proj.GetTimelineByIndex(i)
        if t.GetName().strip().lower() == ref.lower():
            tgt = t; break
    if not tgt:
        bridge.error(f"Fant ikke timeline '{ref}'"); sys.exit(1)

    proj.SetCurrentTimeline(tgt)
    fps = float(tgt.GetSetting("timelineFrameRate") or 25)
    start = int(tgt.GetStartFrame())
    out = {"timeline": tgt.GetName(), "fps": fps, "start": start, "video": {}, "audio": {}}
    vtracks = atracks = clipcount = 0
    for kind in ("video", "audio"):
        n = int(tgt.GetTrackCount(kind))
        for tr in range(1, n + 1):
            its = tgt.GetItemListInTrack(kind, tr) or []
            rows = []
            for it in its:
                m = it.GetMediaPoolItem(); cp = (m.GetClipProperty() if m else {}) or {}
                tls, tle = it.GetStart(), it.GetEnd()  # GetEnd INKLUSIV
                rows.append({
                    "file": os.path.basename(cp.get("File Path", "")) or "?",
                    "path": cp.get("File Path", ""), "name": it.GetName(),
                    "tl_start_f": tls, "tl_end_f": tle + 1, "dur_f": (tle + 1) - tls,
                    "src_in_f": it.GetSourceStartFrame(), "src_out_f": it.GetSourceEndFrame(),
                    "start_tc": cp.get("Start TC", ""),
                })
            out[kind][f"{kind[0].upper()}{tr}"] = {"name": tgt.GetTrackName(kind, tr), "clips": rows}
            clipcount += len(rows)
        if kind == "video": vtracks = n
        else: atracks = n
        bridge.progress(50 if kind == "video" else 100, 100, f"Inspiserte {kind}")

    json.dump(out, open(os.path.join(work, "inspect.json"), "w"), indent=2, ensure_ascii=False)
    bridge.result({
        "timeline": tgt.GetName(), "fps": fps, "start": start,
        "videoTracks": vtracks, "audioTracks": atracks, "clipCount": clipcount,
        "inspectPath": os.path.join(work, "inspect.json"),
        "note": "Bekreft at start-TC IKKE er tid-på-døgn (ofte free-run). Bruk filnavn/EXIF i STEG 2.",
    })


if __name__ == "__main__":
    bridge.main_guard(run)
