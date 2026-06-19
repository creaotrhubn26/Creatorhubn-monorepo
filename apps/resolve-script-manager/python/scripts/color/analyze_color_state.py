"""Analyze Color State — avgjør om kilden er ALLEREDE GRADET (Rec709) eller LOG/HDR,
så color-steget velger riktig vei:
  - graded  → kun justeringer (eksponering etc.), INGEN look/LUT/CST
  - log     → les metadata for hvilken log → CST (log→Rec709) FØR justering
  - hdr     → tonemap (PQ/HLG → Rec709) via CST

Detektering:
  1. Metadata (ffprobe): color_space/transfer/primaries + camera/gamma-tags.
  2. Bilde-statistikk (signalstats): YMIN/YMAX (kontrast-range) + SATAVG. Log =
     løftede blacks + cappet whites (lav kontrast) + lav metning.

Input:  videoPath [required]
Output: { state, colorSpace, transfer, contrast, satAvg, recommendation, cstInput }
"""
from __future__ import annotations
import os, re, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

FF = next((p for p in ("/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "ffmpeg")
           if os.path.isfile(p) or p == "ffmpeg"), "ffmpeg")
FP = FF.replace("ffmpeg", "ffprobe")

# kjente log/HDR transfer-karakteristikker → CST-input
TRANSFER_CST = {
    "arib-std-b67": "HLG (Rec.2100 HLG)", "smpte2084": "PQ (Rec.2100 PQ)",
}
CAMERA_LOG_HINTS = {  # tekst i metadata → sannsynlig log
    "slog": "Sony S-Log3 / S-Gamut3.Cine", "s-log": "Sony S-Log3 / S-Gamut3.Cine",
    "vlog": "Panasonic V-Log / V-Gamut", "v-log": "Panasonic V-Log / V-Gamut",
    "clog": "Canon C-Log3 / Cinema Gamut", "c-log": "Canon C-Log3 / Cinema Gamut",
    "log-c": "ARRI LogC", "logc": "ARRI LogC", "f-log": "Fujifilm F-Log",
    "n-log": "Nikon N-Log", "redlog": "RED Log3G10 / REDWideGamut",
}


def probe(video):
    out = subprocess.run([FP, "-v", "error", "-select_streams", "v:0",
                          "-show_entries", "stream=color_space,color_transfer,color_primaries,color_range,pix_fmt:format_tags:stream_tags",
                          "-of", "default=noprint_wrappers=1"], capture_output=True, text=True, timeout=30).stdout
    d = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1); d[k.strip().lower()] = v.strip()
    return d, out.lower()


def stats(video):
    ys, ymins, ymaxs, sats = [], [], [], []
    for ts in (600, 1800, 3300):
        r = subprocess.run([FF, "-nostats", "-hide_banner", "-ss", str(ts), "-t", "2", "-i", video,
                            "-vf", "signalstats,metadata=print:key=lavfi.signalstats.YMIN:key=lavfi.signalstats.YMAX:key=lavfi.signalstats.YAVG:key=lavfi.signalstats.SATAVG",
                            "-f", "null", "-"], capture_output=True, text=True, timeout=40).stderr
        def avg(key, lst):
            v = [float(m) for m in re.findall(rf"{key}=([\d.]+)", r)]
            if v: lst.append(sum(v) / len(v))
        avg("YMIN", ymins); avg("YMAX", ymaxs); avg("YAVG", ys); avg("SATAVG", sats)
    f = lambda l: round(sum(l) / len(l), 1) if l else None
    return f(ymins), f(ymaxs), f(ys), f(sats)


def _current_timeline_source() -> str | None:
    """Fallback: hent kilde-filsti fra første klipp på aktiv Resolve-timeline."""
    try:
        conn = bridge.ResolveConnection()
        if not conn.connect() or not conn.require_project():
            return None
        tl = conn.project.GetCurrentTimeline()
        items = tl.GetItemListInTrack("video", 1) or []
        return items[0].GetMediaPoolItem().GetClipProperty("File Path")
    except Exception:
        return None


def run(params: dict, dry_run: bool) -> None:
    video = (params.get("videoPath") or "").strip()
    if not video or not os.path.isfile(video):
        # ingen sti → prøv aktiv timeline (veiviseren kaller uten path)
        video = _current_timeline_source() or ""
    if not video or not os.path.isfile(video):
        bridge.error("Fant ingen video — gi videoPath eller ha en aktiv timeline."); sys.exit(1)
    meta, raw = probe(video)
    transfer = meta.get("color_transfer", "unknown")
    cspace = meta.get("color_space", "unknown")
    ymin, ymax, yavg, sat = stats(video)
    contrast = (ymax - ymin) if (ymin is not None and ymax is not None) else None

    state, rec, cst = "graded", "Allerede gradet (Rec709) → kun justeringer (ingen look/CST).", None
    # HDR?
    if transfer in TRANSFER_CST:
        state = "hdr"; cst = TRANSFER_CST[transfer]
        rec = f"HDR ({cst}) → CST/tonemap til Rec709 før justering."
    else:
        # log via kamera/gamma-tags i metadata?
        for hint, name in CAMERA_LOG_HINTS.items():
            if hint in raw:
                state = "log"; cst = name
                rec = f"Log oppdaget ({name}) → CST log→Rec709 før justering."; break
        # log via statistikk-signatur (løftede blacks + lav kontrast + lav metning)
        if state == "graded" and contrast is not None and sat is not None:
            if ymin and ymin > 45 and contrast < 130 and sat < 9:
                state = "log"
                rec = ("Ser LOG ut (løftede blacks, lav kontrast, lav metning), men ingen "
                       "kamera/log-tag i metadata → sett CST-input manuelt (S-Log3/V-Log/LogC/…).")
                cst = cst or "ukjent log — angi kamera"

    bridge.result({"state": state, "colorSpace": cspace, "transfer": transfer,
                   "range": meta.get("color_range"), "pixFmt": meta.get("pix_fmt"),
                   "YMIN": ymin, "YMAX": ymax, "YAVG": yavg, "contrast": contrast, "satAvg": sat,
                   "recommendation": rec, "cstInput": cst,
                   "action": "adjust" if state == "graded" else "cst+adjust"})


if __name__ == "__main__":
    bridge.main_guard(run)
