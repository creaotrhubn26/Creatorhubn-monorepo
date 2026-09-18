//! Controlled workflow gateway on top of Blackmagic's bundled Resolve MCP.
//!
//! The public Tauri surface accepts semantic workflow input only. Raw MCP tool
//! names and Python never cross the frontend boundary. Every mutation is bound
//! to the project/timeline IDs observed during planning, requires an exact
//! confirmation token, performs a read-back, and keeps enough information for
//! a guarded rollback.

use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;

use chrono::{Duration as ChronoDuration, Utc};
use serde::Serialize;
use serde_json::{Value, json};
use uuid::Uuid;

use crate::resolve_mcp;

const PLAN_TTL_MINUTES: i64 = 30;
const MAX_INPUT_BYTES: usize = 64 * 1024;
const MAX_MARKERS: usize = 200;
const MAX_BINS: usize = 32;
const MAX_SELECTS: usize = 500;
const MAX_MULTICAM_CLIPS: usize = 128;
const MAX_RENAME_ITEMS: usize = 500;
const ALLOWED_MARKER_COLORS: &[&str] = &[
    "Blue", "Cyan", "Green", "Yellow", "Red", "Pink", "Purple", "Fuchsia", "Rose", "Lavender",
    "Sky", "Mint", "Lemon", "Sand", "Cocoa", "Cream",
];

const WORKFLOW_SKILLS: &[&str] = &[
    "resolve-project-organizer",
    "resolve-transcript-editor",
    "resolve-multicam-director",
    "resolve-audio-post",
    "resolve-color-guardian",
    "resolve-review-notes",
    "resolve-batch-render-planner",
    "resolve-v1-clip-renamer",
];

const PREFLIGHT_SCRIPT: &str = r#"
def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def walk(folder, clips, depth=0):
    if folder is None or depth > 32:
        return
    for clip in (safe_call(folder.GetClipList, []) or []):
        if len(clips) >= 2000:
            return
        transcription = safe_call(clip.GetTranscription, {}) or {}
        clips.append({
            "name": safe_call(clip.GetName),
            "uniqueId": safe_call(clip.GetUniqueId),
            "hasTranscription": bool(transcription.get("segments")) if isinstance(transcription, dict) else False
        })
    for child in (safe_call(folder.GetSubFolderList, []) or []):
        walk(child, clips, depth + 1)


active_project = project
project_data = None
timeline_data = None
root_bins = []
clips = []
selected_clips = []
audio_states = []
v1_timeline_items = []
render_formats = {}
render_codecs = {}
summary = {
    "mediaPoolClips": 0,
    "transcribedClips": 0,
    "rootBins": 0,
    "videoTracks": 0,
    "audioTracks": 0,
    "videoItems": 0,
    "audioItems": 0,
    "timelineMarkers": 0,
    "selectedMediaPoolClips": 0
}
settings = {}
findings = []

if active_project is None:
    findings.append({
        "severity": "error", "code": "no_project", "title": "Ingen aktivt prosjekt",
        "detail": "Åpne prosjektet som planen skal bindes til og prøv igjen."
    })
else:
    project_data = {
        "name": safe_call(active_project.GetName),
        "uniqueId": safe_call(active_project.GetUniqueId)
    }
    settings = safe_call(active_project.GetSettings, {}) or {}
    render_formats = safe_call(active_project.GetRenderFormats, {}) or {}
    for format_name, extension in render_formats.items():
        if extension not in render_codecs:
            render_codecs[extension] = safe_call(lambda e=extension: active_project.GetRenderCodecs(e), {}) or {}
    media_pool = safe_call(active_project.GetMediaPool)
    root = safe_call(media_pool.GetRootFolder) if media_pool else None
    root_bins = [safe_call(child.GetName, "") or "" for child in (safe_call(root.GetSubFolderList, []) or [])]
    walk(root, clips)
    selected = safe_call(media_pool.GetSelectedClips, []) if media_pool else []
    for clip in (selected or []):
        selected_clips.append({
            "name": safe_call(clip.GetName),
            "uniqueId": safe_call(clip.GetUniqueId)
        })
    summary["mediaPoolClips"] = len(clips)
    summary["transcribedClips"] = sum(1 for clip in clips if clip["hasTranscription"])
    summary["rootBins"] = len(root_bins)
    summary["selectedMediaPoolClips"] = len(selected_clips)

    timeline = safe_call(active_project.GetCurrentTimeline)
    if timeline is not None:
        start_frame = int(safe_call(timeline.GetStartFrame, 0) or 0)
        end_frame = int(safe_call(timeline.GetEndFrame, start_frame) or start_frame)
        timeline_settings = safe_call(timeline.GetSettings, {}) or {}
        fps = timeline_settings.get("timelineFrameRate") or settings.get("timelineFrameRate")
        timeline_data = {
            "name": safe_call(timeline.GetName),
            "uniqueId": safe_call(timeline.GetUniqueId),
            "startFrame": start_frame,
            "endFrame": end_frame,
            "durationFrames": max(0, end_frame - start_frame),
            "frameRate": fps
        }
        for track_type in ("video", "audio"):
            count = int(safe_call(lambda t=track_type: timeline.GetTrackCount(t), 0) or 0)
            summary[track_type + "Tracks"] = count
            total = 0
            for index in range(1, count + 1):
                total += len(safe_call(lambda t=track_type, i=index: timeline.GetItemListInTrack(t, i), []) or [])
                if track_type == "audio":
                    audio_states.append({
                        "trackIndex": index,
                        "name": safe_call(lambda i=index: timeline.GetTrackName("audio", i), "") or "",
                        "voiceIsolation": safe_call(lambda i=index: timeline.GetVoiceIsolationState(i), {}) or {}
                    })
            summary[track_type + "Items"] = total
        summary["timelineMarkers"] = len(safe_call(timeline.GetMarkers, {}) or {})
        for item in (safe_call(lambda: timeline.GetItemListInTrack("video", 1), []) or []):
            if safe_call(item.GetType, "") != "video":
                continue
            if len(v1_timeline_items) >= 501:
                break
            v1_timeline_items.append({
                "uniqueId": safe_call(item.GetUniqueId),
                "name": safe_call(item.GetName, "") or "",
                "startFrame": safe_call(item.GetStart),
                "endFrame": safe_call(item.GetEnd)
            })

if not findings:
    findings.append({
        "severity": "info", "code": "preflight_ready", "title": "Plan-grunnlag er klart",
        "detail": "Post Agent har lest prosjektidentitet og relevant Resolve-tilstand uten å endre prosjektet."
    })

result = {
    "schemaVersion": 1,
    "skillId": "__SKILL_ID__",
    "readOnly": True,
    "resolve": {"version": safe_call(resolve.GetVersionString), "page": safe_call(resolve.GetCurrentPage)},
    "project": project_data,
    "timeline": timeline_data,
    "summary": summary,
    "details": {
        "rootBins": root_bins,
        "selectedMediaPoolClips": selected_clips,
        "audioTrackStates": audio_states,
        "colorScienceMode": settings.get("colorScienceMode"),
        "v1TimelineItems": v1_timeline_items,
        "renderFormats": render_formats,
        "renderCodecs": render_codecs,
        "currentRenderFormatAndCodec": safe_call(active_project.GetCurrentRenderFormatAndCodec, {}) if active_project else {},
        "currentRenderMode": safe_call(active_project.GetCurrentRenderMode) if active_project else None
    },
    "findings": findings
}
"#;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveMcpPlanTarget {
    pub project_id: String,
    pub project_name: String,
    pub timeline_id: Option<String>,
    pub timeline_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveMcpPlanStep {
    pub id: String,
    pub label: String,
    pub detail: String,
    pub risk: String,
    pub reversible: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveMcpWorkflowPlan {
    pub schema_version: u8,
    pub plan_id: String,
    pub skill_id: String,
    pub state: String,
    pub created_at: String,
    pub expires_at: String,
    pub target: ResolveMcpPlanTarget,
    pub preflight: Value,
    pub steps: Vec<ResolveMcpPlanStep>,
    pub executable: bool,
    pub rollback_available: bool,
    pub confirmation_token: String,
    pub operation_summary: String,
    pub warnings: Vec<String>,
    pub preview: Value,
    pub result: Option<Value>,
    pub verification: Option<Value>,
    pub rollback_result: Option<Value>,
}

#[derive(Debug, Clone)]
struct MarkerSpec {
    frame_id: i64,
    color: String,
    name: String,
    note: String,
    duration: i64,
    custom_data: String,
}

#[derive(Debug, Clone)]
struct SelectSpec {
    clip_id: String,
    start_frame: i64,
    end_frame: i64,
}

#[derive(Debug, Clone)]
struct RenderProfileSpec {
    id: &'static str,
    label: &'static str,
    extension: &'static str,
    format_name: String,
    codec_name: String,
    width: Option<u32>,
    height: Option<u32>,
    video_quality: Option<&'static str>,
}

#[derive(Debug, Clone)]
struct RenameSpec {
    item_id: String,
    start_frame: i64,
    old_name: String,
    new_name: String,
}

#[derive(Debug, Clone)]
enum ApprovedOperation {
    CreateBins {
        names: Vec<String>,
    },
    CreateSelectsTimeline {
        name: String,
        selects: Vec<SelectSpec>,
    },
    CreateMulticam {
        name: String,
        clip_ids: Vec<String>,
        sync_mode: String,
    },
    SetVoiceIsolation {
        tracks: Vec<u32>,
        enabled: bool,
        amount: u8,
    },
    GenerateLut {
        path: String,
        size: u8,
        transform: &'static str,
    },
    AddMarkers {
        markers: Vec<MarkerSpec>,
    },
    QueueRenderJobs {
        profiles: Vec<RenderProfileSpec>,
        target_dir: String,
        display_target_dir: String,
        base_name: String,
    },
    RenameV1Clips {
        changes: Vec<RenameSpec>,
    },
    Noop,
}

#[derive(Debug, Clone)]
struct StoredPlan {
    public: ResolveMcpWorkflowPlan,
    operation: ApprovedOperation,
}

#[derive(Default)]
pub struct ResolveMcpGatewayState {
    plans: Mutex<HashMap<String, StoredPlan>>,
}

fn value_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::to_string)
        .filter(|v| !v.is_empty())
}

fn bounded_text(value: Option<&Value>, fallback: &str, max: usize) -> String {
    let text = value_string(value).unwrap_or_else(|| fallback.to_string());
    text.chars().take(max).collect()
}

fn python_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

fn python_strings(values: &[String]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|value| python_string(value))
            .collect::<Vec<_>>()
            .join(",")
    )
}

fn target_from_preflight(preflight: &Value) -> Result<ResolveMcpPlanTarget, String> {
    let project = preflight
        .get("project")
        .and_then(Value::as_object)
        .ok_or("Resolve-planen krever et aktivt prosjekt")?;
    let project_id = value_string(project.get("uniqueId"))
        .ok_or("Resolve returnerte ikke en stabil prosjekt-ID")?;
    let project_name = value_string(project.get("name")).unwrap_or_else(|| "Uten navn".into());
    let timeline = preflight.get("timeline").and_then(Value::as_object);
    Ok(ResolveMcpPlanTarget {
        project_id,
        project_name,
        timeline_id: timeline.and_then(|value| value_string(value.get("uniqueId"))),
        timeline_name: timeline.and_then(|value| value_string(value.get("name"))),
    })
}

fn requested_bins(input: &Value) -> Result<Vec<String>, String> {
    let defaults = [
        "01_FOOTAGE",
        "02_AUDIO",
        "03_MUSIC",
        "04_GFX",
        "05_TIMELINES",
        "06_EXPORTS",
    ];
    let values = input
        .get("binNames")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(|name| name.trim().chars().take(80).collect::<String>())
                .filter(|name| !name.is_empty() && name != "." && name != "..")
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| defaults.iter().map(|name| name.to_string()).collect());
    if values.len() > MAX_BINS {
        return Err(format!(
            "Project Organizer støtter maksimalt {MAX_BINS} bins per plan"
        ));
    }
    let mut unique = Vec::new();
    for value in values {
        if !unique.contains(&value) {
            unique.push(value);
        }
    }
    Ok(unique)
}

fn marker_specs(
    input: &Value,
    plan_id: &str,
    preflight: &Value,
) -> Result<Vec<MarkerSpec>, String> {
    let items = input
        .get("notes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if items.len() > MAX_MARKERS {
        return Err(format!(
            "En plan kan inneholde maksimalt {MAX_MARKERS} markører"
        ));
    }
    let fps = preflight
        .pointer("/timeline/frameRate")
        .and_then(|value| value.as_f64().or_else(|| value.as_str()?.parse().ok()))
        .filter(|value| *value > 0.0)
        .unwrap_or(25.0);
    let duration_frames = preflight
        .pointer("/timeline/durationFrames")
        .and_then(Value::as_i64)
        .unwrap_or(i64::MAX);
    let mut markers = Vec::new();
    for (index, item) in items.iter().enumerate() {
        let frame_id = item
            .get("frameId")
            .and_then(Value::as_i64)
            .or_else(|| {
                item.get("timeSec")
                    .and_then(Value::as_f64)
                    .map(|v| (v * fps).round() as i64)
            })
            .ok_or_else(|| format!("Markør {} mangler frameId eller timeSec", index + 1))?;
        if frame_id < 0 || frame_id > duration_frames {
            return Err(format!(
                "Markør {} ligger utenfor aktiv timeline",
                index + 1
            ));
        }
        let color = bounded_text(item.get("color"), "Purple", 16);
        if !ALLOWED_MARKER_COLORS.contains(&color.as_str()) {
            return Err(format!("Ugyldig Resolve-markørfarge: {color}"));
        }
        markers.push(MarkerSpec {
            frame_id,
            color,
            name: bounded_text(item.get("name"), "Post Agent", 120),
            note: bounded_text(item.get("note"), "", 500),
            duration: item
                .get("duration")
                .and_then(Value::as_i64)
                .unwrap_or(1)
                .clamp(1, 100_000),
            custom_data: format!("post-agent:{plan_id}:{index}"),
        });
    }
    Ok(markers)
}

fn select_specs(input: &Value) -> Result<Vec<SelectSpec>, String> {
    let items = input
        .get("selections")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if items.len() > MAX_SELECTS {
        return Err(format!(
            "Transcript Editor støtter maksimalt {MAX_SELECTS} selects per plan"
        ));
    }
    items
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let clip_id = value_string(item.get("clipId"))
                .ok_or_else(|| format!("Select {} mangler clipId", index + 1))?;
            let start_frame = item.get("startFrame").and_then(Value::as_i64).unwrap_or(0);
            let end_frame = item
                .get("endFrame")
                .and_then(Value::as_i64)
                .ok_or_else(|| format!("Select {} mangler endFrame", index + 1))?;
            if start_frame < 0 || end_frame <= start_frame {
                return Err(format!("Select {} har ugyldig frame-område", index + 1));
            }
            Ok(SelectSpec {
                clip_id,
                start_frame,
                end_frame,
            })
        })
        .collect()
}

fn selected_clip_ids(input: &Value, preflight: &Value) -> Result<Vec<String>, String> {
    let explicit = input
        .get("clipIds")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let source = if !explicit.is_empty() {
        explicit
    } else {
        preflight
            .pointer("/details/selectedMediaPoolClips")
            .and_then(Value::as_array)
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| value_string(item.get("uniqueId")))
                    .collect()
            })
            .unwrap_or_default()
    };
    let mut unique = Vec::new();
    for clip_id in source {
        let clip_id = clip_id.trim().chars().take(200).collect::<String>();
        if !clip_id.is_empty() && !unique.contains(&clip_id) {
            unique.push(clip_id);
        }
    }
    if unique.len() > MAX_MULTICAM_CLIPS {
        return Err(format!(
            "Multicam Director støtter maksimalt {MAX_MULTICAM_CLIPS} klipp per plan"
        ));
    }
    Ok(unique)
}

fn safe_name_component(value: &str, fallback: &str, max: usize) -> String {
    let cleaned = value
        .chars()
        .take(max)
        .map(|character| {
            if character.is_alphanumeric() || matches!(character, ' ' | '-' | '_') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    let cleaned = cleaned.trim_matches([' ', '-', '_']).trim().to_string();
    if cleaned.is_empty() {
        fallback.to_string()
    } else {
        cleaned
    }
}

fn canonical_codec(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(char::to_lowercase)
        .collect()
}

fn render_profile_specs(
    input: &Value,
    preflight: &Value,
) -> Result<(Vec<RenderProfileSpec>, Vec<String>), String> {
    let defaults = ["prores-422-hq", "h265-4k", "h264-proxy"];
    let requested = input
        .get("profileIds")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|| defaults.iter().map(|value| value.to_string()).collect());
    if requested.is_empty() {
        return Err("Velg minst én renderprofil".into());
    }
    let mut unique = Vec::new();
    for profile_id in requested {
        if !defaults.contains(&profile_id.as_str()) {
            return Err(format!(
                "Ukjent eller ikke tillatt renderprofil: {profile_id}"
            ));
        }
        if !unique.contains(&profile_id) {
            unique.push(profile_id);
        }
    }

    let formats = preflight
        .pointer("/details/renderFormats")
        .and_then(Value::as_object);
    let codecs = preflight
        .pointer("/details/renderCodecs")
        .and_then(Value::as_object);
    let mut resolved = Vec::new();
    let mut unavailable = Vec::new();
    for profile_id in unique {
        let (id, label, extension, codec_token, width, height, quality) = match profile_id.as_str()
        {
            "prores-422-hq" => (
                "prores-422-hq",
                "ProRes 422 HQ master",
                "mov",
                "prores422hq",
                None,
                None,
                None,
            ),
            "h265-4k" => (
                "h265-4k",
                "H.265 4K delivery",
                "mp4",
                "h265",
                Some(3840),
                Some(2160),
                Some("Best"),
            ),
            _ => (
                "h264-proxy",
                "H.264 1080p proxy",
                "mp4",
                "h264",
                Some(1920),
                Some(1080),
                Some("Medium"),
            ),
        };
        let format_name = formats
            .and_then(|items| {
                items.iter().find_map(|(name, value)| {
                    (value.as_str() == Some(extension)).then(|| name.clone())
                })
            })
            .unwrap_or_else(|| extension.to_uppercase());
        let codec_name = codecs
            .and_then(|items| items.get(extension))
            .and_then(Value::as_object)
            .and_then(|items| {
                items.iter().find_map(|(description, value)| {
                    let internal = value.as_str()?;
                    let combined = canonical_codec(&format!("{description}{internal}"));
                    combined.contains(codec_token).then(|| internal.to_string())
                })
            });
        if let Some(codec_name) = codec_name {
            resolved.push(RenderProfileSpec {
                id,
                label,
                extension,
                format_name,
                codec_name,
                width,
                height,
                video_quality: quality,
            });
        } else {
            unavailable.push(label.to_string());
        }
    }
    Ok((resolved, unavailable))
}

fn render_target_dir(preflight: &Value, plan_id: &str) -> String {
    let project_name = preflight
        .pointer("/project/name")
        .and_then(Value::as_str)
        .map(|value| safe_name_component(value, "Resolve Project", 80))
        .unwrap_or_else(|| "Resolve Project".into());
    let base = std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    base.join("Movies")
        .join("Post Agent Exports")
        .join(project_name)
        .join(&plan_id[..8])
        .to_string_lossy()
        .into_owned()
}

fn display_render_target_dir(target_dir: &str) -> String {
    let absolute = PathBuf::from(target_dir);
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .and_then(|home| absolute.strip_prefix(home).ok().map(PathBuf::from))
        .map(|relative| format!("~/{}", relative.to_string_lossy()))
        .unwrap_or_else(|| "Post Agent Exports".into())
}

fn rename_specs(input: &Value, preflight: &Value) -> Result<Vec<RenameSpec>, String> {
    let items = preflight
        .pointer("/details/v1TimelineItems")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    if items.len() > MAX_RENAME_ITEMS {
        return Err(format!(
            "V1 Clip Renamer støtter maksimalt {MAX_RENAME_ITEMS} klipp per plan"
        ));
    }
    let prefix = safe_name_component(
        input
            .get("prefix")
            .and_then(Value::as_str)
            .unwrap_or("SHOT"),
        "SHOT",
        80,
    );
    let start_number = input
        .get("startNumber")
        .and_then(Value::as_u64)
        .unwrap_or(1)
        .clamp(1, 999_999);
    let padding = input
        .get("padding")
        .and_then(Value::as_u64)
        .unwrap_or(3)
        .clamp(2, 6) as usize;
    let mut seen = HashSet::new();
    let mut source = items
        .into_iter()
        .enumerate()
        .map(|(index, item)| {
            let item_id = value_string(item.get("uniqueId"))
                .ok_or_else(|| format!("V1-klipp {} mangler stabil Resolve-ID", index + 1))?;
            if !seen.insert(item_id.clone()) {
                return Err(format!("V1-klipp har duplisert Resolve-ID: {item_id}"));
            }
            let start_frame = item
                .get("startFrame")
                .and_then(|value| value.as_i64().or_else(|| value.as_f64().map(|v| v as i64)))
                .ok_or_else(|| format!("V1-klipp {} mangler startposisjon", index + 1))?;
            Ok((
                item_id,
                start_frame,
                bounded_text(item.get("name"), "Uten navn", 240),
            ))
        })
        .collect::<Result<Vec<_>, String>>()?;
    source.sort_by(|left, right| left.1.cmp(&right.1).then_with(|| left.0.cmp(&right.0)));
    Ok(source
        .into_iter()
        .enumerate()
        .filter_map(|(index, (item_id, start_frame, old_name))| {
            let number = start_number + index as u64;
            let new_name = format!("{prefix}_{number:0padding$}");
            (new_name != old_name).then_some(RenameSpec {
                item_id,
                start_frame,
                old_name,
                new_name,
            })
        })
        .collect())
}

fn build_operation(
    skill_id: &str,
    input: &Value,
    preflight: &Value,
    plan_id: &str,
) -> Result<(ApprovedOperation, String, Vec<String>), String> {
    match skill_id {
        "resolve-project-organizer" => {
            let existing = preflight
                .pointer("/details/rootBins")
                .and_then(Value::as_array)
                .map(|items| items.iter().filter_map(Value::as_str).collect::<Vec<_>>())
                .unwrap_or_default();
            let missing = requested_bins(input)?
                .into_iter()
                .filter(|name| !existing.contains(&name.as_str()))
                .collect::<Vec<_>>();
            let summary = if missing.is_empty() {
                "Prosjektstrukturen har allerede alle valgte bins.".to_string()
            } else {
                format!(
                    "Opprett {} manglende bins uten å flytte eksisterende media.",
                    missing.len()
                )
            };
            Ok((
                if missing.is_empty() {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::CreateBins { names: missing }
                },
                summary,
                vec![],
            ))
        }
        "resolve-transcript-editor" => {
            let selects = select_specs(input)?;
            let name = bounded_text(input.get("timelineName"), "Post Agent Selects", 120);
            let mut warnings = Vec::new();
            if selects.is_empty() {
                warnings.push("Velg transkripsjonssegmenter med clipId/startFrame/endFrame før planen kan utføres.".into());
            }
            Ok((
                if selects.is_empty() {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::CreateSelectsTimeline {
                        name,
                        selects: selects.clone(),
                    }
                },
                format!(
                    "Bygg en ny selects-timeline fra {} godkjente transkripsjonssegmenter.",
                    selects.len()
                ),
                warnings,
            ))
        }
        "resolve-multicam-director" => {
            let clip_ids = selected_clip_ids(input, preflight)?;
            let name = bounded_text(input.get("name"), "Post Agent Multicam", 120);
            let sync_mode = match input.get("syncMode").and_then(Value::as_str) {
                Some("audio") => "audio",
                _ => "timecode",
            }
            .to_string();
            let mut warnings = Vec::new();
            if clip_ids.len() < 2 {
                warnings.push(
                    "Velg minst to klipp i Media Pool, eller send clipIds, før planen kan utføres."
                        .into(),
                );
            }
            Ok((
                if clip_ids.len() < 2 {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::CreateMulticam {
                        name,
                        clip_ids: clip_ids.clone(),
                        sync_mode: sync_mode.clone(),
                    }
                },
                format!(
                    "Opprett multicam fra {} låste klipp med {}-synk.",
                    clip_ids.len(),
                    sync_mode
                ),
                warnings,
            ))
        }
        "resolve-audio-post" => {
            let available_tracks = preflight
                .pointer("/details/audioTrackStates")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| {
                            item.get("trackIndex")
                                .and_then(Value::as_u64)
                                .map(|v| v as u32)
                        })
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            let tracks = input
                .get("tracks")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(Value::as_u64)
                        .map(|v| v as u32)
                        .filter(|v| available_tracks.contains(v))
                        .collect::<Vec<_>>()
                })
                .filter(|items| !items.is_empty())
                .unwrap_or(available_tracks);
            let enabled = input
                .get("enabled")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let amount = input
                .get("amount")
                .and_then(Value::as_u64)
                .unwrap_or(50)
                .min(100) as u8;
            let mut warnings = Vec::new();
            if tracks.is_empty() {
                warnings.push("Aktiv timeline har ingen audiospor som kan behandles.".into());
            }
            Ok((
                if tracks.is_empty() {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::SetVoiceIsolation {
                        tracks: tracks.clone(),
                        enabled,
                        amount,
                    }
                },
                format!(
                    "Sett Voice Isolation til {}% på {} audiospor.",
                    amount,
                    tracks.len()
                ),
                warnings,
            ))
        }
        "resolve-color-guardian" => {
            let (preset, transform) = match input.get("preset").and_then(Value::as_str) {
                Some("clean-commercial") => (
                    "clean-commercial",
                    "return (min(1.0, r * 1.015), min(1.0, g * 1.01), min(1.0, b * 1.005))",
                ),
                Some("music-teal") => (
                    "music-teal",
                    "return (min(1.0, r ** 0.96 * 1.03), min(1.0, g ** 0.98 * 1.01), min(1.0, b ** 0.94 * 1.06))",
                ),
                _ => (
                    "warm-wedding",
                    "return (min(1.0, r ** 0.96 * 1.035), min(1.0, g ** 0.98 * 1.012), min(1.0, b ** 1.015 * 0.985))",
                ),
            };
            let path = format!("post-agent-{}-{}.cube", preset, &plan_id[..8]);
            Ok((
                ApprovedOperation::GenerateLut {
                    path: path.clone(),
                    size: 33,
                    transform,
                },
                format!(
                    "Generer validert 33×33×33 LUT '{}' i Resolves MCP-mappe.",
                    path
                ),
                vec![
                    "LUT-en genereres, men brukes ikke automatisk på timeline eller klipp.".into(),
                ],
            ))
        }
        "resolve-review-notes" => {
            let markers = marker_specs(input, plan_id, preflight)?;
            let mut warnings = Vec::new();
            if markers.is_empty() {
                warnings.push("Legg inn tidskodede review-notater før planen kan utføres.".into());
            }
            Ok((
                if markers.is_empty() {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::AddMarkers {
                        markers: markers.clone(),
                    }
                },
                format!(
                    "Legg {} sporbare review-markører på aktiv timeline.",
                    markers.len()
                ),
                warnings,
            ))
        }
        "resolve-batch-render-planner" => {
            let (profiles, unavailable) = render_profile_specs(input, preflight)?;
            let fallback_name = preflight
                .pointer("/timeline/name")
                .and_then(Value::as_str)
                .unwrap_or("Post Agent Export");
            let base_name = safe_name_component(
                input
                    .get("baseName")
                    .and_then(Value::as_str)
                    .unwrap_or(fallback_name),
                "Post Agent Export",
                100,
            );
            let target_dir = render_target_dir(preflight, plan_id);
            let display_target_dir = display_render_target_dir(&target_dir);
            let mut warnings = vec![
                "Planen legger bare jobber i renderkøen. Den kaller aldri StartRendering.".into(),
                "Post Agent gjenoppretter renderformat, codec og render mode; andre Deliver-felt kan stå igjen fra siste køprofil.".into(),
            ];
            if !unavailable.is_empty() {
                warnings.push(format!(
                    "Resolve mangler kompatibel codec for: {}. Ingen jobber kan legges i kø før alle valgte profiler er tilgjengelige.",
                    unavailable.join(", ")
                ));
            }
            let profile_count = profiles.len();
            Ok((
                if profile_count == 0 || !unavailable.is_empty() {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::QueueRenderJobs {
                        profiles,
                        target_dir,
                        display_target_dir: display_target_dir.clone(),
                        base_name,
                    }
                },
                format!(
                    "Legg {profile_count} validerte leveranser i renderkøen til '{display_target_dir}', uten å starte rendering."
                ),
                warnings,
            ))
        }
        "resolve-v1-clip-renamer" => {
            let changes = rename_specs(input, preflight)?;
            let mut warnings = Vec::new();
            if changes.is_empty() {
                warnings.push("V1 har ingen videoklipp som trenger nytt navn.".into());
            }
            let count = changes.len();
            Ok((
                if changes.is_empty() {
                    ApprovedOperation::Noop
                } else {
                    ApprovedOperation::RenameV1Clips { changes }
                },
                format!("Gi {count} videoklipp på V1 sekvensielle navn i timeline-rekkefølge."),
                warnings,
            ))
        }
        _ => Err(format!("{skill_id} støtter ikke godkjente MCP-planer")),
    }
}

fn preview_for(operation: &ApprovedOperation) -> Value {
    match operation {
        ApprovedOperation::QueueRenderJobs {
            profiles,
            display_target_dir,
            base_name,
            ..
        } => json!({
            "kind": "render-jobs",
            "destination": display_target_dir,
            "items": profiles.iter().map(|profile| json!({
                "id": profile.id,
                "label": profile.label,
                "format": profile.format_name,
                "extension": profile.extension,
                "codec": profile.codec_name,
                "resolution": match (profile.width, profile.height) {
                    (Some(width), Some(height)) => format!("{width}×{height}"),
                    _ => "Timeline-oppløsning".into(),
                },
                "outputName": format!("{base_name}_{}", profile.id),
            })).collect::<Vec<_>>()
        }),
        ApprovedOperation::RenameV1Clips { changes } => json!({
            "kind": "rename-v1",
            "items": changes.iter().map(|change| json!({
                "id": change.item_id,
                "startFrame": change.start_frame,
                "before": change.old_name,
                "after": change.new_name,
            })).collect::<Vec<_>>()
        }),
        _ => Value::Null,
    }
}

fn steps_for(operation: &ApprovedOperation) -> Vec<ResolveMcpPlanStep> {
    let (label, detail, risk, reversible) = match operation {
        ApprovedOperation::CreateBins { names } => (
            "Opprett bins",
            format!("{} nye rot-bins", names.len()),
            "low",
            true,
        ),
        ApprovedOperation::CreateSelectsTimeline { selects, .. } => (
            "Bygg selects-timeline",
            format!("{} kildeutdrag", selects.len()),
            "medium",
            true,
        ),
        ApprovedOperation::CreateMulticam { clip_ids, .. } => (
            "Opprett multicam",
            format!("{} kildeklipp", clip_ids.len()),
            "medium",
            true,
        ),
        ApprovedOperation::SetVoiceIsolation { tracks, .. } => (
            "Oppdater Voice Isolation",
            format!("{} audiospor", tracks.len()),
            "medium",
            true,
        ),
        ApprovedOperation::GenerateLut { path, .. } => ("Generer LUT", path.clone(), "low", true),
        ApprovedOperation::AddMarkers { markers } => (
            "Legg til markører",
            format!("{} tidskodede notater", markers.len()),
            "low",
            true,
        ),
        ApprovedOperation::QueueRenderJobs { profiles, .. } => (
            "Legg leveranser i renderkø",
            format!(
                "{} validerte profiler; rendering startes ikke",
                profiles.len()
            ),
            "medium",
            true,
        ),
        ApprovedOperation::RenameV1Clips { changes } => (
            "Gi V1-klipp nye navn",
            format!("{} ID-låste timeline-klipp", changes.len()),
            "medium",
            true,
        ),
        ApprovedOperation::Noop => (
            "Fullfør input",
            "Planen mangler valgene som kreves for utførelse".into(),
            "none",
            false,
        ),
    };
    vec![
        ResolveMcpPlanStep {
            id: "preflight".into(),
            label: "Lås mål".into(),
            detail: "Prosjekt- og timeline-ID verifiseres rett før skriving.".into(),
            risk: "none".into(),
            reversible: true,
        },
        ResolveMcpPlanStep {
            id: "apply".into(),
            label: label.into(),
            detail,
            risk: risk.into(),
            reversible,
        },
        ResolveMcpPlanStep {
            id: "verify".into(),
            label: "Les resultat tilbake".into(),
            detail: "Post Agent kontrollerer at forventet Resolve-tilstand finnes.".into(),
            risk: "none".into(),
            reversible: true,
        },
    ]
}

pub async fn create_plan(
    state: &ResolveMcpGatewayState,
    skill_id: String,
    input: Value,
) -> Result<ResolveMcpWorkflowPlan, String> {
    if !WORKFLOW_SKILLS.contains(&skill_id.as_str()) {
        return Err(format!("{skill_id} er ikke en skrivende Post Agent-skill"));
    }
    if serde_json::to_vec(&input)
        .map_err(|err| err.to_string())?
        .len()
        > MAX_INPUT_BYTES
    {
        return Err("Plan-input er større enn 64 KiB".into());
    }
    let script = PREFLIGHT_SCRIPT.replace("__SKILL_ID__", &skill_id);
    let preflight = resolve_mcp::run_allowlisted_script(script).await?;
    if preflight.get("readOnly").and_then(Value::as_bool) != Some(true)
        || preflight.get("skillId").and_then(Value::as_str) != Some(skill_id.as_str())
    {
        return Err("Resolve MCP returnerte et ugyldig plan-grunnlag".into());
    }
    let target = target_from_preflight(&preflight)?;
    let requires_timeline = resolve_mcp::skills()
        .into_iter()
        .find(|skill| skill.id == skill_id)
        .is_some_and(|skill| skill.requires_timeline);
    if requires_timeline && target.timeline_id.is_none() {
        return Err(format!(
            "{skill_id} krever at en timeline er aktiv i Resolve"
        ));
    }
    let plan_id = Uuid::new_v4().to_string();
    let (operation, operation_summary, warnings) =
        build_operation(&skill_id, &input, &preflight, &plan_id)?;
    let executable = !matches!(operation, ApprovedOperation::Noop);
    let preview = preview_for(&operation);
    let created = Utc::now();
    let plan = ResolveMcpWorkflowPlan {
        schema_version: 1,
        confirmation_token: format!("GODKJENN-{}", &plan_id[..8].to_uppercase()),
        plan_id: plan_id.clone(),
        skill_id,
        state: "planned".into(),
        created_at: created.to_rfc3339(),
        expires_at: (created + ChronoDuration::minutes(PLAN_TTL_MINUTES)).to_rfc3339(),
        target,
        preflight,
        steps: steps_for(&operation),
        executable,
        rollback_available: executable,
        operation_summary,
        warnings,
        preview,
        result: None,
        verification: None,
        rollback_result: None,
    };
    state
        .plans
        .lock()
        .map_err(|_| "Planlageret er låst".to_string())?
        .insert(
            plan_id,
            StoredPlan {
                public: plan.clone(),
                operation,
            },
        );
    Ok(plan)
}

fn ensure_target_prelude(target: &ResolveMcpPlanTarget, require_timeline: bool) -> String {
    let project_id = python_string(&target.project_id);
    let timeline_id = python_string(target.timeline_id.as_deref().unwrap_or(""));
    format!(
        r#"
def safe_call(fn, default=None):
    try:
        return fn()
    except Exception:
        return default

def execute():
    if project is None or safe_call(project.GetUniqueId) != {project_id}:
        return {{"ok": False, "error": "stale_project", "message": "Aktivt prosjekt matcher ikke godkjent plan."}}
    timeline = safe_call(project.GetCurrentTimeline)
    if {require_timeline} and (timeline is None or safe_call(timeline.GetUniqueId) != {timeline_id}):
        return {{"ok": False, "error": "stale_timeline", "message": "Aktiv timeline matcher ikke godkjent plan."}}
"#,
        require_timeline = if require_timeline { "True" } else { "False" }
    )
}

fn apply_script(
    operation: &ApprovedOperation,
    target: &ResolveMcpPlanTarget,
    plan_id: &str,
) -> Option<String> {
    let requires_timeline = matches!(
        operation,
        ApprovedOperation::AddMarkers { .. }
            | ApprovedOperation::SetVoiceIsolation { .. }
            | ApprovedOperation::QueueRenderJobs { .. }
            | ApprovedOperation::RenameV1Clips { .. }
    );
    let mut script = ensure_target_prelude(target, requires_timeline);
    match operation {
        ApprovedOperation::CreateBins { names } => {
            script.push_str(&format!(r#"
    media_pool = project.GetMediaPool()
    root = media_pool.GetRootFolder()
    existing = {{safe_call(folder.GetName, ""): folder for folder in (safe_call(root.GetSubFolderList, []) or [])}}
    created = []
    for name in {}:
        if name in existing:
            continue
        folder = safe_call(lambda n=name: media_pool.AddSubFolder(root, n))
        if folder is not None:
            created.append({{"name": name, "uniqueId": safe_call(folder.GetUniqueId)}})
    after = [safe_call(folder.GetName, "") for folder in (safe_call(root.GetSubFolderList, []) or [])]
    verified = all(name in after for name in {})
    if not verified:
        removable = []
        for folder in (safe_call(root.GetSubFolderList, []) or []):
            uid = safe_call(folder.GetUniqueId)
            if any(item["uniqueId"] == uid for item in created) and not (safe_call(folder.GetClipList, []) or []) and not (safe_call(folder.GetSubFolderList, []) or []):
                removable.append(folder)
        if removable:
            safe_call(lambda: media_pool.DeleteFolders(removable), False)
        return {{"ok": False, "operation": "createBins", "created": [], "verified": False, "compensated": True}}
    return {{"ok": True, "operation": "createBins", "created": created, "verified": True}}

result = execute()
"#, python_strings(names), python_strings(names)));
        }
        ApprovedOperation::AddMarkers { markers } => {
            let rows = markers.iter().map(|marker| format!(
                "{{\"frameId\":{},\"color\":{},\"name\":{},\"note\":{},\"duration\":{},\"customData\":{}}}",
                marker.frame_id, python_string(&marker.color), python_string(&marker.name),
                python_string(&marker.note), marker.duration, python_string(&marker.custom_data)
            )).collect::<Vec<_>>().join(",");
            script.push_str(&format!(r#"
    specs = [{rows}]
    added = []
    failed = []
    for marker in specs:
        ok = safe_call(lambda m=marker: timeline.AddMarker(m["frameId"], m["color"], m["name"], m["note"], m["duration"], m["customData"]), False)
        if ok:
            added.append(marker)
        else:
            failed.append(marker)
    if failed:
        for marker in added:
            safe_call(lambda m=marker: timeline.DeleteMarkerByCustomData(m["customData"]), False)
        return {{"ok": False, "operation": "addMarkers", "added": [], "failed": failed, "verified": False, "compensated": True}}
    verified = all(bool(safe_call(lambda m=m: timeline.GetMarkerByCustomData(m["customData"]), {{}})) for m in added)
    return {{"ok": len(failed) == 0, "operation": "addMarkers", "added": added, "failed": failed, "verified": verified}}

result = execute()
"#));
        }
        ApprovedOperation::SetVoiceIsolation {
            tracks,
            enabled,
            amount,
        } => {
            let tracks = tracks
                .iter()
                .map(u32::to_string)
                .collect::<Vec<_>>()
                .join(",");
            script.push_str(&format!(r#"
    tracks = [{tracks}]
    previous = []
    changed = []
    for track in tracks:
        old_state = safe_call(lambda i=track: timeline.GetVoiceIsolationState(i), {{}}) or {{}}
        previous.append({{"trackIndex": track, "state": old_state}})
        if safe_call(lambda i=track: timeline.SetVoiceIsolationState(i, {{"isEnabled": {enabled}, "amount": {amount}}}), False):
            changed.append(track)
    if len(changed) != len(tracks):
        for item in previous:
            if item["trackIndex"] in changed:
                safe_call(lambda v=item: timeline.SetVoiceIsolationState(v["trackIndex"], v["state"]), False)
        return {{"ok": False, "operation": "setVoiceIsolation", "changedTracks": [], "previous": previous, "verified": False, "compensated": True}}
    verified = all((safe_call(lambda i=i: timeline.GetVoiceIsolationState(i), {{}}) or {{}}).get("isEnabled") == {enabled} and int((safe_call(lambda i=i: timeline.GetVoiceIsolationState(i), {{}}) or {{}}).get("amount", -1)) == {amount} for i in changed)
    return {{"ok": len(changed) == len(tracks), "operation": "setVoiceIsolation", "changedTracks": changed, "previous": previous, "verified": verified}}

result = execute()
"#, enabled = if *enabled { "True" } else { "False" }, amount = amount));
        }
        ApprovedOperation::CreateMulticam {
            name,
            clip_ids,
            sync_mode,
        } => {
            let ids = python_strings(clip_ids);
            let sync_constant = if sync_mode == "audio" {
                "resolve.MULTICAM_ANGLE_SYNC_AUDIO"
            } else {
                "resolve.MULTICAM_ANGLE_SYNC_TIMECODE"
            };
            script.push_str(&format!(r#"
    wanted = set({ids})
    media_pool = project.GetMediaPool()
    root = media_pool.GetRootFolder()
    found = {{}}
    def walk(folder, depth=0):
        if folder is None or depth > 32:
            return
        for clip in (safe_call(folder.GetClipList, []) or []):
            uid = safe_call(clip.GetUniqueId)
            if uid in wanted:
                found[uid] = clip
        for child in (safe_call(folder.GetSubFolderList, []) or []):
            walk(child, depth + 1)
    walk(root)
    if len(found) != len(wanted):
        return {{"ok": False, "error": "missing_clips", "found": list(found.keys())}}
    created = safe_call(lambda: media_pool.CreateMulticamClip([found[uid] for uid in {ids}], {{
        "name": {name}, "angleSyncMode": {sync_constant},
        "multicamAudioMode": resolve.MULTICAM_AUDIO_SOURCE,
        "angleNameMode": resolve.MULTICAM_ANGLE_NAME_CAMERA,
        "createBinForSourceClips": True,
        "detectSameCameraClipsMode": resolve.MULTICAM_DETECT_BY_CAMERA_NUMBER
    }}), []) or []
    created_data = [{{"name": safe_call(item.GetName), "uniqueId": safe_call(item.GetUniqueId)}} for item in created]
    return {{"ok": len(created_data) > 0, "operation": "createMulticam", "created": created_data, "verified": len(created_data) > 0}}

result = execute()
"#, ids = ids, name = python_string(name), sync_constant = sync_constant));
        }
        ApprovedOperation::CreateSelectsTimeline { name, selects } => {
            let rows = selects
                .iter()
                .map(|select| {
                    format!(
                        "{{\"clipId\":{},\"startFrame\":{},\"endFrame\":{}}}",
                        python_string(&select.clip_id),
                        select.start_frame,
                        select.end_frame
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            script.push_str(&format!(r#"
    specs = [{rows}]
    wanted = set(spec["clipId"] for spec in specs)
    media_pool = project.GetMediaPool()
    root = media_pool.GetRootFolder()
    found = {{}}
    def walk(folder, depth=0):
        if folder is None or depth > 32:
            return
        for clip in (safe_call(folder.GetClipList, []) or []):
            uid = safe_call(clip.GetUniqueId)
            if uid in wanted:
                found[uid] = clip
        for child in (safe_call(folder.GetSubFolderList, []) or []):
            walk(child, depth + 1)
    walk(root)
    if len(found) != len(wanted):
        return {{"ok": False, "error": "missing_clips", "found": list(found.keys())}}
    infos = [{{"mediaPoolItem": found[spec["clipId"]], "startFrame": spec["startFrame"], "endFrame": spec["endFrame"]}} for spec in specs]
    created = safe_call(lambda: media_pool.CreateTimelineFromClips({name}, infos))
    if created is None:
        return {{"ok": False, "error": "create_timeline_failed"}}
    signature = []
    for track_type in ("video", "audio", "subtitle"):
        for track_index in range(1, int(safe_call(lambda t=track_type: created.GetTrackCount(t), 0) or 0) + 1):
            for item in (safe_call(lambda t=track_type, i=track_index: created.GetItemListInTrack(t, i), []) or []):
                signature.append([track_type, track_index, safe_call(item.GetUniqueId), safe_call(item.GetName), safe_call(item.GetStart), safe_call(item.GetEnd)])
    return {{"ok": True, "operation": "createSelectsTimeline", "created": {{"name": safe_call(created.GetName), "uniqueId": safe_call(created.GetUniqueId)}}, "itemCount": len(specs), "signature": repr(signature), "verified": bool(safe_call(created.GetUniqueId))}}

result = execute()
"#, rows = rows, name = python_string(name)));
        }
        ApprovedOperation::QueueRenderJobs {
            profiles,
            target_dir,
            display_target_dir,
            base_name,
        } => {
            let rows = profiles
                .iter()
                .map(|profile| {
                    let width = profile
                        .width
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "None".into());
                    let height = profile
                        .height
                        .map(|value| value.to_string())
                        .unwrap_or_else(|| "None".into());
                    let quality = profile
                        .video_quality
                        .map(python_string)
                        .unwrap_or_else(|| "None".into());
                    format!(
                        "{{\"id\":{},\"label\":{},\"extension\":{},\"codec\":{},\"width\":{width},\"height\":{height},\"quality\":{quality},\"customName\":{}}}",
                        python_string(profile.id),
                        python_string(profile.label),
                        python_string(profile.extension),
                        python_string(&profile.codec_name),
                        python_string(&format!("{base_name}_{}", profile.id)),
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            script.push_str(&format!(r#"
    profiles = [{rows}]
    target_dir = {target_dir}
    previous_format_codec = safe_call(project.GetCurrentRenderFormatAndCodec, {{}}) or {{}}
    previous_mode = safe_call(project.GetCurrentRenderMode)
    created = []

    def restore_delivery_context():
        old_format = previous_format_codec.get("format")
        old_codec = previous_format_codec.get("codec")
        if old_format and old_codec:
            safe_call(lambda: project.SetCurrentRenderFormatAndCodec(old_format, old_codec), False)
        if isinstance(previous_mode, int):
            safe_call(lambda: project.SetCurrentRenderMode(previous_mode), False)

    def compensate():
        for queued in created:
            safe_call(lambda item=queued: project.DeleteRenderJob(item["jobId"]), False)
        restore_delivery_context()

    if not safe_call(lambda: project.SetCurrentRenderMode(1), False):
        restore_delivery_context()
        return {{"ok": False, "error": "render_mode_failed", "message": "Resolve avviste Single clip-render mode."}}

    for profile in profiles:
        available = safe_call(lambda p=profile: project.GetRenderCodecs(p["extension"]), {{}}) or {{}}
        if profile["codec"] not in available.values():
            compensate()
            return {{"ok": False, "error": "codec_changed", "message": "Render-codec er ikke lenger tilgjengelig: " + profile["label"]}}
        if not safe_call(lambda p=profile: project.SetCurrentRenderFormatAndCodec(p["extension"], p["codec"]), False):
            compensate()
            return {{"ok": False, "error": "format_codec_failed", "message": "Resolve avviste format/codec for " + profile["label"]}}
        settings = {{
            "SelectAllFrames": True,
            "TargetDir": target_dir,
            "CustomName": profile["customName"],
            "UseUniqueFilenames": True,
            "UniqueFilenameStyle": 1,
            "ExportVideo": True,
            "ExportAudio": True
        }}
        if profile["width"] is not None and profile["height"] is not None:
            settings["FormatWidth"] = profile["width"]
            settings["FormatHeight"] = profile["height"]
        if profile["quality"] is not None:
            settings["VideoQuality"] = profile["quality"]
        if not safe_call(lambda s=settings: project.SetRenderSettings(s), False):
            compensate()
            return {{"ok": False, "error": "render_settings_failed", "message": "Resolve avviste renderinnstillinger for " + profile["label"]}}
        job_id = safe_call(project.AddRenderJob)
        if not job_id:
            compensate()
            return {{"ok": False, "error": "add_render_job_failed", "message": "Resolve kunne ikke legge " + profile["label"] + " i renderkøen."}}
        created.append({{"jobId": str(job_id), "profileId": profile["id"], "label": profile["label"], "customName": profile["customName"]}})

    restore_delivery_context()
    queued_ids = {{str(item.get("JobId")) for item in (safe_call(project.GetRenderJobList, []) or [])}}
    verified = all(item["jobId"] in queued_ids for item in created)
    if not verified:
        compensate()
        return {{"ok": False, "error": "render_queue_readback_failed", "message": "Renderkøen matchet ikke godkjent plan.", "compensated": True}}
    return {{
        "ok": True,
        "operation": "queueRenderJobs",
        "queued": created,
        "targetDir": {display_target_dir},
        "renderingStarted": False,
        "verified": True
    }}

result = execute()
"#, rows = rows, target_dir = python_string(target_dir), display_target_dir = python_string(display_target_dir)));
        }
        ApprovedOperation::RenameV1Clips { changes } => {
            let rows = changes
                .iter()
                .map(|change| {
                    format!(
                        "{{\"itemId\":{},\"startFrame\":{},\"oldName\":{},\"newName\":{}}}",
                        python_string(&change.item_id),
                        change.start_frame,
                        python_string(&change.old_name),
                        python_string(&change.new_name),
                    )
                })
                .collect::<Vec<_>>()
                .join(",");
            script.push_str(&format!(r#"
    specs = [{rows}]
    items = safe_call(lambda: timeline.GetItemListInTrack("video", 1), []) or []
    found = {{safe_call(item.GetUniqueId): item for item in items if safe_call(item.GetType, "") == "video"}}
    for spec in specs:
        item = found.get(spec["itemId"])
        if item is None:
            return {{"ok": False, "error": "stale_v1", "message": "Et godkjent V1-klipp finnes ikke lenger."}}
        current_name = safe_call(item.GetName, "") or ""
        current_start = int(safe_call(item.GetStart, -1) or -1)
        if current_name != spec["oldName"] or current_start != spec["startFrame"]:
            return {{"ok": False, "error": "stale_v1", "message": "V1 er endret etter at navneplanen ble opprettet."}}

    changed = []
    for spec in specs:
        item = found[spec["itemId"]]
        if not safe_call(lambda i=item, n=spec["newName"]: i.SetName(n), False):
            for previous in changed:
                safe_call(lambda p=previous: found[p["itemId"]].SetName(p["oldName"]), False)
            return {{"ok": False, "error": "rename_failed", "message": "Resolve avviste nytt klippnavn.", "compensated": True}}
        changed.append(spec)

    verified = all((safe_call(lambda s=spec: found[s["itemId"]].GetName(), "") or "") == spec["newName"] for spec in specs)
    if not verified:
        for spec in changed:
            safe_call(lambda s=spec: found[s["itemId"]].SetName(s["oldName"]), False)
        return {{"ok": False, "error": "rename_readback_failed", "message": "Navnene kunne ikke verifiseres og ble forsøkt gjenopprettet.", "compensated": True}}
    return {{"ok": True, "operation": "renameV1Clips", "changes": specs, "verified": True}}

result = execute()
"#, rows = rows));
        }
        ApprovedOperation::GenerateLut { .. } | ApprovedOperation::Noop => return None,
    }
    let _ = plan_id;
    Some(script)
}

async fn apply_operation(
    operation: &ApprovedOperation,
    target: &ResolveMcpPlanTarget,
    plan_id: &str,
) -> Result<Value, String> {
    if let ApprovedOperation::GenerateLut {
        path,
        size,
        transform,
    } = operation
    {
        let response = resolve_mcp::call_tool(
            "generate_lut",
            json!({"path": path, "size": size, "transform": transform}),
            Duration::from_secs(60),
        )
        .await?;
        return Ok(
            json!({"ok": true, "operation": "generateLut", "path": path, "verified": true, "mcpResponse": response}),
        );
    }
    let render_target = if let ApprovedOperation::QueueRenderJobs { target_dir, .. } = operation {
        std::fs::create_dir_all(target_dir)
            .map_err(|error| format!("Kunne ikke opprette Post Agent-eksportmappen: {error}"))?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(target_dir, std::fs::Permissions::from_mode(0o700))
                .map_err(|error| format!("Kunne ikke sikre Post Agent-eksportmappen: {error}"))?;
        }
        Some(target_dir.as_str())
    } else {
        None
    };
    let script =
        apply_script(operation, target, plan_id).ok_or("Planen har ingen utførbar operasjon")?;
    let result = match resolve_mcp::run_allowlisted_script(script).await {
        Ok(result) => result,
        Err(error) => {
            if let Some(target_dir) = render_target {
                let _ = std::fs::remove_dir(target_dir);
            }
            return Err(error);
        }
    };
    if result.get("ok").and_then(Value::as_bool) != Some(true) {
        if let Some(target_dir) = render_target {
            let _ = std::fs::remove_dir(target_dir);
        }
        return Err(result
            .get("message")
            .and_then(Value::as_str)
            .or_else(|| result.get("error").and_then(Value::as_str))
            .unwrap_or("Resolve avviste den godkjente operasjonen")
            .to_string());
    }
    Ok(result)
}

pub async fn apply_plan(
    state: &ResolveMcpGatewayState,
    plan_id: String,
    confirmation_token: String,
) -> Result<ResolveMcpWorkflowPlan, String> {
    let (operation, target) = {
        let mut plans = state
            .plans
            .lock()
            .map_err(|_| "Planlageret er låst".to_string())?;
        let stored = plans
            .get_mut(&plan_id)
            .ok_or("Ukjent eller utløpt Resolve-plan")?;
        if stored.public.state != "planned" {
            return Err("Planen er allerede behandlet".into());
        }
        if !stored.public.executable {
            return Err("Planen mangler input og kan ikke utføres".into());
        }
        if stored.public.confirmation_token != confirmation_token {
            return Err("Godkjenningstoken matcher ikke planen".into());
        }
        let expires = chrono::DateTime::parse_from_rfc3339(&stored.public.expires_at)
            .map_err(|_| "Ugyldig utløpstid")?;
        if expires < Utc::now() {
            return Err("Planen er utløpt; lag en ny plan mot gjeldende Resolve-tilstand".into());
        }
        stored.public.state = "applying".into();
        (stored.operation.clone(), stored.public.target.clone())
    };
    let outcome = apply_operation(&operation, &target, &plan_id).await;
    let mut plans = state
        .plans
        .lock()
        .map_err(|_| "Planlageret er låst".to_string())?;
    let stored = plans
        .get_mut(&plan_id)
        .ok_or("Planen forsvant fra planlageret")?;
    match outcome {
        Ok(result) => {
            stored.public.state = "applied".into();
            stored.public.verification = Some(json!({
                "ok": result.get("verified").and_then(Value::as_bool).unwrap_or(false),
                "checkedAt": Utc::now().to_rfc3339(),
                "source": "immediate-resolve-readback"
            }));
            stored.public.result = Some(result);
            Ok(stored.public.clone())
        }
        Err(error) => {
            stored.public.state = "planned".into();
            Err(error)
        }
    }
}

fn rollback_script(
    operation: &ApprovedOperation,
    target: &ResolveMcpPlanTarget,
    result: &Value,
) -> Option<String> {
    let requires_timeline = matches!(
        operation,
        ApprovedOperation::AddMarkers { .. }
            | ApprovedOperation::SetVoiceIsolation { .. }
            | ApprovedOperation::RenameV1Clips { .. }
    );
    let mut script = ensure_target_prelude(target, requires_timeline);
    match operation {
        ApprovedOperation::CreateBins { .. } => {
            let created = result
                .get("created")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let ids = created
                .iter()
                .filter_map(|item| value_string(item.get("uniqueId")))
                .collect::<Vec<_>>();
            script.push_str(&format!(r#"
    wanted = set({})
    media_pool = project.GetMediaPool()
    root = media_pool.GetRootFolder()
    removable = []
    refused = []
    for folder in (safe_call(root.GetSubFolderList, []) or []):
        uid = safe_call(folder.GetUniqueId)
        if uid not in wanted:
            continue
        if (safe_call(folder.GetClipList, []) or []) or (safe_call(folder.GetSubFolderList, []) or []):
            refused.append(uid)
        else:
            removable.append(folder)
    ok = True if not removable else bool(safe_call(lambda: media_pool.DeleteFolders(removable), False))
    return {{"ok": ok and not refused, "deleted": [safe_call(f.GetUniqueId) for f in removable], "refusedNonEmpty": refused}}

result = execute()
"#, python_strings(&ids)));
        }
        ApprovedOperation::AddMarkers { .. } => {
            let custom = result
                .get("added")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| value_string(item.get("customData")))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            script.push_str(&format!(r#"
    custom_values = {}
    deleted = [value for value in custom_values if safe_call(lambda v=value: timeline.DeleteMarkerByCustomData(v), False)]
    remaining = [value for value in custom_values if bool(safe_call(lambda v=value: timeline.GetMarkerByCustomData(v), {{}}))]
    return {{"ok": not remaining, "deletedCustomData": deleted, "remaining": remaining}}

result = execute()
"#, python_strings(&custom)));
        }
        ApprovedOperation::SetVoiceIsolation { .. } => {
            let previous = result
                .get("previous")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let rows = previous
                .iter()
                .filter_map(|item| {
                    let track = item.get("trackIndex")?.as_u64()?;
                    let state = item.get("state")?;
                    let enabled = state
                        .get("isEnabled")
                        .and_then(Value::as_bool)
                        .unwrap_or(false);
                    let amount = state
                        .get("amount")
                        .and_then(Value::as_u64)
                        .unwrap_or(0)
                        .min(100);
                    Some(format!(
                        "{{\"trackIndex\":{track},\"isEnabled\":{},\"amount\":{amount}}}",
                        if enabled { "True" } else { "False" }
                    ))
                })
                .collect::<Vec<_>>()
                .join(",");
            script.push_str(&format!(r#"
    previous = [{rows}]
    restored = []
    for item in previous:
        if safe_call(lambda v=item: timeline.SetVoiceIsolationState(v["trackIndex"], {{"isEnabled": v["isEnabled"], "amount": v["amount"]}}), False):
            restored.append(item["trackIndex"])
    return {{"ok": len(restored) == len(previous), "restoredTracks": restored}}

result = execute()
"#));
        }
        ApprovedOperation::CreateMulticam { .. } => {
            let ids = result
                .get("created")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| value_string(item.get("uniqueId")))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            script.push_str(&delete_media_items_script(&ids));
        }
        ApprovedOperation::CreateSelectsTimeline { .. } => {
            let id = value_string(result.pointer("/created/uniqueId")).unwrap_or_default();
            let signature = value_string(result.get("signature")).unwrap_or_else(|| "[]".into());
            script.push_str(&format!(
                r#"
    wanted = {}
    expected_signature = {}
    media_pool = project.GetMediaPool()
    found = None
    for index in range(1, int(safe_call(project.GetTimelineCount, 0) or 0) + 1):
        candidate = safe_call(lambda i=index: project.GetTimelineByIndex(i))
        if candidate is not None and safe_call(candidate.GetUniqueId) == wanted:
            found = candidate
            break
    if found is None:
        return {{"ok": True, "alreadyAbsent": True}}
    current_signature = []
    for track_type in ("video", "audio", "subtitle"):
        for track_index in range(1, int(safe_call(lambda t=track_type: found.GetTrackCount(t), 0) or 0) + 1):
            for item in (safe_call(lambda t=track_type, i=track_index: found.GetItemListInTrack(t, i), []) or []):
                current_signature.append([track_type, track_index, safe_call(item.GetUniqueId), safe_call(item.GetName), safe_call(item.GetStart), safe_call(item.GetEnd)])
    if repr(current_signature) != expected_signature:
        return {{"ok": False, "message": "Selects-timeline er endret etter opprettelse og slettes derfor ikke."}}
    ok = bool(safe_call(lambda: media_pool.DeleteTimelines([found]), False))
    return {{"ok": ok, "deletedTimelineId": wanted}}

result = execute()
"#,
                python_string(&id),
                python_string(&signature)
            ));
        }
        ApprovedOperation::QueueRenderJobs { .. } => {
            let ids = result
                .get("queued")
                .and_then(Value::as_array)
                .map(|items| {
                    items
                        .iter()
                        .filter_map(|item| value_string(item.get("jobId")))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            script.push_str(&format!(r#"
    wanted = {}
    ready_states = {{"Ready", "Ready for background render", "Ready to remotely render"}}
    refused = []
    statuses = {{}}
    for job_id in wanted:
        status = safe_call(lambda j=job_id: project.GetRenderJobStatus(j), {{}}) or {{}}
        state = status.get("JobStatus")
        statuses[job_id] = state
        if state is not None and state not in ready_states:
            refused.append({{"jobId": job_id, "status": state}})
    if refused:
        return {{"ok": False, "message": "En renderjobb er startet eller ferdig og slettes derfor ikke.", "refused": refused}}
    deleted = [job_id for job_id in wanted if safe_call(lambda j=job_id: project.DeleteRenderJob(j), False)]
    remaining_ids = {{str(item.get("JobId")) for item in (safe_call(project.GetRenderJobList, []) or [])}}
    remaining = [job_id for job_id in wanted if job_id in remaining_ids]
    return {{"ok": not remaining and len(deleted) == len(wanted), "deletedJobIds": deleted, "remaining": remaining, "previousStatuses": statuses}}

result = execute()
"#, python_strings(&ids)));
        }
        ApprovedOperation::RenameV1Clips { .. } => {
            let changes = result
                .get("changes")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let rows = changes
                .iter()
                .filter_map(|change| {
                    Some(format!(
                        "{{\"itemId\":{},\"startFrame\":{},\"oldName\":{},\"newName\":{}}}",
                        python_string(&value_string(change.get("itemId"))?),
                        change.get("startFrame")?.as_i64()?,
                        python_string(&value_string(change.get("oldName"))?),
                        python_string(&value_string(change.get("newName"))?),
                    ))
                })
                .collect::<Vec<_>>()
                .join(",");
            script.push_str(&format!(r#"
    specs = [{rows}]
    items = safe_call(lambda: timeline.GetItemListInTrack("video", 1), []) or []
    found = {{safe_call(item.GetUniqueId): item for item in items if safe_call(item.GetType, "") == "video"}}
    refused = []
    for spec in specs:
        item = found.get(spec["itemId"])
        if item is None:
            refused.append({{"itemId": spec["itemId"], "reason": "missing"}})
            continue
        current_name = safe_call(item.GetName, "") or ""
        current_start = int(safe_call(item.GetStart, -1) or -1)
        if current_name != spec["newName"] or current_start != spec["startFrame"]:
            refused.append({{"itemId": spec["itemId"], "reason": "changed", "currentName": current_name}})
    if refused:
        return {{"ok": False, "message": "V1 er endret etter navngiving; rollback nekter å overskrive nyere endringer.", "refused": refused}}

    restored = []
    for spec in specs:
        if not safe_call(lambda s=spec: found[s["itemId"]].SetName(s["oldName"]), False):
            for previous in restored:
                safe_call(lambda p=previous: found[p["itemId"]].SetName(p["newName"]), False)
            return {{"ok": False, "message": "Resolve avviste rollback; allerede gjenopprettede navn ble forsøkt satt tilbake.", "compensated": True}}
        restored.append(spec)
    verified = all((safe_call(lambda s=spec: found[s["itemId"]].GetName(), "") or "") == spec["oldName"] for spec in specs)
    return {{"ok": verified, "restored": specs, "verified": verified}}

result = execute()
"#, rows = rows));
        }
        ApprovedOperation::GenerateLut { .. } | ApprovedOperation::Noop => return None,
    }
    Some(script)
}

fn delete_media_items_script(ids: &[String]) -> String {
    format!(
        r#"
    wanted = set({})
    media_pool = project.GetMediaPool()
    root = media_pool.GetRootFolder()
    found = []
    def walk(folder, depth=0):
        if folder is None or depth > 32:
            return
        for clip in (safe_call(folder.GetClipList, []) or []):
            if safe_call(clip.GetUniqueId) in wanted:
                found.append(clip)
        for child in (safe_call(folder.GetSubFolderList, []) or []):
            walk(child, depth + 1)
    walk(root)
    used = set()
    for timeline_index in range(1, int(safe_call(project.GetTimelineCount, 0) or 0) + 1):
        candidate = safe_call(lambda i=timeline_index: project.GetTimelineByIndex(i))
        if candidate is None:
            continue
        for track_type in ("video", "audio"):
            for track_index in range(1, int(safe_call(lambda t=track_type: candidate.GetTrackCount(t), 0) or 0) + 1):
                for item in (safe_call(lambda t=track_type, i=track_index: candidate.GetItemListInTrack(t, i), []) or []):
                    media_item = safe_call(item.GetMediaPoolItem)
                    uid = safe_call(media_item.GetUniqueId) if media_item else None
                    if uid in wanted:
                        used.add(uid)
    removable = [item for item in found if safe_call(item.GetUniqueId) not in used]
    ok = True if not removable else bool(safe_call(lambda: media_pool.DeleteClips(removable), False))
    return {{"ok": ok and not used, "deleted": [safe_call(item.GetUniqueId) for item in removable], "refusedInUse": list(used)}}

result = execute()
"#,
        python_strings(ids)
    )
}

pub async fn rollback_plan(
    state: &ResolveMcpGatewayState,
    plan_id: String,
    confirmation_token: String,
) -> Result<ResolveMcpWorkflowPlan, String> {
    let (operation, target, result) = {
        let mut plans = state
            .plans
            .lock()
            .map_err(|_| "Planlageret er låst".to_string())?;
        let stored = plans
            .get_mut(&plan_id)
            .ok_or("Ukjent eller utløpt Resolve-plan")?;
        if stored.public.state != "applied" {
            return Err("Bare en utført plan kan rulles tilbake".into());
        }
        if stored.public.confirmation_token != confirmation_token {
            return Err("Godkjenningstoken matcher ikke planen".into());
        }
        stored.public.state = "rolling-back".into();
        (
            stored.operation.clone(),
            stored.public.target.clone(),
            stored.public.result.clone().unwrap_or(Value::Null),
        )
    };
    let mut outcome = if let ApprovedOperation::GenerateLut { path, .. } = &operation {
        resolve_mcp::call_tool("delete_lut", json!({"path": path}), Duration::from_secs(30))
            .await
            .map(|response| json!({"ok": true, "deletedPath": path, "mcpResponse": response}))
    } else {
        let script = rollback_script(&operation, &target, &result)
            .ok_or("Operasjonen støtter ikke rollback")?;
        resolve_mcp::run_allowlisted_script(script).await
    };
    if let (ApprovedOperation::QueueRenderJobs { target_dir, .. }, Ok(result)) =
        (&operation, &mut outcome)
    {
        if result.get("ok").and_then(Value::as_bool) == Some(true) {
            let directory_removed = match std::fs::remove_dir(target_dir) {
                Ok(()) => true,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => true,
                Err(_) => false,
            };
            if let Some(object) = result.as_object_mut() {
                object.insert("outputDirectoryRemoved".into(), json!(directory_removed));
            }
        }
    }
    let mut plans = state
        .plans
        .lock()
        .map_err(|_| "Planlageret er låst".to_string())?;
    let stored = plans
        .get_mut(&plan_id)
        .ok_or("Planen forsvant fra planlageret")?;
    match outcome {
        Ok(result) if result.get("ok").and_then(Value::as_bool) != Some(false) => {
            stored.public.state = "rolled-back".into();
            stored.public.rollback_result = Some(result);
            Ok(stored.public.clone())
        }
        Ok(result) => {
            stored.public.state = "applied".into();
            Err(result
                .get("message")
                .and_then(Value::as_str)
                .unwrap_or("Rollback ble avvist fordi Resolve-tilstanden har endret seg")
                .to_string())
        }
        Err(error) => {
            stored.public.state = "applied".into();
            Err(error)
        }
    }
}

pub fn get_plan(
    state: &ResolveMcpGatewayState,
    plan_id: &str,
) -> Result<ResolveMcpWorkflowPlan, String> {
    state
        .plans
        .lock()
        .map_err(|_| "Planlageret er låst".to_string())?
        .get(plan_id)
        .map(|stored| stored.public.clone())
        .ok_or("Ukjent eller utløpt Resolve-plan".into())
}

pub fn latest_plan(state: &ResolveMcpGatewayState) -> Option<ResolveMcpWorkflowPlan> {
    state
        .plans
        .lock()
        .ok()?
        .values()
        .map(|stored| stored.public.clone())
        .max_by(|left, right| left.created_at.cmp(&right.created_at))
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolveMcpIntelligence {
    pub schema_version: u8,
    pub resolve_version: Option<String>,
    pub tool_names: Vec<String>,
    pub whats_new_since_21: Value,
    pub api_evidence: HashMap<String, Value>,
    pub generated_at: String,
}

pub async fn intelligence() -> Result<ResolveMcpIntelligence, String> {
    let status = resolve_mcp::status().await;
    if !status.available {
        return Err(status.message);
    }
    let whats_new = resolve_mcp::call_tool(
        "get_whats_new",
        json!({"since": "21.0"}),
        Duration::from_secs(30),
    )
    .await?;
    let patterns = [
        ("organizer", "AddSubFolder|MoveClips|SetClipProperty"),
        (
            "transcript",
            "GetTranscription|CreateTimelineFromClips|CreateSubtitlesFromAudio",
        ),
        ("multicam", "CreateMulticamClip|AutoSyncAudio|SmartSwitch"),
        (
            "audio",
            "VoiceIsolation|NormalizeAudioLevel|DialogueLeveler",
        ),
        ("color", "SetLUT|GetNodeGraph|ColorGroup"),
        ("review", "AddMarker|DeleteMarkerByCustomData|GetMarkers"),
        (
            "render",
            "GetRenderFormats|GetRenderCodecs|SetCurrentRenderFormatAndCodec|SetRenderSettings|AddRenderJob|DeleteRenderJob|GetRenderJobStatus",
        ),
        (
            "rename",
            "TimelineItem.SetName|GetItemListInTrack|TimelineItem.GetUniqueId|TimelineItem.GetStart",
        ),
    ];
    let mut api_evidence = HashMap::new();
    for (domain, pattern) in patterns {
        let evidence = resolve_mcp::call_tool(
            "search_scripting_api",
            json!({"pattern": pattern, "api": "DaVinciResolveScript.pyi"}),
            Duration::from_secs(30),
        )
        .await?;
        api_evidence.insert(domain.to_string(), evidence);
    }
    Ok(ResolveMcpIntelligence {
        schema_version: 1,
        resolve_version: status.server_version,
        tool_names: status.tool_names,
        whats_new_since_21: whats_new,
        api_evidence,
        generated_at: Utc::now().to_rfc3339(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn assert_valid_python(script: &str) {
        let status = std::process::Command::new("python3")
            .arg("-c")
            .arg("import sys; compile(sys.argv[1], '<post-agent>', 'exec')")
            .arg(script)
            .status()
            .expect("python3 is required by the Resolve scripting integration");
        assert!(status.success(), "generated Resolve script must parse");
    }

    fn preflight() -> Value {
        json!({
            "project": {"name": "Test", "uniqueId": "project-1"},
            "timeline": {"name": "Master", "uniqueId": "timeline-1", "durationFrames": 2500, "frameRate": "25"},
            "details": {
                "rootBins": ["01_FOOTAGE"],
                "selectedMediaPoolClips": [{"name": "A", "uniqueId": "clip-a"}, {"name": "B", "uniqueId": "clip-b"}],
                "audioTrackStates": [{"trackIndex": 1, "voiceIsolation": {"isEnabled": false, "amount": 0}}],
                "v1TimelineItems": [
                    {"uniqueId": "item-b", "name": "Second", "startFrame": 200, "endFrame": 300},
                    {"uniqueId": "item-a", "name": "First", "startFrame": 100, "endFrame": 180}
                ],
                "renderFormats": {"QuickTime": "mov", "MP4": "mp4"},
                "renderCodecs": {
                    "mov": {"Apple ProRes 422 HQ": "ProRes422HQ"},
                    "mp4": {"H.265": "H265", "H.264": "H264"}
                }
            }
        })
    }

    #[test]
    fn organizer_only_plans_missing_bins() {
        let (operation, _, _) = build_operation(
            "resolve-project-organizer",
            &json!({}),
            &preflight(),
            "12345678-rest",
        )
        .unwrap();
        match operation {
            ApprovedOperation::CreateBins { names } => {
                assert!(!names.contains(&"01_FOOTAGE".to_string()));
                assert!(names.contains(&"02_AUDIO".to_string()));
            }
            _ => panic!("expected bins"),
        }
    }

    #[test]
    fn review_markers_are_bounded_and_traceable() {
        let input = json!({"notes": [{"timeSec": 2.0, "name": "Trim", "note": "Kortere"}]});
        let (operation, _, _) = build_operation(
            "resolve-review-notes",
            &input,
            &preflight(),
            "12345678-rest",
        )
        .unwrap();
        match operation {
            ApprovedOperation::AddMarkers { markers } => {
                assert_eq!(markers[0].frame_id, 50);
                assert_eq!(markers[0].custom_data, "post-agent:12345678-rest:0");
            }
            _ => panic!("expected markers"),
        }
    }

    #[test]
    fn multicam_defaults_to_selected_media_pool_clips() {
        let (operation, _, _) = build_operation(
            "resolve-multicam-director",
            &json!({}),
            &preflight(),
            "12345678-rest",
        )
        .unwrap();
        match operation {
            ApprovedOperation::CreateMulticam {
                clip_ids,
                sync_mode,
                ..
            } => {
                assert_eq!(clip_ids, vec!["clip-a", "clip-b"]);
                assert_eq!(sync_mode, "timecode");
            }
            _ => panic!("expected multicam"),
        }
    }

    #[test]
    fn raw_python_is_not_part_of_any_public_plan() {
        let (operation, summary, warnings) = build_operation(
            "resolve-color-guardian",
            &json!({"preset": "music-teal", "script": "evil"}),
            &preflight(),
            "12345678-rest",
        )
        .unwrap();
        assert!(matches!(operation, ApprovedOperation::GenerateLut { .. }));
        assert!(!summary.contains("evil"));
        assert!(!warnings.join(" ").contains("evil"));
    }

    #[test]
    fn batch_render_is_queue_only_and_ignores_external_paths() {
        let (operation, summary, warnings) = build_operation(
            "resolve-batch-render-planner",
            &json!({
                "profileIds": ["prores-422-hq", "h265-4k", "h264-proxy"],
                "baseName": "Wedding Master",
                "targetDir": "/tmp/untrusted"
            }),
            &preflight(),
            "12345678-rest",
        )
        .unwrap();
        let target = target_from_preflight(&preflight()).unwrap();
        let script = apply_script(&operation, &target, "12345678-rest").unwrap();
        assert!(matches!(
            operation,
            ApprovedOperation::QueueRenderJobs { .. }
        ));
        assert!(summary.contains("3 validerte leveranser"));
        assert!(
            warnings
                .iter()
                .any(|warning| warning.contains("aldri StartRendering"))
        );
        assert!(script.contains("project.AddRenderJob"));
        assert!(!script.contains("StartRendering"));
        assert!(!script.contains("import os"));
        assert!(!script.contains("/tmp/untrusted"));
        assert!(script.contains("Post Agent Exports"));
        assert!(!summary.contains("/Users/"));
        assert_valid_python(&script);

        let rollback = rollback_script(
            &operation,
            &target,
            &json!({"queued": [{"jobId": "job-1"}]}),
        )
        .unwrap();
        assert!(rollback.contains("GetRenderJobStatus"));
        assert_valid_python(&rollback);
    }

    #[test]
    fn v1_renamer_locks_order_names_and_ids() {
        let (operation, _, _) = build_operation(
            "resolve-v1-clip-renamer",
            &json!({"prefix": "SCENE", "startNumber": 7, "padding": 3}),
            &preflight(),
            "12345678-rest",
        )
        .unwrap();
        let preview = preview_for(&operation);
        let items = preview["items"].as_array().expect("rename preview");
        assert_eq!(items[0]["id"], "item-a");
        assert_eq!(items[0]["before"], "First");
        assert_eq!(items[0]["after"], "SCENE_007");
        assert_eq!(items[1]["after"], "SCENE_008");

        let target = target_from_preflight(&preflight()).unwrap();
        let apply = apply_script(&operation, &target, "12345678-rest").unwrap();
        assert!(apply.contains("stale_v1"));
        assert!(apply.contains("SetName"));
        assert!(apply.contains("item-a"));
        assert_valid_python(&apply);

        let rollback = rollback_script(
            &operation,
            &target,
            &json!({
                "changes": [
                    {"itemId": "item-a", "startFrame": 100, "oldName": "First", "newName": "SCENE_007"},
                    {"itemId": "item-b", "startFrame": 200, "oldName": "Second", "newName": "SCENE_008"}
                ]
            }),
        )
        .unwrap();
        assert!(rollback.contains("rollback nekter"));
        assert_valid_python(&rollback);
    }

    #[test]
    fn installed_server_executes_read_only_gateway_preflight_when_reachable() {
        let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
        runtime.block_on(async {
            let status = resolve_mcp::status().await;
            if !status.resolve_reachable {
                return;
            }
            let script = PREFLIGHT_SCRIPT.replace("__SKILL_ID__", "resolve-project-organizer");
            let report = resolve_mcp::run_allowlisted_script(script)
                .await
                .expect("gateway preflight");
            assert_eq!(report["skillId"], "resolve-project-organizer");
            assert_eq!(report["readOnly"], true);
            assert!(report["findings"].is_array());
        });
    }

    #[test]
    fn installed_server_returns_versioned_api_intelligence_when_reachable() {
        let runtime = tokio::runtime::Runtime::new().expect("tokio runtime");
        runtime.block_on(async {
            let status = resolve_mcp::status().await;
            if !status.resolve_reachable {
                return;
            }
            let context = intelligence().await.expect("versioned intelligence");
            assert_eq!(context.resolve_version.as_deref(), Some("21.1"));
            assert_eq!(context.api_evidence.len(), 8);
            assert!(
                context
                    .tool_names
                    .iter()
                    .any(|name| name == "get_whats_new")
            );
            assert!(
                context
                    .tool_names
                    .iter()
                    .any(|name| name == "search_scripting_api")
            );
        });
    }
}
