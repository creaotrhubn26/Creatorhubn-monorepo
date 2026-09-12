//! Adapter for Avid's locally installed PTSL command client.
//!
//! The SDK and generated Avid client remain outside this repository under the
//! SDK license. Companion can use either CreatorHub's licensed stdin/stdout
//! bridge or Avid's locally built `ptslcmd`; Session Info and bounce watchers
//! remain available when neither local bridge is present.

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
    responses.iter().rev().find(|response| {
        response.pointer("/header/status").and_then(Value::as_str) == Some("Completed")
            && response
                .pointer("/header/command")
                .and_then(Value::as_str)
                .map(|value| value == command || value.trim_start_matches("CId_") == command)
                .unwrap_or(false)
    })
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
                        "color_index": 5,
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
            completed_response(&responses, "Import")
                .ok_or("Pro Tools did not confirm the audio import")?;
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
                    avid_command("GetSessionSampleRate", json!({})),
                ],
            )?;
            let source = completed_response(&discovery, "GetExportMixSourceList")
                .and_then(|value| value.pointer("/responseBodyJson/source_list"))
                .and_then(Value::as_array)
                .and_then(|items| items.first())
                .and_then(Value::as_str)
                .ok_or("Pro Tools has no physical mix output available")?;
            let (_, sample_rate) = sample_rate_from(&discovery)?;
            let requested_name = payload
                .get("fileName")
                .and_then(Value::as_str)
                .unwrap_or("Sound Room Mix.wav");
            let file_stem = requested_name
                .strip_suffix(".wav")
                .or_else(|| requested_name.strip_suffix(".WAV"))
                .unwrap_or(requested_name);
            let mut directory = output_directory.to_string();
            if !directory.ends_with(std::path::MAIN_SEPARATOR) {
                directory.push(std::path::MAIN_SEPARATOR);
            }
            let responses = run_avid_cli(
                executable,
                vec![avid_command(
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
                        "mix_source_list": [{ "source_type": "EMSType_PhysicalOut", "name": source }],
                        "audio_encoding_options": {}
                    }),
                )],
            )?;
            completed_response(&responses, "ExportMix")
                .ok_or("Pro Tools did not confirm the mix export")?;
            let output_path = Path::new(output_directory).join(format!("{}.wav", file_stem));
            Ok(json!({ "execution": "ptsl", "outputPath": output_path, "exported": true }))
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
    fn marker_numbers_stay_in_the_supported_integer_range() {
        let number = marker_number();
        assert!((1_000..=2_000_001_000).contains(&number));
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
        }
    }
}
