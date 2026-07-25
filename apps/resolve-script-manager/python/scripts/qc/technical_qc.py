"""Teknisk QC — full kontroll av media, timeline, subtitles, farge og leveranse.

Modi:
  sweep     (rask, ingen dekoding) Media pool: offline media (fil borte),
            media fra midlertidige mapper (/tmp, Downloads, Desktop, Trash),
            fps-avvik mot timeline, oppløsnings-miks, manglende proxy (kun
            når prosjektet HAR proxy-arbeidsflyt), lydkanal-avvikere.
            Timeline: flash-frames (<3 frames), svært korte klipp (<0.5s),
            udekkede hull (union av ALLE videospor). Subtitles: tomme,
            overlappende, overflow (>25 tegn/sek el. >100 tegn).
            markers=true → Cream-markører på tidskode-funn.
  color     (tregere) Nodegraf-sveip over timeline-items (maxItems=150):
            LUT satt men fila mangler i LUT-mappene, items uten grade
            (0 noder). Ren lesing.
  delivery  Render-kø + gjeldende render-innstillinger; med deliverySpec-
            JSON ({fps, width, height, formats:[], namePattern}) valideres
            hver jobb mot standarden.
  audiopeak (opt-in, dekoder) ffmpeg astats på inntil maxFiles=15 brukte
            lydkilder → 0.0 dBFS-peak = klipping-kandidat.

Ikke mulig via API (rapporteres som «manuell sjekk»): Fusion-comp-FEIL,
render-cache-feil, optimized media-status.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402

TEMP_PATTERNS = re.compile(r"/(tmp|private/tmp|var/folders|Downloads|Desktop|\.Trash)/", re.I)
LUT_DIRS = [
    "/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT",
    os.path.expanduser("~/Library/Application Support/Blackmagic Design/DaVinci Resolve/LUT"),
]


def _tc(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def _walk_clips(root):
    out = []

    def walk(folder):
        for c in folder.GetClipList() or []:
            out.append(c)
        for sub in folder.GetSubFolderList() or []:
            walk(sub)

    walk(root)
    return out


def _prop(clip, key, default=""):
    try:
        return clip.GetClipProperty(key) or default
    except Exception:
        return default


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
    tl_start = int(timeline.GetStartFrame() or 0)
    mode = (params.get("mode") or "sweep").strip().lower()

    # ── sweep ──
    if mode == "sweep":
        want_markers = str(params.get("markers", "")).lower() in ("true", "1", "yes")
        findings: dict[str, list] = {
            "offline": [], "tempMedia": [], "fpsMismatch": [], "resolutionMix": [],
            "missingProxy": [], "audioOutliers": [], "flashFrames": [], "shortClips": [],
            "coverageGaps": [], "subtitleEmpty": [], "subtitleOverlap": [], "subtitleOverflow": [],
        }
        tl_res = (timeline.GetSetting("timelineResolutionWidth") or "?",
                  timeline.GetSetting("timelineResolutionHeight") or "?")

        IMAGE_EXT = (".jpg", ".jpeg", ".png", ".tif", ".tiff", ".dng", ".heic", ".webp")
        clips = [c for c in _walk_clips(conn.media_pool.GetRootFolder())
                 if "video" in _prop(c, "Type").lower() or _prop(c, "FPS")]
        res_counts: dict[str, int] = {}
        ch_counts: dict[str, int] = {}
        proxies_seen = 0
        for c in clips:
            name = c.GetName() or "?"
            fpath = _prop(c, "File Path")
            # ekte VIDEO = har både oppløsning og fps og er ikke stillbilde —
            # mp3-er/thumbnails skal ikke støye i fps-/oppløsnings-sjekkene
            is_video = bool(_prop(c, "Resolution")) and bool(_prop(c, "FPS")) \
                and not (fpath or "").lower().endswith(IMAGE_EXT)
            if fpath and not os.path.isfile(fpath):
                findings["offline"].append({"clip": name, "path": fpath})
            if fpath and TEMP_PATTERNS.search(fpath):
                findings["tempMedia"].append({"clip": name, "path": fpath})
            if not is_video:
                continue
            cfps = _prop(c, "FPS")
            try:
                ignore = params.get("ignorePattern")
                if cfps and abs(float(cfps) - fps) > 0.01 and abs(float(cfps) / 2 - fps) > 0.01 \
                        and not (ignore and re.search(ignore, name, re.I)):
                    findings["fpsMismatch"].append({"clip": name, "clipFps": cfps, "timelineFps": fps})
            except Exception:
                pass
            res = _prop(c, "Resolution")
            if res:
                res_counts[res] = res_counts.get(res, 0) + 1
            ch = _prop(c, "Audio Ch")
            if ch:
                ch_counts[str(ch)] = ch_counts.get(str(ch), 0) + 1
            proxy = _prop(c, "Proxy")
            if proxy and proxy.lower() not in ("none", ""):
                proxies_seen += 1
        # oppløsnings-miks: alle utenom dominerende
        if len(res_counts) > 1:
            dominant = max(res_counts, key=lambda k: res_counts[k])
            for res, n in sorted(res_counts.items(), key=lambda kv: -kv[1]):
                if res != dominant:
                    findings["resolutionMix"].append({"resolution": res, "clips": n,
                                                      "dominant": dominant})
        # proxy: kun relevant hvis arbeidsflyten HAR proxies
        if proxies_seen >= max(3, len(clips) // 10):
            for c in clips:
                if (_prop(c, "Proxy") or "none").lower() in ("none", ""):
                    findings["missingProxy"].append({"clip": c.GetName() or "?"})
        # lydkanal-avvikere: alt som ikke er majoriteten
        if len(ch_counts) > 1:
            dom = max(ch_counts, key=lambda k: ch_counts[k])
            findings["audioOutliers"] = [{"channels": k, "clips": n, "dominant": dom}
                                         for k, n in ch_counts.items() if k != dom]

        # timeline: korte klipp + dekning
        spans = []
        for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
            for it in timeline.GetItemListInTrack("video", t) or []:
                s, e = int(it.GetStart() or 0), int(it.GetEnd() or 0)
                spans.append((s, e))
                dur = e - s
                if dur < 3:
                    findings["flashFrames"].append({"tc": _tc(s, fps), "frames": dur,
                                                    "clip": (it.GetName() or "?")[:40], "frame": s})
                elif dur < fps * 0.5:
                    findings["shortClips"].append({"tc": _tc(s, fps), "sec": round(dur / fps, 2),
                                                   "clip": (it.GetName() or "?")[:40], "frame": s})
        if spans:
            spans.sort()
            cov_end = spans[0][1]
            for s, e in spans[1:]:
                if s > cov_end:
                    findings["coverageGaps"].append({"tc": _tc(cov_end, fps),
                                                     "sec": round((s - cov_end) / fps, 1),
                                                     "frame": cov_end})
                cov_end = max(cov_end, e)

        # subtitles
        for t in range(1, (timeline.GetTrackCount("subtitle") or 0) + 1):
            prev = None
            for it in timeline.GetItemListInTrack("subtitle", t) or []:
                s, e = int(it.GetStart() or 0), int(it.GetEnd() or 0)
                text = (it.GetName() or "").strip()
                if not text:
                    findings["subtitleEmpty"].append({"tc": _tc(s, fps), "frame": s})
                dur_sec = max(0.04, (e - s) / fps)
                if len(text) > 100 or len(text) / dur_sec > 25:
                    findings["subtitleOverflow"].append({"tc": _tc(s, fps), "frame": s,
                                                         "chars": len(text),
                                                         "charsPerSec": round(len(text) / dur_sec, 1)})
                if prev and s < prev[1]:
                    findings["subtitleOverlap"].append({"tc": _tc(s, fps), "frame": s})
                prev = (s, e)

        added = 0
        if want_markers and not dry_run:
            for cat in ("flashFrames", "coverageGaps", "subtitleEmpty",
                        "subtitleOverlap", "subtitleOverflow"):
                for f in findings[cat][:40]:
                    try:
                        if timeline.AddMarker(max(0, f["frame"] - tl_start), "Cream",
                                              f"QC: {cat}", str({k: v for k, v in f.items()
                                                                if k != "frame"}), 1):
                            added += 1
                    except Exception:
                        pass
        counts = {k: len(v) for k, v in findings.items()}
        bridge.result({"mode": mode, "timeline": timeline.GetName(),
                       "timelineRes": f"{tl_res[0]}x{tl_res[1]}", "fps": fps,
                       "clipsScanned": len(clips), "counts": counts,
                       "findings": {k: v[:50] for k, v in findings.items()},
                       "manualChecks": ["Fusion-comp-feil", "render-cache-feil",
                                        "optimized media-status"],
                       "markersAdded": added, "dryRun": dry_run})
        return

    # ── color: LUT + ugraderte items ──
    if mode == "color":
        max_items = int(params.get("maxItems") or 150)
        lut_usage: dict[str, int] = {}
        ungraded = 0
        scanned = 0
        for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
            if scanned >= max_items:
                break
            for it in timeline.GetItemListInTrack("video", t) or []:
                if scanned >= max_items:
                    break
                scanned += 1
                try:
                    graph = it.GetNodeGraph()
                    n = int(graph.GetNumNodes() or 0) if graph else 0
                    if n == 0:
                        ungraded += 1
                        continue
                    for i in range(1, n + 1):
                        lut = graph.GetLUT(i)
                        if lut:
                            lut_usage[lut] = lut_usage.get(lut, 0) + 1
                except Exception:
                    continue
        # per UNIK lut: standard-mappe → ok; funnet annetsteds (Spotlight) →
        # skjørt (utenfor Resolve LUT-mappene, f.eks. iCloud); ellers borte.
        ok, fragile, missing = [], [], []
        for lut, uses in sorted(lut_usage.items(), key=lambda kv: -kv[1]):
            entry = {"lut": lut, "usedByNodes": uses}
            if any(os.path.isfile(os.path.join(d, lut)) or os.path.isfile(lut)
                   for d in LUT_DIRS):
                ok.append(entry)
                continue
            try:
                r = subprocess.run(["mdfind", "-name", os.path.basename(lut)],
                                   capture_output=True, text=True, timeout=15)
                hit = next((ln for ln in r.stdout.splitlines() if ln.strip()), "")
            except Exception:
                hit = ""
            if hit:
                entry["foundAt"] = hit
                entry["icloud"] = "Mobile Documents" in hit
                fragile.append(entry)
            else:
                missing.append(entry)
        bridge.result({"mode": mode, "itemsScanned": scanned, "capped": scanned >= max_items,
                       "ungradedItems": ungraded, "lutsOk": ok,
                       "lutsFragile": fragile, "lutsMissing": missing, "dryRun": dry_run})
        return

    # ── delivery: render-kø vs leveransestandard ──
    if mode == "delivery":
        import json as _json
        spec = params.get("deliverySpec")
        if isinstance(spec, str):
            try:
                spec = _json.loads(spec)
            except Exception:
                spec = None
        jobs = []
        try:
            jobs = project.GetRenderJobList() or []
        except Exception:
            pass
        cur_fmt = {}
        try:
            cur_fmt = project.GetCurrentRenderFormatAndCodec() or {}
        except Exception:
            pass
        issues = []
        job_infos = []
        for j in jobs[:20]:
            info = {k: j.get(k) for k in ("RenderJobName", "TimelineName", "OutputFilename",
                                          "FormatWidth", "FormatHeight", "FrameRate",
                                          "VideoFormat", "VideoCodec", "TargetDir") if k in j}
            job_infos.append(info)
            if spec:
                if spec.get("fps") and str(info.get("FrameRate")) not in (str(spec["fps"]), None):
                    issues.append(f"{info.get('RenderJobName')}: fps {info.get('FrameRate')} ≠ {spec['fps']}")
                if spec.get("width") and info.get("FormatWidth") not in (spec["width"], None):
                    issues.append(f"{info.get('RenderJobName')}: bredde {info.get('FormatWidth')} ≠ {spec['width']}")
                if spec.get("formats") and info.get("VideoFormat") and \
                        info["VideoFormat"] not in spec["formats"]:
                    issues.append(f"{info.get('RenderJobName')}: format {info['VideoFormat']} utenfor {spec['formats']}")
                if spec.get("namePattern") and info.get("OutputFilename") and \
                        not re.search(spec["namePattern"], info["OutputFilename"]):
                    issues.append(f"{info.get('RenderJobName')}: filnavn «{info['OutputFilename']}» bryter mønsteret")
        bridge.result({"mode": mode, "queueJobs": len(jobs), "jobs": job_infos,
                       "currentFormat": cur_fmt, "specIssues": issues,
                       "specApplied": bool(spec), "dryRun": dry_run})
        return

    # ── audiopeak (opt-in, dekoder) ──
    if mode == "audiopeak":
        max_files = int(params.get("maxFiles") or 15)
        ff = shutil.which("ffmpeg") or "/opt/homebrew/bin/ffmpeg"
        seen, results = set(), []
        for t in range(1, (timeline.GetTrackCount("audio") or 0) + 1):
            for it in timeline.GetItemListInTrack("audio", t) or []:
                if len(seen) >= max_files:
                    break
                try:
                    mpi = it.GetMediaPoolItem()
                    fpath = mpi.GetClipProperty("File Path") if mpi else ""
                except Exception:
                    continue
                if not fpath or fpath in seen or not os.path.isfile(fpath):
                    continue
                seen.add(fpath)
                r = subprocess.run([ff, "-v", "info", "-i", fpath, "-af",
                                    "astats=measure_overall=Peak_level:measure_perchannel=none",
                                    "-f", "null", "-"], capture_output=True, text=True, timeout=120)
                m = re.search(r"Peak level dB:\s*(-?[\d.]+|inf)", r.stderr)
                peak = m.group(1) if m else None
                if peak is not None:
                    clipped = peak in ("0.0", "-0.0", "inf") or (peak.replace("-", "").replace(".", "").isdigit() and float(peak) > -0.1)
                    results.append({"file": os.path.basename(fpath), "peakDb": peak,
                                    "clippedCandidate": clipped})
        bridge.result({"mode": mode, "filesChecked": len(results),
                       "clippedCandidates": [r for r in results if r["clippedCandidate"]],
                       "all": results, "dryRun": dry_run})
        return

    # ── FIX-modi ──────────────────────────────────────────────────────
    def _project_root(clips) -> str:
        """Dominant media-rot: mappen flertallet av tilkoblede klipp bor under."""
        from collections import Counter
        roots = Counter()
        for c in clips:
            fp = _prop(c, "File Path")
            if fp and os.path.isfile(fp):
                parts = fp.split("/")
                if len(parts) > 3:
                    roots["/".join(parts[:4])] += 1  # /Volumes/<disk>/<prosjekt>
        return roots.most_common(1)[0][0] if roots else ""

    def _mdfind(name: str) -> list[str]:
        try:
            r = subprocess.run(["mdfind", "-name", name], capture_output=True,
                               text=True, timeout=20)
            return [ln for ln in r.stdout.splitlines() if ln.strip()]
        except Exception:
            return []

    if mode == "relink":
        roots = [r.strip() for r in (params.get("searchRoots") or "").split(",") if r.strip()]
        clips = _walk_clips(conn.media_pool.GetRootFolder())
        if not roots:
            root = _project_root(clips)
            if root:
                roots = [root]
        plan, not_found = [], []
        for c in clips:
            fp = _prop(c, "File Path")
            if not fp or os.path.isfile(fp):
                continue
            base = os.path.basename(fp)
            hit = None
            for r in roots:  # kilde-/prosjektmappene først (veiviserens kunnskap)
                try:
                    res = subprocess.run(["find", r, "-name", base, "-maxdepth", "8"],
                                         capture_output=True, text=True, timeout=60)
                    hit = next((ln for ln in res.stdout.splitlines() if ln.strip()), None)
                except Exception:
                    hit = None
                if hit:
                    break
            if not hit:  # Spotlight-fallback (fant iCloud-LUT-en også)
                hits = [h for h in _mdfind(base) if os.path.basename(h) == base]
                hit = hits[0] if hits else None
            if hit:
                plan.append({"clip": c.GetName() or "?", "oldPath": fp, "newPath": hit,
                             "_c": c})
            else:
                not_found.append({"clip": c.GetName() or "?", "path": fp})
        report = {"mode": mode, "searchRoots": roots,
                  "planned": [{k: v for k, v in p.items() if k != "_c"} for p in plan],
                  "notFound": not_found, "relinked": 0, "dryRun": dry_run}
        if not dry_run:
            for p in plan:
                try:
                    if p["_c"].ReplaceClip(p["newPath"]):
                        report["relinked"] += 1
                except Exception:
                    pass
        bridge.result(report)
        return

    if mode == "consolidate":
        target = (params.get("targetDir") or "").strip()
        clips = _walk_clips(conn.media_pool.GetRootFolder())
        if not target:
            root = _project_root(clips)
            if not root:
                bridge.error("Fant ikke prosjektrot — oppgi targetDir.")
                return
            target = os.path.join(root, "Konsolidert")
        plan = []
        for c in clips:
            fp = _prop(c, "File Path")
            if fp and os.path.isfile(fp) and TEMP_PATTERNS.search(fp):
                plan.append({"clip": c.GetName() or "?", "from": fp,
                             "to": os.path.join(target, os.path.basename(fp)), "_c": c})
        report = {"mode": mode, "targetDir": target,
                  "planned": [{k: v for k, v in p.items() if k != "_c"} for p in plan],
                  "consolidated": 0, "dryRun": dry_run}
        if not dry_run and plan:
            os.makedirs(target, exist_ok=True)
            for p in plan:
                try:
                    if not os.path.isfile(p["to"]):
                        shutil.copy2(p["from"], p["to"])
                    if p["_c"].ReplaceClip(p["to"]):
                        report["consolidated"] += 1
                except Exception:
                    pass
        bridge.result(report)
        return

    if mode == "fixflash":
        max_frames = int(params.get("maxFrames") or 3)
        doomed, plan = [], []
        for t in range(1, (timeline.GetTrackCount("video") or 0) + 1):
            for it in timeline.GetItemListInTrack("video", t) or []:
                s, e = int(it.GetStart() or 0), int(it.GetEnd() or 0)
                if 0 < e - s < max_frames:
                    doomed.append(it)
                    plan.append({"tc": _tc(s, fps), "clip": (it.GetName() or "?")[:40],
                                 "frames": e - s, "track": f"V{t}"})
        report = {"mode": mode, "planned": plan, "deleted": 0, "dryRun": dry_run}
        if not dry_run and doomed:
            try:
                if timeline.DeleteClips(doomed, False):
                    report["deleted"] = len(doomed)
            except Exception:
                pass
        bridge.result(report)
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
