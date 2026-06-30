"""Lip-sync sjekk — bevis-klipp for kunde. To moduser:
  mode="render": render in/out-området fra timeline + waveform-strip → proof_<label>_wave.mp4
  mode="combine": sett sammen før+etter (rød/grønn ramme) → proof_before_after.mp4
Brukes til å vise kunden FØR (med feil) → ETTER (fikset). Params: timelineName, mode, label,
outDir, beforePath, afterPath, useInOut."""
from __future__ import annotations
import os, sys, time, glob, shutil, subprocess
from typing import Any
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

def _ffmpeg():
    return (shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg" if os.path.exists("/opt/homebrew/bin/ffmpeg")
            else shutil.which("ffmpeg") or "/usr/local/bin/ffmpeg")

def run(params: dict[str, Any], dry_run: bool) -> None:
    mode = (params.get("mode") or "render").lower()
    outdir = (params.get("outDir") or os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/lipsync_proof")).strip()
    os.makedirs(outdir, exist_ok=True)
    FF = _ffmpeg()

    if mode == "combine":
        before = (params.get("beforePath") or "").strip(); after = (params.get("afterPath") or "").strip()
        if not (before and after and os.path.isfile(before) and os.path.isfile(after)):
            bridge.error("Mangler beforePath/afterPath (begge må finnes)"); sys.exit(1)
        out = os.path.join(outdir, "proof_before_after.mp4")
        vf = ("[0:v]drawbox=x=0:y=0:w=iw:h=ih:color=red:t=14[bv];"
              "[1:v]drawbox=x=0:y=0:w=iw:h=ih:color=lime:t=14[av];"
              "[bv][0:a][av][1:a]concat=n=2:v=1:a=1[v][a]")
        r = subprocess.run([FF, "-y", "-v", "error", "-i", before, "-i", after, "-filter_complex", vf,
                            "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "veryfast",
                            "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", out], capture_output=True, text=True)
        if r.returncode != 0: bridge.error("ffmpeg combine feilet: " + r.stderr[-400:]); sys.exit(1)
        bridge.result({"mode": "combine", "proof": out,
                       "note": "Bevis klart: rød ramme = FØR (med feil), grønn = ETTER (fikset). Send til kunde."})
        return

    # mode render: render in/out fra timeline + waveform
    label = (params.get("label") or "before").strip()
    name = (params.get("timelineName") or "").strip()
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project(): sys.exit(1)
    res = conn.resolve; proj = conn.project
    tl = None
    if name:
        for i in range(1, proj.GetTimelineCount()+1):
            t = proj.GetTimelineByIndex(i)
            if t.GetName() == name: tl = t
    tl = tl or proj.GetCurrentTimeline()
    if not tl: bridge.error("Ingen timeline"); sys.exit(1)
    proj.SetCurrentTimeline(tl)
    start = int(tl.GetStartFrame())
    mio = None
    try: mio = tl.GetMarkInOut()
    except Exception: pass
    v = (mio or {}).get("video") or (mio or {}).get("audio")
    if not v: bridge.error("Sett in (I) og out (O) i Resolve rundt området først."); sys.exit(1)
    IN, OUT = start + int(v["in"]), start + int(v["out"])
    res.OpenPage("deliver")
    proj.SetCurrentRenderFormatAndCodec("mp4", "H264")
    raw = f"proof_{label}_RAW"
    proj.SetRenderSettings({"TargetDir": outdir, "CustomName": raw, "MarkIn": IN, "MarkOut": OUT,
        "SelectAllFrames": False, "ExportVideo": True, "ExportAudio": True,
        "FormatWidth": 960, "FormatHeight": 540})
    jid = proj.AddRenderJob(); proj.StartRendering([jid])
    for _ in range(300):
        if not proj.IsRenderingInProgress(): break
        time.sleep(1)
    cands = sorted(glob.glob(os.path.join(outdir, raw + "*")))
    if not cands: bridge.error("Render produserte ingen fil"); sys.exit(1)
    rawf = cands[-1]
    out = os.path.join(outdir, f"proof_{label}_wave.mp4")
    vf = ("[0:v]scale=960:-2,setsar=1[v];[0:a]aformat=channel_layouts=mono,"
          "showwaves=s=960x120:mode=cline:rate=25:colors=0x00ff88[w];[v][w]vstack[outv]")
    r = subprocess.run([FF, "-y", "-v", "error", "-i", rawf, "-filter_complex", vf, "-map", "[outv]",
                        "-map", "0:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
                        "-c:a", "aac", "-movflags", "+faststart", out], capture_output=True, text=True)
    if r.returncode != 0: bridge.error("ffmpeg waveform feilet: " + r.stderr[-400:]); sys.exit(1)
    bridge.result({"mode": "render", "label": label, "clip": out,
                   "regionSec": [round((IN-start)/25, 1), round((OUT-start)/25, 1)],
                   "note": f"'{label}'-bevis rendret. Kjør FØR før du fikser, ETTER etterpå, så 'Sett sammen'."})

if __name__ == "__main__":
    bridge.main_guard(run)
