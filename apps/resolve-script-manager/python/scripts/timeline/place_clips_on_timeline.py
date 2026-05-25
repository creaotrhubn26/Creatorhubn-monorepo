"""Place Clips on Timeline — uses CullSession decisions to import + place clips in scene order.

Input (--params):
  session:           CullSession dict (passed inline from frontend)
  sessionId:         alternatively, load by id from <appdata>/cull_sessions/<id>.json
  timelineName:      target timeline (created if missing). Default: "Cull_Assembly_V01"
  sortWithinScene:   "highlight_desc" | "quality_desc" | "chronological" (default highlight_desc)
  addSceneMarkers:   true/false (default true)
  ingestMode:        "media_pool_only" | "media_pool_and_timeline" (default both)
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


TEMPLATE_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "wedding_bins.json",
)


# Canonical scene order — used to lay clips out on the timeline.
SCENE_ORDER = [
    "bride_prep",
    "groom_prep",
    "ceremony",
    "vows",
    "ring_exchange",
    "first_kiss",
    "portrait",
    "entrance",
    "speeches",
    "cake",
    "first_dance",
    "party",
    "drone",
    "detail",
    "candid",
    "unknown",
]


# Map AI scene tag → bin name (matches wedding_bins.json bin list).
SCENE_TO_BIN = {
    "bride_prep": "01 Bride Prep",
    "groom_prep": "02 Groom Prep",
    "ceremony": "03 Ceremony",
    "vows": "03 Ceremony",
    "ring_exchange": "03 Ceremony",
    "first_kiss": "03 Ceremony",
    "portrait": "04 Portrait",
    "entrance": "05 Entrance",
    "speeches": "06 Speeches",
    "cake": "07 Cake",
    "first_dance": "08 First Dance",
    "party": "09 Party",
    "drone": "10 Drone",
    "detail": "Details",
    "candid": "Candid",
    "unknown": "Inbox",
}


# Scene marker color (matches wedding_bins.json sceneMarkers)
SCENE_MARKER_COLOR = {
    "ceremony": "Blue",
    "vows": "Cyan",
    "ring_exchange": "Yellow",
    "first_kiss": "Red",
    "speeches": "Green",
    "first_dance": "Pink",
    "bride_prep": "Sand",
    "groom_prep": "Sand",
    "portrait": "Lavender",
    "entrance": "Mint",
    "cake": "Cream",
    "party": "Magenta",
    "drone": "Sky",
}


def load_session(params: dict) -> dict | None:
    if isinstance(params.get("session"), dict):
        return params["session"]
    session_id = params.get("sessionId")
    if not session_id:
        return None
    base = os.path.expanduser(
        "~/Library/Application Support/no.creatorhubn.roleroom-post-agent/cull_sessions"
    )
    path = os.path.join(base, f"{session_id}.json")
    if not os.path.isfile(path):
        return None
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def kept_clips_by_scene(session: dict) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = {scene: [] for scene in SCENE_ORDER}
    for d in session.get("decisions", []):
        if d.get("decision") != "keep":
            continue
        scene = d.get("scene") or "unknown"
        if scene not in grouped:
            grouped["unknown"].append(d)
        else:
            grouped[scene].append(d)
    return grouped


def sort_within(scene_decisions: list[dict], strategy: str) -> list[dict]:
    if strategy == "quality_desc":
        return sorted(scene_decisions, key=lambda d: (d.get("qualityScore") or 0), reverse=True)
    if strategy == "chronological":
        return sorted(scene_decisions, key=lambda d: d.get("startTimecode") or d.get("clipName") or "")
    # default highlight_desc
    return sorted(scene_decisions, key=lambda d: (d.get("highlightScore") or 0), reverse=True)


def run(params: dict, dry_run: bool) -> None:
    session = load_session(params)
    if not session:
        bridge.error("Missing required input: pass `session` (dict) or `sessionId` (string).")
        sys.exit(1)

    timeline_name = params.get("timelineName", "Cull_Assembly_V01")
    sort_strategy = params.get("sortWithinScene", "highlight_desc")
    add_markers = params.get("addSceneMarkers", True)
    ingest_mode = params.get("ingestMode", "media_pool_and_timeline")

    grouped = kept_clips_by_scene(session)
    non_empty = {scene: clips for scene, clips in grouped.items() if clips}

    plan = []
    total_kept = 0
    for scene in SCENE_ORDER:
        clips = non_empty.get(scene, [])
        if not clips:
            continue
        sorted_clips = sort_within(clips, sort_strategy)
        plan.append({
            "scene": scene,
            "bin": SCENE_TO_BIN.get(scene, "Inbox"),
            "clipCount": len(sorted_clips),
            "clipNames": [c.get("clipName") for c in sorted_clips[:6]],
            "marker": SCENE_MARKER_COLOR.get(scene),
        })
        total_kept += len(sorted_clips)

    if dry_run:
        bridge.result({
            "summary": f"Dry run — would place {total_kept} kept clips in '{timeline_name}' across {len(plan)} scene segments",
            "sceneOrder": [p["scene"] for p in plan],
            "plan": plan,
            "sortStrategy": sort_strategy,
            "addSceneMarkers": add_markers,
            "ingestMode": ingest_mode,
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    media_pool = conn.media_pool
    root_folder = media_pool.GetRootFolder()
    bins_by_name = {f.GetName(): f for f in root_folder.GetSubFolderList() or []}

    def ensure_bin(name: str):
        if name in bins_by_name:
            return bins_by_name[name]
        new_bin = media_pool.AddSubFolder(root_folder, name)
        if new_bin:
            bins_by_name[name] = new_bin
        return new_bin

    # 1) Import every kept clip into its scene-bin
    import_results: list[dict] = []
    for scene, clips in non_empty.items():
        bin_name = SCENE_TO_BIN.get(scene, "Inbox")
        bin_folder = ensure_bin(bin_name)
        if not bin_folder:
            bridge.warn(f"Could not create bin '{bin_name}' — skipping scene '{scene}'")
            continue
        media_pool.SetCurrentFolder(bin_folder)
        paths = [c["clipPath"] for c in clips if c.get("clipPath") and os.path.isfile(c["clipPath"])]
        if not paths:
            continue
        imported = media_pool.ImportMedia(paths) or []
        import_results.append({"scene": scene, "bin": bin_name, "requested": len(paths), "imported": len(imported)})

    if ingest_mode == "media_pool_only":
        bridge.result({
            "timelineCreated": False,
            "imports": import_results,
            "summary": f"Imported {sum(r['imported'] for r in import_results)} clips into scene bins. Timeline-build skipped (ingestMode=media_pool_only).",
        })
        return

    # 2) Create timeline + append clips in scene order
    timeline = media_pool.CreateEmptyTimeline(timeline_name)
    if not timeline:
        bridge.error(f"CreateEmptyTimeline('{timeline_name}') returned None — name may already exist")
        sys.exit(1)
    conn.project.SetCurrentTimeline(timeline)

    appended = 0
    marker_results: list[dict] = []
    current_frame = int(timeline.GetStartFrame() or 0)

    for scene in SCENE_ORDER:
        clips = non_empty.get(scene, [])
        if not clips:
            continue

        # Look up MediaPoolItem objects in the right bin
        bin_folder = bins_by_name.get(SCENE_TO_BIN.get(scene, "Inbox"))
        if not bin_folder:
            continue
        media_clips = bin_folder.GetClipList() or []
        # Match by basename — Resolve names items by filename on import
        wanted_names = {os.path.basename(c["clipPath"]): c for c in sort_within(clips, sort_strategy)}
        ordered_for_append = []
        for media_item in media_clips:
            try:
                name = media_item.GetName()
            except Exception:
                continue
            if name in wanted_names:
                ordered_for_append.append(media_item)

        if not ordered_for_append:
            continue

        # Mark current append position before adding
        if add_markers:
            color = SCENE_MARKER_COLOR.get(scene, "Blue")
            label = scene.replace("_", " ").title()
            ok = timeline.AddMarker(current_frame, color, label, "", 1, scene)
            marker_results.append({"scene": scene, "frame": current_frame, "ok": bool(ok)})

        if media_pool.AppendToTimeline(ordered_for_append):
            appended += len(ordered_for_append)
            # Advance current_frame by approximate sum of durations (in frames) — Resolve doesn't expose
            # the just-inserted item end-frame easily; fetch the new end-frame after append.
            current_frame = int(timeline.GetEndFrame() or current_frame)

    bridge.result({
        "timelineCreated": True,
        "timelineName": timeline_name,
        "clipsAppended": appended,
        "imports": import_results,
        "markers": marker_results,
        "summary": f"Built '{timeline_name}' with {appended} clips across {len(plan)} scenes",
    })


if __name__ == "__main__":
    bridge.main_guard(run)
