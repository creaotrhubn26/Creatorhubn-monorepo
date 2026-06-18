"""Add music beat-grid markers to the Manjot & Armaan highlight timeline,
anchored to the CURRENT edit by source content (robust to trims/deletes).

Non-destructive: only adds timeline markers — never touches clips. Skips frames
that already have a marker. Each clip's source-time decides which music cue it
belongs to; the cue's song beat-grid is then laid from where that cue actually
begins in the current timeline. Re-runnable: deletes its own previous markers
(customData prefix 'beatgrid:') first.
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

TIMELINE_PREFIX = "Manjot"
SRC_FPS = 25.0  # source video frame rate
SONGS = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging/manjot-armaan/source_songs")

# chapter (by SOURCE seconds) → cue song + colour + bar size (beats per marker); None song = natural sound
# ranges are generous so any clip lands in exactly one chapter
CHAPTERS = [
    ("prelude",  0,    285,  "vsVwvVYlUBs", "Yellow",   "Cue1 Kesariya",         4),
    ("arrival",  285,  1180, "1LVpuWpRs3I", "Cream",    "Cue2 Din Shagna Da",    4),
    ("ceremony", 1180, 1700, None,          "Sky",      "Cue3 NATURLYD kirtan",  0),
    ("portraits",1700, 2090, "V7LwfY5U5WI", "Lavender", "Cue4 Ranjha",           4),
    ("reception",2090, 2395, "wr9M-CoxP7A", "Pink",     "Cue5 Chaleya",          4),
    ("firstdance",2395,2610, "orYf6VDtj_k", "Rose",     "Cue6 Raataan Lambiyan", 8),
    ("speeches", 2610, 3000, None,          "Sky",      "Cue7 NATURLYD taler",   0),
    ("party",    3000, 3954, "yBYbfMeJvHA", "Red",      "Cue8 What Jhumka",      4),
    ("outro",    3954, 4100, "vsVwvVYlUBs", "Yellow",   "Cue9 Kesariya reprise", 4),
]
CH_BY_KEY = {c[0]: c for c in CHAPTERS}

def chapter_for(src_sec: float) -> str | None:
    for key, lo, hi, *_ in CHAPTERS:
        if lo <= src_sec < hi:
            return key
    return None

def run(params: dict, dry_run: bool) -> None:
    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    p = conn.project
    tl = None
    for i in range(1, int(p.GetTimelineCount() or 0) + 1):
        t = p.GetTimelineByIndex(i)
        if t and t.GetName().startswith(TIMELINE_PREFIX):
            tl = t; break
    if not tl:
        bridge.error("Fant ikke Manjot-timeline"); sys.exit(1)
    p.SetCurrentTimeline(tl)

    fps = 24.0
    try: fps = float(p.GetSetting("timelineFrameRate") or 24)
    except Exception: pass
    sf = int(tl.GetStartFrame() or 0)
    ef = int(tl.GetEndFrame() or 0)

    # 1) clean our previous markers
    for fr, info in list((tl.GetMarkers() or {}).items()):
        if str(info.get("customData", "")).startswith("beatgrid:"):
            try: tl.DeleteMarkerByCustomData(info["customData"])
            except Exception:
                try: tl.DeleteMarkerAtFrame(int(fr))
                except Exception: pass
    existing = set(int(x) for x in (tl.GetMarkers() or {}).keys())

    # 2) walk clips in timeline order → find where each chapter starts in current edit
    items = tl.GetItemListInTrack("video", 1) or []
    clips = []
    for it in items:
        try:
            ss = it.GetSourceStartFrame()
            clips.append(((it.GetStart() - sf) / fps, ss / SRC_FPS))  # (tl_sec, src_sec)
        except Exception:
            continue
    clips.sort(key=lambda x: x[0])

    # chapter -> (tl_start_sec, tl_end_sec) using first/last clip occurrence in order
    seg = {}
    order_seen = []
    for tl_sec, src_sec in clips:
        ch = chapter_for(src_sec)
        if not ch: continue
        if ch not in seg:
            seg[ch] = [tl_sec, tl_sec]
            order_seen.append((tl_sec, ch))
        seg[ch][1] = tl_sec  # extend end to last clip start of this chapter
    # chapter end = next chapter's start in timeline order (cleaner than last-clip)
    order_seen.sort()
    for idx, (tstart, ch) in enumerate(order_seen):
        end = order_seen[idx + 1][0] if idx + 1 < len(order_seen) else (ef - sf) / fps
        seg[ch] = (tstart, end)

    # 3) place markers per chapter
    plan = []
    for key, lo, hi, sid, color, label, bar in CHAPTERS:
        if key not in seg:
            continue
        cstart, cend = seg[key]
        if sid is None or bar == 0:
            plan.append((cstart + 0.1, color, label)); continue
        bp = os.path.join(SONGS, f"{sid}.beats.json")
        beats = json.load(open(bp)).get("beats", []) if os.path.isfile(bp) else []
        dur = cend - cstart
        n = 1
        for k in range(0, len(beats), bar):
            if beats[k] >= dur: break
            plan.append((cstart + beats[k], color, f"{label} · takt {n}")); n += 1

    added = skipped = 0
    for sec, color, label in plan:
        frame = sf + int(round(sec * fps))
        if frame >= ef: frame = ef - 1
        if frame in existing: skipped += 1; continue
        try:
            if tl.AddMarker(frame, color, label, "", 1, f"beatgrid:{frame}"):
                added += 1; existing.add(frame)
            else: skipped += 1
        except Exception: skipped += 1

    bridge.result({"timeline": tl.GetName(), "fps": fps,
                   "timelineDurationSec": round((ef - sf) / fps, 1),
                   "clips": len(clips), "chaptersFound": list(seg.keys()),
                   "markersAdded": added, "skipped": skipped,
                   "cueStarts": {k: round(seg[k][0], 1) for k in seg}})

if __name__ == "__main__":
    bridge.main_guard(run)
