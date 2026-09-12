"""Dialog-verktøy — transkripsjonen som råstoff for klipping.

Forutsetning: timelinen har undertekst-spor (generert native med
Timeline.CreateSubtitlesFromAudio — plugin-en/appen trigger det).
Undertekst-items ER dialogen: GetName() = teksten, GetStart/End = når.

Modi:
  extract       dialog-kartet: [{startFrame,endFrame,tc,durationSec,text}] + stats
  search        query=<tekst> → treff med tidskode (case-insensitiv, ord-basert)
  pauses        opphold i talen > minPauseSec (default 2.0) → liste;
                markers=true → gule PAUSE-markører
  repetitions   nabo-segmenter med ~lik tekst (SequenceMatcher ≥ 0.75) →
                repetisjons-kandidater; markers=true → rosa markører
  assembly      segments=<JSON [{start,end}]> (abs frames i KILDE-timelinen)
                → bygger NY timeline (assemblyName, default «Assembly fra
                manus») med de utsnittene — video+lyd fra V1-klippene som
                dekker hvert segment. Master røres ALDRI.
"""
from __future__ import annotations

import json
import sys
from difflib import SequenceMatcher
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import bridge  # noqa: E402


def _tc(frames: int, fps: float) -> str:
    fps_i = max(1, round(fps))
    f = int(frames)
    s = f // fps_i
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}:{f % fps_i:02d}"


def _segments(timeline) -> list[dict]:
    """Alle undertekst-items sortert på tid."""
    segs = []
    for t in range(1, (timeline.GetTrackCount("subtitle") or 0) + 1):
        for it in timeline.GetItemListInTrack("subtitle", t) or []:
            try:
                segs.append({"startFrame": int(it.GetStart() or 0),
                             "endFrame": int(it.GetEnd() or 0),
                             "text": (it.GetName() or "").strip()})
            except Exception:
                continue
    segs.sort(key=lambda s: s["startFrame"])
    return segs


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
    mode = (params.get("mode") or "extract").strip().lower()

    segs = _segments(timeline)
    if not segs and mode != "assembly":
        bridge.result({"mode": mode, "timeline": timeline.GetName(), "segments": 0,
                       "note": "Ingen undertekst-spor — generer undertekster fra lyd først "
                               "(native, Timeline.CreateSubtitlesFromAudio)."})
        return
    for s in segs:
        s["tc"] = _tc(s["startFrame"], fps)
        s["durationSec"] = round((s["endFrame"] - s["startFrame"]) / fps, 1)

    if mode == "extract":
        total_speech = sum(s["durationSec"] for s in segs)
        if segs and not dry_run:
            try:
                from project_index import ProjectIndex
                _idx = ProjectIndex(project, resolve=conn.resolve)
                _idx.replace_transcripts(timeline.GetUniqueId() or "current", segs)
                _idx.close()
            except Exception:
                pass
        bridge.result({"mode": mode, "timeline": timeline.GetName(), "fps": fps,
                       "segments": len(segs), "speechSec": round(total_speech, 1),
                       "list": segs[:500], "capped": len(segs) > 500, "dryRun": dry_run})
        return

    if mode == "search":
        q = (params.get("query") or "").strip().lower()
        if not q:
            bridge.error("search krever query=<tekst>.")
            return
        words = q.split()
        hits = [s for s in segs
                if q in s["text"].lower()
                or all(w in s["text"].lower() for w in words)]
        bridge.result({"mode": mode, "query": q, "hits": hits[:100],
                       "hitCount": len(hits), "dryRun": dry_run})
        return

    if mode == "pauses":
        min_pause = float(params.get("minPauseSec") or 2.0)
        want_markers = str(params.get("markers", "")).lower() in ("true", "1", "yes")
        pauses = []
        for a, b in zip(segs, segs[1:]):
            gap = (b["startFrame"] - a["endFrame"]) / fps
            if gap >= min_pause:
                pauses.append({"frame": a["endFrame"], "tc": _tc(a["endFrame"], fps),
                               "durationSec": round(gap, 1),
                               "before": a["text"][-60:], "after": b["text"][:60]})
        added = 0
        if want_markers and not dry_run:
            for p in pauses:
                try:
                    if timeline.AddMarker(max(0, p["frame"] - tl_start), "Yellow",
                                          f"PAUSE {p['durationSec']}s",
                                          f"…{p['before']}  →  {p['after']}…", 1):
                        added += 1
                except Exception:
                    pass
        bridge.result({"mode": mode, "minPauseSec": min_pause, "pauses": pauses[:100],
                       "pauseCount": len(pauses), "markersAdded": added, "dryRun": dry_run})
        return

    if mode == "repetitions":
        want_markers = str(params.get("markers", "")).lower() in ("true", "1", "yes")
        reps = []
        for a, b in zip(segs, segs[1:]):
            if len(a["text"]) < 12 or len(b["text"]) < 12:
                continue
            ratio = SequenceMatcher(None, a["text"].lower(), b["text"].lower()).ratio()
            if ratio >= 0.75:
                reps.append({"frame": a["startFrame"], "tc": a["tc"],
                             "similarity": round(ratio, 2),
                             "first": a["text"][:80], "second": b["text"][:80]})
        added = 0
        if want_markers and not dry_run:
            for r in reps:
                try:
                    if timeline.AddMarker(max(0, r["frame"] - tl_start), "Pink",
                                          f"REPETISJON ({int(r['similarity'] * 100)} %)",
                                          f"1: {r['first']}\n2: {r['second']}", 1):
                        added += 1
                except Exception:
                    pass
        bridge.result({"mode": mode, "repetitions": reps[:100], "repCount": len(reps),
                       "markersAdded": added, "dryRun": dry_run})
        return

    if mode == "assembly":
        raw = params.get("segments")
        wanted = json.loads(raw) if isinstance(raw, str) else (raw or [])
        if not wanted:
            bridge.error("assembly krever segments=[{start,end}] (abs frames).")
            return
        name = (params.get("assemblyName") or "Assembly fra manus").strip()

        # V1-items i kilde-timelinen → kilde-utsnitt per ønsket segment
        v1 = []
        for it in timeline.GetItemListInTrack("video", 1) or []:
            try:
                mpi = it.GetMediaPoolItem()
            except Exception:
                mpi = None
            if mpi:
                v1.append({"start": int(it.GetStart() or 0), "end": int(it.GetEnd() or 0),
                           "mpi": mpi, "leftOffset": int(it.GetLeftOffset() or 0)})
        plan = []
        for seg in sorted(wanted, key=lambda s: int(s.get("start") or 0)):
            s, e = int(seg.get("start") or 0), int(seg.get("end") or 0)
            for item in v1:
                o_s, o_e = max(s, item["start"]), min(e, item["end"])
                if o_e <= o_s:
                    continue
                src_in = item["leftOffset"] + (o_s - item["start"])
                plan.append({"clip": item["mpi"].GetName() or "?", "tc": _tc(o_s, fps),
                             "frames": o_e - o_s,
                             "_info": {"mediaPoolItem": item["mpi"],
                                       "startFrame": src_in,
                                       "endFrame": src_in + (o_e - o_s)}})
        report = {"mode": mode, "assemblyName": name, "sourceTimeline": timeline.GetName(),
                  "planned": [{k: v for k, v in p.items() if k != "_info"} for p in plan],
                  "built": 0, "dryRun": dry_run}
        if dry_run or not plan:
            bridge.result(report)
            return

        new_tl = conn.media_pool.CreateEmptyTimeline(name)
        if not new_tl:
            bridge.error(f"Kunne ikke opprette timeline «{name}» (finnes den alt?).")
            return
        project.SetCurrentTimeline(new_tl)
        for p in plan:
            try:
                if conn.media_pool.AppendToTimeline([p["_info"]]):
                    report["built"] += 1
            except Exception:
                pass
        report["note"] = f"Ny timeline «{name}» er nå åpen — master er urørt."
        bridge.result(report)
        return

    bridge.error(f"Ukjent mode «{mode}».")


if __name__ == "__main__":
    bridge.main_guard(run)
