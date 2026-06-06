//! WebSocket-bro mellom Tauri-appen og en UXP-plugin i Photoshop.
//!
//! Designet:
//! - Tauri-appen åpner en lokal WS-server på `127.0.0.1:1733`.
//! - UXP-pluginen ("Post Agent Bridge") kobler seg til som klient og
//!   auto-reconnecter ved frafall. Bare én aktiv klient om gangen —
//!   en ny tilkobling overskriver den forrige.
//! - Tauri-frontend kaller `photoshop_send_command` for å sende
//!   request → får response korrelert via `request_id`.
//! - Plugin kan også pushe `event`-meldinger (active doc changed,
//!   layer modified, etc.) som vi videresender som `photoshop://event`
//!   til Tauri-frontend via `app.emit`.
//!
//! Protokoll (JSON over WS-text-frames):
//!
//! Tauri → Plugin:
//!   { "type": "request", "request_id": "<uuid>", "command": "<name>", "params": <any> }
//!
//! Plugin → Tauri:
//!   { "type": "response", "request_id": "<uuid>", "ok": true,  "result": <any> }
//!   { "type": "response", "request_id": "<uuid>", "ok": false, "error":  "<msg>" }
//!   { "type": "event",    "event":      "<name>", "data":   <any> }
//!   { "type": "hello",    "plugin_version": "...", "photoshop_version": "..." }

use std::sync::Arc;
use std::time::Duration;

use dashmap::DashMap;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio::net::TcpListener;
use tokio::sync::{oneshot, Mutex};
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::Message;
use uuid::Uuid;

const BRIDGE_PORT: u16 = 1733;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(30);

/// En aktiv plugin-tilkobling. Holder en mpsc-sender slik at
/// `send_command` kan pushe ut-meldinger uten å eie selve socketen.
struct ActiveConnection {
    sender: tokio::sync::mpsc::UnboundedSender<Message>,
    plugin_version: Option<String>,
    photoshop_version: Option<String>,
}

#[derive(Default)]
pub struct PhotoshopBridgeState {
    active: Mutex<Option<ActiveConnection>>,
    pending: Arc<DashMap<String, oneshot::Sender<Result<Value, String>>>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BridgeStatus {
    pub connected: bool,
    pub plugin_version: Option<String>,
    pub photoshop_version: Option<String>,
    pub port: u16,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
enum IncomingMessage {
    Hello {
        #[serde(default)]
        plugin_version: Option<String>,
        #[serde(default)]
        photoshop_version: Option<String>,
    },
    Response {
        request_id: String,
        #[serde(default)]
        ok: bool,
        #[serde(default)]
        result: Option<Value>,
        #[serde(default)]
        error: Option<String>,
    },
    Event {
        event: String,
        #[serde(default)]
        data: Value,
    },
}

#[derive(Debug, Serialize)]
struct OutgoingRequest<'a> {
    #[serde(rename = "type")]
    kind: &'static str,
    request_id: &'a str,
    command: &'a str,
    params: &'a Value,
}

/// Start WS-serveren i bakgrunnen. Idempotent: kaller du to ganger
/// vil andre kallet feile (port i bruk) — det er greit, vi logger
/// og lar den første serveren leve videre.
///
/// NB: `tauri::async_runtime::spawn` (ikke `tokio::spawn`) — Tauri's
/// setup-callback kjøres på main-tråden FØR tokio-runtimen er aktiv,
/// så `tokio::spawn` panicker med "no reactor running". Tauri's
/// async_runtime wrapper rundt tokio er klar her, og når vi er inne
/// i den kan vi bruke `tokio::spawn` for nested tasks som vanlig.
pub fn spawn_server(app: AppHandle, state: Arc<PhotoshopBridgeState>) {
    tauri::async_runtime::spawn(async move {
        let addr = format!("127.0.0.1:{}", BRIDGE_PORT);
        let listener = match TcpListener::bind(&addr).await {
            Ok(l) => l,
            Err(err) => {
                eprintln!(
                    "[photoshop-bridge] could not bind {}: {} — bridge disabled this session",
                    addr, err
                );
                return;
            }
        };
        eprintln!("[photoshop-bridge] listening on ws://{}", addr);

        while let Ok((stream, peer)) = listener.accept().await {
            let app = app.clone();
            let state = Arc::clone(&state);
            tokio::spawn(async move {
                if let Err(err) = handle_connection(app, state, stream, peer).await {
                    eprintln!("[photoshop-bridge] connection error from {}: {}", peer, err);
                }
            });
        }
    });
}

async fn handle_connection(
    app: AppHandle,
    state: Arc<PhotoshopBridgeState>,
    stream: tokio::net::TcpStream,
    peer: std::net::SocketAddr,
) -> Result<(), String> {
    let ws = tokio_tungstenite::accept_async(stream)
        .await
        .map_err(|e| format!("ws handshake: {}", e))?;
    eprintln!("[photoshop-bridge] plugin connected from {}", peer);

    let (mut write, mut read) = ws.split();
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<Message>();

    // Bytt ut tidligere aktiv tilkobling.
    {
        let mut active = state.active.lock().await;
        *active = Some(ActiveConnection {
            sender: tx.clone(),
            plugin_version: None,
            photoshop_version: None,
        });
    }
    notify_status(&app, &state).await;

    // Skriver-task: dytter ut-meldinger fra mpsc inn på socketen.
    let writer_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
        let _ = write.close().await;
    });

    // Leser-løkken kjører i denne tasken.
    while let Some(frame) = read.next().await {
        let frame = match frame {
            Ok(f) => f,
            Err(err) => {
                eprintln!("[photoshop-bridge] read error: {}", err);
                break;
            }
        };
        match frame {
            Message::Text(text) => {
                if let Err(err) = handle_incoming(&app, &state, &text).await {
                    eprintln!("[photoshop-bridge] handle_incoming: {}", err);
                }
            }
            Message::Binary(_) => { /* ignorer */ }
            Message::Ping(p) => {
                let _ = tx.send(Message::Pong(p));
            }
            Message::Pong(_) => {}
            Message::Close(_) => break,
            Message::Frame(_) => {}
        }
    }

    // Klienten gikk ned — rydd opp.
    eprintln!("[photoshop-bridge] plugin disconnected ({})", peer);
    {
        let mut active = state.active.lock().await;
        // Bare nullstill hvis det fortsatt er VÅR connection (en nyere kan ha
        // overskrevet oss mens vi var i ferd med å avslutte).
        if let Some(conn) = active.as_ref() {
            if conn.sender.same_channel(&tx) {
                *active = None;
            }
        }
    }
    notify_status(&app, &state).await;
    writer_task.abort();
    Ok(())
}

async fn handle_incoming(
    app: &AppHandle,
    state: &Arc<PhotoshopBridgeState>,
    text: &str,
) -> Result<(), String> {
    let msg: IncomingMessage =
        serde_json::from_str(text).map_err(|e| format!("parse {}: {}", text, e))?;
    match msg {
        IncomingMessage::Hello {
            plugin_version,
            photoshop_version,
        } => {
            {
                let mut active = state.active.lock().await;
                if let Some(conn) = active.as_mut() {
                    conn.plugin_version = plugin_version;
                    conn.photoshop_version = photoshop_version;
                }
            }
            notify_status(app, state).await;
        }
        IncomingMessage::Response {
            request_id,
            ok,
            result,
            error,
        } => {
            if let Some((_, responder)) = state.pending.remove(&request_id) {
                let payload = if ok {
                    Ok(result.unwrap_or(Value::Null))
                } else {
                    Err(error.unwrap_or_else(|| "unknown plugin error".to_string()))
                };
                let _ = responder.send(payload);
            }
        }
        IncomingMessage::Event { event, data } => {
            let payload = serde_json::json!({ "event": event, "data": data });
            if let Err(err) = app.emit("photoshop://event", payload) {
                eprintln!("[photoshop-bridge] emit event failed: {}", err);
            }
        }
    }
    Ok(())
}

async fn notify_status(app: &AppHandle, state: &Arc<PhotoshopBridgeState>) {
    let status = current_status(state).await;
    if let Err(err) = app.emit("photoshop://status", &status) {
        eprintln!("[photoshop-bridge] emit status failed: {}", err);
    }
}

async fn current_status(state: &Arc<PhotoshopBridgeState>) -> BridgeStatus {
    let active = state.active.lock().await;
    match active.as_ref() {
        Some(conn) => BridgeStatus {
            connected: true,
            plugin_version: conn.plugin_version.clone(),
            photoshop_version: conn.photoshop_version.clone(),
            port: BRIDGE_PORT,
        },
        None => BridgeStatus {
            connected: false,
            plugin_version: None,
            photoshop_version: None,
            port: BRIDGE_PORT,
        },
    }
}

/// Send en kommando til pluginen og vent på respons. Timer ut etter
/// REQUEST_TIMEOUT.
pub async fn send_command(
    state: &Arc<PhotoshopBridgeState>,
    command: String,
    params: Value,
) -> Result<Value, String> {
    let request_id = Uuid::new_v4().to_string();
    let payload = OutgoingRequest {
        kind: "request",
        request_id: &request_id,
        command: &command,
        params: &params,
    };
    let text = serde_json::to_string(&payload).map_err(|e| e.to_string())?;

    let sender = {
        let active = state.active.lock().await;
        match active.as_ref() {
            Some(conn) => conn.sender.clone(),
            None => {
                return Err(
                    "Photoshop Bridge-plugin er ikke tilkoblet. Åpne Photoshop og sjekk at Post Agent Bridge-panelet kjører.".into(),
                );
            }
        }
    };

    let (tx, rx) = oneshot::channel::<Result<Value, String>>();
    state.pending.insert(request_id.clone(), tx);

    if sender.send(Message::Text(text)).is_err() {
        state.pending.remove(&request_id);
        return Err("WebSocket-kanal til plugin er stengt.".into());
    }

    match timeout(REQUEST_TIMEOUT, rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => {
            state.pending.remove(&request_id);
            Err("Plugin lukket før respons kom.".into())
        }
        Err(_) => {
            state.pending.remove(&request_id);
            Err(format!(
                "Photoshop-kommando '{}' tidsavbrutt etter {}s",
                command,
                REQUEST_TIMEOUT.as_secs()
            ))
        }
    }
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn photoshop_send_command(
    state: tauri::State<'_, Arc<PhotoshopBridgeState>>,
    command: String,
    params: Option<Value>,
) -> Result<Value, String> {
    send_command(&state, command, params.unwrap_or(Value::Null)).await
}

#[tauri::command]
pub async fn photoshop_status(
    state: tauri::State<'_, Arc<PhotoshopBridgeState>>,
) -> Result<BridgeStatus, String> {
    Ok(current_status(&state).await)
}
