"""Analyze Timeline Scopes — per V1-timeline-klipp: ekstraher klippets EGET kilde-segment
og mål ekte scope-verdier med ÉN ffmpeg-pass.

For hvert klipp på V<trackIndex>:
  1. Finn kilde-fil (GetMediaPoolItem → File Path) og kilde-in (GetSourceStartFrame / kilde-fps).
  2. Ekstraher `sampleSec` fra klippets eget segment via ffmpeg `-ss <kilde-tid>`.
  3. Mål med ETT ffmpeg-pass (filter_complex):
       - signalstats på native frame → YAVG/YMAX/UAVG/VAVG/SATMAX (luma/chroma/vectorscope)
       - extractplanes=r+g+b (etter format=gbrp) → per-kanal YMAX = EKTE RGB-parade-topper (R/G/B-max)
  4. Sett flags: under/over (eksponering), redClip/greenClip/blueClip (per-kanal parade-klipp),
     cast (WB-avvik fra U/V), oversat (vectorscope-radius).

IRE = (yavg - 16) * 100 / 219. redClip = rmax >= 253 (per-kanal klipp luma-YMAX bommer på).

Returnerer { clips:[{index, timeline, sourceTC, yavg, ire, ymax, rmax, gmax, bmax,
  uavg, vavg, satmax, flags:[...]}], summary }.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


def find_ffmpeg() -> str | None:
    for candidate in (
        os.environ.get("RESOLVE_SCRIPT_MANAGER_FFMPEG"),
        shutil.which("ffmpeg"),
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
    ):
        if candidate and os.path.isfile(candidate):
            return candidate
    return None


def yavg_to_ire(yavg: float) -> float:
    return max(0.0, (yavg - 16) * 100 / 219)


def measure_parade_and_luma(ffmpeg: str, path: str, start: float, dur: float) -> dict | None:
    """EKTE per-kanal RGB-max (parade) + luma/chroma fra et kilde-segment, ett ffmpeg-pass.

    [0:v] split → [base]=native signalstats (Y/U/V/SAT), [rgb]=format=gbrp,extractplanes=r+g+b
    → signalstats på hvert plan der planens YMAX = den kanalens maks-nivå (0-255 parade-topp).
    Hvert plan skriver til EGEN fil (ellers interleaver de tre YMAX-strømmene uleselig).
    """
    d = tempfile.mkdtemp(prefix="scope_")
    yuv = os.path.join(d, "yuv.txt")
    rf, gf, bf = (os.path.join(d, f"{c}.txt") for c in ("r", "g", "b"))
    fc = (
        "[0:v]split=2[base][rgb];"
        f"[base]signalstats,metadata=print:file={yuv}[yuvn];"
        "[rgb]format=gbrp,extractplanes=r+g+b[r][g][b];"
        f"[r]signalstats,metadata=print:key=lavfi.signalstats.YMAX:file={rf}[rn];"
        f"[g]signalstats,metadata=print:key=lavfi.signalstats.YMAX:file={gf}[gn];"
        f"[b]signalstats,metadata=print:key=lavfi.signalstats.YMAX:file={bf}[bn]"
    )
    cmd = [
        ffmpeg, "-nostats", "-hide_banner",
        "-ss", str(max(0.0, start)), "-t", str(dur), "-i", path,
        "-filter_complex", fc,
        "-map", "[yuvn]", "-map", "[rn]", "-map", "[gn]", "-map", "[bn]",
        "-f", "null", "-",
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    except subprocess.TimeoutExpired:
        _cleanup(d, (yuv, rf, gf, bf))
        return None
    except Exception:
        _cleanup(d, (yuv, rf, gf, bf))
        return None

    def read_vals(fp: str, key: str) -> list[float]:
        try:
            with open(fp) as fh:
                txt = fh.read()
        except OSError:
            return []
        return [float(m) for m in re.findall(rf"{key}=([\d.]+)", txt)]

    def peak(vals):
        return max(vals) if vals else None

    def mean(vals):
        return (sum(vals) / len(vals)) if vals else None

    yvals = read_vals(yuv, "YAVG")
    if not yvals:  # samme guard som measure_yavg — uten luma-data har vi ingenting
        _cleanup(d, (yuv, rf, gf, bf))
        return None

    out = {
        # per-kanal RGB-max = parade-toppene (rød-klipp: rmax≈255 mens gmax/bmax lavere)
        "rmax": peak(read_vals(rf, "lavfi.signalstats.YMAX")),
        "gmax": peak(read_vals(gf, "lavfi.signalstats.YMAX")),
        "bmax": peak(read_vals(bf, "lavfi.signalstats.YMAX")),
        # luma/chroma — samme tall scopes viser
        "yavg": mean(yvals),
        "ymax": peak(read_vals(yuv, "YMAX")),
        "uavg": mean(read_vals(yuv, "UAVG")),
        "vavg": mean(read_vals(yuv, "VAVG")),
        "satmax": peak(read_vals(yuv, "SATMAX")),
    }
    _cleanup(d, (yuv, rf, gf, bf))
    return out


def _cleanup(d: str, files) -> None:
    for fp in files:
        try:
            os.remove(fp)
        except OSError:
            pass
    try:
        os.rmdir(d)
    except OSError:
        pass


def _source_fps(item, mpi, tl_fps: float) -> float:
    """Kilde-fps med fallback til timeline-fps (kontrakt default 50fps via tl_fps=50)."""
    if mpi is not None:
        try:
            fps = float(mpi.GetClipProperty("FPS") or 0)
            if fps > 0:
                return fps
        except Exception:
            pass
    return tl_fps if tl_fps and tl_fps > 0 else 50.0


def _format_tc(sec: float) -> str:
    sec = max(0.0, sec)
    h = int(sec // 3600)
    m = int((sec % 3600) // 60)
    s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def compute_flags(m: dict) -> list[str]:
    """Sett scope-flags fra målingen. Terskler valgt for å speile Resolve-scope-tolkning."""
    flags: list[str] = []
    yavg = m.get("yavg") or 0.0
    ymax = m.get("ymax") or 0.0
    rmax = m.get("rmax")
    gmax = m.get("gmax")
    bmax = m.get("bmax")
    uavg = m.get("uavg")
    vavg = m.get("vavg")
    satmax = m.get("satmax") or 0.0

    ire = yavg_to_ire(yavg)
    # EKSPONERING (histogram/waveform)
    if ire < 25.0:
        flags.append("under")
    if ymax >= 253.0 or ire > 82.0:
        flags.append("over")
    # PER-KANAL PARADE-KLIPP (RGB-parade) — det luma-YMAX alene ikke fanger
    if rmax is not None and rmax >= 253.0:
        flags.append("redClip")
    if gmax is not None and gmax >= 253.0:
        flags.append("greenClip")
    if bmax is not None and bmax >= 253.0:
        flags.append("blueClip")
    # HVITBALANSE-CAST (parade/U-V-avvik fra nøytral 128)
    cast = 0.0
    if uavg is not None:
        cast = max(cast, abs(uavg - 128.0))
    if vavg is not None:
        cast = max(cast, abs(vavg - 128.0))
    if cast > 18.0:
        flags.append("cast")
    # OVERSATURASJON (vectorscope-radius)
    if satmax > 200.0:
        flags.append("oversat")
    return flags


def run(params: dict, dry_run: bool) -> None:
    timeline_name = params.get("timelineName")
    track_index = int(params.get("trackIndex", 1))
    sample_sec = float(params.get("sampleSec", 2))

    if dry_run:
        bridge.result({
            "summary": (
                f"Dry run — mål scopes per klipp på V{track_index} "
                f"({sample_sec}s fra hvert klipps kilde-segment)"
            ),
            "method": "ffmpeg signalstats + extractplanes=r+g+b (ekte RGB-parade), ett pass per klipp",
            "trackIndex": track_index,
            "sampleSec": sample_sec,
        })
        return

    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        bridge.error("ffmpeg not found")
        sys.exit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = None
    if timeline_name:
        try:
            count = int(conn.project.GetTimelineCount() or 0)
            for i in range(1, count + 1):
                tl = conn.project.GetTimelineByIndex(i)
                if tl and tl.GetName() == timeline_name:
                    timeline = tl
                    break
        except Exception:
            timeline = None
        if timeline is None:
            bridge.error(f"Timeline '{timeline_name}' not found")
            sys.exit(1)
    else:
        timeline = conn.project.GetCurrentTimeline()

    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    tl_name = ""
    try:
        tl_name = timeline.GetName() or ""
    except Exception:
        pass

    tl_fps = 50.0
    try:
        tl_fps = float(timeline.GetSetting("timelineFrameRate") or 50.0)
    except Exception:
        tl_fps = 50.0

    items = timeline.GetItemListInTrack("video", track_index) or []
    total = len(items)
    bridge.log(f"Analyserer scopes for {total} klipp på V{track_index} (kilde-fps fallback {tl_fps})")

    clips: list[dict] = []
    measure_failures = 0
    flag_counts: dict[str, int] = {}

    for idx, item in enumerate(items):
        try:
            name = ""
            try:
                name = item.GetName() or ""
            except Exception:
                name = ""

            mpi = item.GetMediaPoolItem() if hasattr(item, "GetMediaPoolItem") else None
            src_path = ""
            if mpi is not None:
                try:
                    src_path = mpi.GetClipProperty("File Path") or ""
                except Exception:
                    src_path = ""

            if not src_path or not os.path.isfile(src_path):
                clips.append({
                    "index": idx + 1,
                    "timeline": tl_name,
                    "name": name,
                    "skipped": True,
                    "reason": "no source file" if not src_path else "source file missing on disk",
                })
                bridge.progress(idx + 1, total, f"{idx + 1}/{total}")
                continue

            src_fps = _source_fps(item, mpi, tl_fps)
            try:
                src_start_frame = int(item.GetSourceStartFrame() or 0)
            except Exception:
                src_start_frame = 0
            src_start_sec = src_start_frame / src_fps if src_fps else 0.0
            source_tc = _format_tc(src_start_sec)

            m = measure_parade_and_luma(ffmpeg, src_path, src_start_sec, sample_sec)
            if m is None:
                measure_failures += 1
                clips.append({
                    "index": idx + 1,
                    "timeline": tl_name,
                    "name": name,
                    "sourceTC": source_tc,
                    "skipped": True,
                    "reason": "measurement failed",
                })
                bridge.progress(idx + 1, total, f"{idx + 1}/{total}")
                continue

            flags = compute_flags(m)
            for f in flags:
                flag_counts[f] = flag_counts.get(f, 0) + 1

            def r(v, nd=1):
                return round(v, nd) if isinstance(v, (int, float)) else None

            clips.append({
                "index": idx + 1,
                "timeline": tl_name,
                "name": name,
                "sourceTC": source_tc,
                "yavg": r(m.get("yavg")),
                "ire": r(yavg_to_ire(m.get("yavg") or 0.0)),
                "ymax": r(m.get("ymax"), 0),
                "rmax": r(m.get("rmax"), 0),
                "gmax": r(m.get("gmax"), 0),
                "bmax": r(m.get("bmax"), 0),
                "uavg": r(m.get("uavg"), 0),
                "vavg": r(m.get("vavg"), 0),
                "satmax": r(m.get("satmax"), 0),
                "flags": flags,
            })
        except Exception as exc:
            measure_failures += 1
            clips.append({
                "index": idx + 1,
                "timeline": tl_name,
                "skipped": True,
                "reason": f"error: {exc}",
            })

        bridge.progress(idx + 1, total, f"{idx + 1}/{total}")

    measured = [c for c in clips if not c.get("skipped")]
    flagged = [c for c in measured if c.get("flags")]

    bridge.result({
        "clips": clips,
        "summary": {
            "timeline": tl_name,
            "trackIndex": track_index,
            "sampleSec": sample_sec,
            "totalClips": total,
            "measured": len(measured),
            "flagged": len(flagged),
            "measureFailures": measure_failures,
            "flagCounts": flag_counts,
            "scopesNote": (
                "Y*=histogram/waveform · RGB-max=parade (per-kanal klipp) · "
                "U/V=parade/WB-cast · SAT=vectorscope"
            ),
        },
    })


if __name__ == "__main__":
    bridge.main_guard(run)
