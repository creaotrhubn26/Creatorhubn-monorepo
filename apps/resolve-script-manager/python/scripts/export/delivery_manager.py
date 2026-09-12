"""Leveranse-sjef — versjoner, validering, filnavn, kø, diskvakt og rapport.

Modi:
  plan     Bygg leveranseplan for valgte versjoner (versions=master,web,
           some,review): codec/container/bitrate/lydformat per versjon,
           kanoniske filnavn ({Prosjekt}_{VERSJON}_{dato}_{oppløsning}),
           render-range (useInOut=true → timelinens in/out), subtitles-valg,
           og DISKVAKT: estimert størrelse vs ledig plass i targetDir.
  queue    Opprett render-jobbene fra planen (SetCurrentRenderFormatAndCodec
           + SetRenderSettings + AddRenderJob per versjon). Jobber er
           additive og kan slettes fra køen — starter IKKE rendering.
  verify   Sammenlign ferdig render med timelinen (file=<sti>, eller nyeste
           fil i targetDir): varighet (±0.5s), oppløsning, fps, lydkanaler
           via ffprobe → avvik listes eksplisitt.
  report   Leveranserapport (markdown): prosjekt/timeline-fakta, kø-status,
           verify-resultat for filer i targetDir, diskstatus. Skrives til
           targetDir/LEVERANSERAPPORT.md + returneres.

Versjons-definisjoner (bryllup):
  master  mov + ProRes 422 HQ (arkiv/master)      — full kvalitet
  web     mp4 + H.264, timeline-oppløsning, 40 Mb/s, aac 48k
  review  mp4 + H.264 1080p, 12 Mb/s, subtitles kan brennes inn
  some    mp4 + H.264 1080p (NB: 9:16/1:1 krever reframet timeline —
          bruk setup_platform_timeline/export_multi_aspect, ærlig notert)

subtitles=none|burnin|embedded|file (default none; review-forslag: burnin)
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402

VERSIONS = {
    "master": {"format": "mov", "codecMatch": ["prores", "422 hq"], "label": "MASTER",
               "gbPerMin": 2.0, "audio": {"AudioBitDepth": 24, "AudioSampleRate": 48000}},
    "web":    {"format": "mp4", "codecMatch": ["h264", "h.264"], "label": "WEB",
               "quality": 40000, "gbPerMin": 0.31,
               "audio": {"AudioCodec": "aac", "AudioSampleRate": 48000}},
    "review": {"format": "mp4", "codecMatch": ["h264", "h.264"], "label": "REVIEW",
               "quality": 12000, "gbPerMin": 0.1, "height": 1080,
               "audio": {"AudioCodec": "aac", "AudioSampleRate": 48000}},
    "some":   {"format": "mp4", "codecMatch": ["h264", "h.264"], "label": "SOME",
               "quality": 20000, "gbPerMin": 0.16, "height": 1080,
               "audio": {"AudioCodec": "aac", "AudioSampleRate": 48000},
               "note": "9:16/1:1 krever reframet timeline (setup_platform_timeline)"},
}
SUB_FORMATS = {"burnin": "BurnIn", "embedded": "EmbeddedCaptions", "file": "SeparateFile"}


def _sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "_", name).strip("_")[:60]


def _pick_codec(project, fmt: str, matches: list[str]) -> str | None:
    try:
        codecs = project.GetRenderCodecs(fmt) or {}
    except Exception:
        return None
    # dict: {visningsnavn: codec-id} — normaliser («H.264» vs «h264») før match
    norm = lambda s: re.sub(r"[^a-z0-9]", "", str(s).lower())  # noqa: E731
    pairs = codecs.items() if isinstance(codecs, dict) else [(c, c) for c in codecs]
    for disp, cid in pairs:
        n = norm(disp) + norm(cid)
        if all(norm(m) in n for m in matches):
            return cid
    for disp, cid in pairs:  # løsere: bare første kriterium
        if norm(matches[0]) in norm(disp) + norm(cid):
            return cid
    return None


def _ffprobe(path: str) -> dict:
    ff = shutil.which("ffprobe") or "/opt/homebrew/bin/ffprobe"
    r = subprocess.run([ff, "-v", "error", "-print_format", "json", "-show_format",
                        "-show_streams", path], capture_output=True, text=True,
                       encoding="utf-8", errors="replace", timeout=60)
    try:
        return json.loads(r.stdout)
    except Exception:
        return {}


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
    tl_w = int(timeline.GetSetting("timelineResolutionWidth") or 1920)
    tl_h = int(timeline.GetSetting("timelineResolutionHeight") or 1080)
    tl_start = int(timeline.GetStartFrame() or 0)
    tl_end = int(timeline.GetEndFrame() or 0)
    dur_sec = (tl_end - tl_start) / fps
    mode = (params.get("mode") or "plan").strip().lower()
    target = os.path.expanduser(params.get("targetDir")
                                or "~/Movies/Leveranser/" + _sanitize(project.GetName() or "prosjekt"))
    proj_name = _sanitize(params.get("projectName") or project.GetName() or "prosjekt")
    date = _dt.datetime.now().strftime("%Y%m%d") if not dry_run else "DATO"
    subtitles = (params.get("subtitles") or "none").strip().lower()
    use_inout = str(params.get("useInOut", "")).lower() in ("true", "1", "yes")

    def build_plan():
        wanted = [v.strip().lower() for v in
                  (params.get("versions") or "master,web,review").split(",") if v.strip()]
        # render-range fra timelinens in/out
        mark_in, mark_out = None, None
        if use_inout:
            try:
                io = timeline.GetMarkInOut() or {}
                v = io.get("video") or io.get("audio") or {}
                if "in" in v and "out" in v:
                    mark_in, mark_out = int(v["in"]), int(v["out"])
            except Exception:
                pass
        range_sec = ((mark_out - mark_in) / fps) if (mark_in is not None) else dur_sec
        plan, errors = [], []
        est_total_gb = 0.0
        for key in wanted:
            d = VERSIONS.get(key)
            if not d:
                errors.append(f"ukjent versjon «{key}»")
                continue
            codec = _pick_codec(project, d["format"], d["codecMatch"])
            if not codec:
                errors.append(f"{key}: fant ikke codec {d['codecMatch']} for {d['format']} "
                              "i denne Resolve-installasjonen")
                continue
            h = d.get("height") or tl_h
            w = round(tl_w * h / tl_h / 2) * 2
            est_gb = round(d["gbPerMin"] * range_sec / 60, 2)
            est_total_gb += est_gb
            name = f"{proj_name}_{d['label']}_{date}_{w}x{h}"
            settings = {"TargetDir": target, "CustomName": name,
                        "FormatWidth": w, "FormatHeight": h, "FrameRate": fps,
                        "ExportVideo": True, "ExportAudio": True, **d.get("audio", {})}
            if d.get("quality"):
                settings["VideoQuality"] = d["quality"]
            if mark_in is not None:
                settings["MarkIn"], settings["MarkOut"] = mark_in, mark_out
            if subtitles in SUB_FORMATS:
                settings["ExportSubtitle"] = True
                settings["SubtitleFormat"] = SUB_FORMATS[subtitles]
            elif subtitles == "none":
                settings["ExportSubtitle"] = False
            entry = {"version": key, "format": d["format"], "codec": codec,
                     "resolution": f"{w}x{h}", "fps": fps,
                     "bitrateKbps": d.get("quality"), "audio": d.get("audio", {}),
                     "filename": name, "estGb": est_gb, "settings": settings}
            if d.get("note"):
                entry["note"] = d["note"]
            plan.append(entry)
        # diskvakt
        disk = {}
        try:
            probe_dir = target
            while not os.path.isdir(probe_dir):
                probe_dir = os.path.dirname(probe_dir) or "/"
            u = shutil.disk_usage(probe_dir)
            disk = {"targetDir": target, "freeGb": round(u.free / 1e9, 1),
                    "estimatedGb": round(est_total_gb * 1.2, 1),
                    "ok": u.free / 1e9 > est_total_gb * 1.2}
            if not disk["ok"]:
                errors.append(f"DISKVAKT: trenger ~{disk['estimatedGb']} GB, "
                              f"kun {disk['freeGb']} GB ledig i {target}")
        except Exception:
            disk = {"targetDir": target, "error": "kunne ikke lese diskplass"}
        return plan, errors, disk, {"rangeSec": round(range_sec, 1),
                                    "usingInOut": mark_in is not None}

    if mode == "plan":
        plan, errors, disk, rng = build_plan()
        bridge.result({"mode": mode, "timeline": timeline.GetName(),
                       "durationSec": round(dur_sec, 1), **rng,
                       "versions": [{k: v for k, v in p.items() if k != "settings"}
                                    for p in plan],
                       "disk": disk, "errors": errors, "dryRun": dry_run})
        return

    if mode == "queue":
        plan, errors, disk, rng = build_plan()
        report = {"mode": mode, "queued": [], "errors": errors, "disk": disk,
                  "dryRun": dry_run}
        if dry_run:
            report["planned"] = [p["filename"] for p in plan]
            bridge.result(report)
            return
        if disk.get("ok") is False and str(params.get("force", "")).lower() not in ("true", "1"):
            bridge.error("Diskvakten stopper kø-opprettelsen (force=true for å overstyre): "
                         f"trenger ~{disk.get('estimatedGb')} GB, ledig {disk.get('freeGb')} GB.")
            return
        os.makedirs(target, exist_ok=True)
        for p in plan:
            try:
                if not project.SetCurrentRenderFormatAndCodec(p["format"], p["codec"]):
                    report["errors"].append(f"{p['version']}: SetCurrentRenderFormatAndCodec feilet")
                    continue
                if not project.SetRenderSettings(p["settings"]):
                    report["errors"].append(f"{p['version']}: SetRenderSettings feilet")
                    continue
                job_id = project.AddRenderJob()
                if job_id:
                    report["queued"].append({"version": p["version"], "jobId": job_id,
                                             "filename": p["filename"]})
                else:
                    report["errors"].append(f"{p['version']}: AddRenderJob feilet")
            except Exception as e:
                report["errors"].append(f"{p['version']}: {str(e)[:120]}")
        # resultatkontroll: ligger jobbene i køen?
        try:
            ids = {j.get("JobId") for j in (project.GetRenderJobList() or [])}
            report["verifiedInQueue"] = sum(1 for q in report["queued"] if q["jobId"] in ids)
        except Exception:
            pass
        bridge.result(report)
        return

    if mode == "verify":
        f = (params.get("file") or "").strip()
        candidates = [f] if f else []
        if not candidates and os.path.isdir(target):
            files = [os.path.join(target, x) for x in os.listdir(target)
                     if x.lower().endswith((".mp4", ".mov", ".mxf"))]
            candidates = sorted(files, key=os.path.getmtime, reverse=True)[:5]
        results = []
        for path in candidates:
            if not os.path.isfile(path):
                results.append({"file": path, "error": "finnes ikke"})
                continue
            meta = _ffprobe(path)
            vstream = next((s for s in meta.get("streams", []) if s.get("codec_type") == "video"), {})
            astreams = [s for s in meta.get("streams", []) if s.get("codec_type") == "audio"]
            got_dur = float(meta.get("format", {}).get("duration") or 0)
            fr = vstream.get("r_frame_rate", "0/1")
            try:
                num, den = fr.split("/")
                got_fps = round(float(num) / float(den), 3)
            except Exception:
                got_fps = 0
            issues = []
            if abs(got_dur - dur_sec) > 0.5:
                issues.append(f"varighet {got_dur:.1f}s ≠ timeline {dur_sec:.1f}s")
            if got_fps and abs(got_fps - fps) > 0.01:
                issues.append(f"fps {got_fps} ≠ {fps}")
            if not astreams:
                issues.append("ingen lydstrøm!")
            results.append({"file": os.path.basename(path),
                            "durationSec": round(got_dur, 1),
                            "resolution": f"{vstream.get('width')}x{vstream.get('height')}",
                            "fps": got_fps, "videoCodec": vstream.get("codec_name"),
                            "audioStreams": len(astreams),
                            "audioCodec": astreams[0].get("codec_name") if astreams else None,
                            "sizeGb": round(os.path.getsize(path) / 1e9, 2),
                            "issues": issues, "ok": not issues})
        bridge.result({"mode": mode, "timelineDurationSec": round(dur_sec, 1),
                       "results": results, "dryRun": dry_run})
        return

    if mode == "report":
        lines = [f"# Leveranserapport — {project.GetName()}",
                 f"Generert: {_dt.datetime.now().strftime('%Y-%m-%d %H:%M') if not dry_run else 'DATO'}",
                 "",
                 f"**Timeline:** {timeline.GetName()} — {round(dur_sec / 60, 1)} min "
                 f"@ {fps} fps, {tl_w}x{tl_h}", ""]
        try:
            jobs = project.GetRenderJobList() or []
            lines.append(f"## Render-kø ({len(jobs)} jobber)")
            for j in jobs[:15]:
                lines.append(f"- {j.get('RenderJobName', '?')}: {j.get('TimelineName', '')} → "
                             f"{j.get('FormatWidth', '?')}x{j.get('FormatHeight', '?')} "
                             f"{j.get('VideoFormat', '')}/{j.get('VideoCodec', '')} → "
                             f"`{j.get('TargetDir', '')}`")
        except Exception:
            lines.append("## Render-kø: utilgjengelig")
        lines.append("")
        if os.path.isdir(target):
            lines.append(f"## Ferdige filer i `{target}`")
            files = [x for x in os.listdir(target) if x.lower().endswith((".mp4", ".mov", ".mxf"))]
            for x in sorted(files):
                p = os.path.join(target, x)
                meta = _ffprobe(p)
                d = float(meta.get("format", {}).get("duration") or 0)
                ok = "✓" if abs(d - dur_sec) <= 0.5 else f"⚠ varighet {d:.1f}s vs timeline {dur_sec:.1f}s"
                lines.append(f"- `{x}` — {round(os.path.getsize(p) / 1e9, 2)} GB, {d:.1f}s {ok}")
            if not files:
                lines.append("- (ingen enda)")
        try:
            u = shutil.disk_usage(target if os.path.isdir(target) else os.path.dirname(target))
            lines.append(f"\n**Disk:** {round(u.free / 1e9, 1)} GB ledig i målmappen")
        except Exception:
            pass
        text = "\n".join(lines)
        written = None
        if not dry_run:
            os.makedirs(target, exist_ok=True)
            written = os.path.join(target, "LEVERANSERAPPORT.md")
            with open(written, "w", encoding="utf-8") as fh:
                fh.write(text + "\n")
        bridge.result({"mode": mode, "report": text, "writtenTo": written, "dryRun": dry_run})
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
