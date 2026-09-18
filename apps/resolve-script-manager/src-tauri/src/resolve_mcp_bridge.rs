//! Local, authenticated bridge used by the Post Agent Resolve MCP extension.
//!
//! The bridge is deliberately smaller than the Tauri command surface. External
//! AI clients may inspect Resolve, run the four allowlisted read-only analyses,
//! and create a semantic approval plan. Applying or rolling back a plan is not
//! available here: those actions remain inside the visible Post Agent UI.

use std::path::PathBuf;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufRead, AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::Semaphore;
use uuid::Uuid;

use crate::{resolve_mcp, resolve_mcp_gateway};

const MAX_REQUEST_BYTES: usize = 64 * 1024;
const MAX_CONNECTIONS: usize = 8;
const DESCRIPTOR_FILE: &str = "post-agent-resolve-mcp-bridge.json";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeDescriptor<'a> {
    schema_version: u8,
    host: &'a str,
    port: u16,
    token: &'a str,
    pid: u32,
    generated_at: String,
    capabilities: [&'a str; 7],
}

#[derive(Debug, Deserialize)]
struct BridgeRequest {
    id: Value,
    token: String,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct BridgeResponse {
    id: Value,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

fn descriptor_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(DESCRIPTOR_FILE))
        .map_err(|error| format!("Fant ikke Post Agent app-data: {error}"))
}

fn write_descriptor(app: &AppHandle, port: u16, token: &str) -> Result<PathBuf, String> {
    let path = descriptor_path(app)?;
    let parent = path.parent().ok_or("Bridge-filen mangler foreldremappe")?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("Kunne ikke opprette bridge-mappe: {error}"))?;
    let descriptor = BridgeDescriptor {
        schema_version: 1,
        host: "127.0.0.1",
        port,
        token,
        pid: std::process::id(),
        generated_at: chrono::Utc::now().to_rfc3339(),
        capabilities: [
            "status",
            "list_skills",
            "run_analysis",
            "create_plan",
            "get_plan",
            "latest_plan",
            "get_intelligence",
        ],
    };
    let bytes = serde_json::to_vec_pretty(&descriptor)
        .map_err(|error| format!("Kunne ikke serialisere bridge-info: {error}"))?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, bytes)
        .map_err(|error| format!("Kunne ikke skrive bridge-info: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&temporary, std::fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Kunne ikke beskytte bridge-info: {error}"))?;
    }
    std::fs::rename(&temporary, &path)
        .map_err(|error| format!("Kunne ikke aktivere bridge-info: {error}"))?;
    Ok(path)
}

fn response_ok(id: Value, result: impl Serialize) -> BridgeResponse {
    BridgeResponse {
        id,
        ok: true,
        result: Some(serde_json::to_value(result).unwrap_or(Value::Null)),
        error: None,
    }
}

fn response_error(id: Value, error: impl Into<String>) -> BridgeResponse {
    BridgeResponse {
        id,
        ok: false,
        result: None,
        error: Some(error.into()),
    }
}

async fn dispatch(app: &AppHandle, request: BridgeRequest) -> BridgeResponse {
    let id = request.id;
    let outcome: Result<Value, String> = match request.method.as_str() {
        "status" => Ok(json!(resolve_mcp::status().await)),
        "list_skills" => Ok(json!(resolve_mcp::skills())),
        "run_analysis" => {
            let skill_id = request
                .params
                .get("skillId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let definition = resolve_mcp::skills()
                .into_iter()
                .find(|skill| skill.id == skill_id);
            match definition {
                Some(skill) if skill.status == "available" && skill.read_only => {
                    resolve_mcp::run_skill(skill_id.to_string()).await
                }
                Some(_) => Err("Bare allowlistede read-only-skills kan kjøres via AI-broen".into()),
                None => Err(format!("Ukjent Resolve-skill: {skill_id}")),
            }
        }
        "create_plan" => {
            let skill_id = request
                .params
                .get("skillId")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let input = request
                .params
                .get("input")
                .cloned()
                .unwrap_or_else(|| json!({}));
            let state = app.state::<resolve_mcp_gateway::ResolveMcpGatewayState>();
            match resolve_mcp_gateway::create_plan(&state, skill_id, input).await {
                Ok(plan) => {
                    let _ = app.emit("resolve-mcp://plan-created", &plan);
                    Ok(json!(plan))
                }
                Err(error) => Err(error),
            }
        }
        "get_plan" => {
            let plan_id = request
                .params
                .get("planId")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let state = app.state::<resolve_mcp_gateway::ResolveMcpGatewayState>();
            resolve_mcp_gateway::get_plan(&state, plan_id).map(|plan| json!(plan))
        }
        "latest_plan" => {
            let state = app.state::<resolve_mcp_gateway::ResolveMcpGatewayState>();
            Ok(json!(resolve_mcp_gateway::latest_plan(&state)))
        }
        "get_intelligence" => resolve_mcp_gateway::intelligence()
            .await
            .map(|context| json!(context)),
        "apply_plan" | "rollback_plan" => Err(
            "AI-broen kan ikke skrive til Resolve. Godkjenn eller rull tilbake planen i Post Agent."
                .into(),
        ),
        other => Err(format!("Ukjent Post Agent bridge-metode: {other}")),
    };
    match outcome {
        Ok(result) => response_ok(id, result),
        Err(error) => response_error(id, error),
    }
}

async fn read_bounded_line<R: AsyncBufRead + Unpin>(
    reader: &mut R,
) -> std::io::Result<Option<Result<String, String>>> {
    let mut bytes = Vec::with_capacity(4096);
    let mut overflow = false;
    let mut saw_data = false;
    loop {
        let available = reader.fill_buf().await?;
        if available.is_empty() {
            if !saw_data {
                return Ok(None);
            }
            break;
        }
        saw_data = true;
        let newline = available.iter().position(|byte| *byte == b'\n');
        let consumed = newline.map_or(available.len(), |index| index + 1);
        let content_len = newline.unwrap_or(consumed);
        if !overflow {
            if bytes.len() + content_len > MAX_REQUEST_BYTES {
                overflow = true;
            } else {
                bytes.extend_from_slice(&available[..content_len]);
            }
        }
        reader.consume(consumed);
        if newline.is_some() {
            break;
        }
    }
    if overflow {
        return Ok(Some(Err("Bridge-kallet er større enn 64 KiB".into())));
    }
    Ok(Some(
        String::from_utf8(bytes).map_err(|_| "Bridge-kallet er ikke gyldig UTF-8".into()),
    ))
}

async fn handle_connection(app: AppHandle, stream: TcpStream, expected_token: String) {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    while let Ok(Some(line)) = read_bounded_line(&mut reader).await {
        let response = match line {
            Ok(line) => match serde_json::from_str::<BridgeRequest>(&line) {
                Ok(request) if request.token == expected_token => dispatch(&app, request).await,
                Ok(request) => response_error(request.id, "Ugyldig bridge-token"),
                Err(error) => response_error(Value::Null, format!("Ugyldig bridge-kall: {error}")),
            },
            Err(error) => response_error(Value::Null, error),
        };
        let mut encoded = match serde_json::to_vec(&response) {
            Ok(value) => value,
            Err(_) => break,
        };
        encoded.push(b'\n');
        if writer.write_all(&encoded).await.is_err() {
            break;
        }
    }
}

/// Starts an authenticated loopback server on an OS-selected port.
pub fn spawn_server(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind("127.0.0.1:0").await {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("[resolve-mcp-bridge] kunne ikke starte: {error}");
                return;
            }
        };
        let port = match listener.local_addr() {
            Ok(address) => address.port(),
            Err(error) => {
                eprintln!("[resolve-mcp-bridge] fant ikke lokal port: {error}");
                return;
            }
        };
        let token = Uuid::new_v4().to_string();
        let permits = Arc::new(Semaphore::new(MAX_CONNECTIONS));
        match write_descriptor(&app, port, &token) {
            Ok(path) => eprintln!(
                "[resolve-mcp-bridge] lytter på 127.0.0.1:{port}; descriptor={}",
                path.display()
            ),
            Err(error) => {
                eprintln!("[resolve-mcp-bridge] {error}");
                return;
            }
        }
        while let Ok((stream, peer)) = listener.accept().await {
            if !peer.ip().is_loopback() {
                continue;
            }
            let Ok(permit) = Arc::clone(&permits).try_acquire_owned() else {
                continue;
            };
            let app = app.clone();
            let token = token.clone();
            tokio::spawn(async move {
                let _permit = permit;
                handle_connection(app, stream, token).await;
            });
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn bounded_reader_accepts_a_normal_request() {
        let (mut sender, receiver) = tokio::io::duplex(1024);
        tokio::spawn(async move {
            sender
                .write_all(b"{\"method\":\"status\"}\n")
                .await
                .unwrap();
        });
        let mut reader = BufReader::new(receiver);
        let line = read_bounded_line(&mut reader)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(line, "{\"method\":\"status\"}");
    }

    #[tokio::test]
    async fn bounded_reader_rejects_and_drains_an_oversized_request() {
        let (mut sender, receiver) = tokio::io::duplex(2048);
        tokio::spawn(async move {
            let oversized = vec![b'x'; MAX_REQUEST_BYTES + 1];
            sender.write_all(&oversized).await.unwrap();
            sender.write_all(b"\nnext\n").await.unwrap();
        });
        let mut reader = BufReader::new(receiver);
        let first = read_bounded_line(&mut reader).await.unwrap().unwrap();
        assert!(first.is_err());
        let second = read_bounded_line(&mut reader)
            .await
            .unwrap()
            .unwrap()
            .unwrap();
        assert_eq!(second, "next");
    }
}
