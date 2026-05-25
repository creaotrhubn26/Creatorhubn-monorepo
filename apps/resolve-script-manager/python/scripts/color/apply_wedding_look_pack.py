"""Apply Norwedfilm Look Pack — applies a look (LUT + optional CDL) per timeline item.

Two modes:
  - uniform: every clip gets the same `lookId`
  - scene:   each clip is matched to its nearest marker; marker → look via sceneToLookMap

Implementation:
  - LUT lives in `<look.components.lut>` filename — set via TimelineItem.SetLUT(node_index, name)
  - CDL: try TimelineItem.SetCDL(slope, offset, power, saturation) if exposed; else fall back to
    storing the desired CDL in a sidecar JSON next to the project (operator applies manually).
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


LOOK_PACK_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "templates",
    "norwedfilm_look_pack.json",
)


def load_pack() -> dict:
    with open(LOOK_PACK_PATH, "r", encoding="utf-8") as fh:
        return json.load(fh)


def apply_look_to_item(item, look: dict, node_index: int = 2) -> dict:
    """Apply a single look. Returns a per-item result dict."""
    components = look.get("components") or {}
    result: dict = {"item": "", "look": look["id"], "lutApplied": False, "cdlApplied": False}
    try:
        result["item"] = item.GetName()
    except Exception:
        pass

    lut = components.get("lut")
    if lut:
        try:
            if item.SetLUT(node_index, lut):
                result["lutApplied"] = True
            else:
                result["lutError"] = "SetLUT returned false"
        except Exception as exc:
            result["lutError"] = str(exc)

    cdl = components.get("cdl")
    if cdl and hasattr(item, "SetCDL"):
        try:
            ok = item.SetCDL({
                "Slope": list(cdl["slope"]),
                "Offset": list(cdl["offset"]),
                "Power": list(cdl["power"]),
                "Saturation": cdl["saturation"],
            })
            if ok:
                result["cdlApplied"] = True
            else:
                result["cdlError"] = "SetCDL returned false"
        except Exception as exc:
            result["cdlError"] = str(exc)
    elif cdl:
        result["cdlError"] = "SetCDL not available on this Resolve build — CDL values stored in sidecar JSON"

    return result


def write_sidecar(project_name: str, plan: list[dict]) -> str:
    folder = os.path.expanduser("~/Documents/Norwedfilm Look Pack Sidecars")
    os.makedirs(folder, exist_ok=True)
    safe = project_name.replace("/", "_").replace(" ", "_")
    path = os.path.join(folder, f"{safe}_look_plan.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(plan, fh, indent=2)
    return path


def nearest_marker_scene(timeline, frame: int, scene_map: dict[str, str]) -> str | None:
    markers = timeline.GetMarkers() or {}
    if not markers:
        return None
    closest = None
    closest_distance = None
    for marker_frame, data in markers.items():
        name = (data or {}).get("name", "")
        scene_id = name.lower().replace(" ", "_")
        if scene_id not in scene_map:
            # try case-insensitive match
            for key in scene_map:
                if key.lower() == name.lower():
                    scene_id = key
                    break
            else:
                continue
        distance = abs(int(marker_frame) - frame)
        if closest_distance is None or distance < closest_distance:
            closest_distance = distance
            closest = scene_id
    return closest


def run(params: dict, dry_run: bool) -> None:
    pack = load_pack()
    look_id = params.get("lookId")
    scene_markers = params.get("sceneMarkers") or pack["sceneToLookMap"]
    track_index = int(params.get("trackIndex", 1))
    node_index = int(params.get("nodeIndex", 2))

    looks_by_id = {l["id"]: l for l in pack["looks"]}

    if look_id and look_id not in looks_by_id:
        bridge.error(f"Unknown lookId '{look_id}'. Available: {list(looks_by_id)}")
        sys.exit(1)

    if dry_run:
        bridge.result({
            "summary": (
                f"Dry run — uniform look '{look_id}'" if look_id
                else f"Dry run — scene-based look (mapping {len(scene_markers)} scenes)"
            ),
            "lookPackVersion": pack["version"],
            "method": "TimelineItem.SetLUT + SetCDL (with sidecar fallback)",
        })
        return

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        return

    timeline = conn.project.GetCurrentTimeline()
    if not timeline:
        bridge.error("No current timeline")
        sys.exit(1)

    items = timeline.GetItemListInTrack("video", track_index) or []
    bridge.log(f"Applying look to {len(items)} items on V{track_index}")

    per_item: list[dict] = []
    plan_for_sidecar: list[dict] = []
    cdl_unsupported = False

    for item in items:
        # Pick look per item
        chosen: dict | None = None
        if look_id:
            chosen = looks_by_id.get(look_id)
        else:
            try:
                start = int(item.GetStart() or 0)
            except Exception:
                start = 0
            scene_id = nearest_marker_scene(timeline, start, scene_markers)
            if scene_id:
                target_look_id = scene_markers.get(scene_id)
                chosen = looks_by_id.get(target_look_id) if target_look_id else None

        if not chosen:
            per_item.append({"item": item.GetName(), "skipped": True, "reason": "no matching look"})
            continue

        result = apply_look_to_item(item, chosen, node_index=node_index)
        per_item.append(result)
        if "cdlError" in result and "not available" in result["cdlError"]:
            cdl_unsupported = True
            plan_for_sidecar.append({
                "item": result["item"],
                "look": chosen["id"],
                "cdl": chosen["components"].get("cdl"),
            })

    sidecar_path = None
    if plan_for_sidecar:
        sidecar_path = write_sidecar(conn.project.GetName(), plan_for_sidecar)

    bridge.result({
        "lookPackVersion": pack["version"],
        "totalItems": len(items),
        "applied": sum(1 for r in per_item if r.get("lutApplied")),
        "cdlApplied": sum(1 for r in per_item if r.get("cdlApplied")),
        "cdlSidecarPath": sidecar_path,
        "cdlUnsupportedInResolveBuild": cdl_unsupported,
        "perItem": per_item[:50],
    })


if __name__ == "__main__":
    bridge.main_guard(run)
