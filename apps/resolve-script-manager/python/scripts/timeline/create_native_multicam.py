"""Create a native DaVinci Resolve 21.1 multicam clip.

The script resolves local paths against the Media Pool, imports only missing
clips with the canonical 21.1 dict signature, then calls CreateMulticamClip.
Optional timeline insertion is protected by a timeline backup. Smart Switch is
only attempted on the newly inserted multicam TimelineItem.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
import bridge


SYNC_CONSTANTS = {
    "audio": "MULTICAM_ANGLE_SYNC_AUDIO",
    "timecode": "MULTICAM_ANGLE_SYNC_TIMECODE",
    "in": "MULTICAM_ANGLE_SYNC_IN",
    "out": "MULTICAM_ANGLE_SYNC_OUT",
    "marker": "MULTICAM_ANGLE_SYNC_MARKER",
}
ANGLE_NAME_CONSTANTS = {
    "sequential": "MULTICAM_ANGLE_NAME_SEQUENTIAL",
    "angle": "MULTICAM_ANGLE_NAME_ANGLE",
    "camera": "MULTICAM_ANGLE_NAME_CAMERA",
    "clip": "MULTICAM_ANGLE_NAME_CLIP",
    "file": "MULTICAM_ANGLE_NAME_FILE",
}
AUDIO_MODE_CONSTANTS = {
    "adaptive": "MULTICAM_AUDIO_ADAPTIVE",
    "source": "MULTICAM_AUDIO_SOURCE",
    "reference": "MULTICAM_AUDIO_REFERENCE",
    "all": "MULTICAM_AUDIO_ALL",
}
DETECT_CONSTANTS = {
    "none": "MULTICAM_DETECT_NONE",
    "camera-number": "MULTICAM_DETECT_BY_CAMERA_NUMBER",
    "angle": "MULTICAM_DETECT_BY_ANGLE",
    "reel-number": "MULTICAM_DETECT_BY_REEL_NUMBER",
    "reel-name": "MULTICAM_DETECT_BY_REEL_NAME",
    "roll-card": "MULTICAM_DETECT_BY_ROLL_CARD",
}


def _normalise_path(value: str) -> str:
    path = os.path.realpath(os.path.expanduser(value.strip()))
    return os.path.normcase(path)


def _item_path(item: Any) -> str:
    try:
        value = item.GetClipProperty("File Path")
    except Exception:  # noqa: BLE001 — Resolve proxy
        try:
            value = (item.GetClipProperty() or {}).get("File Path", "")
        except Exception:  # noqa: BLE001
            value = ""
    return _normalise_path(str(value)) if value else ""


def _walk_media_pool(folder: Any, by_path: dict[str, Any], names: set[str]) -> None:
    try:
        clips = folder.GetClipList() or []
    except Exception:  # noqa: BLE001
        clips = []
    for item in clips:
        item_path = _item_path(item)
        if item_path:
            by_path[item_path] = item
        try:
            name = str(item.GetName() or "").strip()
            if name:
                names.add(name.casefold())
        except Exception:  # noqa: BLE001
            pass
    try:
        children = folder.GetSubFolderList() or []
    except Exception:  # noqa: BLE001
        children = []
    for child in children:
        _walk_media_pool(child, by_path, names)


def _unique_name(requested: str, existing_names: set[str]) -> str:
    base = requested.strip() or "Post Agent Multicam"
    if base.casefold() not in existing_names:
        return base
    number = 2
    while f"{base} ({number})".casefold() in existing_names:
        number += 1
    return f"{base} ({number})"


def _enum(resolve: Any, constant_name: str) -> Any:
    value = getattr(resolve, constant_name, None)
    if value is None:
        raise RuntimeError(f"Resolve mangler konstanten {constant_name}")
    return value


def _build_multicam_options(resolve: Any, params: dict[str, Any], name: str) -> tuple[dict[str, Any], list[str]]:
    warnings: list[str] = []
    sync_mode = str(params.get("syncMode") or "audio").strip().lower()
    if sync_mode not in SYNC_CONSTANTS:
        raise ValueError(f"Ukjent syncMode: {sync_mode}")

    angle_name_mode = str(params.get("angleNameMode") or "file").strip().lower()
    if angle_name_mode not in ANGLE_NAME_CONSTANTS:
        raise ValueError(f"Ukjent angleNameMode: {angle_name_mode}")

    audio_mode = str(params.get("multicamAudioMode") or "source").strip().lower()
    if audio_mode not in AUDIO_MODE_CONSTANTS:
        raise ValueError(f"Ukjent multicamAudioMode: {audio_mode}")

    detect_mode = str(params.get("detectSameCameraClipsMode") or "none").strip().lower()
    if detect_mode not in DETECT_CONSTANTS:
        raise ValueError(f"Ukjent detectSameCameraClipsMode: {detect_mode}")

    requested_split = bool(params.get("splitAtGaps", sync_mode == "audio"))
    split_at_gaps = requested_split and sync_mode == "audio"
    if requested_split and not split_at_gaps:
        warnings.append("splitAtGaps gjelder bare audio-sync og ble deaktivert")

    options: dict[str, Any] = {
        "name": name,
        "angleSyncMode": _enum(resolve, SYNC_CONSTANTS[sync_mode]),
        "multicamAudioMode": _enum(resolve, AUDIO_MODE_CONSTANTS[audio_mode]),
        "angleNameMode": _enum(resolve, ANGLE_NAME_CONSTANTS[angle_name_mode]),
        "splitAtGaps": split_at_gaps,
        "useFullClipExtents": bool(params.get("useFullClipExtents", False)),
        "createBinForSourceClips": bool(params.get("createBinForSourceClips", True)),
        "detectSameCameraClipsMode": _enum(resolve, DETECT_CONSTANTS[detect_mode]),
    }
    if sync_mode == "audio":
        channel = int(params.get("channelConfig") or 1)
        if not 1 <= channel <= 8:
            raise ValueError("channelConfig må være mellom 1 og 8")
        options["channelConfig"] = channel
    if params.get("startTimecode"):
        options["startTimecode"] = str(params["startTimecode"])
    if params.get("frameRate") is not None:
        options["frameRate"] = float(params["frameRate"])
    return options, warnings


def _smart_switch_settings(resolve: Any, params: dict[str, Any]) -> dict[str, Any]:
    min_duration = max(0.5, min(10.0, float(params.get("minEditDuration") or 1.5)))
    delay = max(0.0, min(2.0, float(params.get("editChangeDelay") or 0.3)))
    return {
        "minEditDuration": min_duration,
        "editChangeDelay": delay,
        "isAutoDetectWideAngle": True,
        "wideAngleFrequency": _enum(resolve, "SMART_SWITCH_WIDE_ANGLE_FREQ_MEDIUM"),
        "isUseWideAngleForIntroOutro": True,
        "isUseWideAngleForSilence": True,
        "switchOnVideoOnly": False,
        "quality": _enum(resolve, "SMART_SWITCH_QUALITY_BETTER"),
    }


def _backup_timeline(project: Any, timeline: Any) -> str | None:
    try:
        original_name = str(timeline.GetName() or "Timeline")
        stamp = datetime.now().strftime("%H%M%S")
        backup_name = f"{original_name} [backup {stamp}]"
        duplicate = timeline.DuplicateTimeline(backup_name)
        if not duplicate:
            return None
        return backup_name if project.SetCurrentTimeline(timeline) else None
    except Exception:  # noqa: BLE001
        return None


def _item_summary(item: Any) -> dict[str, Any]:
    summary: dict[str, Any] = {"name": None, "uniqueId": None}
    try:
        summary["name"] = item.GetName() or None
    except Exception:  # noqa: BLE001
        pass
    try:
        summary["uniqueId"] = item.GetUniqueId() or None
    except Exception:  # noqa: BLE001
        pass
    return summary


def run(params: dict[str, Any], dry_run: bool) -> None:
    raw_paths = params.get("clipPaths") or []
    if not isinstance(raw_paths, list):
        bridge.error("clipPaths må være en liste")
        raise SystemExit(1)

    paths: list[str] = []
    seen: set[str] = set()
    for raw in raw_paths:
        if not isinstance(raw, str) or not raw.strip():
            continue
        path = _normalise_path(raw)
        if path not in seen:
            paths.append(path)
            seen.add(path)

    if len(paths) < 2:
        bridge.error("Minst to unike klipp er påkrevd for native multicam")
        raise SystemExit(1)
    missing_files = [path for path in paths if not os.path.isfile(path)]
    if missing_files:
        bridge.error("En eller flere kildefiler finnes ikke", missingFiles=missing_files)
        raise SystemExit(1)

    conn = bridge.ResolveConnection()
    if not conn.connect() or not conn.require_project():
        raise SystemExit(1)

    capabilities = bridge.inspect_resolve_capabilities(conn)
    if not capabilities["features"].get("nativeMulticam"):
        bridge.error(
            "Native multicam krever DaVinci Resolve Studio 21.1 eller nyere",
            resolveVersion=capabilities["resolveVersion"],
        )
        raise SystemExit(1)

    project = conn.project
    media_pool = conn.media_pool
    timeline = project.GetCurrentTimeline()
    append_to_timeline = bool(params.get("appendToTimeline", True))
    smart_switch = bool(params.get("smartSwitch", False))
    if append_to_timeline and not timeline:
        bridge.error("Ingen aktiv timeline å sette multicam-klippet inn i")
        raise SystemExit(1)

    by_path: dict[str, Any] = {}
    names: set[str] = set()
    _walk_media_pool(media_pool.GetRootFolder(), by_path, names)
    to_import = [path for path in paths if path not in by_path]
    actual_name = _unique_name(str(params.get("name") or "Post Agent Multicam"), names)
    try:
        options, warnings = _build_multicam_options(conn.resolve, params, actual_name)
    except (TypeError, ValueError, RuntimeError) as exc:
        bridge.error(str(exc))
        raise SystemExit(1) from exc

    manual_offsets = params.get("manualOffsets") or []
    if any(abs(float(value or 0)) > 0.0001 for value in manual_offsets if isinstance(value, (int, float))):
        warnings.append("Manuelle Role Room-offsets kan ikke mates inn i CreateMulticamClip; Resolve synker kildene på nytt")

    preview = {
        "wouldCreate": actual_name,
        "resolveVersion": capabilities["resolveVersion"],
        "clipCount": len(paths),
        "existingInMediaPool": len(paths) - len(to_import),
        "wouldImport": to_import,
        "appendToTimeline": append_to_timeline,
        "backupTimeline": append_to_timeline and bool(params.get("backupTimeline", True)),
        "smartSwitch": smart_switch,
        "syncMode": str(params.get("syncMode") or "audio").lower(),
        "options": options,
        "warnings": warnings,
    }
    if dry_run:
        bridge.result(preview)
        return

    bridge.progress(1, 4, "Klargjør kilder")
    if to_import:
        imported = media_pool.ImportMedia([{"FilePath": path} for path in to_import]) or []
        for item in imported:
            item_path = _item_path(item)
            if item_path:
                by_path[item_path] = item
        unresolved = [path for path in to_import if path not in by_path]
        if unresolved:
            bridge.error("Resolve klarte ikke å importere alle multicam-kildene", unresolved=unresolved)
            raise SystemExit(1)

    source_items = [by_path[path] for path in paths]
    bridge.progress(2, 4, "Oppretter native multicam")
    created_items = media_pool.CreateMulticamClip(source_items, options) or []
    if not created_items:
        bridge.error("CreateMulticamClip returnerte ingen klipp")
        raise SystemExit(1)
    multicam_item = created_items[0]

    backup_name = None
    appended_item = None
    smart_switch_applied = False
    smart_switch_error = None
    if append_to_timeline:
        if bool(params.get("backupTimeline", True)):
            backup_name = _backup_timeline(project, timeline)
            if not backup_name:
                bridge.error(
                    "Kunne ikke opprette og verifisere timeline-backup; multicam-klippet ble opprettet i Media Pool, men ikke satt inn",
                    created=_item_summary(multicam_item),
                )
                raise SystemExit(1)
        bridge.progress(3, 4, "Setter inn på timeline")
        appended = media_pool.AppendToTimeline([{"mediaPoolItem": multicam_item}]) or []
        if appended:
            appended_item = appended[0]
        else:
            warnings.append("Multicam-klippet ble opprettet, men AppendToTimeline returnerte ingen timeline-item")

        if smart_switch and appended_item is not None:
            switch_fn = getattr(appended_item, "PerformMulticamSmartSwitch", None)
            if callable(switch_fn):
                try:
                    smart_switch_applied = bool(switch_fn(_smart_switch_settings(conn.resolve, params)))
                    if not smart_switch_applied:
                        smart_switch_error = "PerformMulticamSmartSwitch returnerte False"
                except Exception as exc:  # noqa: BLE001
                    smart_switch_error = str(exc)
            else:
                smart_switch_error = "TimelineItem mangler PerformMulticamSmartSwitch"
            if smart_switch_error:
                warnings.append(f"Smart Switch ble ikke brukt: {smart_switch_error}")

    bridge.progress(4, 4, "Native multicam ferdig")
    bridge.result({
        "created": _item_summary(multicam_item),
        "resolveVersion": capabilities["resolveVersion"],
        "clipCount": len(source_items),
        "importedCount": len(to_import),
        "syncMode": str(params.get("syncMode") or "audio").lower(),
        "appendedToTimeline": appended_item is not None,
        "backupTimelineName": backup_name,
        "smartSwitchApplied": smart_switch_applied,
        "smartSwitchError": smart_switch_error,
        "warnings": warnings,
    })


if __name__ == "__main__":
    bridge.main_guard(run)
