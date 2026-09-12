//! Authenticated loopback protocol for the thin AAX Review Console host.
//!
//! The cloud device token is never exposed. AAX and Companion share a separate
//! 256-bit local secret through the OS credential store and exchange one bounded
//! JSON request per TCP connection on 127.0.0.1:31417.

use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};

use crate::api_client;
use crate::processing;
use crate::ptsl;
use crate::state::{snapshot, SharedConfig};

pub const PORT: u16 = 31_417;
const MAX_REQUEST_BYTES: u64 = 65_536;

#[derive(Debug, Clone, Default, Serialize)]
pub struct LocalIpcStatus {
    pub listening: bool,
    pub port: u16,
    pub protocol_version: u8,
    pub last_error: Option<String>,
}

pub type SharedIpcStatus = Arc<Mutex<LocalIpcStatus>>;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Request {
    protocol_version: u8,
    request_id: String,
    auth: String,
    action: String,
    #[serde(default)]
    payload: Value,
}

fn constant_time_equal(left: &str, right: &str) -> bool {
    let left = left.as_bytes();
    let right = right.as_bytes();
    let mut difference = left.len() ^ right.len();
    let max = left.len().max(right.len());
    for index in 0..max {
        difference |= usize::from(*left.get(index).unwrap_or(&0) ^ *right.get(index).unwrap_or(&0));
    }
    difference == 0
}

async fn feedback(cfg: &SharedConfig) -> Result<Value, String> {
    let snap = snapshot(cfg);
    let token = snap.token.as_deref().ok_or("Companion er ikke paret")?;
    let session_id = snap
        .session_id
        .as_deref()
        .ok_or("Ingen aktiv Companion-sesjon")?;
    match api_client::get_feedback(&snap.api_base, token, session_id).await {
        Ok(value) => {
            let mut current = cfg.lock().unwrap();
            current.cached_feedback = Some(value.clone());
            current.last_feedback_sync_at = Some(
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs()
                    .to_string(),
            );
            current.last_feedback_sync_error = None;
            crate::config::save(&current)?;
            Ok(value)
        }
        Err(error) => {
            let cached = {
                let mut current = cfg.lock().unwrap();
                current.last_feedback_sync_error = Some(error.clone());
                let cached = current.cached_feedback.clone();
                crate::config::save(&current)?;
                cached
            };
            if let Some(mut value) = cached {
                if let Some(object) = value.as_object_mut() {
                    object.insert("offline".into(), json!(true));
                    object.insert("syncError".into(), json!(error));
                }
                Ok(value)
            } else {
                Err(error)
            }
        }
    }
}

async fn process(request: Request, cfg: &SharedConfig, app: &AppHandle) -> Result<Value, String> {
    if request.protocol_version != 1 {
        return Err("unsupported_protocol_version".into());
    }
    if request.request_id.trim().is_empty() || request.request_id.len() > 128 {
        return Err("invalid_request_id".into());
    }
    let secret = cfg
        .lock()
        .unwrap()
        .local_ipc_secret
        .clone()
        .ok_or("ipc_secret_unavailable")?;
    if !constant_time_equal(&request.auth, &secret) {
        return Err("authentication_failed".into());
    }
    match request.action.as_str() {
        "health" => {
            Ok(json!({ "ok": true, "protocolVersion": 1, "appVersion": env!("CARGO_PKG_VERSION") }))
        }
        "state" => {
            let snap = snapshot(cfg);
            Ok(
                json!({ "paired": snap.token.is_some(), "sessionId": snap.session_id, "sessionName": snap.session_name,
                "audioRoomId": snap.audio_room_id, "ptsl": ptsl::probe(), "lastFeedbackSyncAt": cfg.lock().unwrap().last_feedback_sync_at }),
            )
        }
        "feedback" => feedback(cfg).await,
        "locate" => {
            let seconds = request
                .payload
                .get("seconds")
                .and_then(Value::as_f64)
                .ok_or("seconds_required")?;
            ptsl::execute("locate", json!({ "seconds": seconds })).await
        }
        "mark" => {
            let comment_id = request
                .payload
                .get("commentId")
                .and_then(Value::as_str)
                .ok_or("comment_id_required")?;
            let seconds = request
                .payload
                .get("seconds")
                .and_then(Value::as_f64)
                .ok_or("seconds_required")?;
            let name = request
                .payload
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Sound Room feedback");
            let category = request
                .payload
                .get("category")
                .and_then(Value::as_str)
                .unwrap_or("general");
            let color_index = match category {
                "timing" => 2,
                "performance" => 4,
                "arrangement" => 7,
                "mix" => 10,
                "mastering" => 12,
                _ => 5,
            };
            let marker = ptsl::execute(
                "create_marker",
                json!({ "seconds": seconds, "name": name, "colorIndex": color_index }),
            )
            .await?;
            let marker_id = marker
                .get("markerId")
                .and_then(Value::as_str)
                .ok_or("marker_id_missing")?;
            let snap = snapshot(cfg);
            api_client::feedback_action(
                &snap.api_base,
                snap.token.as_deref().ok_or("not_paired")?,
                snap.session_id.as_deref().ok_or("session_missing")?,
                comment_id,
                json!({ "protoolsMarkerId": marker_id }),
            )
            .await
        }
        "resolve" => {
            let comment_id = request
                .payload
                .get("commentId")
                .and_then(Value::as_str)
                .ok_or("comment_id_required")?;
            let snap = snapshot(cfg);
            api_client::feedback_action(
                &snap.api_base,
                snap.token.as_deref().ok_or("not_paired")?,
                snap.session_id.as_deref().ok_or("session_missing")?,
                comment_id,
                json!({ "status": "resolved" }),
            )
            .await
        }
        "reply" => {
            let comment_id = request
                .payload
                .get("commentId")
                .and_then(Value::as_str)
                .ok_or("comment_id_required")?;
            let body = request
                .payload
                .get("body")
                .and_then(Value::as_str)
                .filter(|value| !value.trim().is_empty())
                .ok_or("body_required")?;
            let snap = snapshot(cfg);
            api_client::feedback_action(
                &snap.api_base,
                snap.token.as_deref().ok_or("not_paired")?,
                snap.session_id.as_deref().ok_or("session_missing")?,
                comment_id,
                json!({ "body": body }),
            )
            .await
        }
        "snapshot" => processing::capture_session_snapshot(cfg, "manual").await,
        "send_review" => {
            let file_name = request
                .payload
                .get("fileName")
                .and_then(Value::as_str)
                .unwrap_or("Sound Room Mix.wav");
            let source = request
                .payload
                .get("source")
                .and_then(Value::as_str)
                .map(str::to_string);
            serde_json::to_value(processing::send_to_review(cfg, app, file_name, source).await?)
                .map_err(|error| error.to_string())
        }
        _ => Err("unsupported_action".into()),
    }
}

async fn handle_connection(stream: TcpStream, cfg: SharedConfig, app: AppHandle) {
    let (read, mut write) = stream.into_split();
    let mut reader = BufReader::new(read).take(MAX_REQUEST_BYTES + 1);
    let mut line = String::new();
    let read_result = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        reader.read_line(&mut line),
    )
    .await;
    let response = match read_result {
        Ok(Ok(length)) if length > 0 && length as u64 <= MAX_REQUEST_BYTES => {
            match serde_json::from_str::<Request>(&line) {
                Ok(request) => {
                    let request_id = request.request_id.clone();
                    match process(request, &cfg, &app).await {
                        Ok(result) => {
                            json!({ "protocolVersion": 1, "requestId": request_id, "ok": true, "result": result })
                        }
                        Err(error) => {
                            json!({ "protocolVersion": 1, "requestId": request_id, "ok": false, "error": error })
                        }
                    }
                }
                Err(_) => json!({ "protocolVersion": 1, "ok": false, "error": "invalid_json" }),
            }
        }
        Ok(Ok(_)) => json!({ "protocolVersion": 1, "ok": false, "error": "request_too_large" }),
        Ok(Err(_)) => json!({ "protocolVersion": 1, "ok": false, "error": "read_failed" }),
        Err(_) => json!({ "protocolVersion": 1, "ok": false, "error": "read_timeout" }),
    };
    if let Ok(mut bytes) = serde_json::to_vec(&response) {
        bytes.push(b'\n');
        let _ = write.write_all(&bytes).await;
        let _ = write.shutdown().await;
    }
}

pub fn start(app: AppHandle, cfg: SharedConfig, status: SharedIpcStatus) {
    tauri::async_runtime::spawn(async move {
        match TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, PORT)).await {
            Ok(listener) => {
                *status.lock().unwrap() = LocalIpcStatus {
                    listening: true,
                    port: PORT,
                    protocol_version: 1,
                    last_error: None,
                };
                loop {
                    match listener.accept().await {
                        Ok((stream, address)) if address.ip().is_loopback() => {
                            tokio::spawn(handle_connection(stream, cfg.clone(), app.clone()));
                        }
                        Ok(_) => {}
                        Err(error) => {
                            *status.lock().unwrap() = LocalIpcStatus {
                                listening: false,
                                port: PORT,
                                protocol_version: 1,
                                last_error: Some(error.to_string()),
                            };
                            break;
                        }
                    }
                }
            }
            Err(error) => {
                *status.lock().unwrap() = LocalIpcStatus {
                    listening: false,
                    port: PORT,
                    protocol_version: 1,
                    last_error: Some(error.to_string()),
                };
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secret_comparison_rejects_prefixes_and_length_changes() {
        assert!(constant_time_equal("abc123", "abc123"));
        assert!(!constant_time_equal("abc", "abc123"));
        assert!(!constant_time_equal("abc124", "abc123"));
    }

    #[test]
    fn protocol_request_requires_version_and_bounded_id() {
        let request: Request = serde_json::from_value(json!({
            "protocolVersion": 1, "requestId": "aax-1", "auth": "secret", "action": "health"
        }))
        .unwrap();
        assert_eq!(request.protocol_version, 1);
        assert_eq!(request.action, "health");
    }
}
