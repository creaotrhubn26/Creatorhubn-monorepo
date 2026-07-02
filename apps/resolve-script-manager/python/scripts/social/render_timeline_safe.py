"""
Render-vakt + ett-klikks full-render.

Lærdom (PetKey SoMe): å bygge leveransen utenfor timelinen (stem + separat
master + re-mux) driver sync og mister menneskets manuelle fikser. Riktig
metode er å rendre HELE timelinen i én pass — da er lyden nøyaktig den
menneske-synkede miksen og undertekstene den menneske-rettede teksten.

To feller som bet oss, som denne vakta fanger FØR render:
  - `Audio Only`-preset satt seg fast fra en tidligere stem-render → kom bare lyd.
  - codec sto på `APVYUV422_10` (data-strøm) → ffprobe leste «data», ikke video.

Modus:
  check_only=true  → rapporter kun om gjeldende oppsett gir gyldig video (ingen render).
  ellers           → last video-preset, sett mp4/H264, render HELE timeline fra
                     start til slutt (SelectAllFrames), verifiser output med ffprobe.

params: { check_only?(false), preset?("TikTok - 1080p"), format?("mp4"),
          codec?("H264"), out_dir?, name?, verify?(true) }
result: { ok, out_path?, duration_s?, has_video, has_audio, width?, height?,
          format, codec, fixes[], warnings[], timeline }
"""
from __future__ import annotations
import os, sys, glob, time, json, subprocess, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

# codecs som IKKE gir en normal, delbar h264/h265-video for review
BAD_CODECS = {"APVYUV422_10", "APVYUV422_12", "RGB", "YUV422P10", "DNxHR444"}
VIDEO_PRESETS = ["TikTok - 1080p", "YouTube - 1080p", "H.264 Master", "Vimeo - 1080p"]


def _probe(path):
    """→ (has_video, has_audio, dur, w, h) via ffprobe."""
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries",
             "format=duration:stream=codec_type,codec_name,width,height",
             "-of", "json", path],
            capture_output=True, text=True).stdout
        d = json.loads(out or "{}")
        vs = [s for s in d.get("streams", []) if s.get("codec_type") == "video"
              and s.get("codec_name") not in (None, "unknown")]
        aus = [s for s in d.get("streams", []) if s.get("codec_type") == "audio"]
        dur = float(d.get("format", {}).get("duration", 0) or 0)
        w = vs[0].get("width") if vs else None
        h = vs[0].get("height") if vs else None
        return bool(vs), bool(aus), dur, w, h
    except Exception:
        return False, False, 0.0, None, None


def run(params: dict) -> None:
    bridge.reexec_in_venv_if_present()
    check_only = bool(params.get("check_only", False))
    preset = params.get("preset") or "TikTok - 1080p"
    fmt = params.get("format") or "mp4"
    codec = params.get("codec") or "H264"
    verify = params.get("verify", True)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        bridge.error("Ingen Resolve-prosjekt"); sys.exit(1)
    pr = conn.project
    tl = pr.GetCurrentTimeline()
    if not tl:
        bridge.error("Ingen åpen timeline"); sys.exit(1)
    pr.SetCurrentTimeline(tl)
    tlname = tl.GetName()

    fixes, warnings = [], []
    fc = pr.GetCurrentRenderFormatAndCodec() or {}
    cur_fmt, cur_codec = fc.get("format"), fc.get("codec")
    bridge.log(f"Timeline «{tlname}» · gjeldende render: {cur_fmt}/{cur_codec}")

    # --- diagnose ---
    if cur_codec in BAD_CODECS:
        warnings.append(f"Codec «{cur_codec}» gir en data-strøm, ikke normal video "
                        f"(ffprobe leser «data»). Bør være H264.")
    # last preset-lista for å se om 'Audio Only' står som aktivt
    presets = pr.GetRenderPresetList() or []
    if "Audio Only" not in [preset] and cur_codec is None:
        warnings.append("Render-formatet kan stå på «Audio Only» → kun lyd, ingen video.")

    if check_only:
        would_ok = cur_codec not in BAD_CODECS and cur_codec is not None
        bridge.result({
            "ok": would_ok, "has_video": would_ok, "has_audio": True,
            "format": cur_fmt, "codec": cur_codec, "fixes": [],
            "warnings": warnings, "timeline": tlname,
            "presets_available": [p for p in VIDEO_PRESETS if p in presets],
        })
        return

    # --- fiks + render HELE timeline ---
    out_dir = params.get("out_dir") or tempfile.mkdtemp(prefix="fullrender_")
    os.makedirs(out_dir, exist_ok=True)
    name = params.get("name") or (tlname.replace(" ", "_").replace("/", "-") + "_full")

    pr.DeleteAllRenderJobs()
    if preset in presets:
        if pr.LoadRenderPreset(preset):
            fixes.append(f"Lastet video-preset «{preset}»")
        else:
            warnings.append(f"Kunne ikke laste preset «{preset}»")
    else:
        # fallback: første tilgjengelige video-preset
        for p in VIDEO_PRESETS:
            if p in presets and pr.LoadRenderPreset(p):
                preset = p; fixes.append(f"Lastet video-preset «{p}»"); break

    if pr.SetCurrentRenderFormatAndCodec(fmt, codec):
        if cur_codec != codec or cur_fmt != fmt:
            fixes.append(f"Satte format/codec {fmt}/{codec} (var {cur_fmt}/{cur_codec})")
    pr.SetRenderSettings({
        "TargetDir": out_dir, "CustomName": name,
        "SelectAllFrames": True,          # HELE timeline, start→slutt
        "ExportVideo": True, "ExportAudio": True,
    })
    fixes.append("SelectAllFrames=True → hele timelinen fra start til slutt")

    jid = pr.AddRenderJob()
    bridge.log(f"Rendrer hele «{tlname}» i én pass …")
    pr.StartRendering(jid)
    t0 = time.time()
    while pr.IsRenderingInProgress() and time.time() - t0 < 900:
        time.sleep(3)
    time.sleep(1)

    fs = sorted(glob.glob(f"{out_dir}/{name}*"))
    if not fs:
        bridge.error("Render produserte ingen fil"); sys.exit(1)
    out_path = fs[0]

    has_v, has_a, dur, w, h = _probe(out_path) if verify else (True, True, 0, None, None)
    ok = has_v and has_a
    if verify and not has_v:
        warnings.append("Output mangler videostrøm — sjekk format/codec (kjør på nytt).")
    bridge.log(f"Ferdig: {os.path.basename(out_path)} · {dur:.2f}s · "
               f"{'video✓' if has_v else 'INGEN VIDEO'} {'lyd✓' if has_a else 'ingen lyd'}")

    bridge.result({
        "ok": ok, "out_path": out_path, "duration_s": round(dur, 2),
        "has_video": has_v, "has_audio": has_a, "width": w, "height": h,
        "format": fmt, "codec": codec, "fixes": fixes, "warnings": warnings,
        "timeline": tlname,
    })


if __name__ == "__main__":
    try:
        run(bridge.load_params())
    except Exception as e:
        bridge.error(str(e)); sys.exit(1)
