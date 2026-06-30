"""Social Vertikal B-kamera — STEG 7: Verifiser sluttilstand (kontiguitet, lengder) + grab still per shot.
Params: workDir, outTimeline, fps. Stills lagres til <workDir>/stills_verify/ og returneres som stier."""
from __future__ import annotations
import os, sys, glob
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    work = (params.get("workDir") or "").strip()
    out_tl = (params.get("outTimeline") or "").strip()
    fps = float(params.get("fps") or 25)
    if not (work and out_tl):
        bridge.error("Mangler workDir/outTimeline"); sys.exit(1)
    outdir = os.path.join(work, "stills_verify"); os.makedirs(outdir, exist_ok=True)
    for f in glob.glob(os.path.join(outdir, "*.jpg")):
        try: os.unlink(f)
        except OSError: pass

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    res = conn.resolve; proj = conn.project
    tl = None
    for i in range(1, proj.GetTimelineCount() + 1):
        t = proj.GetTimelineByIndex(i)
        if t.GetName() == out_tl:
            tl = t; break
    if not tl:
        bridge.error(f"Fant ikke timeline '{out_tl}'"); sys.exit(1)
    proj.SetCurrentTimeline(tl); NEW = int(tl.GetStartFrame())

    items = sorted(tl.GetItemListInTrack("video", 1) or [], key=lambda x: x.GetStart())
    bad = 0; prev = None
    for it in items:
        if prev is not None and it.GetStart() != prev + 1:
            bad += 1
        prev = it.GetEnd()
    vend = (items[-1].GetEnd() + 1 - NEW) / fps if items else 0
    aend = 0
    for tr in range(1, int(tl.GetTrackCount("audio")) + 1):
        for a in (tl.GetItemListInTrack("audio", tr) or []):
            aend = max(aend, (a.GetEnd() + 1 - NEW) / fps)

    res.OpenPage("color")
    gal = proj.GetGallery(); alb = gal.GetCurrentStillAlbum()

    def tc(fr):
        f = int(round(fr)); F = int(round(fps))
        return f"{f//(3600*F):02d}:{(f//(60*F))%60:02d}:{(f//F)%60:02d}:{f%F:02d}"

    stills = []
    for idx, it in enumerate(items):
        mid = (it.GetStart() + it.GetEnd()) // 2
        tl.SetCurrentTimecode(tc(mid)); _ = tl.GrabStill(); tl.SetCurrentTimecode(tc(mid)); st = tl.GrabStill()
        if st:
            stills.append(st)
        bridge.progress(idx + 1, len(items), "Grabber stills")
    if stills:
        alb.ExportStills(stills, outdir, "v", "jpg")
    paths = sorted(glob.glob(os.path.join(outdir, "*.jpg")))
    bridge.result({"timeline": out_tl, "clips": len(items), "contiguityBreaks": bad,
                   "videoEndSec": round(vend, 2), "audioEndSec": round(aend, 2),
                   "stillsDir": outdir, "stills": paths,
                   "note": "Sjekk stills (scene + orientering). Spill av i Resolve for lip-sync. "
                           "Deretter: kun gradering + finredigering gjenstår."})


if __name__ == "__main__":
    bridge.main_guard(run)
