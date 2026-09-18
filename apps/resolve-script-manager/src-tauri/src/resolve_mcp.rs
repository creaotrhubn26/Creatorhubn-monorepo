//! Allowlisted MCP skills for the Resolve 21.1 server installed with Resolve Studio.
//!
//! Only fixed, audited scripts are exposed. Arbitrary `run_script` and
//! `run_script_unsafe` calls never cross the frontend trust boundary.

use std::env;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex, mpsc};
use std::thread;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::{Value, json};

const MCP_PROTOCOL_VERSION: &str = "2024-11-05";
const INIT_TIMEOUT: Duration = Duration::from_secs(10);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(60);
const STDERR_LIMIT: usize = 8 * 1024;

const PROJECT_DOCTOR_SCRIPT: &str = r#"
def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def count_media(folder, depth=0):
    if folder is None or depth > 32:
        return {"clipCount": 0, "folderCount": 0}
    clips = safe_call(folder.GetClipList, []) or []
    children = safe_call(folder.GetSubFolderList, []) or []
    totals = {"clipCount": len(clips), "folderCount": 1}
    for child in children:
        child_totals = count_media(child, depth + 1)
        totals["clipCount"] += child_totals["clipCount"]
        totals["folderCount"] += child_totals["folderCount"]
    return totals


resolve_version = safe_call(resolve.GetVersionString)
resolve_page = safe_call(resolve.GetCurrentPage)
active_project = project
findings = []

project_data = None
timeline_data = None
media_data = {"clipCount": 0, "folderCount": 0}
selected_settings = {}

if active_project is None:
    findings.append({
        "severity": "error",
        "code": "no_project",
        "title": "Ingen aktivt prosjekt",
        "detail": "Åpne et Resolve-prosjekt og kjør Project Doctor på nytt."
    })
else:
    project_data = {
        "name": safe_call(active_project.GetName),
        "uniqueId": safe_call(active_project.GetUniqueId)
    }
    project_settings = safe_call(active_project.GetSettings, {}) or {}
    media_pool = safe_call(active_project.GetMediaPool)
    root_folder = safe_call(media_pool.GetRootFolder) if media_pool else None
    media_data = count_media(root_folder)

    active_timeline = safe_call(active_project.GetCurrentTimeline)
    if active_timeline is None:
        findings.append({
            "severity": "warning",
            "code": "no_timeline",
            "title": "Ingen aktiv timeline",
            "detail": "Prosjektet er tilgjengelig, men ingen timeline er åpnet."
        })
    else:
        timeline_settings = safe_call(active_timeline.GetSettings, {}) or {}
        track_counts = {}
        item_counts = {}
        for track_type in ("video", "audio", "subtitle"):
            count = int(safe_call(lambda: active_timeline.GetTrackCount(track_type), 0) or 0)
            track_counts[track_type] = count
            item_total = 0
            for track_index in range(1, count + 1):
                item_total += len(safe_call(lambda i=track_index: active_timeline.GetItemListInTrack(track_type, i), []) or [])
            item_counts[track_type] = item_total

        start_frame = int(safe_call(active_timeline.GetStartFrame, 0) or 0)
        end_frame = int(safe_call(active_timeline.GetEndFrame, start_frame) or start_frame)
        timeline_data = {
            "name": safe_call(active_timeline.GetName),
            "uniqueId": safe_call(active_timeline.GetUniqueId),
            "startFrame": start_frame,
            "endFrame": end_frame,
            "durationFrames": max(0, end_frame - start_frame),
            "trackCounts": track_counts,
            "itemCounts": item_counts
        }

        if item_counts["video"] == 0:
            findings.append({
                "severity": "warning",
                "code": "empty_video_timeline",
                "title": "Timeline uten videoklipp",
                "detail": "Den aktive timeline har ingen elementer på videosporene."
            })
        if track_counts["audio"] == 0:
            findings.append({
                "severity": "info",
                "code": "no_audio_tracks",
                "title": "Ingen audiospor",
                "detail": "Den aktive timeline har ingen audiospor."
            })

        def setting_value(key):
            value = timeline_settings.get(key)
            if value is None or value == "":
                value = project_settings.get(key)
            return value

        selected_settings = {
            "timelineResolutionWidth": setting_value("timelineResolutionWidth"),
            "timelineResolutionHeight": setting_value("timelineResolutionHeight"),
            "timelineFrameRate": setting_value("timelineFrameRate"),
            "colorScienceMode": setting_value("colorScienceMode"),
            "perfProxyMediaMode": project_settings.get("perfProxyMediaMode"),
            "perfProxyResolutionRatio": project_settings.get("perfProxyResolutionRatio")
        }
        if not selected_settings["timelineFrameRate"]:
            findings.append({
                "severity": "warning",
                "code": "missing_timeline_fps",
                "title": "Framerate kunne ikke leses",
                "detail": "Kontroller timeline-framerate manuelt før levering."
            })

if not findings:
    findings.append({
        "severity": "ok",
        "code": "baseline_ok",
        "title": "Grunnkontrollen er bestått",
        "detail": "Prosjekt, timeline og grunnleggende sporinnhold er tilgjengelig."
    })

result = {
    "schemaVersion": 1,
    "skillId": "resolve-project-doctor",
    "readOnly": True,
    "resolve": {"version": resolve_version, "page": resolve_page},
    "project": project_data,
    "timeline": timeline_data,
    "mediaPool": media_data,
    "settings": selected_settings,
    "findings": findings
}
"#;

const TIMELINE_QC_SCRIPT: &str = r#"
def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


findings = []
project_data = None
timeline_data = None
track_details = []
gap_samples = []
summary = {
    "videoTracks": 0,
    "audioTracks": 0,
    "subtitleTracks": 0,
    "videoItems": 0,
    "audioItems": 0,
    "disabledItems": 0,
    "emptyTracks": 0,
    "gaps": 0,
    "overlaps": 0
}

active_project = project
if active_project is None:
    findings.append({
        "severity": "error",
        "code": "no_project",
        "title": "Ingen aktivt prosjekt",
        "detail": "Åpne et Resolve-prosjekt og kjør Timeline QC på nytt."
    })
else:
    project_data = {
        "name": safe_call(active_project.GetName),
        "uniqueId": safe_call(active_project.GetUniqueId)
    }
    timeline = safe_call(active_project.GetCurrentTimeline)
    if timeline is None:
        findings.append({
            "severity": "error",
            "code": "no_timeline",
            "title": "Ingen aktiv timeline",
            "detail": "Åpne timeline du vil kontrollere og kjør Timeline QC på nytt."
        })
    else:
        timeline_data = {
            "name": safe_call(timeline.GetName),
            "uniqueId": safe_call(timeline.GetUniqueId),
            "startFrame": int(safe_call(timeline.GetStartFrame, 0) or 0),
            "endFrame": int(safe_call(timeline.GetEndFrame, 0) or 0)
        }
        for track_type in ("video", "audio", "subtitle"):
            track_count = int(safe_call(lambda t=track_type: timeline.GetTrackCount(t), 0) or 0)
            summary[track_type + "Tracks"] = track_count
            for track_index in range(1, track_count + 1):
                items = safe_call(lambda t=track_type, i=track_index: timeline.GetItemListInTrack(t, i), []) or []
                track_name = safe_call(lambda t=track_type, i=track_index: timeline.GetTrackName(t, i), "") or ""
                enabled = bool(safe_call(lambda t=track_type, i=track_index: timeline.GetIsTrackEnabled(t, i), True))
                locked = bool(safe_call(lambda t=track_type, i=track_index: timeline.GetIsTrackLocked(t, i), False))
                summary[track_type + "Items"] = summary.get(track_type + "Items", 0) + len(items)
                if len(items) == 0:
                    summary["emptyTracks"] += 1

                positions = []
                disabled_on_track = 0
                for item in items:
                    start = float(safe_call(item.GetStart, 0) or 0)
                    end = float(safe_call(item.GetEnd, start) or start)
                    positions.append({
                        "name": safe_call(item.GetName, "Uten navn") or "Uten navn",
                        "startFrame": start,
                        "endFrame": end
                    })
                    if safe_call(item.GetClipEnabled, True) is False:
                        disabled_on_track += 1
                summary["disabledItems"] += disabled_on_track

                positions.sort(key=lambda item: item["startFrame"])
                if track_type == "video" and len(positions) > 1:
                    previous_end = positions[0]["endFrame"]
                    for item in positions[1:]:
                        if item["startFrame"] > previous_end:
                            summary["gaps"] += 1
                            if len(gap_samples) < 12:
                                gap_samples.append({
                                    "trackIndex": track_index,
                                    "startFrame": previous_end,
                                    "endFrame": item["startFrame"],
                                    "durationFrames": item["startFrame"] - previous_end
                                })
                        elif item["startFrame"] < previous_end:
                            summary["overlaps"] += 1
                        previous_end = max(previous_end, item["endFrame"])

                track_details.append({
                    "type": track_type,
                    "index": track_index,
                    "name": track_name,
                    "enabled": enabled,
                    "locked": locked,
                    "itemCount": len(items),
                    "disabledItemCount": disabled_on_track
                })

        if summary["videoItems"] == 0:
            findings.append({
                "severity": "error",
                "code": "timeline_no_video",
                "title": "Ingen videoklipp",
                "detail": "Den aktive timeline har ingen elementer på videosporene."
            })
        if summary["gaps"] > 0:
            findings.append({
                "severity": "warning",
                "code": "timeline_video_gaps",
                "title": "Gap på videospor",
                "detail": str(summary["gaps"]) + " gap ble funnet mellom klipp på individuelle videospor."
            })
        if summary["disabledItems"] > 0:
            findings.append({
                "severity": "warning",
                "code": "timeline_disabled_items",
                "title": "Deaktiverte timeline-elementer",
                "detail": str(summary["disabledItems"]) + " elementer er deaktivert. Kontroller at dette er tilsiktet."
            })
        if summary["audioTracks"] == 0:
            findings.append({
                "severity": "warning",
                "code": "timeline_no_audio_tracks",
                "title": "Ingen audiospor",
                "detail": "Timeline har ingen audiospor."
            })

if not findings:
    findings.append({
        "severity": "ok",
        "code": "timeline_qc_ok",
        "title": "Timeline-grunnkontrollen er bestått",
        "detail": "Ingen gap, deaktiverte klipp eller manglende hovedspor ble funnet."
    })

result = {
    "schemaVersion": 1,
    "skillId": "resolve-timeline-qc",
    "readOnly": True,
    "resolve": {"version": safe_call(resolve.GetVersionString), "page": safe_call(resolve.GetCurrentPage)},
    "project": project_data,
    "timeline": timeline_data,
    "summary": summary,
    "details": {"tracks": track_details, "gapSamples": gap_samples},
    "findings": findings
}
"#;

const MEDIA_HEALTH_SCRIPT: &str = r#"
def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


clips = []
folder_count = 0


def scan_folder(folder, folder_path="", depth=0):
    global folder_count
    if folder is None or depth > 32:
        return
    folder_count += 1
    folder_name = safe_call(folder.GetName, "") or ""
    current_path = folder_name if not folder_path else folder_path + "/" + folder_name
    for clip in (safe_call(folder.GetClipList, []) or []):
        properties = safe_call(clip.GetClipProperty, {}) or {}
        clips.append({
            "name": safe_call(clip.GetName, "Uten navn") or "Uten navn",
            "mediaId": safe_call(clip.GetMediaId),
            "folder": current_path,
            "type": str(properties.get("Type") or ""),
            "filePath": str(properties.get("File Path") or ""),
            "onlineStatus": str(properties.get("Online Status") or ""),
            "proxyStatus": str(properties.get("Proxy") or ""),
            "proxyPath": str(properties.get("Proxy Media Path") or ""),
            "resolution": str(properties.get("Resolution") or ""),
            "fps": properties.get("FPS"),
            "videoCodec": str(properties.get("Video Codec") or ""),
            "audioCodec": str(properties.get("Audio Codec") or "")
        })
    for child in (safe_call(folder.GetSubFolderList, []) or []):
        scan_folder(child, current_path, depth + 1)


findings = []
project_data = None
offline_samples = []
missing_path_samples = []
duplicate_samples = []
summary = {
    "totalClips": 0,
    "totalFolders": 0,
    "offlineClips": 0,
    "missingSourcePaths": 0,
    "clipsWithProxy": 0,
    "duplicateSourceGroups": 0
}

active_project = project
if active_project is None:
    findings.append({
        "severity": "error",
        "code": "no_project",
        "title": "Ingen aktivt prosjekt",
        "detail": "Åpne et Resolve-prosjekt og kjør Media Health på nytt."
    })
else:
    project_data = {
        "name": safe_call(active_project.GetName),
        "uniqueId": safe_call(active_project.GetUniqueId)
    }
    media_pool = safe_call(active_project.GetMediaPool)
    root_folder = safe_call(media_pool.GetRootFolder) if media_pool else None
    scan_folder(root_folder)

    path_groups = {}
    for clip in clips:
        status = clip["onlineStatus"].strip().lower()
        clip_type = clip["type"].strip().lower()
        file_path = clip["filePath"].strip()
        proxy_status = clip["proxyStatus"].strip().lower()
        proxy_path = clip["proxyPath"].strip()

        if "offline" in status:
            summary["offlineClips"] += 1
            if len(offline_samples) < 12:
                offline_samples.append({"name": clip["name"]})
        if not file_path and clip_type not in ("timeline", "generator", "compound clip", "fusion composition"):
            summary["missingSourcePaths"] += 1
            if len(missing_path_samples) < 12:
                missing_path_samples.append({"name": clip["name"], "type": clip["type"]})
        if proxy_path or (proxy_status and proxy_status not in ("none", "no", "0", "false", "offline")):
            summary["clipsWithProxy"] += 1
        if file_path:
            normalized_path = file_path
            if normalized_path not in path_groups:
                path_groups[normalized_path] = []
            path_groups[normalized_path].append(clip["name"])

    for source_path in path_groups:
        names = path_groups[source_path]
        if len(names) > 1:
            summary["duplicateSourceGroups"] += 1
            if len(duplicate_samples) < 12:
                duplicate_samples.append({"clipNames": names[:8]})

    summary["totalClips"] = len(clips)
    summary["totalFolders"] = folder_count
    if len(clips) == 0:
        findings.append({
            "severity": "info",
            "code": "media_pool_empty",
            "title": "Media Pool er tom",
            "detail": "Ingen medieklipp ble funnet i prosjektets Media Pool."
        })
    if summary["offlineClips"] > 0:
        findings.append({
            "severity": "error",
            "code": "offline_media",
            "title": "Offline media",
            "detail": str(summary["offlineClips"]) + " klipp rapporteres som offline av Resolve."
        })
    if summary["missingSourcePaths"] > 0:
        findings.append({
            "severity": "warning",
            "code": "missing_source_paths",
            "title": "Manglende kildebaner",
            "detail": str(summary["missingSourcePaths"]) + " kildeklipp mangler lesbar File Path-metadata."
        })
    if summary["duplicateSourceGroups"] > 0:
        findings.append({
            "severity": "warning",
            "code": "duplicate_sources",
            "title": "Samme kildefil flere steder",
            "detail": str(summary["duplicateSourceGroups"]) + " kildebaner brukes av flere Media Pool-elementer."
        })

if not findings:
    findings.append({
        "severity": "ok",
        "code": "media_health_ok",
        "title": "Mediekontrollen er bestått",
        "detail": "Ingen offline media, manglende kildebaner eller dupliserte kilder ble funnet."
    })

result = {
    "schemaVersion": 1,
    "skillId": "resolve-media-health",
    "readOnly": True,
    "resolve": {"version": safe_call(resolve.GetVersionString), "page": safe_call(resolve.GetCurrentPage)},
    "project": project_data,
    "timeline": None,
    "summary": summary,
    "details": {
        "offlineSamples": offline_samples,
        "missingPathSamples": missing_path_samples,
        "duplicateSamples": duplicate_samples
    },
    "findings": findings
}
"#;

const DELIVERY_QC_SCRIPT: &str = r#"
def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def first_value(primary, fallback, key):
    value = primary.get(key)
    if value is None or value == "":
        value = fallback.get(key)
    return value


findings = []
project_data = None
timeline_data = None
details = {}
summary = {
    "outputWidth": None,
    "outputHeight": None,
    "timelineFrameRate": None,
    "audioSampleRate": None,
    "videoItems": 0,
    "audioTracks": 0,
    "subtitleTracks": 0,
    "renderQueueCount": 0
}

active_project = project
if active_project is None:
    findings.append({
        "severity": "error",
        "code": "no_project",
        "title": "Ingen aktivt prosjekt",
        "detail": "Åpne et Resolve-prosjekt og kjør Delivery QC på nytt."
    })
else:
    project_data = {
        "name": safe_call(active_project.GetName),
        "uniqueId": safe_call(active_project.GetUniqueId)
    }
    project_settings = safe_call(active_project.GetSettings, {}) or {}
    render_selection = safe_call(active_project.GetCurrentRenderFormatAndCodec, {}) or {}
    render_jobs = safe_call(active_project.GetRenderJobList, []) or []
    render_mode = safe_call(active_project.GetCurrentRenderMode)
    summary["renderQueueCount"] = len(render_jobs)
    details["render"] = {
        "format": render_selection.get("format"),
        "codec": render_selection.get("codec"),
        "mode": render_mode,
        "queueCount": len(render_jobs)
    }

    timeline = safe_call(active_project.GetCurrentTimeline)
    if timeline is None:
        findings.append({
            "severity": "error",
            "code": "delivery_no_timeline",
            "title": "Ingen aktiv timeline",
            "detail": "Åpne timeline som skal leveres og kjør Delivery QC på nytt."
        })
    else:
        timeline_settings = safe_call(timeline.GetSettings, {}) or {}
        timeline_data = {
            "name": safe_call(timeline.GetName),
            "uniqueId": safe_call(timeline.GetUniqueId),
            "startFrame": int(safe_call(timeline.GetStartFrame, 0) or 0),
            "endFrame": int(safe_call(timeline.GetEndFrame, 0) or 0)
        }
        width = first_value(timeline_settings, project_settings, "timelineOutputResolutionWidth")
        height = first_value(timeline_settings, project_settings, "timelineOutputResolutionHeight")
        if not width or not height:
            width = first_value(timeline_settings, project_settings, "timelineResolutionWidth")
            height = first_value(timeline_settings, project_settings, "timelineResolutionHeight")
        fps = first_value(timeline_settings, project_settings, "timelineFrameRate")
        sample_rate = project_settings.get("timelineSampleRate")
        video_tracks = int(safe_call(lambda: timeline.GetTrackCount("video"), 0) or 0)
        audio_tracks = int(safe_call(lambda: timeline.GetTrackCount("audio"), 0) or 0)
        subtitle_tracks = int(safe_call(lambda: timeline.GetTrackCount("subtitle"), 0) or 0)
        video_items = 0
        for track_index in range(1, video_tracks + 1):
            video_items += len(safe_call(lambda i=track_index: timeline.GetItemListInTrack("video", i), []) or [])

        summary["outputWidth"] = width
        summary["outputHeight"] = height
        summary["timelineFrameRate"] = fps
        summary["audioSampleRate"] = sample_rate
        summary["videoItems"] = video_items
        summary["audioTracks"] = audio_tracks
        summary["subtitleTracks"] = subtitle_tracks
        details["color"] = {
            "scienceMode": first_value(timeline_settings, project_settings, "colorScienceMode"),
            "outputColorSpace": first_value(timeline_settings, project_settings, "colorSpaceOutput"),
            "outputGamma": first_value(timeline_settings, project_settings, "colorSpaceOutputGamma")
        }

        if video_items == 0:
            findings.append({
                "severity": "error",
                "code": "delivery_no_video",
                "title": "Ingen videoinnhold",
                "detail": "Timeline har ingen videoklipp å levere."
            })
        if not width or not height:
            findings.append({
                "severity": "warning",
                "code": "delivery_resolution_unknown",
                "title": "Ukjent leveranseoppløsning",
                "detail": "Resolve returnerte ikke output- eller timeline-oppløsning."
            })
        if not fps:
            findings.append({
                "severity": "warning",
                "code": "delivery_fps_unknown",
                "title": "Ukjent framerate",
                "detail": "Kontroller framerate manuelt før levering."
            })
        if audio_tracks == 0:
            findings.append({
                "severity": "warning",
                "code": "delivery_no_audio",
                "title": "Ingen audiospor",
                "detail": "Timeline har ingen audiospor."
            })
        if sample_rate and str(sample_rate) != "48000":
            findings.append({
                "severity": "warning",
                "code": "delivery_audio_sample_rate",
                "title": "Kontroller audio sample rate",
                "detail": "Prosjektet bruker " + str(sample_rate) + " Hz; standardprofilen forventer 48000 Hz."
            })
        if not render_selection.get("format") or not render_selection.get("codec"):
            findings.append({
                "severity": "info",
                "code": "delivery_render_selection_missing",
                "title": "Renderformat er ikke komplett",
                "detail": "Velg format og codec på Deliver-siden før endelig eksport."
            })

if not findings:
    findings.append({
        "severity": "ok",
        "code": "delivery_qc_ok",
        "title": "Grunnleggende leveransekontroll er bestått",
        "detail": "Timeline, bildeformat, framerate, lyd og rendervalg er tilgjengelig."
    })

result = {
    "schemaVersion": 1,
    "skillId": "resolve-delivery-qc",
    "profileId": "web-master-v1",
    "readOnly": True,
    "resolve": {"version": safe_call(resolve.GetVersionString), "page": safe_call(resolve.GetCurrentPage)},
    "project": project_data,
    "timeline": timeline_data,
    "summary": summary,
    "details": details,
    "findings": findings
}
"#;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveMcpSkillDefinition {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub access: &'static str,
    pub status: &'static str,
    pub read_only: bool,
    pub requires_timeline: bool,
    pub supports_plan: bool,
    pub supports_apply: bool,
}

pub fn skills() -> Vec<ResolveMcpSkillDefinition> {
    vec![
        ResolveMcpSkillDefinition {
            id: "resolve-project-doctor",
            name: "Project Doctor",
            description: "Kontrollerer prosjekt, timeline, spor, Media Pool og grunninnstillinger.",
            access: "read-only",
            status: "available",
            read_only: true,
            requires_timeline: false,
            supports_plan: false,
            supports_apply: false,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-timeline-qc",
            name: "Timeline QC",
            description: "Finner gaps, deaktiverte klipp, tomme spor og manglende bilde eller lyd.",
            access: "read-only",
            status: "available",
            read_only: true,
            requires_timeline: true,
            supports_plan: false,
            supports_apply: false,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-media-health",
            name: "Media Health",
            description: "Finner offline media, manglende kildebaner, proxy-status og duplikater.",
            access: "read-only",
            status: "available",
            read_only: true,
            requires_timeline: false,
            supports_plan: false,
            supports_apply: false,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-delivery-qc",
            name: "Delivery QC",
            description: "Validerer timeline, output-format, framerate, lyd og rendervalg før eksport.",
            access: "read-only",
            status: "available",
            read_only: true,
            requires_timeline: true,
            supports_plan: false,
            supports_apply: false,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-project-organizer",
            name: "Project Organizer",
            description: "Planlegger bins, klippnavn og prosjektstruktur før godkjent organisering.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: false,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-transcript-editor",
            name: "Transcript Editor",
            description: "Bygger selects og rough cut fra transkripsjon, manus og valgte sitater.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: false,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-multicam-director",
            name: "Multicam Director",
            description: "Synkroniserer kamera og lyd og foreslår kamerabytter med Smart Switch.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: true,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-audio-post",
            name: "Audio Post",
            description: "Analyserer dialog og foreslår godkjent Fairlight-opprydding og miks.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: true,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-color-guardian",
            name: "Color Guardian",
            description: "Kontrollerer color management og foreslår konsistent shot matching.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: true,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-review-notes",
            name: "Review Notes",
            description: "Gjør tidskodede kommentarer om til en kontrollert endringsplan.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: true,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-batch-render-planner",
            name: "Batch Render Planner",
            description: "Legger godkjente ProRes-, H.265- og proxy-jobber i renderkøen uten å starte rendering.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: true,
            supports_plan: true,
            supports_apply: true,
        },
        ResolveMcpSkillDefinition {
            id: "resolve-v1-clip-renamer",
            name: "V1 Clip Renamer",
            description: "Forhåndsviser og navngir timeline-klipp på V1 sekvensielt med betinget rollback.",
            access: "approval-required",
            status: "available",
            read_only: false,
            requires_timeline: true,
            supports_plan: true,
            supports_apply: true,
        },
    ]
}

fn script_for_skill(skill_id: &str) -> Option<&'static str> {
    match skill_id {
        "resolve-project-doctor" => Some(PROJECT_DOCTOR_SCRIPT),
        "resolve-timeline-qc" => Some(TIMELINE_QC_SCRIPT),
        "resolve-media-health" => Some(MEDIA_HEALTH_SCRIPT),
        "resolve-delivery-qc" => Some(DELIVERY_QC_SCRIPT),
        _ => None,
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveMcpStatus {
    pub installed: bool,
    pub available: bool,
    pub binary_path: Option<String>,
    pub protocol_version: Option<String>,
    pub server_version: Option<String>,
    pub tool_count: usize,
    pub tool_names: Vec<String>,
    pub resolve_reachable: bool,
    pub resolve_status: Option<Value>,
    pub message: String,
}

impl ResolveMcpStatus {
    fn unavailable(message: String, binary_path: Option<String>, installed: bool) -> Self {
        Self {
            installed,
            available: false,
            binary_path,
            protocol_version: None,
            server_version: None,
            tool_count: 0,
            tool_names: Vec::new(),
            resolve_reachable: false,
            resolve_status: None,
            message,
        }
    }
}

struct McpSession {
    child: Child,
    stdin: ChildStdin,
    responses: mpsc::Receiver<Value>,
    stderr: Arc<Mutex<String>>,
    next_id: u64,
}

impl McpSession {
    fn connect(binary_path: &Path) -> Result<(Self, Value), String> {
        let mut child = Command::new(binary_path)
            .env("BMD_IS_MCPB", "1")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| format!("Kunne ikke starte ResolveMCP: {err}"))?;

        let stdin = child.stdin.take().ok_or("ResolveMCP stdin mangler")?;
        let stdout = child.stdout.take().ok_or("ResolveMCP stdout mangler")?;
        let stderr = child.stderr.take().ok_or("ResolveMCP stderr mangler")?;
        let (sender, responses) = mpsc::channel();
        let stderr_log = Arc::new(Mutex::new(String::new()));
        let stderr_for_thread = Arc::clone(&stderr_log);

        thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Ok(value) = serde_json::from_str::<Value>(&line) {
                    if sender.send(value).is_err() {
                        break;
                    }
                }
            }
        });

        thread::spawn(move || {
            let mut reader = BufReader::new(stderr);
            let mut buffer = String::new();
            let _ = reader.read_to_string(&mut buffer);
            if buffer.len() > STDERR_LIMIT {
                let mut end = STDERR_LIMIT;
                while !buffer.is_char_boundary(end) {
                    end -= 1;
                }
                buffer.truncate(end);
            }
            if let Ok(mut target) = stderr_for_thread.lock() {
                *target = buffer;
            }
        });

        let mut session = Self {
            child,
            stdin,
            responses,
            stderr: stderr_log,
            next_id: 1,
        };
        let init = session.request(
            "initialize",
            json!({
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {
                    "name": "role-room-post-agent",
                    "version": env!("CARGO_PKG_VERSION")
                }
            }),
            INIT_TIMEOUT,
        )?;
        let server_name = init
            .pointer("/serverInfo/name")
            .and_then(Value::as_str)
            .unwrap_or_default();
        if server_name != "davinci_resolve" {
            return Err(format!("Uventet MCP-server: {server_name}"));
        }
        session.notify("notifications/initialized", json!({}))?;
        Ok((session, init))
    }

    fn notify(&mut self, method: &str, params: Value) -> Result<(), String> {
        self.write_message(&json!({
            "jsonrpc": "2.0",
            "method": method,
            "params": params
        }))
    }

    fn request(&mut self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let id = format!("post-agent-{}", self.next_id);
        self.next_id += 1;
        self.write_message(&json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params
        }))?;
        self.wait_for_response(&id, timeout)
    }

    fn write_message(&mut self, message: &Value) -> Result<(), String> {
        let mut line = serde_json::to_vec(message).map_err(|err| err.to_string())?;
        line.push(b'\n');
        self.stdin
            .write_all(&line)
            .and_then(|_| self.stdin.flush())
            .map_err(|err| format!("Kunne ikke skrive til ResolveMCP: {err}"))
    }

    fn wait_for_response(&self, id: &str, timeout: Duration) -> Result<Value, String> {
        let deadline = Instant::now() + timeout;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err(format!(
                    "ResolveMCP svarte ikke innen {} sekunder",
                    timeout.as_secs()
                ));
            }
            let message = self
                .responses
                .recv_timeout(remaining)
                .map_err(|err| match err {
                    mpsc::RecvTimeoutError::Timeout => {
                        format!(
                            "ResolveMCP svarte ikke innen {} sekunder",
                            timeout.as_secs()
                        )
                    }
                    mpsc::RecvTimeoutError::Disconnected => {
                        let stderr = self.stderr.lock().map(|s| s.clone()).unwrap_or_default();
                        if stderr.trim().is_empty() {
                            "ResolveMCP avsluttet forbindelsen".to_string()
                        } else {
                            format!("ResolveMCP avsluttet forbindelsen: {}", stderr.trim())
                        }
                    }
                })?;
            if message.get("id").and_then(Value::as_str) != Some(id) {
                continue;
            }
            if let Some(error) = message.get("error") {
                let detail = error
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("ukjent MCP-feil");
                return Err(format!("ResolveMCP: {detail}"));
            }
            return message
                .get("result")
                .cloned()
                .ok_or_else(|| "ResolveMCP-respons mangler result".to_string());
        }
    }
}

impl Drop for McpSession {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn binary_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if cfg!(target_os = "macos") {
        candidates.push(PathBuf::from(
            "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Applications/ResolveMCP",
        ));
        candidates.push(PathBuf::from(
            "/Applications/DaVinci Resolve.app/Contents/Applications/ResolveMCP",
        ));
        candidates.push(PathBuf::from(
            "/Applications/DaVinci Resolve Studio.app/Contents/Applications/ResolveMCP",
        ));
    } else if cfg!(target_os = "windows") {
        let program_files = env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".into());
        candidates.push(
            PathBuf::from(program_files)
                .join("Blackmagic Design")
                .join("DaVinci Resolve")
                .join("ResolveMCP.exe"),
        );
    } else {
        candidates.push(PathBuf::from("/opt/resolve/bin/ResolveMCP"));
    }
    candidates
}

fn find_binary() -> Option<PathBuf> {
    binary_candidates()
        .into_iter()
        .find(|candidate| candidate.is_file())
        .map(|candidate| candidate.canonicalize().unwrap_or(candidate))
}

fn unwrap_mcp_payload(mut value: Value) -> Value {
    for _ in 0..4 {
        let text = value
            .get("content")
            .and_then(Value::as_array)
            .and_then(|content| {
                content
                    .iter()
                    .find(|item| item.get("type").and_then(Value::as_str) == Some("text"))
            })
            .and_then(|item| item.get("text"))
            .and_then(Value::as_str)
            .map(str::to_string);
        let Some(text) = text else { break };
        value = serde_json::from_str(&text).unwrap_or(Value::String(text));
    }
    value
}

fn find_bool(value: &Value, keys: &[&str]) -> Option<bool> {
    match value {
        Value::Object(map) => {
            for key in keys {
                if let Some(value) = map.get(*key).and_then(Value::as_bool) {
                    return Some(value);
                }
            }
            map.values().find_map(|value| find_bool(value, keys))
        }
        Value::Array(values) => values.iter().find_map(|value| find_bool(value, keys)),
        _ => None,
    }
}

fn error_text(value: &Value) -> Option<String> {
    if let Some(text) = value.as_str() {
        return Some(text.to_string());
    }
    if let Some(map) = value.as_object() {
        for key in ["message", "error", "detail", "text"] {
            if let Some(text) = map.get(key).and_then(Value::as_str) {
                return Some(text.to_string());
            }
        }
        for child in map.values() {
            if let Some(text) = error_text(child) {
                return Some(text);
            }
        }
    }
    if let Some(values) = value.as_array() {
        for child in values {
            if let Some(text) = error_text(child) {
                return Some(text);
            }
        }
    }
    None
}

fn extract_skill_report(value: Value, expected_skill_id: &str) -> Result<Value, String> {
    let value = unwrap_mcp_payload(value);
    if value.get("isError").and_then(Value::as_bool) == Some(true) {
        return Err(error_text(&value).unwrap_or_else(|| {
            format!("Resolve-skillen {expected_skill_id} feilet i ResolveMCP")
        }));
    }
    let report = if value.get("schemaVersion").is_some() {
        value
    } else if let Some(result) = value.get("result") {
        let result = unwrap_mcp_payload(result.clone());
        if result.get("schemaVersion").is_some() {
            result
        } else {
            return Err(format!(
                "ResolveMCP returnerte et ukjent rapportformat: {}",
                result
            ));
        }
    } else {
        return Err(format!(
            "ResolveMCP returnerte et ukjent rapportformat: {}",
            value
        ));
    };
    if report.get("skillId").and_then(Value::as_str) != Some(expected_skill_id) {
        return Err(format!(
            "ResolveMCP-rapporten matcher ikke valgt skill {expected_skill_id}"
        ));
    }
    if report.get("readOnly").and_then(Value::as_bool) != Some(true) {
        return Err(format!(
            "ResolveMCP-rapporten for {expected_skill_id} mangler read-only-garantien"
        ));
    }
    Ok(report)
}

fn status_blocking() -> ResolveMcpStatus {
    let Some(binary_path) = find_binary() else {
        return ResolveMcpStatus::unavailable(
            "ResolveMCP ble ikke funnet. Installer DaVinci Resolve Studio 21.1 eller nyere.".into(),
            None,
            false,
        );
    };
    let binary_display = binary_path.display().to_string();
    let (mut session, init) = match McpSession::connect(&binary_path) {
        Ok(value) => value,
        Err(err) => {
            return ResolveMcpStatus::unavailable(err, Some(binary_display), true);
        }
    };

    let protocol_version = init
        .get("protocolVersion")
        .and_then(Value::as_str)
        .map(str::to_string);
    let server_version = init
        .pointer("/serverInfo/version")
        .and_then(Value::as_str)
        .map(str::to_string);
    let instructions = init
        .get("instructions")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let tools = session.request("tools/list", json!({}), INIT_TIMEOUT);
    let tool_names = tools
        .as_ref()
        .ok()
        .and_then(|value| value.get("tools"))
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("name").and_then(Value::as_str).map(str::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let supports_doctor = tool_names.iter().any(|name| name == "get_resolve_status")
        && tool_names.iter().any(|name| name == "run_script");
    let resolve_status = if supports_doctor {
        session
            .request(
                "tools/call",
                json!({"name": "get_resolve_status", "arguments": {}}),
                INIT_TIMEOUT,
            )
            .ok()
            .map(unwrap_mcp_payload)
    } else {
        None
    };
    let resolve_reachable = resolve_status
        .as_ref()
        .and_then(|value| {
            find_bool(
                value,
                &["running", "reachable", "connected", "resolveRunning"],
            )
        })
        .unwrap_or(false);
    let message = if resolve_reachable && supports_doctor {
        "Resolve MCP er klar og et Resolve-prosjekt kan analyseres.".to_string()
    } else if !supports_doctor {
        "Resolve MCP mangler de påkrevde read-only-verktøyene get_resolve_status og run_script."
            .to_string()
    } else if !instructions.is_empty() {
        instructions
    } else {
        "Resolve MCP er installert, men Resolve er ikke tilgjengelig.".to_string()
    };

    ResolveMcpStatus {
        installed: true,
        available: supports_doctor,
        binary_path: Some(binary_display),
        protocol_version,
        server_version,
        tool_count: tool_names.len(),
        tool_names,
        resolve_reachable,
        resolve_status,
        message,
    }
}

fn run_skill_blocking(skill_id: &str) -> Result<Value, String> {
    let known_skill = skills().into_iter().any(|skill| skill.id == skill_id);
    if !known_skill {
        return Err(format!("Ukjent Resolve-skill: {skill_id}"));
    }
    let script = script_for_skill(skill_id).ok_or_else(|| {
        format!(
            "Resolve-skillen {skill_id} er planlagt, men er ikke aktivert før godkjenningslaget er på plass"
        )
    })?;
    let binary_path = find_binary().ok_or_else(|| {
        "ResolveMCP ble ikke funnet. Installer DaVinci Resolve Studio 21.1 eller nyere.".to_string()
    })?;
    let (mut session, _) = McpSession::connect(&binary_path)?;
    let tools = session.request("tools/list", json!({}), INIT_TIMEOUT)?;
    let names = tools
        .get("tools")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.get("name").and_then(Value::as_str))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if !names.contains(&"get_resolve_status") || !names.contains(&"run_script") {
        return Err("Resolve MCP mangler de påkrevde read-only-verktøyene".into());
    }

    let status = session.request(
        "tools/call",
        json!({"name": "get_resolve_status", "arguments": {}}),
        INIT_TIMEOUT,
    )?;
    let status = unwrap_mcp_payload(status);
    if find_bool(
        &status,
        &["running", "reachable", "connected", "resolveRunning"],
    ) == Some(false)
    {
        return Err(
            "Resolve 21.1 er ikke tilgjengelig via MCP. Start Resolve, åpne et prosjekt og kjør File → Setup AI Assistants.".into(),
        );
    }

    let response = session.request(
        "tools/call",
        json!({
            "name": "run_script",
            "arguments": {
                "script": script,
                "timeout": 20
            }
        }),
        REQUEST_TIMEOUT,
    )?;
    extract_skill_report(response, skill_id)
}

fn call_tool_blocking(
    tool_name: &str,
    arguments: Value,
    timeout: Duration,
) -> Result<Value, String> {
    let binary_path = find_binary().ok_or_else(|| {
        "ResolveMCP ble ikke funnet. Installer DaVinci Resolve Studio 21.1 eller nyere.".to_string()
    })?;
    let (mut session, _) = McpSession::connect(&binary_path)?;
    let tools = session.request("tools/list", json!({}), INIT_TIMEOUT)?;
    let is_available = tools
        .get("tools")
        .and_then(Value::as_array)
        .is_some_and(|items| {
            items
                .iter()
                .any(|item| item.get("name").and_then(Value::as_str) == Some(tool_name))
        });
    if !is_available {
        return Err(format!(
            "Resolve MCP mangler det påkrevde verktøyet {tool_name}"
        ));
    }
    let response = session.request(
        "tools/call",
        json!({"name": tool_name, "arguments": arguments}),
        timeout,
    )?;
    let response = unwrap_mcp_payload(response);
    if response.get("isError").and_then(Value::as_bool) == Some(true) {
        return Err(error_text(&response)
            .unwrap_or_else(|| format!("Resolve MCP-verktøyet {tool_name} feilet")));
    }
    Ok(unwrap_mcp_payload(response))
}

/// Internal, allowlisted MCP tool call used by the gateway. This function is
/// intentionally not registered as a Tauri command: the frontend can never
/// select a raw MCP tool or provide an arbitrary script.
pub(crate) async fn call_tool(
    tool_name: &'static str,
    arguments: Value,
    timeout: Duration,
) -> Result<Value, String> {
    tokio::task::spawn_blocking(move || call_tool_blocking(tool_name, arguments, timeout))
        .await
        .map_err(|err| format!("Resolve MCP-verktøyoppgaven feilet: {err}"))?
}

pub(crate) async fn run_allowlisted_script(script: String) -> Result<Value, String> {
    if script.len() > 256 * 1024 {
        return Err("Internt Resolve-script overskrider 256 KiB-grensen".into());
    }
    let mut result = call_tool(
        "run_script",
        json!({"script": script, "timeout": 60}),
        REQUEST_TIMEOUT,
    )
    .await?;
    if let Some(inner) = result.get("result").cloned() {
        result = unwrap_mcp_payload(inner);
    }
    if !result.is_object() {
        return Err("Resolve MCP returnerte ikke et strukturert resultat".into());
    }
    Ok(result)
}

pub async fn status() -> ResolveMcpStatus {
    tokio::task::spawn_blocking(status_blocking)
        .await
        .unwrap_or_else(|err| {
            ResolveMcpStatus::unavailable(format!("MCP-statusoppgaven feilet: {err}"), None, false)
        })
}

pub async fn run_skill(skill_id: String) -> Result<Value, String> {
    tokio::task::spawn_blocking(move || run_skill_blocking(&skill_id))
        .await
        .map_err(|err| format!("Resolve-skilloppgaven feilet: {err}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unwraps_json_text_content() {
        let wrapped = json!({
            "content": [{"type": "text", "text": "{\"running\":true,\"version\":\"21.1\"}"}]
        });
        assert_eq!(unwrap_mcp_payload(wrapped)["running"], true);
    }

    #[test]
    fn extracts_nested_skill_result() {
        let wrapped = json!({
            "content": [{
                "type": "text",
                "text": "{\"result\":{\"schemaVersion\":1,\"skillId\":\"resolve-project-doctor\",\"readOnly\":true}}"
            }]
        });
        let report = extract_skill_report(wrapped, "resolve-project-doctor").expect("report");
        assert_eq!(report["schemaVersion"], 1);
        assert_eq!(report["readOnly"], true);
    }

    #[test]
    fn catalog_contains_twelve_unique_available_skills() {
        let skills = skills();
        assert_eq!(skills.len(), 12);
        let mut ids = skills.iter().map(|skill| skill.id).collect::<Vec<_>>();
        ids.sort_unstable();
        ids.dedup();
        assert_eq!(ids.len(), 12);
        assert!(ids.contains(&"resolve-batch-render-planner"));
        assert!(ids.contains(&"resolve-v1-clip-renamer"));
        assert_eq!(
            skills
                .iter()
                .filter(|skill| skill.status == "available")
                .count(),
            12
        );
        assert!(
            skills
                .iter()
                .filter(|skill| skill.read_only)
                .all(|skill| skill.read_only && script_for_skill(skill.id).is_some())
        );
        assert_eq!(skills.iter().filter(|skill| skill.supports_plan).count(), 8);
        assert_eq!(
            skills.iter().filter(|skill| skill.supports_apply).count(),
            8
        );
    }

    #[test]
    fn approval_skills_cannot_bypass_the_gateway() {
        let planned = run_skill_blocking("resolve-project-organizer").unwrap_err();
        assert!(planned.contains("godkjenningslaget"));
        let unknown = run_skill_blocking("resolve-delete-everything").unwrap_err();
        assert!(unknown.contains("Ukjent Resolve-skill"));
    }

    #[test]
    fn installed_server_exposes_the_required_safe_tools() {
        if find_binary().is_none() {
            return;
        }
        let status = status_blocking();
        assert!(status.installed, "{}", status.message);
        assert!(status.available, "{}", status.message);
        assert_eq!(
            status.protocol_version.as_deref(),
            Some(MCP_PROTOCOL_VERSION)
        );
        assert!(
            status
                .tool_names
                .iter()
                .any(|name| name == "get_resolve_status")
        );
        assert!(status.tool_names.iter().any(|name| name == "run_script"));
        assert!(!status.tool_names.is_empty());
    }

    #[test]
    fn installed_server_executes_available_skills_when_resolve_is_reachable() {
        if find_binary().is_none() {
            return;
        }
        let status = status_blocking();
        if !status.resolve_reachable {
            return;
        }
        for skill in skills().into_iter().filter(|skill| skill.read_only) {
            let report = run_skill_blocking(skill.id)
                .unwrap_or_else(|err| panic!("{} failed against Resolve: {err}", skill.id));
            assert_eq!(report["skillId"], skill.id);
            assert_eq!(report["readOnly"], true);
            assert!(report["findings"].is_array());
        }
    }

    #[test]
    fn available_skill_scripts_have_no_mutating_resolve_calls() {
        for skill in skills().into_iter().filter(|skill| skill.read_only) {
            let script = script_for_skill(skill.id).expect("available skill script");
            for forbidden in [
                ".Set",
                ".Add",
                ".Delete",
                ".Import",
                ".Export",
                ".Append",
                ".StartRendering",
                ".StopRendering",
                "run_script_unsafe",
                "open(",
                "__import__",
            ] {
                assert!(
                    !script.contains(forbidden),
                    "read-only skill {} unexpectedly contains {forbidden}",
                    skill.id
                );
            }
            assert!(script.contains("result ="));
            assert!(script.contains(&format!("\"skillId\": \"{}\"", skill.id)));
        }
    }
}
