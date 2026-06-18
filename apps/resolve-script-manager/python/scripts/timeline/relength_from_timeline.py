"""Re-length from current timeline — takes the CURRENT Resolve timeline as its
basis (the clips actually on it now, with their source in/out points), scales it
to a new target duration while preserving the editorial chapter-weighting, and
builds a NEW timeline (non-destructive — your current edit is untouched).

Why "from current timeline": after you've trimmed/cut by hand, a stored picks.json
is stale. This reads the live edit instead, so forleng/forkort always reflects
what's actually there now.

Input params:
  targetSec:        target duration in seconds (e.g. 360=6min, 900=15min) [required]
  srcFps:           source-video fps (default 25)
  projectId:        staging project for cue_map.json chapter ranges (optional;
                    without it all clips are treated as one bucket = uniform scale)
  newTimelineName:  name for the output timeline (optional)

Output: { newTimeline, sourceClips, keptClips, targetSec, actualSec }
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

STAGING = os.path.expanduser("~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging")
MIN_LEN, MAX_LEN = 1.0, 9.0
MIN_SCALE = 0.6

# fallback chapters by SOURCE seconds (wedding default) if no cue_map.json
DEFAULT_RANGES = [
    ("prelude", 0, 285), ("arrival", 285, 1180), ("ceremony", 1180, 1700),
    ("portraits", 1700, 2090), ("reception", 2090, 2395), ("firstdance", 2395, 2610),
    ("speeches", 2610, 3000), ("party", 3000, 3954), ("outro", 3954, 10**9),
]


def _ranges(project_id: str):
    if project_id:
        cfg = os.path.join(STAGING, project_id, "cue_map.json")
        if os.path.isfile(cfg):
            try:
                data = json.load(open(cfg))
                return [(c["chapter"], c["srcLo"], c["srcHi"]) for c in data]
            except Exception:
                pass
    return DEFAULT_RANGES


def run(params: dict, dry_run: bool) -> None:
    target = float(params.get("targetSec") or 0)
    if target <= 0:
        bridge.error("targetSec kreves (sekunder, f.eks. 360 = 6 min)"); sys.exit(1)
    src_fps = float(params.get("srcFps") or 25)
    ranges = _ranges((params.get("projectId") or "").strip())

    def chapter_for(s):
        for name, lo, hi in ranges:
            if lo <= s < hi:
                return name
        return "misc"

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    p = conn.project
    tl = p.GetCurrentTimeline()
    if not tl:
        bridge.error("Ingen aktiv timeline"); sys.exit(1)
    base_name = tl.GetName()

    items = tl.GetItemListInTrack("video", 1) or []
    clips = []
    source_item = None
    for it in items:
        try:
            ss = int(it.GetSourceStartFrame()); se = int(it.GetSourceEndFrame())
            if se <= ss:
                continue
            mp = it.GetMediaPoolItem()
            if mp and source_item is None:
                source_item = mp
            clips.append({"srcStart": ss, "srcEnd": se,
                          "dur": (se - ss) / src_fps, "srcSec": ss / src_fps,
                          "chapter": chapter_for(ss / src_fps), "mp": mp})
        except Exception:
            continue
    if not clips or source_item is None:
        bridge.error("Fant ingen klipp på video-spor 1 (eller ingen media-referanse)"); sys.exit(1)

    # media length guard (don't extend an out-point past the source)
    try:
        media_frames = int(source_item.GetClipProperty("Frames") or 0)
    except Exception:
        media_frames = 0

    if dry_run:
        bridge.result({"sourceClips": len(clips), "targetSec": target,
                       "chapters": sorted(set(c["chapter"] for c in clips))})
        return

    # ── re-length: preserve each chapter's SHARE of the total ──
    from collections import OrderedDict
    by_ch = OrderedDict()
    for c in clips:
        by_ch.setdefault(c["chapter"], []).append(c)
    grand = sum(c["dur"] for c in clips) or 1.0

    kept = []
    for ch, cs in by_ch.items():
        cur = sum(c["dur"] for c in cs) or 1.0
        budget = (cur / grand) * target
        factor = budget / cur
        sel = cs
        if factor < MIN_SCALE and len(cs) > 1:
            # drop shortest clips first until mild-scaling reaches budget
            sel = sorted(cs, key=lambda c: c["dur"], reverse=True)
            while len(sel) > 1 and (budget / max(0.1, sum(c["dur"] for c in sel))) < MIN_SCALE:
                sel.pop()
            sel.sort(key=lambda c: c["srcStart"])
            cur = sum(c["dur"] for c in sel) or 1.0
            factor = budget / cur
        for c in sel:
            nd = max(MIN_LEN, min(MAX_LEN, c["dur"] * factor))
            c["newDur"] = nd
            kept.append(c)
    kept.sort(key=lambda c: c["srcStart"])

    # ── build new timeline ──
    media_pool = p.GetMediaPool()
    out_name = (params.get("newTimelineName") or "").strip() or \
        f"{base_name} — {int(round(target/60))}min"
    timeline = media_pool.CreateEmptyTimeline(out_name)
    if not timeline:
        for n in range(2, 100):
            timeline = media_pool.CreateEmptyTimeline(f"{out_name} {n}")
            if timeline:
                out_name = f"{out_name} {n}"; break
    if not timeline:
        bridge.error("Kunne ikke opprette ny timeline"); sys.exit(1)
    p.SetCurrentTimeline(timeline)

    specs = []
    for c in kept:
        ndf = int(round(c["newDur"] * src_fps))
        end_f = c["srcStart"] + max(1, ndf) - 1
        if media_frames:
            end_f = min(end_f, media_frames - 1)
        if end_f <= c["srcStart"]:
            continue
        specs.append({"mediaPoolItem": c["mp"], "startFrame": c["srcStart"], "endFrame": end_f})

    bridge.progress(80, 100, f"Legger {len(specs)} klipp på ny timeline…")
    placed = media_pool.AppendToTimeline(specs)
    placed_n = len(placed) if isinstance(placed, list) else 0
    actual = sum((s["endFrame"] - s["startFrame"] + 1) for s in specs) / src_fps

    bridge.result({"newTimeline": out_name, "sourceClips": len(clips),
                   "keptClips": placed_n, "droppedClips": len(clips) - len(kept),
                   "targetSec": round(target, 1), "actualSec": round(actual, 1)})


if __name__ == "__main__":
    bridge.main_guard(run)
