//! Adapter for Avid's locally installed PTSL command client.
//!
//! The SDK and generated Avid client remain outside this repository under the
//! SDK license. Companion can use either CreatorHub's licensed stdin/stdout
//! bridge or Avid's locally built `ptslcmd`; Session Info and bounce watchers
//! remain available when neither local bridge is present.

use std::collections::HashMap;
use std::io::Write;
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::{json, Value};

use crate::config;

#[derive(Debug, Clone, Serialize)]
pub struct PtslStatus {
    pub state: String,
    pub server_detected: bool,
    pub helper_installed: bool,
    pub helper_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum BridgeKind {
    CreatorHub,
    AvidCli,
}

#[derive(Debug, Clone)]
struct Bridge {
    path: PathBuf,
    kind: BridgeKind,
}

fn existing(path: PathBuf, kind: BridgeKind) -> Option<Bridge> {
    path.is_file().then_some(Bridge { path, kind })
}

fn bridge() -> Option<Bridge> {
    if let Ok(configured) = std::env::var("CREATORHUB_PTSL_HELPER") {
        if let Some(found) = existing(PathBuf::from(configured), BridgeKind::CreatorHub) {
            return Some(found);
        }
    }
    if let Ok(configured) = std::env::var("CREATORHUB_PTSLCMD") {
        if let Some(found) = existing(PathBuf::from(configured), BridgeKind::AvidCli) {
            return Some(found);
        }
    }

    #[cfg(target_os = "windows")]
    let ptslcmd_name = "ptslcmd.exe";
    #[cfg(not(target_os = "windows"))]
    let ptslcmd_name = "ptslcmd";
    if let Some(found) = existing(
        config::config_dir().join("ptsl").join(ptslcmd_name),
        BridgeKind::AvidCli,
    ) {
        return Some(found);
    }

    // Developer/user installations created by Avid's SDK installer. The SDK
    // itself is never copied into the repository or the distributable app.
    if let Some(downloads) = dirs::download_dir() {
        let mut candidates = std::fs::read_dir(downloads)
            .ok()
            .into_iter()
            .flatten()
            .flatten()
            .filter_map(|entry| {
                let name = entry.file_name();
                name.to_string_lossy()
                    .starts_with("PTSL_SDK_CPP.")
                    .then(|| entry.path())
            })
            .collect::<Vec<_>>();
        candidates.sort();
        for root in candidates.into_iter().rev() {
            #[cfg(target_os = "macos")]
            let candidate = root
                .join("install")
                .join("x86_64_arm64")
                .join("Release")
                .join("ptslcmd")
                .join(ptslcmd_name);
            #[cfg(target_os = "windows")]
            let candidate = root
                .join("install")
                .join("x86_64")
                .join("Release")
                .join("ptslcmd")
                .join(ptslcmd_name);
            #[cfg(not(any(target_os = "macos", target_os = "windows")))]
            let candidate = root.join("install").join("ptslcmd").join(ptslcmd_name);
            if let Some(found) = existing(candidate, BridgeKind::AvidCli) {
                return Some(found);
            }
        }
    }

    let executable = std::env::current_exe().ok()?;
    let directory = executable.parent()?;
    #[cfg(target_os = "windows")]
    let helper_name = "creatorhub-ptsl-helper.exe";
    #[cfg(not(target_os = "windows"))]
    let helper_name = "creatorhub-ptsl-helper";
    existing(directory.join(helper_name), BridgeKind::CreatorHub)
        .or_else(|| existing(directory.join(ptslcmd_name), BridgeKind::AvidCli))
}

pub fn probe() -> PtslStatus {
    let address = SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), 31416);
    let server_detected = TcpStream::connect_timeout(&address, Duration::from_millis(250)).is_ok();
    let installed = bridge();
    let helper_installed = installed.is_some();
    let state = if server_detected && helper_installed {
        "connected"
    } else if server_detected {
        "degraded"
    } else {
        "unavailable"
    };
    let message = match (server_detected, helper_installed) {
        (true, true) => "Pro Tools PTSL and the licensed local SDK bridge are ready.",
        (true, false) => {
            "Pro Tools PTSL is listening; install the licensed local SDK bridge to enable direct actions."
        }
        (false, true) => {
            "The PTSL bridge is installed, but Pro Tools is not listening on localhost:31416."
        }
        (false, false) => {
            "Direct PTSL is unavailable; Session Info and bounce watchers remain active."
        }
    };
    PtslStatus {
        state: state.to_string(),
        server_detected,
        helper_installed,
        helper_path: installed.map(|item| item.path.to_string_lossy().into_owned()),
        message: message.to_string(),
    }
}

fn completed_response<'a>(responses: &'a [Value], command: &str) -> Option<&'a Value> {
    responses
        .iter()
        .rev()
        .find(|response| is_completed_response(response, command))
}

fn is_completed_response(response: &Value, command: &str) -> bool {
    response.pointer("/header/status").and_then(Value::as_str) == Some("Completed")
        && response
            .pointer("/header/command")
            .and_then(Value::as_str)
            .map(|value| value == command || value.trim_start_matches("CId_") == command)
            .unwrap_or(false)
}

fn response_errors(response: &Value) -> Vec<String> {
    response
        .pointer("/responseErrorJson/errors")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|error| {
            error
                .get("command_error_message")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .collect()
}

fn completed_response_without_errors<'a>(
    responses: &'a [Value],
    command: &str,
) -> Result<&'a Value, String> {
    let completed = completed_response(responses, command)
        .ok_or_else(|| format!("Pro Tools did not confirm {}", command))?;
    let errors = response_errors(completed);
    if errors.is_empty() {
        Ok(completed)
    } else {
        Err(errors.join("; "))
    }
}

fn json_results(output: &str) -> Vec<Value> {
    let bytes = output.as_bytes();
    let mut results = Vec::new();
    let mut offset = 0;
    while let Some(relative) = output[offset..].find("JSON result:") {
        let search_from = offset + relative + "JSON result:".len();
        let Some(open_relative) = output[search_from..].find('{') else {
            break;
        };
        let start = search_from + open_relative;
        let mut depth = 0usize;
        let mut in_string = false;
        let mut escaped = false;
        let mut end = None;
        for (index, byte) in bytes[start..].iter().enumerate() {
            if in_string {
                if escaped {
                    escaped = false;
                } else if *byte == b'\\' {
                    escaped = true;
                } else if *byte == b'"' {
                    in_string = false;
                }
                continue;
            }
            if *byte == b'"' {
                in_string = true;
            } else if *byte == b'{' {
                depth += 1;
            } else if *byte == b'}' {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    end = Some(start + index + 1);
                    break;
                }
            }
        }
        let Some(end) = end else { break };
        if let Ok(value) = serde_json::from_str::<Value>(&output[start..end]) {
            results.push(value);
        }
        offset = end;
    }
    results
}

fn run_avid_cli(executable: &Path, commands: Vec<Value>) -> Result<Vec<Value>, String> {
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let script_path = std::env::temp_dir().join(format!(
        "creatorhub-ptsl-{}-{}.json",
        std::process::id(),
        stamp
    ));
    let mut all_commands = vec![json!({
        "command_name": "RegisterConnection",
        "json_request": {
            "company_name": "CreatorHub",
            "application_name": "CreatorHub Pro Tools Companion"
        }
    })];
    all_commands.extend(commands);
    let script = serde_json::to_vec(&json!({ "commands": all_commands }))
        .map_err(|error| format!("Serialize PTSL script: {}", error))?;
    std::fs::write(&script_path, script)
        .map_err(|error| format!("Write PTSL script: {}", error))?;
    let output = Command::new(executable)
        .arg("-file")
        .arg(&script_path)
        .output();
    let _ = std::fs::remove_file(&script_path);
    let output = output.map_err(|error| format!("Start Avid PTSL client: {}", error))?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let responses = json_results(&stdout);
    if let Some(failed) = responses
        .iter()
        .rev()
        .find(|item| item.pointer("/header/status").and_then(Value::as_str) == Some("Failed"))
    {
        let details = response_errors(failed);
        return Err(if details.is_empty() {
            "Pro Tools rejected the PTSL command".to_string()
        } else {
            details.join("; ")
        });
    }
    if responses.is_empty() {
        let stderr = String::from_utf8_lossy(&output.stderr)
            .trim()
            .chars()
            .take(800)
            .collect::<String>();
        return Err(format!("Avid PTSL client returned no result: {}", stderr));
    }
    Ok(responses)
}

fn avid_command(name: &str, body: Value) -> Value {
    json!({
        "command_name": name,
        "version": "2026.4.0",
        "json_request": body
    })
}

fn finite_seconds(payload: &Value) -> Result<f64, String> {
    let seconds = payload
        .get("seconds")
        .and_then(Value::as_f64)
        .ok_or("PTSL command is missing seconds")?;
    if !seconds.is_finite() || !(0.0..=86_400.0).contains(&seconds) {
        return Err("Invalid PTSL timeline position".into());
    }
    Ok(seconds)
}

fn sample_rate_from(responses: &[Value]) -> Result<(u64, String), String> {
    let response = completed_response(responses, "GetSessionSampleRate")
        .ok_or("Pro Tools did not return its session sample rate")?;
    let label = response
        .pointer("/responseBodyJson/sample_rate")
        .and_then(Value::as_str)
        .ok_or("Pro Tools returned an invalid session sample rate")?;
    let numeric = label
        .chars()
        .filter(|character| character.is_ascii_digit())
        .collect::<String>()
        .parse::<u64>()
        .map_err(|_| "Pro Tools returned an invalid session sample rate".to_string())?;
    Ok((numeric, label.to_string()))
}

fn bit_depth_number(label: &str) -> Option<u16> {
    let numeric = label
        .strip_prefix("BDepth_")
        .unwrap_or(label)
        .chars()
        .take_while(|character| character.is_ascii_digit())
        .collect::<String>();
    (!numeric.is_empty())
        .then(|| numeric.parse().ok())
        .flatten()
}

fn response_body<'a>(responses: &'a [Value], command: &str) -> Option<&'a Value> {
    completed_response(responses, command)?.get("responseBodyJson")
}

#[derive(Debug, Clone, PartialEq)]
struct RecallOperation {
    command: &'static str,
    field: &'static str,
    enabled: bool,
    track_ids: Vec<String>,
    track_names: Vec<String>,
}

fn attribute_state(value: Option<&Value>) -> Option<bool> {
    let value = value?;
    if let Some(enabled) = value.as_bool() {
        return Some(enabled);
    }
    if let Some(number) = value.as_i64() {
        return match number {
            1 => Some(false),
            2..=4 => Some(true),
            _ => None,
        };
    }
    match value.as_str()? {
        "None" | "TAState_None" => Some(false),
        "SetExplicitly"
        | "SetImplicitly"
        | "SetExplicitlyAndImplicitly"
        | "TAState_SetExplicitly"
        | "TAState_SetImplicitly"
        | "TAState_SetExplicitlyAndImplicitly" => Some(true),
        _ => None,
    }
}

fn track_state(track: &Value, field: &str) -> Option<bool> {
    let attributes = track.get("track_attributes")?;
    match field {
        "is_muted" | "is_soloed" | "is_open" => attributes.get(field)?.as_bool(),
        "is_inactive" | "is_hidden" => attribute_state(attributes.get(field)),
        _ => None,
    }
}

fn supports_recall(track: &Value, field: &str) -> bool {
    let track_type = track.get("type").and_then(Value::as_str).unwrap_or("");
    match field {
        "is_muted" | "is_soloed" => !track_type.contains("Video") && !track_type.contains("Master"),
        "is_inactive" => !track_type.contains("Video"),
        "is_open" => track_type.contains("Folder"),
        _ => true,
    }
}

fn recall_operations(
    snapshot_tracks: &[Value],
    current_tracks: &[Value],
) -> (Vec<RecallOperation>, Vec<String>, usize) {
    let current_by_id: HashMap<&str, &Value> = current_tracks
        .iter()
        .filter_map(|track| Some((track.get("id")?.as_str()?, track)))
        .collect();
    let mut current_by_name: HashMap<&str, Vec<&Value>> = HashMap::new();
    for track in current_tracks {
        if let Some(name) = track.get("name").and_then(Value::as_str) {
            current_by_name.entry(name).or_default().push(track);
        }
    }
    let descriptors = [
        ("CId_SetTrackMuteState", "is_muted"),
        ("CId_SetTrackSoloState", "is_soloed"),
        ("CId_SetTrackInactiveState", "is_inactive"),
        ("CId_SetTrackHiddenState", "is_hidden"),
        ("CId_SetTrackOpenState", "is_open"),
    ];
    let mut operations: Vec<RecallOperation> = Vec::new();
    let mut missing = Vec::new();
    let mut matched = 0usize;

    for snapshot_track in snapshot_tracks.iter().take(1024) {
        let snapshot_id = snapshot_track.get("id").and_then(Value::as_str);
        let snapshot_name = snapshot_track
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("Ukjent spor");
        let current = snapshot_id
            .and_then(|id| current_by_id.get(id).copied())
            .or_else(|| {
                current_by_name
                    .get(snapshot_name)
                    .filter(|candidates| candidates.len() == 1)
                    .and_then(|candidates| candidates.first().copied())
            });
        let Some(current) = current else {
            missing.push(snapshot_name.to_string());
            continue;
        };
        let Some(current_id) = current.get("id").and_then(Value::as_str) else {
            missing.push(snapshot_name.to_string());
            continue;
        };
        matched += 1;
        for (command, field) in descriptors {
            if !supports_recall(current, field) {
                continue;
            }
            let Some(desired) = track_state(snapshot_track, field) else {
                continue;
            };
            if track_state(current, field) == Some(desired) {
                continue;
            }
            if let Some(operation) = operations
                .iter_mut()
                .find(|item| item.command == command && item.enabled == desired)
            {
                operation.track_ids.push(current_id.to_string());
                operation.track_names.push(snapshot_name.to_string());
            } else {
                operations.push(RecallOperation {
                    command,
                    field,
                    enabled: desired,
                    track_ids: vec![current_id.to_string()],
                    track_names: vec![snapshot_name.to_string()],
                });
            }
        }
    }
    (operations, missing, matched)
}

fn normalized_session_path(value: &str) -> String {
    let path = value.trim_end_matches(['/', '\\']);
    if cfg!(target_os = "windows") {
        path.to_lowercase()
    } else {
        path.to_string()
    }
}

fn safe_output_stem(value: &str) -> String {
    let stem = value
        .strip_suffix(".wav")
        .or_else(|| value.strip_suffix(".WAV"))
        .unwrap_or(value);
    let safe: String = stem
        .chars()
        .take(160)
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, ' ' | '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect();
    safe.trim_matches('.').trim().to_string()
}

fn mix_sources(responses: &[Value]) -> Vec<Value> {
    responses
        .iter()
        .filter(|response| {
            response.pointer("/header/status").and_then(Value::as_str) == Some("Completed")
                && response
                    .pointer("/header/command")
                    .and_then(Value::as_str)
                    .is_some_and(|command| {
                        command.trim_start_matches("CId_") == "GetExportMixSourceList"
                    })
        })
        .enumerate()
        .flat_map(|(index, response)| {
            // Discovery always requests PhysicalOut first and Bus second.
            let source_type = if index == 0 {
                "EMSType_PhysicalOut"
            } else {
                "EMSType_Bus"
            }
            .to_string();
            response
                .pointer("/responseBodyJson/source_list")
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default()
                .into_iter()
                .filter_map(move |name| {
                    name.as_str()
                        .map(|value| json!({ "name": value, "sourceType": source_type }))
                })
        })
        .collect()
}

fn export_mix_command(
    output_directory: &str,
    file_name: &str,
    source_name: &str,
    source_type: &str,
    sample_rate: &str,
) -> Result<Value, String> {
    let file_stem = safe_output_stem(file_name);
    if file_stem.is_empty() {
        return Err("Invalid export file name".into());
    }
    let mut directory = output_directory.to_string();
    if !directory.ends_with(std::path::MAIN_SEPARATOR) {
        directory.push(std::path::MAIN_SEPARATOR);
    }
    Ok(avid_command(
        "ExportMix",
        json!({
            "file_name": file_stem,
            "file_type": "EMFType_WAV",
            "location_info": {
                "file_destination": "EMFDestination_Directory",
                "directory": directory,
                "import_after_bounce": "TBool_False"
            },
            "audio_info": {
                "export_format": "EFormat_Interleaved",
                "bit_depth": "BDepth_24",
                "sample_rate": sample_rate,
                "pad_to_frame_boundary": "TBool_False",
                "delivery_format": "EMDFormat_FilePerMixSource"
            },
            "video_info": { "include_video": "TBool_False" },
            "offline_bounce": "TBool_True",
            "mix_source_list": [{ "source_type": source_type, "name": source_name }],
            "audio_encoding_options": {}
        }),
    ))
}

fn marker_number() -> i64 {
    let milliseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    1_000 + (milliseconds % 2_000_000_000) as i64
}

fn execute_avid_cli(
    executable: &Path,
    command_kind: &str,
    payload: Value,
) -> Result<Value, String> {
    match command_kind {
        "locate" => {
            let seconds = finite_seconds(&payload)?;
            let value = format!("{:.6}", seconds);
            let responses = run_avid_cli(
                executable,
                vec![avid_command(
                    "SetTimelineSelection",
                    json!({
                        "play_start_marker_time": value,
                        "in_time": value,
                        "out_time": value,
                        "location_type": "TLType_Seconds"
                    }),
                )],
            )?;
            completed_response(&responses, "SetTimelineSelection")
                .ok_or("Pro Tools did not confirm the timeline change")?;
            Ok(json!({ "execution": "ptsl", "seconds": seconds }))
        }
        "create_marker" => {
            let seconds = finite_seconds(&payload)?;
            let discovery = run_avid_cli(
                executable,
                vec![avid_command("GetSessionSampleRate", json!({}))],
            )?;
            let (sample_rate, _) = sample_rate_from(&discovery)?;
            let sample_position = (seconds * sample_rate as f64).round().max(0.0) as u64;
            let number = marker_number();
            let name = payload
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Sound Room feedback");
            let color_index = payload
                .get("colorIndex")
                .and_then(Value::as_i64)
                .filter(|value| (0..=23).contains(value))
                .unwrap_or(5);
            let responses = run_avid_cli(
                executable,
                vec![avid_command(
                    "CreateMemoryLocation",
                    json!({
                        "number": number,
                        "name": name,
                        "start_time": sample_position.to_string(),
                        "end_time": sample_position.to_string(),
                        "time_properties": "TProperties_Marker",
                        "reference": "MLReference_Absolute",
                        "comments": "Synced from CreatorHub Sound Room",
                        "color_index": color_index,
                        "location": "MarkerLocation_NamedRuler",
                        "track_name": "Markers",
                        "general_properties": {
                            "zoom_settings": false,
                            "pre_post_roll_times": false,
                            "track_visibility": false,
                            "track_heights": false,
                            "group_enables": false,
                            "window_configuration": false,
                            "window_configuration_index": 0,
                            "window_configuration_name": "(none)"
                        }
                    }),
                )],
            )?;
            completed_response(&responses, "CreateMemoryLocation")
                .ok_or("Pro Tools did not confirm the marker")?;
            Ok(json!({ "execution": "ptsl", "markerId": number.to_string(), "seconds": seconds }))
        }
        "import_audio" => {
            let local_path = payload
                .get("localPath")
                .and_then(Value::as_str)
                .filter(|value| Path::new(value).is_file())
                .ok_or("The downloaded reference file is unavailable")?;
            let responses = run_avid_cli(
                executable,
                vec![avid_command(
                    "Import",
                    json!({
                        "import_type": "IType_Audio",
                        "audio_data": {
                            "file_list": [local_path],
                            "audio_operations": "AOperations_CopyAudio",
                            "audio_destination": "MDestination_NewTrack",
                            "audio_location": "MLocation_SessionStart",
                            "location_data": {
                                "location_type": "SLType_Start",
                                "location": { "location": "0", "time_type": "TLType_Samples" }
                            }
                        }
                    }),
                )],
            )?;
            completed_response_without_errors(&responses, "Import")
                .map_err(|error| format!("Pro Tools kunne ikke fullføre lydimporten: {}", error))?;
            Ok(json!({ "execution": "ptsl", "localPath": local_path, "imported": true }))
        }
        "export_review" => {
            let output_directory = payload
                .get("outputDirectory")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or("Choose a Bounced Files folder before exporting from Sound Room")?;
            std::fs::create_dir_all(output_directory)
                .map_err(|error| format!("Create bounce directory: {}", error))?;
            let discovery = run_avid_cli(
                executable,
                vec![
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_PhysicalOut" }),
                    ),
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_Bus" }),
                    ),
                    avid_command("GetSessionSampleRate", json!({})),
                ],
            )?;
            let available_sources = mix_sources(&discovery);
            let requested_source = payload.get("source").and_then(Value::as_str);
            let selected = available_sources
                .iter()
                .find(|entry| {
                    requested_source.is_some_and(|requested| {
                        entry.get("name").and_then(Value::as_str) == Some(requested)
                    })
                })
                .or_else(|| available_sources.first())
                .ok_or("Pro Tools has no physical mix output available")?;
            let source = selected
                .get("name")
                .and_then(Value::as_str)
                .ok_or("Invalid mix source")?;
            let source_type = selected
                .get("sourceType")
                .and_then(Value::as_str)
                .unwrap_or("EMSType_PhysicalOut");
            let (_, sample_rate) = sample_rate_from(&discovery)?;
            let requested_name = payload
                .get("fileName")
                .and_then(Value::as_str)
                .unwrap_or("Sound Room Mix.wav");
            let file_stem = safe_output_stem(requested_name);
            let command = export_mix_command(
                output_directory,
                requested_name,
                source,
                source_type,
                &sample_rate,
            )?;
            let responses = run_avid_cli(executable, vec![command])?;
            completed_response(&responses, "ExportMix")
                .ok_or("Pro Tools did not confirm the mix export")?;
            let output_path = Path::new(output_directory).join(format!("{}.wav", file_stem));
            Ok(
                json!({ "execution": "ptsl", "outputPath": output_path, "source": source, "exported": true }),
            )
        }
        "list_export_sources" => {
            let responses = run_avid_cli(
                executable,
                vec![
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_PhysicalOut" }),
                    ),
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_Bus" }),
                    ),
                ],
            )?;
            Ok(json!({ "execution": "ptsl", "sources": mix_sources(&responses) }))
        }
        "session_snapshot" => {
            let responses = run_avid_cli(
                executable,
                vec![
                    avid_command("CId_GetSessionName", json!({})),
                    avid_command("CId_GetSessionPath", json!({})),
                    avid_command("CId_GetSessionSampleRate", json!({})),
                    avid_command("CId_GetSessionBitDepth", json!({})),
                    avid_command(
                        "CId_GetTrackList",
                        json!({ "pagination_request": { "limit": 1024, "offset": 0 } }),
                    ),
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_PhysicalOut" }),
                    ),
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_Bus" }),
                    ),
                ],
            )?;
            let tracks = response_body(&responses, "GetTrackList")
                .and_then(|body| body.get("track_list"))
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let session_name = response_body(&responses, "GetSessionName")
                .and_then(|body| body.get("session_name"))
                .and_then(Value::as_str);
            let session_path = response_body(&responses, "GetSessionPath")
                .and_then(|body| body.pointer("/session_path/path"))
                .and_then(Value::as_str);
            let bit_depth = response_body(&responses, "GetSessionBitDepth")
                .and_then(|body| body.get("current_setting"))
                .and_then(Value::as_str);
            let bit_depth_number = bit_depth.and_then(bit_depth_number);
            let (sample_rate_number, sample_rate) = sample_rate_from(&responses)?;
            let detailed_commands: Vec<Value> = tracks.iter().flat_map(|track| {
                let id = track.get("id").and_then(Value::as_str).unwrap_or("");
                [
                    avid_command("CId_GetTrackPlaylists", json!({ "track_id": id, "pagination_request": { "limit": 256, "offset": 0 } })),
                    avid_command("CId_GetTrackMainOutputAssignments", json!({ "track_ids": [id] })),
                ]
            }).collect();
            let detailed = if detailed_commands.is_empty() {
                vec![]
            } else {
                run_avid_cli(executable, detailed_commands)?
            };
            let playlists: Vec<Value> = detailed
                .iter()
                .filter(|response| is_completed_response(response, "GetTrackPlaylists"))
                .enumerate()
                .map(|(index, response)| {
                    let track = tracks.get(index);
                    json!({
                        "trackId": track.and_then(|item| item.get("id")).and_then(Value::as_str),
                        "trackName": track.and_then(|item| item.get("name")).and_then(Value::as_str),
                        "playlists": response.pointer("/responseBodyJson/playlists")
                            .cloned().unwrap_or_else(|| json!([])),
                    })
                })
                .collect();
            let routing: Vec<Value> = detailed
                .iter()
                .filter(|response| {
                    is_completed_response(response, "GetTrackMainOutputAssignments")
                })
                .enumerate()
                .map(|(index, response)| {
                    let track = tracks.get(index);
                    json!({
                        "trackId": track.and_then(|item| item.get("id")).and_then(Value::as_str),
                        "trackName": track.and_then(|item| item.get("name")).and_then(Value::as_str),
                        "signalpathIds": response.pointer("/responseBodyJson/signalpath_ids")
                            .cloned().unwrap_or_else(|| json!([])),
                    })
                })
                .collect();
            Ok(json!({
                "execution": "ptsl", "sessionName": session_name, "sessionPath": session_path,
                "sampleRate": sample_rate_number, "sampleRateLabel": sample_rate,
                "bitDepth": bit_depth_number, "bitDepthLabel": bit_depth,
                "tracks": tracks, "playlists": playlists, "routing": routing,
                "bounceSources": mix_sources(&responses), "plugins": [],
                "pluginInventoryStatus": "not_exposed_by_ptsl_2026_4"
            }))
        }
        "recall_snapshot" => {
            let snapshot = payload
                .get("snapshot")
                .filter(|value| value.is_object())
                .ok_or("Session Snapshot mangler")?;
            let snapshot_tracks = snapshot
                .get("tracks")
                .and_then(Value::as_array)
                .filter(|tracks| !tracks.is_empty() && tracks.len() <= 1024)
                .ok_or("Snapshotet har ingen gyldige Pro Tools-spor")?;
            let dry_run = payload
                .get("dryRun")
                .and_then(Value::as_bool)
                .unwrap_or(true);
            let current = run_avid_cli(
                executable,
                vec![
                    avid_command("CId_GetSessionName", json!({})),
                    avid_command("CId_GetSessionPath", json!({})),
                    avid_command(
                        "CId_GetTrackList",
                        json!({ "pagination_request": { "limit": 1024, "offset": 0 } }),
                    ),
                ],
            )?;
            let current_name = response_body(&current, "GetSessionName")
                .and_then(|body| body.get("session_name"))
                .and_then(Value::as_str);
            let snapshot_name = snapshot
                .get("session_name")
                .or_else(|| snapshot.get("sessionName"))
                .and_then(Value::as_str);
            if let (Some(expected), Some(actual)) = (snapshot_name, current_name) {
                if !expected.trim().eq_ignore_ascii_case(actual.trim()) {
                    return Err(format!(
                        "Snapshotet tilhører «{}», men åpen sesjon er «{}»",
                        expected, actual
                    ));
                }
            }
            let current_path = response_body(&current, "GetSessionPath")
                .and_then(|body| body.get("session_path"))
                .and_then(|value| {
                    value
                        .as_str()
                        .or_else(|| value.get("path").and_then(Value::as_str))
                });
            let snapshot_path = snapshot
                .get("session_path")
                .or_else(|| snapshot.get("sessionPath"))
                .and_then(Value::as_str);
            if let (Some(expected), Some(actual)) = (snapshot_path, current_path) {
                if normalized_session_path(expected) != normalized_session_path(actual) {
                    return Err(
                        "Snapshotets sesjonssti samsvarer ikke med den åpne Pro Tools-sesjonen"
                            .into(),
                    );
                }
            }
            let current_tracks = response_body(&current, "GetTrackList")
                .and_then(|body| body.get("track_list"))
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let (operations, missing_tracks, matched_tracks) =
                recall_operations(snapshot_tracks, &current_tracks);
            if matched_tracks == 0 {
                return Err("Ingen snapshot-spor matcher den åpne Pro Tools-sesjonen".into());
            }
            let changes: Vec<Value> = operations
                .iter()
                .map(|operation| {
                    json!({
                        "field": operation.field,
                        "enabled": operation.enabled,
                        "trackCount": operation.track_ids.len(),
                        "trackNames": operation.track_names,
                    })
                })
                .collect();
            if dry_run || operations.is_empty() {
                return Ok(json!({
                    "execution": "ptsl", "dryRun": true, "applied": false,
                    "sessionName": current_name, "matchedTracks": matched_tracks,
                    "missingTracks": missing_tracks, "changes": changes,
                    "unsupportedFields": ["playlist target", "plugin parameters", "automation", "routing"]
                }));
            }
            let commands: Vec<Value> = operations
                .iter()
                .map(|operation| {
                    avid_command(
                        operation.command,
                        json!({ "track_ids": operation.track_ids, "enabled": operation.enabled }),
                    )
                })
                .collect();
            let expected = commands.len();
            let responses = run_avid_cli(executable, commands)?;
            let completed = responses
                .iter()
                .filter(|response| {
                    response.pointer("/header/status").and_then(Value::as_str) == Some("Completed")
                        && response
                            .pointer("/header/command")
                            .and_then(Value::as_str)
                            .is_some_and(|command| {
                                operations.iter().any(|operation| {
                                    command.trim_start_matches("CId_")
                                        == operation.command.trim_start_matches("CId_")
                                })
                            })
                })
                .count();
            if completed != expected {
                return Err(format!(
                    "Pro Tools bekreftet {} av {} recall-operasjoner",
                    completed, expected
                ));
            }
            Ok(json!({
                "execution": "ptsl", "dryRun": false, "applied": true,
                "sessionName": current_name, "matchedTracks": matched_tracks,
                "missingTracks": missing_tracks, "changes": changes,
                "unsupportedFields": ["playlist target", "plugin parameters", "automation", "routing"]
            }))
        }
        "make_intro_copy" => {
            let output_directory = payload
                .get("outputDirectory")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or("Choose a folder for the Intro-safe copy")?;
            std::fs::create_dir_all(output_directory)
                .map_err(|error| format!("Create Intro copy directory: {}", error))?;
            let requested_name = payload
                .get("sessionName")
                .and_then(Value::as_str)
                .unwrap_or("Intro Safe Copy");
            let session_name = safe_output_stem(requested_name);
            let mut session_location = output_directory.to_string();
            if !session_location.ends_with(std::path::MAIN_SEPARATOR) {
                session_location.push(std::path::MAIN_SEPARATOR);
            }
            let discovery = run_avid_cli(
                executable,
                vec![avid_command(
                    "CId_GetTrackList",
                    json!({ "pagination_request": { "limit": 1024, "offset": 0 } }),
                )],
            )?;
            let tracks = response_body(&discovery, "GetTrackList")
                .and_then(|body| body.get("track_list"))
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            let mut counts = std::collections::HashMap::<String, usize>::new();
            let mut excess_ids = Vec::<String>::new();
            for track in &tracks {
                let kind = track
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("TType_Unknown")
                    .to_string();
                let limit = match kind.as_str() {
                    "TType_Audio" | "TT_Audio" | "AudioTrack" => Some(8),
                    "TType_Instrument" | "TT_Instrument" | "Instrument" => Some(8),
                    "TType_Midi" | "TT_Midi" | "Midi" => Some(8),
                    "TType_Aux" | "TT_Aux" | "Aux" => Some(4),
                    _ => None,
                };
                if let Some(limit) = limit {
                    let count = counts.entry(kind).or_default();
                    *count += 1;
                    if *count > limit {
                        if let Some(id) = track.get("id").and_then(Value::as_str) {
                            excess_ids.push(id.to_string());
                        }
                    }
                }
            }
            let mut commands = vec![avid_command(
                "CId_SaveSessionAs",
                json!({
                    "session_name": session_name.clone(), "session_location": session_location
                }),
            )];
            if !excess_ids.is_empty() {
                commands.push(avid_command(
                    "CId_SetTrackInactiveState",
                    json!({ "track_ids": excess_ids.clone(), "enabled": true }),
                ));
            }
            let responses = run_avid_cli(executable, commands)?;
            completed_response(&responses, "SaveSessionAs")
                .ok_or("Pro Tools did not create the Intro-safe copy")?;
            if !excess_ids.is_empty() {
                completed_response(&responses, "SetTrackInactiveState").ok_or(
                    "Intro copy was created, but excess tracks could not be made inactive",
                )?;
            }
            Ok(
                json!({ "execution": "ptsl", "sessionName": session_name, "outputDirectory": output_directory,
                "deactivatedTrackIds": excess_ids, "originalPreserved": true }),
            )
        }
        "export_delivery" => {
            let output_directory = payload
                .get("outputDirectory")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or("Choose a delivery folder")?;
            let outputs = payload
                .get("outputs")
                .and_then(Value::as_array)
                .ok_or("Delivery outputs are missing")?;
            if outputs.is_empty() || outputs.len() > 32 {
                return Err("Choose between 1 and 32 delivery outputs".into());
            }
            std::fs::create_dir_all(output_directory)
                .map_err(|error| format!("Create delivery directory: {}", error))?;
            let discovery = run_avid_cli(
                executable,
                vec![
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_PhysicalOut" }),
                    ),
                    avid_command(
                        "CId_GetExportMixSourceList",
                        json!({ "type": "EMSType_Bus" }),
                    ),
                    avid_command("CId_GetSessionSampleRate", json!({})),
                ],
            )?;
            let sources = mix_sources(&discovery);
            let (_, sample_rate) = sample_rate_from(&discovery)?;
            let mut commands = Vec::new();
            let mut paths = Vec::new();
            for output in outputs {
                let file_name = output
                    .get("fileName")
                    .and_then(Value::as_str)
                    .ok_or("Delivery fileName is missing")?;
                let requested_source = output
                    .get("source")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                    .ok_or("Every delivery output must select an explicit Pro Tools source")?;
                let selected = sources
                    .iter()
                    .find(|entry| {
                        entry.get("name").and_then(Value::as_str) == Some(requested_source)
                    })
                    .ok_or_else(|| {
                        format!(
                            "Pro Tools export source '{}' was not found",
                            requested_source
                        )
                    })?;
                let source = selected
                    .get("name")
                    .and_then(Value::as_str)
                    .ok_or("Invalid export source")?;
                let source_type = selected
                    .get("sourceType")
                    .and_then(Value::as_str)
                    .unwrap_or("EMSType_PhysicalOut");
                commands.push(export_mix_command(
                    output_directory,
                    file_name,
                    source,
                    source_type,
                    &sample_rate,
                )?);
                paths.push(json!({ "kind": output.get("kind").cloned().unwrap_or_else(|| json!("custom")),
                    "source": source, "path": Path::new(output_directory).join(format!("{}.wav", safe_output_stem(file_name))) }));
            }
            let responses = run_avid_cli(executable, commands)?;
            let completed = responses
                .iter()
                .filter(|response| {
                    response.pointer("/header/status").and_then(Value::as_str) == Some("Completed")
                        && response
                            .pointer("/header/command")
                            .and_then(Value::as_str)
                            .is_some_and(|value| value.trim_start_matches("CId_") == "ExportMix")
                })
                .count();
            if completed != paths.len() {
                return Err(format!(
                    "Pro Tools completed {} of {} delivery exports",
                    completed,
                    paths.len()
                ));
            }
            Ok(json!({ "execution": "ptsl", "outputs": paths, "completed": completed }))
        }
        _ => Err("Unsupported PTSL command".into()),
    }
}

fn execute_creatorhub_bridge(
    helper: &Path,
    command_kind: &str,
    payload: Value,
) -> Result<Value, String> {
    let mut child = Command::new(helper)
        .arg("--command")
        .arg(command_kind)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| format!("Start PTSL bridge: {}", error))?;
    let body = serde_json::to_vec(&payload)
        .map_err(|error| format!("Serialize PTSL payload: {}", error))?;
    child
        .stdin
        .as_mut()
        .ok_or("PTSL bridge stdin unavailable")?
        .write_all(&body)
        .map_err(|error| format!("Write PTSL payload: {}", error))?;
    let output = child
        .wait_with_output()
        .map_err(|error| format!("Wait for PTSL bridge: {}", error))?;
    if !output.status.success() {
        let detail = String::from_utf8_lossy(&output.stderr)
            .trim()
            .chars()
            .take(800)
            .collect::<String>();
        return Err(format!(
            "PTSL bridge failed ({}): {}",
            output.status, detail
        ));
    }
    serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("Invalid PTSL bridge response: {}", error))
}

pub async fn execute(command_kind: &str, payload: Value) -> Result<Value, String> {
    let bridge = bridge().ok_or(
        "Avid PTSL SDK bridge is not installed. The command remains visible in Sound Room; install the licensed local bridge to execute direct Pro Tools actions."
    )?;
    let command_kind = command_kind.to_string();
    tokio::task::spawn_blocking(move || match bridge.kind {
        BridgeKind::CreatorHub => execute_creatorhub_bridge(&bridge.path, &command_kind, payload),
        BridgeKind::AvidCli => execute_avid_cli(&bridge.path, &command_kind, payload),
    })
    .await
    .map_err(|error| format!("PTSL task failed: {}", error))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn probe_never_claims_connected_without_both_local_components() {
        let status = probe();
        if status.state == "connected" {
            assert!(status.server_detected);
            assert!(status.helper_installed);
        }
    }

    #[test]
    fn parses_completed_json_frames_from_cli_noise() {
        let output = r#"noise
 JSON result:
---
{"header":{"command":"GetSessionSampleRate","status":"Completed"},"responseBodyJson":{"sample_rate":"SRate_48000"},"responseErrorJson":{}}
---"#;
        let frames = json_results(output);
        assert_eq!(frames.len(), 1);
        assert_eq!(sample_rate_from(&frames).unwrap().0, 48_000);
    }

    #[test]
    fn failed_frames_surface_the_server_message() {
        let response = json!({
            "responseErrorJson": { "errors": [{ "command_error_message": "bad request" }] }
        });
        assert_eq!(response_errors(&response), vec!["bad request"]);
    }

    #[test]
    fn completed_response_ignores_queued_and_in_progress_frames() {
        let responses = [
            json!({ "header": { "command": "CId_GetTrackPlaylists", "status": "Queued" } }),
            json!({ "header": { "command": "CId_GetTrackPlaylists", "status": "InProgress" } }),
            json!({
                "header": { "command": "CId_GetTrackPlaylists", "status": "Completed" },
                "responseBodyJson": { "playlists": [{ "playlist_name": "Lead Vocal" }] }
            }),
        ];
        let completed: Vec<&Value> = responses
            .iter()
            .filter(|response| is_completed_response(response, "GetTrackPlaylists"))
            .collect();
        assert_eq!(completed.len(), 1);
        assert_eq!(
            completed[0].pointer("/responseBodyJson/playlists/0/playlist_name"),
            Some(&json!("Lead Vocal"))
        );
    }

    #[test]
    fn completed_import_warnings_remain_visible_to_the_caller() {
        let responses = [json!({
            "header": { "command": "Import", "status": "Completed" },
            "responseBodyJson": {},
            "responseErrorJson": {
                "errors": [{
                    "command_error_message": "maximum number of audio tracks reached",
                    "is_warning": true
                }]
            }
        })];
        assert_eq!(
            completed_response_without_errors(&responses, "Import").unwrap_err(),
            "maximum number of audio tracks reached"
        );
    }

    #[test]
    fn marker_numbers_stay_in_the_supported_integer_range() {
        let number = marker_number();
        assert!((1_000..=2_000_001_000).contains(&number));
    }

    #[test]
    fn parses_integer_and_float_session_bit_depth_labels() {
        assert_eq!(bit_depth_number("BDepth_24"), Some(24));
        assert_eq!(bit_depth_number("BDepth_32Float"), Some(32));
        assert_eq!(bit_depth_number("unknown"), None);
    }

    #[test]
    fn recall_plan_only_changes_supported_differences() {
        let snapshot_tracks = vec![
            json!({
                "id": "track-1", "name": "Lead Vocal", "type": "TType_Audio",
                "track_attributes": {
                    "is_muted": true, "is_soloed": false, "is_inactive": "TAState_SetExplicitly",
                    "is_hidden": "TAState_None", "is_open": false
                }
            }),
            json!({
                "id": "video-1", "name": "Video", "type": "TType_Video",
                "track_attributes": {
                    "is_muted": true, "is_soloed": true, "is_inactive": "TAState_SetExplicitly",
                    "is_hidden": "TAState_SetExplicitly", "is_open": false
                }
            }),
        ];
        let current_tracks = vec![
            json!({
                "id": "track-1", "name": "Lead Vocal", "type": "TType_Audio",
                "track_attributes": {
                    "is_muted": false, "is_soloed": false, "is_inactive": "TAState_None",
                    "is_hidden": "TAState_None", "is_open": false
                }
            }),
            json!({
                "id": "video-1", "name": "Video", "type": "TType_Video",
                "track_attributes": {
                    "is_muted": false, "is_soloed": false, "is_inactive": "TAState_None",
                    "is_hidden": "TAState_None", "is_open": false
                }
            }),
        ];
        let (operations, missing, matched) = recall_operations(&snapshot_tracks, &current_tracks);
        assert_eq!(matched, 2);
        assert!(missing.is_empty());
        assert!(operations.iter().any(|operation| {
            operation.command == "CId_SetTrackMuteState"
                && operation.enabled
                && operation.track_ids == ["track-1"]
        }));
        assert!(operations.iter().any(|operation| {
            operation.command == "CId_SetTrackInactiveState"
                && operation.enabled
                && operation.track_ids == ["track-1"]
        }));
        assert!(operations.iter().any(|operation| {
            operation.command == "CId_SetTrackHiddenState"
                && operation.enabled
                && operation.track_ids == ["video-1"]
        }));
        assert!(!operations.iter().any(|operation| {
            (operation.command == "CId_SetTrackMuteState"
                || operation.command == "CId_SetTrackSoloState"
                || operation.command == "CId_SetTrackInactiveState")
                && operation.track_ids == ["video-1"]
        }));
    }

    #[test]
    fn recall_plan_falls_back_to_unique_track_name() {
        let snapshot_tracks = vec![json!({
            "id": "old-id", "name": "Bass", "type": "TType_Audio",
            "track_attributes": { "is_muted": true }
        })];
        let current_tracks = vec![json!({
            "id": "new-id", "name": "Bass", "type": "TType_Audio",
            "track_attributes": { "is_muted": false }
        })];
        let (operations, missing, matched) = recall_operations(&snapshot_tracks, &current_tracks);
        assert_eq!(matched, 1);
        assert!(missing.is_empty());
        assert_eq!(operations[0].track_ids, ["new-id"]);
    }

    #[test]
    #[ignore = "requires an open Pro Tools session and a locally licensed Avid CLI"]
    fn live_bridge_runs_the_full_command_set() {
        let bridge = bridge().expect("local PTSL bridge");
        assert_eq!(bridge.kind, BridgeKind::AvidCli);
        execute_avid_cli(&bridge.path, "locate", json!({ "seconds": 1.75 })).unwrap();
        let marker = execute_avid_cli(
            &bridge.path,
            "create_marker",
            json!({ "seconds": 2.5, "name": "CreatorHub adapter E2E" }),
        )
        .unwrap();
        assert_eq!(
            marker.get("execution").and_then(Value::as_str),
            Some("ptsl")
        );
        let sources = execute_avid_cli(&bridge.path, "list_export_sources", json!({})).unwrap();
        let source_name = sources
            .get("sources")
            .and_then(Value::as_array)
            .and_then(|items| items.first())
            .and_then(|item| item.get("name"))
            .and_then(Value::as_str)
            .expect("at least one Pro Tools export source")
            .to_string();
        let snapshot = execute_avid_cli(&bridge.path, "session_snapshot", json!({})).unwrap();
        assert!(snapshot
            .get("sessionName")
            .and_then(Value::as_str)
            .is_some_and(|name| !name.trim().is_empty()));
        let live_tracks = snapshot
            .get("tracks")
            .and_then(Value::as_array)
            .expect("snapshot tracks");
        assert_eq!(
            snapshot
                .get("playlists")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(live_tracks.len())
        );
        assert_eq!(
            snapshot
                .get("routing")
                .and_then(Value::as_array)
                .map(Vec::len),
            Some(live_tracks.len())
        );
        assert!(snapshot.get("bitDepth").and_then(Value::as_u64).is_some());
        if let Some((track_id, was_muted)) = snapshot
            .get("tracks")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .find_map(|track| {
                let track_type = track.get("type")?.as_str()?;
                if track_type.contains("Video") || track_type.contains("Master") {
                    return None;
                }
                Some((
                    track.get("id")?.as_str()?.to_string(),
                    track.pointer("/track_attributes/is_muted")?.as_bool()?,
                ))
            })
        {
            run_avid_cli(
                &bridge.path,
                vec![avid_command(
                    "CId_SetTrackMuteState",
                    json!({ "track_ids": [track_id.clone()], "enabled": !was_muted }),
                )],
            )
            .unwrap();
            let recall = execute_avid_cli(
                &bridge.path,
                "recall_snapshot",
                json!({ "snapshot": snapshot.clone(), "dryRun": false }),
            );
            let emergency_restore = run_avid_cli(
                &bridge.path,
                vec![avid_command(
                    "CId_SetTrackMuteState",
                    json!({ "track_ids": [track_id], "enabled": was_muted }),
                )],
            );
            emergency_restore.expect("restore live-test mute state");
            assert_eq!(
                recall
                    .expect("recall the captured live snapshot")
                    .get("applied")
                    .and_then(Value::as_bool),
                Some(true)
            );
        }

        if let Ok(audio_path) = std::env::var("CREATORHUB_PTSL_LIVE_AUDIO") {
            execute_avid_cli(
                &bridge.path,
                "import_audio",
                json!({ "localPath": audio_path }),
            )
            .unwrap();
        }
        if let Ok(output_directory) = std::env::var("CREATORHUB_PTSL_LIVE_BOUNCE_DIR") {
            let exported = execute_avid_cli(
                &bridge.path,
                "export_review",
                json!({
                    "fileName": format!("CreatorHub-adapter-e2e-{}-{}.wav", std::process::id(), marker_number()),
                    "outputDirectory": output_directory
                }),
            )
            .unwrap();
            let path = exported.get("outputPath").and_then(Value::as_str).unwrap();
            assert!(Path::new(path).is_file(), "expected exported mix at {path}");
            let bytes = std::fs::read(path).unwrap();
            let metadata = crate::processing::wav_metadata(&bytes)
                .expect("expected ExportMix to create a readable WAV");
            assert_eq!(metadata.bit_depth, 24);

            let delivery = execute_avid_cli(
                &bridge.path,
                "export_delivery",
                json!({
                    "outputDirectory": output_directory,
                    "outputs": [{
                        "kind": "master",
                        "fileName": format!("CreatorHub-delivery-e2e-{}-{}.wav", std::process::id(), marker_number()),
                        "source": source_name
                    }]
                }),
            )
            .unwrap();
            let delivery_path = delivery
                .pointer("/outputs/0/path")
                .and_then(Value::as_str)
                .expect("delivery output path");
            let delivery_bytes = std::fs::read(delivery_path).unwrap();
            assert!(crate::processing::analyze_wav(&delivery_bytes).analyzable);
        }
        if let Ok(output_directory) = std::env::var("CREATORHUB_PTSL_LIVE_INTRO_COPY_DIR") {
            let intro_copy = execute_avid_cli(
                &bridge.path,
                "make_intro_copy",
                json!({
                    "outputDirectory": output_directory,
                    "sessionName": format!("CreatorHub Intro Safe E2E {}", marker_number())
                }),
            )
            .unwrap();
            assert_eq!(
                intro_copy.get("originalPreserved").and_then(Value::as_bool),
                Some(true)
            );
        }
    }
}
