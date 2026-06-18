"""Refresh Beat Markers — (re)lays a music beat-grid onto the active Resolve
timeline, anchored to the CURRENT edit by source content.

Re-runnable by design: idempotent (deletes its own 'beatgrid:' markers first,
then re-applies), so it can be triggered again any time the edit changes
without ever double-stacking markers.

How it aligns: every clip's source-time decides which music cue it belongs to,
so each cue's song beat-grid is laid from where that cue *actually* begins in
the current timeline — robust to trims, deletes and re-timing.

Input params (all optional):
  projectId:    staging project folder under .../staging/<projectId>/source_songs
                (auto-detects the most recently used one if omitted)
  timelineName: target a timeline by name (defaults to the current timeline)
  srcFps:       source-video fps for source-time mapping (default 25)

Per-project config (optional): a cue_map.json in the staging folder overrides
DEFAULT_CUE_MAP. Each cue: {chapter, srcLo, srcHi, songId|null, color, bar, label}.
songId=null → a single "natural sound" marker for that section.

Output: { timeline, markersAdded, skipped, clips, cueStarts, fps }
"""
from __future__ import annotations
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge

STAGING_BASE = os.path.expanduser(
    "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/staging")

# Wedding default (chapters by SOURCE seconds). Overridable via cue_map.json.
DEFAULT_CUE_MAP = [
    {"chapter": "prelude",   "srcLo": 0,    "srcHi": 285,  "songId": None, "color": "Yellow",   "label": "Cue1 Prelude",        "bar": 4},
    {"chapter": "arrival",   "srcLo": 285,  "srcHi": 1180, "songId": None, "color": "Cream",     "label": "Cue2 Arrival/Milni",  "bar": 4},
    {"chapter": "ceremony",  "srcLo": 1180, "srcHi": 1700, "songId": None, "color": "Sky",       "label": "Cue3 Ceremony (natural)", "bar": 0},
    {"chapter": "portraits", "srcLo": 1700, "srcHi": 2090, "songId": None, "color": "Lavender",  "label": "Cue4 Portraits",      "bar": 4},
    {"chapter": "reception", "srcLo": 2090, "srcHi": 2395, "songId": None, "color": "Pink",      "label": "Cue5 Reception",      "bar": 4},
    {"chapter": "firstdance","srcLo": 2395, "srcHi": 2610, "songId": None, "color": "Rose",      "label": "Cue6 First dance",    "bar": 8},
    {"chapter": "speeches",  "srcLo": 2610, "srcHi": 3000, "songId": None, "color": "Sky",       "label": "Cue7 Speeches (natural)", "bar": 0},
    {"chapter": "party",     "srcLo": 3000, "srcHi": 3954, "songId": None, "color": "Red",       "label": "Cue8 Party",          "bar": 4},
    {"chapter": "outro",     "srcLo": 3954, "srcHi": 99999,"songId": None, "color": "Yellow",    "label": "Cue9 Outro",          "bar": 4},
]


def _auto_project_id() -> str | None:
    """Newest staging folder that has at least one *.beats.json."""
    best, best_mtime = None, -1.0
    if not os.path.isdir(STAGING_BASE):
        return None
    for name in os.listdir(STAGING_BASE):
        songs = os.path.join(STAGING_BASE, name, "source_songs")
        if not os.path.isdir(songs):
            continue
        beats = [f for f in os.listdir(songs) if f.endswith(".beats.json")]
        if not beats:
            continue
        m = max(os.path.getmtime(os.path.join(songs, f)) for f in beats)
        if m > best_mtime:
            best, best_mtime = name, m
    return best


def _load_cue_map(songs_dir: str) -> list[dict]:
    cfg = os.path.join(os.path.dirname(songs_dir), "cue_map.json")
    if os.path.isfile(cfg):
        try:
            data = json.load(open(cfg))
            if isinstance(data, list) and data:
                return data
        except (OSError, json.JSONDecodeError):
            bridge.warn("cue_map.json kunne ikke leses — bruker default")
    return DEFAULT_CUE_MAP


def run(params: dict, dry_run: bool) -> None:
    project_id = (params.get("projectId") or "").strip() or _auto_project_id()
    if not project_id:
        bridge.error("Fant ingen staging-prosjekt med beat-grids. Last ned sanger først (fetch_source_song).")
        sys.exit(1)
    songs_dir = os.path.join(STAGING_BASE, project_id, "source_songs")
    if not os.path.isdir(songs_dir):
        bridge.error(f"Fant ikke {songs_dir}")
        sys.exit(1)
    src_fps = float(params.get("srcFps") or 25)
    cue_map = _load_cue_map(songs_dir)

    def chapter_for(src_sec: float):
        for c in cue_map:
            if c["srcLo"] <= src_sec < c["srcHi"]:
                return c["chapter"]
        return None

    if dry_run:
        bridge.result({"projectId": project_id, "cues": len(cue_map),
                       "wouldUse": songs_dir})
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return
    p = conn.project
    tl_name = (params.get("timelineName") or "").strip()
    timeline = None
    if tl_name:
        for i in range(1, int(p.GetTimelineCount() or 0) + 1):
            t = p.GetTimelineByIndex(i)
            if t and t.GetName() == tl_name:
                timeline = t; break
    if timeline is None:
        timeline = p.GetCurrentTimeline()
    if not timeline:
        bridge.error("Ingen aktiv timeline"); sys.exit(1)

    fps = 24.0
    try: fps = float(p.GetSetting("timelineFrameRate") or 24)
    except Exception: pass
    sf = int(timeline.GetStartFrame() or 0)
    ef = int(timeline.GetEndFrame() or 0)

    # 1) idempotent: remove our own previous markers
    for fr, info in list((timeline.GetMarkers() or {}).items()):
        if str(info.get("customData", "")).startswith("beatgrid:"):
            try: timeline.DeleteMarkerByCustomData(info["customData"])
            except Exception:
                try: timeline.DeleteMarkerAtFrame(int(fr))
                except Exception: pass
    existing = set(int(x) for x in (timeline.GetMarkers() or {}).keys())

    # 2) map current clips to cue start positions (source-anchored)
    items = timeline.GetItemListInTrack("video", 1) or []
    clips = []
    for it in items:
        try:
            clips.append(((it.GetStart() - sf) / fps, it.GetSourceStartFrame() / src_fps))
        except Exception:
            continue
    clips.sort(key=lambda x: x[0])
    seg = {}
    seen = []
    for tl_sec, src_sec in clips:
        ch = chapter_for(src_sec)
        if not ch:
            continue
        if ch not in seg:
            seg[ch] = [tl_sec, tl_sec]; seen.append((tl_sec, ch))
    seen.sort()
    for idx, (tstart, ch) in enumerate(seen):
        end = seen[idx + 1][0] if idx + 1 < len(seen) else (ef - sf) / fps
        seg[ch] = (tstart, end)

    cue_by_chapter = {c["chapter"]: c for c in cue_map}

    # 3) place markers
    plan = []
    for ch, (cstart, cend) in seg.items():
        c = cue_by_chapter.get(ch)
        if not c:
            continue
        sid, color, label, bar = c.get("songId"), c.get("color", "Blue"), c.get("label", ch), int(c.get("bar") or 0)
        if not sid or bar == 0:
            plan.append((cstart + 0.1, color, label)); continue
        bp = os.path.join(songs_dir, f"{sid}.beats.json")
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
        if frame in existing:
            skipped += 1; continue
        try:
            if timeline.AddMarker(frame, color, label, "", 1, f"beatgrid:{frame}"):
                added += 1; existing.add(frame)
            else: skipped += 1
        except Exception:
            skipped += 1

    bridge.result({"timeline": timeline.GetName(), "projectId": project_id,
                   "fps": fps, "clips": len(clips),
                   "markersAdded": added, "skipped": skipped,
                   "cueStarts": {k: round(seg[k][0], 1) for k in seg}})


if __name__ == "__main__":
    bridge.main_guard(run)
