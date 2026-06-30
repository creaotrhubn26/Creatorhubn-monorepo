"""Social Vertikal B-kamera — STEG 6: Render referanse-timelinens lyd-miks → master-WAV, legg på A1.
PÅLITELIG erstatning for å gjenskape multi-spors-lyd med AppendToTimeline (som forskyver/sprer).
Params: workDir, refTimeline, outTimeline, fps, audioEndSec."""
from __future__ import annotations
import os, sys, time, glob, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def run(params: dict[str, Any], dry_run: bool) -> None:
    work = (params.get("workDir") or "").strip()
    ref = (params.get("refTimeline") or "").strip()
    out_tl = (params.get("outTimeline") or "").strip()
    fps = float(params.get("fps") or 25)
    end_s = float(params.get("audioEndSec") or 0)
    if not (work and ref and out_tl):
        bridge.error("Mangler workDir/refTimeline/outTimeline"); sys.exit(1)
    os.makedirs(work, exist_ok=True)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        sys.exit(1)
    res = conn.resolve; proj = conn.project; mp = conn.media_pool

    reftl = newtl = None
    for i in range(1, proj.GetTimelineCount() + 1):
        t = proj.GetTimelineByIndex(i)
        if t.GetName().strip().lower() == ref.lower():
            reftl = t
        if t.GetName() == out_tl:
            newtl = t
    if not reftl or not newtl:
        bridge.error("Fant ikke ref/out timeline"); sys.exit(1)
    refstart = int(reftl.GetStartFrame())
    # default audio-slutt = video-slutt på out-timeline + 1s musikk-hale (eller param)
    if end_s <= 0:
        vitems = newtl.GetItemListInTrack("video", 1) or []
        vend_f = (max(it.GetEnd() for it in vitems) + 1) if vitems else refstart
        end_s = (vend_f - int(newtl.GetStartFrame())) / fps + 1.0

    proj.SetCurrentTimeline(reftl); res.OpenPage("deliver")
    try:
        proj.LoadRenderPreset("Audio Only")
    except Exception:
        pass
    proj.SetCurrentRenderFormatAndCodec("wav", "LinearPCM")
    proj.SetRenderSettings({"TargetDir": work, "CustomName": "svb_master_audio",
        "MarkIn": refstart, "MarkOut": refstart + int(end_s * fps) - 1, "SelectAllFrames": False,
        "ExportVideo": False, "ExportAudio": True})
    jid = proj.AddRenderJob(); proj.StartRendering([jid])
    for _ in range(300):
        if not proj.IsRenderingInProgress():
            break
        time.sleep(1)
    bridge.log("render: " + str(proj.GetRenderJobStatus(jid)))
    cands = sorted(glob.glob(os.path.join(work, "svb_master_audio*.wav")))
    if not cands:
        bridge.error("Ingen master-WAV rendret"); sys.exit(1)
    wav = cands[-1]
    durs = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
           "format=duration", "-of", "csv=p=0", wav], text=True))
    frames = round(durs * fps)

    proj.SetCurrentTimeline(newtl)
    mp.SetCurrentFolder(mp.GetRootFolder())
    m = (mp.ImportMedia([wav]) or [None])[0]
    allau = []
    for tr in range(1, int(newtl.GetTrackCount("audio")) + 1):
        allau += (newtl.GetItemListInTrack("audio", tr) or [])
    if allau:
        newtl.DeleteClips(allau, False)
    mp.AppendToTimeline([{"mediaPoolItem": m, "startFrame": 0, "endFrame": frames - 1, "mediaType": 2,
                          "trackIndex": 1, "recordFrame": int(newtl.GetStartFrame())}])
    its = newtl.GetItemListInTrack("audio", 1) or []
    bridge.result({"wav": wav, "durationSec": round(durs, 2), "frames": frames,
                   "a1Clips": len(its),
                   "note": "Master-lyd på A1 (eksakt godkjent miks). Stems finnes i referanse-timelinen. Kjør STEG 7."})


if __name__ == "__main__":
    bridge.main_guard(run)
